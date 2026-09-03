// FAZ 5 bölüm 3 - Sosyal içerik planlayıcısı: SAF fonksiyon, hiçbir D1/network çağrısı yapmaz.
// Önümüzdeki `horizonDays` günü, mevcut gerçek şablon havuzunu (social-content-library.ts, 60
// insan tarafından yazılmış gerçek gönderi) kullanarak doldurur - yeni caption/hook UYDURMAZ,
// yalnız hangi gerçek şablonun hangi güne, hangi sınıflandırmayla yerleşeceğine karar verir.
//
// Kural sırası (her gün için):
//  1. O gün zaten hedef sayıda gönderi planlıysa atla (mevcut D1 kaydına dokunmaz).
//  2. En az temsil edilen içerik kategorisi öncelikli (bkz. social-content-mix.ts hedefleri).
//  3. Bir önceki dolu günün kategorisi "Satış/Müsaitlik" ise bugün o kategori denenmez
//     (satış içerikleri arka arkaya konmaz).
//  4. Son 60 günde (recentPosts) veya bu planlama koşusunda daha önce seçilmiş bir şablon bir
//     daha seçilmez (checkDuplicateContent, social-duplicate-guard.ts).
//  5. Seçilen şablon classifyContentSafety ile sınıflandırılır - yalnız AUTO_SAFE olanlar
//     otomatik plana eklenir; REVIEW_REQUIRED/BLOCKED adaylar ayrı bir listede raporlanır,
//     otomatik yayına ASLA dahil edilmez (bkz. FAZ5 bölüm 5).
import type { SocialContentTemplate } from "./social-content-library";
import type { Villa } from "./types";
import { CONTENT_MIX_TARGETS, type ContentMixCategory } from "./social-content-mix";
import { checkDuplicateContent, type RecentPost } from "./social-duplicate-guard";

export type AutomationClass = "AUTO_SAFE" | "REVIEW_REQUIRED" | "BLOCKED";

// Section 6 - fiyat/açılış saati/giriş ücreti/tur fiyatı/hava durumu/etkinlik tarihi/ulaşım
// süresi gibi DEĞİŞKEN bilgi taşıyan caption'lar doğrulanmadan AUTO_SAFE olamaz. Muhafazakâr bir
// anahtar kelime taraması - yanlış negatif yerine yanlış pozitif tercih edilir (şüpheliyse
// REVIEW_REQUIRED'a düşer, otomatik yayınlanmaz, insan onayı ister).
const VARIABLE_INFO_PATTERNS: RegExp[] = [
  /\d+[.,]?\d*\s?(tl|₺|try)\b/i, // fiyat
  /ücretsiz|giriş ücreti|tur fiyat/i,
  /\b\d{1,2}[:.]\d{2}\b/, // saat (14:00, 09.30)
  /açılış saat|kapanış saat|çalışma saat/i,
  /hava durumu|\d+\s?derece/i,
  /etkinlik tarih|festival tarih/i,
  /\d+\s?(dakika|saat)\s?(sürer|uzaklık|mesafe|yol)/i,
];

function hasVariableInfo(text: string): boolean {
  return VARIABLE_INFO_PATTERNS.some((pattern) => pattern.test(text));
}

export function classifyContentSafety(
  template: Pick<SocialContentTemplate, "caption" | "hook" | "mediaResolved">,
): { automationClass: AutomationClass; reason: string } {
  if (!template.mediaResolved) {
    return { automationClass: "BLOCKED", reason: "Medya çözümlenemedi (Drive dosyası bulunamadı)." };
  }
  if (hasVariableInfo(template.caption) || hasVariableInfo(template.hook)) {
    return {
      automationClass: "REVIEW_REQUIRED",
      reason: "Caption/hook değişken bilgi (fiyat/saat/ücret/hava/tarih) içeriyor - doğrulanmadan otomatik yayınlanamaz.",
    };
  }
  return { automationClass: "AUTO_SAFE", reason: "Sabit, doğrulanmış içerik - değişken bilgi tespit edilmedi." };
}

function templateCategory(theme: string): ContentMixCategory {
  const map: Record<string, ContentMixCategory> = {
    Villa: "Villa", "Bölge": "Bölge", Gezi: "Aktivite", "Müsaitlik": "Satış/Müsaitlik", "Özel": "Satış/Müsaitlik",
  };
  return map[theme] ?? "Diğer";
}

export interface ExistingPost {
  scheduledDate: string; // YYYY-MM-DD
  villa: Villa;
  theme?: string; // biliniyorsa mix hesabına dahil edilir
}

export interface PlannerInput {
  todayIso: string;
  horizonDays: number;
  dailyTarget: number; // gün başına hedeflenen toplam (iki villa dahil) gönderi sayısı
  pool: SocialContentTemplate[];
  existingScheduled: ExistingPost[]; // ufuk penceresindeki (today..today+horizon) mevcut Planlandı kayıtları
  recentPosts: RecentPost[]; // son 60 gün - duplicate guard için
  // Verilirse (bkz. season-policy.ts isClosedSeasonDate), "Satış/Müsaitlik" kategorisi (fiyat/
  // müsaitlik/son boş günler iddiası taşıyan şablonlar) kapalı sezon günlerine HİÇ planlanmaz -
  // slot başka bir kategoriyle doldurulur, günün toplam gönderi sayısı ETKİLENMEZ. Verilmezse
  // (mevcut çağrılar/testler) davranış öncekiyle birebir aynıdır.
  isClosedSeasonDate?: (dateIso: string) => boolean;
}

