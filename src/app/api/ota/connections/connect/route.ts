import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyIcsUrl } from "@/lib/ota/verify";
import { setImportUrl } from "@/lib/ota/kv";
import { syncOneConnection } from "@/lib/ota/sync";
import { logOtaAudit } from "@/lib/ota/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  platform: z.enum(["airbnb", "booking"]),
  icsUrl: z.string().url().max(2048),
});

// Kaydetmeden ÖNCE her zaman yeniden doğrular - istemcinin "az önce doğruladım" iddiasına
// güvenilmez. Doğrulama başarısızsa KV'ye hiçbir şey yazılmaz. Yanıt asla icsUrl içermez.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { villa, platform, icsUrl } = parsed.data;

  const verify = await verifyIcsUrl(villa, platform, icsUrl);
  if (!verify.ok) {
    return Response.json({ connected: false, stage: verify.stage, error: verify.message }, { status: 422 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const now = new Date().toISOString();

  await setImportUrl(villa, platform, icsUrl);
  await env.DB.prepare(`
    INSERT INTO ota_connections (id, villa, platform, is_enabled, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(villa, platform) DO UPDATE SET is_enabled = 1, updated_at = excluded.updated_at
  `).bind(crypto.randomUUID(), villa, platform, now, now).run();

  await logOtaAudit("ICAL_FEED_CONNECTED", { villa, source: platform, count: verify.eventCount });

  // Bağlantı kaydedilir kaydedilmez gerçek bir sync çalıştırılır - böylece connections listesindeki
  // sayılar, kullanıcının az önce doğrulama önizlemesinde gördüğü sonuçla tutarlı olur.
  const syncResult = await syncOneConnection(villa, platform);

  return Response.json({
    connected: true,
    villa,
    platform,
    eventCount: verify.eventCount,
    conflictCount: verify.conflictCount,
    lastVerifiedAt: now,
    syncOk: syncResult.ok,
  });
}
