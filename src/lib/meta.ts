export async function metaConfig() {
  const { env } = await getCloudflareContext({ async: true });

  const appId =
    env.META_APP_ID ||
    process.env.META_APP_ID;

  const appSecret =
    env.META_APP_SECRET ||
    process.env.META_APP_SECRET;

  const baseUrl =
    env.APP_BASE_URL ||
    process.env.APP_BASE_URL;

  const missing = [
    !appId ? "META_APP_ID" : null,
    !appSecret ? "META_APP_SECRET" : null,
    !baseUrl ? "APP_BASE_URL" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Eksik ortam değişkenleri: ${missing.join(", ")}`);
  }

  return {
    appId,
    appSecret,
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}
