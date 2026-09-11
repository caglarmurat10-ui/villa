import { ImageResponse } from "next/og";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isFormat, parseTemplateId, renderLocalEvent, renderTemplate, type Format } from "@/lib/social-design-templates";
import { getLocalEventCandidate } from "@/lib/local-events";
import { getSpecialDayForDate } from "@/lib/special-days";

export const runtime = "nodejs";

const EVENT_DATE_FMT = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long" });
const FRIDAY_VISUAL_MESSAGE = "Cuma; huzurun, bereketin ve duaların buluştuğu mübarek bir gündür. Dualarınızın kabul olmasını dileriz.";

function eventDateLabel(startIso: string, endIso: string | null): string {
  const start = EVENT_DATE_FMT.format(new Date(`${startIso}T00:00:00Z`));
  if (!endIso || endIso === startIso) return start;
  return `${start} – ${EVENT_DATE_FMT.format(new Date(`${endIso}T00:00:00Z`))}`;
}

type FridayVisualTheme = {
  background: string;
  glow: string;
  text: string;
  muted: string;
  accent: string;
  silhouette: string;
  line: string;
};

const FRIDAY_VISUAL_THEMES: FridayVisualTheme[] = [
  { background: theme.background, glow: "radial-gradient(circle at 50% 65%,rgba(255,241,182,.75) 0%,rgba(255,190,95,.18) 28%,rgba(80,39,29,.08) 72%)", text: "#3d281d", muted: "#513629", accent: "#8b5a38", silhouette: "#433637", line: "rgba(105,63,41,.22)" },
  { background: "linear-gradient(155deg,#061b38 0%,#0a3760 42%,#17667b 72%,#d8a855 100%)", glow: "radial-gradient(circle at 72% 30%,rgba(255,221,139,.42) 0%,rgba(44,139,160,.18) 31%,rgba(4,21,45,.04) 72%)", text: "#fff6df", muted: "#e8e7de", accent: "#efc774", silhouette: "#071b2c", line: "rgba(239,199,116,.30)" },
  { background: "linear-gradient(155deg,#07372f 0%,#0d5848 43%,#b98b50 78%,#f0d9aa 100%)", glow: "radial-gradient(circle at 30% 66%,rgba(255,231,168,.48) 0%,rgba(25,104,82,.16) 34%,rgba(3,42,35,.03) 73%)", text: "#fff9e8", muted: "#f0eadb", accent: "#e3bd78", silhouette: "#12352f", line: "rgba(227,189,120,.30)" },
  { background: "linear-gradient(160deg,#40203b 0%,#703b57 38%,#c57d72 70%,#f0c79d 100%)", glow: "radial-gradient(circle at 66% 64%,rgba(255,226,180,.52) 0%,rgba(186,105,111,.17) 35%,rgba(64,32,59,.03) 72%)", text: "#fff7e9", muted: "#f6e5d8", accent: "#f0c684", silhouette: "#40283a", line: "rgba(240,198,132,.30)" },
  { background: "linear-gradient(165deg,#111425 0%,#20294a 44%,#5d4e63 72%,#c69a5f 100%)", glow: "radial-gradient(circle at 50% 58%,rgba(255,218,137,.40) 0%,rgba(62,72,122,.15) 35%,rgba(13,16,32,.03) 75%)", text: "#fff7df", muted: "#e8e1d5", accent: "#d8ad68", silhouette: "#171826", line: "rgba(216,173,104,.28)" },
  { background: "linear-gradient(150deg,#e9e1d1 0%,#d8ece8 42%,#78aeb0 70%,#335f69 100%)", glow: "radial-gradient(circle at 35% 38%,rgba(255,255,240,.70) 0%,rgba(144,200,196,.18) 38%,rgba(49,95,105,.03) 75%)", text: "#173f47", muted: "#28545a", accent: "#9d7541", silhouette: "#214950", line: "rgba(34,91,97,.22)" },
];

function fridayVisualVariant(date: string, villa: string) {
  const week = Math.floor(Date.parse(`${date}T00:00:00Z`) / (7 * 24 * 60 * 60 * 1000));
  const offset = villa === "Safira" ? 0 : 3;
  return Math.abs(week + offset) % FRIDAY_VISUAL_THEMES.length;
}

