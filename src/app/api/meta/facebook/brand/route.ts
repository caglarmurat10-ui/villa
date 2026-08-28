import { z } from "zod";
import { applyFacebookBrandAssets } from "@/lib/facebook";
import { getFacebookCredentials } from "@/lib/meta-store";

const schema = z.object({ villa: z.enum(["Safira", "Destan"]) });

function safeError(error: unknown) {
  const message = error instanceof Error && error.message ? error.message : "Facebook marka ayarları uygulanamadı.";
  return message
    .replace(/(access_token|client_secret|code|fb_exchange_token)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 360);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Geçersiz villa." }, { status: 400 });

  try {
    const account = await getFacebookCredentials(parsed.data.villa);
    if (!account) return Response.json({ error: `Villa ${parsed.data.villa} Facebook Sayfası bağlı değil.` }, { status: 409 });

    const result = await applyFacebookBrandAssets(parsed.data.villa, account.accountId, account.accessToken);
    const applied = Number(result.details.applied) + Number(result.profile.applied) + Number(result.cover.applied);
    return Response.json({
      success: applied > 0,
      complete: applied === 3,
      detailsApplied: result.details.applied,
      profileApplied: result.profile.applied,
      coverApplied: result.cover.applied,
      detailsError: result.details.error ?? null,
      profileError: result.profile.error ?? null,
      coverError: result.cover.error ?? null,
    }, { status: applied > 0 ? 200 : 502 });
  } catch (error) {
    const message = safeError(error);
    console.error(`[Facebook Brand Retry] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
