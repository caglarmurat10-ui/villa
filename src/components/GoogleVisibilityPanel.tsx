import type { GoogleVisibilitySnapshot } from "@/lib/google-visibility";
import type { PublishStats } from "@/lib/social-library-summary";
import type { Reservation } from "@/lib/types";
import { gbpContentLibrary } from "@/lib/google-business-content";
import { getReviewRequestMessage, reservationsEligibleForReviewRequest } from "@/lib/social-engagement";

const STATE_LABEL: Record<string, string> = {
  GOOGLE_READY: "✓ Hazır",
  WAITING_OWNER_ACCESS: "Sahiplik/erişim bekleniyor",
  WAITING_API_ACCESS: "API erişimi bekleniyor",
};
const STATE_COLOR: Record<string, string> = {
  GOOGLE_READY: "#86efac",
  WAITING_OWNER_ACCESS: "#fbbf24",
  WAITING_API_ACCESS: "#fbbf24",
};

function box(label: string, value: React.ReactNode, color = "#dbeafe") {
  return <div style={{padding:"8px 10px",border:"1px solid #223a57",borderRadius:9,background:"#0b1728",fontSize:10}}>{label}<br /><b style={{fontSize:14,color}}>{value}</b></div>;
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

  return <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
    <div style={{border:"1px solid #334b69",borderRadius:16,background:"#081522",padding:16,color:"#eef6ff"}}>
      <small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:1.4,color:"#93c5fd"}}>GOOGLE GÖRÜNÜRLÜK</small>
      <h2 style={{margin:"5px 0 10px",fontSize:18}}>Search, Maps, Business Profile</h2>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
        {box("Sitemap URL sayısı", snapshot.sitemapUrls.length)}
        {box("JSON-LD sayfa sayısı", snapshot.jsonLdPages.length)}
        {box("Maps linki (Safira)", snapshot.mapsLinkConfigured.Safira ? "✓ Var" : "Yok", snapshot.mapsLinkConfigured.Safira ? "#86efac" : "#fbbf24")}
        {box("Maps linki (Destan)", snapshot.mapsLinkConfigured.Destan ? "✓ Var" : "Yok", snapshot.mapsLinkConfigured.Destan ? "#86efac" : "#fbbf24")}
        {box("Google Business Profile", STATE_LABEL[snapshot.gbpState], STATE_COLOR[snapshot.gbpState])}
        {box("Review otomasyonu", STATE_LABEL[snapshot.reviewAutomationState], STATE_COLOR[snapshot.reviewAutomationState])}
      </div>

      <p style={{marginTop:10,fontSize:9,color:"#8fa4bd"}}>Search Console API bağlı değil — index sayısı tahmini olarak gösterilmiyor. GBP owner/manager erişimi koddan doğrulanamaz; aşağıdaki adminler manuel kontrol gerektirir.</p>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>GBP admin checklist (owner tarafından)</strong>
        <ul style={{margin:"8px 0 0",paddingLeft:18,fontSize:10,color:"#b8c6d8",lineHeight:1.7}}>
          <li>Safira ve Destan için business.google.com'da profil claimed/verified mi kontrol edin</li>
          <li>Bu profillerin yöneticisi/owner'ı hangi Google hesabı - erişiminiz var mı doğrulayın</li>
          <li>Varsa Google Cloud project + Business Profile API onayı durumunu kontrol edin</li>
          <li>Her villa için GBP panelinden "Yorum iste" linkini alıp bize iletin (tahmin edilemez)</li>
        </ul>
      </div>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>Hazır GBP içerik kütüphanesi ({gbpContentLibrary.length} taslak, API erişimi gelince kullanılabilir)</strong>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8,marginTop:8}}>
          {gbpContentLibrary.map((post) => (
            <div key={`${post.villa}-${post.category}`} style={{padding:"8px 10px",border:"1px solid #223a57",borderRadius:9,background:"#0b1728",fontSize:9}}>
              <b style={{color:"#dbeafe"}}>Villa {post.villa} · {post.category}</b>
              <p style={{margin:"4px 0 0",color:"#9fb0c5",lineHeight:1.4}}>{post.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>Yayın istatistiği (D1 kaynaklı — site trafiği/lead için GA4 Data API gerekir, burada yok)</strong>
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
              // reviewUrl değeri burada bilerek null - gerçek URL yalnız sunucu env'inde, admin
              // panelinde asla gösterilmez/tahmin edilmez; configured=true olduğunda personel gerçek
              // linki kendi tarafında (env/GBP panelinden) alıp bu şablonu tamamlar.
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
