import { testPaytrConnectivity } from "@/lib/payments/paytr/connectivity-test";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafından zaten korunuyor (diğer /api/admin/* route'ları
// gibi) - bu route hiçbir public allowlist'e eklenmedi. PARA HAREKETİ YOK: yalnızca PayTR get-token
// bağlantısını sentetik veriyle test eder, D1'e hiçbir şey yazmaz, hiçbir gerçek ödeme oluşturmaz.
export async function POST() {
  const result = await testPaytrConnectivity();
  return Response.json(result);
}
