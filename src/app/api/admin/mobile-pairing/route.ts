import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafından zaten korunuyor (cookie session) - bu route
// hiçbir public allowlist'e eklenmedi, aynı diğer /api/admin/* route'ları gibi.
//
// Kod yalnız burada, plaintext olarak, tek seferlik üretilip döner - D1'de yalnız SHA-256 hash'i
// tutulur (mobile_pairing_codes.code_hash). Tüketim tarafı custom-worker.mjs'deki
// handleMobilePair() - ADMIN_PASSWORD'a hiç ihtiyaç duymadan, bu kod eşleşmesiyle normal mobil
// login ile birebir aynı opaque mobile_sessions token'ını üretir.
const CODE_TTL_SECONDS = 10 * 60;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomDigits(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => (b % 10).toString()).join("");
}

export async function POST() {
  const { env } = await getCloudflareContext({ async: true });
  const code = randomDigits(6);
  const codeHash = await sha256Hex(code);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + CODE_TTL_SECONDS * 1000).toISOString();

  await env.DB.prepare(
    "INSERT INTO mobile_pairing_codes (id, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), codeHash, nowIso, expiresAt).run();

  return Response.json({ code, expiresIn: CODE_TTL_SECONDS });
}
