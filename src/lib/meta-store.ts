import {
  deleteInstagramAccessToken,
  storeInstagramAccessToken,
} from "@/lib/instagramTokenStore";
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

const TOKEN_REFERENCE = "stored-encrypted-in-workers-kv";

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

function publicAccount(row: Row): MetaSocialAccount {
  return { villa: row.villa, platform: row.platform, accountId: row.account_id, username: row.username, connectedAt: row.connected_at };
}

export async function saveInstagramAccount(
  villa: Villa,
  accountId: string,
  username: string,
  accessToken: string,
) {
  const { env } = await context();
  const db = env.DB;
  await ensureTable(db);

  // Profil doğrulamasından geçen long-lived token yalnızca şifreli KV kaydıdır.
  await storeInstagramAccessToken(villa, accountId, accessToken);

  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO social_accounts (villa, platform, account_id, username, access_token, connected_at, updated_at)
    VALUES (?, 'Instagram', ?, ?, ?, ?, ?)
    ON CONFLICT(villa, platform) DO UPDATE SET account_id=excluded.account_id, username=excluded.username,
      access_token=excluded.access_token, connected_at=excluded.connected_at, updated_at=excluded.updated_at`)
    .bind(villa, accountId, username, TOKEN_REFERENCE, now, now).run();
  return { villa, platform: "Instagram" as const, accountId, username, connectedAt: now };
}

export async function listMetaAccounts(): Promise<MetaSocialAccount[]> {
  const { env } = await context();
  const db = env.DB;
  await ensureTable(db);
  const result = await db.prepare("SELECT * FROM social_accounts ORDER BY villa, platform").all<Row>();
  return result.results.map(publicAccount);
}

export async function getInstagramAccount(villa: Villa) {
  const { env } = await context();
  return getInstagramAccountFromEnv(env, villa);
}

export async function getInstagramAccountFromEnv(
  env: CloudflareEnv,
  villa: Villa,
) {
  const db = env.DB;
  await ensureTable(db);
  const row = await db.prepare("SELECT * FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).first<Row>();
  return row ? publicAccount(row) : null;
}

export async function removeInstagramAccount(villa: Villa) {
  const { env } = await context();
  const db = env.DB;
  await ensureTable(db);
  const row = await db.prepare("SELECT * FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).first<Row>();
  if (!row) return;
  await deleteInstagramAccessToken(villa, row.account_id);
  await db.prepare("DELETE FROM social_accounts WHERE villa=? AND platform='Instagram'").bind(villa).run();
}
