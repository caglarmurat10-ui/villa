import { ImageResponse } from "next/og";
import { isFormat, parseTemplateId, renderLocalEvent, renderTemplate, type Format } from "@/lib/social-design-templates";
import { getLocalEventCandidate } from "@/lib/local-events";
import { getSpecialDayForDate } from "@/lib/special-days";

export const runtime = "nodejs";

const EVENT_DATE_FMT = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long" });
function eventDateLabel(startIso: string, endIso: string | null): string {
  const start = EVENT_DATE_FMT.format(new Date(`${startIso}T00:00:00Z`));
  if (!endIso || endIso === startIso) return start;
  return `${start} – ${EVENT_DATE_FMT.format(new Date(`${endIso}T00:00:00Z`))}`;
}

function renderNeutralFriday(format: Format, message: string): Response {
  const dimensions = format === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1350 };
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#061a33", color: "#f4e1b4", padding: 76, fontFamily: "serif" }}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: format === "story" ? 60 : 20 }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 24, letterSpacing: 8, color: "#d8b36a" }}>CUMA MESAJI</div>
        <div style={{ width: 90, height: 3, background: "#d8b36a", margin: "28px 0 34px" }} />
        <div style={{ fontSize: 66, lineHeight: 1.12, fontWeight: 500, color: "#f4e1b4" }}>Hayırlı Cumalar</div>
        <div style={{ fontFamily: "sans-serif", fontSize: 27, lineHeight: 1.6, color: "#c9b98e", marginTop: 40, maxWidth: dimensions.width - 152 }}>{message}</div>
      </div>
    </div>,
    dimensions,
  );
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

  // Cuma paylaşımı iki villa hesabında yayınlansa da içerik marka/villa bağlantısından bağımsızdır.
  // Bu nedenle public Meta görselinde Villa Safira / Villa Destan footer'ı kullanılmaz. D1'deki
  // villa alanı yalnız hangi sosyal hesaba gönderileceğini seçmeye devam eder; görünür içeriğe
  // taşınmaz. Resmi/dini özel günler mevcut markalı özel-gün tasarımını korur.
  if (parsed.type === "special-day") {
    const match = getSpecialDayForDate(parsed.key);
    if (match?.kind === "friday") {
      const response = renderNeutralFriday(format, match.message);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(response.body, { status: response.status, headers });
    }
  }

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