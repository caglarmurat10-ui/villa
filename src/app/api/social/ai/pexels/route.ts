import { requireAiAdmin } from "@/lib/aiAdminSession";
import { hasAiAdminConfiguration, hasPexelsConfiguration, integrationUnavailableResponse } from "@/lib/aiConfiguration";
import { importPexelsMedia, searchPexels } from "@/lib/pexels";
import { socialOperationsDb } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";
const isVilla = (value: unknown): value is Villa => value === "Destan" || value === "Safira";
const isKind = (value: unknown): value is "photo" | "video" => value === "photo" || value === "video";
export async function GET(request: Request) {
  try {
    const { env } = await socialOperationsDb();
    if (!hasPexelsConfiguration(env)) return integrationUnavailableResponse("pexels");
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    const url = new URL(request.url); const kind = url.searchParams.get("kind"); const query = url.searchParams.get("query") ?? "";
    if (!isKind(kind)) throw new Error("Pexels medya türü geçersiz.");
    if (!(await requireAiAdmin(request, env))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    return Response.json({ items: await searchPexels(env, { query, kind }) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Pexels araması tamamlanamadı." }, { status: 400 }); }
}
export async function POST(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasPexelsConfiguration(env)) return integrationUnavailableResponse("pexels");
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    const body = await request.json() as Record<string, unknown>;
    if (!isVilla(body.villa) || !isKind(body.kind) || typeof body.id !== "string" || typeof body.query !== "string") throw new Error("Pexels içe aktarma bilgileri geçersiz.");
    if (!(await requireAiAdmin(request, env, true))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    return Response.json(await importPexelsMedia({ db, env, villa: body.villa, kind: body.kind, id: body.id, query: body.query }), { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Pexels medyası eklenemedi." }, { status: 400 }); }
}
