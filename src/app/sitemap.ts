import type { MetadataRoute } from "next";
import { REGION_GUIDE_PAGE_SLUGS } from "@/lib/region-guide-pages";

// lastModified: gerçek içerik değişim zamanını satır satır izleyen bir mekanizma yok (D1'de değil,
// kaynak kodda yaşayan statik içerik) - bu yüzden build/deploy zamanı en yakın doğru yaklaşımdır.
// Deploy tarihinden daha eskiye sabitlemek "hiç değişmedi" gibi yanlış bir sinyal, her request'te
// "now" ise "her zaman değişiyor" gibi yanlış bir sinyal verir - build-time sabit değer ortada bir yol.
const BUILD_TIME = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://safiradestan.com/", lastModified: BUILD_TIME, changeFrequency: "weekly", priority: 1 },
    { url: "https://safiradestan.com/villa-safira", lastModified: BUILD_TIME, changeFrequency: "weekly", priority: 0.9 },
    { url: "https://safiradestan.com/villa-destan", lastModified: BUILD_TIME, changeFrequency: "weekly", priority: 0.9 },
    { url: "https://safiradestan.com/rezervasyon-kosullari", lastModified: BUILD_TIME, changeFrequency: "monthly", priority: 0.5 },
    { url: "https://safiradestan.com/rehber", lastModified: BUILD_TIME, changeFrequency: "monthly", priority: 0.6 },
    ...REGION_GUIDE_PAGE_SLUGS.map((slug) => ({
      url: `https://safiradestan.com/rehber/${slug}`,
      lastModified: BUILD_TIME,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
