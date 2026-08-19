import { z } from "zod";
import { publishInstagramImage } from "@/lib/meta";
import { getInstagramCredentials } from "@/lib/meta-store";

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  imageUrl: z.string().url("Geçerli görsel bağlantısı gerekli."),
  caption: z.string().trim().min(1).max(2200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz paylaşım." }, { status: 400 });
  try {
    const account = await getInstagramCredentials(parsed.data.villa);
    if (!account) return Response.json({ error: `Villa ${parsed.data.villa} Instagram hesabı bağlı değil.` }, { status: 409 });
    const mediaId = await publishInstagramImage(account.accountId, account.accessToken, parsed.data.imageUrl, parsed.data.caption);
    return Response.json({ success: true, mediaId, username: account.username });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Instagram yayını başarısız." }, { status: 502 });
  }
}
