import { getCloudflareContext } from "@opennextjs/cloudflare";
import { discoverGbpAccountsAndLocations } from "@/lib/gbp/adapter";
import { setGbpLocationMapping } from "@/lib/gbp/mapping";

export const dynamic = "force-dynamic";

const GOOGLE_CORE_CONNECTIONS = ["search_console", "ga4", "gbp"] as const;
const SINGLE_CONNECTIONS = new Set(["search_console", "ga4", "gbp", "google_ads"]);

function normalizeTitle(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("tr-TR");
}

async function tryExactGbpAutoMapping(redirectBack: URL): Promise<void> {
  try {
    const discovery = await discoverGbpAccountsAndLocations();
    if (discovery.state !== "READY_READ_ONLY") {
      redirectBack.searchParams.set("gbp_auto_mapping", discovery.state.toLowerCase());
      return;
    }

    // Burada isim BENZERLIGI yok. Yalniz daha once kullanici tarafindan acikca belirlenen
    // Villa Safira -> "Villa Safira" ve Villa Destan -> "Villa Destan" eslemesi, her baslik
    // discovery sonucunda TEK ve TAM eslesiyorsa otomatik kaydedilir. Arici Tarim veya baska
    // herhangi bir isletme hicbir kosulda villa olarak eslestirilmez.
    const safira = discovery.locations.filter((location) => normalizeTitle(location.title) === "villa safira");
    const destan = discovery.locations.filter((location) => normalizeTitle(location.title) === "villa destan");

    if (safira.length === 1 && destan.length === 1 && safira[0].name !== destan[0].name) {
      await Promise.all([
        setGbpLocationMapping("Safira", safira[0].name, safira[0].title),
        setGbpLocationMapping("Destan", destan[0].name, destan[0].title),
      ]);
      redirectBack.searchParams.set("gbp_auto_mapping", "complete");
      return;
    }

    redirectBack.searchParams.set("gbp_auto_mapping", "needs_review");
  } catch (error) {
    console.error(`[Google OAuth] exact GBP auto mapping failed: ${error instanceof Error ? error.message : "unknown"}`);
    redirectBack.searchParams.set("gbp_auto_mapping", "error");
  }
}

// admin.safiradestan.com'da adminAuthGate tarafindan zaten korunuyor - Google'in kendisi de
// yalniz /api/admin/google/oauth/start'tan baslatilmis, gecerli state'i olan bir istegi buraya
// yonlendirebilir. Access/refresh token DEGERLERI hicbir zaman loglanmaz veya response'ta geri
// gosterilmez; yalniz GOOGLE_PRIVATE KV'ye yazilir. Authorization code da loglanmaz.
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const url = new URL(request.url);
  const redirectBack = new URL("/sosyal", url.origin);

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_PRIVATE) {
    redirectBack.searchParams.set("google_oauth", "not_configured");
    return Response.redirect(redirectBack.toString(), 302);
  }

  const error = url.searchParams.get("error");
  if (error) {
    redirectBack.searchParams.set("google_oauth", "denied");
    return Response.redirect(redirectBack.toString(), 302);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    redirectBack.searchParams.set("google_oauth", "invalid_request");
    return Response.redirect(redirectBack.toString(), 302);
  }

  const scopeKey = await env.GOOGLE_PRIVATE.get(`oauth_state:${state}`);
  if (!scopeKey) {
    redirectBack.searchParams.set("google_oauth", "invalid_state");
    return Response.redirect(redirectBack.toString(), 302);
  }
  await env.GOOGLE_PRIVATE.delete(`oauth_state:${state}`);

  if (scopeKey !== "google_core" && !SINGLE_CONNECTIONS.has(scopeKey)) {
    redirectBack.searchParams.set("google_oauth", "invalid_scope");
    return Response.redirect(redirectBack.toString(), 302);
  }

  try {
    const redirectUri = `${url.origin}/api/admin/google/oauth/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) {
      console.error(`[Google OAuth] token exchange HTTP ${tokenResponse.status}`);
      redirectBack.searchParams.set("google_oauth", "token_exchange_failed");
      return Response.redirect(redirectBack.toString(), 302);
    }

    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tokens.refresh_token) {
      redirectBack.searchParams.set("google_oauth", "no_refresh_token");
      return Response.redirect(redirectBack.toString(), 302);
    }

    const stored = JSON.stringify({
      refreshToken: tokens.refresh_token,
      connectedAt: new Date().toISOString(),
    });

    if (scopeKey === "google_core") {
      await Promise.all(GOOGLE_CORE_CONNECTIONS.map((key) => env.GOOGLE_PRIVATE.put(`connection:${key}`, stored)));
      await tryExactGbpAutoMapping(redirectBack);
    } else {
      await env.GOOGLE_PRIVATE.put(`connection:${scopeKey}`, stored);
      if (scopeKey === "gbp") await tryExactGbpAutoMapping(redirectBack);
    }

    redirectBack.searchParams.set("google_oauth", "connected");
    redirectBack.searchParams.set("scope", scopeKey);
    return Response.redirect(redirectBack.toString(), 302);
  } catch (err) {
    console.error(`[Google OAuth] callback failed: ${err instanceof Error ? err.message : "unknown"}`);
    redirectBack.searchParams.set("google_oauth", "error");
    return Response.redirect(redirectBack.toString(), 302);
  }
}
