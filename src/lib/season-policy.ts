// Kullanıcının kesinleştirdiği YILLIK, TEKRARLANAN sezon kuralı (2026-09-03 - artık yıla bağlı
// değil). SAF fonksiyonlar, D1/network çağrısı yok - hem client (PublicBookingWidget,
// VillaAvailabilityCalendar) hem server (booking-inquiries.ts, social-plan-seed.ts,
// google-vr/readiness.ts) aynı modülü kullanır.
//
// HER YIL, her iki villa için:
//   AÇIK SEZON: 15 Haziran -> 15 Eylül (ikisi de dahil)
//   KAPALI SEZON: 16 Eylül -> ertesi yılın 14 Haziran'ı (ikisi de dahil)
// Kural yalnız ay/gün (MM-DD) karşılaştırmasıyla çalışır - hangi YIL olduğu tamamen önemsizdir,
// bu yüzden 2026/2027/2028/... arasında hiçbir özel durum/istisna YOKTUR (eski sürüm 2026-09-30'a
// kadar olan tarihleri bu modülün kapsamı dışında tutuyordu - bu istisna kullanıcının "artık yıla
// bağlı değil" kararıyla KALDIRILDI, kural artık gerçekten her yıl aynı şekilde uygulanır).
//
// Çağıran taraf zaten Europe/Istanbul yerel tarihine göre bir YYYY-MM-DD string'i sağlamalı
// (mevcut istanbulToday() deseniyle tutarlı) - bu modülün kendisi ayrıca bir timezone dönüşümü
// YAPMAZ, yalnız string karşılaştırması yapar (leap year dahil hiçbir takvim aritmetiği gerekmez -
// MM-DD karşılaştırması Şubat'ın kaç gün olduğundan tamamen bağımsızdır).
//
// Fiyat/sezon FİYATLARI (kaç TRY, kaç gece) bu modülün kapsamı DIŞINDADIR - onlar HER YIL için ayrı
// ayrı D1 price_ranges'ta doğrulanmalı (bkz. price-engine.ts computePriceQuote, TEK gerçek fiyat
// kaynağı). Bu dosya yalnız "hangi tarihler sezon içinde/dışında" sorusuna cevap verir.
import type { Villa } from "./types";

export const SEASON_OPEN_START_MD = "06-15"; // dahil, her yıl
export const SEASON_OPEN_END_MD = "09-15"; // dahil, her yıl
export const SEASON_MINIMUM_NIGHTS = 4; // referans/dokümantasyon amaçlı - gerçek zorunluluk price_ranges.minimum_nights'tan gelir

// D1 price_ranges'daki 2027 canonical kayıtlarla (2026-09-03 production audit'inde doğrulandı:
// Safira base_price_minor=11000000/base_nights=7/minimum_nights=4, Destan
// base_price_minor=13000000/base_nights=7/minimum_nights=4) BİREBİR eşleşmesi gereken referans
// değerler - yalnız 2027 için, GELECEK yıllara otomatik UYGULANMAZ (her yılın fiyatı ayrı
// doğrulanmalı). Yalnız test/gösterim amaçlı - fiyat HER ZAMAN price-engine.ts computePriceQuote
// üzerinden gerçek D1 satırlarından hesaplanır, bu sabitler asla doğrudan bir fiyat hesabının
// YERİNE geçmez.
export const SEASON_2027_REFERENCE_PRICES: Record<Villa, { totalTRY: number; nights: number }> = {
  Safira: { totalTRY: 110000, nights: 7 },
  Destan: { totalTRY: 130000, nights: 7 },
};

export const CLOSED_SEASON_MESSAGE =
  "Bu tarihlerde sezonumuz kapalıdır. Rezervasyon sezonumuz her yıl 15 Haziran – 15 Eylül arasındadır.";

// LEGACY CONFIRMED RESERVATION EXCEPTIONS (2026-09-03 kararı) - yıllık kural devreye girmeden ÖNCE
// alınmış, gerçek/aktif rezervasyonlar geriye dönük olarak reddedilmez/silinmez/kırpılmaz. Bu sabit,
// bu modülün mevcut (yıllık, 09-15/06-15) sürümünü taşıyan Cloudflare Worker version'ının GERÇEK
// production activation anıdır - keyfi bir gün başlangıcı DEĞİL. Kaynak: `wrangler deployments list`
// çıktısında version a7188423-5a6e-4800-82b4-87208937ae48 için deployment (100% trafik) kaydının
// kendi "Created" zaman damgası = 2026-09-03T18:11:21.599Z; bu, aynı version'ın kendi build/"Created"
// zaman damgasından (2026-09-03T18:11:17.969Z) ~4sn SONRAdır ve production'a asıl trafiğin yönlendiği
// andır. İki bağımsız kayıt birbirini doğruluyor: (1) wrangler deployments list (deployment log), (2)
// o deploy'un hemen ardından çağrılan canlı /api/system/version yanıtı - versionId=a7188423-... ve
// versionCreatedAt=2026-09-03T18:11:17.969861Z (build zaman damgasıyla mikrosaniyeye kadar eşleşir).
// Yalnız BU sabitten ÖNCE oluşturulmuş rezervasyonlar "eski politika altında onaylanmış" sayılır.
// YENİ hiçbir talep/rezervasyon (bu tarihten sonra oluşturulan) hiçbir zaman bu istisnadan
// yararlanmaz - bkz. booking-inquiries.ts createBookingInquiry, bu sabiti hiç import ETMEZ,
// hasClosedSeasonNight kuralı yeni talepler için istisnasız uygulanmaya devam eder.
export const ANNUAL_SEASON_POLICY_DEPLOYED_AT = "2026-09-03T18:11:21.599Z";

