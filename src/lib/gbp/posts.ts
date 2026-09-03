import { getGoogleAccessToken } from "../google-api";
import { gbpContentLibrary, GBP_WEBSITE_LINKS, type GbpPostDraft } from "../google-business-content";
import type { Villa } from "../types";

// Faz 6 bölüm 11/17 - Google Business Profile Local Posts YAZMA (write) katmanı. Şema
// developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts (2026-09-03
// canlı olarak doğrulandı) - uydurulmadı. Scope zaten mevcut GBP OAuth akışında istenen
// business.manage - AYRI bir OAuth adımı gerekmiyor, yalnız bu adım şimdiye kadar hiç
// ÇAĞRILMAMIŞTI (adapter.ts hâlâ yalnız read-only discovery yapıyor).
//
// KRİTİK: Bu dosyanın hiçbir fonksiyonu otomatik/zamanlanmış bir görevden ÇAĞRILMAZ - yalnız
// admin'in açık bir aksiyonuyla (bkz. /api/admin/google/gbp/publish-post) tetiklenir. Google'ın
// kendisi de Business Profile API'lerini varsayılan olarak KAPALI/sıfır kotayla başlatıyor - gerçek
// bir yayın denemesi PERMISSION_DENIED/kota hatası dönebilir, bu WAITING_EXTERNAL_ACCESS gibi
// mevcut readiness desenine uygun, beklenen bir durumdur - "LIVE" asla otomatik varsayılmaz.

const LOCAL_POSTS_BASE = "https://mybusiness.googleapis.com/v4";

export type GbpPostTopicType = "STANDARD" | "EVENT" | "OFFER";
export type GbpCtaActionType = "BOOK" | "LEARN_MORE";

export interface GbpEventSchedule {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface GbpLocalPostInput {
  topicType: GbpPostTopicType;
  summary: string;
  mediaSourceUrl: string; // publicly erişilebilir görsel URL'i (Google'ın kendisi çeker)
  ctaActionType?: GbpCtaActionType;
  ctaUrl?: string; // ZATEN utmParams ile işaretlenmiş olmalı, bkz. buildUtmUrl
  event?: { title: string; schedule: GbpEventSchedule };
}

function isoDateToGoogleDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return { year, month, day };
}

// Google'ın kendi LocalPost REST şemasına birebir uyan payload'ı üretir - SAF fonksiyon, network
// çağrısı yok, bu yüzden gerçek bir GBP hesabı olmadan da test edilebilir.
export function buildGbpLocalPostPayload(input: GbpLocalPostInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    languageCode: "tr",
    summary: input.summary,
    topicType: input.topicType,
    media: [{ sourceUrl: input.mediaSourceUrl }],
  };
  if (input.ctaActionType && input.ctaUrl) {
    payload.callToAction = { actionType: input.ctaActionType, url: input.ctaUrl };
  }
  if (input.topicType === "EVENT" && input.event) {
    payload.event = {
      title: input.event.title,
      schedule: {
        startDate: isoDateToGoogleDate(input.event.schedule.startDate),
        endDate: isoDateToGoogleDate(input.event.schedule.endDate),
      },
    };
  }
  return payload;
}

// Section 11 - CTA doğru villa landing page'ine gitmeli + UTM (source=google, medium=organic_gbp).
// PII YOK - yalnız sabit, herkese açık sayfa URL'i + kampanya etiketi.
export function buildGbpCtaUrl(villa: Villa, campaign: string): string {
  const base = `https://${GBP_WEBSITE_LINKS[villa]}`;
  const url = new URL(base);
  url.searchParams.set("utm_source", "google");
  url.searchParams.set("utm_medium", "organic_gbp");
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

export interface GbpPublishResult {
  ok: boolean;
  postName: string | null;
  state: string | null;
  error: string | null;
  httpStatus: number | null;
}

// Gerçek yazma çağrısı - yalnız admin'in açık bir aksiyonundan çağrılmalı. Hiçbir zaman
// otomatik/zamanlanmış bir görevden tetiklenmemeli (bkz. dosya başı notu).
export async function publishGbpLocalPost(locationName: string, input: GbpLocalPostInput): Promise<GbpPublishResult> {
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken("gbp");
  } catch (error) {
    return { ok: false, postName: null, state: null, error: error instanceof Error ? error.message : "GBP OAuth tokenı alınamadı.", httpStatus: null };
  }

  const payload = buildGbpLocalPostPayload(input);
  const url = `${LOCAL_POSTS_BASE}/${locationName}/localPosts`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { ok: false, postName: null, state: null, error: error instanceof Error ? error.message : "GBP isteği başarısız.", httpStatus: null };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error(`[GBP Posts] localPosts.create HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
    return { ok: false, postName: null, state: null, error: `HTTP ${response.status} - ${bodyText.slice(0, 200)}`, httpStatus: response.status };
  }

  const body = (await response.json().catch(() => ({}))) as { name?: string; state?: string };
  return { ok: true, postName: body.name ?? null, state: body.state ?? null, error: null, httpStatus: response.status };
}

// Section 17 - "ilk gerçek GBP post adayı" - HENÜZ YAYINLANMAZ, yalnız final raporda gösterilir.
// gbpContentLibrary'deki (google-business-content.ts, zaten var/doğrulanmış) gerçek villa tanıtım
// içeriğinden, her villa için CTA'sı olan (rezervasyon sayfasına yönlendiren) ilk kaydı seçer.
export function selectFirstGbpPostCandidate(villa: Villa): { draft: GbpPostDraft; input: GbpLocalPostInput } | null {
  const draft = gbpContentLibrary.find((item) => item.villa === villa && item.category === "villa-tanitim");
  if (!draft) return null;
  const ctaUrl = draft.cta === "website" ? buildGbpCtaUrl(villa, "first_post_candidate") : undefined;
  return {
    draft,
    input: {
      topicType: "STANDARD",
      summary: draft.body,
      mediaSourceUrl: "", // gerçek yayında Drive/social-assets kaynaklı gerçek görsel URL'i ile doldurulmalı
      ctaActionType: draft.cta === "website" ? "LEARN_MORE" : undefined,
      ctaUrl,
    },
  };
}
