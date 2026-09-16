import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { toDeviceView, type MobileSessionRow } from "@/lib/mobile-pairing";

export const dynamic = "force-dynamic";

// adminAuthGate (cookie session) tarafından korunur - public allowlist'te değildir.
// Token/hash değerleri hiçbir yanıtta dönmez; yalnız cihaz meta verisi listelenir.

const revokeSchema = z.object({
  action: z.literal("revoke"),
  id: z.string().min(1).max(64),
});

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const now = new Date();

  const { results } = await env.DB.prepare(
    `SELECT id, device_label, platform, app_version, app_build, created_at, expires_at, last_seen_at, revoked_at
     FROM mobile_sessions
     ORDER BY (revoked_at IS NULL) DESC, COALESCE(last_seen_at, created_at) DESC
     LIMIT 100`,
  ).all<MobileSessionRow>();

  const devices = (results ?? []).map((row) => toDeviceView(row, now));
  return Response.json({
    devices,
    activeCount: devices.filter((d) => d.active).length,
  });
}

/** Cihaz yetkisini kaldırır: oturum server tarafında anında geçersizleşir. */
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = revokeSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const nowIso = new Date().toISOString();

  // revoked_at set edilir edilmez verifyMobileBearer() bu tokenı reddeder (WHERE revoked_at IS NULL),
  // yani cihaz bir sonraki API çağrısında yeniden eşleştirme ekranına düşer.
  const result = await env.DB.prepare(
    "UPDATE mobile_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
  ).bind(nowIso, parsed.data.id).run();

  const changes = result.meta?.changes ?? 0;
  if (changes === 0) {
    return Response.json({ error: "Cihaz bulunamadı veya zaten yetkisi kaldırılmış." }, { status: 404 });
  }

  return Response.json({ ok: true, revokedAt: nowIso });
}
