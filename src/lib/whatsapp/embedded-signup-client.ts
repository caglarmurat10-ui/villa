const GRAPH_API_VERSION = "v21.0";

export type EmbeddedSignupExchangeResult =
  | { ok: true; accessToken: string; expiresInSeconds: number | null }
  | { ok: false; reason: string };

function sanitizeErrorMessage(message: string): string {
  return message.replace(/[A-Za-z0-9._~-]{40,}/g, "[REDACTED]").slice(0, 400);
}

// FB.login() JS SDK popup'ından (response_type: 'code', override_default_response_type: true)
// dönen kod, Meta'nın kendi resmi örneğinde redirect_uri OLMADAN değiştiriliyor - bu, sunucu-taraflı
// yönlendirme tabanlı OAuth akışlarından (facebook.ts'teki facebookAuthorizeUrl gibi, orada
// redirect_uri ZORUNLU) FARKLI bir davranış; popup akışında kod zaten tarayıcıda üretildiği için
// eşleşecek bir redirect_uri yok. Kaynak: developers.facebook.com/documentation/facebook-login/
// facebook-login-for-business (2026-09-09'da doğrulandı, örnek çağrı redirect_uri içermiyor).
export async function exchangeEmbeddedSignupCode(appId: string, appSecret: string, code: string): Promise<EmbeddedSignupExchangeResult> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  let response: Response;
  try {
    response = await fetch(url.toString(), { method: "GET" });
  } catch (error) {
    return { ok: false, reason: sanitizeErrorMessage(`Ağ hatası: ${error instanceof Error ? error.message : String(error)}`) };
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

  if (!response.ok) {
    const errorObj = payload && typeof payload === "object" ? (payload.error as Record<string, unknown> | undefined) : undefined;
    const reason = errorObj && typeof errorObj.message === "string" ? errorObj.message : `Meta OAuth HTTP ${response.status}`;
    return { ok: false, reason: sanitizeErrorMessage(reason) };
  }

  const accessToken = payload && typeof payload.access_token === "string" ? payload.access_token : null;
  if (!accessToken) {
    return { ok: false, reason: "Meta yanıtında access_token bulunamadı." };
  }
  const expiresInSeconds = payload && typeof payload.expires_in === "number" ? payload.expires_in : null;
  return { ok: true, accessToken, expiresInSeconds };
}
