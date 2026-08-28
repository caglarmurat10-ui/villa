import type { Villa } from "./types";

export const profileAssets: Record<Villa, string> = {
  Safira: "/brand/safira-profile.svg",
  Destan: "/brand/destan-profile.svg",
};

// Facebook cover preview always uses a verified real image from the correct villa whitelist.
export const facebookCoverAssets: Record<Villa, string> = {
  Safira: "/api/media/drive/13ZC4v1qxGmUX0AXfNRWhpAkYprKpfkLB", // Villa Safira (50).jpg
  Destan: "/api/media/drive/1IipTx5zZfOge9Y1rQJBpW8BK9zBU2tgj", // DJI_0332.jpg
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
    status: "12 gerçek Safira görseli Drive ile doğrulandı",
    notes: [
      "30 günlük içerik planında kullanılan Safira fotoğrafları gerçek `Safira Resim` Drive klasörüyle dosya ID'si seviyesinde eşleştirildi.",
      "Facebook kapak önizlemesi gerçek `Villa Safira (50).jpg` dosyasını kullanır.",
      "Instagram / Facebook yayınında yalnız Safira whitelist'indeki medya ID'leri kabul edilir; Destan medyası teknik olarak reddedilir.",
      "AI ile başka villa üretilmez ve Villa Safira diye yayınlanmaz.",
    ],
  },
  Destan: {
    status: "7 gerçek Destan görseli Drive ile doğrulandı",
    notes: [
      "30 günlük içerik planında kullanılan Destan fotoğrafları gerçek `destan resim` Drive klasörüyle dosya ID'si seviyesinde eşleştirildi.",
      "Facebook kapak önizlemesi gerçek `DJI_0332.jpg` drone fotoğrafını kullanır.",
      "Instagram / Facebook yayınında yalnız Destan whitelist'indeki medya ID'leri kabul edilir; Safira medyası teknik olarak reddedilir.",
      "Gerçek drone dosyası doğrulandığı için sahte drone görseli kullanılmaz.",
    ],
  },
};
