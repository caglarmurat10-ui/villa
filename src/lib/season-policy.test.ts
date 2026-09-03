import { describe, expect, it } from "vitest";
import {
  ANNUAL_SEASON_POLICY_DEPLOYED_AT,
  CLOSED_SEASON_MESSAGE,
  evaluateOtaBlockAgainstSeason,
  hasClosedSeasonNight,
  isClosedSeasonDate,
  isOpenSeasonDate,
  isPrePolicyConfirmedException,
  SEASON_MINIMUM_NIGHTS,
  SEASON_OPEN_END_MD,
  SEASON_OPEN_START_MD,
} from "./season-policy";

describe("isClosedSeasonDate / isOpenSeasonDate - KESİN YILLIK SEZON KURALI (yıla bağlı değil)", () => {
  it("sabitler kullanıcının kesinleştirdiği tarihlerle birebir eşleşir", () => {
    expect(SEASON_OPEN_START_MD).toBe("06-15");
    expect(SEASON_OPEN_END_MD).toBe("09-15");
    expect(SEASON_MINIMUM_NIGHTS).toBe(4);
  });

  // Section 10 - herhangi bir yılda aynı test matrisi. Üç farklı yıl (2026/2027/2028) ile
  // parametrize edilmiş - hiçbiri özel durum İÇERMEMELİ, üçü de AYNI davranışı üretmeli.
  it.each([2026, 2027, 2028, 2032])("%i - YYYY-06-14 CLOSED, YYYY-06-15 OPEN, YYYY-09-15 OPEN, YYYY-09-16 CLOSED, YYYY-12-31 CLOSED, YYYY-01-01 CLOSED", (year) => {
    expect(isClosedSeasonDate(`${year}-06-14`)).toBe(true);
    expect(isClosedSeasonDate(`${year}-06-15`)).toBe(false);
    expect(isClosedSeasonDate(`${year}-09-15`)).toBe(false);
    expect(isClosedSeasonDate(`${year}-09-16`)).toBe(true);
    expect(isClosedSeasonDate(`${year}-12-31`)).toBe(true);
    expect(isClosedSeasonDate(`${year}-01-01`)).toBe(true);
  });

  it("2026 - artık ÖZEL BİR İSTİSNA YOK: 2026-09-15 OPEN, 2026-09-16 CLOSED (eski 09-30 istisnası kaldırıldı)", () => {
    expect(isClosedSeasonDate("2026-09-15")).toBe(false);
    expect(isClosedSeasonDate("2026-09-16")).toBe(true);
    expect(isClosedSeasonDate("2026-09-30")).toBe(true); // ESKİ kuralda "açık" sayılırdı - artık KAPALI
  });

  it("2027 - 06-15 OPEN, 09-15 OPEN (kullanıcının verdiği örnek)", () => {
    expect(isOpenSeasonDate("2027-06-15")).toBe(true);
    expect(isOpenSeasonDate("2027-09-15")).toBe(true);
  });

  it("2028 - aynı recurring rule, leap year (Şubat 29 gün) dahil doğru çalışır", () => {
    expect(isClosedSeasonDate("2028-02-29")).toBe(true); // artik yil gunu, hala kapali sezon
    expect(isClosedSeasonDate("2028-06-15")).toBe(false);
    expect(isClosedSeasonDate("2028-09-15")).toBe(false);
    expect(isClosedSeasonDate("2028-09-16")).toBe(true);
  });

  it("bölüm 2 örneği - 2028-01-15 CLOSED_SEASON, 2028-07-15 OPEN_SEASON", () => {
    expect(isClosedSeasonDate("2028-01-15")).toBe(true);
    expect(isClosedSeasonDate("2028-07-15")).toBe(false);
  });

  it("CLOSED_SEASON_MESSAGE artik 'her yil 15 Haziran - 15 Eylul' diyor, belirli bir yila (2027) referans vermiyor", () => {
    expect(CLOSED_SEASON_MESSAGE).toContain("her yıl");
    expect(CLOSED_SEASON_MESSAGE).toContain("15 Haziran");
    expect(CLOSED_SEASON_MESSAGE).toContain("15 Eylül");
    expect(CLOSED_SEASON_MESSAGE).not.toContain("2027");
  });
});

describe("hasClosedSeasonNight - kismen bile kapali sezona tasan araliklar (yillik kural)", () => {
  it("tamamen acik sezon icindeki bir aralik icin false doner", () => {
    expect(hasClosedSeasonNight("2028-06-15", "2028-06-22")).toBe(false);
  });
  it("tamamen kapali sezon icindeki bir aralik icin true doner", () => {
    expect(hasClosedSeasonNight("2028-11-01", "2028-11-08")).toBe(true);
  });
  it("yil sinirini asan bir kapali-sezon araligi (ornegin Aralik->Ocak) icin de true doner", () => {
    expect(hasClosedSeasonNight("2027-12-20", "2028-01-05")).toBe(true);
  });
  it("girisi acik, cikisi kapali sezona tasan bir aralik icin true doner (kismi kabul yok)", () => {
    expect(hasClosedSeasonNight("2028-09-12", "2028-09-18")).toBe(true);
  });
});

