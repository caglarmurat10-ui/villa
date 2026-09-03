import type { GoogleVisibilitySnapshot } from "@/lib/google-visibility";
import type { PublishStats } from "@/lib/social-library-summary";
import type { Reservation } from "@/lib/types";
import { gbpContentLibrary } from "@/lib/google-business-content";
import { getReviewRequestMessage, reservationsEligibleForReviewRequest } from "@/lib/social-engagement";
import GbpLocationPicker from "@/components/GbpLocationPicker";
import { FUNNEL_STEPS } from "@/lib/google-analytics";

const FUNNEL_STEP_LABELS: Array<[typeof FUNNEL_STEPS[number], string]> = [
  ["view_item", "Villa görüntüleme"],
  ["check_availability", "Müsaitlik sorgusu"],
  ["generate_lead", "Rezervasyon talebi"],
  ["begin_checkout", "Ödeme başlatıldı"],
  ["payment_success", "Ödeme tamamlandı"],
];

const STATE_COLOR: Record<string, string> = {
  GOOGLE_READY: "#86efac",
  WAITING_OWNER_ACCESS: "#fbbf24",
  WAITING_API_ACCESS: "#fbbf24",
};

function statusIcon(state: string) {
  return state === "GOOGLE_READY" ? "✓ Bağlı" : "⚠ Erişim bekliyor";
}

function box(label: string, value: React.ReactNode, color = "#dbeafe") {
  return <div style={{padding:"8px 10px",border:"1px solid #223a57",borderRadius:9,background:"#0b1728",fontSize:10}}>{label}<br /><b style={{fontSize:14,color}}>{value}</b></div>;
}

function statusCard(label: string, state: string) {
  const color = STATE_COLOR[state];
  return <div style={{padding:"12px 10px",border:`1px solid ${state === "GOOGLE_READY" ? "#1f5f3b" : "#3a2f0a"}`,borderRadius:11,background:state === "GOOGLE_READY" ? "#071b16" : "#1a1408",textAlign:"center"}}>
    <div style={{fontSize:10,color:"#9fb0c5",fontWeight:800}}>{label}</div>
    <div style={{fontSize:13,fontWeight:900,marginTop:4,color}}>{statusIcon(state)}</div>
  </div>;
}

function oauthButton(label: string, scope: "search_console" | "ga4" | "gbp", connected: boolean, enabled: boolean) {
  const href = enabled ? `/api/admin/google/oauth/start?scope=${scope}` : undefined;
  const text = connected ? `${label} bağlantısını yenile` : `${label} bağla`;
  const style = {
    display: "inline-block",
    padding: "10px 13px",
    borderRadius: 10,
    background: enabled ? "#2563eb" : "#263547",
    color: enabled ? "#fff" : "#7f91a8",
    fontSize: 11,
    fontWeight: 900,
    textDecoration: "none",
    cursor: enabled ? "pointer" : "not-allowed",
  } as const;

  return href
    ? <a href={href} style={style}>{text}</a>
    : <span style={style} aria-disabled="true">{text}</span>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}

