// Faz 6.1 bölüm 11 - Itinerary (rota) içerik ailesi. Her rota, YALNIZ zaten doğrulanmış
// GUIDE_PLACES kayıtlarının kendi id'lerini referans alır - hiçbir yeni yer/gerçek UYDURULMAZ.
// Kesin saat/ücret/mesafe/ulaşım süresi/açılış-kapanış/hava gibi değişken bilgi İÇERMEZ - yalnız
// hangi yerlerin hangi sırayla, hangi genel çerçevede (1 günlük/3 günlük/çiftler/aileler için)
// birlikte düşünülebileceğini anlatır. AUTO_SAFE olabilmesi İÇİN her constituent place GUIDE_PLACES
// içinde gerçekten var olmalı - buildItineraryTemplates() bunu çalışma zamanında doğrular.
import { GUIDE_PLACES, type GuidePlace } from "./region-guide";
import type { Villa } from "./types";

export interface ItineraryDefinition {
  id: string;
  title: string;
  frame: string; // genel, uydurma-olmayan çerçeve cümlesi (süre/saat/ücret içermez)
  placeIds: string[]; // GUIDE_PLACES id'lerine referans, sırayla
}

export const ITINERARY_DEFINITIONS: ItineraryDefinition[] = [
  {
    id: "patara-1-gun",
    title: "Patara'da 1 Gün",
    frame: "Patara'yı tek bir günde keşfetmek isteyenler için, bölgenin öne çıkan noktalarını bir araya getiren genel bir rota fikri.",
    placeIds: ["patara-antik-kenti", "patara-plaji", "patara-kum-tepeleri", "patara-deniz-feneri"],
  },
  {
    id: "kas-1-gun",
    title: "Kaş Çevresinde 1 Gün",
    frame: "Kaş merkezini ve yakın çevresini aynı gün içinde görmek isteyenler için öne çıkan duraklar.",
    placeIds: ["kas-merkez", "kaputas-plaji"],
  },
  {
    id: "patara-kas-kalkan-3-gun",
    title: "3 Günlük Patara – Kaş – Kalkan Fikri",
    frame: "Patara, Kaş ve Kalkan’ın birbirinden farklı havasını birkaç güne yayarak görmek isteyenler için öne çıkan duraklar.",
    placeIds: ["patara-antik-kenti", "patara-plaji", "kas-merkez", "kaputas-plaji", "kalkan"],
  },
  {
    id: "ciftler-rota",
    title: "Çiftler İçin Rota Fikri",
    frame: "Sakin, manzaralı ve acele etmeden geçirilecek bir gün için bölgeden birkaç durak.",
    placeIds: ["kaputas-plaji", "kalkan", "likya-yolu"],
  },
  {
    id: "aileler-rota",
    title: "Aileler İçin Rota Fikri",
    frame: "Sahil ve tarihî alanları bir arada görmek isteyen aileler için bölgeden birkaç durak.",
    placeIds: ["patara-plaji", "patara-antik-kenti", "kas-merkez"],
  },
];


// Her tanımın constituent place'lerini GERÇEKTEN GUIDE_PLACES'te doğrular - kayıp/yanlış yazılmış
// bir id sessizce görmezden gelinmez, o rota tanımı HİÇ üretilmez (fabrikasyon riskini kod
// seviyesinde önler).
export function resolveItineraryPlaces(definition: ItineraryDefinition): GuidePlace[] | null {
  const places = definition.placeIds.map((id) => GUIDE_PLACES.find((p) => p.id === id));
  if (places.some((p) => !p)) return null;
  return places as GuidePlace[];
}

export function itineraryCaption(definition: ItineraryDefinition, places: GuidePlace[], _villa: Villa): { hook: string; caption: string } {
  void _villa; // hesap hedefi için parametre korunur; organik bölge metnine villa adı sızdırılmaz.
  const body = places.map((p) => `${p.name}: ${p.description}`).join("\n\n");
  return {
    hook: definition.frame,
    caption: [`${definition.title}\n\n${definition.frame}`, body, "Yola çıkmadan önce güncel giriş, ulaşım ve ziyaret koşullarını kontrol etmek iyi olur.", "#patara #kaş #kalkan #gezirehberi #likya #antalya"].join("\n\n"),
  };
}
