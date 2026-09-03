import type { VillaContent } from "./villa-content";

// SAF fonksiyon - VillaComparison bileşeninin render ettiği karşılaştırma satırlarını
// VILLAS'taki (villa-content.ts) gerçek/doğrulanmış alanlardan türetir. Hiçbir sayı burada
// sabitlenmez/uydurulmaz; villa-content.ts güncellenirse bu satırlar otomatik güncellenir.
export interface VillaComparisonSpec {
  label: string;
  value: string;
}

export interface VillaComparisonRow {
  slug: VillaContent["slug"];
  villa: VillaContent["villa"];
  name: string;
  label: string;
  atmosphere: string;
  specs: VillaComparisonSpec[];
}

// Atmosfer etiketleri villanın kendi description/quote metnindeki gerçek ifadelerin kısaltılmış
// hâlidir (Safira: "doğal doku", "sakin ve özgür"; Destan: "mahremiyet odaklı", "geniş yaşam
// alanları", "güçlü iç mekân detayları") - villa-content.ts'te bağımsız olarak doğrulanmıştır.
const ATMOSPHERE: Record<VillaContent["slug"], string> = {
  "villa-safira": "Doğayla iç içe · Sakin · Özgür",
  "villa-destan": "Mahremiyet odaklı · Geniş yaşam alanı · Akşam atmosferi",
};

export function computeVillaComparisonRows(villas: VillaContent[]): VillaComparisonRow[] {
  return villas.map((villa) => ({
    slug: villa.slug,
    villa: villa.villa,
    name: villa.name,
    label: villa.label,
    atmosphere: ATMOSPHERE[villa.slug],
    specs: [
      { label: "Kapasite", value: `${villa.quickFacts.maxGuests} misafir` },
      { label: "Yatak odası", value: `${villa.quickFacts.bedroomCount} oda` },
      { label: "Özel havuz", value: villa.quickFacts.poolSize },
      { label: "Konum", value: `${villa.address.addressLocality} · ${villa.address.addressRegion}` },
    ],
  }));
}
