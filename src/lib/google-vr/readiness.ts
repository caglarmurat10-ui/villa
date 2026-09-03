import { listPriceRanges } from "../db";
import { computePriceCoverage, type PriceCoverageReport } from "../price-engine";
import { getAllGbpLocationMappings } from "../gbp/mapping";
import { isClosedSeasonDate } from "../season-policy";
import type { Villa } from "../types";

export type GoogleVrState =
  | "GOOGLE_VR_NOT_CONFIGURED" // hicbir Google VR/Hotel Center partner erisimi yok
  | "GOOGLE_VR_READY_FOR_PARTNER" // kod/veri hazir, yalniz gercek partner erisimi bekleniyor
  | "GOOGLE_VR_WAITING_CONNECTIVITY_ACCESS" // bir connectivity partner tespit edildi ama erisim/sertifikasyon bekleniyor
  | "GOOGLE_VR_FEED_READY" // gercek feed uretimi test edildi (henuz uygulanmadi)
  | "GOOGLE_VR_LIVE"; // gercekten Google'a veri gonderiliyor (henuz uygulanmadi)

const COVERAGE_WINDOW_DAYS = 330; // Google Vacation Rentals'in desteklendigi tipik booking window

export interface GoogleVrVillaReadiness {
  villa: Villa;
  gbpLocationMapped: boolean;
  priceCoverage: PriceCoverageReport;
}

export interface GoogleVrReadiness {
  state: GoogleVrState;
  connectivity: "direct" | "partner_required" | "unknown";
  villas: GoogleVrVillaReadiness[];
  missing: string[];
}

// Gercek Google Vacation Rentals/Hotel Center partner credential'i (ne bir OAuth scope ne bir API
// key) bu kod tabaninda YOK - hicbir zaman WAITING/READY disinda bir state UYDURULMAZ. Mevcut
// Airbnb/Booking baglantilarimiz KENDI ozel iCal senkronumuz (sync.ts) - ticari bir channel
// manager/PMS entegratoru DEGIL, dolayisiyla Google VR connectivity SAGLAMAZ; bagimsiz bir
// connectivity partner (channel manager) gerekecegi read-only olarak boyle cikarilir (tahmin degil,
// mevcut entegrasyonun ne oldugunun dogru okunmasi).
export async function getGoogleVrReadiness(): Promise<GoogleVrReadiness> {
  const villas: Villa[] = ["Safira", "Destan"];
  const todayIso = new Date().toISOString().slice(0, 10);

  const [prices, gbpMappings] = await Promise.all([listPriceRanges(), getAllGbpLocationMappings()]);

  const villaReadiness: GoogleVrVillaReadiness[] = villas.map((villa) => ({
    villa,
    gbpLocationMapped: gbpMappings[villa] !== null,
    priceCoverage: computePriceCoverage(prices.filter((p) => p.villa === villa), todayIso, COVERAGE_WINDOW_DAYS, isClosedSeasonDate),
  }));

  const missing: string[] = [];
  const hasAnyGoogleVrCredential = false; // hicbir zaman env'den tahmin edilmez - bu entegrasyon icin ozel bir secret tanimi yok
  if (!hasAnyGoogleVrCredential) missing.push("Google Vacation Rentals / Hotel Center partner erişimi yok - Google ile doğrudan ortaklık başvurusu veya bir connectivity partner (channel manager) gerekiyor");
  for (const v of villaReadiness) {
    if (!v.gbpLocationMapped) missing.push(`Villa ${v.villa}: GBP location eşlemesi henüz yapılmadı (booking link için ön koşul)`);
    if (v.priceCoverage.gapDays > 0) missing.push(`Villa ${v.villa}: önümüzdeki ${COVERAGE_WINDOW_DAYS} günün ${v.priceCoverage.gapDays} günü PRICE_GAP`);
  }

  const state: GoogleVrState = hasAnyGoogleVrCredential ? "GOOGLE_VR_WAITING_CONNECTIVITY_ACCESS" : "GOOGLE_VR_NOT_CONFIGURED";

  return {
    state,
    connectivity: "partner_required",
    villas: villaReadiness,
    missing,
  };
}
