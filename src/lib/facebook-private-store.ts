import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { KVNamespace } from "@cloudflare/workers-types";
import type { Villa } from "./types";

export type FacebookPageCandidate = {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
};

type SelectionPayload = {
  villa: Villa;
  pages: FacebookPageCandidate[];
  createdAt: string;
};

type TokenPayload = {
  pageId: string;
  accessToken: string;
  updatedAt: string;
};

async function env() {
  return (await getCloudflareContext({ async: true })).env;
}

async function privateKv(): Promise<KVNamespace> {
  const runtime = await env();
  if (!runtime.META_PRIVATE) throw new Error("META_PRIVATE KV binding tanımlı değil.");
  return runtime.META_PRIVATE;
}

async function cryptoKey() {
  const runtime = await env();
  if (!runtime.META_APP_SECRET) throw new Error("META_APP_SECRET tanımlı değil.");
  const bytes = new TextEncoder().encode(`villa-facebook-private-kv-v1:${runtime.META_APP_SECRET}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function unb64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptJson(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}

async function decryptJson<T>(value: string): Promise<T> {
  const [iv, data] = value.split(".");
  if (!iv || !data) throw new Error("Geçersiz private KV kaydı.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    await cryptoKey(),
    unb64(data),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export async function createFacebookSelection(villa: Villa, pages: FacebookPageCandidate[]) {
  const sessionId = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const payload: SelectionPayload = { villa, pages, createdAt: new Date().toISOString() };
  await (await privateKv()).put(`facebook:selection:${sessionId}`, await encryptJson(payload), { expirationTtl: 600 });
  return sessionId;
}

export async function readFacebookSelection(sessionId: string) {
  const value = await (await privateKv()).get(`facebook:selection:${sessionId}`);
  if (!value) return null;
  return decryptJson<SelectionPayload>(value);
}

export async function deleteFacebookSelection(sessionId: string) {
  await (await privateKv()).delete(`facebook:selection:${sessionId}`);
}

export async function saveFacebookPageToken(villa: Villa, pageId: string, accessToken: string) {
  const payload: TokenPayload = { pageId, accessToken, updatedAt: new Date().toISOString() };
  await (await privateKv()).put(`facebook:page-token:${villa}`, await encryptJson(payload));
}

export async function getFacebookPageToken(villa: Villa, expectedPageId: string) {
  const value = await (await privateKv()).get(`facebook:page-token:${villa}`);
  if (!value) return null;
  const payload = await decryptJson<TokenPayload>(value);
  if (payload.pageId !== expectedPageId) throw new Error("Facebook Page metadata/token eşleşmesi geçersiz.");
  return payload.accessToken;
}

export async function deleteFacebookPageToken(villa: Villa) {
  await (await privateKv()).delete(`facebook:page-token:${villa}`);
}
