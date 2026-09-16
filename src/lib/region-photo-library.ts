export type RegionPhoto = {
  placeId: string;
  publicPath: string;
  creditLine: string;
};

const PHOTOS: RegionPhoto[] = [
  { placeId: "patara-antik-kenti", publicPath: "/social/region/feed/patara-antik-kenti.jpg", creditLine: "Fotoğraf: Roman_Zacharij / Wikimedia Commons · CC BY-SA 4.0 · yayın için oran korunarak işlendi." },
  { placeId: "patara-plaji", publicPath: "/social/region/feed/patara-plaji.jpg", creditLine: "Fotoğraf: No More / Wikimedia Commons · CC BY 2.0 · yayın için oran korunarak işlendi." },
  { placeId: "patara-deniz-feneri", publicPath: "/social/region/feed/patara-deniz-feneri.jpg", creditLine: "Fotoğraf: Elelicht / Wikimedia Commons · CC BY-SA 3.0 · yayın için oran korunarak işlendi." },
  { placeId: "patara-meclis-binasi", publicPath: "/social/region/feed/patara-meclis-binasi.jpg", creditLine: "Fotoğraf: Kamil Isik / Wikimedia Commons · CC0." },
  { placeId: "kaputas-plaji", publicPath: "/social/region/feed/kaputas-plaji.jpg", creditLine: "Fotoğraf: Fatih Hakkıoğlu / Pexels · Pexels License." },
  { placeId: "xanthos-antik-kenti", publicPath: "/social/region/feed/xanthos-antik-kenti.jpg", creditLine: "Fotoğraf: Jean & Nathalie / Wikimedia Commons · CC BY-SA 2.0 · yayın için oran korunarak işlendi." },
  { placeId: "saklikent-kanyonu", publicPath: "/social/region/feed/saklikent-kanyonu.jpg", creditLine: "Fotoğraf: Acar54 / Wikimedia Commons · CC BY-SA 4.0 · yayın için oran korunarak işlendi." },
  { placeId: "kas-merkez", publicPath: "/social/region/feed/kas-merkez.jpg", creditLine: "Fotoğraf: Nurselkolak 24 / Wikimedia Commons · CC BY-SA 4.0 · yayın için oran korunarak işlendi." },
  { placeId: "kalkan", publicPath: "/social/region/feed/kalkan.jpg", creditLine: "Fotoğraf: Mustafa Yumrutaş / Wikimedia Commons · CC BY-SA 4.0 · yayın için oran korunarak işlendi." },
  { placeId: "letoon-antik-kenti", publicPath: "/social/region/feed/letoon-antik-kenti.jpg", creditLine: "Fotoğraf: nafi durmuş / Unsplash · Unsplash License." },
  { placeId: "likya-yolu", publicPath: "/social/region/feed/likya-yolu.jpg", creditLine: "Fotoğraf: JahlilMA / Wikimedia Commons · CC BY-SA 4.0 · yayın için oran korunarak işlendi." },
  { placeId: "kas-cuma-pazari", publicPath: "/social/region/feed/kas-cuma-pazari.jpg", creditLine: "Fotoğraf: Wusel007 / Wikimedia Commons · CC BY-SA 3.0 · yayın için oran korunarak işlendi." },
];

export const REGION_PHOTOS = PHOTOS;

export function regionPhotoForPlace(placeId: string): RegionPhoto | null {
  return PHOTOS.find((photo) => photo.placeId === placeId) ?? null;
}

export function approvedRegionPhotoUrl(url: string, allowedOrigins: string[]): RegionPhoto | null {
  try {
    const parsed = new URL(url);
    if (!allowedOrigins.includes(parsed.origin)) return null;
    return PHOTOS.find((photo) => photo.publicPath === parsed.pathname) ?? null;
  } catch {
    return null;
  }
}
