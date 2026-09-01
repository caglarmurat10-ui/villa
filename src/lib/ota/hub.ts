import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listOtaConnectionsStatus } from "./status";

const SETTINGS_KEY = "ota_hub_activated";

export async function isHubActivated(): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(SETTINGS_KEY).first<{ value: string }>();
  return row?.value === "true";
}

export interface HubReadiness {
  ready: boolean;
  reasons: string[];
}

// Dört bağlantının hepsi bağlı + hatasız + çakışmasız olmadan hazır sayılmaz. Bu kontrol hem
// gösterim (buton disabled) hem de gerçek aktivasyon isteğinde (activateHub) sunucu tarafında
// tekrar çalıştırılır - istemciye güvenilmez.
export async function checkHubReadiness(): Promise<HubReadiness> {
  const connections = await listOtaConnectionsStatus();
  const reasons: string[] = [];
  for (const connection of connections) {
    const label = `${connection.villa} / ${connection.platform}`;
    if (!connection.connected) reasons.push(`${label}: bağlı değil`);
    else if (connection.lastError) reasons.push(`${label}: son hata var`);
    else if (connection.conflictCount > 0) reasons.push(`${label}: ${connection.conflictCount} çözülmemiş çakışma`);
  }
  return { ready: reasons.length === 0, reasons };
}

// Bu fonksiyon hiçbir sync/cron davranışını DEĞİŞTİRMEZ (her bağlantı zaten kendi başına
// senkronize oluyor) - yalnızca "dört bağlantı da temiz" durumunun admin tarafından onaylandığını
// kaydeden bir teyit/checkpoint'tir (settings + audit_log). Eski Airbnb<->Booking bağlantılarına
// hiçbir şekilde dokunmaz - onları kaldırmak her zaman kullanıcının kendi platform arayüzlerinde
// yapacağı, yazılımın asla otomatik yapamayacağı bir adımdır.
export async function activateHub(): Promise<HubReadiness> {
  const readiness = await checkHubReadiness();
  if (!readiness.ready) return readiness;

  const { env } = await getCloudflareContext({ async: true });
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, 'true') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).bind(SETTINGS_KEY).run();
  await env.DB.prepare(
    "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES ('ota-hub', 'OTA_HUB_ACTIVATED', ?, ?)",
  ).bind(JSON.stringify({ connectionCount: 4 }), now).run();

  return readiness;
}