export interface PlannedSlot {
  date: string;
  templateId: string;
  villa: Villa;
  category: ContentMixCategory;
  automationClass: AutomationClass;
  reason: string;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Bir kategori-havuzu içinde deterministik olarak (id sırasına göre) ilk uygun, tekrar
// etmeyen, medyası çözümlenmiş şablonu seçer - aynı girdiyle her zaman aynı sonucu üretir (test
// edilebilirlik için kasıtlı).
function pickCandidate(
  category: ContentMixCategory,
  pool: SocialContentTemplate[],
  usedTemplateIds: Set<string>,
  recentPosts: RecentPost[],
): SocialContentTemplate | null {
  const candidates = pool
    .filter((t) => templateCategory(t.theme) === category && !usedTemplateIds.has(t.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const candidate of candidates) {
    const duplicate = checkDuplicateContent(
      { villa: candidate.villa, caption: candidate.caption, mediaFile: candidate.mediaFile },
      recentPosts,
    );
    if (!duplicate.isDuplicate) return candidate;
  }
  return null;
}

export function planRolling30Days(input: PlannerInput): { planned: PlannedSlot[]; needsReview: PlannedSlot[] } {
  const planned: PlannedSlot[] = [];
  const needsReview: PlannedSlot[] = [];
  const usedTemplateIds = new Set<string>();
  let lastFilledCategory: ContentMixCategory | null = null;

  for (let offset = 0; offset < input.horizonDays; offset += 1) {
    const date = addDays(input.todayIso, offset);
    const closedSeason = input.isClosedSeasonDate?.(date) ?? false;
    const alreadyScheduled = input.existingScheduled.filter((p) => p.scheduledDate === date).length;
    const alreadyPlannedToday = planned.filter((p) => p.date === date).length;
    let remaining = input.dailyTarget - alreadyScheduled - alreadyPlannedToday;
    if (remaining <= 0) continue;

    const categories = Object.keys(CONTENT_MIX_TARGETS) as ContentMixCategory[];
    const templateById = new Map(input.pool.map((t) => [t.id, t]));

    // En çok geride kalan kategori önceliklidir - HER seçimden sonra yeniden hesaplanır (yalnız
    // günün başında bir kez değil), böylece tek bir günde birden fazla gönderi planlanırken bile
    // (dailyTarget > 1) kategori dağılımı gerçek zamanlı dengelenir.
    function computeDeficitOrder(): ContentMixCategory[] {
      const cumulative: { theme: string }[] = [
        ...input.existingScheduled.filter((p): p is ExistingPost & { theme: string } => Boolean(p.theme)),
        ...planned.map((p) => ({ theme: templateById.get(p.templateId)?.theme ?? "" })),
      ];
      const counts = new Map<ContentMixCategory, number>(categories.map((c) => [c, 0]));
      for (const post of cumulative) {
        const category = templateCategory(post.theme);
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
      const total = cumulative.length || 1;
      return categories
        .filter((c) => c !== "Satış/Müsaitlik" || lastFilledCategory !== "Satış/Müsaitlik")
        .filter((c) => c !== "Satış/Müsaitlik" || !closedSeason)
        .sort((a, b) => {
          const deficitA = CONTENT_MIX_TARGETS[a] - ((counts.get(a) ?? 0) / total) * 100;
          const deficitB = CONTENT_MIX_TARGETS[b] - ((counts.get(b) ?? 0) / total) * 100;
          return deficitB - deficitA;
        });
    }

    while (remaining > 0) {
      let filled = false;
      const recentPlusPlanned: RecentPost[] = [
        ...input.recentPosts,
        ...planned.map((p) => ({ villa: p.villa, caption: templateById.get(p.templateId)?.caption ?? "", mediaFile: templateById.get(p.templateId)?.mediaFile ?? "", scheduledDate: p.date })),
      ];
      for (const category of computeDeficitOrder()) {
        const candidate = pickCandidate(category, input.pool, usedTemplateIds, recentPlusPlanned);
        if (!candidate) continue;

        usedTemplateIds.add(candidate.id);
        const { automationClass, reason } = classifyContentSafety(candidate);
        const slot: PlannedSlot = { date, templateId: candidate.id, villa: candidate.villa, category, automationClass, reason };
        if (automationClass === "AUTO_SAFE") {
          planned.push(slot);
          lastFilledCategory = category;
        } else {
          needsReview.push(slot);
          // Bu şablon "kullanılmış" sayılır (bir daha önerilmez) ama günü doldurmaz - insan
          // onayı beklenirken otomatik plana ASLA dahil edilmez.
        }
        filled = true;
        remaining -= 1;
        break;
      }
      if (!filled) break; // bu gün için havuzda uygun (tekrar etmeyen, sınıflandırılabilir) aday kalmadı
    }
  }

  return { planned, needsReview };
}
