import { VILLAS } from "./villa-content";

// src/app/site/patara-villa/page.tsx'ten AYRI - Next.js page.tsx dosyaları yalnız tanınan özel
// export'ları kabul eder (bkz. src/lib/homepage-structured-data.ts üstündeki aynı not).
export const ORIGIN = "https://safiradestan.com";
export const PATARA_VILLA_CANONICAL = `${ORIGIN}/patara-villa`;
export const PATARA_VILLA_TITLE = "Patara Kiralık Villa | Villa Safira & Villa Destan";
export const PATARA_VILLA_DESCRIPTION = "Patara'da özel havuzlu kiralık villa: Villa Safira ve Villa Destan. Gelemiş'te doğrudan rezervasyon, canlı müsaitlik, gerçek fotoğraflar ve dönemsel fiyatlar.";

export const PATARA_VILLA_FAQ = [
  {
    question: "Patara'da kaç villanız var?",
    answer: "Patara/Gelemiş bölgesinde iki ayrı özel havuzlu villamız var: Villa Safira (maks. 5 misafir, 2 yatak odası) ve Villa Destan (maks. 6 misafir, 3 yatak odası). İkisi de doğrudan rezervasyona açık.",
  },
  {
    question: "Patara kiralık villa fiyatları nasıl belirleniyor?",
    answer: "Fiyat, seçtiğiniz tarihe göre sistemdeki dönemsel gecelik fiyattan hesaplanır. İlgili villa sayfasındaki canlı takvimden tarihinizi seçtiğinizde toplam tutarı doğrudan görürsünüz.",
  },
  {
    question: "Villa Safira ile Villa Destan arasındaki fark nedir?",
    answer: "Villa Safira doğayla iç içe, sakin ve gün ışığı alan bir yerleşime sahiptir. Villa Destan ise daha büyük yaşam alanları ve akşam atmosferiyle öne çıkan, mahremiyet odaklı bir villadır. İkisi de Patara/Gelemiş Mahallesi'nde, özel havuzludur.",
  },
  {
    question: "Rezervasyon için aracı komisyonu ödüyor muyum?",
    answer: "Hayır. Web sitesi üzerinden doğrudan rezervasyon talebi gönderdiğinizde ödeme sırasında işletme komisyonu eklenmez.",
  },
];

export function buildPataraVillaStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Patara Kiralık Villa", item: PATARA_VILLA_CANONICAL },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${PATARA_VILLA_CANONICAL}/#webpage`,
        url: PATARA_VILLA_CANONICAL,
        name: PATARA_VILLA_TITLE,
        description: PATARA_VILLA_DESCRIPTION,
        isPartOf: { "@type": "WebSite", "@id": `${ORIGIN}/#website` },
        about: [
          { "@id": `${ORIGIN}/villa-safira/#vacationrental` },
          { "@id": `${ORIGIN}/villa-destan/#vacationrental` },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${PATARA_VILLA_CANONICAL}#faq`,
        mainEntity: PATARA_VILLA_FAQ.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

export function buildPataraVillaMetadata() {
  return {
    title: PATARA_VILLA_TITLE,
    description: PATARA_VILLA_DESCRIPTION,
    openGraph: {
      title: PATARA_VILLA_TITLE,
      description: PATARA_VILLA_DESCRIPTION,
      url: PATARA_VILLA_CANONICAL,
      siteName: "Safira & Destan Villas",
      locale: "tr_TR",
      type: "website" as const,
      images: [{ url: VILLAS["villa-safira"].cover, alt: "Patara'da özel havuzlu kiralık villa" }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: PATARA_VILLA_TITLE,
      description: PATARA_VILLA_DESCRIPTION,
      images: [VILLAS["villa-safira"].cover],
    },
  };
}
