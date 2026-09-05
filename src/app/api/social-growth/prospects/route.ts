import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createManualProspect, listProspects, type ProspectStatus } from "@/lib/social-growth-store";
import { computeScores } from "@/lib/social-growth-scoring";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

const PROSPECT_STATUSES: ProspectStatus[] = ["DISCOVERED", "WATCHLIST", "RECOMMENDED", "FOLLOWED_MANUALLY", "DISMISSED", "BLOCKED"];

function parseVilla(value: string | null): Villa | null {
  return value === "Safira" || value === "Destan" ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = parseVilla(url.searchParams.get("villa"));
  const discoveredOn = url.searchParams.get("discoveredOn") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam && (PROSPECT_STATUSES as string[]).includes(statusParam) ? [statusParam as ProspectStatus] : undefined;
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : undefined;

  const prospects = await listProspects({ villa, discoveredOn, statuses, limit });
  return Response.json({ prospects }, { headers: { "Cache-Control": "no-store" } });
}

const manualProspectSchema = z.object({
  platform: z.enum(["Instagram", "Facebook"]).default("Instagram"),
  username: z.string().trim().min(1, "Kullanıcı adı gerekli").max(60)
    .transform((value) => value.replace(/^@/, "").toLowerCase()),
  displayName: z.string().trim().max(120).optional().default(""),
  profileUrl: z.union([z.literal(""), z.string().url()]).optional().default(""),
  category: z.enum([
    "travel_creator", "local_creator", "tourism_page", "local_business",
    "photographer", "food_creator", "family_travel", "lifestyle_creator", "high_value_guest_source",
  ]),
  locationHint: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  villa: z.enum(["Safira", "Destan"]).nullable().optional().default(null),
});

export async function POST(request: Request) {
  const parsed = manualProspectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz hesap bilgisi." }, { status: 400 });
  const data = parsed.data;

  const scores = computeScores({
    category: data.category, username: data.username,
    bioSummary: data.notes || null, locationHint: data.locationHint || null, sourceUrl: data.profileUrl || null,
  });

  const now = new Date().toISOString();
  const result = await createManualProspect({
    villa: data.villa ?? null,
    platform: data.platform,
    username: data.username,
    accountId: null,
    displayName: data.displayName || null,
    profileUrl: data.profileUrl || (data.platform === "Instagram" ? `https://www.instagram.com/${data.username}/` : null),
    category: data.category,
    bioSummary: data.notes || null,
    followersCount: null,
    mediaCount: null,
    locationHint: data.locationHint || null,
    relevanceScore: scores.relevanceScore,
    engagementScore: null,
    locationScore: scores.locationScore,
    audienceFitScore: scores.audienceFitScore,
    spamRiskScore: scores.spamRiskScore,
    finalGrowthScore: scores.finalGrowthScore,
    discoveredAt: now,
    lastCheckedAt: now,
    sourceType: "manual_entry",
    sourceUrl: null,
    shortReason: data.notes || null,
  });

  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });

  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.DB.prepare(
      "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'SOCIAL_PROSPECT_ADDED', ?, ?)",
    ).bind(result.prospect.id, JSON.stringify({ username: data.username, platform: data.platform }), now).run();
  } catch {
    // Audit kaydı en iyi çaba - hesap ekleme işleminin kendisi zaten başarılı.
  }

  return Response.json({ prospect: result.prospect }, { status: 201 });
}
