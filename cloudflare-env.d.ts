import type { D1Database, Fetcher, KVNamespace } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: Fetcher;
    META_PRIVATE: KVNamespace;
    OTA_PRIVATE: KVNamespace;
    CF_VERSION_METADATA?: {
      id: string;
      tag?: string;
      timestamp: string;
    };
    META_APP_ID?: string;
    META_APP_SECRET?: string;
    FACEBOOK_APP_ID?: string;
    FACEBOOK_APP_SECRET?: string;
    FACEBOOK_CONFIG_ID?: string;
    APP_BASE_URL?: string;
    INSTAGRAM_OAUTH_BASE_URL?: string;
    SOCIAL_AUTO_PUBLISH_ENABLED?: string;
    SOCIAL_AUTO_PUBLISH_TIME?: string;
    SOCIAL_AUTO_PUBLISH_LIMIT?: string;
    WEATHER_INGEST_SECRET?: string;
    GOOGLE_PLACES_API_KEY?: string;
    GOOGLE_PLACE_ID_SAFIRA?: string;
    GOOGLE_PLACE_ID_DESTAN?: string;
    GOOGLE_REVIEW_REQUEST_URL_SAFIRA?: string;
    GOOGLE_REVIEW_REQUEST_URL_DESTAN?: string;
    PAYTR_MERCHANT_ID?: string;
    PAYTR_MERCHANT_KEY?: string;
    PAYTR_MERCHANT_SALT?: string;
  }
}

export {};
