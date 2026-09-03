// FALSE POSITIVE OTA CONFLICT SEMANTICS FIX (2026-09-03 karari) - bir needs_review OTA blogunun
// GERCEKTEN insan incelemesi gerektiren bir cakisma mi, yoksa yalniz sistemde zaten bilinen bir
// rezervasyonun OTA takviminde tekrar goruntusu mu ("ayna") oldugunu SAF, D1/network cagrisi
// YAPMAYAN bir sekilde turetir. Stored external_blocks.status hicbir zaman bu modul tarafindan
// degistirilmez - yalniz OKUMA/goruntuleme katmani icin ek bir siniflandirma katmanidir.
//
// Kural: bloğun her bir AÇIK SEZON gecesi (kapali sezon geceleri zaten "beklenen kapali" oldugu
// icin hic kontrol edilmez) en az bir active/non-deleted rezervasyon tarafindan kapsanmali. Hepsi
// kapsaniyorsa blok yalniz bilinen bir rezervasyonun OTA yansimasidir (EXPECTED_RESERVATION_MIRROR).
// Kapsanmayan tek bir acik-sezon gecesi bile varsa (rezervasyon yok, veya yalniz kismi/supheli
// ortusme) gercek inceleme gerekir (REVIEW_REQUIRED).
import { isOpenSeasonDate } from "@/lib/season-policy";

export type OtaConflictDisposition = "EXPECTED_RESERVATION_MIRROR" | "REVIEW_REQUIRED";

// Yalniz tarih araliklari - misafir adi/telefon/e-posta ASLA bu tipin bir parcasi degil (PII yok).
export interface ReservationRangeLike {
  checkIn: string; // dahil
  checkOut: string; // haric (checkout-tarzi, external_blocks ile ayni semantik)
}

export interface OtaBlockRangeLike {
  startDate: string; // dahil
  endDateExclusive: string; // haric (checkout-tarzi)
}

function isNightCovered(nightIso: string, reservations: ReservationRangeLike[]): boolean {
  return reservations.some((r) => r.checkIn <= nightIso && nightIso < r.checkOut);
}

// reservations: yalniz AYNI villa'nin active/non-deleted rezervasyonlari cagiran taraftan
// gelmelidir (bu fonksiyon villa filtrelemesi YAPMAZ - cagiran zaten dogru alt kumeyi gecirir,
// tipki mevcut hasDirectReservationConflict/hasOtherSourceConflict kaliplarinda oldugu gibi).
export function evaluateOtaConflictDisposition(
  block: OtaBlockRangeLike,
  reservations: ReservationRangeLike[],
): OtaConflictDisposition {
  const start = new Date(`${block.startDate}T00:00:00Z`);
  const end = new Date(`${block.endDateExclusive}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return "EXPECTED_RESERVATION_MIRROR";

  for (let cursor = start; cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const night = cursor.toISOString().slice(0, 10);
    if (!isOpenSeasonDate(night)) continue; // kapali sezon gecesi - zaten beklenen, kontrol gerekmez
    if (!isNightCovered(night, reservations)) return "REVIEW_REQUIRED";
  }
  return "EXPECTED_RESERVATION_MIRROR";
}
