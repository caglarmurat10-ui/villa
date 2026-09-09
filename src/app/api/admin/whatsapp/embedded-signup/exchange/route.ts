import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { exchangeEmbeddedSignupCode } from "@/lib/whatsapp/embedded-signup-client";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ code: z.string().trim().min(1) });

// Admin oturumu custom-worker.mjs'teki adminAuthGate ile (admin.safiradestan.com) sağlanır - diğer
// tüm /api/admin/* route'larıyla aynı model.
//
// GÜVENLİK: Buradan dönen access_token hiçbir zaman D1'e/loga yazılmaz - yalnız BU isteğin
// yanıtında, admin'in kendi kimlik doğrulanmış tarayıcı oturumuna bir kez döner. Admin bu değeri
// görüp `wrangler secret put WHATSAPP_ACCESS_TOKEN` ile elle eklemelidir - kod bunu otomatik
// yapamaz (Cloudflare API token'ı bu Worker'a hiç verilmedi, verilmeyecek).
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek - 'code' zorunlu." }, { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const appId = env.FACEBOOK_APP_ID;
  const appSecret = env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID/FACEBOOK_APP_SECRET yapılandırılmamış." }, { status: 503 });
  }

  const result = await exchangeEmbeddedSignupCode(appId, appSecret, parsed.data.code);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 502 });
  }

  return NextResponse.json({ accessToken: result.accessToken, expiresInSeconds: result.expiresInSeconds });
}
