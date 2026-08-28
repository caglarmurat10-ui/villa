import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetaSocialAccount } from "./meta-store";

export type MetaDiagnostic = {
  graphApiVersion: string;
  configuration: {
    appId: boolean;
    appSecret: boolean;
    baseUrl: boolean;
    database: boolean;
  };
  baseUrl: string;
  callbacks: {
    instagram: string;
    facebook: string;
  };
  requiredScopes: {
    instagram: string[];
    facebook: string[];
  };
  accounts: {
    connected: number;
    expected: number;
    missing: string[];
  };
};

export async function getMetaDiagnostic(accounts: MetaSocialAccount[]): Promise<MetaDiagnostic> {
  let env: Record<string, unknown> = {};
  try {
    const context = await getCloudflareContext({ async: true });
    env = context.env as unknown as Record<string, unknown>;
  } catch {
    env = {};
  }

  const appId = String(env.META_APP_ID ?? process.env.META_APP_ID ?? "").trim();
  const appSecret = String(env.META_APP_SECRET ?? process.env.META_APP_SECRET ?? "").trim();
  const baseUrl = String(env.APP_BASE_URL ?? process.env.APP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const hasDatabase = Boolean(env.DB);

  const expected = [
    "Safira Instagram",
    "Safira Facebook",
    "Destan Instagram",
    "Destan Facebook",
  ];
  const connected = new Set(accounts.map((item) => `${item.villa} ${item.platform}`));

  return {
    graphApiVersion: "v26.0",
    configuration: {
      appId: Boolean(appId),
      appSecret: Boolean(appSecret),
      baseUrl: Boolean(baseUrl),
      database: hasDatabase,
    },
    baseUrl,
    callbacks: {
      instagram: baseUrl ? `${baseUrl}/api/meta/instagram/callback` : "",
      facebook: baseUrl ? `${baseUrl}/api/meta/facebook/callback` : "",
    },
    requiredScopes: {
      instagram: ["instagram_business_basic", "instagram_business_content_publish"],
      facebook: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    },
    accounts: {
      connected: connected.size,
      expected: expected.length,
      missing: expected.filter((item) => !connected.has(item)),
    },
  };
}
