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
    frame: "Kaş merkezini ve yakın çevresini bir günde deneyimlemek isteyenler için genel bir rota fikri.",
    placeIds: ["kas-merkez", "kaputas-plaji"],
  },
  {
    id: "patara-kas-kalkan-3-gun",
    title: "3 Günlük Patara – Kaş – Kalkan Fikri",
    frame: "Bölgeyi daha geniş bir zaman diliminde, üç ayrı karaktere sahip durağıyla tanımak isteyenler için genel bir rota fikri.",
    placeIds: ["patara-antik-kenti", "patara-plaji", "kas-merkez", "kaputas-plaji", "kalkan"],
  },
  {
    id: "ciftler-rota",
    title: "Çiftler İçin Rota Fikri",
    frame: "Sakin ve manzaraya odaklı bir gün geçirmek isteyen çiftler için, bölgenin öne çıkan noktalarından derlenen genel bir rota fikri.",
    placeIds: ["kaputas-plaji", "kalkan", "likya-yolu"],
  },
  {
    id: "aileler-rota",
    title: "Aileler İçin Rota Fikri",
    frame: "Geniş, düz bir sahil şeridi ve tarihî alanları bir arada deneyimlemek isteyen aileler için genel bir rota fikri.",
    placeIds: ["patara-plaji", "patara-antik-kenti", "kas-merkez"],
  },
];

function villaSlug(villa: Villa): "safira" | "destan" {
  return villa === "Safira" ? "safira" : "destan";
}

// Her tanımın constituent place'lerini GERÇEKTEN GUIDE_PLACES'te doğrular - kayıp/yanlış yazılmış
// bir id sessizce görmezden gelinmez, o rota tanımı HİÇ üretilmez (fabrikasyon riskini kod
// seviyesinde önler).
export function resolveItineraryPlaces(definition: ItineraryDefinition): GuidePlace[] | null {
  const places = definition.placeIds.map((id) => GUIDE_PLACES.find((p) => p.id === id));
  if (places.some((p) => !p)) return null;
  return places as GuidePlace[];
}

export function itineraryCaption(definition: ItineraryDefinition, places: GuidePlace[], villa: Villa): { hook: string; caption: string } {
  const stops = places.map((p) => p.name).join(", ");
  const body = places.map((p) => `${p.name}: ${p.description}`).join("\n\n");
  return {
    hook: definition.frame,
    caption: [
      `${definition.title}\n\n${definition.frame}`,
      `Durak fikirleri: ${stops}.`,
      body,
      `Villa ${villa} konumundan bu rotayı değerlendirebilirsiniz.`,
      `#${villaSlug(villa)}patara #patara #kaş #kalkan #gezirehberi #likya`,
    ].join("\n\n"),
  };
}
