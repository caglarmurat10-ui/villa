import type { Villa } from "./types";

export const profileAssets: Record<Villa, string> = {
  Safira: "/brand/safira-profile.svg",
  Destan: "/brand/destan-profile.svg",
};

export const facebookCoverAssets: Record<Villa, string> = {
  Safira: "/brand/safira-facebook-cover.svg",
  Destan: "/brand/destan-facebook-cover.svg",
};

export const highlightAssets = [
  { label: "Villa", path: "/brand/highlight-villa.svg" },
  { label: "Havuz", path: "/brand/highlight-havuz.svg" },
  { label: "Odalar", path: "/brand/highlight-odalar.svg" },
  { label: "Patara", path: "/brand/highlight-patara.svg" },
  { label: "Kaş", path: "/brand/highlight-kas.svg" },
  { label: "Müsaitlik", path: "/brand/highlight-musaitlik.svg" },
  { label: "İletişim", path: "/brand/highlight-iletisim.svg" },
];

export const verifiedMediaNotes: Record<Villa, { status: string; notes: string[] }> = {
  Safira: {
    status: "Gerçek fotoğraf doğrulaması sürüyor",
    notes: [
      "WhatsApp konum paylaşımında gerçek Villa Safira dış cephe/havuz fotoğrafı doğrulandı.",
      "Kapak veya feed için yalnız ham/orijinal Safira fotoğrafı eşleştirildikten sonra kullanılacak.",
      "AI ile başka villa üretilmeyecek ve Safira diye yayınlanmayacak.",
    ],
  },
  Destan: {
    status: "Ham gerçek medya bulundu",
    notes: [
      "Library içinde `villa destan_43.jpg` gerçek Villa Destan havuz/dış cephe fotoğrafı doğrulandı.",
      "30 günlük plandaki diğer Destan dosyaları ham medya listesiyle eşleştirilecek.",
      "Drone içerikleri için DJI_0332 dosyası bulunmadan sahte drone görüntüsü kullanılmayacak.",
    ],
  },
};
