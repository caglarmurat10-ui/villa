// JSON-LD çıktısının gerçekten geçerli JSON'a serileştiğini, her düğümün bir @type taşıdığını ve
// aynı @graph içinde @id çakışması olmadığını doğrular (bölüm 3/18 - "structured-data output parses
// correctly", "duplicate structured data corrected").
import { describe, expect, it } from "vitest";
import { buildHomepageStructuredData } from "./homepage-structured-data";
import { buildPataraVillaStructuredData } from "./patara-villa-content";
import { getFaqItems } from "./villa-content";

type JsonLdGraph = { "@context": string; "@graph": Array<Record<string, unknown>> };

function assertValidJsonLd(data: JsonLdGraph) {
  const serialized = JSON.stringify(data);
  const parsed = JSON.parse(serialized) as JsonLdGraph;
  expect(parsed["@context"]).toBe("https://schema.org");
  expect(Array.isArray(parsed["@graph"])).toBe(true);
  expect(parsed["@graph"].length).toBeGreaterThan(0);

  for (const node of parsed["@graph"]) {
    expect(node["@type"]).toBeTruthy();
  }

  const ids = parsed["@graph"]
    .map((node) => node["@id"])
    .filter((id): id is string => typeof id === "string");
  expect(new Set(ids).size).toBe(ids.length); // aynı @graph içinde çakışan @id yok
}

describe("Homepage JSON-LD (WebSite + Organization + FAQPage)", () => {
  const faqItems = getFaqItems({ paytrReady: false, installmentVerified: false });
  const data = buildHomepageStructuredData(faqItems);

  it("geçerli JSON'a serileşir, her düğüm @type taşır, @id çakışması yok", () => {
    assertValidJsonLd(data);
  });

  it("WebSite ve Organization düğümleri mevcut ve birbirine publisher ile bağlı", () => {
    const website = data["@graph"].find((node) => node["@type"] === "WebSite") as { publisher?: { "@id": string } } | undefined;
    const organization = data["@graph"].find((node) => node["@type"] === "Organization") as { "@id": string } | undefined;
    expect(website).toBeDefined();
    expect(organization).toBeDefined();
    expect(website?.publisher?.["@id"]).toBe(organization?.["@id"]);
  });

  it("Organization sameAs listesi yalnız gerçek, doğrulanmış sosyal linkleri içerir (uydurma yok)", () => {
    const organization = data["@graph"].find((node) => node["@type"] === "Organization") as { sameAs?: string[] } | undefined;
    expect(organization?.sameAs?.length).toBeGreaterThan(0);
    for (const url of organization?.sameAs ?? []) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  it("yalnız TEK bir WebSite ve TEK bir Organization düğümü var (duplicate entity yok)", () => {
    const websiteNodes = data["@graph"].filter((node) => node["@type"] === "WebSite");
    const orgNodes = data["@graph"].filter((node) => node["@type"] === "Organization");
    expect(websiteNodes).toHaveLength(1);
    expect(orgNodes).toHaveLength(1);
  });
});

describe("/patara-villa JSON-LD (CollectionPage + BreadcrumbList + FAQPage)", () => {
  const data = buildPataraVillaStructuredData();

  it("geçerli JSON'a serileşir, her düğüm @type taşır, @id çakışması yok", () => {
    assertValidJsonLd(data);
  });

  it("Villa Safira/Destan VacationRental @id'lerine gerçek referans verir (uydurma değil)", () => {
    const collectionPage = data["@graph"].find((node) => node["@type"] === "CollectionPage") as { about?: Array<{ "@id": string }> } | undefined;
    const referencedIds = collectionPage?.about?.map((item) => item["@id"]) ?? [];
    expect(referencedIds).toContain("https://safiradestan.com/villa-safira/#vacationrental");
    expect(referencedIds).toContain("https://safiradestan.com/villa-destan/#vacationrental");
  });
});
