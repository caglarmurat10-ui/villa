import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { retryFailedCheckoutReminder, setCheckoutReminderAutoEnabled } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["enable", "disable", "retry"]),
});

// Admin oturumu custom-worker.mjs'teki adminAuthGate ile (admin.safiradestan.com) sağlanır - diğer
// tüm /api/admin/* route'larıyla aynı model, burada ayrıca bir kontrol yok.
export async function PATCH(request: NextRequest, context: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await context.params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (parsed.data.action === "retry") {
    const message = await retryFailedCheckoutReminder(reservationId);
    if (!message) {
      return NextResponse.json({ error: "Yeniden denenecek gerçekten FAILED durumunda bir kayıt bulunamadı." }, { status: 409 });
    }
    return NextResponse.json({ message });
  }

  const message = await setCheckoutReminderAutoEnabled(reservationId, parsed.data.action === "enable");
  if (!message) {
    return NextResponse.json({ error: "Bu rezervasyon için planlanmış (SCHEDULED) bir hatırlatma bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ message });
}
