import { getCloudflareContext } from "@opennextjs/cloudflare";

// custom-worker.mjs'teki admin-login rate limit'iyle ayni desen (audit_log tabanli sayim) -
// oradan kasitli olarak ayri: bu, kimlik dogrulama BASARISIZLIGI degil, HERHANGI bir istek
// denemesi sayar (public formlar icin auth yok, "basarisiz deneme" kavrami yok).
//
// Bilinen/kabul edilen sinirlar (2026-09-03 security phase 2 audit'inde tespit edildi, mevcut
// admin-login deseniyle AYNI - yeni bir risk degil):
// 1. IP spoofing: clientIpFromHeaders yalniz cf-connecting-ip okur - Cloudflare bu header'i
//    Worker'a ulasmadan ONCE kendi edge'inde set eder, istemci tarafindan taklit edilemez.
// 2. Race condition: check (SELECT COUNT) ve act (INSERT) atomik DEGIL - ayni IP'den tam ayni
//    anda gelen birden fazla istek, limitin hafifce (birkac istek) asilmasina yol acabilir. Bu,
//    "sert" degil "yumusak" bir limit - amac spam/flood'u pratik olarak yavaslatmak, matematiksel
//    olarak imkansiz kilmak degil. D1'de tam atomik sayac icin ayri bir mekanizma gerekir.
// 3. audit_log tablo buyumesi: her gecen istek yeni bir satir ekler, hicbir otomatik temizlik
//    (TTL/cron) yok - bu YALNIZ bu dosyaya ozgu degil, custom-worker.mjs'teki admin-login sayaci
//    da ayni sekilde sinirsiz buyur. D1 depolama maliyeti kucuk oldugu icin bu gece bir cron/temizlik
//    islemi EKLENMEDI (kapsam disi) - ileride bir bakim gorevi olarak ele alinabilir.
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
