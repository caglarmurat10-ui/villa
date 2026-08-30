import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import {
  deleteFacebookPageToken,
  getFacebookPageToken,
  saveFacebookPageToken,
} from "./facebook-private-store";
import { refreshInstagramLongLivedToken } from "./meta";
import type { Villa } from "./types";

export type MetaSocialAccount = {
  villa: Villa;
  platform: "Instagram" | "Facebook";
  accountId: string;
  username: string;
  connectedAt: string;
  profileUrl?: string;
  tokenExpiresAt?: string;
};

type InstagramRow = {
  villa: Villa;
  platform: "Instagram";
  account_id: string;
  username: string;
  access_token: string;
  connected_at: string;
  updated_at: string;
  token_expires_at: string | null;
};

type FacebookRow = {
  villa: Villa;
  account_id: string;
  username: string;
  profile_url: string | null;
  connected_at: string;
  updated_at: string;
};

let tablesReady: Promise<void> | null = null;
const TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;

async function context() {
  return getCloudflareContext({ async: true });
}

async function prepareTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS social_accounts (
      villa TEXT NOT NULL CHECK (villa IN ('Safira','Destan')),
      platform TEXT NOT NULL CHECK (platform IN ('Instagram')),
      account_id TEXT NOT NULL,
      username TEXT NOT NULL,
      access_token TEXT NOT NULL,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      token_expires_at TEXT,
      PRIMARY KEY (villa, platform)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS facebook_account_metadata (
      villa TEXT PRIMARY KEY CHECK (villa IN ('Safira','Destan')),
      account_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      profile_url TEXT,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
  ]);
  try { await db.prepare("ALTER TABLE social_accounts ADD COLUMN token_expires_at TEXT").run(); } catch {}
}

async function ensureTables(db: D1Database) {
  if (!tablesReady) {
    tablesReady = prepareTables(db).catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

async function keyFromSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function encrypt(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFromSecret(secret);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string, secret: string) {
  const [ivPart, dataPart] = value.split(".");
  if (!ivPart || !dataPart) throw new Error("Geçersiz token kaydı.");
  const key = await keyFromSecret(secret);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivPart) }, key, fromBase64(dataPart));
  return new TextDecoder().decode(decrypted);
}

