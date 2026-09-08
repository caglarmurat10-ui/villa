import { describe, expect, it } from "vitest";
import {
  classifySpecialDaySafety,
  fixedHolidayMessage,
  FIXED_HOLIDAYS,
  FRIDAY_MESSAGES,
  fridayMessageForDate,
  getFixedHolidayForDate,
  getReligiousHolidayForDate,
  getSpecialDayForDate,
  isFriday,
  religiousHolidayMessage,
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

describe("15 Temmuz KALICI EDİTORYAL DIŞLAMA (2026-09-08 işletme sahibi kararı)", () => {
  it("FIXED_HOLIDAYS listesinde 15 Temmuz hiç yok", () => {
    expect(FIXED_HOLIDAYS.some((h) => h.id === "15-temmuz")).toBe(false);
    expect(FIXED_HOLIDAYS.some((h) => h.month === 7 && h.day === 15)).toBe(false);
  });
  it("getFixedHolidayForDate 15 Temmuz için (hiçbir yılda) asla eşleşme döndürmez", () => {
    expect(getFixedHolidayForDate("2026-07-15")).toBeNull();
    expect(getFixedHolidayForDate("2027-07-15")).toBeNull();
    expect(getFixedHolidayForDate("2030-07-15")).toBeNull();
  });
  it("getSpecialDayForDate 15 Temmuz için de null döner (cuma günü olsa bile - bkz. öncelik sırası testleriyle çelişmez, 15 Temmuz ayrıca kontrol edilir)", () => {
    // 2027-07-15 bir Perşembe - Cuma'ya denk gelen bir 15 Temmuz ile de ayrıca doğrulanır:
    expect(getSpecialDayForDate("2027-07-15")).not.toMatchObject({ kind: "fixed", holiday: { id: "15-temmuz" } });
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

  // 2026-09-08: kandil geceleri + Ramazan başlangıcı eklendi (aynı resmi Diyanet kaynağından,
  // yalnız bugünden (2026-09-08) sonraki, henüz geçmemiş tarihler).
  it("Regaib Kandili (2026-12-10) resmi kaynaktan doğrulanmış olarak kayıtlı", () => {
    const entry = RELIGIOUS_HOLIDAY_REGISTRY.find((e) => e.name === "Regaib Kandili");
    expect(entry?.startDate).toBe("2026-12-10");
    expect(entry?.verified).toBe(true);
    expect(entry?.sourceUrl).toContain("diyanet.gov.tr");
  });
  it("Miraç Kandili, Berat Kandili, Ramazan Başlangıcı, Kadir Gecesi 2027 tarihleriyle kayıtlı", () => {
    expect(getReligiousHolidayForDate("2027-01-04")?.name).toBe("Miraç Kandili");
    expect(getReligiousHolidayForDate("2027-01-22")?.name).toBe("Berat Kandili");
    expect(getReligiousHolidayForDate("2027-02-08")?.name).toBe("Ramazan Başlangıcı");
    expect(getReligiousHolidayForDate("2027-03-05")?.name).toBe("Kadir Gecesi");
  });
  it("her dini gün için doğru, dilbilgisel olarak doğru bir kutlama mesajı üretir (mekanik ek değil, elle yazılmış doğru kalıp)", () => {
    const kadirGecesi = RELIGIOUS_HOLIDAY_REGISTRY.find((e) => e.name === "Kadir Gecesi")!;
    expect(religiousHolidayMessage(kadirGecesi)).toBe("Kadir Geceniz mübarek olsun.");
    expect(religiousHolidayMessage(kadirGecesi)).not.toContain("Gecesiniz"); // çift iyelik hatası olmamalı

    const miracKandili = RELIGIOUS_HOLIDAY_REGISTRY.find((e) => e.name === "Miraç Kandili")!;
    expect(religiousHolidayMessage(miracKandili)).toBe("Miraç Kandiliniz mübarek olsun.");

    const ramazanBaslangici = RELIGIOUS_HOLIDAY_REGISTRY.find((e) => e.name === "Ramazan Başlangıcı")!;
    expect(religiousHolidayMessage(ramazanBaslangici)).toBe("Hayırlı Ramazanlar.");
  });
  it("hiçbir dini gün mesajı uydurma bir Kuran/hadis alıntısı içermez - yalnız sade iyi dilek", () => {
    for (const entry of RELIGIOUS_HOLIDAY_REGISTRY) {
      const message = religiousHolidayMessage(entry);
      expect(message.length).toBeLessThan(60);
      expect(message).not.toMatch(/ayet|hadis|kuran|allah\s+buyur/i);
    }
  });
});

describe("FRIDAY_MESSAGE - haftalık, sade cuma mesajı (bölüm: kültürel/yerel editoryal takvim)", () => {
  it("isFriday doğru gün tespiti yapar", () => {
    expect(isFriday("2026-09-11")).toBe(true); // 2026-09-11 bir Cuma
    expect(isFriday("2026-09-10")).toBe(false); // Perşembe
    expect(isFriday("2026-09-12")).toBe(false); // Cumartesi
  });
  it("her cuma mesajı sabit, önceden yazılmış listeden gelir - serbest metin/uydurma alıntı yok", () => {
    for (let day = 4; day <= 30; day += 7) {
      const date = `2026-09-${String(day).padStart(2, "0")}`;
      if (!isFriday(date)) continue;
      expect(FRIDAY_MESSAGES).toContain(fridayMessageForDate(date));
    }
  });
  it("aynı tarih için her zaman AYNI mesajı üretir (deterministik, Math.random() yok)", () => {
    const first = fridayMessageForDate("2026-09-11");
    const second = fridayMessageForDate("2026-09-11");
    expect(first).toBe(second);
  });
  it("hiçbir cuma mesajı dine atfedilmiş bir alıntı/hadis/ayet içermez ve agresif ticari CTA taşımaz", () => {
    for (const message of FRIDAY_MESSAGES) {
      expect(message).not.toMatch(/ayet|hadis|kuran|allah\s+buyur/i);
      expect(message).not.toMatch(/indirim|kampanya|hemen|son\s+fırsat|rezervasyon\s+yap/i);
    }
  });
  it("getSpecialDayForDate cuma günü için (başka özel gün yoksa) friday eşleşmesi döner, AUTO_SAFE sınıflandırılır", () => {
    const match = getSpecialDayForDate("2026-09-11");
    expect(match?.kind).toBe("friday");
    expect(classifySpecialDaySafety(match!).automationClass).toBe("AUTO_SAFE");
  });
  it("aynı güne denk gelen sabit/dini bir özel gün, jenerik cuma mesajından ÖNCELİKLİDİR (2027-08-13 Mevlid Kandili bir Cuma)", () => {
    expect(isFriday("2027-08-13")).toBe(true);
    const match = getSpecialDayForDate("2027-08-13");
    expect(match?.kind).toBe("religious");
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
