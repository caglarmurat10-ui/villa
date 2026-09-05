import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafindan zaten korunuyor (cookie session) - diger
// /api/admin/* route'lari gibi hicbir public allowlist'e eklenmedi.
//
// google_core, Search Console + GA4 + Business Profile izinlerini TEK Google onay ekraninda ister.
// Boylece kullanici ayri ayri uc OAuth akisindan gecmek zorunda kalmaz. Google Ads bilerek ayri
// kalir: reklam harcamasi 0 TL politikasinda ve Ads API icin ayrica developer token/customer ID
// gerekir; bu endpoint onu otomatik olarak devreye almaz.
const SCOPES: Record<string, string> = {
  google_core: [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/business.manage",
  ].join(" "),
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
    return Response.json({ error: "GOOGLE_CLIENT_ID tanimli degil - Google OAuth henuz yapilandirilmadi." }, { status: 503 });
  }
  if (!env.GOOGLE_PRIVATE) {
    return Response.json({ error: "GOOGLE_PRIVATE KV bagli degil." }, { status: 503 });
  }

  const url = new URL(request.url);
  const scopeKey = url.searchParams.get("scope") ?? "";
  const scope = SCOPES[scopeKey];
  if (!scope) {
    return Response.json({ error: "Gecersiz scope. Beklenen: google_core, search_console, ga4, gbp veya google_ads." }, { status: 400 });
  }

  // CSRF: state KV'de kisa omurlu saklanir, callback'te birebir eslesmeli ve tek kullanimlidir.
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
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return Response.redirect(authUrl.toString(), 302);
}
