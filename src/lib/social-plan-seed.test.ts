// Faz 5 son denetim düzeltmesi - ensureRolling30DayPlan()'ın gerçek D1 katmanıyla uçtan uca
// davranışını doğrular: AUTO_SAFE -> approval_status='Onaylandı', Destan+Instagram hiç üretilmez,
// 60 günlük duplicate history YAYINLANMIŞ (Yayınlandı) postları da kapsar.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

let db: FakeD1;
const TEST_TODAY = "2026-09-03T09:00:00.000Z";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db, APP_BASE_URL: "https://admin.safiradestan.com" } }),
}));

function loadSchema(): string {
  return ["0001_schema.sql", "0002_social_posts.sql", "0004_social_publish_tracking.sql", "0006_social_publish_lock.sql", "0007_social_post_media.sql", "0015_social_posts_scheduled_time.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

async function socialPostRows() {
  const result = await db.prepare("SELECT villa, platform, content_type, scheduled_date, caption, approval_status FROM social_posts").all<{
    villa: string; platform: string; content_type: string; scheduled_date: string; caption: string; approval_status: string;
  }>();
  return result.results;
}

describe("ensureRolling30DayPlan (gerçek D1 entegrasyon testi)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(TEST_TODAY));
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("AUTO_SAFE olarak sınıflandırılan yeni kayıtlar approval_status='Onaylandı' ile eklenir (carousel medya senkronu dahil, geri alınmaz)", async () => {
    const { ensureRolling30DayPlan } = await import("./social-plan-seed");
    await ensureRolling30DayPlan(1);
    const rows = await socialPostRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.approval_status === "Onaylandı")).toBe(true);
  });

  it("Destan + Instagram kombinasyonu planlayıcı tarafından HİÇ üretilmez (HARD BLOCK, planlama aşamasında)", async () => {
    const { ensureRolling30DayPlan } = await import("./social-plan-seed");
    await ensureRolling30DayPlan(4); // birden fazla villa/platform üretmeye zorla
    const rows = await socialPostRows();
    expect(rows.some((r) => r.villa === "Destan" && r.platform === "Instagram")).toBe(false);
  });

  it("Safira Instagram/Facebook ve Destan Facebook üretilebilir", async () => {
    const { ensureRolling30DayPlan } = await import("./social-plan-seed");
    await ensureRolling30DayPlan(4);
    const rows = await socialPostRows();
    expect(rows.some((r) => r.villa === "Safira" && r.platform === "Instagram")).toBe(true);
    expect(rows.some((r) => r.villa === "Destan" && r.platform === "Facebook")).toBe(true);
  });

  it("aynı gün içinde tekrar çağrılmak zaten dolu günlere (>= dailyTarget) asla ikinci kez içerik eklemez", async () => {
    // Not: bir gün için havuz/duplicate/no-consecutive-sales kısıtları yüzünden İLK çağrıda
    // GERÇEKTEN boş kalmışsa, ikinci çağrı o günü doldurabilir - bu bir tekrar/duplicate DEĞİL,
    // planlayıcının kaldığı yerden devam etmesidir (KV/Istanbul-tarih guard'ı, custom-worker.mjs'te,
    // cron'un GÜNDE BİR KEZ bu fonksiyonu ÇAĞIRMASINI garanti eder - bkz. ayrı DIAG testi altında).
    // Asıl garanti edilmesi gereken: zaten >= dailyTarget dolu bir GÜN asla ikinci kez içerik almaz.
    const { ensureRolling30DayPlan } = await import("./social-plan-seed");
    await ensureRolling30DayPlan(1);
    const firstRows = await socialPostRows();
    const firstDateCounts = new Map<string, number>();
    for (const row of firstRows) firstDateCounts.set(row.scheduled_date, (firstDateCounts.get(row.scheduled_date) ?? 0) + (row.platform === "Instagram" ? 1 : 0) + (row.platform === "Facebook" && row.villa === "Destan" ? 1 : 0));
    const fullyPlannedDates = new Set(firstRows.filter((r) => r.platform === "Instagram" || r.villa === "Destan").map((r) => r.scheduled_date));

    await ensureRolling30DayPlan(1);
    const secondRows = await socialPostRows();

    // Önceki tam çalışmadan gelen HER satır ikinci çağrıdan sonra da (id bazında değil, içerik
    // bazında) hâlâ tam olarak bir kez mevcut olmalı - hiçbiri kopyalanmadı/bozulmadı.
    for (const row of firstRows) {
      const matches = secondRows.filter((r) => r.scheduled_date === row.scheduled_date && r.villa === row.villa && r.platform === row.platform && r.caption === row.caption);
      expect(matches).toHaveLength(1);
    }
    // Zaten dolu (Instagram veya Destan Facebook ile temsil edilen) günlerde ikinci çağrı sonrası
    // FARKLI bir caption'a sahip ek bir satır oluşmadı.
    for (const date of fullyPlannedDates) {
      const firstCaptionsForDate = new Set(firstRows.filter((r) => r.scheduled_date === date).map((r) => r.caption));
      const secondCaptionsForDate = new Set(secondRows.filter((r) => r.scheduled_date === date).map((r) => r.caption));
      expect(secondCaptionsForDate).toEqual(firstCaptionsForDate);
    }
  });

  it("KESIN SEZON POLITIKASI - 30 gunluk ufuk kapali sezona (2026-10-01) tastigi icin, o gune HICBIR Müsaitlik/Kampanya temali gercek sablon planlanmaz", async () => {
    const { ensureRolling30DayPlan } = await import("./social-plan-seed");
    const { socialContentTemplates } = await import("./social-content-library");
    // Gercek havuzdaki Müsaitlik temali (Müsaitlik/Kampanya kategorisine eşlenen, bkz.
    // social-content-mix.ts) tüm gerçek caption'lar - "Özel" artik Villa/Konaklama'ya eslendigi
    // icin (satis kategorisi DEGIL) burada KASITLI OLARAK yok, kapali sezonda gorunmesi beklenir.
    const salesCaptions = new Set(
      socialContentTemplates.filter((t) => t.theme === "Müsaitlik").map((t) => t.caption),
    );

    await ensureRolling30DayPlan(2); // TEST_TODAY=2026-09-03 -> 30 gunluk ufuk 2026-10-03'e kadar, sinirin (2026-10-01) OTESINE gecer
    const rows = await socialPostRows();
    const closedSeasonRows = rows.filter((r) => r.scheduled_date >= "2026-10-01");
    expect(closedSeasonRows.some((r) => salesCaptions.has(r.caption))).toBe(false);
  });

  it("daha önce YAYINLANMIŞ (Yayınlandı) bir gönderinin caption'ı 60 gün içinde tekrar önerilmez", async () => {
    const now = new Date().toISOString();
    const publishedCaption = "Bir villayı özel yapan şey sadece odaları değil, günün nasıl aktığıdır.\n\nVilla Safira’da gün, havuz başında başlamak zorunda değil; ama çoğu zaman öyle devam etmek isteyeceksiniz. Gerçek villa görüntülerini kullanarak konaklama deneyimini olduğu gibi gösteriyoruz: sakin, ferah ve size ait.\n\nVillanın diğer gerçek fotoğrafları için profili inceleyin.\n\n#villasafirapatara #patara #kaş #villatatili #özelhavuz #antalya #tatil";
    await db.prepare(`INSERT INTO social_posts
      (id, villa, platform, content_type, scheduled_date, caption, media_url, status, approval_status, approved_at, published_at, created_at, updated_at)
      VALUES ('published-1', 'Safira', 'Instagram', 'Reels', '2026-08-10', ?, '/api/media/drive/x', 'Yayınlandı', 'Onaylandı', ?, ?, ?, ?)`)
      .bind(publishedCaption, now, now, now, now).run();

    const { ensureRolling30DayPlan } = await import("./social-plan-seed");
    await ensureRolling30DayPlan(8); // havuzu zorla tüket
    const rows = await socialPostRows();
    // Orijinal 'Yayınlandı' satırın kendisi hâlâ tabloda olmalı (silinmedi) - ama planlayıcı
    // AYNI caption'ı YENİ bir 'Planlandı' satır olarak bir daha ÖNERMEMİŞ olmalı (tam olarak 1 kez).
    expect(rows.filter((r) => r.caption === publishedCaption)).toHaveLength(1);
  });
});

