import { z } from "zod";
import { syncOneConnection } from "@/lib/ota/sync";

export const dynamic = "force-dynamic";

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  platform: z.enum(["airbnb", "booking"]),
});

// "Şimdi Senkronize Et" - admin.safiradestan.com'da adminAuthGate tarafından korunuyor.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const result = await syncOneConnection(parsed.data.villa, parsed.data.platform);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
