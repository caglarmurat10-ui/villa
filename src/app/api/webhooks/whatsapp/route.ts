import { NextRequest, NextResponse } from "next/server";
import { getWhatsappWebhookSecrets } from "@/lib/whatsapp/config";
import { verifyWhatsappWebhookSignature } from "@/lib/whatsapp/webhook-signature";
import {
  markCheckoutReminderDeliveredByProviderMessageId,
  markCheckoutReminderFailedByProviderMessageId,
  markCheckoutReminderReadByProviderMessageId,
} from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

// Meta webhook doğrulama handshake'i (Meta App Dashboard > WhatsApp > Configuration'da "Verify and
// Save" tıklandığında gönderilir). WHATSAPP_WEBHOOK_VERIFY_TOKEN yapılandırılmadan (fail-closed) bu
// asla başarıyla doğrulanamaz - hiçbir varsayılan/sabit token kullanılmaz.
export async function GET(request: NextRequest) {
  const secrets = await getWhatsappWebhookSecrets();
  if (!secrets) {
    return NextResponse.json({ error: "WHATSAPP_NOT_CONFIGURED" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || token !== secrets.verifyToken || !challenge) {
    return NextResponse.json({ error: "Doğrulama başarısız." }, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

type WhatsappStatusEntry = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ title?: string; message?: string }>;
};

type WebhookChange = { field?: unknown; value?: unknown };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

// Meta'nın WABA webhook zarfı: { object, entry: [{ id, changes: [{ field, value }] }] }. `field`
// hangi tür olayın geldiğini söyler - Coexistence'ta "messages" (durum/gelen mesaj), "history"
// (geçmiş senkronu), "smb_app_state_sync" (rehber senkronu), "smb_message_echoes" (WhatsApp Business
// App'ten gönderilen mesajların yansıması) olabilir. Bilinmeyen/gelecekteki bir field asla hata
// fırlatmaz - yalnız sayılır, 200 ile ACK edilir.
function extractChanges(payload: unknown): WebhookChange[] {
  const changes: WebhookChange[] = [];
  const entryList = asRecord(payload)?.entry;
  if (!Array.isArray(entryList)) return changes;
  for (const entry of entryList) {
    const entryChanges = asRecord(entry)?.changes;
    if (!Array.isArray(entryChanges)) continue;
    for (const change of entryChanges) {
      const record = asRecord(change);
      if (record) changes.push({ field: record.field, value: record.value });
    }
  }
  return changes;
}

function timestampToIso(rawTimestamp: string | undefined): string {
  const seconds = Number(rawTimestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

async function handleMessagesField(value: Record<string, unknown> | null): Promise<{ statusesProcessed: number; inboundMessagesIgnored: number }> {
  if (!value) return { statusesProcessed: 0, inboundMessagesIgnored: 0 };

  const statuses = Array.isArray(value.statuses) ? (value.statuses as WhatsappStatusEntry[]) : [];
  for (const status of statuses) {
    if (!status.id || !status.status) continue;
    const timestampIso = timestampToIso(status.timestamp);
    if (status.status === "delivered") {
      await markCheckoutReminderDeliveredByProviderMessageId(status.id, timestampIso);
    } else if (status.status === "read") {
      await markCheckoutReminderReadByProviderMessageId(status.id, timestampIso);
    } else if (status.status === "failed") {
      const reason = status.errors?.[0]?.message || status.errors?.[0]?.title || "Meta webhook: gönderim başarısız bildirildi.";
      await markCheckoutReminderFailedByProviderMessageId(status.id, reason, timestampIso);
    }
    // "sent" durumu ayrıca işlenmiyor - satır zaten dispatch anında SENT olarak işaretlendi.
  }

  // "messages" field'ı, misafirin işletmeye ATTIĞI gelen mesajları da taşıyabilir (value.messages).
  // Bu otomasyonun tek işi çıkış hatırlatması göndermek - gelen müşteri mesajının İÇERİĞİNİ D1'e
  // KAYDETMİYORUZ (gereksiz PII depolama yasağı). Yalnız sayılır, ACK edilir.
  const inboundMessages = Array.isArray(value.messages) ? value.messages.length : 0;
  return { statusesProcessed: statuses.length, inboundMessagesIgnored: inboundMessages };
}

// Meta'nın WhatsApp durum bildirimleri (sent/delivered/read/failed) VE Coexistence olayları
// (history/smb_app_state_sync/smb_message_echoes). İmza doğrulanmadan (X-Hub-Signature-256, ham
// gövde üzerinden, WhatsApp'ı barındıran gerçek Meta App'in secret'ıyla - bkz. config.ts audit notu)
// HİÇBİR satır güncellenmez - sahte/üçüncü taraf bir POST'un D1'e yazması engellenir. Yapılandırma
// eksikse de aynı şekilde reddedilir, sessizce "başarılı" dönmez.
//
// PII/veri minimizasyonu: history (geçmiş mesajlar), smb_app_state_sync (rehber/kişi senkronu) ve
// smb_message_echoes (WhatsApp Business App'ten gönderilenlerin yansıması) alanlarındaki HİÇBİR ham
// mesaj/kişi içeriği D1'e YAZILMAZ - bu otomasyonun tek ihtiyacı, kendi gönderdiği çıkış
// hatırlatmalarının teslim durumunu (provider_message_id ile eşleşen sent/delivered/read/failed)
// takip etmek. Diğer her şey sayılır ve güvenle ACK edilir.
export async function POST(request: NextRequest) {
  const secrets = await getWhatsappWebhookSecrets();
  if (!secrets) {
    return NextResponse.json({ error: "WHATSAPP_NOT_CONFIGURED" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");
  const validSignature = await verifyWhatsappWebhookSignature(secrets.appSecret, rawBody, signatureHeader);
  if (!validSignature) {
    return NextResponse.json({ error: "Geçersiz imza." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as unknown;
  const changes = extractChanges(payload);

  let statusesProcessed = 0;
  let inboundMessagesIgnored = 0;
  let historyEventsIgnored = 0;
  let contactSyncEventsIgnored = 0;
  let messageEchoesIgnored = 0;
  let unknownFieldsIgnored = 0;

  for (const change of changes) {
    const value = asRecord(change.value);
    switch (change.field) {
      case "messages": {
        const result = await handleMessagesField(value);
        statusesProcessed += result.statusesProcessed;
        inboundMessagesIgnored += result.inboundMessagesIgnored;
        break;
      }
      case "history":
        // Coexistence geçmiş senkron olayı - içerik KASITLI OLARAK okunmuyor/saklanmıyor.
        historyEventsIgnored += 1;
        break;
      case "smb_app_state_sync":
        // Coexistence rehber/kişi senkron olayı - kişi bilgisi KASITLI OLARAK okunmuyor/saklanmıyor.
        contactSyncEventsIgnored += 1;
        break;
      case "smb_message_echoes":
        // WhatsApp Business App'ten gönderilen mesajların yansıması - içerik KASITLI OLARAK
        // okunmuyor/saklanmıyor.
        messageEchoesIgnored += 1;
        break;
      default:
        // Bilinmeyen/gelecekteki bir field - asla hata fırlatmaz, yalnız sayılır ve ACK edilir.
        unknownFieldsIgnored += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    statusesProcessed,
    inboundMessagesIgnored,
    historyEventsIgnored,
    contactSyncEventsIgnored,
    messageEchoesIgnored,
    unknownFieldsIgnored,
  });
}
