import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SocialPostInput } from "./schema";
import { socialContentTemplates, type SocialContentTemplate } from "./social-content-library";
import { seedSocialPosts } from "./social-db";
import { approvedProxyMediaAsset } from "./social-drive-media";
import { listSocialPostMedia, replaceSocialPostMedia } from "./social-media-store";
import { planRolling30Days, type ExistingPost, type PlannedSlot } from "./social-content-planner";
import type { RecentPost } from "./social-duplicate-guard";
import { buildVirtualTemplates } from "./social-content-virtual-templates";
import { isClosedSeasonDate } from "./season-policy";
import { classifySpecialDaySafety, getSpecialDayForDate, type SpecialDayMatch } from "./special-days";
import type { Villa } from "./types";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

async function appBaseUrl() {
  let configured = process.env.APP_BASE_URL ?? "";
  try {
    const { env } = await getCloudflareContext({ async: true });
    configured = env.APP_BASE_URL || configured;
  } catch {}
  return (configured || "https://villa-yonetim.caglarmurat10.workers.dev").replace(/\/+$/, "");
}

function planIdentity(input: Pick<SocialPostInput, "villa" | "platform" | "contentType" | "scheduledDate" | "caption">) {
  return `${input.villa}\u001f${input.platform}\u001f${input.contentType}\u001f${input.scheduledDate}\u001f${input.caption}`;
}

async function syncSeededCarouselMedia(inputs: SocialPostInput[], baseUrl: string, today: string, preserveApproval = false) {
  const carouselInputs = inputs.filter((input) => [...new Set(input.mediaUrls ?? [])].length > 1);
  if (carouselInputs.length === 0) return 0;

  const { env } = await getCloudflareContext({ async: true });
  const rows = await env.DB.prepare(`SELECT id, villa, platform, content_type, scheduled_date, caption
    FROM social_posts
    WHERE status = 'Planlandı' AND scheduled_date >= ? AND content_type = 'Gönderi'`)
    .bind(today)
    .all<{
      id: string;
      villa: SocialPostInput["villa"];
      platform: SocialPostInput["platform"];
      content_type: SocialPostInput["contentType"];
      scheduled_date: string;
      caption: string;
    }>();

  const byIdentity = new Map(rows.results.map((row) => [planIdentity({
    villa: row.villa,
    platform: row.platform,
    contentType: row.content_type,
    scheduledDate: row.scheduled_date,
    caption: row.caption,
  }), row.id]));

  const allowedOrigins = [
    new URL(baseUrl).origin,
    "https://villa-yonetim.caglarmurat10.workers.dev",
  ];
  let synced = 0;

  for (const input of carouselInputs) {
    const postId = byIdentity.get(planIdentity(input));
    if (!postId) continue;

    const mediaUrls = [...new Set(input.mediaUrls ?? [])].slice(0, 10);
    const desired = mediaUrls.map((mediaUrl) => {
      const asset = approvedProxyMediaAsset(input.villa, mediaUrl, allowedOrigins);
      return asset ? { mediaUrl, kind: asset.mediaKind } : null;
    });
    if (desired.some((item) => item === null)) continue;

    const verified = desired.filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (verified.length < 2) continue;

    const current = await listSocialPostMedia(postId);
    const unchanged = current.length === verified.length && current.every((item, index) =>
      item.mediaUrl === verified[index]?.mediaUrl && item.kind === verified[index]?.kind,
    );
    if (unchanged) continue;

    await replaceSocialPostMedia(postId, verified, { preserveApproval });
    synced += 1;
  }

  return synced;
}

