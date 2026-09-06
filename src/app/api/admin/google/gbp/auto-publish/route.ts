import { runGbpPostCron } from "@/lib/gbp/schedule";

export const dynamic = "force-dynamic";

// Haftalık cron (custom-worker.mjs runGbpPostCronIfDue) tarafından in-process çağrılır - aynı
// desende src/app/api/social-growth/public-scout/run/route.ts. GBP konum eşleşmesi olmayan bir
// villa için sessizce SKIPPED döner, hiçbir dış isteğe çıkmaz.
export async function POST() {
  const results = await runGbpPostCron();
  return Response.json({ results });
}
