import { listSocialPosts } from "@/lib/social-db";
import { getPostAutomationClasses } from "@/lib/social-library-summary";

export const dynamic = "force-dynamic";

// Read-only - hiçbir publish/approve mutation'ı yok (talimat: "ilk sürümde riskli publish/mutation
// yerine read + güvenli mevcut aksiyonları tercih et"). Destan Instagram burada da açıkça
// işaretleniyor, unblock için hiçbir aksiyon yok.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");

  const [posts, automationClasses] = await Promise.all([listSocialPosts(100), getPostAutomationClasses()]);

  const filtered = villa === "Safira" || villa === "Destan" ? posts.filter((p) => p.villa === villa) : posts;

  return Response.json({
    posts: filtered.map((p) => ({
      id: p.id,
      villa: p.villa,
      platform: p.platform,
      contentType: p.contentType,
      caption: p.caption,
      mediaUrl: p.mediaUrl,
      scheduledDate: p.scheduledDate,
      scheduledTime: p.scheduledTime ?? null,
      status: p.status,
      approvalStatus: p.approvalStatus,
      lastPublishError: p.lastPublishError,
      platformPostId: p.platformPostId,
      automationClass: automationClasses[p.id] ?? null,
      destanInstagramHardBlocked: p.villa === "Destan" && p.platform === "Instagram",
    })),
  });
}
