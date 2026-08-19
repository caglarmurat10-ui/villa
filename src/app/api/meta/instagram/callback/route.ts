import { exchangeInstagramCode, getInstagramProfile, verifyInstagramState } from "@/lib/meta";
import { saveInstagramAccount } from "@/lib/meta-store";

function cookieValue(header: string | null, name: string) {
  if (!header) return "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error") || url.searchParams.get("error_reason");
  if (error) return Response.redirect(new URL(`/sosyal?meta_error=${encodeURIComponent(error)}`, url.origin), 302);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return Response.redirect(new URL("/sosyal?meta_error=Eksik+Meta+yaniti", url.origin), 302);

  try {
    const parsed = await verifyInstagramState(state);
    const nonce = cookieValue(request.headers.get("cookie"), "ig_oauth_nonce");
    if (!parsed || !nonce || parsed.nonce !== nonce) throw new Error("Meta güvenlik doğrulaması başarısız.");
    const token = await exchangeInstagramCode(code);
    const profile = await getInstagramProfile(token.accessToken);
    await saveInstagramAccount(parsed.villa, profile.id || token.userId, profile.username, token.accessToken);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/sosyal?meta_connected=${parsed.villa}`,
        "Set-Cookie": "ig_oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Instagram bağlantısı tamamlanamadı.";
    return Response.redirect(new URL(`/sosyal?meta_error=${encodeURIComponent(message)}`, url.origin), 302);
  }
}
