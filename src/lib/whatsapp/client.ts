import type { WhatsappCredentials } from "./config";

const GRAPH_API_VERSION = "v21.0";

export type WhatsappSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; reason: string };

// Olası bir yanlışlıkla token sızıntısını (hata mesajına yansıması ihtimaline karşı) engellemek için
// custom-worker.mjs'teki safeCronError ile aynı disiplin - uzun opak token benzeri dizeleri REDACTED
// yapar, mesajı makul bir uzunlukta keser.
function sanitizeWhatsappErrorMessage(message: string): string {
  return message
    .replace(/[A-Za-z0-9._~-]{40,}/g, "[REDACTED]")
    .slice(0, 400);
}

// Yalnız RESMİ Meta WhatsApp Business Platform / Cloud API'ye konuşur - başka hiçbir kütüphane/
// otomasyon yok. toPhoneE164WithoutPlus: ülke kodu dahil, '+' işaretsiz rakam dizisi (ör.
// "905xxxxxxxxx") - src/lib/whatsapp/phone.ts normalizeWhatsappPhone() ile üretilir.
//
// Şablon parametresiz gönderiliyor: mevcut onaylı iş metni (CHECKOUT_REMINDER_MESSAGE_TEXT) hiçbir
// değişken içermiyor (misafir adı YOK, bkz. checkout-message.ts). WHATSAPP_CHECKOUT_TEMPLATE_NAME
// altında Meta'da onaylanacak şablonun da aynı şekilde sabit/parametresiz olması varsayılır - bu
// varsayım yanlışsa (şablon {{1}} gibi bir değişken bekliyorsa) Meta API bunu 132000 serisi bir
// hata koduyla (missing parameter) açıkça reddeder, sessizce yanlış içerik göndermez.
export async function sendWhatsappCheckoutReminder(
  credentials: WhatsappCredentials,
  toPhoneE164WithoutPlus: string,
): Promise<WhatsappSendResult> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.phoneNumberId}/messages`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhoneE164WithoutPlus,
        type: "template",
        template: {
          name: credentials.checkoutTemplateName,
          language: { code: "tr" },
        },
      }),
    });
  } catch (error) {
    return { ok: false, reason: sanitizeWhatsappErrorMessage(`Ağ hatası: ${error instanceof Error ? error.message : String(error)}`) };
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

  if (!response.ok) {
    const errorObj = payload && typeof payload === "object" ? (payload.error as Record<string, unknown> | undefined) : undefined;
    const reason = errorObj && typeof errorObj.message === "string" ? errorObj.message : `Meta API HTTP ${response.status}`;
    return { ok: false, reason: sanitizeWhatsappErrorMessage(reason) };
  }

  const messages = payload && Array.isArray(payload.messages) ? payload.messages : [];
  const firstMessage = messages[0] as Record<string, unknown> | undefined;
  const providerMessageId = firstMessage && typeof firstMessage.id === "string" ? firstMessage.id : null;
  if (!providerMessageId) {
    return { ok: false, reason: "Meta yanıtında mesaj kimliği (messages[0].id) bulunamadı." };
  }
  return { ok: true, providerMessageId };
}
