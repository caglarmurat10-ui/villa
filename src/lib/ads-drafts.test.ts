import { describe, expect, it } from "vitest";
import { GOOGLE_ADS_CAMPAIGN_DRAFTS } from "./google-ads-campaign-drafts";
import { META_ADS_CAMPAIGN_DRAFTS } from "./meta-ads-campaign-drafts";

// HARD GUARD regresyon testi: hicbir taslak kampanya asla "ACTIVE" olamaz - tip sistemi zaten
// yalniz "DRAFT" literal'ini kabul ediyor (status: "DRAFT" olarak daraltilmis), bu test ek bir
// calisma-zamani guvencesi: birisi ileride status alanini genisletip yanlislikla "ACTIVE" bir
// satir eklerse burada kirilir.
describe("Google Ads taslak kampanyalari", () => {
  it("hicbir kampanya ACTIVE degil - hepsi DRAFT", () => {
    expect(GOOGLE_ADS_CAMPAIGN_DRAFTS.length).toBeGreaterThan(0);
    for (const campaign of GOOGLE_ADS_CAMPAIGN_DRAFTS) {
      expect(campaign.status).toBe("DRAFT");
    }
  });

  it("hicbir kampanyada gercek bir butce tutari (sayi) yok - yalniz kullanici notu", () => {
    for (const campaign of GOOGLE_ADS_CAMPAIGN_DRAFTS) {
      expect(typeof campaign.dailyBudgetNote).toBe("string");
      expect(campaign.dailyBudgetNote.length).toBeGreaterThan(0);
    }
  });
});

describe("Meta Ads taslak kampanyalari", () => {
  it("hicbir kampanya ACTIVE degil - hepsi DRAFT", () => {
    expect(META_ADS_CAMPAIGN_DRAFTS.length).toBeGreaterThan(0);
    for (const campaign of META_ADS_CAMPAIGN_DRAFTS) {
      expect(campaign.status).toBe("DRAFT");
    }
  });
});
