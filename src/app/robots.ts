import type { MetadataRoute } from "next";
import { REGION_GUIDE_PAGE_SLUGS } from "@/lib/region-guide-pages";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/villa-safira", "/villa-destan", "/rehber", "/rezervasyon-kosullari", ...REGION_GUIDE_PAGE_SLUGS.map((slug) => `/rehber/${slug}`)],
        disallow: ["/api/", "/site/"],
      },
    ],
    sitemap: "https://safiradestan.com/sitemap.xml",
    host: "https://safiradestan.com",
  };
}
