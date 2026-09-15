import { describe, expect, it } from "vitest";
import { approvedVirtualTemplateMedia, buildVirtualTemplates } from "./social-content-virtual-templates";

describe("buildVirtualTemplates organic growth variety", () => {
  const templates = buildVirtualTemplates();
  const carousels = templates.filter((template) => template.format === "Carousel");

  it("tum sanal sablon id'leri benzersizdir", () => {
    expect(new Set(templates.map((template) => template.id)).size).toBe(templates.length);
  });

  it("her villa icin dort gercek-fotografli carousel uretir", () => {
    expect(carousels).toHaveLength(8);
    expect(carousels.filter((template) => template.villa === "Safira")).toHaveLength(4);
    expect(carousels.filter((template) => template.villa === "Destan")).toHaveLength(4);
  });

  it("carousel'ler en az iki benzersiz, yonetilen Drive gorseli kullanir", () => {
    for (const template of carousels) {
      expect(template.contentType).toBe("Gönderi");
      expect(template.theme).toBe("Villa");
      expect(template.mediaKind).toBe("image");
      expect(template.mediaResolved).toBe(true);
      expect(template.mediaUrls.length).toBeGreaterThanOrEqual(2);
      expect(new Set(template.mediaUrls).size).toBe(template.mediaUrls.length);
      expect(template.mediaUrls.every((url) => /^\/api\/media\/drive\/[A-Za-z0-9_-]+$/.test(url))).toBe(true);
    }
  });

  it("carousel kompozisyon kimlikleri birbirini tekrar etmez", () => {
    expect(new Set(carousels.map((template) => template.mediaFile)).size).toBe(carousels.length);
  });

  it("organik carousel caption'larinda musaitlik veya WhatsApp satis baskisi yoktur", () => {
    for (const template of carousels) {
      expect(template.caption.toLocaleLowerCase("tr-TR")).not.toMatch(/müsait|whatsapp|\bdm\b/);
    }
  });

  it("discovery sanal sablonlari organik CTA alir fakat DM baskisi almaz", () => {
    const discovery = templates.filter((template) => ["Bölge", "Gezi", "Tarih-Doğa", "Yerel İpucu", "Rota"].includes(template.theme));
    expect(discovery.length).toBeGreaterThan(0);
    for (const template of discovery) {
      expect(template.caption.toLocaleLowerCase("tr-TR")).not.toMatch(/whatsapp|\bdm\b/);
    }
  });
  it("organic discovery posts use real region photos, never generated text-card media", () => {
    const discovery = templates.filter((template) => ["B\u00f6lge", "Gezi", "Tarih-Do\u011fa", "Yerel \u0130pucu", "Rota"].includes(template.theme));
    expect(discovery.length).toBeGreaterThan(0);
    expect(discovery.every((template) => template.mediaUrl.startsWith("/social/region/feed/"))).toBe(true);
    expect(discovery.some((template) => template.mediaUrl.includes("/api/public/social-assets/"))).toBe(false);
  });

  it("places without a verified real photo are not auto-template candidates", () => {
    expect(templates.some((template) => template.id.includes("patara-kum-tepeleri"))).toBe(false);
    expect(templates.some((template) => template.id.includes("kas-cuma-pazari"))).toBe(false);
  });

  it("virtual media allowlist accepts only curated first-party region photos", () => {
    expect(approvedVirtualTemplateMedia("Destan", "https://admin.safiradestan.com/social/region/feed/letoon-antik-kenti.jpg", ["https://admin.safiradestan.com"])).toEqual({ mediaKind: "image" });
    expect(approvedVirtualTemplateMedia("Destan", "https://admin.safiradestan.com/api/public/social-assets/destan_destination_letoon-antik-kenti/feed", ["https://admin.safiradestan.com"])).toBeNull();
    expect(approvedVirtualTemplateMedia("Destan", "https://evil.example/letoon.jpg", ["https://admin.safiradestan.com"])).toBeNull();
  });

});
