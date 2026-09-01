import { z } from "zod";
import { verifyIcsUrl } from "@/lib/ota/verify";

export const dynamic = "force-dynamic";

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  platform: z.enum(["airbnb", "booking"]),
  icsUrl: z.string().url().max(2048),
});

// Yalnız önizleme - hiçbir şey kaydetmez, KV/D1'e hiçbir yazma yapılmaz. icsUrl yalnız bu POST
// body'sinde taşınır (query string/localStorage/log yok).
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }
  const result = await verifyIcsUrl(parsed.data.villa, parsed.data.platform, parsed.data.icsUrl);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