export const PRE_POLICY_EXCEPTION_LABEL = "Önceki sezon politikasında onaylanmış rezervasyon";

export interface PrePolicyReservationLike {
  checkIn: string;
  checkOut: string;
  createdAt: string;
}

// true dönmesi: bu rezervasyon PRE_POLICY_CONFIRMED_EXCEPTION'dır - kapalı sezona taşan bir gece
// içeriyor AMA yıllık kural deploy edilmeden ÖNCE oluşturulmuş, dolayısıyla geriye dönük olarak
// geçersiz/hatalı SAYILMAZ (bkz. dosya başı not). Yalnız GÖSTERİM/sınıflandırma amaçlıdır - hiçbir
// zaman bir rezervasyonu değiştirmek, silmek veya yeniden fiyatlandırmak için KULLANILMAZ; çağıran
// taraf zaten değişmeyen stored total/checkIn/checkOut alanlarını okumaya devam eder.
export function isPrePolicyConfirmedException(reservation: PrePolicyReservationLike): boolean {
  return hasClosedSeasonNight(reservation.checkIn, reservation.checkOut) && reservation.createdAt < ANNUAL_SEASON_POLICY_DEPLOYED_AT;
}

function monthDay(dateIso: string): string {
  return dateIso.slice(5, 10); // "MM-DD"
}

// true dönmesi: bu tarih (yılından bağımsız) 15 Haziran - 15 Eylül aralığındadır.
export function isOpenSeasonDate(dateIso: string): boolean {
  const md = monthDay(dateIso);
  return md >= SEASON_OPEN_START_MD && md <= SEASON_OPEN_END_MD;
}

// true dönmesi: bu tarih BİLİNÇLİ olarak kapalı sezon politikası kapsamındadır (fiyatı eksik bir
// PRICE_GAP DEĞİL - kiralama yapılmayacağı zaten kesinleşmiş, her yıl tekrarlanan bir dönem).
export function isClosedSeasonDate(dateIso: string): boolean {
  return !isOpenSeasonDate(dateIso);
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

// GÖSTERİM amaçlı dahil-uçlu aralık (startDate VE endDate ikisi de dahil) - external_blocks'un
// kendi start_date/end_date şemasıyla (end_date checkout-tarzı HARİÇ) KARIŞTIRILMAMALI. Bu tip
// yalnız section 5'in admin UI'da istediği "CONFLICT: 1 Eylül -> 15 Eylül" gibi insan-okunur
// aralıkları temsil eder.
export interface DisplayRange {
  startDate: string; // dahil
  endDate: string; // dahil - GÖSTERİM İÇİN son GECE, checkout günü değil
}

function nextDayIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Bir [startDate, endDateExclusive) aralığını (external_blocks/reservations ile AYNI checkout-tarzı
// hariç-uçlu semantik - bkz. ics-parser.ts DTEND, price-engine.ts segment yorumu) gün gün dolaşıp
// açık-sezon ve kapalı-sezon GECELERİNİ ayrı, ardışık DAHİL segmentlere ayırır. Section 5: uzun bir
// OTA bloğu (ör. 1 Eylül -> 15 Haziran ertesi yıl, DTEND hariç) hem açık hem kapalı sezonu, hatta
// BİRDEN FAZLA AYRIK açık-sezon segmentini kapsayabilir (blok bir sonraki yılın 15 Haziran'ına
// kadar sürüyorsa, o gün de yeni açık sezonun ilk günüdür) - bu yüzden TEK bir {start,end} yerine
// bir DİZİ döner, hiçbir segment yanlışlıkla birleştirilmez.
export function evaluateOtaBlockAgainstSeason(startDate: string, endDateExclusive: string): { openSegments: DisplayRange[]; closedSegments: DisplayRange[] } {
  const openSegments: DisplayRange[] = [];
  const closedSegments: DisplayRange[] = [];
  if (!startDate || !endDateExclusive || endDateExclusive <= startDate) return { openSegments, closedSegments };

  let openCurrent: DisplayRange | null = null;
  let closedCurrent: DisplayRange | null = null;
  const end = new Date(`${endDateExclusive}T00:00:00Z`);
  for (let cursor = new Date(`${startDate}T00:00:00Z`); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = cursor.toISOString().slice(0, 10);
    if (isOpenSeasonDate(iso)) {
      closedCurrent = null;
      if (openCurrent && nextDayIso(openCurrent.endDate) === iso) {
        openCurrent.endDate = iso;
      } else {
        openCurrent = { startDate: iso, endDate: iso };
        openSegments.push(openCurrent);
      }
    } else {
      openCurrent = null;
      if (closedCurrent && nextDayIso(closedCurrent.endDate) === iso) {
        closedCurrent.endDate = iso;
      } else {
        closedCurrent = { startDate: iso, endDate: iso };
        closedSegments.push(closedCurrent);
      }
    }
  }
  return { openSegments, closedSegments };
}
