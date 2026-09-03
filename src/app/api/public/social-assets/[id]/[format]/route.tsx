import { isFormat, parseTemplateId, renderTemplate, type Format } from "@/lib/social-design-templates";

export const runtime = "nodejs";

// FAZ 5 bölüm 9 - Meta/Facebook'un Graph API'sinin, oturum çerezi OLMADAN kendi sunucularından
// indirebileceği public medya rotası (bkz. /api/media/drive/[fileId] ile AYNI, zaten kanıtlanmış
// desen - custom-worker.mjs adminAuthGate() içinde bu path prefix'i AYNI şekilde admin oturumundan
// muaf tutulur). Meta'ya admin-korumalı önizleme URL'si ASLA verilmez (401 alır) - yalnız bu rota.
//
// GÜVENLİK:
//  - [id] yalnız parseTemplateId() ile üç sabit bileşene (villa/type/key) ayrıştırılır, HER biri
//    gerçek/sabit bir listeye (Villa enum, TemplateType enum, GUIDE_PLACES/EVERGREEN_TIPS) karşı
//    doğrulanır - serbest metin/başlık render edilmez, tanınmayan bir id her zaman 404 döner.
//  - Yalnız GET/HEAD (Next.js route handler'ı zaten yalnız export edilen metodları kabul eder -
//    burada POST/PUT/DELETE export edilmediği için Next.js otomatik 405 döner).
//  - Hiçbir secret/token/query param'dan gelen serbest içerik render'a karışmaz.
//  - Yanıt immutable/cache-safe (aynı [id]/[format] her zaman aynı görüntüyü üretir).
export async function GET(_request: Request, context: { params: Promise<{ id: string; format: string }> }) {
  const { id, format: formatParam } = await context.params;
  if (!isFormat(formatParam)) return new Response("Format bulunamadı.", { status: 404 });
  const format: Format = formatParam;

  const parsed = parseTemplateId(id);
  if (!parsed) return new Response("Şablon bulunamadı.", { status: 404 });

  const response = renderTemplate(parsed, format);
  if (!response) return new Response("Şablon bulunamadı.", { status: 404 });

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, headers });
}