describe("ensureSpecialDayPosts (gerçek D1 entegrasyon testi) - Faz 6 bölüm 5", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-04-01T09:00:00.000Z")); // 30 günlük ufuk 2027-04-23 (23 Nisan) icerir
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("sabit resmi tatil (23 Nisan) icin her iki villaya da AUTO_SAFE post eklenir, approval_status='Onaylandı'", async () => {
    const { ensureSpecialDayPosts } = await import("./social-plan-seed");
    const result = await ensureSpecialDayPosts();
    expect(result.created).toBeGreaterThan(0);
    const rows = await socialPostRows();
    const holidayRows = rows.filter((r) => r.scheduled_date === "2027-04-23");
    expect(holidayRows.length).toBeGreaterThan(0);
    expect(holidayRows.every((r) => r.approval_status === "Onaylandı")).toBe(true);
    expect(holidayRows.every((r) => r.caption.includes("23 Nisan"))).toBe(true);
  });

  it("Destan + Instagram kombinasyonu bayram icerigi icin de HIC uretilmez (HARD BLOCK istisnasiz)", async () => {
    const { ensureSpecialDayPosts } = await import("./social-plan-seed");
    await ensureSpecialDayPosts();
    const rows = await socialPostRows();
    expect(rows.some((r) => r.villa === "Destan" && r.platform === "Instagram")).toBe(false);
    // Ama Destan Facebook ve Safira Instagram/Facebook uretilmis olmali.
    expect(rows.some((r) => r.villa === "Destan" && r.platform === "Facebook")).toBe(true);
    expect(rows.some((r) => r.villa === "Safira" && r.platform === "Instagram")).toBe(true);
  });

  it("normal 30 gunluk icerik karmasindan (ensureRolling30DayPlan) TAMAMEN AYRIDIR - ayni kosuda ikisi birbirini bozmaz", async () => {
    const { ensureRolling30DayPlan, ensureSpecialDayPosts } = await import("./social-plan-seed");
    await ensureRolling30DayPlan(1);
    const afterMix = await socialPostRows();
    await ensureSpecialDayPosts();
    const afterSpecialDay = await socialPostRows();
    // Normal karma satirlari (23 Nisan disindaki gunler) hala oldugu gibi duruyor - special-day
    // cagrisi onlari silmedi/degistirmedi.
    const mixDates = new Set(afterMix.map((r) => r.scheduled_date));
    const stillPresent = afterMix.every((row) =>
      afterSpecialDay.some((r) => r.scheduled_date === row.scheduled_date && r.villa === row.villa && r.platform === row.platform && r.caption === row.caption),
    );
    expect(stillPresent).toBe(true);
    expect(mixDates.size).toBeGreaterThan(0);
  });
});

