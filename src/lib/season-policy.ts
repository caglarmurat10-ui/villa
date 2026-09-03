// Kullanıcının 2026-09-02'de kesinleştirdiği sezon kararı - HER İKİ villa için TEK kaynak. SAF
// fonksiyonlar, D1/network çağrısı yok - hem client (PublicBookingWidget, VillaAvailabilityCalendar)
// hem server (booking-inquiries.ts, social-plan-seed.ts, google-vr/readiness.ts) aynı modülü kullanır.
//
// 2026 sezonu 2026-09-30'da (dahil) sona erer; bu tarih ve öncesi bu modülün kapsamı DIŞINDADIR -
// mevcut/geçmiş 2026 price_ranges kayıtları zaten neyin açık olduğuna karar veriyor, burada
// TEKRAR ÜRETİLMEZ. 2026-10-01'den 2027-06-14'e kadar (dahil) ve 2027-09-16'dan itibaren (yeni bir
// sezon kararı alınana kadar sınırsız) CLOSED_SEASON'dur: fiyat gösterilmez, inquiry kabul edilmez,
// Google VR'da bookable gösterilmez, "müsait/rezervasyon açık" pazarlama içeriği üretilmez. Tek açık
// 2027 penceresi: 2027-06-15 -> 2027-09-15 (ikisi de dahil).
import type { Villa } from "./types";

export const SEASON_2026_CLOSE_DATE = "2026-09-30"; // dahil - son açık gün, bu modülün kapsamı bundan SONRASI
export const SEASON_2027_OPEN_START = "2027-06-15"; // dahil
export const SEASON_2027_OPEN_END = "2027-09-15"; // dahil
export const SEASON_2027_MINIMUM_NIGHTS = 4;

// D1 price_ranges'daki canonical kayıtlarla (2026-09-03 production audit'inde doğrulandı: Safira
// base_price_minor=11000000/base_nights=7/minimum_nights=4, Destan base_price_minor=13000000/
// base_nights=7/minimum_nights=4) BİREBİR eşleşmesi gereken referans değerler. Yalnız test/gösterim
// amaçlı - fiyat HER ZAMAN price-engine.ts computePriceQuote üzerinden gerçek D1 satırlarından
// hesaplanır, bu sabitler asla doğrudan bir fiyat hesabının YERİNE geçmez.
export const SEASON_2027_REFERENCE_PRICES: Record<Villa, { totalTRY: number; nights: number }> = {
  Safira: { totalTRY: 110000, nights: 7 },
  Destan: { totalTRY: 130000, nights: 7 },
};

export const CLOSED_SEASON_MESSAGE =
  "Bu tarihlerde sezonumuz kapalıdır. 2027 sezonu için rezervasyonlarımız 15 Haziran – 15 Eylül tarihleri arasında açıktır.";

// true dönmesi: bu tarih BİLİNÇLİ olarak kapalı sezon politikası kapsamındadır (fiyatı eksik bir
// PRICE_GAP DEĞİL - kiralama yapılmayacağı zaten kesinleşmiş bir dönem). 2026-09-30 ve öncesi bu
// fonksiyonun kapsamı dışında tutulur (false döner) - o dönemin açık/kapalılığına mevcut 2026
// price_ranges kayıtları karar verir.
export function isClosedSeasonDate(dateIso: string): boolean {
  if (dateIso <= SEASON_2026_CLOSE_DATE) return false;
  if (dateIso >= SEASON_2027_OPEN_START && dateIso <= SEASON_2027_OPEN_END) return false;
  return true;
}

// [checkIn, checkOut) arasındaki GECELERDEN en az biri kapalı sezona denk geliyorsa true - bir
// rezervasyon/inquiry talebi kısmen bile kapalı sezona taşıyorsa bütün talep reddedilir
// (price-engine.ts computePriceQuote'un "tek eksik gece bile TÜM teklifi 'gap' yapar" ilkesiyle
// tutarlı - kısmi/belirsiz bir kabul asla üretilmez).
export function hasClosedSeasonNight(checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut || checkOut <= checkIn) return false;
  const end = new Date(`${checkOut}T00:00:00Z`);
  for (let cursor = new Date(`${checkIn}T00:00:00Z`); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isClosedSeasonDate(cursor.toISOString().slice(0, 10))) return true;
  }
  return false;
}
