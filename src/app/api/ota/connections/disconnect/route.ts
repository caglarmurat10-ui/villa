import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { deleteImportUrl } from "@/lib/ota/kv";
import { logOtaAudit } from "@/lib/ota/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  platform: z.enum(["airbnb", "booking"]),
});

// Secret'ı KV'den siler, bağlantıyı devre dışı bırakır, o kaynaktan gelen block'ları removed yapar
// (hard delete değil - denetim izi kalır). Eski Airbnb<->Booking DOĞRUDAN bağlantılarına dokunmaz -
// bu yalnızca bizim hub'ımızdaki bağlantıyı kapatır.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { villa, platform } = parsed.data;
  const { env } = await getCloudflareContext({ async: true });
  const now = new Date().toISOString();

  await deleteImportUrl(villa, platform);
  await env.DB.prepare("UPDATE ota_connections SET is_enabled = 0, updated_at = ? WHERE villa = ? AND platform = ?").bind(now, villa, platform).run();
  const removed = await env.DB.prepare(
    "UPDATE external_blocks SET status = 'removed', updated_at = ? WHERE villa = ? AND source = ? AND status IN ('active','needs_review')",
  ).bind(now, villa, platform).run();
  await logOtaAudit("ICAL_FEED_DISCONNECTED", { villa, source: platform, count: removed.meta?.changes ?? 0 });

  return Response.json({ connected: false, villa, platform });
}
