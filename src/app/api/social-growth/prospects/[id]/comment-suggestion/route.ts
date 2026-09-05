import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getProspect, createOpportunity } from "@/lib/social-growth-store";
import { generateCommentSuggestion } from "@/lib/social-growth-comment-suggestions";

// Yalnız bir METİN ÖNERİSİ üretir ve social_engagement_opportunities'e kaydeder. Hiçbir Graph
// API/Instagram isteği atmaz, üçüncü taraf içeriğe hiçbir şey GÖNDERMEZ - kullanıcı isterse
// Instagram'da elle paylaşır. Bu yüzden riskClassification her zaman REVIEW_REQUIRED.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const prospect = await getProspect(id);
  if (!prospect) return Response.json({ error: "Hesap bulunamadı." }, { status: 404 });

  const { suggestedComment, riskClassification } = generateCommentSuggestion({
    category: prospect.category,
    locationHint: prospect.locationHint,
  });

  const opportunity = await createOpportunity({
    villa: prospect.villa,
    prospectId: prospect.id,
    targetUsername: prospect.username,
    mediaLink: prospect.profileUrl,
    context: prospect.shortReason ?? `${prospect.category} kategorisinde, ${prospect.locationHint ?? "belirsiz konum"} ile ilişkili hesap.`,
    suggestedComment,
    riskClassification,
  });

  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.DB.prepare(
      "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'SOCIAL_COMMENT_SUGGESTION_GENERATED', ?, ?)",
    ).bind(prospect.id, JSON.stringify({ opportunityId: opportunity.id }), new Date().toISOString()).run();
  } catch {
    // Audit kaydı en iyi çaba.
  }

  return Response.json({ opportunity }, { status: 201 });
}
