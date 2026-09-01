import { activateHub } from "@/lib/ota/hub";

export const dynamic = "force-dynamic";

// Dört bağlantı da temiz olmadan aktive etmez (server-side yeniden kontrol - istemciye güvenilmez).
// Eski Airbnb<->Booking bağlantılarına dokunmaz; bu yalnızca bir onay/checkpoint kaydıdır.
export async function POST() {
  const readiness = await activateHub();
  if (!readiness.ready) {
    return Response.json({ activated: false, reasons: readiness.reasons }, { status: 409 });
  }
  return Response.json({ activated: true });
}
