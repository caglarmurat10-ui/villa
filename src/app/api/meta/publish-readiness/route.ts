import { getInstagramProfile, getInstagramPublishingLimit } from "@/lib/meta";
import { getFacebookCredentials, getInstagramCredentials } from "@/lib/meta-store";
import { listSocialPosts } from "@/lib/social-db";
import { socialDriveMedia } from "@/lib/social-drive-media";
import { DESTAN_INSTAGRAM_HARD_BLOCK, META_ACTIVE_TARGETS } from "@/lib/social-account-policy";

const FACEBOOK_GRAPH = "https://graph.facebook.com/v26.0";

export const dynamic = "force-dynamic";

async function facebookCore(pageId: string, accessToken: string) {
  const url = new URL(`${FACEBOOK_GRAPH}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    error?: { code?: number };
  };
  if (!response.ok || payload.id !== pageId) {
    throw new Error(`Facebook Page doğrulaması başarısız (HTTP ${response.status}${payload.error?.code ? ` / ${payload.error.code}` : ""}).`);
  }
  return { id: payload.id, name: payload.name ?? "Facebook Sayfası" };
}

function safeMessage(error: unknown) {
  const message = error instanceof Error && error.message ? error.message : "Meta doğrulaması başarısız.";
  return message
    .replace(/(access_token|client_secret|authorization_code|short_lived_token|long_lived_token|code|fb_exchange_token)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 300);
}

export async function GET() {
  const posts = await listSocialPosts(100);

  const checks = await Promise.all(META_ACTIVE_TARGETS.map(async ({ villa, platform }) => {
    const media = socialDriveMedia.filter((asset) => asset.villa === villa);
    const readyPosts = posts.filter((post) =>
      post.villa === villa &&
      post.platform === platform &&
      post.status === "Planlandı" &&
      post.approvalStatus === "Onaylandı" &&
      (platform !== "Facebook" || post.contentType !== "Hikâye"),
    ).length;
    const imageAssets = media.filter((asset) => asset.mediaKind === "image").length;
    const videoAssets = media.filter((asset) => asset.mediaKind === "video").length;

    if (platform === "Instagram") {
      try {
        const account = await getInstagramCredentials(villa);
        if (!account) throw new Error(`Villa ${villa} Instagram hesabı bağlı değil.`);
        const profile = await getInstagramProfile(account.accessToken);
        if (profile.id !== account.accountId) throw new Error("Instagram hesap kimliği değişmiş.");

        let quota: Awaited<ReturnType<typeof getInstagramPublishingLimit>> | null = null;
        try { quota = await getInstagramPublishingLimit(account.accountId, account.accessToken); } catch {}

        return {
          villa,
          platform,
          ready: true,
          account: `@${profile.username}`,
          readyPosts,
          imageAssets,
          videoAssets,
          quota,
          capabilities: ["Tek görsel", "Carousel", "Reels", "Hikâye"],
        };
      } catch (error) {
        return {
          villa,
          platform,
          ready: false,
          readyPosts,
          imageAssets,
          videoAssets,
          error: safeMessage(error),
          capabilities: ["Tek görsel", "Carousel", "Reels", "Hikâye"],
        };
      }
    }

    try {
      const account = await getFacebookCredentials(villa);
      if (!account) throw new Error(`Villa ${villa} Facebook Sayfası bağlı değil.`);
      const profile = await facebookCore(account.accountId, account.accessToken);
      return {
        villa,
        platform,
        ready: true,
        account: profile.name,
        readyPosts,
        imageAssets,
        videoAssets,
        capabilities: ["Tek görsel", "Fotoğraf Carousel", "Reels"],
        manualOnly: ["Hikâye"],
      };
    } catch (error) {
      return {
        villa,
        platform,
        ready: false,
        readyPosts,
        imageAssets,
        videoAssets,
        error: safeMessage(error),
        capabilities: ["Tek görsel", "Fotoğraf Carousel", "Reels"],
        manualOnly: ["Hikâye"],
      };
    }
  }));

  const mediaReady = checks.every((check) => check.imageAssets > 0 && check.videoAssets > 0);
  const accountsReady = checks.every((check) => check.ready);

  return Response.json({
    checkedAt: new Date().toISOString(),
    ready: accountsReady && mediaReady,
    accountsReady,
    mediaReady,
    blocked: [{
      villa: DESTAN_INSTAGRAM_HARD_BLOCK.villa,
      platform: DESTAN_INSTAGRAM_HARD_BLOCK.platform,
      reason: DESTAN_INSTAGRAM_HARD_BLOCK.reason,
    }],
    checks,
  }, { headers: { "Cache-Control": "no-store" } });
}
