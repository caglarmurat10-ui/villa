import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafından zaten korunuyor - Google'ın kendisi de
// yalnız /api/admin/google/oauth/start'tan başlatılmış, geçerli state'i olan bir isteği buraya
// yönlendirebilir (kullanıcı zaten oturum açmış olmalı, çünkü start endpoint'i de korunuyor).
//
// Access/refresh token DEĞERLERİ hiçbir zaman loglanmaz veya response'ta geri gösterilmez - yalnız
// GOOGLE_PRIVATE KV'ye yazılır. Authorization code da loglanmaz.
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

  // Tek kullanımlık state doğrulaması: KV'de yoksa/süresi dolmuşsa reddedilir, bulunduysa hemen
  // silinir (replay koruması).
  const scopeKey = await env.GOOGLE_PRIVATE.get(`oauth_state:${state}`);
  if (!scopeKey) {
    redirectBack.searchParams.set("google_oauth", "invalid_state");
    return Response.redirect(redirectBack.toString(), 302);
  }
  await env.GOOGLE_PRIVATE.delete(`oauth_state:${state}`);

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
      // Google yalnız ilk onayda refresh_token döner - kullanıcı daha önce onay verdiyse
      // prompt=consent bunu zorunlu kılar (start route'ta zaten set edildi).
      redirectBack.searchParams.set("google_oauth", "no_refresh_token");
      return Response.redirect(redirectBack.toString(), 302);
    }

    await env.GOOGLE_PRIVATE.put(`connection:${scopeKey}`, JSON.stringify({
      refreshToken: tokens.refresh_token,
      connectedAt: new Date().toISOString(),
    }));

    redirectBack.searchParams.set("google_oauth", "connected");
    redirectBack.searchParams.set("scope", scopeKey);
    return Response.redirect(redirectBack.toString(), 302);
  } catch (err) {
    console.error(`[Google OAuth] callback failed: ${err instanceof Error ? err.message : "unknown"}`);
    redirectBack.searchParams.set("google_oauth", "error");
    return Response.redirect(redirectBack.toString(), 302);
  }
}
