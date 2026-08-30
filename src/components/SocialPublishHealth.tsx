import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SocialPost } from "@/lib/types";

function formatTime(value?: string | null) {
  if (!value) return "Henüz denenmedi";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function automationConfig() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const enabled = String(env.SOCIAL_AUTO_PUBLISH_ENABLED ?? "true").toLowerCase() === "true";
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(env.SOCIAL_AUTO_PUBLISH_TIME ?? ""))
      ? String(env.SOCIAL_AUTO_PUBLISH_TIME)
      : "12:00";
    const parsedLimit = Number.parseInt(String(env.SOCIAL_AUTO_PUBLISH_LIMIT ?? "2"), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(4, parsedLimit)) : 2;
    return { enabled, time, limit };
  } catch {
    return { enabled: false, time: "12:00", limit: 2 };
  }
}

export default async function SocialPublishHealth({ posts }: { posts: SocialPost[] }) {
  const automation = await automationConfig();
  const ready = posts.filter((post) =>
    post.status === "Planlandı"
    && post.approvalStatus === "Onaylandı"
    && (post.platform === "Instagram" || post.platform === "Facebook")
    && post.contentType === "Gönderi"
    && !post.lastPublishError,
  );
  const failed = posts.filter((post) => post.status === "Planlandı" && Boolean(post.lastPublishError));
  const attempted = posts.filter((post) => (post.publishAttemptCount ?? 0) > 0);
  const publishedTracked = posts.filter((post) => post.status === "Yayınlandı" && Boolean(post.platformPostId));
  const recent = [...attempted]
    .sort((a, b) => (b.lastPublishAttemptAt ?? "").localeCompare(a.lastPublishAttemptAt ?? ""))
    .slice(0, 6);

  return <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
    <div style={{border:"1px solid #334b69",borderRadius:16,background:"#081522",padding:16,color:"#eef6ff"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:1.4,color:"#93c5fd"}}>YAYIN MOTORU SAĞLIĞI</small><h2 style={{margin:"5px 0 4px",fontSize:18}}>Instagram + Facebook yayın takibi</h2><p style={{margin:0,color:"#9fb0c5",fontSize:11}}>İnsan onayı korunur; Meta gönderi kimliği, deneme sayısı ve son güvenli hata D1 üzerinde tutulur.</p></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <span style={{padding:"7px 10px",borderRadius:999,background:automation.enabled?"#123522":"#451a1a",color:automation.enabled?"#86efac":"#fecaca",fontSize:10,fontWeight:900}}>{automation.enabled?"● Otomatik yayın açık":"● Otomatik yayın kapalı"}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:"#172554",color:"#bfdbfe",fontSize:10,fontWeight:900}}>Türkiye {automation.time} · 15 dk kontrol · turda {automation.limit}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:"#172554",color:"#bfdbfe",fontSize:10,fontWeight:900}}>Yayına hazır {ready.length}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:"#123522",color:"#86efac",fontSize:10,fontWeight:900}}>ID doğrulanan {publishedTracked.length}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:failed.length?"#451a1a":"#17263c",color:failed.length?"#fecaca":"#bfdbfe",fontSize:10,fontWeight:900}}>Hatalı {failed.length}</span>
        </div>
      </div>
      <div style={{marginTop:10,padding:"9px 11px",border:"1px solid #1f3a55",borderRadius:10,background:"#07111f",color:"#9fb0c5",fontSize:10,lineHeight:1.5}}>
        Otomasyon yalnız <strong style={{color:"#dbeafe"}}>Onaylandı</strong> durumundaki Instagram/Facebook <strong style={{color:"#dbeafe"}}>Gönderi</strong> kayıtlarını işler. Başarısız yayın 30 dakika arayla en fazla 3 kez otomatik denenir; manuel yayın ile cron aynı anda çalışırsa D1 kilidi ikinci isteği durdurur.
      </div>
      {recent.length ? <div style={{display:"grid",gap:8,marginTop:12}}>{recent.map((post) => <article key={post.id} style={{display:"grid",gridTemplateColumns:"minmax(150px,.7fr) minmax(210px,1fr) auto",gap:10,alignItems:"center",padding:"10px 12px",border:"1px solid #223a57",borderRadius:11,background:"#0b1728"}}>
        <div><strong style={{display:"block",fontSize:11}}>Villa {post.villa} · {post.platform}</strong><span style={{fontSize:9,color:"#8fa4bd"}}>{formatTime(post.lastPublishAttemptAt)}</span></div>
        <div style={{fontSize:10,color:post.lastPublishError?"#fca5a5":"#a7f3d0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{post.lastPublishError ?? (post.platformPostId ? `Meta ID: ${post.platformPostId}` : "Yayın denemesi tamamlandı")}</div>
        <b style={{fontSize:10,color:"#bfdbfe"}}>Deneme {post.publishAttemptCount ?? 0}</b>
      </article>)}</div> : <div style={{marginTop:12,padding:12,border:"1px dashed #29405e",borderRadius:11,color:"#8fa4bd",fontSize:10}}>Henüz kayıtlı bir Meta yayın denemesi yok.</div>}
    </div>
  </section>;
}
