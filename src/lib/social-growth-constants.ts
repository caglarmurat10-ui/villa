// Social Growth Agent hedef lokasyonları - hem public scout sorgu üretimi (social-growth-public-scout.ts)
// hem scoring (social-growth-scoring.ts) tarafından kullanılır; döngüsel import'u önlemek için
// ayrı bir sabit dosyada tutulur.
export const TARGET_LOCATIONS = [
  "Patara", "Kaş", "Kalkan", "Fethiye", "Kaputaş", "Saklıkent", "Likya Yolu", "Xanthos", "Letoon",
] as const;
