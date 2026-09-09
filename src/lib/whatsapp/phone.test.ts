import { describe, expect, it } from "vitest";
import { isValidWhatsappPhone, normalizeWhatsappPhone } from "./phone";

describe("normalizeWhatsappPhone", () => {
  it("0 ile başlayan 11 haneli yerel numarayı 90 ile başlayan uluslararası forma çevirir", () => {
    expect(normalizeWhatsappPhone("05412424455")).toBe("905412424455");
  });

  it("10 haneli (baştaki 0 olmadan) numarayı 90 önekiyle tamamlar", () => {
    expect(normalizeWhatsappPhone("5412424455")).toBe("905412424455");
  });

  it("00 uluslararası önekini kaldırır", () => {
    expect(normalizeWhatsappPhone("0090 541 242 44 55")).toBe("905412424455");
  });

  it("zaten uluslararası (90...) numarayı olduğu gibi bırakır", () => {
    expect(normalizeWhatsappPhone("+90 541 242 44 55")).toBe("905412424455");
  });

  it("boşluk/tire gibi biçimlendirme karakterlerini temizler", () => {
    expect(normalizeWhatsappPhone("0541-242 44 55")).toBe("905412424455");
  });
});

describe("isValidWhatsappPhone", () => {
  it("geçerli bir Türkiye cep numarasını kabul eder", () => {
    expect(isValidWhatsappPhone("0541 242 44 55")).toBe(true);
  });

  it("çok kısa bir numarayı reddeder", () => {
    expect(isValidWhatsappPhone("12345")).toBe(false);
  });

  it("boş değeri reddeder", () => {
    expect(isValidWhatsappPhone("")).toBe(false);
  });

  it("yalnız harflerden oluşan bir değeri reddeder", () => {
    expect(isValidWhatsappPhone("abc")).toBe(false);
  });
});
