import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "./types";

export type MetaSocialAccount = {
  villa: Villa;
  platform: "Instagram";
  accountId: string;
  username: string;
  connectedAt: string;
};

type Row = {
  villa: Villa;
  platform: "Instagram";
  account_id: string;
  username: string;
  access_token: string;
  connected_at: string;
};

async function context() {
  return getCloudflareContext({ async: true });
}

async function ensureTable(db: D1Database) {
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

async function keyFromSecret(secret: string) {
  const bytes = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
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

function publicAccount(row: Row): MetaSocialAccount {
  return { villa: row.villa, platform: row.platform, accountId: row.account_id, username: row.username, connectedAt: row.connected_at };
}

export async function saveInstagramAccount(villa: Villa, accountId: string, username: string, accessToken: string) {
  const { env } = await context();
  if (!env.META_APP_SECRET) throw new Error("META_APP_SECRET tanımlı değil.");
  const db = env.DB;
  await ensureTable(db);
  const now = new Date().toISOString();
  const token = await encrypt(accessToken, env.META_APP_SECRET);
  await db.prepare(`INSERT INTO social_accounts (villa, platform, account_id, username, access_token, connected_at, updated_at)
    VALUES (?, 'Instagram', ?, ?, ?, ?, ?)
    ON CONFLICT(villa, platform) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
      access_token=excluded.access_token, connected_at=excluded.connected_at, updated_at=excluded.updated_at`)
    .bind(villa, accountId, username, token, now, now).run();
  return { villa, platform: "Instagram" as const, accountId, username, connectedAt: now };
}

export async function listMetaAccounts(): Promise<MetaSocialAccount[]> {
  const { env } = await context();
  const db = env.DB;
  await ensureTable(db);
  const result = await db.prepare("SELECT * FROM social_accounts ORDER BY villa, platform").all<Row>();
  return result.results.map(publicAccount);
}

export async function getInstagramCredentials(villa: Villa) {
  const { env } = await context();
  if (!env.META_APP_SECRET) throw new Error("META_APP_SECRET tanımlı değil.");
  const db = env.DB;
  await ensureTable(db);
  const row = await db.prepare("SELECT * FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).first<Row>();
  if (!row) return null;
  return { ...publicAccount(row), accessToken: await decrypt(row.access_token, env.META_APP_SECRET) };
}

export async function removeInstagramAccount(villa: Villa) {
  const { env } = await context();
  const db = env.DB;
  await ensureTable(db);
  await db.prepare("DELETE FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).run();
}