export default function GoogleVisibilityPanel({
  snapshot,
  stats7,
  stats30,
  reservations,
  todayIso,
}: {
  snapshot: GoogleVisibilitySnapshot;
  stats7: PublishStats;
  stats30: PublishStats;
  reservations: Reservation[];
  todayIso: string;
}) {
  const reviewEligible = reservationsEligibleForReviewRequest(reservations, todayIso);
  const searchConsoleConnected = snapshot.searchConsoleState === "GOOGLE_READY";
  const ga4Connected = snapshot.ga4State === "GOOGLE_READY";
  const sc = snapshot.searchConsole;
  const ga = snapshot.ga4;

  return <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
    <div style={{border:"1px solid #334b69",borderRadius:16,background:"#081522",padding:16,color:"#eef6ff"}}>
      <small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:1.4,color:"#93c5fd"}}>GOOGLE GÖRÜNÜRLÜK</small>
      <h2 style={{margin:"5px 0 10px",fontSize:18}}>Search, Maps, Business Profile</h2>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
        {statusCard("Search Console", snapshot.searchConsoleState)}
        {statusCard("Google Analytics", snapshot.ga4State)}
        {statusCard("Business Profile", snapshot.gbpState)}
        {statusCard("Yorum Linkleri", snapshot.reviewLinksState)}
      </div>

      <div style={{marginTop:12,padding:"12px",border:"1px solid #203954",borderRadius:12,background:"#071321"}}>
        <strong style={{display:"block",fontSize:11,color:"#93c5fd"}}>Google OAuth bağlantıları</strong>
        <p style={{margin:"5px 0 10px",fontSize:10,color:"#9fb0c5",lineHeight:1.5}}>
          {snapshot.oauthClientConfigured
            ? "Google Cloud OAuth client yapılandırılmış. Aşağıdaki düğmeler Search Console ve GA4 için güvenli yetkilendirme akışını başlatır; refresh token yalnız GOOGLE_PRIVATE KV içinde tutulur."
            : "Önce GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET Cloudflare Worker secret olarak girilmeli. Credential değerleri repoya, D1'e veya tarayıcıya yazılmaz."}
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {oauthButton("Search Console", "search_console", searchConsoleConnected, snapshot.oauthClientConfigured)}
          {oauthButton("GA4", "ga4", ga4Connected, snapshot.oauthClientConfigured)}
          {oauthButton("Business Profile", "gbp", snapshot.gbpState === "GOOGLE_READY", snapshot.oauthClientConfigured)}
        </div>
      </div>

      {sc ? <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline",flexWrap:"wrap"}}>
          <strong style={{fontSize:11,color:"#86efac"}}>Search Console · canlı API</strong>
          <small style={{fontSize:9,color:"#8fa4bd"}}>{sc.siteUrl} · {sc.startDate} → {sc.endDate}</small>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginTop:8}}>
          {box("Google tıklaması", formatNumber(sc.clicks), "#86efac")}
          {box("Gösterim", formatNumber(sc.impressions))}
          {box("CTR", `${(sc.ctr * 100).toFixed(1)}%`)}
          {box("Ort. konum", sc.position ? sc.position.toFixed(1) : "—")}
        </div>
        {sc.topQueries.length > 0 ? <div style={{marginTop:9,padding:"9px 10px",border:"1px solid #1f5f3b",borderRadius:9,background:"#071b16"}}>
          <b style={{fontSize:10,color:"#bbf7d0"}}>En çok tıklanan sorgular</b>
          <div style={{display:"grid",gap:4,marginTop:6}}>
            {sc.topQueries.map((item) => <div key={item.query} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:9,color:"#a7d8b8"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.query}</span>
              <span style={{flexShrink:0}}>{formatNumber(item.clicks)} tık · {formatNumber(item.impressions)} gösterim</span>
            </div>)}
          </div>
        </div> : null}
        {sc.topPages.length > 0 ? <div style={{marginTop:9,padding:"9px 10px",border:"1px solid #1f5f3b",borderRadius:9,background:"#071b16"}}>
          <b style={{fontSize:10,color:"#bbf7d0"}}>En çok tıklanan sayfalar</b>
          <div style={{display:"grid",gap:4,marginTop:6}}>
            {sc.topPages.map((item) => <div key={item.page} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:9,color:"#a7d8b8"}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.page.replace("https://safiradestan.com","") || "/"}</span>
              <span style={{flexShrink:0}}>{formatNumber(item.clicks)} tık · {formatNumber(item.impressions)} gösterim</span>
            </div>)}
          </div>
        </div> : null}
        <div style={{marginTop:9,padding:"9px 10px",border:"1px solid #223a57",borderRadius:9,background:"#0b1728"}}>
          <b style={{fontSize:10,color:"#93c5fd"}}>SEO fırsat önerileri (son 28 gün, gerçek veri)</b>
          {!sc.opportunities.hasEnoughData ? (
            <p style={{margin:"6px 0 0",fontSize:9,color:"#8fa4bd"}}>Hesaplamak için yeterli Search Console verisi yok.</p>
          ) : sc.opportunities.opportunities.length === 0 ? (
            <p style={{margin:"6px 0 0",fontSize:9,color:"#86efac"}}>Belirgin bir fırsat tespit edilmedi - mevcut sorgular CTR/pozisyon açısından sağlıklı görünüyor.</p>
          ) : (
            <div style={{display:"grid",gap:5,marginTop:6}}>
              {sc.opportunities.opportunities.map((item, index) => (
                <div key={`${item.type}-${item.query}-${index}`} style={{fontSize:9,color:"#c8d3e3"}}>
                  <span style={{color: item.type === "high_impression_low_ctr" ? "#fbbf24" : "#93c5fd", fontWeight:800}}>
                    {item.type === "high_impression_low_ctr" ? "Düşük CTR" : "Orta pozisyon"}
                  </span> — {item.suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div> : snapshot.searchConsoleError ? <div style={{marginTop:12,padding:"10px 12px",border:"1px solid #a1620755",borderRadius:10,background:"#241a06",color:"#fbbf24",fontSize:10}}>
        {snapshot.searchConsoleError}
      </div> : null}

      {ga ? <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline",flexWrap:"wrap"}}>
          <strong style={{fontSize:11,color:"#86efac"}}>GA4 · canlı Data API</strong>
          <small style={{fontSize:9,color:"#8fa4bd"}}>{ga.defaultUri} · Property {ga.propertyId} · {ga.measurementId || "measurement ID yok"}</small>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginTop:8}}>
          {box("Aktif kullanıcı", formatNumber(ga.activeUsers), "#86efac")}
          {box("Oturum", formatNumber(ga.sessions))}
          {box("Sayfa görüntüleme", formatNumber(ga.views))}
          {box("Etkileşimli oturum", formatNumber(ga.engagedSessions))}
        </div>
        <small style={{display:"block",marginTop:7,fontSize:9,color:"#8fa4bd"}}>Son 28 tamamlanmış gün · {ga.propertyDisplayName} · {ga.streamDisplayName}</small>
        {ga.eventKpis.length > 0 ? <div style={{marginTop:9,padding:"9px 10px",border:"1px solid #1f5f3b",borderRadius:9,background:"#071b16"}}>
          <b style={{fontSize:10,color:"#bbf7d0"}}>Dönüşüm funnel&apos;ı (gerçek event sayıları)</b>
          <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
            {FUNNEL_STEP_LABELS.map(([eventName, label], index) => {
              const count = ga.eventKpis.find((item) => item.eventName === eventName)?.count ?? 0;
              return <span key={eventName} style={{display:"flex",alignItems:"center",gap:4}}>
                {index > 0 ? <span style={{color:"#3f5872",fontSize:9}}>→</span> : null}
                <span style={{padding:"4px 7px",borderRadius:99,background:count > 0 ? "#0d2a27" : "#1a1408",color:count > 0 ? "#86efac" : "#fbbf24",fontSize:9,fontWeight:800}}>{label}: {formatNumber(count)}</span>
              </span>;
            })}
          </div>
        </div> : null}
        {ga.eventKpis.length > 0 ? <div style={{marginTop:9,padding:"9px 10px",border:"1px solid #1f5f3b",borderRadius:9,background:"#071b16"}}>
          <b style={{fontSize:10,color:"#bbf7d0"}}>Etkileşim event&apos;leri (GTM-KFZ62MJG)</b>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:6,marginTop:6}}>
            {ga.eventKpis.map((item) => <div key={item.eventName} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:9,color:"#a7d8b8"}}>
              <span>{item.eventName}</span><b style={{color: item.count > 0 ? "#bbf7d0" : "#fbbf24"}}>{formatNumber(item.count)}</b>
            </div>)}
          </div>
          {ga.eventKpis.every((item) => item.count === 0) ? <small style={{display:"block",marginTop:6,fontSize:9,color:"#fbbf24"}}>Henüz veri yok — GTM konteynerinde bu event&apos;lerin GA4&apos;e iletildiğini doğrulayın.</small> : null}
        </div> : null}
      </div> : snapshot.ga4Error ? <div style={{marginTop:12,padding:"10px 12px",border:"1px solid #a1620755",borderRadius:10,background:"#241a06",color:"#fbbf24",fontSize:10}}>
        {snapshot.ga4Error}
      </div> : null}

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>Gerçek yapılandırma KPI&apos;ları</strong>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8,marginTop:8}}>
          {box("Sitemap URL sayısı", snapshot.sitemapUrls.length)}
          {box("JSON-LD sayfa sayısı", snapshot.jsonLdPages.length)}
          {box("Maps linki (Safira)", snapshot.mapsLinkConfigured.Safira ? "✓ Var" : "Yok", snapshot.mapsLinkConfigured.Safira ? "#86efac" : "#fbbf24")}
          {box("Maps linki (Destan)", snapshot.mapsLinkConfigured.Destan ? "✓ Var" : "Yok", snapshot.mapsLinkConfigured.Destan ? "#86efac" : "#fbbf24")}
        </div>
      </div>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>GBP admin checklist</strong>
        <ul style={{margin:"8px 0 0",paddingLeft:18,fontSize:10,color:"#b8c6d8",lineHeight:1.7}}>
          <li>business.google.com&apos;da Safira/Destan profillerinde şu bilgilerin GBP ile eşleştiğini kontrol edin: telefon <b>{snapshot.napPhone}</b>, website <code>safiradestan.com/villa-safira</code> / <code>villa-destan</code>, Instagram/Facebook linkleri</li>
          <li>GBP API erişimi ayrıca Google Cloud proje erişim onayı gerektirir. OAuth bağlantısı tek başına Business Profile durumunu GOOGLE_READY yapmaz; başarılı gerçek API probe gerekir.</li>
          <li>Her villa için GBP panelinden &quot;Yorum iste&quot; linkini alıp Cloudflare secret olarak girin (GOOGLE_REVIEW_REQUEST_URL_SAFIRA/DESTAN) — link tahmin edilmez.</li>
        </ul>
        <GbpLocationPicker />
      </div>

      <details style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <summary style={{fontSize:11,color:"#93c5fd",fontWeight:800,cursor:"pointer"}}>GBP İçerik Kütüphanesi ({gbpContentLibrary.length} taslak, API erişimi gelince kullanılabilir)</summary>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8,marginTop:10}}>
          {gbpContentLibrary.map((post) => (
            <div key={`${post.villa}-${post.category}`} style={{padding:"8px 10px",border:"1px solid #223a57",borderRadius:9,background:"#0b1728",fontSize:9}}>
              <b style={{color:"#dbeafe"}}>Villa {post.villa} · {post.category}</b>
              <p style={{margin:"4px 0 0",color:"#9fb0c5",lineHeight:1.4}}>{post.body}</p>
            </div>
          ))}
        </div>
      </details>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>Yayın istatistiği (D1 kaynaklı)</strong>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginTop:8}}>
          {box("Son 7 gün yayınlanan", stats7.publishedCount, "#86efac")}
          {box("Son 7 gün hatalı (AKTİF)", stats7.failedCount, stats7.failedCount > 0 ? "#fca5a5" : "#86efac")}
          {box("Son 30 gün yayınlanan", stats30.publishedCount, "#86efac")}
          {box("Son 30 gün hatalı (AKTİF)", stats30.failedCount, stats30.failedCount > 0 ? "#fca5a5" : "#86efac")}
        </div>
        {stats30.legacyFailedCount > 0 ? (
          <p style={{marginTop:8,fontSize:9,color:"#8fa4bd"}}>
            + {stats30.legacyFailedCount} kayıt RETRIES_EXHAUSTED (deneme hakkı tükendi, cron bir daha denemeyecek) - geçmiş hata olarak audit&apos;te kalır, yeni bir otomasyon sorunu değildir.
          </p>
        ) : null}
      </div>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>Google yorum isteği adayları (checkout 0-2 gün önce, gerçek misafir)</strong>
        {reviewEligible.length === 0 ? (
          <p style={{marginTop:8,fontSize:10,color:"#8fa4bd"}}>Şu an aday rezervasyon yok.</p>
        ) : (
          <div style={{display:"grid",gap:6,marginTop:8}}>
            {reviewEligible.map((r) => {
              const configured = snapshot.reviewRequestUrlConfigured[r.villa];
              const message = configured ? getReviewRequestMessage(r.villa, r.guestName, "[GBP yorum linki]") : null;
              return <div key={r.id} style={{padding:"8px 10px",border:`1px solid ${configured?"#1f5f3b":"#a16207"}`,borderRadius:9,background:configured?"#071b16":"#241a06",fontSize:10}}>
                <b>{r.guestName} · Villa {r.villa}</b> · çıkış {r.checkOut}
                {message ? <p style={{margin:"4px 0 0",color:"#a7d8b8"}}>{message}</p> : <p style={{margin:"4px 0 0",color:"#fbbf24"}}>Bu villa için Google yorum linki henüz yapılandırılmadı.</p>}
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  </section>;
}
