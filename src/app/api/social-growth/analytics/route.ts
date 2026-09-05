import { getGrowthAnalytics } from "@/lib/social-growth-analytics";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");
  if (villa !== "Safira" && villa !== "Destan") {
    return Response.json({ error: "villa parametresi Safira veya Destan olmalı." }, { status: 400 });
  }
  const snapshot = await getGrowthAnalytics(villa, istanbulToday());
  return Response.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
}
