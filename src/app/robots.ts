import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/villa-safira", "/villa-destan"], disallow: ["/api/", "/site/"] },
    ],
    sitemap: "https://safiradestan.com/sitemap.xml",
    host: "https://safiradestan.com",
  };
}
