import { z } from "zod";
import { getOrCreateExportToken } from "@/lib/ota/kv";

export const dynamic = "force-dynamic";

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  platform: z.enum(["airbnb", "booking"]),
});

// Export feed URL'sini "reveal" eder - admin.safiradestan.com'da adminAuthGate tarafından korunuyor,
// ve bilerek yalnız bu dedike, doğrudan istenen uçta döner (genel /api/ota/connections listesinde
// asla yer almaz).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = schema.safeParse({
    villa: url.searchParams.get("villa"),
    platform: url.searchParams.get("platform"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const token = await getOrCreateExportToken(parsed.data.villa, parsed.data.platform);
  const feedUrl = `https://safiradestan.com/api/calendar/export/${token}.ics`;
  return Response.json({ feedUrl });
}
