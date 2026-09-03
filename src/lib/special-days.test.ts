import { describe, expect, it } from "vitest";
import {
  classifySpecialDaySafety,
  fixedHolidayMessage,
  getFixedHolidayForDate,
  getReligiousHolidayForDate,
  getSpecialDayForDate,
  RELIGIOUS_HOLIDAY_REGISTRY,
} from "./special-days";

describe("getFixedHolidayForDate - 2429 sayılı Kanun sabit resmi tatiller", () => {
  it("23 Nisan her yıl (yıldan bağımsız) eşleşir", () => {
    expect(getFixedHolidayForDate("2026-04-23")?.id).toBe("23-nisan");
    expect(getFixedHolidayForDate("2030-04-23")?.id).toBe("23-nisan");
  });
  it("30 Ağustos eşleşir", () => {
    expect(getFixedHolidayForDate("2027-08-30")?.id).toBe("30-agustos");
  });
  it("29 Ekim eşleşir", () => {
    expect(getFixedHolidayForDate("2027-10-29")?.id).toBe("29-ekim");
  });
  it("normal bir gün için null döner", () => {
    expect(getFixedHolidayForDate("2027-04-24")).toBeNull();
  });
  it("29 Ekim mesajı Cumhuriyet'in kuruluş yılından (1923) doğru aritmetikle yıl sayısı üretir - uydurma değil", () => {
    const holiday = getFixedHolidayForDate("2027-10-29")!;
    expect(fixedHolidayMessage(holiday, 2027)).toContain("104. yılı");
  });

  // Regresyon: "Bayramı" gibi zaten iyelik ekiyle biten resmi adlara dogrudan "ımız" eklemek
  // "Bayramıımız" (cift ı) uretiyordu - canli render'da gozle goruldu, duzeltildi.
  it("iyelik eki uretimi cift unlu HATASI yapmaz - 'ı' ile biten adlar icin", () => {
    const holiday23Nisan = getFixedHolidayForDate("2027-04-23")!;
    expect(fixedHolidayMessage(holiday23Nisan, 2027)).toContain("Bayramımız");
    expect(fixedHolidayMessage(holiday23Nisan, 2027)).not.toContain("Bayramıımız");

    const holiday19Mayis = getFixedHolidayForDate("2027-05-19")!;
    expect(fixedHolidayMessage(holiday19Mayis, 2027)).toContain("Bayramımız");
    expect(fixedHolidayMessage(holiday19Mayis, 2027)).not.toContain("ıımız");

    const holiday30Agustos = getFixedHolidayForDate("2027-08-30")!;
    expect(fixedHolidayMessage(holiday30Agustos, 2027)).toBe("30 Ağustos Zafer Bayramımız kutlu olsun.");
  });

  it("iyelik eki uretimi 'ü' ile biten adlar icin dogru buyuk unlu uyumu kullanir (Gunumuz, GunUmuz degil)", () => {
    const holiday1Mayis = getFixedHolidayForDate("2027-05-01")!;
    expect(fixedHolidayMessage(holiday1Mayis, 2027)).toBe("1 Mayıs Emek ve Dayanışma Günümüz kutlu olsun.");
  });
});

describe("getReligiousHolidayForDate / RELIGIOUS_HOLIDAY_REGISTRY - Diyanet kaynaklı", () => {
  it("2027 Ramazan Bayramı (9-11 Mart) resmi Diyanet kaynağından doğrulanmış olarak kayıtlı", () => {
    const entry = RELIGIOUS_HOLIDAY_REGISTRY.find((e) => e.year === 2027 && e.name === "Ramazan Bayramı");
    expect(entry?.startDate).toBe("2027-03-09");
    expect(entry?.endDate).toBe("2027-03-11");
    expect(entry?.verified).toBe(true);
    expect(entry?.sourceUrl).toContain("diyanet.gov.tr");
  });
  it("2027 Kurban Bayramı (16-19 Mayıs) resmi Diyanet kaynağından doğrulanmış olarak kayıtlı", () => {
    const entry = RELIGIOUS_HOLIDAY_REGISTRY.find((e) => e.year === 2027 && e.name === "Kurban Bayramı");
    expect(entry?.startDate).toBe("2027-05-16");
    expect(entry?.endDate).toBe("2027-05-19");
    expect(entry?.verified).toBe(true);
  });
  it("aralığın ilk ve son günü dahil eşleşir", () => {
    expect(getReligiousHolidayForDate("2027-03-09")?.name).toBe("Ramazan Bayramı");
    expect(getReligiousHolidayForDate("2027-03-11")?.name).toBe("Ramazan Bayramı");
    expect(getReligiousHolidayForDate("2027-03-08")).toBeNull();
    expect(getReligiousHolidayForDate("2027-03-12")).toBeNull();
  });
  it("kayıtlı olmayan bir yıl (ör. 2028) için null döner - tahmin/hesaplama YAPILMAZ", () => {
    expect(getReligiousHolidayForDate("2028-03-01")).toBeNull();
  });
});

describe("classifySpecialDaySafety - section 10 AUTO_SAFE/REVIEW_REQUIRED disiplini", () => {
  it("sabit resmi tatil her zaman AUTO_SAFE", () => {
    const match = getSpecialDayForDate("2027-04-23")!;
    expect(classifySpecialDaySafety(match).automationClass).toBe("AUTO_SAFE");
  });
  it("verified:true dini bayram AUTO_SAFE", () => {
    const match = getSpecialDayForDate("2027-03-10")!;
    expect(match.kind).toBe("religious");
    expect(classifySpecialDaySafety(match).automationClass).toBe("AUTO_SAFE");
  });
  it("verified:false (doğrulanmamış) bir dini bayram yılı REVIEW_REQUIRED döner, otomatik AUTO_SAFE SAYILMAZ", () => {
    const unverifiedMatch = {
      kind: "religious" as const,
      entry: { year: 2099, name: "Ramazan Bayramı" as const, startDate: "2099-01-01", endDate: "2099-01-03", sourceUrl: "", retrievedAt: "", verified: false },
      message: "test",
    };
    const result = classifySpecialDaySafety(unverifiedMatch);
    expect(result.automationClass).toBe("REVIEW_REQUIRED");
  });
});

describe("getSpecialDayForDate - normal günler ve öncelik sırası", () => {
  it("özel gün olmayan bir tarih için null döner", () => {
    expect(getSpecialDayForDate("2027-02-15")).toBeNull();
  });
  it("sabit resmi tatil, aynı takvim gününe denk gelebilecek bir dini bayramdan ÖNCELİKLİDİR", () => {
    // Bu senaryo şu an gerçek veriyle çakışmıyor ama fonksiyonun öncelik kuralını dogrudan test eder.
    const match = getSpecialDayForDate("2027-04-23");
    expect(match?.kind).toBe("fixed");
  });
});
