import {
  clearAiAdminCookie,
  createAiAdminCookie,
  hasAiAdminSession,
  sameOrigin,
  verifyAiAdminKey,
} from "@/lib/aiAdminSession";
import { socialOperationsDb } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { env } = await socialOperationsDb();
  return Response.json({ authenticated: await hasAiAdminSession(request, env).catch(() => false) });
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
    const body = await request.json() as { accessKey?: string };
    const { env } = await socialOperationsDb();
    if (typeof body.accessKey !== "string" || !(await verifyAiAdminKey(body.accessKey, env))) {
      return Response.json({ error: "Yönetici erişim anahtarı geçersiz." }, { status: 401 });
    }
    return Response.json({ authenticated: true }, { headers: { "Set-Cookie": await createAiAdminCookie(env) } });
  } catch {
    return Response.json({ error: "AI yönetici erişimi yapılandırılmadı." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  return Response.json({ authenticated: false }, { headers: { "Set-Cookie": clearAiAdminCookie } });
}
