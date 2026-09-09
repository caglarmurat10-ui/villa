import { getWhatsappCredentials } from "@/lib/whatsapp/config";
import { sendWhatsappCheckoutReminder } from "@/lib/whatsapp/client";
import {
  claimCheckoutReminderForSending,
  listDueCheckoutReminders,
  markCheckoutReminderFailed,
  markCheckoutReminderSent,
  markCheckoutReminderSkippedNotConfigured,
} from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

const DISPATCH_BATCH_LIMIT = 25;

// custom-worker.mjs scheduled() (*/15 cron, runWhatsappCheckoutCron) tarafından - GBP auto-publish /
// social plan-30-day / public-scout ile AYNI, kanıtlanmış in-process nextWorker.fetch() deseniyle -
// tetiklenir. Tarayıcıdan doğrudan çağrılırsa admin.safiradestan.com'daki adminAuthGate (custom-worker.mjs)
// oturum ister; bu route'un kendisi ayrıca bir auth kontrolü yapmaz (diğer cron route'larıyla aynı
// güvenlik modeli).
//
// Her satır için: atomik claim (SCHEDULED->SENDING, eşzamanlı/tekrarlı cron tetiklemelerine karşı
// güvenli) -> yapılandırma kontrolü (yoksa SKIPPED_NOT_CONFIGURED, ASLA sahte "gönderildi" değil) ->
// gerçek Meta Cloud API çağrısı -> SENT veya FAILED. Bir satırdaki hata diğerlerini durdurmaz.
export async function POST() {
  const nowIso = new Date().toISOString();
  const due = await listDueCheckoutReminders(nowIso, DISPATCH_BATCH_LIMIT);

  let sent = 0;
  let failed = 0;
  let skippedNotConfigured = 0;
  let alreadyClaimed = 0;

  for (const message of due) {
    const claimed = await claimCheckoutReminderForSending(message.id);
    if (!claimed) {
      // Başka bir eşzamanlı tetikleme bu satırı zaten aldı - retry-safe, ikinci kez gönderilmez.
      alreadyClaimed += 1;
      continue;
    }

    const credentials = await getWhatsappCredentials();
    if (!credentials) {
      await markCheckoutReminderSkippedNotConfigured(message.id);
      skippedNotConfigured += 1;
      continue;
    }

    const result = await sendWhatsappCheckoutReminder(credentials, message.recipientPhone);
    if (result.ok) {
      await markCheckoutReminderSent(message.id, result.providerMessageId, credentials.checkoutTemplateName);
      sent += 1;
    } else {
      await markCheckoutReminderFailed(message.id, result.reason, credentials.checkoutTemplateName);
      failed += 1;
      console.error(`[WhatsApp Checkout Cron] Gönderim başarısız (id=${message.id}): ${result.reason}`);
    }
  }

  return Response.json({
    candidateCount: due.length,
    sent,
    failed,
    skippedNotConfigured,
    alreadyClaimed,
  });
}
