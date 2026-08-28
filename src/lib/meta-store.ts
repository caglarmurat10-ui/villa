import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import {
  deleteFacebookPageToken,
  getFacebookPageToken,
  saveFacebookPageToken,
} from "./facebook-private-store";
import type { Villa } from "./types";

export type MetaSocialAccount = {
  villa: Villa;
  platform: "Instagram" | "Facebook";
  accountId: string;
  username: string;
  connectedAt: string;
  profileUrl?: string;
};

type InstagramRow = {
  villa: Villa;
  platform: "Instagram";
  account_id: string;
  username: string;
  access_token: string;
  connected_at: string;
};

type FacebookRow = {
  villa: Villa;
  account_id: string;
  username: string;
  profile_url: string | null;
  connected_at: string;
};

async function context() {
  return getCloudflareContext({ async: true });
}

async function ensureInstagramTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS social_accounts (
    villa TEXT NOT NULL CHECK (villa IN ('Safira','Destan')),
    platform TEXT NOT NULL CHECK (platform IN ('Instagram')),
    account_id TEXT NOT NULL,
    username TEXT NOT NULL,
    access_token TEXT NOT NULL,
    connected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (villa, platform)
  )`).run();
}

async function ensureFacebookTable(db: D1Database) {
  // Security migration: the legacy table contained Facebook Page tokens in D1.
  // Drop it rather than carrying any secret value forward.
  await db.prepare("DROP TABLE IF EXISTS facebook_accounts").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS facebook_account_metadata (
    villa TEXT PRIMARY KEY CHECK (villa IN ('Safira','Destan')),
    account_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    profile_url TEXT,
    connected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

async function ensureTables(db: D1Database) {
  await ensureInstagramTable(db);
  await ensureFacebookTable(db);
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

function publicInstagramAccount(row: InstagramRow): MetaSocialAccount {
  return { villa: row.villa, platform: "Instagram", accountId: row.account_id, username: row.username, connectedAt: row.connected_at };
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

export async function saveInstagramAccount(villa: Villa, accountId: string, username: string, accessToken: string) {
  const { env } = await context();
  if (!env.META_APP_SECRET) throw new Error("META_APP_SECRET tanımlı değil.");
  const db = env.DB;
  await ensureTables(db);
  const now = new Date().toISOString();
  const token = await encrypt(accessToken, env.META_APP_SECRET);
  await db.prepare(`INSERT INTO social_accounts (villa, platform, account_id, username, access_token, connected_at, updated_at)
    VALUES (?, 'Instagram', ?, ?, ?, ?, ?)
    ON CONFLICT(villa, platform) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
      access_token=excluded.access_token, connected_at=excluded.connected_at, updated_at=excluded.updated_at`)
    .bind(villa, accountId, username, token, now, now).run();
  return { villa, platform: "Instagram" as const, accountId, username, connectedAt: now };
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
  let previousToken: string | null = null;
  if (previous) {
    previousToken = await getFacebookPageToken(villa, previous.account_id).catch(() => null);
  }

  const now = new Date().toISOString();
  await saveFacebookPageToken(villa, accountId, accessToken);
  try {
    await db.prepare(`INSERT INTO facebook_account_metadata (villa, account_id, username, profile_url, connected_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(villa) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
        profile_url=excluded.profile_url, connected_at=excluded.connected_at, updated_at=excluded.updated_at`)
      .bind(villa, accountId, username, profileUrl, now, now).run();
  } catch (error) {
    if (previous && previousToken) {
      await saveFacebookPageToken(villa, previous.account_id, previousToken).catch(() => undefined);
    } else {
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
  return { ...publicInstagramAccount(row), accessToken: await decrypt(row.access_token, env.META_APP_SECRET) };
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
    await db.prepare("DELETE FROM facebook_account_metadata WHERE villa=?").bind(villa).run();
    await deleteFacebookPageToken(villa);
  } else {
    await db.prepare("DELETE FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).run();
  }
}

export async function removeInstagramAccount(villa: Villa) {
  return removeMetaAccount(villa, "Instagram");
}
