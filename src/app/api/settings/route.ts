import { getCommissionRate, getVillaLocations, setCommissionRate, setVillaLocations } from "@/lib/db";
import { z } from "zod";

const locationUrl = z.string().trim().max(500).refine(
  (value) => value === "" || /^https?:\/\//i.test(value),
  "Konum bağlantısı http:// veya https:// ile başlamalı.",
);

const locationsSchema = z.object({
  locations: z.object({ Safira: locationUrl, Destan: locationUrl }),
});

export async function GET() {
  const [commissionRate, locations] = await Promise.all([getCommissionRate(), getVillaLocations()]);
  return Response.json({ commissionRate, locations });
}
export async function PUT(request: Request) {
  const body: unknown = await request.json();
  if (typeof body === "object" && body !== null && "locations" in body) {
    const locations = locationsSchema.safeParse(body);
    if (!locations.success) {
      return Response.json({ error: locations.error.issues[0]?.message ?? "Konum bağlantısı geçerli değil." }, { status: 400 });
    }
    return Response.json({ locations: await setVillaLocations(locations.data.locations) });
  }

  const commission = z.object({ commissionRate: z.coerce.number().min(0).max(100) }).safeParse(body);
  if (!commission.success) {
    return Response.json({ error: "Komisyon 0 ile 100 arasında olmalı." }, { status: 400 });
  }
  return Response.json({ commissionRate: await setCommissionRate(commission.data.commissionRate) });
}
