import { instagramAuthorizeUrl, metaConfig } from "@/lib/meta";

function errorPage(message: string, backUrl: string, status = 503) {
  const safe = message.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] ?? char));
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meta bağlantısı</title><style>body{font-family:system-ui;background:#07111f;color:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:560px;margin:24px;padding:28px;border:1px solid #334155;border-radius:18px;background:#0f1b2d}.card h1{margin-top:0}.card p{color:#cbd5e1;line-height:1.55}.card a{display:inline-block;margin-top:12px;padding:10px 14px;border-radius:10px;background:#4c1d95;color:white;text-decoration:none;font-weight:700}</style></head><body><div class="card"><h1>Instagram bağlantısı tamamlanamadı</h1><p>${safe}</p><p>Meta/Instagram izinlerini ve hesap sahipliğini kontrol edip tekrar deneyin. Bu bağlantı denemesi yayın yapmaz.</p><a href="${backUrl}">Sosyal medya paneline dön</a></div></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");
  if (villa !== "Safira" && villa !== "Destan") return Response.json({ error: "Geçersiz villa." }, { status: 400 });

  // Destan Instagram için yayın HARD BLOCK'u ayrı katmanlarda korunuyor. Burada yalnız OAuth
  // bağlantı teşhisine izin veriyoruz; başarılı bağlantı hiçbir içeriği otomatik yayınlamaz.
  // Böylece Business Portfolio / sahiplik sorunu çözülmüşse hesabı yeniden bağlayıp doğrulayabiliriz,
  // çözülmemişse Meta'nın gerçek OAuth hatasını güvenli biçimde görebiliriz.
  let config: Awaited<ReturnType<typeof metaConfig>>;
  try {
    config = await metaConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta bağlantısı başlatılamadı.";
    return errorPage(message, "/sosyal");
  }

  if (url.origin !== config.oauthBaseUrl) {
    const bridge = new URL("/api/meta/instagram/connect", config.oauthBaseUrl);
    bridge.searchParams.set("villa", villa);
    return new Response(null, {
      status: 302,
      headers: {
        Location: bridge.toString(),
        "Cache-Control": "no-store",
      },
    });
  }

  const nonce = crypto.randomUUID().replaceAll("-", "");
  try {
    const location = await instagramAuthorizeUrl(villa, nonce);
    return new Response(null, {
      status: 302,
      headers: {
        Location: location,
        "Set-Cookie": `ig_oauth_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta bağlantısı başlatılamadı.";
    return errorPage(message, `${config.baseUrl}/sosyal`);
  }
}
