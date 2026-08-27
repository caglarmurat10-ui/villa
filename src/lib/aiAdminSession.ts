import { requireAiAdminKey } from "./aiConfiguration";

const COOKIE_NAME = "social_ai_admin";
const SESSION_SECONDS = 8 * 60 * 60;

function cookieValue(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(`social-ai-admin-v1\0${secret}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function signature(expires: string, secret: string) {
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(expires))));
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function createAiAdminCookie(env: CloudflareEnv) {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const token = `${expires}.${await signature(expires, requireAiAdminKey(env))}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export async function verifyAiAdminKey(candidate: string, env: CloudflareEnv) {
  return constantTimeEqual(candidate, requireAiAdminKey(env));
}

export async function hasAiAdminSession(request: Request, env: CloudflareEnv) {
  const token = cookieValue(request.headers.get("cookie"), COOKIE_NAME);
  if (!token) return false;
  const [expires, provided, extra] = token.split(".");
  if (!expires || !provided || extra || !/^\d{10}$/.test(expires) || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(provided, await signature(expires, requireAiAdminKey(env)));
}

export async function requireAiAdmin(request: Request, env: CloudflareEnv, write = false) {
  if (write && !sameOrigin(request)) return false;
  try { return await hasAiAdminSession(request, env); }
  catch { return false; }
}

export const clearAiAdminCookie = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
