import { z } from "zod";
import { discoverGbpAccountsAndLocations } from "@/lib/gbp/adapter";
import { getGbpLocationMapping, setGbpLocationMapping } from "@/lib/gbp/mapping";

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
//
// Faz 6.1 - kullanıcı bir seçim yaptığını bildirdi ama production KV'de karşılığı yoktu; kod
// incelemesinde bir exception-swallowing/binding farkı BULUNAMADI (OAuth callback route'ları AYNI
// GOOGLE_PRIVATE'a başarıyla yazıyor, aynı runtime deseniyle) - kesin kök neden tekrar
// üretilemedi. Bu yüzden "ok:true" artık HİÇBİR ZAMAN yalnızca put()'un exception atmamasına
// güvenmez: put'tan hemen sonra AYNI anahtar geri okunur ve beklenen villa/locationName ile
// birebir eşleştiği doğrulanmadan başarı dönülmez - put sessizce yanlış yere yazsa/kaybolsa bile
// admin artık YANLIŞ bir "kaydedildi" mesajı GÖRMEZ.
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

  try {
    await setGbpLocationMapping(villa, match.name, match.title);
  } catch (error) {
    console.error(`[GBP select-location] setGbpLocationMapping başarısız: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    return Response.json({ error: "Kayıt yazılamadı (KV erişim hatası). Tekrar deneyin." }, { status: 502 });
  }

  const readBack = await getGbpLocationMapping(villa);
  if (!readBack || readBack.locationName !== match.name) {
    console.error(`[GBP select-location] read-back doğrulaması başarısız: villa=${villa} beklenen=${match.name} okunan=${readBack?.locationName ?? "null"}`);
    return Response.json({ error: "Kayıt yazıldı ama doğrulanamadı - lütfen tekrar deneyin. Sorun sürerse bir sonraki adımı çalıştırmayın." }, { status: 502 });
  }

  return Response.json({ ok: true, villa, locationTitle: readBack.locationTitle, persisted: true });
}
