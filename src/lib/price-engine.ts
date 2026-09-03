// SAF fonksiyon - hiçbir D1/network çağrısı yapmaz, yalnız kendisine verilen fiyat aralıklarıyla
// çalışır. Hem sunucu (src/lib/db.ts calculatePrice, admin rezervasyon oluşturma/güncelleme, quote
// API'leri) HEM istemci (PublicBookingWidget) AYNI fonksiyonu, aynı price_ranges verisiyle çağırır -
// iki taraf asla farklılaşamaz (Faz 4 bölüm C: "Client ve server fiyat hesabının farklılaşmasını
// engellemek için ortak saf price calculation helper"). Fiyat tanımsız TEK bir gece bile varsa
// kısmi/tahmini bir toplam ASLA üretmez - "gap" durumu döner (Faz 4 bölüm D: price coverage guard).

export interface PriceRangeInput {
  startDate: string; // YYYY-MM-DD, dahil
  endDate: string; // YYYY-MM-DD, dahil (mevcut price_ranges şemasıyla aynı: start<=date<=end)
  nightlyRate: number;
}

export interface PriceSegment {
  startDate: string; // dahil
  endDate: string; // hariç (checkout-tarzı, mevcut reservation/calendar kuralıyla tutarlı)
  nights: number;
  nightlyRate: number;
  subtotal: number;
}

export type PriceQuoteResult =
  | { status: "ok"; nights: number; total: number; averageRate: number; segments: PriceSegment[] }
  | { status: "gap"; missingDates: string[] }
  | { status: "invalid_range" };

function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function computePriceQuote(ranges: PriceRangeInput[], checkIn: string, checkOut: string): PriceQuoteResult {
  if (!checkIn || !checkOut || checkOut <= checkIn) return { status: "invalid_range" };

  const missingDates: string[] = [];
  const segments: PriceSegment[] = [];
  let currentSegment: PriceSegment | null = null;
  let total = 0;
  let nights = 0;

  const end = new Date(`${checkOut}T00:00:00Z`);
  for (let cursor = new Date(`${checkIn}T00:00:00Z`); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const range = ranges.find((item) => item.startDate <= date && item.endDate >= date);
    if (!range) {
      missingDates.push(date);
      continue;
    }
    nights += 1;
    total += range.nightlyRate;
    if (currentSegment && currentSegment.nightlyRate === range.nightlyRate && currentSegment.endDate === date) {
      currentSegment.nights += 1;
      currentSegment.subtotal += range.nightlyRate;
      currentSegment.endDate = nextDay(date);
    } else {
      currentSegment = { startDate: date, endDate: nextDay(date), nights: 1, nightlyRate: range.nightlyRate, subtotal: range.nightlyRate };
      segments.push(currentSegment);
    }
  }

  if (missingDates.length > 0) return { status: "gap", missingDates };
  if (nights === 0) return { status: "invalid_range" };
  return { status: "ok", nights, total, averageRate: total / nights, segments };
}

// price_ranges'ın gelecek `windowDays` gün içindeki kapsamını (kaç gün fiyatlı, hangi tarihler
// PRICE_GAP) hesaplar - admin uyarısı ve Google VR 330-gün coverage raporu için ortak kaynak.
export interface PriceCoverageReport {
  windowStart: string;
  windowEnd: string; // hariç
  totalDays: number;
  coveredDays: number;
  gapDays: number;
  gapRanges: Array<{ startDate: string; endDate: string }>; // hariç-uçlu, ardışık gap günleri birleştirilmiş
}

export function computePriceCoverage(ranges: PriceRangeInput[], todayIso: string, windowDays: number): PriceCoverageReport {
  const windowStart = todayIso;
  const end = new Date(`${todayIso}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + windowDays);
  const windowEnd = end.toISOString().slice(0, 10);

  let coveredDays = 0;
  const gapRanges: Array<{ startDate: string; endDate: string }> = [];
  let openGap: { startDate: string; endDate: string } | null = null;

  for (let cursor = new Date(`${todayIso}T00:00:00Z`); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const covered = ranges.some((item) => item.startDate <= date && item.endDate >= date);
    if (covered) {
      coveredDays += 1;
      openGap = null;
    } else if (openGap && openGap.endDate === date) {
      openGap.endDate = nextDay(date);
    } else {
      openGap = { startDate: date, endDate: nextDay(date) };
      gapRanges.push(openGap);
    }
  }

  return { windowStart, windowEnd, totalDays: windowDays, coveredDays, gapDays: windowDays - coveredDays, gapRanges };
}