function expirationFromSeconds(expiresIn?: number | null) {
  if (!expiresIn || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function publicInstagramAccount(row: InstagramRow): MetaSocialAccount {
  return {
    villa: row.villa,
    platform: "Instagram",
    accountId: row.account_id,
    username: row.username,
    connectedAt: row.connected_at,
    tokenExpiresAt: row.token_expires_at ?? undefined,
  };
}

function publicFacebookAccount(row: FacebookRow): MetaSocialAccount {
  return {
    villa: row.villa,
    platform: "Facebook",
    accountId: row.account_id,
    username: row.username,
    connectedAt: row.connected_at,
    profileUrl: row.profile_url ?? undefined,
  };
}

export async function saveInstagramAccount(
  villa: Villa,
  accountId: string,
  username: string,
  accessToken: string,
  expiresIn?: number | null,
) {
  const { env } = await context();
  if (!env.META_APP_SECRET) throw new Error("META_APP_SECRET tanımlı değil.");
  const db = env.DB;
  await ensureTables(db);
  const now = new Date().toISOString();
  const token = await encrypt(accessToken, env.META_APP_SECRET);
  const tokenExpiresAt = expirationFromSeconds(expiresIn);
  await db.prepare(`INSERT INTO social_accounts
    (villa, platform, account_id, username, access_token, connected_at, updated_at, token_expires_at)
    VALUES (?, 'Instagram', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(villa, platform) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
      access_token=excluded.access_token, connected_at=excluded.connected_at, updated_at=excluded.updated_at,
      token_expires_at=excluded.token_expires_at`)
    .bind(villa, accountId, username, token, now, now, tokenExpiresAt).run();
  return { villa, platform: "Instagram" as const, accountId, username, connectedAt: now, tokenExpiresAt: tokenExpiresAt ?? undefined };
}

export async function saveFacebookAccount(
  villa: Villa,
  accountId: string,
  username: string,
  profileUrl: string,
  accessToken: string,
) {
  const { env } = await context();
  const db = env.DB;
  await ensureTables(db);

  const conflict = await db
    .prepare("SELECT villa FROM facebook_account_metadata WHERE account_id=? AND villa<>?")
    .bind(accountId, villa)
    .first<{ villa: Villa }>();
  if (conflict) {
    throw new Error(`Bu Facebook Sayfası zaten Villa ${conflict.villa} ile eşleştirilmiş.`);
  }

  const previous = await db
    .prepare("SELECT * FROM facebook_account_metadata WHERE villa=?")
    .bind(villa)
    .first<FacebookRow>();
  const previousToken = previous
    ? await getFacebookPageToken(villa, previous.account_id).catch(() => null)
    : null;

  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO facebook_account_metadata (villa, account_id, username, profile_url, connected_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(villa) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
      profile_url=excluded.profile_url, connected_at=excluded.connected_at, updated_at=excluded.updated_at`)
    .bind(villa, accountId, username, profileUrl, now, now).run();

  try {
    await saveFacebookPageToken(villa, accountId, accessToken);
  } catch (error) {
    if (previous) {
      await db.prepare(`INSERT INTO facebook_account_metadata (villa, account_id, username, profile_url, connected_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(villa) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
          profile_url=excluded.profile_url, connected_at=excluded.connected_at, updated_at=excluded.updated_at`)
        .bind(previous.villa, previous.account_id, previous.username, previous.profile_url, previous.connected_at, previous.updated_at)
        .run()
        .catch(() => undefined);
      if (previousToken) {
        await saveFacebookPageToken(villa, previous.account_id, previousToken).catch(() => undefined);
      }
    } else {
      await db.prepare("DELETE FROM facebook_account_metadata WHERE villa=?").bind(villa).run().catch(() => undefined);
      await deleteFacebookPageToken(villa).catch(() => undefined);
    }
    throw error;
  }

  return { villa, platform: "Facebook" as const, accountId, username, profileUrl, connectedAt: now };
}

export async function listMetaAccounts(): Promise<MetaSocialAccount[]> {
  const { env } = await context();
  const db = env.DB;
  await ensureTables(db);
  const [instagram, facebook] = await Promise.all([
    db.prepare("SELECT * FROM social_accounts ORDER BY villa, platform").all<InstagramRow>(),
    db.prepare("SELECT * FROM facebook_account_metadata ORDER BY villa").all<FacebookRow>(),
  ]);
  return [
    ...instagram.results.map(publicInstagramAccount),
    ...facebook.results.map(publicFacebookAccount),
  ].sort((a, b) => `${a.villa}-${a.platform}`.localeCompare(`${b.villa}-${b.platform}`));
}

export async function getInstagramCredentials(villa: Villa) {
  const { env } = await context();
  if (!env.META_APP_SECRET) throw new Error("META_APP_SECRET tanımlı değil.");
  const db = env.DB;
  await ensureTables(db);
  const row = await db.prepare("SELECT * FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).first<InstagramRow>();
  if (!row) return null;

  let accessToken = await decrypt(row.access_token, env.META_APP_SECRET);
  let tokenExpiresAt = row.token_expires_at;
  const nowMs = Date.now();
  const expiresMs = tokenExpiresAt ? Date.parse(tokenExpiresAt) : Number.NaN;
  const updatedMs = Date.parse(row.updated_at);

  if (Number.isFinite(expiresMs) && expiresMs <= nowMs) {
    throw new Error(`Villa ${villa} Instagram erişim anahtarının süresi dolmuş; hesabı yeniden bağlayın.`);
  }

  const nearExpiry = Number.isFinite(expiresMs) && expiresMs - nowMs <= TOKEN_REFRESH_WINDOW_MS;
  const oldEnoughToRefresh = Number.isFinite(updatedMs) && nowMs - updatedMs >= TOKEN_MIN_REFRESH_AGE_MS;

  if (nearExpiry && oldEnoughToRefresh) {
    try {
      const refreshed = await refreshInstagramLongLivedToken(accessToken);
      const encrypted = await encrypt(refreshed.accessToken, env.META_APP_SECRET);
      const refreshedExpiresAt = expirationFromSeconds(refreshed.expiresIn);
      const refreshedAt = new Date().toISOString();
      await db.prepare(`UPDATE social_accounts
        SET access_token=?, token_expires_at=?, updated_at=?
        WHERE villa=? AND platform='Instagram'`)
        .bind(encrypted, refreshedExpiresAt, refreshedAt, villa).run();
      accessToken = refreshed.accessToken;
      tokenExpiresAt = refreshedExpiresAt;
    } catch (error) {
      console.error(`[Instagram Token Refresh][${villa}] ${error instanceof Error ? error.message.slice(0, 240) : "Token yenileme başarısız."}`);
    }
  }

  return {
    ...publicInstagramAccount({ ...row, token_expires_at: tokenExpiresAt }),
    accessToken,
  };
}

export async function getFacebookCredentials(villa: Villa) {
  const { env } = await context();
  const db = env.DB;
  await ensureTables(db);
  const row = await db.prepare("SELECT * FROM facebook_account_metadata WHERE villa=?").bind(villa).first<FacebookRow>();
  if (!row) return null;
  const accessToken = await getFacebookPageToken(villa, row.account_id);
  if (!accessToken) throw new Error("Facebook Page tokenı private KV içinde bulunamadı; yeniden bağlayın.");
  return { ...publicFacebookAccount(row), accessToken };
}

export async function removeMetaAccount(villa: Villa, platform: "Instagram" | "Facebook") {
  const { env } = await context();
  const db = env.DB;
  await ensureTables(db);
  if (platform === "Facebook") {
    await deleteFacebookPageToken(villa);
    await db.prepare("DELETE FROM facebook_account_metadata WHERE villa=?").bind(villa).run();
  } else {
    await db.prepare("DELETE FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).run();
  }
}

export async function removeInstagramAccount(villa: Villa) {
  return removeMetaAccount(villa, "Instagram");
}
