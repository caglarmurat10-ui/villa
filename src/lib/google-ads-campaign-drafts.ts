// Google Ads API kullanmak icin OAuth + developer token + customer ID gerekir - hicbiri bu kod
// tabaninda yok ve UYDURULMAZ (bkz. integration-center.ts: googleAdsState = WAITING_USER_ACTION).
// Bu dosya yalnizca statik bir REFERANS/TASLAK kutuphanesi - gbpContentLibrary (google-business-
// content.ts) ile ayni desen. Hicbir kampanya API'ye gonderilmez, hicbiri ACTIVE degil; hepsi
// gercek hesap/butce/onay geldiginde admin'in elle Google Ads'e girecegi PAUSED taslaklardir.

export type GoogleAdsCampaignDraft = {
  id: string;
  villa: "Safira" | "Destan" | "Ortak";
  campaignType: "Brand Search" | "Generic Search" | "Remarketing";
  name: string;
  status: "DRAFT";
  keywords: string[];
  dailyBudgetNote: string; // gercek bir tutar degil - kullanicinin belirlemesi gereken bos alan
};

export const GOOGLE_ADS_CAMPAIGN_DRAFTS: GoogleAdsCampaignDraft[] = [
  {
    id: "brand-safira",
    villa: "Safira",
    campaignType: "Brand Search",
    name: "Brand — Villa Safira",
    status: "DRAFT",
    keywords: ["villa safira", "safira villa patara", "villa safira kaş", "safira villa kiralama"],
    dailyBudgetNote: "Kullanıcı belirleyecek",
  },
  {
    id: "brand-destan",
    villa: "Destan",
    campaignType: "Brand Search",
    name: "Brand — Villa Destan",
    status: "DRAFT",
    keywords: ["villa destan", "destan villa patara", "villa destan kaş", "destan villa kiralama"],
    dailyBudgetNote: "Kullanıcı belirleyecek",
  },
  {
    id: "generic-patara",
    villa: "Ortak",
    campaignType: "Generic Search",
    name: "Patara Villa Kiralama",
    status: "DRAFT",
    keywords: ["patara villa", "patara özel havuzlu villa", "patara kiralık villa", "patara villa tatili"],
    dailyBudgetNote: "Kullanıcı belirleyecek",
  },
  {
    id: "generic-kalkan",
    villa: "Ortak",
    campaignType: "Generic Search",
    name: "Kalkan Villa Kiralama",
    status: "DRAFT",
    keywords: ["kalkan villa", "kalkan özel havuzlu villa", "kalkan villa kiralama"],
    dailyBudgetNote: "Kullanıcı belirleyecek",
  },
  {
    id: "generic-kas",
    villa: "Ortak",
    campaignType: "Generic Search",
    name: "Kaş Villa Kiralama",
    status: "DRAFT",
    keywords: ["kaş villa", "kaş özel havuzlu villa", "kaş aile villa", "kaş villa tatili"],
    dailyBudgetNote: "Kullanıcı belirleyecek",
  },
  {
    id: "generic-havuzlu-aile",
    villa: "Ortak",
    campaignType: "Generic Search",
    name: "Özel Havuzlu Villa / Aile-Sakin Tatil Intent",
    status: "DRAFT",
    keywords: ["özel havuzlu villa kiralama", "havuzlu villa tatili", "aile ile villa tatili", "sakin tatil villa", "gizlilik villa tatil"],
    dailyBudgetNote: "Kullanıcı belirleyecek",
  },
  {
    id: "remarketing",
    villa: "Ortak",
    campaignType: "Remarketing",
    name: "Site Ziyaretçisi Remarketing",
    status: "DRAFT",
    keywords: [],
    dailyBudgetNote: "Kullanıcı belirleyecek — YALNIZ mevcut consent banner (CookieConsentBanner) ad_storage izni verdiyse GTM audience'ı besler",
  },
];

// Kod içindeki (analytics.ts) gerçek GA4 event isimleriyle birebir - tahmin edilmedi.
export const GOOGLE_ADS_CONVERSION_MAPPING = [
  { gtmEvent: "generate_lead", note: "Rezervasyon talebi formu gönderimi" },
  { gtmEvent: "check_availability", note: "Takvimde müsaitlik sorgusu" },
  { gtmEvent: "whatsapp_click", note: "WhatsApp CTA tıklaması" },
  { gtmEvent: "phone_click", note: "Telefon CTA tıklaması" },
  { gtmEvent: "maps_click", note: "Harita/konum CTA tıklaması" },
];

export const GOOGLE_ADS_NEGATIVE_KEYWORDS = [
  "ucuz", "bedava", "indirim kodu", "kupon", "satılık", "iş ilanı", "kariyer",
  "apart otel", "pansiyon", "otel rezervasyon", "airbnb", "booking.com",
  "uzun dönem kiralık daire", "yurt dışı villa", "ikinci el",
];
