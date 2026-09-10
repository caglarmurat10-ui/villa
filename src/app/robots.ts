import type { MetadataRoute } from "next";
import { REGION_GUIDE_PAGE_SLUGS } from "@/lib/region-guide-pages";
import { LEGAL_PAGE_SLUGS } from "@/lib/legal-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/villa-safira",
          "/villa-destan",
          "/patara-villa",
          "/rehber",
          "/rezervasyon-kosullari",
          ...REGION_GUIDE_PAGE_SLUGS.map((slug) => `/rehber/${slug}`),
          ...LEGAL_PAGE_SLUGS.map((slug) => `/${slug}`),
        ],
        disallow: ["/api/", "/site/"],
      },
    ],
    sitemap: "https://safiradestan.com/sitemap.xml",
    host: "https://safiradestan.com",
  };
}
