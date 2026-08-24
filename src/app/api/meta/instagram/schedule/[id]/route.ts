import { extendScheduledInstagramMediaLifetime } from "@/lib/instagramMedia";
import {
  cancelScheduledInstagramPost,
  getScheduledInstagramPost,
  updateScheduledInstagramPost,
} from "@/lib/instagramSchedule";
import {
  INSTAGRAM_TIMEZONE,
  validateScheduledDate,
} from "@/lib/instagramTime";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function validId(id: string) {
  return /^[A-Za-z0-9-]{1,80}$/.test(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Planlı yayın kimliği geçersiz.");
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("Düzenleme isteği geçersiz.");
    if (typeof body.caption !== "string" || body.caption.length > 2200) {
      throw new Error("Paylaşım metni en fazla 2200 karakter olabilir.");
    }
    if (typeof body.scheduledAt !== "string") {
      throw new Error("Planlama tarihi ve saati gerekli.");
    }
    if (body.timezone !== INSTAGRAM_TIMEZONE) {
      throw new Error("Planlama saat dilimi Europe/Istanbul olmalı.");
    }

    const now = new Date();
    const scheduledAt = validateScheduledDate(
      body.scheduledAt,
      body.timezone,
      now,
    );
    const { env } = await getCloudflareContext({ async: true });
    const current = await getScheduledInstagramPost(env.DB, id);
    if (!current) throw new Error("Planlı yayın bulunamadı.");
    if (current.status !== "scheduled" && current.status !== "failed") {
      throw new Error("Bu kayıt artık düzenlenemez.");
    }

    await extendScheduledInstagramMediaLifetime(
      env,
      current.mediaUrls,
      scheduledAt,
      now,
    );
    const item = await updateScheduledInstagramPost(env.DB, id, {
      caption: body.caption,
      scheduledAt,
      timezone: body.timezone,
    });
    if (!item) throw new Error("Planlı yayın güncellenemedi.");
    return Response.json({ ok: true, item });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Planlı yayın güncellenemedi.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!validId(id)) throw new Error("Planlı yayın kimliği geçersiz.");
    const { env } = await getCloudflareContext({ async: true });
    const cancelled = await cancelScheduledInstagramPost(env.DB, id);
    if (!cancelled) {
      throw new Error("Kayıt bulunamadı veya artık iptal edilemez.");
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Planlı yayın iptal edilemedi.",
      },
      { status: 400 },
    );
  }
}
