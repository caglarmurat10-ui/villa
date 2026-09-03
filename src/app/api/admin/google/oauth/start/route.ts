import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafından zaten korunuyor (cookie session) - diğer
// /api/admin/* route'ları gibi hiçbir public allowlist'e eklenmedi.
//
// Search Console + GA4, aynı Google OAuth client'ı (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) ile tek
// bir izin ekranında istenir - GBP ve Google Ads ayrı, daha geniş izinler gerektirdiği için ayrı
// bir "scope" parametresiyle (query: ?scope=search_console|ga4|gbp|google_ads) tetiklenir. Google
// Ads API'sinin KENDİSİ ayrıca developer token + customer ID gerektirir (bkz. google-ads/readiness.ts)
// - bu OAuth adımı yalnız "adwords" izninin verilmesini sağlar, tek başına API erişimine yetmez.
const SCOPES: Record<string, string> = {
  search_console: "https://www.googleapis.com/auth/webmasters.readonly",
  ga4: "https://www.googleapis.com/auth/analytics.readonly",
  gbp: "https://www.googleapis.com/auth/business.manage",
  google_ads: "https://www.googleapis.com/auth/adwords",
};
const STATE_TTL_SECONDS = 10 * 60;

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GOOGLE_CLIENT_ID) {
    return Response.json({ error: "GOOGLE_CLIENT_ID tanımlı değil - Google OAuth henüz yapılandırılmadı." }, { status: 503 });
  }
  if (!env.GOOGLE_PRIVATE) {
    return Response.json({ error: "GOOGLE_PRIVATE KV bağlı değil." }, { status: 503 });
  }

  const url = new URL(request.url);
  const scopeKey = url.searchParams.get("scope") ?? "";
  const scope = SCOPES[scopeKey];
  if (!scope) {
    return Response.json({ error: "Geçersiz scope. Beklenen: search_console, ga4, gbp veya google_ads." }, { status: 400 });
  }

  // CSRF: state KV'de kısa ömürlü saklanır, callback'te birebir eşleşmeli ve tek kullanımlıktır.
  const state = randomToken();
  await env.GOOGLE_PRIVATE.put(`oauth_state:${state}`, scopeKey, { expirationTtl: STATE_TTL_SECONDS });

  const redirectUri = `${url.origin}/api/admin/google/oauth/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return Response.redirect(authUrl.toString(), 302);
}
