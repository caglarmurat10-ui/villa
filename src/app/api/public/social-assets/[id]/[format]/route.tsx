import { isFormat, parseTemplateId, renderLocalEvent, renderTemplate, type Format } from "@/lib/social-design-templates";
import { getLocalEventCandidate } from "@/lib/local-events";

export const runtime = "nodejs";

const EVENT_DATE_FMT = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long" });
function eventDateLabel(startIso: string, endIso: string | null): string {
  const start = EVENT_DATE_FMT.format(new Date(`${startIso}T00:00:00Z`));
  if (!endIso || endIso === startIso) return start;
  return `${start} – ${EVENT_DATE_FMT.format(new Date(`${endIso}T00:00:00Z`))}`;
}

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

  // LOCAL EVENT - içerik D1'deki admin-onaylı aday kaydına dayanır (bkz. local-events.ts), bu
  // yüzden diğer TÜM tiplerin aksine burada bir D1 okuması var. Yalnız status IN
  // ('approved','published') olan bir kayıt render edilir - pending_review/rejected bir aday
  // (henüz insan tarafından doğrulanmamış/reddedilmiş) hiçbir zaman görsele dönüşmez.
  if (parsed.type === "local-event") {
    const candidate = await getLocalEventCandidate(parsed.key);
    if (!candidate || (candidate.status !== "approved" && candidate.status !== "published")) {
      return new Response("Şablon bulunamadı.", { status: 404 });
    }
    const response = renderLocalEvent(parsed.villa, format, candidate.title, eventDateLabel(candidate.eventDate, candidate.eventDateEnd), candidate.venue);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=600");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, headers });
  }

  const response = renderTemplate(parsed, format);
  if (!response) return new Response("Şablon bulunamadı.", { status: 404 });

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, headers });
}
