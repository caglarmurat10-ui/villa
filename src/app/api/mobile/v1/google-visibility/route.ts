import { getGoogleVisibilitySnapshot } from "@/lib/google-visibility";

export const dynamic = "force-dynamic";

// getGoogleVisibilitySnapshot() zaten "credential yoksa uydurma" disiplinini uyguluyor - WAITING_*
// durumları burada da aynen taşınır, mobil taraf bunu asla "READY" gibi göstermemeli.
export async function GET() {
  const snapshot = await getGoogleVisibilitySnapshot();
  return Response.json({ snapshot });
}
