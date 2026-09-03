// Meta Ads (Marketing API) icin ad_account erişimi + ads_management izni gerekir - hicbiri bu kod
// tabaninda yok ve UYDURULMAZ (bkz. integration-center.ts: metaAdsState = WAITING_USER_ACTION).
// Bu dosya, gbpContentLibrary/google-ads-campaign-drafts.ts ile ayni desende, yalnizca statik bir
// REFERANS taslak kutuphanesi - hicbir kampanya API'ye gonderilmez, hepsi PAUSED/DRAFT.

export type MetaAdsCampaignDraft = {
  id: string;
  villa: "Safira" | "Destan" | "Ortak";
  objective: "Traffic" | "Leads" | "Reach";
  name: string;
  status: "DRAFT";
  audienceNote: string;
  creativeConcept: string;
};

export const META_ADS_CAMPAIGN_DRAFTS: MetaAdsCampaignDraft[] = [
  {
    id: "safira-traffic",
    villa: "Safira",
    objective: "Traffic",
    name: "Villa Safira — Site Trafiği",
    status: "DRAFT",
    audienceNote: "İlgi alanı: lüks tatil, villa kiralama, Türkiye Ege/Akdeniz kıyısı; 25-55 yaş",
    creativeConcept: "Mevcut onaylı Instagram/Facebook görselleri (social_media_library'den, aynı AUTO_SAFE onay akışı) — havuz + deniz manzarası öne çıkar",
  },
  {
    id: "destan-traffic",
    villa: "Destan",
    objective: "Traffic",
    name: "Villa Destan — Site Trafiği",
    status: "DRAFT",
    audienceNote: "İlgi alanı: lüks tatil, villa kiralama, Türkiye Ege/Akdeniz kıyısı; 25-55 yaş",
    creativeConcept: "Mevcut onaylı Instagram/Facebook görselleri, bahçe + özel alan öne çıkar",
  },
  {
    id: "leads-both",
    villa: "Ortak",
    objective: "Leads",
    name: "Rezervasyon Talebi — Lead Gen",
    status: "DRAFT",
    audienceNote: "Site ziyaretçisi remarketing (yalnız consent verdiyse) + benzer kitle (lookalike, gerçek ad_account bağlanınca oluşturulabilir)",
    creativeConcept: "generate_lead event'iyle eşleşen doğrudan rezervasyon-formu CTA'sı",
  },
  {
    id: "reach-brand",
    villa: "Ortak",
    objective: "Reach",
    name: "Marka Bilinirliği — Patara/Kaş/Kalkan",
    status: "DRAFT",
    audienceNote: "Coğrafi: Türkiye + seçili AB ülkeleri, tatil planlayan kullanıcılar",
    creativeConcept: "Bölge rehberi içeriğiyle (Patara/Kaş/Kalkan) eşleşen, satış odaklı olmayan farkındalık reklamı",
  },
];

// AUTO_SAFE organik içerik motorunun kullandığı aynı guest-safety/PII kurallari burada da geçerli:
// fiyat/müsaitlik/yorum uydurulmaz, gerçek onaylı görseller kullanılır.
export const META_ADS_READINESS_NOTES = [
  "Gerekli: Business Manager erişimi + ad_account ID + ads_management izni (kullanıcıdan)",
  "Conversion mapping: GTM-KFZ62MJG üzerinden Meta Pixel/CAPI ile generate_lead/check_availability eşleşmesi ayrıca kurulmalı",
  "Creative: yalnız mevcut AUTO_SAFE onaylı medya kütüphanesinden (fiyat/müsaitlik/yorum metne eklenmez)",
  "Bütçe belirlenmeden hiçbir kampanya ACTIVE yapılmayacak",
];
