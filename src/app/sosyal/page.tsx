import { getCloudflareContext } from "@opennextjs/cloudflare";
import MetaConnections from "@/components/MetaConnections";
import MetaDiagnostics from "@/components/MetaDiagnostics";
import MetaPublishTestCenter from "@/components/MetaPublishTestCenter";
import SocialDeferredContent from "@/components/SocialDeferredContent";
import SocialPublishHealth from "@/components/SocialPublishHealth";
import { listMetaAccounts } from "@/lib/meta-store";
import { maintainLegacyInstagramConnections } from "@/lib/instagram-maintenance";
import { getMetaDiagnostic } from "@/lib/meta-diagnostics";
import { listReservations } from "@/lib/db";
import { findAvailabilityGaps } from "@/lib/social-availability";
import { listSocialPosts } from "@/lib/social-db";
import { getContentLibrarySummary } from "@/lib/social-library-summary";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const villas: Villa[] = ["Safira", "Destan"];

type SocialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SocialPage({ searchParams }: SocialPageProps) {
  const params = searchParams ? await searchParams : {};
  const metaPlatform = firstParam(params.meta_platform);
  const metaError = firstParam(params.meta_error);
  const metaStage = firstParam(params.meta_stage);
  const metaConnected = firstParam(params.meta_connected);
  const metaBrand = firstParam(params.meta_brand);

  const [posts, initialAccounts, reservations, contentLibrarySummary] = await Promise.all([
    listSocialPosts(30),
    listMetaAccounts(),
    listReservations(),
    getContentLibrarySummary(),
  ]);
  const { env } = await getCloudflareContext({ async: true });
  const autoPublishEnabled = String(env.SOCIAL_AUTO_PUBLISH_ENABLED ?? "true").toLowerCase() === "true";

  const maintenance = await maintainLegacyInstagramConnections(initialAccounts);
  const accounts = maintenance.refreshed ? await listMetaAccounts() : initialAccounts;
  const diagnostic = await getMetaDiagnostic(accounts);
  const gaps = findAvailabilityGaps(reservations, istanbulToday());
  const facebookByVilla = new Map(
    accounts.filter((item) => item.platform === "Facebook").map((item) => [item.villa, item]),
  );

  return <>
    {metaError ? <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
      <div style={{padding:"13px 15px",border:"1px solid #ef444477",borderRadius:13,background:"#2a1014",color:"#fecaca",fontSize:12,lineHeight:1.5}}>
        <strong style={{display:"block",marginBottom:4,color:"#fff"}}>{metaPlatform || "Meta"} bağlantısı tamamlanamadı</strong>
        <span>{metaError}</span>
        {metaStage ? <small style={{display:"block",marginTop:5,color:"#fca5a5"}}>Aşama: {metaStage}</small> : null}
      </div>
    </section> : null}

    {metaConnected ? <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
      <div style={{padding:"13px 15px",border:"1px solid #22c55e66",borderRadius:13,background:"#071b16",color:"#bbf7d0",fontSize:12,lineHeight:1.5}}>
        <strong style={{display:"block",marginBottom:4,color:"#fff"}}>✓ {metaPlatform || "Meta"} bağlantısı tamamlandı</strong>
        <span>{metaConnected === "Safira ve Destan" ? "Safira ve Destan Facebook Sayfaları aynı yetkilendirme oturumunda birlikte kaydedildi." : `Villa ${metaConnected} hesabı başarıyla kaydedildi.`}</span>
        {metaBrand ? <small style={{display:"block",marginTop:5,color:"#86efac"}}>Marka uygulama sonucu: {metaBrand}</small> : null}
      </div>
    </section> : null}

    <MetaDiagnostics diagnostic={diagnostic} />

    <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
      <div style={{padding:"16px",border:"1px solid #1877f255",borderRadius:16,background:"linear-gradient(135deg,#0b1c35,#081522)",color:"#f8fafc"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div>
            <small style={{display:"block",color:"#60a5fa",fontSize:9,fontWeight:900,letterSpacing:1.4}}>FACEBOOK BAĞLANTISI · ORTAK OAUTH</small>
            <h2 style={{margin:"5px 0 4px",fontSize:19}}>Safira ve Destan Facebook Sayfaları</h2>
            <p style={{margin:0,color:"#b8c6d8",fontSize:12}}>Facebook iki villa için tek Meta yetkilendirme oturumunda bağlanır. Safira ve Destan Sayfalarını aynı seçim ekranında açıkça eşleştiririz; iki Page tokenı birlikte güncellenir.</p>
          </div>
          <a href="/api/meta/facebook/connect?villa=Safira" style={{display:"inline-block",padding:"10px 13px",borderRadius:10,background:"#1877f2",color:"#fff",fontSize:11,fontWeight:900,textDecoration:"none"}}>İki Facebook Sayfasını birlikte bağla / yenile</a>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10,marginTop:13}}>
          {villas.map((villa) => {
            const account = facebookByVilla.get(villa);
            return <article key={villa} style={{padding:"13px",border:"1px solid #334b69",borderRadius:12,background:"#071321"}}>
              <strong style={{display:"block",marginBottom:5}}>Villa {villa} · Facebook</strong>
              {account ? <>
                <span style={{display:"block",color:"#86efac",fontSize:11,fontWeight:800}}>✓ Bağlı · {account.username}</span>
                <a href="/sosyal/marka" style={{display:"inline-block",marginTop:9,color:"#93c5fd",fontSize:11,fontWeight:800,textDecoration:"none"}}>Marka ayarlarını kontrol et →</a>
              </> : <>
                <span style={{display:"block",color:"#fbbf24",fontSize:11}}>Henüz bağlı değil</span>
                <a href="/api/meta/facebook/connect?villa=Safira" style={{display:"inline-block",marginTop:9,padding:"9px 12px",borderRadius:9,background:"#1877f2",color:"#fff",fontSize:11,fontWeight:900,textDecoration:"none"}}>İki Sayfayı birlikte bağla</a>
              </>}
            </article>;
          })}
        </div>
      </div>
    </section>

    <MetaConnections initialAccounts={accounts} />
    <MetaPublishTestCenter />
    <SocialPublishHealth posts={posts} autoPublishEnabled={autoPublishEnabled} contentLibrarySummary={contentLibrarySummary} />
    <div style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
      <div style={{marginBottom:10,padding:"10px 13px",border:"1px solid #22c55e55",borderRadius:12,background:"#071b16",color:"#bbf7d0",fontSize:11,fontWeight:700}}>
        ✓ Drive medya otomasyonu aktif · İlk ekranda en yakın 30 sosyal plan gösteriliyor. Ağır içerik kütüphanesi ve takvim tarayıcı tarafında yüklenir; Worker CPU bütçesi korunur.
      </div>
      <a href="/sosyal/marka" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"14px 16px",border:"1px solid #d5aa5855",borderRadius:14,background:"linear-gradient(135deg,#13233a,#081522)",color:"#f8fafc",textDecoration:"none",fontWeight:800}}>
        <span><small style={{display:"block",color:"#d5aa58",fontSize:9,letterSpacing:1.5}}>MARKA + HEDEF KİTLE</small>Logo, Facebook kapağı, Instagram öne çıkanları ve Meta kitle merkezi</span>
        <span style={{color:"#d5aa58"}}>Aç →</span>
      </a>
    </div>
    <SocialDeferredContent posts={posts} gaps={gaps} />
  </>;
}
