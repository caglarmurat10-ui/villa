import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

export interface ContentLibrarySummary {
  autoSafePending: number;
  reviewRequired: number;
  blocked: number;
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

// social_content_library D1 tablosu - spreadsheet reconciliation'ının staging katmanı, social_posts
// operasyon tablosundan ve src/lib/social-content-library.ts'teki (JSON tabanlı, farklı/önceki bir
// içerik kaynağı) socialContentTemplates'ten TAMAMEN bağımsız. Bu yalnız admin panelinde gerçek
// automation_class dağılımını göstermek için.
export async function getContentLibrarySummary(): Promise<ContentLibrarySummary> {
  const db = await database();
  const rows = await db.prepare(
    "SELECT automation_class, COUNT(*) as n FROM social_content_library GROUP BY automation_class",
  ).all<{ automation_class: string; n: number }>();
  const summary: ContentLibrarySummary = { autoSafePending: 0, reviewRequired: 0, blocked: 0 };
  for (const row of rows.results ?? []) {
    if (row.automation_class === "AUTO_SAFE") summary.autoSafePending = row.n;
    else if (row.automation_class === "REVIEW_REQUIRED") summary.reviewRequired = row.n;
    else if (row.automation_class === "BLOCKED") summary.blocked = row.n;
  }
  return summary;
}
