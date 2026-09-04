import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MetaSocialAccount } from "./meta-store";
import {
  DESTAN_INSTAGRAM_HARD_BLOCK,
  META_ACTIVE_TARGETS,
  metaTargetLabel,
} from "./social-account-policy";

export type MetaDiagnostic = {
  graphApiVersion: string;
  configuration: {
    instagramAppId: boolean;
    instagramAppSecret: boolean;
    facebookAppId: boolean;
    facebookAppSecret: boolean;
    facebookConfigId: boolean;
    baseUrl: boolean;
    database: boolean;
    privateKv: boolean;
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
    hardBlocked: Array<{ label: string; reason: string }>;
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

  const instagramAppId = String(env.META_APP_ID ?? process.env.META_APP_ID ?? "").trim();
  const instagramAppSecret = String(env.META_APP_SECRET ?? process.env.META_APP_SECRET ?? "").trim();
  const facebookAppId = String(env.FACEBOOK_APP_ID ?? process.env.FACEBOOK_APP_ID ?? "").trim();
  const facebookAppSecret = String(env.FACEBOOK_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? "").trim();
  const facebookConfigId = String(env.FACEBOOK_CONFIG_ID ?? process.env.FACEBOOK_CONFIG_ID ?? "").trim();
  const baseUrl = String(env.APP_BASE_URL ?? process.env.APP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const instagramOAuthBaseUrl = String(env.INSTAGRAM_OAUTH_BASE_URL ?? process.env.INSTAGRAM_OAUTH_BASE_URL ?? baseUrl).trim().replace(/\/+$/, "");
  const hasDatabase = Boolean(env.DB);
  const hasPrivateKv = Boolean(env.META_PRIVATE);

  const expected = META_ACTIVE_TARGETS.map(metaTargetLabel);
  const connected = new Set(accounts.map((item) => `${item.villa} ${item.platform}`));
  const activeConnected = expected.filter((item) => connected.has(item));

  return {
    graphApiVersion: "v26.0",
    configuration: {
      instagramAppId: Boolean(instagramAppId),
      instagramAppSecret: Boolean(instagramAppSecret),
      facebookAppId: Boolean(facebookAppId),
      facebookAppSecret: Boolean(facebookAppSecret),
      facebookConfigId: Boolean(facebookConfigId),
      baseUrl: Boolean(baseUrl),
      database: hasDatabase,
      privateKv: hasPrivateKv,
    },
    baseUrl,
    callbacks: {
      instagram: instagramOAuthBaseUrl ? `${instagramOAuthBaseUrl}/api/meta/instagram/callback` : "",
      facebook: baseUrl ? `${baseUrl}/api/meta/facebook/callback` : "",
    },
    requiredScopes: {
      instagram: ["instagram_business_basic", "instagram_business_content_publish"],
      facebook: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata"],
    },
    accounts: {
      connected: activeConnected.length,
      expected: expected.length,
      missing: expected.filter((item) => !connected.has(item)),
      hardBlocked: [{
        label: `${DESTAN_INSTAGRAM_HARD_BLOCK.villa} ${DESTAN_INSTAGRAM_HARD_BLOCK.platform}`,
        reason: DESTAN_INSTAGRAM_HARD_BLOCK.reason,
      }],
    },
  };
}
