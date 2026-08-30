import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const version = env.CF_VERSION_METADATA;
    const body = {
      service: "villa-yonetim",
      runtime: "cloudflare-workers",
      versionId: version?.id ?? null,
      versionTag: version?.tag ?? null,
      versionCreatedAt: version?.timestamp ?? null,
      appBaseUrl: env.APP_BASE_URL ?? null,
      checkedAt: new Date().toISOString(),
    };

    return Response.json(body, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...(version?.id ? { "X-Villa-Worker-Version": version.id } : {}),
      },
    });
  } catch {
    return Response.json({
      service: "villa-yonetim",
      runtime: "unknown",
      versionId: null,
      versionTag: null,
      versionCreatedAt: null,
      appBaseUrl: null,
      checkedAt: new Date().toISOString(),
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
