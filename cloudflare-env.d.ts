import type { D1Database, Fetcher, KVNamespace } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: Fetcher;
    META_PRIVATE: KVNamespace;
    META_APP_ID?: string;
    META_APP_SECRET?: string;
    FACEBOOK_APP_ID?: string;
    FACEBOOK_APP_SECRET?: string;
    FACEBOOK_CONFIG_ID?: string;
    APP_BASE_URL?: string;
  }
}

export {};
