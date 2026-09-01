import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "./types";

// Google Places API (New) entegrasyonu — güvenli, "sahte veri yok" ilkesiyle.
//
// 2026-09-01 durumu: GOOGLE_PLACES_API_KEY Cloudflare secret'larında YOK, GOOGLE_PLACE_ID_SAFIRA/
// GOOGLE_PLACE_ID_DESTAN de tanımlı değil. Kullanıcının paylaştığı Maps kısa linkleri (Safira:
// maps.app.goo.gl/fKBpCQhn5Qneuo5H6, Destan: maps.app.goo.gl/8zCrgoegzri52ro79) sadece HAM KOORDİNAT
// pin'ine çözülüyor (isimli bir Place'e değil) — bu yüzden Place ID buradan teknik olarak çıkarılamadı.
// WebSearch ile de her iki villa adı için indekslenmiş bir Google Maps Place/yorum bulunamadı.
//
// Bu modül API key/Place ID olmadan da GÜVENLİ ÇALIŞIR: fetchGoogleReviews() yapılandırma eksikse
// sadece `null` döner — asla sahte/boş "yorum yok" sonucu ÜRETMEZ. UI katmanı null durumunda
// bölümü TAMAMEN GİZLER (yanlış "henüz yorum yok" iddiası oluşturmamak için).
//
// Google Places API kullanım şartları gereği yorumlar KALICI OLARAK saklanmaz (D1'e yazılmaz);
// yalnızca kısa ömürlü (1 saat) KV cache kullanılır.

const CACHE_TTL_SECONDS = 60 * 60;

export interface GoogleReviewAuthor {
  displayName: string;
  uri?: string;
  photoUri?: string;
}

export interface GoogleReview {
  rating: number;
  text: string;
  author: GoogleReviewAuthor;
  publishTime: string;
  relativeDescription?: string;
}

export interface GooglePlaceReviews {
  placeId: string;
  rating: number;
  userRatingCount: number;
  googleMapsUri: string;
  reviews: GoogleReview[];
  fetchedAt: string;
}

function placeIdEnvKey(villa: Villa): "GOOGLE_PLACE_ID_SAFIRA" | "GOOGLE_PLACE_ID_DESTAN" {
  return villa === "Safira" ? "GOOGLE_PLACE_ID_SAFIRA" : "GOOGLE_PLACE_ID_DESTAN";
}

async function kv() {
  const { env } = await getCloudflareContext({ async: true });
  return env.META_PRIVATE;
}

export async function isGoogleReviewsConfigured(): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  const safiraId = env.GOOGLE_PLACE_ID_SAFIRA;
  const destanId = env.GOOGLE_PLACE_ID_DESTAN;
  return Boolean(apiKey && (safiraId || destanId));
}

export async function fetchGoogleReviews(villa: Villa): Promise<GooglePlaceReviews | null> {
  const { env } = await getCloudflareContext({ async: true });
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  const placeId = env[placeIdEnvKey(villa)];
  if (!apiKey || !placeId) return null;

  const cacheKey = `google-reviews:${villa}`;
  const store = await kv();
  const cached = await store.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as GooglePlaceReviews;
    } catch {
      // düşer, yeniden çeker
    }
  }

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,rating,userRatingCount,googleMapsUri,reviews",
      },
    });
    if (!response.ok) {
      console.error(`[Google Reviews] ${villa} HTTP ${response.status}`);
      return null;
    }
    const data = await response.json() as {
      id: string;
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      reviews?: Array<{
        rating?: number;
        text?: { text?: string };
        authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
        publishTime?: string;
        relativePublishTimeDescription?: string;
      }>;
    };

    const result: GooglePlaceReviews = {
      placeId: data.id,
      rating: data.rating ?? 0,
      userRatingCount: data.userRatingCount ?? 0,
      googleMapsUri: data.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
      reviews: (data.reviews ?? []).slice(0, 5).map((review) => ({
        rating: review.rating ?? 0,
        text: review.text?.text ?? "",
        author: {
          displayName: review.authorAttribution?.displayName ?? "Google kullanıcısı",
          uri: review.authorAttribution?.uri,
          photoUri: review.authorAttribution?.photoUri,
        },
        publishTime: review.publishTime ?? "",
        relativeDescription: review.relativePublishTimeDescription,
      })),
      fetchedAt: new Date().toISOString(),
    };

    await store.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS });
    return result;
  } catch (error) {
    console.error(`[Google Reviews] ${villa} fetch failed:`, error instanceof Error ? error.message : "Bilinmeyen hata");
    return null;
  }
}
