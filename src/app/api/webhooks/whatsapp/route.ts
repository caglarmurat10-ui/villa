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

function extractStatuses(payload: unknown): WhatsappStatusEntry[] {
  const entries: WhatsappStatusEntry[] = [];
  if (!payload || typeof payload !== "object") return entries;
  const entryList = (payload as Record<string, unknown>).entry;
  if (!Array.isArray(entryList)) return entries;
  for (const entry of entryList) {
    const changes = entry && typeof entry === "object" ? (entry as Record<string, unknown>).changes : undefined;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change && typeof change === "object" ? (change as Record<string, unknown>).value : undefined;
      const statuses = value && typeof value === "object" ? (value as Record<string, unknown>).statuses : undefined;
      if (Array.isArray(statuses)) entries.push(...(statuses as WhatsappStatusEntry[]));
    }
  }
  return entries;
}

function timestampToIso(rawTimestamp: string | undefined): string {
  const seconds = Number(rawTimestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

// Meta'nın WhatsApp mesaj durum bildirimleri (sent/delivered/read/failed). İmza doğrulanmadan
// (X-Hub-Signature-256, ham gövde üzerinden) HİÇBİR satır güncellenmez - sahte/üçüncü taraf bir
// POST'un D1'e yazması engellenir. Yapılandırma eksikse (WHATSAPP_WEBHOOK_VERIFY_TOKEN veya
// META_APP_SECRET yok) da aynı şekilde reddedilir, sessizce "başarılı" dönmez.
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
  const statuses = extractStatuses(payload);

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

  return NextResponse.json({ ok: true, processed: statuses.length });
}
