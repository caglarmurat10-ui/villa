import { validateManagedInstagramMedia } from "@/lib/instagramMedia";
import {
  createScheduledInstagramPost,
  listScheduledInstagramPosts,
  parseScheduleRequestBody,
} from "@/lib/instagramSchedule";
import { getInstagramAccountFromEnv } from "@/lib/meta-store";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const items = await listScheduledInstagramPosts(env.DB);
    const accounts = new Map(
      await Promise.all(
        (["Destan", "Safira"] as const).map(
          async (villa) =>
            [villa, await getInstagramAccountFromEnv(env, villa)] as const,
        ),
      ),
    );
    return Response.json({
      items: items.map((item) => ({
        ...item,
        username: accounts.get(item.villa)?.username ?? null,
      })),
    });
  } catch {
    return Response.json(
      { error: "Planlanan yayınlar yüklenemedi." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const now = new Date();
    const input = parseScheduleRequestBody(await request.json(), now);
    const { env } = await getCloudflareContext({ async: true });

    const account = await getInstagramAccountFromEnv(env, input.villa);
    if (!account) {
      throw new Error(
        "Bu villa için bağlı Instagram hesabı bulunamadı. Önce hesabı bağlayın.",
      );
    }
    await validateManagedInstagramMedia(env, input, {
      scheduledAt: input.scheduledAt,
    });
    const item = await createScheduledInstagramPost(env.DB, input);
    if (!item) throw new Error("Planlı yayın kaydedilemedi.");

    return Response.json(
      { ok: true, item: { ...item, username: account.username } },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Planlı yayın kaydedilemedi.",
      },
      { status: 400 },
    );
  }
}
