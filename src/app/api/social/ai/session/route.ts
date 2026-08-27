import {
  clearAiAdminCookie,
  createAiAdminCookie,
  hasAiAdminSession,
  sameOrigin,
  verifyAiAdminKey,
} from "@/lib/aiAdminSession";
import { aiConfigurationStatus, hasAiAdminConfiguration, integrationUnavailableResponse } from "@/lib/aiConfiguration";
import { socialOperationsDb } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { env } = await socialOperationsDb();
  const configuration = aiConfigurationStatus(env);
  return Response.json({ configured: configuration.adminConfigured,
    authenticated: configuration.adminConfigured && await hasAiAdminSession(request, env).catch(() => false), configuration });
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
    const { env } = await socialOperationsDb();
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    const body = await request.json() as { accessKey?: string };
    if (typeof body.accessKey !== "string" || !(await verifyAiAdminKey(body.accessKey, env))) {
      return Response.json({ error: "Yönetici erişim anahtarı geçersiz." }, { status: 401 });
    }
    return Response.json({ configured: true, authenticated: true, configuration: aiConfigurationStatus(env) },
      { headers: { "Set-Cookie": await createAiAdminCookie(env) } });
  } catch {
    return Response.json({ configured: false, error: "AI yönetici erişimi kullanılamıyor." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  return Response.json({ authenticated: false }, { headers: { "Set-Cookie": clearAiAdminCookie } });
}
