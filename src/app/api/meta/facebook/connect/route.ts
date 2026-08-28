import { facebookAuthorizeUrl } from "@/lib/facebook";

function errorPage(message: string) {
  const safe = message.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] ?? char));
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facebook bağlantısı</title><style>body{font-family:system-ui;background:#07111f;color:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:620px;margin:24px;padding:28px;border:1px solid #334155;border-radius:18px;background:#0f1b2d}.card h1{margin-top:0}.card p{color:#cbd5e1;line-height:1.55}.card a{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:10px;background:#1d4ed8;color:white;text-decoration:none;font-weight:700}</style></head><body><div class="card"><h1>Facebook bağlantısı başlatılamadı</h1><p>${safe}</p><p>Meta Developer uygulamasında Facebook Login ve gerekli Page izinleri etkin olmalıdır.</p><a href="/sosyal">Sosyal medya paneline dön</a></div></body></html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");
  if (villa !== "Safira" && villa !== "Destan") return Response.json({ error: "Geçersiz villa." }, { status: 400 });

  const nonce = crypto.randomUUID().replaceAll("-", "");
  try {
    const location = await facebookAuthorizeUrl(villa, nonce);
    return new Response(null, {
      status: 302,
      headers: {
        Location: location,
        "Set-Cookie": `fb_oauth_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      },
    });
  } catch (error) {
    return errorPage(error instanceof Error ? error.message : "Facebook bağlantısı başlatılamadı.");
  }
}
