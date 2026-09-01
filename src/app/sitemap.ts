import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: "https://safiradestan.com/", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://safiradestan.com/villa-safira", lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: "https://safiradestan.com/villa-destan", lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: "https://safiradestan.com/rezervasyon-kosullari", lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
