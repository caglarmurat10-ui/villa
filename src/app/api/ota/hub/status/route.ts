import { checkHubReadiness, isHubActivated } from "@/lib/ota/hub";

export const dynamic = "force-dynamic";

export async function GET() {
  const [activated, readiness] = await Promise.all([isHubActivated(), checkHubReadiness()]);
  return Response.json({ activated, ready: readiness.ready, reasons: readiness.reasons });
}
