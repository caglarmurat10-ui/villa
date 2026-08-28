export type SocialAudience = {
  id: string;
  name: string;
  geography: string;
  age: string;
  targeting: string;
  objective: string;
  creative: string;
  activation: "Hazır" | "Veri sonrası" | "İkinci aşama";
  rule: string;
};

export const socialAudiences: SocialAudience[] = [
  { id: "tr-broad", name: "TR Geniş Keşif", geography: "Türkiye · büyük şehirler + Antalya", age: "25–60 başlangıç testi", targeting: "Geniş kitle; aşırı ilgi daraltması yok", objective: "Video Views / Engagement", creative: "Reels + villa genel görünüm", activation: "Hazır", rule: "Önce organik baz çizgisi; ücretli harcama yalnız açık kullanıcı onayıyla." },
  { id: "tr-intent", name: "TR Tatil Niyeti", geography: "Türkiye", age: "25–60 başlangıç testi", targeting: "Kaş, Patara, Kalkan, villa tatili ve Akdeniz seyahati sinyalleri", objective: "Traffic / Messages", creative: "Havuz + oda + bölge", activation: "Hazır", rule: "Broad grupla A/B test; sonuç görülmeden aşırı daraltma yapma." },
  { id: "warm", name: "Sıcak Etkileşim", geography: "Türkiye + uygun yabancı pazarlar", age: "Meta uygun kitle", targeting: "IG/FB etkileşenler ve Reels izleyenler", objective: "Messages / Conversion", creative: "Müsaitlik + güven + gerçek villa", activation: "Veri sonrası", rule: "Yeterli etkileşim havuzu oluşunca retargeting." },
  { id: "web", name: "Web Retargeting", geography: "Site ziyaretçileri", age: "Meta uygun kitle", targeting: "Siteyi ziyaret edip rezervasyon yapmayanlar", objective: "Messages / Conversion", creative: "Müsaitlik + sosyal kanıt", activation: "Veri sonrası", rule: "Pixel/CAPI ve ölçüm doğrulandıktan sonra." },
  { id: "lookalike", name: "Lookalike", geography: "Türkiye", age: "Meta uygun kitle", targeting: "Yeterli rezervasyon/lead verisinden benzer kitle", objective: "Prospecting", creative: "En iyi performanslı kreatif", activation: "Veri sonrası", rule: "Erken aşamada açma; kaliteli kaynak veri bekle." },
  { id: "uk", name: "UK", geography: "Birleşik Krallık", age: "28–60 başlangıç testi", targeting: "Broad travel audience", objective: "Traffic / Messages", creative: "English Reels + villa tour", activation: "İkinci aşama", rule: "İngilizce caption/landing ve yanıt akışı hazır olmadan açma." },
  { id: "dach-benelux", name: "DE / NL / BE", geography: "Almanya · Hollanda · Belçika", age: "28–60 başlangıç testi", targeting: "Broad travel audience", objective: "Traffic / Messages", creative: "Bölge + villa kombinasyonu", activation: "İkinci aşama", rule: "Dil bazlı ayrı kreatif testleri kullan." },
];

export const organicRevivalRules = [
  "İlk 7 gün iki villada da her gün Story; ana içerik Reels/Feed/Carousel dönüşümlü.",
  "Her paylaşımda tek ana CTA: profil, kaydet, DM veya WhatsApp. Aynı içerikte CTA kalabalığı yapma.",
  "Gerçek müsaitlik yalnız rezervasyon sisteminden; eski tarih veya tahmini fiyat kullanılmaz.",
  "Safira ve Destan medyası dosya/villa doğrulamasından geçmeden yayına alınmaz.",
  "İlk 30 gün KPI: profil ziyareti, Reels erişimi, kaydetme, DM, WhatsApp tıklama ve lead→rezervasyon.",
  "Ücretli kampanya ve bütçe kullanıcı açık onayı olmadan başlatılmaz.",
];
