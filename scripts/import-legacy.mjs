import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";

const SOURCE_URL = "https://script.google.com/macros/s/AKfycbwcESR-OvcQPnTpZLMPdZQmAOMXLF5iPAZ9gtRWPcds1xwXMzU4DwOP1af4EK96IAbEZg/exec";
const databasePath = process.env.DATABASE_PATH ?? "./data/villa.db";
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Eski veri kaynağı yanıt vermedi: ${response.status}`);
const payload = await response.json();
const source = Array.isArray(payload?.reservations) ? payload.reservations : [];
if (source.length === 0) throw new Error("Eski kaynakta rezervasyon bulunamadı.");

const toIstanbulDate = (value) => new Date(new Date(value).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const normalized = source.map((item) => {
  const reservation = {
    legacyId: String(item.ID ?? ""),
    guestName: String(item.Name ?? "").trim(),
    villa: String(item.Apart ?? ""),
    checkIn: toIstanbulDate(item.CheckIn),
    checkOut: toIstanbulDate(item.CheckOut),
    nights: Number(item.Nights ?? 0),
    nightlyRate: Number(item.Price ?? 0),
    totalAmount: Number(item.Brut ?? 0),
    legacyNet: Number(item.Net ?? 0),
    sourceUpdatedAt: String(item.UpdatedAt ?? ""),
  };
  reservation.signature = [reservation.guestName.toLocaleLowerCase("tr-TR"), reservation.villa, reservation.checkIn, reservation.checkOut].join("|");
  reservation.id = `legacy-${createHash("sha256").update(reservation.signature).digest("hex").slice(0, 24)}`;
  return reservation;
});

const invalid = normalized.filter((item) =>
  !item.guestName || !["Safira", "Destan"].includes(item.villa) || item.checkOut <= item.checkIn ||
  !Number.isFinite(item.totalAmount) || item.totalAmount < 0 ||
  Math.round((Date.parse(item.checkOut) - Date.parse(item.checkIn)) / 86400000) !== item.nights
);
if (invalid.length) throw new Error(`${invalid.length} geçersiz kayıt bulundu; aktarım iptal edildi.`);
if (new Set(normalized.map((item) => item.signature)).size !== normalized.length) throw new Error("Eski kaynakta mükerrer kayıt bulundu; aktarım iptal edildi.");

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 10000");
const existing = db.prepare("SELECT guest_name, villa, check_in, check_out FROM reservations WHERE deleted_at IS NULL").all();
const existingSignatures = new Set(existing.map((item) => [String(item.guest_name).toLocaleLowerCase("tr-TR"), item.villa, item.check_in, item.check_out].join("|")));
const candidates = normalized.filter((item) => !existingSignatures.has(item.signature));
const conflicts = candidates.filter((item) => existing.some((current) => current.villa === item.villa && item.checkIn < current.check_out && item.checkOut > current.check_in));
if (conflicts.length) throw new Error(`${conflicts.length} tarih çakışması bulundu; aktarım iptal edildi.`);

const batchId = randomUUID();
const importedAt = new Date().toISOString();
const insert = db.prepare(`INSERT INTO reservations
  (id, villa, guest_name, phone, check_in, check_out, channel, nightly_rate, total_amount, paid_amount, notes, created_at, updated_at)
  VALUES (?, ?, ?, '', ?, ?, 'Diğer', ?, ?, 0, ?, ?, ?)`);
const audit = db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'IMPORT', ?, ?)");

db.exec("BEGIN IMMEDIATE");
try {
  for (const item of candidates) {
    const notes = `Eski sistemden aktarıldı. Kaynak net tutar: ${item.legacyNet} TL.`;
    insert.run(item.id, item.villa, item.guestName, item.checkIn, item.checkOut, item.nightlyRate, item.totalAmount, notes, importedAt, importedAt);
    audit.run(item.id, JSON.stringify({ batchId, legacyId: item.legacyId, sourceNights: item.nights, sourceGross: item.totalAmount, sourceNet: item.legacyNet, sourceUpdatedAt: item.sourceUpdatedAt }), importedAt);
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

const importedCount = Number(db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action = 'IMPORT' AND json_extract(payload, '$.batchId') = ?").get(batchId).count);
const activeCount = Number(db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE deleted_at IS NULL").get().count);
db.close();
console.log(JSON.stringify({ source: normalized.length, skippedExisting: normalized.length - candidates.length, imported: importedCount, activeReservationsAfterImport: activeCount, batchId }, null, 2));
