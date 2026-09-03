import { getCloudflareContext } from "@opennextjs/cloudflare";

// custom-worker.mjs'teki admin-login rate limit'iyle ayni desen (audit_log tabanli sayim) -
// oradan kasitli olarak ayri: bu, kimlik dogrulama BASARISIZLIGI degil, HERHANGI bir istek
// denemesi sayar (public formlar icin auth yok, "basarisiz deneme" kavrami yok).
export async function isRateLimited(ip: string, scope: string, windowMs: number, maxCount: number): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const since = new Date(Date.now() - windowMs).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM audit_log WHERE entity_id = ? AND action = ? AND created_at >= ?",
  ).bind(ip, scope, since).first<{ cnt: number }>();
  return (row?.cnt ?? 0) >= maxCount;
}

export async function recordRateLimitHit(ip: string, scope: string): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  await env.DB.prepare(
    "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, ?, '{}', ?)",
  ).bind(ip, scope, new Date().toISOString()).run();
}

export function clientIpFromHeaders(headers: Headers): string {
  return headers.get("cf-connecting-ip") || "unknown";
}
