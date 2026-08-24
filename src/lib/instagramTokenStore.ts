import { getCloudflareContext } from "@opennextjs/cloudflare";

type KVListResult = {
  keys: Array<{ name: string }>;
};

type KVLike = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<KVListResult>;
};

type TokenEnv = {
  SOCIAL_MEDIA_KV?: KVLike;
};

const PREFIX = "instagram-token-candidate:";

async function tokenHash(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function kv() {
  const { env } = await getCloudflareContext({ async: true });
  return (env as unknown as TokenEnv).SOCIAL_MEDIA_KV ?? null;
}

export async function storeInstagramTokenCandidate(accessToken: string) {
  const token = accessToken.trim();
  if (token.length < 20) {
    throw new Error("Instagram uzun ömürlü erişim anahtarı geçersiz.");
  }

  const store = await kv();
  if (!store) {
    throw new Error("SOCIAL_MEDIA_KV bağlantısı bulunamadı.");
  }

  const hash = await tokenHash(token);
  // Tokenı key, log veya hata mesajına koyma.
  // 70 gün: Instagram long-lived token ömründen biraz uzun temizlik penceresi.
  await store.put(`${PREFIX}${hash}`, token, { expirationTtl: 60 * 60 * 24 * 70 });
}

export async function getInstagramTokenCandidates() {
  const store = await kv();
  if (!store) return [] as string[];

  const result = await store.list({ prefix: PREFIX, limit: 30 });
  const values = await Promise.all(
    result.keys.map((entry) => store.get(entry.name)),
  );

  return Array.from(
    new Set(
      values
        .map((value) => value?.trim() ?? "")
        .filter((value) => value.length >= 20),
    ),
  );
}
