import { checkDatabase } from "@/lib/db";

export async function GET() {
  try {
    await checkDatabase();
    return Response.json({ status: "healthy" });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
