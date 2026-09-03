import {
  isVilla, isTemplateType, isFormat,
  renderDestinationOrActivity, renderTravelTip, renderVillaLifestyle, renderOfferCampaign,
  type Format,
} from "@/lib/social-design-templates";

export const runtime = "nodejs";

// FAZ 5 bölüm 4 - admin-korumalı önizleme rotası (adminAuthGate arkasında, admin.safiradestan.com
// oturumu gerektirir). Gerçek render mantığı src/lib/social-design-templates.tsx'te - public,
// kimliksiz yayın rotasıyla (src/app/api/public/social-assets/[id]/[format]/route.tsx) AYNI kaynak.
export async function GET(request: Request, context: { params: Promise<{ villa: string; type: string }> }) {
  const { villa, type } = await context.params;
  if (!isVilla(villa)) return new Response("Villa bulunamadı.", { status: 404 });
  if (!isTemplateType(type)) return new Response("Şablon türü bulunamadı.", { status: 404 });

  const url = new URL(request.url);
  const formatParam = url.searchParams.get("format") ?? "feed";
  const format: Format = isFormat(formatParam) ? formatParam : "feed";

  if (type === "destination") {
    const response = renderDestinationOrActivity(villa, format, url.searchParams.get("placeId") ?? "", "BÖLGE REHBERİ");
    return response ?? new Response("Rehber yeri bulunamadı.", { status: 404 });
  }
  if (type === "activity") {
    const response = renderDestinationOrActivity(villa, format, url.searchParams.get("placeId") ?? "", "AKTİVİTE ÖNERİSİ");
    return response ?? new Response("Rehber yeri bulunamadı.", { status: 404 });
  }
  if (type === "villa-lifestyle") return renderVillaLifestyle(villa, format);
  if (type === "travel-tip") {
    const tipIndex = Number.parseInt(url.searchParams.get("tip") ?? "0", 10) || 0;
    const response = renderTravelTip(villa, format, tipIndex);
    return response ?? new Response("İpucu bulunamadı.", { status: 404 });
  }
  if (type === "offer") return renderOfferCampaign(villa, format);

  return new Response("Şablon türü bulunamadı.", { status: 404 });
}
