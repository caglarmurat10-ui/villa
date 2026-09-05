"use client";

import { useMemo, useState } from "react";
import type { SocialPost } from "@/lib/types";
import type { ContentLibrarySummary } from "@/lib/social-library-summary";
import type { SocialCronHeartbeat } from "@/lib/social-cron-health";
import { isMetaTargetHardBlocked } from "@/lib/social-account-policy";

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

function minutesAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "az önce";
  if (minutes === 1) return "1 dakika önce";
  return `${minutes} dakika önce`;
}

// Cron tam olarak */15'te çalışıyor ama Worker'ın gerçek tetiklenme anı birkaç saniye kayabilir -
// bu yüzden "sıradaki cron" yalnız YAKLAŞIK bir tahmin, kesin garanti değil (component adı da
// "yaklaşık" diyor).
function nextApproximateCron() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const nextQuarter = Math.ceil((minute + 1) / 15) * 15;
  const displayHour = nextQuarter >= 60 ? (hour + 1) % 24 : hour;
  const displayMinute = nextQuarter % 60;
  return `${String(displayHour).padStart(2, "0")}:${String(displayMinute).padStart(2, "0")}`;
}

function compactCaption(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
}

function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default function SocialPublishHealth({ posts, autoPublishEnabled, contentLibrarySummary, cronHeartbeat }: { posts: SocialPost[]; autoPublishEnabled: boolean; contentLibrarySummary: ContentLibrarySummary; cronHeartbeat: SocialCronHeartbeat | null }) {
  const [items, setItems] = useState(posts);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Operasyonel sağlık sayaçları yalnız gerçekten yayınlanabilir Meta hedeflerini kapsar.
  // Destan Instagram ayrı HARD BLOCK kartında izlenir; aksi halde bu bekleyen satırlar
  // "Yayına hazır" ve "Hatalı" sayılarını yapay olarak şişirir.
  const activeItems = useMemo(() => items.filter((post) => !isMetaTargetHardBlocked(post.villa, post.platform)), [items]);
  const ready = useMemo(() => activeItems.filter((post) => post.status === "Planlandı" && post.approvalStatus === "Onaylandı" && !post.lastPublishError), [activeItems]);
  const readyQueue = useMemo(() => [...ready]
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.approvedAt ?? a.createdAt ?? "").localeCompare(b.approvedAt ?? b.createdAt ?? ""))
    .slice(0, 12), [ready]);
  const today = todayIstanbul();
  const dueReady = ready.filter((post) => post.scheduledDate <= today);
  const failed = activeItems.filter((post) => post.status === "Planlandı" && Boolean(post.lastPublishError));
  const todayScheduled = activeItems.filter((post) => post.status === "Planlandı" && post.scheduledDate === today);
  const todayPublished = activeItems.filter((post) => post.status === "Yayınlandı" && (post.publishedAt ?? "").slice(0, 10) === today);
  const destanIgWaiting = items.filter((post) => isMetaTargetHardBlocked(post.villa, post.platform) && post.status === "Planlandı");
  const attempted = activeItems.filter((post) => (post.publishAttemptCount ?? 0) > 0);
  const publishedTracked = activeItems.filter((post) => post.status === "Yayınlandı" && Boolean(post.platformPostId));
  const recent = [...attempted]
    .sort((a, b) => (b.lastPublishAttemptAt ?? "").localeCompare(a.lastPublishAttemptAt ?? ""))
    .slice(0, 6);

  async function removeApproval(postId: string, quiet = false) {
    const response = await fetch(`/api/social-posts/${encodeURIComponent(postId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus: "İnsan onayı" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Onay kaldırılamadı.");
    setItems((current) => current.map((post) => post.id === postId ? { ...post, approvalStatus: "İnsan onayı", approvedAt: null } : post));
    if (!quiet) setNotice("✓ Otomatik yayın onayı kaldırıldı; içerik silinmedi ve yeniden incelenebilir.");
  }

  async function pauseOne(postId: string) {
    setBusy(postId);
    setNotice("");
    try {
      await removeApproval(postId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Onay kaldırılamadı.");
    } finally {
      setBusy(null);
    }
  }

  async function pauseDueQueue() {
    if (!dueReady.length) return;
    const confirmed = window.confirm(`${dueReady.length} adet bugün veya geçmiş tarihli onaylı içerik otomatik yayından çıkarılacak. İçerikler silinmeyecek ve insan onayına dönecek. Devam edilsin mi?`);
    if (!confirmed) return;
    setBusy("bulk");
    setNotice("");
    try {
      for (const post of dueReady) await removeApproval(post.id, true);
      setNotice(`✓ ${dueReady.length} gecikmiş/bugünkü içerik otomatik yayın kuyruğundan güvenle çıkarıldı. Gelecek tarihli planlara dokunulmadı.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Kuyruk güncellenemedi.");
    } finally {
      setBusy(null);
    }
  }

  return <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
    <div style={{border:"1px solid #334b69",borderRadius:16,background:"#081522",padding:16,color:"#eef6ff"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:1.4,color:"#93c5fd"}}>YAYIN MOTORU SAĞLIĞI</small><h2 style={{margin:"5px 0 4px",fontSize:18}}>Instagram + Facebook yayın takibi</h2><p style={{margin:0,color:"#9fb0c5",fontSize:11}}>İnsan onayı korunur; Meta gönderi kimliği, deneme sayısı ve son güvenli hata D1 üzerinde tutulur.</p></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <span style={{padding:"7px 10px",borderRadius:999,background:autoPublishEnabled?"#123522":"#451a1a",color:autoPublishEnabled?"#86efac":"#fecaca",fontSize:10,fontWeight:900}}>{autoPublishEnabled ? "● Otomatik yayın AÇIK" : "■ Otomatik yayın DURDURULDU"}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:"#172554",color:"#bfdbfe",fontSize:10,fontWeight:900}}>Yayına hazır {ready.length}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:"#123522",color:"#86efac",fontSize:10,fontWeight:900}}>Meta ID kayıtlı {publishedTracked.length}</span>
          <span style={{padding:"7px 10px",borderRadius:999,background:failed.length?"#451a1a":"#17263c",color:failed.length?"#fecaca":"#bfdbfe",fontSize:10,fontWeight:900}}>Hatalı {failed.length}</span>
        </div>
      </div>

      {notice ? <div style={{marginTop:12,padding:"9px 11px",borderRadius:10,border:"1px solid #2e5075",background:"#0b1b2e",color:"#bfdbfe",fontSize:10}}>{notice}</div> : null}

      <div style={{marginTop:12,padding:"9px 11px",borderRadius:10,border:"1px solid #223a57",background:"#0b1728",display:"flex",gap:14,flexWrap:"wrap",fontSize:10,color:"#b8c6d8"}}>
        {cronHeartbeat ? <>
          <span>Son cron: <b style={{color:"#dbeafe"}}>{formatTime(cronHeartbeat.ranAt)}</b> <span style={{color:"#7f94ae"}}>({minutesAgo(cronHeartbeat.ranAt)})</span></span>
          <span>Bu turdaki aday: <b style={{color:"#dbeafe"}}>{cronHeartbeat.candidateCount}</b></span>
          <span>Başarı/Atlandı/Hata: <b style={{color:"#86efac"}}>{cronHeartbeat.successCount}</b>/<b style={{color:"#fbbf24"}}>{cronHeartbeat.skippedCount}</b>/<b style={{color:cronHeartbeat.errorCount?"#fca5a5":"#8fa4bd"}}>{cronHeartbeat.errorCount}</b></span>
        </> : <span>Cron heartbeat henüz kaydedilmedi (Worker&apos;ın en az bir kez tetiklenmesi gerekiyor).</span>}
        <span>Sıradaki cron ~<b style={{color:"#dbeafe"}}>{nextApproximateCron()}</b></span>
      </div>

      <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <strong style={{fontSize:11,color:"#93c5fd"}}>Bugün ({today})</strong>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginTop:8,fontSize:10}}>
          <div style={{padding:"8px 10px",border:"1px solid #223a57",borderRadius:9,background:"#0b1728"}}>Zamanlandı<br /><b style={{fontSize:15}}>{todayScheduled.length}</b></div>
          <div style={{padding:"8px 10px",border:"1px solid #1f5f3b",borderRadius:9,background:"#071b16",color:"#86efac"}}>Yayınlandı<br /><b style={{fontSize:15}}>{todayPublished.length}</b></div>
          <div style={{padding:"8px 10px",border:"1px solid #451a1a",borderRadius:9,background:"#2a0a0a",color:"#fca5a5"}}>Hatalı<br /><b style={{fontSize:15}}>{failed.length}</b></div>
          {destanIgWaiting.length > 0 ? <div style={{padding:"8px 10px",border:"1px solid #a16207",borderRadius:9,background:"#241a06",color:"#fbbf24"}}>HARD BLOCK (Destan IG)<br /><b style={{fontSize:15}}>{destanIgWaiting.length}</b></div> : null}
          <div style={{padding:"8px 10px",border:"1px solid #47617f",borderRadius:9,background:"#102238",color:"#dbeafe"}}>İnceleme gerekiyor<br /><b style={{fontSize:15}}>{contentLibrarySummary.reviewRequired}</b></div>
          <div style={{padding:"8px 10px",border:"1px solid #451a1a",borderRadius:9,background:"#1a0a0a",color:"#f87171"}}>Bloklandı<br /><b style={{fontSize:15}}>{contentLibrarySummary.blocked}</b></div>
        </div>
      </div>

      {destanIgWaiting.length > 0 ? (
        <div style={{marginTop:10,padding:"10px 12px",border:"1px solid #a16207",borderRadius:11,background:"#241a06",color:"#fbbf24",fontSize:10,fontWeight:700}}>
          ⚠ Villa Destan Instagram: Bağlantı/sahiplik çözümü bekleniyor — otomatik yayın kapalı. {destanIgWaiting.length} içerik HARD BLOCK altında bekliyor; yayına hazır/hatalı sayaçlarına dahil edilmiyor ve hiçbiri yayına gönderilmiyor.
        </div>
      ) : null}

      {readyQueue.length ? <div style={{marginTop:14,paddingTop:13,borderTop:"1px solid #203954"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
          <div><strong style={{fontSize:11}}>{autoPublishEnabled ? "Otomatik yayın kuyruğu (cron her 15 dakikada çalışıyor)" : "Otomatik yayın açılırsa sırada bekleyen onaylı içerikler"}</strong><p style={{margin:"3px 0 0",fontSize:9,color:"#8fa4bd"}}>{autoPublishEnabled ? "Cron şu anda AÇIK. Bugün veya geçmiş tarihli içerikleri topluca insan onayına döndürüp yayın patlamasını önleyebiliriz." : "Cron şu anda DURDURULDU (SOCIAL_AUTO_PUBLISH_ENABLED=false). Aşağıdaki içerikler yayınlanmıyor, yalnız kuyrukta bekliyor."}</p></div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {dueReady.length ? <button type="button" onClick={pauseDueQueue} disabled={busy !== null} style={{border:"1px solid #f59e0b66",borderRadius:9,padding:"7px 10px",background:"#3a2606",color:"#fde68a",fontSize:9,fontWeight:900,cursor:busy?"wait":"pointer"}}>{busy === "bulk" ? "Durduruluyor…" : `Bugün/gecikmiş ${dueReady.length} içeriği durdur`}</button> : null}
            <span style={{fontSize:9,color:"#fbbf24",fontWeight:900}}>Gösterilen {readyQueue.length}/{ready.length}</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:8}}>
          {readyQueue.map((post) => {
            const due = post.scheduledDate <= today;
            return <article key={post.id} style={{padding:"10px 11px",border:`1px solid ${due?"#a16207":"#315b43"}`,borderRadius:11,background:due?"#17150b":"#0b1712"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"start"}}><strong style={{fontSize:10}}>Villa {post.villa} · {post.platform}</strong><span style={{fontSize:9,color:due?"#fbbf24":"#86efac",fontWeight:900}}>{post.scheduledDate}</span></div>
              <div style={{marginTop:4,fontSize:9,color:due?"#d6c89a":"#a7d8b8"}}>{post.contentType} · Onaylandı · {due?"bugün/gecikmiş":"gelecek tarihli"}</div>
              <p style={{margin:"6px 0 0",fontSize:9,lineHeight:1.45,color:"#b8c6d8"}}>{compactCaption(post.caption)}</p>
              <code style={{display:"block",marginTop:6,fontSize:8,color:"#70869f",overflowWrap:"anywhere"}}>ID: {post.id}</code>
              <button type="button" onClick={() => pauseOne(post.id)} disabled={busy !== null} style={{marginTop:8,border:"1px solid #47617f",borderRadius:8,padding:"6px 9px",background:"#102238",color:"#dbeafe",fontSize:9,fontWeight:800,cursor:busy?"wait":"pointer"}}>{busy === post.id ? "Durduruluyor…" : "Onayı kaldır / otomatik yayından çıkar"}</button>
            </article>;
          })}
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
