import {
  exchangeFacebookCode,
  exchangeFacebookLongLivedToken,
  getFacebookPages,
  getFacebookPermissionStatus,
  verifyFacebookState,
} from "@/lib/facebook";
import { createFacebookSelection } from "@/lib/facebook-private-store";
import { listMetaAccounts, saveFacebookAccount } from "@/lib/meta-store";

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

function selectionPage(villa: string, pages: Array<{ id: string; name: string }>) {
  const options = pages.map((page, index) => `
    <label class="page-option">
      <input type="radio" name="pageId" value="${escapeHtml(page.id)}" ${index === 0 ? "required" : ""}>
      <span><strong>${escapeHtml(page.name)}</strong><small>Page ID: ${escapeHtml(page.id)}</small></span>
    </label>`).join("");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facebook Sayfasını Seç</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#07111f;color:#f8fafc;font-family:system-ui,sans-serif}.card{width:min(640px,100%);padding:26px;border:1px solid #334155;border-radius:20px;background:#0f1b2d}.eyebrow{font-size:11px;font-weight:800;color:#93c5fd;letter-spacing:.08em}.card h1{margin:8px 0 6px;font-size:24px}.card>p{margin:0 0 18px;color:#cbd5e1;line-height:1.5}.page-list{display:grid;gap:9px}.page-option{display:flex;gap:12px;align-items:center;padding:13px;border:1px solid #334155;border-radius:13px;background:#081423;cursor:pointer}.page-option:has(input:checked){border-color:#60a5fa;background:#0b2542}.page-option input{width:18px;height:18px}.page-option span{display:grid;gap:3px}.page-option small{color:#94a3b8}.actions{display:flex;gap:9px;margin-top:18px}.actions button,.actions a{padding:11px 14px;border-radius:10px;font-weight:800;text-decoration:none}.actions button{border:0;background:#2563eb;color:white;cursor:pointer}.actions a{border:1px solid #475569;color:#cbd5e1}.note{margin-top:14px!important;font-size:12px;color:#94a3b8!important}
  </style></head><body><main class="card"><span class="eyebrow">FACEBOOK SAYFA EŞLEŞTİRME</span><h1>Villa ${escapeHtml(villa)} için sayfayı seçin</h1><p>Otomatik isim eşleştirmesi yapılmaz. Aşağıdaki sayfalardan doğru olanı siz açıkça seçmeden hiçbir Facebook hesabı kaydedilmez.</p><form method="post" action="/api/meta/facebook/select"><div class="page-list">${options}</div><div class="actions"><button type="submit">Seçili sayfayı bağla</button><a href="/sosyal">İptal</a></div></form><p class="note">Page tokenı tarayıcıya gönderilmez. Seçim oturumu 10 dakika sonra private KV’den otomatik silinir.</p></main></body></html>`;
}

async function refreshExistingFacebookMappings(
  pages: Awaited<ReturnType<typeof getFacebookPages>>,
) {
  const accounts = (await listMetaAccounts()).filter((account) => account.platform === "Facebook");
  for (const account of accounts) {
    const page = pages.find((candidate) => candidate.id === account.accountId);
    if (!page) continue;
    try {
      await saveFacebookAccount(
        account.villa,
        account.accountId,
        account.username,
        account.profileUrl ?? "",
        page.accessToken,
      );
    } catch (error) {
      console.error(
        `[Facebook OAuth][mapped-token-refresh][${account.villa}] ${safeErrorMessage(error, "Mevcut Facebook Page tokenı yenilenemedi.")}`,
      );
    }
  }
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
  } catch (error) {
    return redirectError(url, "page-fetch", error, "Facebook Sayfaları alınamadı.");
  }

  // Business Login yeni bir kullanıcı tokenı ürettiğinde Meta aynı Page için yeni
  // Page tokenları döndürebilir ve daha önce saklanan tokenları geçersiz kılabilir.
  // Mevcut villa↔Page eşleşmesini değiştirmeden, OAuth oturumunda açıkça erişilebilir
  // olan ve zaten eşleştirilmiş Page tokenlarını private KV içinde yenile.
  await refreshExistingFacebookMappings(pages);

  let sessionId: string;
  try {
    sessionId = await createFacebookSelection(parsed.villa, pages);
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

  return new Response(selectionPage(parsed.villa, pages), {
    status: 200,
    headers,
  });
}
