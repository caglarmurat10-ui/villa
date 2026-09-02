import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "./types";

// Google Places API (New) entegrasyonu — güvenli, "sahte veri yok" ilkesiyle.
//
// API key/Place ID olmadan fetchGoogleReviews() yalnız `null` döner. UI katmanı null durumunda
// yorum bölümünü tamamen gizler; tahmini veya uydurma değerlendirme verisi gösterilmez.
//
// Google Places verileri D1'e yazılmaz. Yalnız Google'a ayrılmış GOOGLE_PRIVATE KV üzerinde
// kısa ömürlü (1 saat) cache tutulur. Cache erişimi başarısız olursa public villa sayfası düşmez;
// API çağrısı cache olmadan devam eder.

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
  return env.GOOGLE_PRIVATE;
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
  let store: KVNamespace | null = null;
  try {
    store = await kv();
    const cached = await store?.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as GooglePlaceReviews;
      } catch {
        await store?.delete(cacheKey).catch(() => undefined);
      }
    }
  } catch (error) {
    console.error(`[Google Reviews] ${villa} cache read failed: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
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

    if (store) {
      await store.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS }).catch((error) => {
        console.error(`[Google Reviews] ${villa} cache write failed: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`);
      });
    }
    return result;
  } catch (error) {
    console.error(`[Google Reviews] ${villa} fetch failed:`, error instanceof Error ? error.message : "Bilinmeyen hata");
    return null;
  }
}
