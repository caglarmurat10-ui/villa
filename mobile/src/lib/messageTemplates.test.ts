import { describe, expect, it } from "vitest";
import { whatsappTemplateFor } from "./messageTemplates";

describe("whatsappTemplateFor(location)", () => {
  it("Villa Safira için doğru giriş saati aralığını içerir", () => {
    const text = whatsappTemplateFor("location", { villa: "Safira" });
    expect(text).toContain("Giriş saatimiz 16.00 ile 21.00 arasındadır.");
    expect(text).not.toContain("Giriş saatimiz 16.00’dır.");
  });

  it("Villa Destan için doğru giriş saati aralığını içerir", () => {
    const text = whatsappTemplateFor("location", { villa: "Destan" });
    expect(text).toContain("Giriş saatimiz 16.00 ile 21.00 arasındadır.");
  });

  it("konum linkini ve 15 dakika önce haber verme cümlesini korur", () => {
    const text = whatsappTemplateFor("location", { villa: "Safira" });
    expect(text).toContain("https://maps.app.goo.gl/fKBpCQhn5Qneuo5H6");
    expect(text).toContain("konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz.");
  });
});

describe("whatsappTemplateFor(checkout)", () => {
  it("çıkış mesajı değişmeden kalır", () => {
    const text = whatsappTemplateFor("checkout", { villa: "Safira" });
    expect(text).toContain("Çıkış saatimiz 10.00’dır.");
  });
});
