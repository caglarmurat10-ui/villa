import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { updateProspectStatus } from "@/lib/social-growth-store";

const statusSchema = z.object({
  status: z.enum(["DISCOVERED", "WATCHLIST", "RECOMMENDED", "FOLLOWED_MANUALLY", "DISMISSED", "BLOCKED"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Geçerli bir durum seçin." }, { status: 400 });

  const prospect = await updateProspectStatus(id, parsed.data.status);
  if (!prospect) return Response.json({ error: "Hesap bulunamadı." }, { status: 404 });

  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.DB.prepare(
      "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'SOCIAL_PROSPECT_STATUS_CHANGE', ?, ?)",
    ).bind(id, JSON.stringify({ status: parsed.data.status }), new Date().toISOString()).run();
  } catch {
    // Audit kaydı en iyi çaba - durum güncellemesinin kendisi zaten başarılı, bunu engellemez.
  }

  return Response.json({ prospect });
}
