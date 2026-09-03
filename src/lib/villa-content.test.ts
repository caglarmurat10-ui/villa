import { describe, expect, it } from "vitest";
import { getFaqItems } from "./villa-content";

function paymentAnswer(status: Parameters<typeof getFaqItems>[0]): string {
  const item = getFaqItems(status).find((f) => f.question === "Sitede online ödeme alınıyor mu?");
  if (!item) throw new Error("payment FAQ item not found");
  return item.answer;
}

describe("getFaqItems - ödeme sorusu readiness'e göre dinamik", () => {
  it("PAYTR_TEST_MODE (paytrReady=false) durumunda 'aktif'/'Evet' iddiası ETMEZ, hazırlık metnini gösterir", () => {
    const answer = paymentAnswer({ paytrReady: false, installmentVerified: false });
    expect(answer).toContain("Online ödeme altyapımız hazırdır");
    expect(answer).not.toContain("Evet");
    expect(answer).not.toMatch(/3 veya 6 taksit/);
  });

  it("paytrReady=true ama installmentVerified=false iken YİNE taksit/aktif iddiası ETMEZ (taksit ayrı doğrulama gerektirir)", () => {
    const answer = paymentAnswer({ paytrReady: true, installmentVerified: false });
    expect(answer).not.toContain("Evet");
    expect(answer).not.toMatch(/3 veya 6 taksit/);
  });

  it("installmentVerified=true ama paytrReady=false iken YİNE 'aktif' iddiası ETMEZ (test modundayken gerçek tahsilat yok)", () => {
    const answer = paymentAnswer({ paytrReady: false, installmentVerified: true });
    expect(answer).not.toContain("Evet");
    expect(answer).not.toMatch(/3 veya 6 taksit/);
  });

  it("her iki koşul de doğrulanmışsa 'Evet' + peşin/3/6 taksit metnini gösterir, komisyon eklenmediğini belirtir", () => {
    const answer = paymentAnswer({ paytrReady: true, installmentVerified: true });
    expect(answer).toMatch(/^Evet\./);
    expect(answer).toContain("3 veya 6 taksit");
    expect(answer).toContain("komisyonu eklenmez");
  });

  it("soru sırası ve diğer 4 soru sabit kalır, yalnız ödeme cevabı değişir", () => {
    const notReady = getFaqItems({ paytrReady: false, installmentVerified: false });
    const ready = getFaqItems({ paytrReady: true, installmentVerified: true });
    expect(notReady.map((f) => f.question)).toEqual(ready.map((f) => f.question));
    expect(notReady[2].question).toBe("Sitede online ödeme alınıyor mu?");
    for (let i = 0; i < notReady.length; i++) {
      if (i === 2) continue;
      expect(notReady[i].answer).toBe(ready[i].answer);
    }
  });
});
