import { computePriceQuote, type PriceRangeInput } from "../price-engine";
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

  if (inputs.isOccupied) {
    return { ...base, available: false, nightlyBreakdown: [], totalMinor: null };
  }

  const quote = computePriceQuote(inputs.priceRanges, checkIn, checkOut);
  if (quote.status !== "ok") {
    // gap veya invalid_range - fiyat tanimsiz/gecersiz tarih ASLA "musait+fiyatli" olarak gonderilmez
    return { ...base, available: false, nightlyBreakdown: [], totalMinor: null };
  }

  const nightlyBreakdown: Array<{ date: string; rateMinor: number }> = [];
  for (const segment of quote.segments) {
    let cursor = new Date(`${segment.startDate}T00:00:00Z`);
    const end = new Date(`${segment.endDate}T00:00:00Z`);
    while (cursor < end) {
      nightlyBreakdown.push({ date: cursor.toISOString().slice(0, 10), rateMinor: Math.round(segment.nightlyRate * 100) });
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  }

  return { ...base, available: true, nightlyBreakdown, totalMinor: Math.round(quote.total * 100) };
}
