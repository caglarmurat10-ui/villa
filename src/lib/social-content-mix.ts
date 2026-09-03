// Faz 4 bölüm O - Content Quality Engine (çeşitlilik ölçümü kısmı). SAF fonksiyon: mevcut statik
// içerik kütüphanesindeki (social-content-library.ts, content01-06.json - KIRILMADI, yalnız
// okunuyor) gerçek `theme` etiketlerinden kategori dağılımını hesaplar ve bölüm H'deki hedef
// yüzdelerle karşılaştırır. Hiçbir sayı uydurulmaz - yalnız gerçek şablon sayımı.

export type ContentMixCategory = "Villa" | "Bölge" | "Aktivite" | "Satış/Müsaitlik" | "Diğer";

// Bölüm H'deki hedef karma - "yaklaşık hedef, katı matematik olmak zorunda değil" (kullanıcının
// kendi ifadesi). Mevcut theme etiketleri (Villa/Bölge/Gezi/Müsaitlik/Özel) bu 5 kovaya eşlenir;
// bölüm H'nin ayrıca istediği "Tarih/Kültür/Doğa" ve "Yerel/Yemek" alt-kırılımları için mevcut
// veri modelinde ayrı bir theme YOK - bu, section I'daki APPROVED_CONTENT_TOPICS ile ileride
// yeni şablonlar eklenirken theme çeşitlendirilerek kapatılabilecek gerçek bir boşluk (raporda not).
export const CONTENT_MIX_TARGETS: Record<ContentMixCategory, number> = {
  "Bölge": 25,
  "Aktivite": 20,
  "Villa": 20,
  "Diğer": 20, // Tarih/Kültür/Doğa (%10) + Yerel/Yaşam/Yemek (%10) - ayrı theme'ler eklenene kadar birleşik
  "Satış/Müsaitlik": 15, // Direct booking/güven (%10) + Müsaitlik/kampanya (%5) - ayrı theme'ler eklenene kadar birleşik
};

const THEME_TO_CATEGORY: Record<string, ContentMixCategory> = {
  "Villa": "Villa",
  "Bölge": "Bölge",
  "Gezi": "Aktivite",
  "Müsaitlik": "Satış/Müsaitlik",
  "Özel": "Satış/Müsaitlik",
};

export interface ContentMixEntry {
  category: ContentMixCategory;
  count: number;
  actualPercent: number;
  targetPercent: number;
  deviation: number; // actual - target, pozitif = hedeften fazla (asiri temsil edilmis)
  overrepresented: boolean;
}

export interface ContentMixReport {
  totalTemplates: number;
  entries: ContentMixEntry[];
  dominantCategoryWarning: string | null; // tek bir kategori toplamin %40'indan fazlasini olusturuyorsa uyari
}

const OVERREPRESENTED_THRESHOLD_POINTS = 10; // hedeften +10 puan sapma "asiri temsil" sayilir
const DOMINANT_SHARE_WARNING_PERCENT = 40; // tek kategori toplamin bu orandan fazlasiysa "sürekli X reklamı" riski

export function computeContentMix(templates: Array<{ theme: string }>): ContentMixReport {
  const total = templates.length;
  const counts = new Map<ContentMixCategory, number>();
  for (const category of Object.keys(CONTENT_MIX_TARGETS) as ContentMixCategory[]) counts.set(category, 0);

  for (const template of templates) {
    const category = THEME_TO_CATEGORY[template.theme] ?? "Diğer";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const entries: ContentMixEntry[] = (Object.keys(CONTENT_MIX_TARGETS) as ContentMixCategory[]).map((category) => {
    const count = counts.get(category) ?? 0;
    const actualPercent = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    const targetPercent = CONTENT_MIX_TARGETS[category];
    const deviation = Math.round((actualPercent - targetPercent) * 10) / 10;
    return { category, count, actualPercent, targetPercent, deviation, overrepresented: deviation > OVERREPRESENTED_THRESHOLD_POINTS };
  });

  const dominant = entries.find((entry) => entry.actualPercent > DOMINANT_SHARE_WARNING_PERCENT);
  const dominantCategoryWarning = dominant
    ? `"${dominant.category}" içeriği toplamın %${dominant.actualPercent}'ini oluşturuyor - profil tek konu üzerinden reklam yapan hesap gibi görünme riski taşıyor.`
    : null;

  return { totalTemplates: total, entries, dominantCategoryWarning };
}
