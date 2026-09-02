import type { GoogleVisibilitySnapshot } from "@/lib/google-visibility";
import type { PublishStats } from "@/lib/social-library-summary";
import type { Reservation } from "@/lib/types";
import { gbpContentLibrary } from "@/lib/google-business-content";
import { getReviewRequestMessage, reservationsEligibleForReviewRequest } from "@/lib/social-engagement";

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

function oauthButton(label: string, scope: "search_console" | "ga4", connected: boolean, enabled: boolean) {
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
        </div>
      </div>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>Gerçek KPI&apos;lar</strong>
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
        <strong style={{fontSize:11,color:"#93c5fd"}}>Yayın istatistiği (D1 kaynaklı — site trafiği/lead için GA4 Data API gerekir)</strong>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginTop:8}}>
          {box("Son 7 gün yayınlanan", stats7.publishedCount, "#86efac")}
          {box("Son 7 gün hatalı", stats7.failedCount, stats7.failedCount > 0 ? "#fca5a5" : "#86efac")}
          {box("Son 30 gün yayınlanan", stats30.publishedCount, "#86efac")}
          {box("Son 30 gün hatalı", stats30.failedCount, stats30.failedCount > 0 ? "#fca5a5" : "#86efac")}
        </div>
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