describe("evaluateOtaBlockAgainstSeason - section 5: uzun bir OTA blogunun acik/kapali sezon segmentlerine ayrilmasi", () => {
  // Kullanicinin verdigi GERCEK production senaryosu: Destan Airbnb blogu baslangic=1 Eylul,
  // bitis=15 Haziran (DTEND, ics-parser.ts'teki gibi HARIC/checkout-tarzi - bu yuzden son GECE
  // aslinda 14 Haziran'dir, tipki external_blocks/reservations semantiginde oldugu gibi).
  it("kullanicinin verdigi gercek senaryo - 1 Eylul -> 15 Haziran (DTEND haric): CONFLICT 1-15 Eylul, EXPECTED CLOSED 16 Eylul -> 14 Haziran", () => {
    const result = evaluateOtaBlockAgainstSeason("2026-09-01", "2027-06-15");
    expect(result.openSegments).toEqual([{ startDate: "2026-09-01", endDate: "2026-09-15" }]);
    expect(result.closedSegments).toEqual([{ startDate: "2026-09-16", endDate: "2027-06-14" }]);
  });

  it("tamamen kapali sezondaki bir aralik icin openSegments bos, tek bir closedSegment doner", () => {
    const result = evaluateOtaBlockAgainstSeason("2026-10-01", "2027-03-01");
    expect(result.openSegments).toEqual([]);
    expect(result.closedSegments).toEqual([{ startDate: "2026-10-01", endDate: "2027-02-28" }]);
  });

  it("tamamen acik sezondaki bir aralik icin closedSegments bos, tek bir openSegment doner", () => {
    const result = evaluateOtaBlockAgainstSeason("2027-07-01", "2027-07-11");
    expect(result.openSegments).toEqual([{ startDate: "2027-07-01", endDate: "2027-07-10" }]);
    expect(result.closedSegments).toEqual([]);
  });

  it("acik sezonun ortasindan baslayip kapali sezona tasan bir aralik icin dogru ikiye ayrilir", () => {
    const result = evaluateOtaBlockAgainstSeason("2027-09-10", "2027-09-26");
    expect(result.openSegments).toEqual([{ startDate: "2027-09-10", endDate: "2027-09-15" }]);
    expect(result.closedSegments).toEqual([{ startDate: "2027-09-16", endDate: "2027-09-25" }]);
  });

  it("iki AYRIK acik-sezon dokunusu (blok iki farkli yilin acik sezonuna da giriyor) yanlislikla TEK segmente birlestirilmez - onceki bug regresyonu", () => {
    // 2026-06-20'den 2027-06-20'ye (haric) kadar: 2026'nin acik sezonunun bir kismi (06-20..09-15),
    // butun kapali sezon, SONRA 2027'nin acik sezonunun bir kismi (06-15..06-19) - IKI AYRI openSegment.
    const result = evaluateOtaBlockAgainstSeason("2026-06-20", "2027-06-20");
    expect(result.openSegments).toHaveLength(2);
    expect(result.openSegments[0]).toEqual({ startDate: "2026-06-20", endDate: "2026-09-15" });
    expect(result.openSegments[1]).toEqual({ startDate: "2027-06-15", endDate: "2027-06-19" });
  });

  it("gecersiz aralik (endDateExclusive <= startDate) icin ikisi de bos dizi doner", () => {
    const result = evaluateOtaBlockAgainstSeason("2027-09-01", "2027-08-01");
    expect(result.openSegments).toEqual([]);
    expect(result.closedSegments).toEqual([]);
  });
});

describe("isPrePolicyConfirmedException - LEGACY CONFIRMED RESERVATION EXCEPTIONS (2026-09-03 karari)", () => {
  it("grandfathered rezervasyon gecerli kalir: kapali sezona tasiyor VE policy deploy'undan ONCE olusturulmus", () => {
    // Gercek production senaryosu (bf26c751-...): Safira 2026-09-22 -> 2026-09-27, created_at
    // 2026-08-25 - yeni 09-15 sinirindan sonrasi, ama deploy'dan ONCE onaylanmis.
    expect(isPrePolicyConfirmedException({ checkIn: "2026-09-22", checkOut: "2026-09-27", createdAt: "2026-08-25T07:15:13.545Z" })).toBe(true);
  });

  it("ayni tarihler ama policy deploy'undan SONRA olusturulmus olsaydi istisna OLMAZDI (yeni rezervasyonlarda istisna yok)", () => {
    expect(isPrePolicyConfirmedException({ checkIn: "2026-09-22", checkOut: "2026-09-27", createdAt: ANNUAL_SEASON_POLICY_DEPLOYED_AT })).toBe(false);
    expect(isPrePolicyConfirmedException({ checkIn: "2026-09-22", checkOut: "2026-09-27", createdAt: "2026-09-10T00:00:00.000Z" })).toBe(false);
  });

  it("acik sezon icindeki bir rezervasyon (kapali gece yok) hicbir zaman istisna SAYILMAZ - kapali sezona tasmiyor zaten", () => {
    expect(isPrePolicyConfirmedException({ checkIn: "2026-07-01", checkOut: "2026-07-08", createdAt: "2026-01-01T00:00:00.000Z" })).toBe(false);
  });
});
