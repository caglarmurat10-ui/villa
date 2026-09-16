// TEK KAYNAK: bir needs_review OTA bloğunun operatörden GERÇEKTEN aksiyon isteyip istemediği.
//
// Bu sınıflandırma daha önce üç ayrı yerde kopyalanmıştı ve birbirinden sapmıştı:
//   1) status.ts conflictCountFor()      -> hem süre anomalisi hem disposition kontrolü (doğru)
//   2) api/mobile/v1/dashboard/route.ts  -> HİÇBİR kontrol yok, ham needs_review sayımı (yanlış)
//   3) VillaCalendarWorkspace.tsx        -> yalnız disposition, süre anomalisi yok (eksik)
// Sonuç: mobil panelde "N OTA bloğu incelenmeyi bekliyor" uyarısı, karantinaya alınmış uzun
// anomali bloklarını da sayarak yanlış pozitif üretiyordu (2026-09-16 canlı veri: ham 5, gerçek 0).
//
// Saf fonksiyon: D1/network çağrısı yapmaz ve external_blocks.status'ü ASLA değiştirmez -
// yalnız okuma/görüntüleme katmanı için sınıflandırma yapar. Uzun anomali blokları needs_review
// olarak KALIR (karantina koruması bozulmaz), sadece "aksiyon gerekiyor" sayımını şişirmezler.
import { isAnomalousBlockDuration } from "./anomaly";
import { evaluateOtaConflictDisposition, type ReservationRangeLike } from "./conflict-disposition";

export type OtaReviewClassification =
  | "QUARANTINED_ANOMALY" // >120 gün: güvenilmeyen tek blok, karantinada - operatör aksiyonu beklenmez
  | "EXPECTED_RESERVATION_MIRROR" // bilinen rezervasyonun/kapalı sezonun yansıması - bilgi amaçlı
  | "REVIEW_REQUIRED"; // gerçekten açıklanamayan blok - operatör incelemeli

export interface OtaReviewBlockLike {
  status: string;
  startDate: string;
  endDateExclusive: string;
}

export function classifyOtaReviewBlock(
  block: OtaReviewBlockLike,
  reservations: ReservationRangeLike[],
): OtaReviewClassification {
  // Süre anomalisi disposition'dan ÖNCE değerlendirilir: 368 günlük bir blok, açık sezonda
  // kapsanmayan geceler içerse bile bir rezervasyon çakışması değil, import anomalisidir.
  if (isAnomalousBlockDuration(block.startDate, block.endDateExclusive)) {
    return "QUARANTINED_ANOMALY";
  }
  return evaluateOtaConflictDisposition(
    { startDate: block.startDate, endDateExclusive: block.endDateExclusive },
    reservations,
  ) === "REVIEW_REQUIRED"
    ? "REVIEW_REQUIRED"
    : "EXPECTED_RESERVATION_MIRROR";
}

/** Uyarı/rozet sayımlarının tek geçerli ölçütü. */
export function requiresOperatorReview(
  block: OtaReviewBlockLike,
  reservations: ReservationRangeLike[],
): boolean {
  if (block.status !== "needs_review") return false;
  return classifyOtaReviewBlock(block, reservations) === "REVIEW_REQUIRED";
}

/** Villa bazlı rezervasyon aralıklarını sınıflandırıcıya verip aksiyon gerektirenleri sayar. */
export function countBlocksRequiringReview(
  blocks: (OtaReviewBlockLike & { villa: string })[],
  reservationsByVilla: Map<string, ReservationRangeLike[]>,
): number {
  return blocks.filter((block) => requiresOperatorReview(block, reservationsByVilla.get(block.villa) ?? [])).length;
}
