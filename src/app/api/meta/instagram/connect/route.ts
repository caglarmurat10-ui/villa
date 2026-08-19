import { instagramAuthorizeUrl } from "@/lib/meta";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");
  if (villa !== "Safira" && villa !== "Destan") return Response.json({ error: "Geçersiz villa." }, { status: 400 });
  const nonce = crypto.randomUUID().replaceAll("-", "");
  try {
    const location = await instagramAuthorizeUrl(villa, nonce);
    return new Response(null, {
      status: 302,
      headers: {
        Location: location,
        "Set-Cookie": `ig_oauth_nonce=${nonce}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta bağlantısı başlatılamadı.";
    return new Response(null, { status: 302, headers: { Location: `/sosyal?meta_error=${encodeURIComponent(message)}` } });
  }
}
