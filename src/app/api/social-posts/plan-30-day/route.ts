import { ensureRolling30DayPlan } from "@/lib/social-plan-seed";

export const dynamic = "force-dynamic";

// FAZ 5 bölüm 3 - admin panelinden tetiklenen, önümüzdeki 30 günü mevcut gerçek içerik havuzuyla
// dolduran planlayıcı (bkz. social-plan-seed.ts ensureRolling30DayPlan). Yeni satırlar da diğer
// TÜM oluşturma yollarıyla aynı şekilde approval_status='İnsan onayı' ile eklenir - otomatik
// yayın kapısı (duePosts approval_status='Onaylandı' + Destan/Instagram HARD BLOCK) değişmedi.
export async function POST() {
  try {
    const result = await ensureRolling30DayPlan();
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "30 günlük plan oluşturulamadı." }, { status: 500 });
  }
}
