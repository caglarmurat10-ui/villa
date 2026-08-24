import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "@/lib/types";

const TOKEN_PREFIX = "instagram-token:";
export const INSTAGRAM_MEDIA_PREFIX = "instagram-media/";
const TOKEN_EXPIRATION_SECONDS = 60 * 60 * 24 * 70;

type EncryptedToken = {
  version: 1;
  iv: string;
  ciphertext: string;
};

function accountTokenKey(villa: Villa, accountId: string) {
  const normalized = accountId.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    throw new Error("Instagram hesap kimliği geçersiz.");
  }
  return `${TOKEN_PREFIX}villa:${villa}:account:${normalized}`;
}

export async function getSocialMediaKv() {
  const { env } = await getCloudflareContext({ async: true });
  const store = env.SOCIAL_MEDIA_KV;

  if (!store) {
    throw new Error("SOCIAL_MEDIA_KV bağlantısı bulunamadı.");
  }

  return store;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string) {
  const source = new TextEncoder().encode(
    `instagram-token-kv-v1\u0000${secret}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", source);
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  );
  return JSON.stringify({
    version: 1,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  } satisfies EncryptedToken);
}

async function decryptToken(value: string, secret: string) {
  const parsed = JSON.parse(value) as Partial<EncryptedToken>;
  if (
    parsed.version !== 1 ||
    typeof parsed.iv !== "string" ||
    typeof parsed.ciphertext !== "string"
  ) {
    return null;
  }

  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(parsed.iv) },
    key,
    fromBase64(parsed.ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

async function tokenStorage() {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.META_APP_SECRET) {
    throw new Error("META_APP_SECRET tanımlı değil.");
  }
  return {
    store: await getSocialMediaKv(),
    secret: env.META_APP_SECRET,
  };
}

export async function storeInstagramAccessToken(
  villa: Villa,
  accountId: string,
  accessToken: string,
) {
  const token = accessToken.trim();
  if (token.length < 20) {
    throw new Error("Instagram uzun ömürlü erişim anahtarı geçersiz.");
  }

  const { store, secret } = await tokenStorage();
  await store.put(accountTokenKey(villa, accountId), await encryptToken(token, secret), {
    expirationTtl: TOKEN_EXPIRATION_SECONDS,
  });
}

export async function getInstagramAccessToken(villa: Villa, accountId: string) {
  const { store, secret } = await tokenStorage();
  const value = await store.get(accountTokenKey(villa, accountId));
  if (!value) return null;

  let token = "";
  try {
    token = (await decryptToken(value, secret))?.trim() ?? "";
  } catch {
    return null;
  }
  return token.length >= 20 ? token : null;
}

export async function deleteInstagramAccessToken(
  villa: Villa,
  accountId: string,
) {
  const store = await getSocialMediaKv();
  await store.delete(accountTokenKey(villa, accountId));
}