function renderNeutralFriday(format: Format, message: string, variant: number): Response {
  const dimensions = format === "story" ? { width: 1080, height: 1920 } : { width: 1080, height: 1350 };
  const isStory = format === "story";
  const theme = FRIDAY_VISUAL_THEMES[variant % FRIDAY_VISUAL_THEMES.length];
  const mirror = variant % 2 === 1;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "serif",
        background: theme.background,
        color: theme.text,
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", background: theme.glow }} />

      <div style={{ position: "absolute", right: -90, top: -70, width: 390, height: 390, border: "3px solid rgba(255,247,223,.30)", transform: "rotate(45deg)", display: "flex" }} />
      <div style={{ position: "absolute", right: 18, top: 10, width: 230, height: 230, border: "2px solid rgba(255,247,223,.25)", transform: "rotate(45deg)", display: "flex" }} />
      <div style={{ position: "absolute", left: 55, top: 70, width: 4, height: isStory ? 520 : 365, background: theme.line, display: "flex" }} />
      <div style={{ position: "absolute", left: 55, top: 70, width: 220, height: 4, background: theme.line, display: "flex" }} />

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
        <div style={{ fontFamily: "sans-serif", fontSize: 22, letterSpacing: 8, color: theme.accent, display: "flex" }}>CUMA MESAJI</div>
        <div style={{ marginTop: 24, fontSize: isStory ? 100 : 86, lineHeight: 1.03, fontWeight: 500, letterSpacing: -2, display: "flex" }}>Hayırlı Cumalar</div>
        <div style={{ width: 240, height: 2, background: theme.accent, margin: "34px 0 30px", display: "flex" }} />
        <div style={{ fontFamily: "sans-serif", maxWidth: 780, fontSize: isStory ? 33 : 29, lineHeight: 1.58, color: theme.muted, display: "flex" }}>{message}</div>
      </div>

      <div style={{ position: "absolute", left: 470, bottom: isStory ? 505 : 320, width: 116, height: 116, borderRadius: 999, background: "#fff2bd", boxShadow: "0 0 60px rgba(255,224,137,.7)", display: "flex" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: isStory ? 410 : 245, height: 150, background: "linear-gradient(180deg,rgba(92,61,51,.05),rgba(54,45,45,.42))", display: "flex" }} />

      <div style={{ position: "absolute", right: mirror ? undefined : 118, left: mirror ? 118 : undefined, bottom: isStory ? 365 : 200, width: 360, height: 190, display: "flex", alignItems: "flex-end", justifyContent: "center", opacity: .88 }}>
        <div style={{ position: "absolute", left: 34, bottom: 0, width: 22, height: 165, background: theme.silhouette, display: "flex" }} />
        <div style={{ position: "absolute", left: 27, bottom: 158, width: 36, height: 12, borderRadius: 8, background: theme.silhouette, display: "flex" }} />
        <div style={{ position: "absolute", left: 40, bottom: 170, width: 10, height: 34, background: theme.silhouette, transform: "rotate(3deg)", display: "flex" }} />
        <div style={{ position: "absolute", right: 34, bottom: 0, width: 22, height: 165, background: theme.silhouette, display: "flex" }} />
        <div style={{ position: "absolute", right: 27, bottom: 158, width: 36, height: 12, borderRadius: 8, background: theme.silhouette, display: "flex" }} />
        <div style={{ position: "absolute", right: 40, bottom: 170, width: 10, height: 34, background: theme.silhouette, transform: "rotate(-3deg)", display: "flex" }} />
        <div style={{ position: "absolute", left: 94, bottom: 0, width: 174, height: 85, borderRadius: "90px 90px 8px 8px", background: theme.silhouette, display: "flex" }} />
        <div style={{ position: "absolute", left: 121, bottom: 66, width: 120, height: 102, borderRadius: "80px 80px 8px 8px", background: theme.silhouette, display: "flex" }} />
        <div style={{ position: "absolute", left: 174, bottom: 157, width: 12, height: 34, background: theme.silhouette, display: "flex" }} />
      </div>

      <div style={{ position: "absolute", left: 80, bottom: isStory ? 250 : 105, width: 125, height: 215, border: `7px solid ${theme.silhouette}`, borderRadius: "50px 50px 20px 20px", background: "linear-gradient(180deg,rgba(255,214,125,.85),rgba(116,67,39,.75))", boxShadow: "0 0 34px rgba(255,196,92,.52)", display: "flex" }} />
      <div style={{ position: "absolute", left: 122, bottom: isStory ? 458 : 313, width: 42, height: 24, borderRadius: "50% 50% 0 0", background: theme.silhouette, display: "flex" }} />
      <div style={{ position: "absolute", left: 98, bottom: isStory ? 330 : 185, width: 88, height: 3, background: theme.line, transform: "rotate(58deg)", display: "flex" }} />
      <div style={{ position: "absolute", left: 98, bottom: isStory ? 330 : 185, width: 88, height: 3, background: theme.line, transform: "rotate(-58deg)", display: "flex" }} />

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

  if (parsed.type === "special-day") {
    const match = getSpecialDayForDate(parsed.key);
    if (match?.kind === "friday") {
      const cacheKey = `friday-visual:v3:${parsed.key}:${parsed.villa}:${format}`;
      const { env } = await getCloudflareContext({ async: true });
      const cached = await env.SOCIAL_ASSET_CACHE.get(cacheKey, { type: "arrayBuffer" });
      if (cached) {
        return new Response(cached, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      const response = renderNeutralFriday(format, FRIDAY_VISUAL_MESSAGE, fridayVisualVariant(parsed.key, parsed.villa));
      const bytes = await response.arrayBuffer();
      await env.SOCIAL_ASSET_CACHE.put(cacheKey, bytes, { expirationTtl: 60 * 60 * 24 * 120 });
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(bytes, { status: response.status, headers });

    }
  }

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
