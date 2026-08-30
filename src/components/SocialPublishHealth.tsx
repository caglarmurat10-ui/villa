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

function compactCaption(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
}

export default function SocialPublishHealth({ posts }: { posts: SocialPost[] }) {
  const ready = posts.filter((post) => post.status === "Planlandı" && post.approvalStatus === "Onaylandı" && !post.lastPublishError);
  const readyQueue = [...ready]
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.approvedAt ?? a.createdAt ?? "").localeCompare(b.approvedAt ?? b.createdAt ?? ""))
    .slice(0, 12);
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
          <span style={{padding:"7px 10px",borderRadius:999,background:"#172554",color:"#bfdbfe",fontSize:10,fontWeight:900}}>Yayına hazır {ready.length}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:"#123522",color:"#86efac",fontSize:10,fontWeight:900}}>Meta ID kayıtlı {publishedTracked.length}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:failed.length?"#451a1a":"#17263c",color:failed.length?"#fecaca":"#bfdbfe",fontSize:10,fontWeight:900}}>Hatalı {failed.length}</span>
        </div>
      </div>

      {readyQueue.length ? <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
          <div><strong style={{fontSize:11}}>Otomatik yayın açılırsa sırada bekleyen onaylı içerikler</strong><p style={{margin:"3px 0 0",fontSize:9,color:"#8fa4bd"}}>Cron şu anda kapalı tutuluyor. Bu liste gözden geçirilmeden otomatik yayın yeniden açılmamalı.</p></div>
          <span style={{fontSize:9,color:"#fbbf24",fontWeight:900}}>Gösterilen {readyQueue.length}/{ready.length}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:8}}>
          {readyQueue.map((post) => <article key={post.id} style={{padding:"10px 11px",border:"1px solid #7c5d1d",borderRadius:11,background:"#17150b"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"start"}}><strong style={{fontSize:10}}>Villa {post.villa} · {post.platform}</strong><span style={{fontSize:9,color:"#fbbf24",fontWeight:900}}>{post.scheduledDate}</span></div>
            <div style={{marginTop:4,fontSize:9,color:"#d6c89a"}}>{post.contentType} · Onaylandı · otomatik yayın bekliyor</div>
            <p style={{margin:"6px 0 0",fontSize:9,lineHeight:1.45,color:"#b8c6d8"}}>{compactCaption(post.caption)}</p>
            <code style={{display:"block",marginTop:6,fontSize:8,color:"#70869f",overflowWrap:"anywhere"}}>ID: {post.id}</code>
          </article>)}
        </div>
      </div> : <div style={{marginTop:14,padding:"10px 12px",border:"1px solid #1f5f3b",borderRadius:11,background:"#071b16",color:"#86efac",fontSize:10}}>Onaylı bekleyen otomatik yayın kuyruğu boş.</div>}

      {recent.length ? <div style={{display:"grid",gap:8,marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>{recent.map((post) => <article key={post.id} style={{display:"grid",gridTemplateColumns:"minmax(150px,.7fr) minmax(210px,1fr) auto",gap:10,alignItems:"center",padding:"10px 12px",border:"1px solid #223a57",borderRadius:11,background:"#0b1728"}}>
        <div><strong style={{display:"block",fontSize:11}}>Villa {post.villa} · {post.platform}</strong><span style={{fontSize:9,color:"#8fa4bd"}}>{formatTime(post.lastPublishAttemptAt)}</span></div>
        <div style={{fontSize:10,color:post.lastPublishError?"#fca5a5":"#a7f3d0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{post.lastPublishError ?? (post.platformPostId ? `Meta ID: ${post.platformPostId}` : "Yayın denemesi tamamlandı")}</div>
        <b style={{fontSize:10,color:"#bfdbfe"}}>Deneme {post.publishAttemptCount ?? 0}</b>
      </article>)}</div> : <div style={{marginTop:12,padding:12,border:"1px dashed #29405e",borderRadius:11,color:"#8fa4bd",fontSize:10}}>Henüz kayıtlı bir Meta yayın denemesi yok.</div>}
    </div>
  </section>;
}
