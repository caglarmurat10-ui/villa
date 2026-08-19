import { getCommissionRate, setCommissionRate } from "@/lib/db";
import { z } from "zod";

export async function GET() { return Response.json({ commissionRate: await getCommissionRate() }); }
export async function PUT(request: Request) {
  const parsed = z.object({ commissionRate: z.coerce.number().min(0).max(100) }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Komisyon 0 ile 100 arasında olmalı." }, { status: 400 });
  return Response.json({ commissionRate: await setCommissionRate(parsed.data.commissionRate) });
}
