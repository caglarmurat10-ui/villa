import { NextResponse } from "next/server";
import { markPackageManuallyPublished } from "@/lib/platform-content-packages";

export const dynamic = "force-dynamic";

// Manuel yayın onayı - insan gerçekten paylaştığını bildirir. Sağlayıcı (API) yayın kimliği bu
// yolla ASLA yazılmaz (bkz. migrations/0027 üstündeki not) - yalnız manually_published_at dolar.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const updated = await markPackageManuallyPublished(id);
  if (!updated) return NextResponse.json({ error: "Paket bulunamadı veya zaten manuel olarak yayınlandı." }, { status: 404 });
  return NextResponse.json({ package: updated });
}
