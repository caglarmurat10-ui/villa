import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  PAIRING_CODE_TTL_SECONDS,
  derivePairingStatus,
  generatePairingCode,
  hashPairingCode,
  pairingExpiresAt,
  pairingSecondsRemaining,
  type PairingCodeRow,
} from "@/lib/mobile-pairing";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafından zaten korunuyor (cookie session) - bu route
// hiçbir public allowlist'e eklenmedi, aynı diğer /api/admin/* route'ları gibi.
//
// Kod yalnız POST yanıtında, plaintext olarak, tek seferlik döner - D1'de yalnız SHA-256 hash'i
// tutulur (mobile_pairing_codes.code_hash), bu yüzden GET kodu tekrar gösteremez; yalnız
// durum/süre bilgisi verir. Tüketim tarafı custom-worker.mjs'deki handleMobilePair().

/** Yeni kod üretir. Bekleyen (kullanılmamış, süresi dolmamış) eski kodlar geçersizleştirilir. */
export async function POST() {
  const { env } = await getCloudflareContext({ async: true });
  const now = new Date();
  const nowIso = now.toISOString();

  // Aynı anda yalnız tek bir geçerli kod bulunsun: yeni kod üretmek eskisini iptal eder.
  // Bu, "Yeni Kod Üret" davranışını da tek adımda karşılar ve brute-force yüzeyini daraltır.
  await env.DB.prepare(
    "UPDATE mobile_pairing_codes SET used_at = ? WHERE used_at IS NULL AND expires_at > ?",
  ).bind(nowIso, nowIso).run();

  const code = generatePairingCode();
  const codeHash = await hashPairingCode(code);
  const expiresAt = pairingExpiresAt(now);

  await env.DB.prepare(
    "INSERT INTO mobile_pairing_codes (id, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), codeHash, nowIso, expiresAt).run();

  return Response.json({ code, expiresIn: PAIRING_CODE_TTL_SECONDS, expiresAt });
}

/** Bekleyen kodun durumunu döner - plaintext kod ASLA tekrar gösterilemez. */
export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const now = new Date();
  const nowIso = now.toISOString();

  const row = await env.DB.prepare(
    `SELECT id, created_at, expires_at, used_at FROM mobile_pairing_codes
     WHERE used_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(nowIso).first<PairingCodeRow>();

  if (!row) return Response.json({ pending: null });

  return Response.json({
    pending: {
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      secondsRemaining: pairingSecondsRemaining(row.expires_at, now),
      status: derivePairingStatus(row, now),
    },
  });
}

/** Bekleyen kodları iptal eder (kullanılmış say). */
export async function DELETE() {
  const { env } = await getCloudflareContext({ async: true });
  const nowIso = new Date().toISOString();
  const result = await env.DB.prepare(
    "UPDATE mobile_pairing_codes SET used_at = ? WHERE used_at IS NULL AND expires_at > ?",
  ).bind(nowIso, nowIso).run();

  return Response.json({ ok: true, cancelled: result.meta?.changes ?? 0 });
}
