// SAF fonksiyon - hiçbir D1/network çağrısı yapmaz, yalnız kendisine verilen fiyat aralıklarıyla
// çalışır. Hem sunucu (src/lib/db.ts calculatePrice, admin rezervasyon oluşturma/güncelleme, quote
// API'leri) HEM istemci (PublicBookingWidget) AYNI fonksiyonu, aynı price_ranges verisiyle çağırır -
// iki taraf asla farklılaşamaz (Faz 4 bölüm C: "Client ve server fiyat hesabının farklılaşmasını
// engellemek için ortak saf price calculation helper"). Fiyat tanımsız TEK bir gece bile varsa
// kısmi/tahmini bir toplam ASLA üretmez - "gap" durumu döner (Faz 4 bölüm D: price coverage guard).

export interface PriceRangeInput {
  startDate: string; // YYYY-MM-DD, dahil
  endDate: string; // YYYY-MM-DD, dahil (mevcut price_ranges şemasıyla aynı: start<=date<=end)
  nightlyRate: number; // her zaman dolu - display/legacy referans gecelik fiyat (yuvarlanmış)
  // YENİ (opsiyonel) - haftalık esas fiyat modeli (2027-06-15 -> 2027-09-15 Safira/Destan kararı).
  // İkisi de doluysa canonical toplam nightlyRate*nights YERİNE round(basePriceMinor*nights/baseNights)
  // ile hesaplanır - böylece örn. 7 gecelik Destan konaklaması TAM OLARAK 130000 TRY'ye eşitlenir,
  // nightlyRate (18571.43) yalnız YUVARLANMIŞ bir referans gösterim değeridir, çarpanı DEĞİL.
  basePriceMinor?: number; // kuruş - haftalık/baz toplam
  baseNights?: number; // basePriceMinor'ın karşılık geldiği gece sayısı (örn. 7)
  // Yalnız PublicBookingWidget'ın kendi çağrısında (computePriceQuote'un varsayılan
  // enforceMinimumStay=true modunda) uygulanır - admin/server tarafı (db.ts getPriceQuote)
  // bilinçli olarak enforceMinimumStay:false geçer, personel manuel istisna oluşturabilsin diye.
  minimumNights?: number;
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
  | { status: "invalid_range" }
  | { status: "min_stay"; minimumNights: number };

function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Bir segment'in (aynı price_ranges satırına ait, ardışık geceler) toplamı: haftalık esas fiyat
// modeli varsa minor-unit-safe oransal pay (round(basePriceMinor*nights/baseNights)/100),
// segment TAM baseNights kadarsa bu HER ZAMAN basePriceMinor/100'e (ör. 130000) birebir eşittir -
// floating point sürüklenmesi yok. Yoksa eski davranış: nights * nightlyRate.
function segmentSubtotal(range: PriceRangeInput, nights: number): number {
  if (typeof range.basePriceMinor === "number" && typeof range.baseNights === "number" && range.baseNights > 0) {
    return Math.round((range.basePriceMinor * nights) / range.baseNights) / 100;
  }
  return nights * range.nightlyRate;
}

export function computePriceQuote(
  ranges: PriceRangeInput[],
  checkIn: string,
  checkOut: string,
  options?: { enforceMinimumStay?: boolean },
): PriceQuoteResult {
  if (!checkIn || !checkOut || checkOut <= checkIn) return { status: "invalid_range" };
  const enforceMinimumStay = options?.enforceMinimumStay ?? true;

  const missingDates: string[] = [];
  type DaySegment = { range: PriceRangeInput; startDate: string; endDate: string; nights: number };
  const daySegments: DaySegment[] = [];
  let current: DaySegment | null = null;

  const end = new Date(`${checkOut}T00:00:00Z`);
  for (let cursor = new Date(`${checkIn}T00:00:00Z`); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const range = ranges.find((item) => item.startDate <= date && item.endDate >= date);
    if (!range) {
      missingDates.push(date);
      continue;
    }
    // Aynı price_ranges satırına (referans eşitliği) ait ardışık günler tek segment'te birleşir -
    // eski "nightlyRate eşitse birleştir" sezgiselinden daha doğru (iki farklı dönem tesadüfen aynı
    // gecelik fiyata sahipse artık yanlışlıkla birleştirilmez, gerçek DB satır sınırı korunur).
    if (current && current.range === range && current.endDate === date) {
      current.nights += 1;
      current.endDate = nextDay(date);
    } else {
      current = { range, startDate: date, endDate: nextDay(date), nights: 1 };
      daySegments.push(current);
    }
  }

  if (missingDates.length > 0) return { status: "gap", missingDates };
  const nights = daySegments.reduce((sum, item) => sum + item.nights, 0);
  if (nights === 0) return { status: "invalid_range" };

  if (enforceMinimumStay) {
    for (const item of daySegments) {
      const minNights = item.range.minimumNights;
      if (typeof minNights === "number" && nights < minNights) {
        return { status: "min_stay", minimumNights: minNights };
      }
    }
  }

  const segments: PriceSegment[] = daySegments.map((item) => ({
    startDate: item.startDate,
    endDate: item.endDate,
    nights: item.nights,
    nightlyRate: item.range.nightlyRate,
    subtotal: segmentSubtotal(item.range, item.nights),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.subtotal, 0);
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

// Bir tam sayı tutarı N eşit parçaya böler - floating point sürüklenmesi YOK: kalan (remainder)
// ilk parçalara +1 birim olarak dağıtılır, böylece dizinin toplamı HER ZAMAN girdiye birebir
// eşittir (parts.reduce(sum) === Math.round(total)). Birim (TL/kuruş) çağıran tarafın sorumluluğu.
function splitEven(total: number, count: number): number[] {
  if (count <= 0) return [];
  const rounded = Math.round(total);
  const base = Math.floor(rounded / count);
  const remainder = rounded - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

// TRY tutarını N eşit taksite böler (bkz. splitEven) - PublicBookingWidget'taki "N × yaklaşık ₺X"
// gösterimi için. Bankanın gerçek taksit tutarı (vade farkı vb.) bundan farklı olabilir - bu
// yalnız bizim tarafımızdan gösterilen "yaklaşık" referans değerdir, ödeme ekranındaki gerçek
// tutarın yerine geçmez.
export function splitEvenInstallments(totalTRY: number, installmentCount: number): number[] {
  return splitEven(totalTRY, installmentCount);
}

// Kuruş (minor unit) tutarını N eşit parçaya böler (bkz. splitEven) - Google VR feed'in günlük
// kırılımı için: her segment'in TAM kuruş toplamını gecelere dağıtır, böylece
// nightlyBreakdown.reduce(sum) HER ZAMAN segment/total ile birebir eşit kalır (bkz. google-vr/feed.ts).
export function splitEvenMinor(totalMinor: number, parts: number): number[] {
  return splitEven(totalMinor, parts);
}
