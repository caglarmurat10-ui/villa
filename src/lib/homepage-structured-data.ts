import type { VillaFaq } from "./villa-content";
import { VILLAS } from "./villa-content";

// src/app/site/page.tsx'ten AYRI: Next.js page.tsx dosyaları yalnız tanınan özel export'ları
// (default, metadata, generateMetadata, dynamic, vb.) kabul eder - opennextjs-cloudflare'in
// kullandığı webpack build'i (next build --webpack) bunu route type-check aşamasında zorunlu kılar
// (Turbopack build bunu YAKALAMAZ - bu yüzden bu hata yalnız gerçek deploy pipeline'ında ortaya çıktı).
// Bu fonksiyon test edilebilirlik için page.tsx'ten değil, buradan export edilir.
const ORIGIN = "https://safiradestan.com";

const SOCIAL_LINKS = [
  VILLAS["villa-safira"].instagram,
  VILLAS["villa-destan"].instagram,
  VILLAS["villa-safira"].facebook,
  VILLAS["villa-destan"].facebook,
];

export function buildHomepageStructuredData(faqItems: VillaFaq[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: ORIGIN,
        name: "Safira & Destan Villas",
        inLanguage: "tr-TR",
        publisher: { "@id": `${ORIGIN}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${ORIGIN}/#organization`,
        name: "Safira & Destan Villas",
        url: ORIGIN,
        logo: {
          "@type": "ImageObject",
          url: `${ORIGIN}/app-icon-512.png`,
        },
        sameAs: SOCIAL_LINKS,
      },
      {
        "@type": "FAQPage",
        "@id": `${ORIGIN}/#faq`,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}