export async function ensureDefaultSocialPlan() {
  const today = istanbulToday();
  const baseUrl = await appBaseUrl();
  const inputs: SocialPostInput[] = [];

  for (const template of socialContentTemplates) {
    if (!template.mediaResolved || !template.mediaUrl || template.scheduledDate < today) continue;
    if (template.contentType === "Reels" && template.mediaKind !== "video") continue;
    const mediaUrls = (template.mediaUrls.length ? template.mediaUrls : [template.mediaUrl])
      .map((url) => new URL(url, `${baseUrl}/`).toString())
      .slice(0, 10);
    const mediaUrl = mediaUrls[0] ?? "";
    if (!mediaUrl) continue;

    inputs.push({
      villa: template.villa,
      platform: "Instagram",
      contentType: template.contentType,
      scheduledDate: template.scheduledDate,
      caption: template.caption,
      mediaUrl,
      mediaUrls,
    });

    if (template.contentType === "Gönderi" || (template.contentType === "Reels" && template.mediaKind === "video")) {
      inputs.push({
        villa: template.villa,
        platform: "Facebook",
        contentType: template.contentType,
        scheduledDate: template.scheduledDate,
        caption: template.caption,
        mediaUrl,
        mediaUrls,
      });
    }
  }

  const result = await seedSocialPosts(inputs);
  const mediaSynced = await syncSeededCarouselMedia(inputs, baseUrl, today);
  return { ...result, mediaSynced };
}

// FAZ 5 bölüm 3 - önümüzdeki 30 günü, mevcut gerçek içerik havuzunu (socialContentTemplates)
// kullanarak SÜREKLİ dolduran planlayıcı. ensureDefaultSocialPlan (yukarısı) statik şablonların
// KENDİ scheduledDate'ini olduğu gibi seed eder; bu fonksiyon ise şablonları YENİDEN TARİHLEYEREK
// bir rotasyon havuzu gibi kullanır - takvim asla boş kalmasın diye.
//
// GÜVENLİK: planRolling30Days'in AUTO_SAFE dediği adaylar dahi seedSocialPosts() üzerinden
// approval_status='İnsan onayı' ile eklenir - TÜM diğer oluşturma yollarıyla (admin formu,
// ensureDefaultSocialPlan) BİREBİR aynı davranış. AUTO_SAFE/REVIEW_REQUIRED/BLOCKED yalnız
// "bu içerik takvime otomatik ÖNERİLSİN mi" sorusuna cevap verir - "cron'un onaysız yayınlayıp
// yayınlamayacağı" sorusuna DEĞİL (o soru zaten ayrı, değişmemiş bir kapı: duePosts()
// approval_status='Onaylandı' şartı + Destan/Instagram HARD BLOCK). REVIEW_REQUIRED/BLOCKED
// adaylar HİÇBİR ZAMAN seedSocialPosts()'a gönderilmez, yalnız raporlanır.
const ROLLING_HORIZON_DAYS = 30;
const ROLLING_LOOKBACK_DAYS = 60;

function templateCaptionLookup(pool: SocialContentTemplate[]) {
  const byCaption = new Map(pool.map((t) => [t.caption, t]));
  return (caption: string) => byCaption.get(caption)?.theme;
}

