import { computePriceQuote, splitEvenMinor, type PriceRangeInput } from "../price-engine";
import type { GoogleVrPropertyId, GoogleVrQuote } from "./types";

// SAF fonksiyon - D1/network cagrisi yok. price-engine.ts'teki AYNI computePriceQuote'u kullanir
// (tek kaynak: public site/booking widget ile birebir ayni fiyat mantigi). isOccupied cagiran
// tarafca saglanir (reservations + status='active' OTA bloklari - needs_review KESINLIKLE
// "musait degil" olarak Google'a gonderilmemeli, bu yuzden cagiran taraf yalnizca 'active' bloklari
// isOccupied'a dahil etmelidir - bu dosya bunu zorunlu KILAMAZ, cagiran tarafin sorumlulugundadir).
//
// nightly_rate/total price-engine.ts'te TL cinsinden tutulur (kuruş değil) - PayTR/payments
// katmanindaki "Minor" (kuruş) kuralina uymak icin burada x100 ile donusturulur. Google'in kendi
// feed formatinin gercek beklenen birimi (micros/minor/vs) - resmi Google VR entegrasyon
// dokumantasyonu olmadan varsayilmaz; bu yalniz INTERNAL model, gercek adapter/XML uretimi ayri
// bir asama (bkz. rapor).
export interface GoogleVrFeedInputs {
  priceRanges: PriceRangeInput[]; // yalniz ilgili villa'nin donemleri
  isOccupied: boolean; // reservations VEYA dogrulanmis (status='active') OTA blogu ile cakisiyor mu - cagiran taraf hesaplar
}

export function computeGoogleVrQuote(
  propertyId: GoogleVrPropertyId,
  checkIn: string,
  checkOut: string,
  occupancy: number,
  inputs: GoogleVrFeedInputs,
): GoogleVrQuote {
  const lastUpdated = new Date().toISOString();
  const base = { propertyId, checkIn, checkOut, occupancy, currency: "TRY" as const, lastUpdated };
  // checkIn'i kapsayan dönemin minimum_nights'ı - available=false olsa bile (ör. min_stay/gap)
  // çağıran tarafın LOS politikasını görebilmesi için ayrıca hesaplanır.
  const minimumNights = inputs.priceRanges.find((range) => range.startDate <= checkIn && range.endDate >= checkIn)?.minimumNights ?? null;

  if (inputs.isOccupied) {
    return { ...base, available: false, nightlyBreakdown: [], totalMinor: null, minimumNights };
  }

  // enforceMinimumStay varsayılan (true) ile çağrılır - Google'a, siteye 4 geceden kısa bir
  // konaklama "müsait+fiyatlı" olarak asla bildirilmemeli (minimum konaklama politikası burada da
  // geçerli - bkz. computePriceQuote enforceMinimumStay).
  const quote = computePriceQuote(inputs.priceRanges, checkIn, checkOut);
  if (quote.status !== "ok") {
    // gap, invalid_range veya min_stay - fiyat tanimsiz/gecersiz/politika-disi tarih ASLA
    // "musait+fiyatli" olarak gonderilmez
    return { ...base, available: false, nightlyBreakdown: [], totalMinor: null, minimumNights };
  }

  // Her segment'in TAM kuruş toplamı (segment.subtotal zaten minor-unit-safe hesaplandı, bkz.
  // price-engine.ts segmentSubtotal) splitEvenMinor ile gecelere dağıtılır - nightlyBreakdown'ın
  // toplamı HER ZAMAN totalMinor'a birebir eşit kalır (1 kuruşluk sürüklenme dahi olmaz).
  const nightlyBreakdown: Array<{ date: string; rateMinor: number }> = [];
  let totalMinor = 0;
  for (const segment of quote.segments) {
    const segmentSubtotalMinor = Math.round(segment.subtotal * 100);
    totalMinor += segmentSubtotalMinor;
    const perNight = splitEvenMinor(segmentSubtotalMinor, segment.nights);
    let cursor = new Date(`${segment.startDate}T00:00:00Z`);
    for (let index = 0; index < segment.nights; index += 1) {
      nightlyBreakdown.push({ date: cursor.toISOString().slice(0, 10), rateMinor: perNight[index] });
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  }

  return { ...base, available: true, nightlyBreakdown, totalMinor, minimumNights };
}
