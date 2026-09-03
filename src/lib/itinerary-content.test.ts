import { describe, expect, it } from "vitest";
import { GUIDE_PLACES } from "./region-guide";
import { ITINERARY_DEFINITIONS, itineraryCaption, resolveItineraryPlaces } from "./itinerary-content";

describe("resolveItineraryPlaces - bütün constituent yerler gerçekten GUIDE_PLACES'te var olmalı", () => {
  it("mevcut tüm itinerary tanımları gerçek GUIDE_PLACES id'lerine çözümlenir (uydurma id yok)", () => {
    for (const definition of ITINERARY_DEFINITIONS) {
      const places = resolveItineraryPlaces(definition);
      expect(places).not.toBeNull();
      expect(places).toHaveLength(definition.placeIds.length);
    }
  });

  it("eksik/yanlış yazılmış bir place id için null döner - o tanım hiç üretilmez", () => {
    const fakeDefinition = { id: "test", title: "Test", frame: "Test", placeIds: ["patara-antik-kenti", "bu-yer-yok"] };
    expect(resolveItineraryPlaces(fakeDefinition)).toBeNull();
  });

  it("her tanımdaki her place id GUIDE_PLACES'te GERÇEKTEN mevcut (id yazım hatası regresyonu)", () => {
    const realIds = new Set(GUIDE_PLACES.map((p) => p.id));
    for (const definition of ITINERARY_DEFINITIONS) {
      for (const placeId of definition.placeIds) {
        expect(realIds.has(placeId)).toBe(true);
      }
    }
  });
});

describe("itineraryCaption - hiçbir değişken bilgi (saat/ücret/mesafe/hava) içermez", () => {
  const VARIABLE_INFO_PATTERNS = [
    /\d+[.,]?\d*\s?(tl|₺|try)\b/i,
    /ücretsiz|giriş ücreti|tur fiyat/i,
    /\b\d{1,2}[:.]\d{2}\b/,
    /açılış saat|kapanış saat|çalışma saat/i,
    /hava durumu|\d+\s?derece/i,
    /\d+\s?(dakika|saat)\s?(sürer|uzaklık|mesafe|yol)/i,
  ];

  it("hiçbir itinerary caption'ı değişken-bilgi desenleriyle eşleşmez - AUTO_SAFE sınıflandırmasını kırmaz", () => {
    for (const definition of ITINERARY_DEFINITIONS) {
      const places = resolveItineraryPlaces(definition)!;
      const { caption, hook } = itineraryCaption(definition, places, "Safira");
      for (const pattern of VARIABLE_INFO_PATTERNS) {
        expect(caption).not.toMatch(pattern);
        expect(hook).not.toMatch(pattern);
      }
    }
  });

  it("caption yalnız o rotanın gerçek constituent yer adlarını ve açıklamalarını içerir", () => {
    const definition = ITINERARY_DEFINITIONS.find((d) => d.id === "patara-1-gun")!;
    const places = resolveItineraryPlaces(definition)!;
    const { caption } = itineraryCaption(definition, places, "Safira");
    for (const place of places) {
      expect(caption).toContain(place.name);
      expect(caption).toContain(place.description);
    }
  });

  it("Safira ve Destan icin ayri, villa adi dogru gecen caption'lar uretir", () => {
    const definition = ITINERARY_DEFINITIONS[0];
    const places = resolveItineraryPlaces(definition)!;
    const safira = itineraryCaption(definition, places, "Safira");
    const destan = itineraryCaption(definition, places, "Destan");
    expect(safira.caption).toContain("Villa Safira");
    expect(destan.caption).toContain("Villa Destan");
    expect(safira.caption).not.toBe(destan.caption);
  });
});
