import { ensureRolling30DayPlan, ensureSpecialDayPosts } from "@/lib/social-plan-seed";

export const dynamic = "force-dynamic";

// FAZ 5 bölüm 3 - admin panelinden VEYA günlük cron'dan (custom-worker.mjs
// runDailySocialPlannerIfDue, "0 3 * * *") tetiklenen, önümüzdeki 30 günü mevcut gerçek içerik
// havuzuyla dolduran planlayıcı (bkz. social-plan-seed.ts ensureRolling30DayPlan). Yeni satırlar
// da diğer TÜM oluşturma yollarıyla aynı şekilde approval_status='İnsan onayı' ile eklenir -
// otomatik yayın kapısı (duePosts approval_status='Onaylandı' + Destan/Instagram HARD BLOCK)
// değişmedi.
//
// Faz 6 bölüm 5 - ensureSpecialDayPosts (resmi/dini bayram) BİLEREK AYNI çağrıda, ardından
// çalıştırılır - ikisi de aynı günlük cron tetikleyicisinden gelir, ayrı bir cron/route eklemeye
// gerek yok. SPECIAL_DAY içerikleri normal karmadan (categoryForTheme) ayrı sayıldığı için ikisi
// birbirini etkilemez.
export async function POST() {
  try {
    const result = await ensureRolling30DayPlan();
    const specialDays = await ensureSpecialDayPosts();
    return Response.json({ result, specialDays });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "30 günlük plan oluşturulamadı." }, { status: 500 });
  }
}