export async function ensureRolling30DayPlan(dailyTarget = 1) {
  const today = istanbulToday();
  const baseUrl = await appBaseUrl();
  const { env } = await getCloudflareContext({ async: true });

  const lookbackStart = new Date(Date.parse(`${today}T00:00:00Z`) - ROLLING_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const horizonEnd = new Date(Date.parse(`${today}T00:00:00Z`) + ROLLING_HORIZON_DAYS * 86_400_000).toISOString().slice(0, 10);

  // status IN ('Planlandı','Yayınlandı') - Faz 5 son denetim düzeltmesi: daha önce YAYINLANMIŞ
  // içerikler de 60 günlük duplicate lookback'e dahil olmalı, yalnız hâlâ 'Planlandı' olanlar değil
  // (aksi halde aynı caption/medya, yayınlandıktan hemen sonra "tekrar değil" sayılıp yeniden
  // önerilebilirdi). Gelecek pencerede (scheduled_date >= today) pratikte yalnız 'Planlandı' satır
  // olur - 'Yayınlandı' bir satırın scheduled_date'i tanım gereği geçmişte kalır.
  const rows = await env.DB.prepare(
    `SELECT villa, scheduled_date, caption, media_url FROM social_posts
     WHERE status IN ('Planlandı', 'Yayınlandı') AND scheduled_date >= ? AND scheduled_date < ?`,
  ).bind(lookbackStart, horizonEnd).all<{ villa: "Safira" | "Destan"; scheduled_date: string; caption: string; media_url: string | null }>();

  // Havuz: gerçek 60 statik şablon (fotoğraflı) + region-guide.ts'ten türetilen "sanal" şablonlar
  // (Destination/Activity/Travel Tip - Social Design Engine ile gerçek zamanlı render edilir).
  // İkincisi, statik kütüphanede HİÇ karşılığı olmayan Tarih/Kültür/Doğa/Yerel-Yaşam boşluğunu
  // (bkz. önceki tur raporu, "Diğer" kovası %0) gerçek, benzersiz içerikle kapatır - bkz.
  // social-content-virtual-templates.ts.
  const pool = [...socialContentTemplates, ...buildVirtualTemplates()];
  const themeOf = templateCaptionLookup(pool);
  const existingScheduled: ExistingPost[] = [];
  const recentPosts: RecentPost[] = [];
  for (const row of rows.results) {
    if (row.scheduled_date >= today) {
      existingScheduled.push({ scheduledDate: row.scheduled_date, villa: row.villa, theme: themeOf(row.caption) });
    } else {
      recentPosts.push({ villa: row.villa, caption: row.caption, mediaFile: row.media_url ?? "", scheduledDate: row.scheduled_date });
    }
  }

  const { planned, needsReview } = planRolling30Days({
    todayIso: today,
    horizonDays: ROLLING_HORIZON_DAYS,
    dailyTarget,
    pool,
    existingScheduled,
    recentPosts,
    isClosedSeasonDate,
  });

  const templateById = new Map(pool.map((t) => [t.id, t]));
  const inputs: SocialPostInput[] = [];
  for (const slot of planned) {
    const template = templateById.get(slot.templateId);
    if (!template || !template.mediaResolved || !template.mediaUrl) continue;
    if (template.contentType === "Reels" && template.mediaKind !== "video") continue;
    const mediaUrls = (template.mediaUrls.length ? template.mediaUrls : [template.mediaUrl])
      .map((url) => new URL(url, `${baseUrl}/`).toString())
      .slice(0, 10);
    const mediaUrl = mediaUrls[0] ?? "";
    if (!mediaUrl) continue;

    // Faz 5 son denetim düzeltmesi (bölüm 11) - Destan Instagram HARD BLOCK'u yalnız cron/publish
    // route katmanına bırakmak yerine, planlayıcı aşamasında da bu kombinasyon hiç ÜRETİLMEZ
    // ("tercihen planner aşamasında da platformu üretme"). Aşağıdaki cron (duePosts,
    // custom-worker.mjs) ve manuel publish route (route.ts) guard'ları DEĞİŞMEDEN, bağımsız bir
    // ikinci savunma katmanı olarak kalmaya devam eder.
    if (template.villa !== "Destan") {
      inputs.push({ villa: template.villa, platform: "Instagram", contentType: template.contentType, scheduledDate: slot.date, caption: template.caption, mediaUrl, mediaUrls });
    }
    if (template.contentType === "Gönderi" || (template.contentType === "Reels" && template.mediaKind === "video")) {
      inputs.push({ villa: template.villa, platform: "Facebook", contentType: template.contentType, scheduledDate: slot.date, caption: template.caption, mediaUrl, mediaUrls });
    }
  }

  // autoApproveNewRows:true GÜVENLİDİR - inputs yalnız planned'dan (planRolling30Days) türetildi,
  // ki bu dizi zaten YALNIZ automationClass==='AUTO_SAFE' adayları içerir (needsReview asla buraya
  // girmez). Mevcut satırların güncellenmesi (media değişikliği) yine de HER ZAMAN 'İnsan onayı'na
  // döner - bu bayraktan etkilenmez (bkz. seedSocialPosts).
  const result = inputs.length > 0 ? await seedSocialPosts(inputs, { autoApproveNewRows: true }) : { created: 0, updated: 0, skipped: 0, total: 0 };
  // preserveApproval:true - bu satırlar zaten seedSocialPosts(..., {autoApproveNewRows:true}) ile
  // 'Onaylandı' yazıldı; carousel medya senkronu bunu sessizce geri ALMAMALI (bkz. social-media-
  // store.ts replaceSocialPostMedia notu).
  const mediaSynced = inputs.length > 0 ? await syncSeededCarouselMedia(inputs, baseUrl, today, true) : 0;

  return {
    ...result,
    mediaSynced,
    filledDays: new Set(planned.map((slot) => slot.date)).size,
    needsReview: needsReview.map((slot: PlannedSlot) => ({ date: slot.date, villa: slot.villa, templateId: slot.templateId, automationClass: slot.automationClass, reason: slot.reason })),
  };
}

// Faz 6 bölüm 5 - SPECIAL_DAY içerikleri normal 30 günlük içerik karmasından (social-content-mix.ts)
// TAMAMEN AYRI: planRolling30Days'e hiç girmez, "SPECIAL_DAY" theme'i categoryForTheme()'de
// eşleşmediği için karma yüzdelerini etkilemez. Aynı gün normal bir post zaten planlıysa onun
// YERİNE geçmez - ek bir satır olarak eklenir; günlük toplam yayın sınırı (SOCIAL_AUTO_PUBLISH_LIMIT)
// zaten cron/publish katmanında (custom-worker.mjs) korunuyor, burada AYRICA sınırlanmaz.
const SPECIAL_DAY_HORIZON_DAYS = 30;

function specialDayCaption(match: SpecialDayMatch, villa: Villa): string {
  return [match.message, `Villa ${villa} · Patara`, "#patara #kaş #antalya"].join("\n\n");
}

export interface SpecialDayReviewItem {
  date: string;
  name: string;
  automationClass: "REVIEW_REQUIRED";
  reason: string;
}

export async function ensureSpecialDayPosts(): Promise<{ created: number; updated: number; skipped: number; total: number; needsReview: SpecialDayReviewItem[] }> {
  const today = istanbulToday();
  const baseUrl = await appBaseUrl();
  const villas: Villa[] = ["Safira", "Destan"];

  const inputs: SocialPostInput[] = [];
  const needsReview: SpecialDayReviewItem[] = [];

  for (let offset = 0; offset < SPECIAL_DAY_HORIZON_DAYS; offset += 1) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    const match = getSpecialDayForDate(date);
    if (!match) continue;

    const { automationClass, reason } = classifySpecialDaySafety(match);
    const name = match.kind === "fixed" ? match.holiday.name : match.entry.name;
    if (automationClass !== "AUTO_SAFE") {
      needsReview.push({ date, name, automationClass: "REVIEW_REQUIRED", reason });
      continue;
    }

    for (const villa of villas) {
      const caption = specialDayCaption(match, villa);
      const villaSlug = villa === "Safira" ? "safira" : "destan";
      const mediaUrl = new URL(`/api/public/social-assets/${villaSlug}_special-day_${date}/feed`, `${baseUrl}/`).toString();

      // Destan Instagram HARD BLOCK - bayram içeriği dahil, İSTİSNASIZ (bkz. ensureRolling30DayPlan
      // aynı guard, bağımsız ikinci savunma katmanı).
      if (villa !== "Destan") {
        inputs.push({ villa, platform: "Instagram", contentType: "Gönderi", scheduledDate: date, caption, mediaUrl, mediaUrls: [mediaUrl] });
      }
      inputs.push({ villa, platform: "Facebook", contentType: "Gönderi", scheduledDate: date, caption, mediaUrl, mediaUrls: [mediaUrl] });
    }
  }

  const result = inputs.length > 0 ? await seedSocialPosts(inputs, { autoApproveNewRows: true }) : { created: 0, updated: 0, skipped: 0, total: 0 };
  return { ...result, needsReview };
}
