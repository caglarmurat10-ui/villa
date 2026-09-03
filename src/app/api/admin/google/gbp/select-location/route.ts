import { z } from "zod";
import { discoverGbpAccountsAndLocations } from "@/lib/gbp/adapter";
import { setGbpLocationMapping } from "@/lib/gbp/mapping";

export const dynamic = "force-dynamic";

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  locationName: z.string().min(1),
});

// admin.safiradestan.com'da adminAuthGate tarafından korunuyor. TEK mutation burada: kendi
// GOOGLE_PRIVATE KV eşlememize yazar - GBP API'sine hiçbir yazma isteği YAPMAZ. Client'ın
// gönderdiği locationName körü körüne güvenilmez - gerçek discovery sonucunda dönen bir kayıtla
// eşleşmesi sunucu tarafında yeniden doğrulanır (isim benzerliğiyle DEĞİL, admin'in az önce
// gördüğü gerçek listeden seçtiği tam locationName ile).
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { villa, locationName } = parsed.data;

  const discovery = await discoverGbpAccountsAndLocations();
  const match = discovery.locations.find((location) => location.name === locationName);
  if (!match) {
    return Response.json({ error: "Seçilen location, güncel GBP hesap listesinde bulunamadı. Sayfayı yenileyip tekrar deneyin." }, { status: 409 });
  }

  await setGbpLocationMapping(villa, match.name, match.title);
  return Response.json({ ok: true, villa, locationTitle: match.title });
}