describe("Günlük planlayıcı cron guard regresyonu (custom-worker.mjs)", () => {
  it("KV tabanlı 'günde bir kez' idempotency guard'ı hâlâ kaynak kodda mevcut", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("social_daily_planner_last_run_date");
    expect(source).toContain("runDailySocialPlannerIfDue");
    expect(source).toContain("if (lastRunDate === today) return;");
  });

  it("günlük planlayıcı KENDİ ayrı cron tetikleyicisinden (\"0 3 * * *\") çalışır, yayın-kritik */15 cron'unun İÇİNDEN DEĞİL (Error 1102 sonrası kaynak izolasyonu)", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const wranglerSource = readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf-8");
    expect(wranglerSource).toContain('"0 3 * * *"');

    const scheduledIndex = source.indexOf("async scheduled(controller, env, ctx) {");
    expect(scheduledIndex).toBeGreaterThan(-1);
    const dedicatedCronIndex = source.indexOf('controller.cron === "0 3 * * *"', scheduledIndex);
    const dedicatedPlannerCallIndex = source.indexOf("runDailySocialPlannerIfDue(env, ctx)", dedicatedCronIndex);
    expect(dedicatedCronIndex).toBeGreaterThan(scheduledIndex);
    expect(dedicatedPlannerCallIndex).toBeGreaterThan(dedicatedCronIndex);

    // runSocialCron (yayın-kritik */15 yolu) ARTIK planlayıcıyı çağırmamalı - ikisi ayrı invocation.
    // Fonksiyonun bittiği yer için sıradaki bölüm başlığı (OTA senkronu) net bir sınır oluşturur.
    const cronFnIndex = source.indexOf("async function runSocialCron(controller, env, ctx) {");
    const cronFnEnd = source.indexOf("============ OTA", cronFnIndex);
    expect(cronFnIndex).toBeGreaterThan(-1);
    expect(cronFnEnd).toBeGreaterThan(cronFnIndex);
    const cronFnBody = source.slice(cronFnIndex, cronFnEnd);
    expect(cronFnBody).not.toContain("runDailySocialPlannerIfDue(env, ctx)");
  });
});
