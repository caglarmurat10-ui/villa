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
  const isStory = format === "story";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "serif",
        background: "linear-gradient(180deg,#f4dfc2 0%,#f8c884 38%,#ef9650 67%,#6d493d 100%)",
        color: "#3d281d",
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(circle at 50% 65%, rgba(255,241,182,.75) 0%, rgba(255,190,95,.18) 28%, rgba(80,39,29,.08) 72%)" }} />

      {/* İnce İslami geometrik doku - yalnız dekoratif, marka içermez. */}
      <div style={{ position: "absolute", right: -90, top: -70, width: 390, height: 390, border: "3px solid rgba(255,247,223,.30)", transform: "rotate(45deg)", display: "flex" }} />
      <div style={{ position: "absolute", right: 18, top: 10, width: 230, height: 230, border: "2px solid rgba(255,247,223,.25)", transform: "rotate(45deg)", display: "flex" }} />
      <div style={{ position: "absolute", left: 55, top: 70, width: 4, height: isStory ? 520 : 365, background: "rgba(105,63,41,.22)", display: "flex" }} />
      <div style={{ position: "absolute", left: 55, top: 70, width: 220, height: 4, background: "rgba(105,63,41,.22)", display: "flex" }} />

      {/* Ana mesaj. */}
      <div
        style={{
          position: "absolute",
          left: 100,
          right: 100,
          top: isStory ? 300 : 170,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "sans-serif", fontSize: 22, letterSpacing: 8, color: "#8b5a38", display: "flex" }}>CUMA MESAJI</div>
        <div style={{ marginTop: 24, fontSize: isStory ? 100 : 86, lineHeight: 1.03, fontWeight: 500, letterSpacing: -2, display: "flex" }}>Hayırlı Cumalar</div>
        <div style={{ width: 240, height: 2, background: "#8b5a38", margin: "34px 0 30px", display: "flex" }} />
        <div style={{ fontFamily: "sans-serif", maxWidth: 780, fontSize: isStory ? 33 : 29, lineHeight: 1.58, color: "#513629", display: "flex" }}>{message}</div>
      </div>

      {/* Güneş ve sakin ufuk. */}
      <div style={{ position: "absolute", left: 470, bottom: isStory ? 505 : 320, width: 116, height: 116, borderRadius: 999, background: "#fff2bd", boxShadow: "0 0 60px rgba(255,224,137,.7)", display: "flex" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: isStory ? 410 : 245, height: 150, background: "linear-gradient(180deg,rgba(92,61,51,.05),rgba(54,45,45,.42))", display: "flex" }} />

      {/* Cami silüeti: kubbeler ve minareler. */}
      <div style={{ position: "absolute", right: 118, bottom: isStory ? 365 : 200, width: 360, height: 190, display: "flex", alignItems: "flex-end", justifyContent: "center", opacity: .88 }}>
        <div style={{ position: "absolute", left: 34, bottom: 0, width: 22, height: 165, background: "#3f3434", display: "flex" }} />
        <div style={{ position: "absolute", left: 27, bottom: 158, width: 36, height: 12, borderRadius: 8, background: "#3f3434", display: "flex" }} />
        <div style={{ position: "absolute", left: 40, bottom: 170, width: 10, height: 34, background: "#3f3434", transform: "rotate(3deg)", display: "flex" }} />
        <div style={{ position: "absolute", right: 34, bottom: 0, width: 22, height: 165, background: "#3f3434", display: "flex" }} />
        <div style={{ position: "absolute", right: 27, bottom: 158, width: 36, height: 12, borderRadius: 8, background: "#3f3434", display: "flex" }} />
        <div style={{ position: "absolute", right: 40, bottom: 170, width: 10, height: 34, background: "#3f3434", transform: "rotate(-3deg)", display: "flex" }} />
        <div style={{ position: "absolute", left: 94, bottom: 0, width: 174, height: 85, borderRadius: "90px 90px 8px 8px", background: "#433637", display: "flex" }} />
        <div style={{ position: "absolute", left: 121, bottom: 66, width: 120, height: 102, borderRadius: "80px 80px 8px 8px", background: "#433637", display: "flex" }} />
        <div style={{ position: "absolute", left: 174, bottom: 157, width: 12, height: 34, background: "#433637", display: "flex" }} />
      </div>

      {/* Fener / tesbih hissi veren sıcak ön plan detayı. */}
      <div style={{ position: "absolute", left: 80, bottom: isStory ? 250 : 105, width: 125, height: 215, border: "7px solid #392a27", borderRadius: "50px 50px 20px 20px", background: "linear-gradient(180deg,rgba(255,214,125,.85),rgba(116,67,39,.75))", boxShadow: "0 0 34px rgba(255,196,92,.52)", display: "flex" }} />
      <div style={{ position: "absolute", left: 122, bottom: isStory ? 458 : 313, width: 42, height: 24, borderRadius: "50% 50% 0 0", background: "#392a27", display: "flex" }} />
      <div style={{ position: "absolute", left: 98, bottom: isStory ? 330 : 185, width: 88, height: 3, background: "rgba(57,42,39,.65)", transform: "rotate(58deg)", display: "flex" }} />
      <div style={{ position: "absolute", left: 98, bottom: isStory ? 330 : 185, width: 88, height: 3, background: "rgba(57,42,39,.65)", transform: "rotate(-58deg)", display: "flex" }} />

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: isStory ? 270 : 120, background: "linear-gradient(180deg,rgba(49,40,38,.05),rgba(42,34,33,.82))", display: "flex" }} />
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
