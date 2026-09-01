import { listOtaConnectionsStatus } from "@/lib/ota/status";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate (custom-worker.mjs) tarafından zaten korunuyor - bu route
// hiçbir public allowlist'e eklenmedi. Ham import URL'si burada hiç yok (status.ts zaten döndürmüyor).
export async function GET() {
  const connections = await listOtaConnectionsStatus();
  return Response.json({ connections });
}
