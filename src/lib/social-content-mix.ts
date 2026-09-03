// Faz 4 bölüm O - Content Quality Engine (çeşitlilik ölçümü kısmı). SAF fonksiyon: mevcut statik
// içerik kütüphanesindeki (social-content-library.ts, content01-06.json - KIRILMADI, yalnız
// okunuyor) gerçek `theme` etiketlerinden kategori dağılımını hesaplar ve hedef yüzdelerle
// karşılaştırır. Hiçbir sayı uydurulmaz - yalnız gerçek şablon sayımı.
//
// FAZ 6 (2026-09-03 kesinleşen karma) - 5 kovalık eski taksonomi 7 kovaya ayrıştırıldı; her kova
// artık GERÇEK, ayrı bir theme'e sahip (bkz. THEME_TO_CATEGORY) - hiçbiri artık "Diğer" gibi bir
// yedek kovaya düşmüyor.

export type ContentMixCategory =
  | "Destinasyon/Bölge"
  | "Aktivite/Gezi"
  | "Villa/Konaklama"
  | "Tarih/Kültür/Doğa"
  | "Yerel Yaşam/Yemek/İpucu"
  | "Doğrudan Rezervasyon/Güven"
  | "Müsaitlik/Kampanya";

// Kullanıcının 2026-09-03'te kesinleştirdiği hedef karma - "yaklaşık hedef, katı matematik olmak
// zorunda değil" (kullanıcının kendi ifadesi, önceki turdan). Toplam ~%65 çevre/gezi/kültür/
// aktivite/yerel yaşam, ~%35 villa/rezervasyon/ticari içerik.
export const CONTENT_MIX_TARGETS: Record<ContentMixCategory, number> = {
  "Destinasyon/Bölge": 25,
  "Aktivite/Gezi": 20,
  "Villa/Konaklama": 20,
  "Tarih/Kültür/Doğa": 10,
  "Yerel Yaşam/Yemek/İpucu": 10,
  "Doğrudan Rezervasyon/Güven": 10,
  "Müsaitlik/Kampanya": 5,
};

// Her theme TEK bir kategoriye eşlenir - statik kütüphanedeki (Villa/Bölge/Gezi/Müsaitlik/Özel) ve
// sanal şablonlardaki (Tarih-Doğa/Yerel İpucu/Güven, bkz. social-content-virtual-templates.ts) TÜM
// gerçek theme değerleri burada karşılığını bulur. "Özel" (satış baskısı OLMAYAN yumuşak villa
// detay içeriği, bkz. SM012/SM015/SM030/SM033/SM048/SM051 caption'ları) ticari/satış değil, villa
// atmosferi içeriğidir - Villa/Konaklama'ya eşlenir, Müsaitlik/Kampanya'ya DEĞİL.
const THEME_TO_CATEGORY: Record<string, ContentMixCategory> = {
  "Villa": "Villa/Konaklama",
  "Özel": "Villa/Konaklama",
  "Bölge": "Destinasyon/Bölge",
  "Rota": "Destinasyon/Bölge", // itinerary-content.ts - çok-yerli rota fikirleri, doğası gereği destinasyon/bölge içeriği
  "Gezi": "Aktivite/Gezi",
  "Tarih-Doğa": "Tarih/Kültür/Doğa",
  "Yerel İpucu": "Yerel Yaşam/Yemek/İpucu",
  "Güven": "Doğrudan Rezervasyon/Güven",
  "Müsaitlik": "Müsaitlik/Kampanya",
};

export function categoryForTheme(theme: string): ContentMixCategory | null {
  return THEME_TO_CATEGORY[theme] ?? null;
}

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
    const category = categoryForTheme(template.theme);
    if (!category) continue; // SPECIAL_DAY/LOCAL_EVENT gibi karma-dışı theme'ler (bkz. social-plan-seed.ts) burada sayılmaz
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
