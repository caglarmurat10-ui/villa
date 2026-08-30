import {
  exchangeFacebookCode,
  exchangeFacebookLongLivedToken,
  getFacebookPages,
  getFacebookPermissionStatus,
  verifyFacebookState,
} from "@/lib/facebook";
import { createFacebookSelection } from "@/lib/facebook-private-store";

type MetaStage =
  | "state"
  | "nonce-cookie"
  | "code-exchange"
  | "permission-check"
  | "page-fetch"
  | "selection-save";

function cookieValue(header: string | null, name: string) {
  if (!header) return "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return error.message
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token|code|fb_exchange_token)=([^&\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 420);
}

function expiredCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function redirectError(url: URL, stage: MetaStage, error: unknown, fallback: string) {
  const message = safeErrorMessage(error, fallback);
  console.error(`[Facebook OAuth][${stage}] ${message}`);
  const target = new URL("/sosyal", url.origin);
  target.searchParams.set("meta_platform", "Facebook");
  target.searchParams.set("meta_error", message);
  target.searchParams.set("meta_stage", stage);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": expiredCookie("fb_oauth_nonce"),
    },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] ?? char));
}

function pageOptions(pages: Array<{ id: string; name: string }>) {
  return [
    '<option value="">Facebook Sayfasını seçin</option>',
    ...pages.map((page) => `<option value="${escapeHtml(page.id)}">${escapeHtml(page.name)} · ${escapeHtml(page.id)}</option>`),
  ].join("");
}

function selectionPage(pages: Array<{ id: string; name: string }>) {
  const options = pageOptions(pages);
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facebook Sayfalarını Eşleştir</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#07111f;color:#f8fafc;font-family:system-ui,sans-serif}.card{width:min(720px,100%);padding:26px;border:1px solid #334155;border-radius:20px;background:#0f1b2d}.eyebrow{font-size:11px;font-weight:800;color:#93c5fd;letter-spacing:.08em}.card h1{margin:8px 0 6px;font-size:24px}.card>p{margin:0 0 18px;color:#cbd5e1;line-height:1.5}.mapping{display:grid;gap:12px}.row{display:grid;gap:7px;padding:14px;border:1px solid #334155;border-radius:13px;background:#081423}.row strong{font-size:13px}.row select{width:100%;padding:11px 12px;border:1px solid #475569;border-radius:10px;background:#0b1728;color:#f8fafc;font:inherit}.actions{display:flex;gap:9px;margin-top:18px}.actions button,.actions a{padding:11px 14px;border-radius:10px;font-weight:800;text-decoration:none}.actions button{border:0;background:#2563eb;color:white;cursor:pointer}.actions a{border:1px solid #475569;color:#cbd5e1}.note{margin-top:14px!important;font-size:12px;color:#94a3b8!important}.warning{padding:10px 12px;border-radius:10px;background:#2a1c08;color:#fde68a!important;border:1px solid #f59e0b55}
  </style></head><body><main class="card"><span class="eyebrow">ORTAK FACEBOOK YETKİLENDİRMESİ</span><h1>Safira ve Destan Sayfalarını birlikte eşleştirin</h1><p>İki Facebook Sayfası aynı OAuth oturumundan alınan güncel Page tokenlarıyla birlikte kaydedilecek. Böylece bir villayı yeniden bağlamak diğer villanın tokenını geçersiz bırakmayacak.</p><p class="warning">Safira ve Destan için iki farklı Sayfa seçin. Otomatik isim eşleştirmesi yapılmaz.</p><form method="post" action="/api/meta/facebook/select"><div class="mapping"><label class="row"><strong>Villa Safira → Facebook Sayfası</strong><select name="safiraPageId" required>${options}</select></label><label class="row"><strong>Villa Destan → Facebook Sayfası</strong><select name="destanPageId" required>${options}</select></label></div><div class="actions"><button type="submit">İki Sayfayı birlikte bağla</button><a href="/sosyal">İptal</a></div></form><p class="note">Page tokenları tarayıcıya gönderilmez. Seçim oturumu private KV içinde şifreli tutulur ve 10 dakika sonra silinir.</p></main></body></html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error") || url.searchParams.get("error_reason");
  if (providerError) {
    return redirectError(url, "state", new Error("Facebook yetkilendirmesi reddedildi."), "Facebook yetkilendirmesi tamamlanamadı.");
  }

  const state = url.searchParams.get("state");
  if (!state) return redirectError(url, "state", new Error("OAuth state parametresi eksik."), "Facebook state doğrulaması başarısız.");

  let parsed: Awaited<ReturnType<typeof verifyFacebookState>>;
  try {
    parsed = await verifyFacebookState(state);
  } catch (error) {
    return redirectError(url, "state", error, "Facebook state doğrulaması başarısız.");
  }
  if (!parsed) return redirectError(url, "state", new Error("OAuth state imzası geçersiz."), "Facebook state doğrulaması başarısız.");

  const nonce = cookieValue(request.headers.get("cookie"), "fb_oauth_nonce");
  if (!nonce || parsed.nonce !== nonce) {
    return redirectError(url, "nonce-cookie", new Error("OAuth nonce cookie doğrulaması başarısız."), "Facebook güvenlik çerezi doğrulanamadı.");
  }

  const code = url.searchParams.get("code");
  if (!code) return redirectError(url, "code-exchange", new Error("Facebook authorization code eksik."), "Facebook yetkilendirme kodu eksik.");

  let userAccessToken: string;
  try {
    const shortLived = await exchangeFacebookCode(code);
    const longLived = await exchangeFacebookLongLivedToken(shortLived.accessToken);
    userAccessToken = longLived.accessToken;
  } catch (error) {
    return redirectError(url, "code-exchange", error, "Facebook erişim anahtarı alınamadı.");
  }

  try {
    const permissions = await getFacebookPermissionStatus(userAccessToken);
    if (!permissions.complete) {
      throw new Error(`Facebook Business Login yapılandırmasında eksik veya verilmemiş izinler: ${permissions.missing.join(", ")}. Tek yapılandırmada dört iznin de granted olması gerekir.`);
    }
  } catch (error) {
    return redirectError(url, "permission-check", error, "Facebook izinleri doğrulanamadı.");
  }

  let pages: Awaited<ReturnType<typeof getFacebookPages>>;
  try {
    pages = await getFacebookPages(userAccessToken);
    if (pages.length < 2) {
      throw new Error("Facebook bu yetkilendirmede iki Sayfayı birlikte döndürmedi. Meta izin ekranında Villa Safira ve Villa Destan Sayfalarının ikisine de erişim verin; mümkünse ‘mevcut ve gelecekteki tüm Sayfalar’ seçeneğini kullanın.");
    }
  } catch (error) {
    return redirectError(url, "page-fetch", error, "Facebook Sayfaları alınamadı.");
  }

  let sessionId: string;
  try {
    sessionId = await createFacebookSelection(parsed.villa, pages, "all");
  } catch (error) {
    return redirectError(url, "selection-save", error, "Facebook seçim oturumu oluşturulamadı.");
  }

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  headers.append("Set-Cookie", expiredCookie("fb_oauth_nonce"));
  headers.append("Set-Cookie", `fb_page_selection=${sessionId}; Path=/api/meta/facebook/select; HttpOnly; Secure; SameSite=Strict; Max-Age=600`);

  return new Response(selectionPage(pages), {
    status: 200,
    headers,
  });
}
