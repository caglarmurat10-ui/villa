import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateAndStorePackages, listPlatformPackages } from "@/lib/platform-content-packages";
import { ORGANIC_PLATFORMS } from "@/lib/platform-repurposing";

export const dynamic = "force-dynamic";

const generateSchema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  mediaFileId: z.string().trim().min(1),
  theme: z.string().trim().min(1).max(60),
  campaignId: z.string().trim().min(1).max(60),
  landingPath: z.string().trim().max(200).optional(),
});

export async function GET(request: NextRequest) {
  const villaParam = request.nextUrl.searchParams.get("villa");
  const platformParam = request.nextUrl.searchParams.get("platform");
  const villa = villaParam === "Safira" || villaParam === "Destan" ? villaParam : undefined;
  const platform = (ORGANIC_PLATFORMS as readonly string[]).includes(platformParam ?? "") ? (platformParam as (typeof ORGANIC_PLATFORMS)[number]) : undefined;
  const packages = await listPlatformPackages({ villa, platform });
  return NextResponse.json({ packages });
}

// Tek bir GERÇEK medyadan 5 platform paketi üretir - fail closed (property isolation, REAL_UPLOAD)
// zaten generateAndStorePackages() içinde uygulanır, burada yalnız istek doğrulaması var.
export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = generateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz istek." }, { status: 400 });
  }
  const result = await generateAndStorePackages(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ packages: result.packages }, { status: 201 });
}
