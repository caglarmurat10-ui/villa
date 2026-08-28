import type { Villa } from "./types";

export const profileAssets: Record<Villa, string> = {
  Safira: "/api/social-assets/Safira/profile",
  Destan: "/api/social-assets/Destan/profile",
};

export const facebookCoverAssets: Record<Villa, string> = {
  Safira: "/api/social-assets/Safira/cover",
  Destan: "/api/social-assets/Destan/cover",
};

const highlightDefinitions = [
  { key: "villa", label: "Villa" },
  { key: "havuz", label: "Havuz" },
  { key: "odalar", label: "Odalar" },
  { key: "patara", label: "Patara" },
  { key: "kas", label: "Kaş" },
  { key: "musaitlik", label: "Müsaitlik" },
  { key: "iletisim", label: "İletişim" },
] as const;

export function highlightAssetsForVilla(villa: Villa) {
  return highlightDefinitions.map((item) => ({
    label: item.label,
    path: `/api/social-assets/${villa}/highlight/${item.key}`,
  }));
}

export const socialAssetManifest: Record<Villa, { profile: string; facebookCover: string; instagramHighlights: Array<{ label: string; path: string }> }> = {
  Safira: {
    profile: profileAssets.Safira,
    facebookCover: facebookCoverAssets.Safira,
    instagramHighlights: highlightAssetsForVilla("Safira"),
  },
  Destan: {
    profile: profileAssets.Destan,
    facebookCover: facebookCoverAssets.Destan,
    instagramHighlights: highlightAssetsForVilla("Destan"),
  },
};

export const verifiedMediaNotes: Record<Villa, { status: string; notes: string[] }> = {
  Safira: {
    status: "12 gerçek Safira görseli Drive ile doğrulandı",
    notes: [
      "30 günlük içerik planında kullanılan Safira fotoğrafları gerçek `Safira Resim` Drive klasörüyle dosya ID'si seviyesinde eşleştirildi.",
      "Facebook kapak PNG'si gerçek `Villa Safira (50).jpg` fotoğrafından otomatik üretilir.",
      "Profil logosu yalnız VS monogramı + Villa Safira adı kullanır; yapay villa fotoğrafı içermez.",
      "Instagram / Facebook yayınında yalnız Safira whitelist'indeki medya ID'leri kabul edilir; Destan medyası teknik olarak reddedilir.",
    ],
  },
  Destan: {
    status: "7 gerçek Destan görseli Drive ile doğrulandı",
    notes: [
      "30 günlük içerik planında kullanılan Destan fotoğrafları gerçek `destan resim` Drive klasörüyle dosya ID'si seviyesinde eşleştirildi.",
      "Facebook kapak PNG'si gerçek `DJI_0332.jpg` drone fotoğrafından otomatik üretilir.",
      "Profil logosu yalnız VD monogramı + Villa Destan adı kullanır; yapay villa fotoğrafı içermez.",
      "Instagram / Facebook yayınında yalnız Destan whitelist'indeki medya ID'leri kabul edilir; Safira medyası teknik olarak reddedilir.",
    ],
  },
};
