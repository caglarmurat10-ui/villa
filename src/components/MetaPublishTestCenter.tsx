"use client";

import { useEffect, useState } from "react";
import { isMetaTargetHardBlocked } from "@/lib/social-account-policy";

type Check = {
  villa: "Safira" | "Destan";
  platform: "Instagram" | "Facebook";
  ready: boolean;
  account?: string;
  readyPosts: number;
  imageAssets: number;
  videoAssets: number;
  error?: string;
  quota?: { remaining?: number; quotaTotal?: number } | null;
  capabilities: string[];
  manualOnly?: string[];
};

type BlockedTarget = {
  villa: "Safira" | "Destan";
  platform: "Instagram" | "Facebook";
  reason: string;
};

type Readiness = {
  checkedAt: string;
  ready: boolean;
  accountsReady: boolean;
  mediaReady: boolean;
  checks: Check[];
  blocked?: BlockedTarget[];
};

type SmokePlan = {
  id: string;
  villa: "Safira" | "Destan";
  platform: "Instagram" | "Facebook";
  status: "Planlandı" | "Yayınlandı";
  approvalStatus: "İnsan onayı" | "Onaylandı";
  scheduledDate: string;
  caption: string;
  mediaUrl: string;
  platformPostId?: string | null;
  lastPublishError?: string | null;
  publishAttemptCount?: number;
};

export default function MetaPublishTestCenter() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [plans, setPlans] = useState<SmokePlan[]>([]);
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  async function loadPlans() {
    try {
      const response = await fetch("/api/meta/smoke-plans", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch {}
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  async function runCheck() {
    setChecking(true);
    setNotice("");
    try {
      const response = await fetch("/api/meta/publish-readiness", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.error ?? "Meta yayın ön kontrolü çalıştırılamadı.");
        return;
      }
      setReadiness(data);
      setNotice(data.ready
        ? "✓ Dört aktif Meta hedefi ve doğrulanmış Drive medya havuzu yayın testine hazır."
        : "Ön kontrolde aktif hedeflerden birinde eksik var; kırmızı satırlar düzeltilmeden gerçek yayın yapılmayacak.");
    } catch {
      setNotice("Meta yayın ön kontrolüne ulaşılamadı.");
    } finally {
      setChecking(false);
    }
  }

  async function preparePlans() {
    setPreparing(true);
    setNotice("");
    try {
      const response = await fetch("/api/meta/smoke-plans", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.error ?? "Kontrollü yayın planları hazırlanamadı.");
        return;
      }
      const nextPlans = Array.isArray(data.plans) ? data.plans : [];
      setPlans(nextPlans);
      setNotice(`${data.message} Yeni: ${data.createdCount}, mevcut: ${data.existingCount}. Aşağıdaki ${nextPlans.length} aktif karttan tek tek ilerleyebilirsiniz.`);
    } catch {
      setNotice("Kontrollü yayın planları hazırlanırken bağlantı kurulamadı.");
    } finally {
      setPreparing(false);
    }
  }

  async function approve(plan: SmokePlan) {
    if (plan.status !== "Planlandı" || isMetaTargetHardBlocked(plan.villa, plan.platform)) return;
    setWorking(plan.id);
    setNotice("");
    try {
      const response = await fetch(`/api/social-posts/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "Onaylandı" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.error ?? "Test planı onaylanamadı.");
        return;
      }
      await loadPlans();
      setNotice(`✓ Villa ${plan.villa} ${plan.platform} test planı insan onayından geçti. Henüz yayınlanmadı.`);
    } catch {
      setNotice("Test planı onaylanırken bağlantı kurulamadı.");
    } finally {
      setWorking(null);
    }
  }

  async function publish(plan: SmokePlan) {
    if (plan.status !== "Planlandı" || plan.approvalStatus !== "Onaylandı") return;
    if (isMetaTargetHardBlocked(plan.villa, plan.platform)) {
      setNotice("Villa Destan Instagram HARD BLOCK: Graph API yayın isteği gönderilmedi.");
      return;
    }
    const confirmed = window.confirm(`Villa ${plan.villa} ${plan.platform} test gönderisi GERÇEKTEN yayınlanacak. Devam edilsin mi?`);
    if (!confirmed) return;

    setWorking(plan.id);
    setNotice("");
    try {
      const endpoint = plan.platform === "Instagram"
        ? "/api/meta/instagram/publish"
        : "/api/meta/facebook/publish";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: plan.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.error ?? `${plan.platform} test yayını başarısız.`);
        await loadPlans();
        return;
      }
      await loadPlans();
      setNotice(`✓ Villa ${plan.villa} ${plan.platform} gerçek test yayını tamamlandı. Meta gönderi kimliği kaydedildi.`);
    } catch {
      setNotice(`${plan.platform} test yayını sırasında bağlantı kurulamadı.`);
    } finally {
      setWorking(null);
    }
  }

  return <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
    <div style={{border:"1px solid #2e5075",borderRadius:16,background:"linear-gradient(135deg,#0a1a2e,#081522)",padding:16,color:"#eef6ff"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div>
          <small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:1.4,color:"#93c5fd"}}>KONTROLLÜ META YAYIN TESTİ</small>
          <h2 style={{margin:"5px 0 4px",fontSize:18}}>Ön kontrol → güvenli plan → insan onayı → gerçek yayın</h2>
          <p style={{margin:0,maxWidth:760,color:"#9fb0c5",fontSize:11,lineHeight:1.55}}>Bu merkez aktif Meta hedeflerini, yayın kotasını ve doğrulanmış Safira/Destan medya havuzunu kontrol eder. Safira ve Destan Instagram ile iki Facebook Sayfası desteklenir. Test planları otomatik hazırlanabilir ancak insan onayı verilmeden hiçbir içerik Meta'ya gönderilmez.</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button type="button" onClick={runCheck} disabled={checking} style={{border:0,borderRadius:10,padding:"10px 13px",background:"#1d4ed8",color:"white",fontSize:11,fontWeight:900,cursor:"pointer"}}>{checking?"Kontrol ediliyor…":"Ön kontrolü çalıştır"}</button>
          <button type="button" onClick={preparePlans} disabled={preparing || readiness?.ready !== true} style={{border:"1px solid #22c55e66",borderRadius:10,padding:"10px 13px",background:readiness?.ready?"#123522":"#17263c",color:readiness?.ready?"#bbf7d0":"#7f8ea3",fontSize:11,fontWeight:900,cursor:readiness?.ready?"pointer":"not-allowed"}}>{preparing?"Planlar hazırlanıyor…":"4 güvenli yayın planı hazırla"}</button>
        </div>
      </div>

      {notice ? <div style={{marginTop:12,padding:"10px 12px",borderRadius:10,background:"#071b16",border:"1px solid #22c55e44",color:"#bbf7d0",fontSize:11}}>{notice}</div> : null}

      {readiness ? <>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:9,marginTop:12}}>
          {readiness.checks.map((check) => <article key={`${check.villa}-${check.platform}`} style={{padding:12,border:`1px solid ${check.ready?"#22c55e55":"#ef444466"}`,borderRadius:12,background:"#071321"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong style={{fontSize:11}}>Villa {check.villa} · {check.platform}</strong><b style={{fontSize:10,color:check.ready?"#86efac":"#fca5a5"}}>{check.ready?"✓ Hazır":"✕ Eksik"}</b></div>
            <p style={{margin:"7px 0 0",fontSize:10,color:"#b8c6d8"}}>{check.account ?? check.error ?? "Hesap doğrulanamadı"}</p>
            <p style={{margin:"5px 0 0",fontSize:9,color:"#8fa4bd"}}>Medya: {check.imageAssets} görsel · {check.videoAssets} video · Onaylı hazır plan: {check.readyPosts}</p>
            {check.platform === "Instagram" && check.quota ? <p style={{margin:"5px 0 0",fontSize:9,color:"#93c5fd"}}>Instagram kotası: {check.quota.remaining ?? "?"}/{check.quota.quotaTotal ?? "?"}</p> : null}
            <p style={{margin:"5px 0 0",fontSize:9,color:"#8fa4bd"}}>Destek: {check.capabilities.join(" · ")}{check.manualOnly?.length?` · Manuel: ${check.manualOnly.join(", ")}`:""}</p>
          </article>)}
        </div>
        {(readiness.blocked ?? []).map((blocked) => <div key={`${blocked.villa}-${blocked.platform}-blocked`} style={{marginTop:9,padding:"10px 12px",border:"1px solid #a1620766",borderRadius:10,background:"#241a06",color:"#fbbf24",fontSize:10}}><strong>Villa {blocked.villa} · {blocked.platform} · HARD BLOCK</strong> — {blocked.reason}</div>)}
      </> : null}

      {plans.length ? <div style={{marginTop:14,borderTop:"1px solid #203b59",paddingTop:14}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div><strong style={{fontSize:12}}>Kontrollü test planları</strong><p style={{margin:"3px 0 0",fontSize:10,color:"#8fa4bd"}}>Planları başka yerde aramanız gerekmez. Onay ve gerçek yayın burada, tek tek yapılır.</p></div>
          <span style={{fontSize:10,color:"#93c5fd",fontWeight:900}}>{plans.length}/4 aktif plan bulundu</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:9,marginTop:10}}>
          {plans.map((plan) => {
            const published = plan.status === "Yayınlandı";
            const approved = plan.approvalStatus === "Onaylandı";
            const busy = working === plan.id;
            const blocked = isMetaTargetHardBlocked(plan.villa, plan.platform);
            return <article key={plan.id} style={{padding:12,border:`1px solid ${published?"#22c55e66":approved?"#3b82f666":"#475569"}`,borderRadius:12,background:"#071321"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                <strong style={{fontSize:11}}>Villa {plan.villa} · {plan.platform}</strong>
                <b style={{fontSize:9,color:blocked?"#fbbf24":published?"#86efac":approved?"#93c5fd":"#fbbf24"}}>{blocked?"HARD BLOCK":published?"✓ Yayınlandı":approved?"Onaylandı":"İnsan onayı bekliyor"}</b>
              </div>
              <p style={{margin:"7px 0 0",fontSize:9,color:"#9fb0c5",lineHeight:1.45}}>{plan.caption.split("\n")[0]}</p>
              {plan.lastPublishError ? <p style={{margin:"6px 0 0",fontSize:9,color:"#fca5a5"}}>Son hata: {plan.lastPublishError}</p> : null}
              {plan.platformPostId ? <p style={{margin:"6px 0 0",fontSize:9,color:"#86efac"}}>Meta ID: {plan.platformPostId}</p> : null}
              <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
                <button type="button" onClick={() => approve(plan)} disabled={blocked || busy || published || approved} style={{border:"1px solid #3b82f666",borderRadius:8,padding:"8px 10px",background:!blocked&&!published&&!approved?"#172554":"#17263c",color:!blocked&&!published&&!approved?"#bfdbfe":"#64748b",fontSize:10,fontWeight:900,cursor:!blocked&&!published&&!approved?"pointer":"not-allowed"}}>{blocked?"HARD BLOCK":busy?"İşleniyor…":approved?"✓ Onaylandı":"1. İnsan onayı ver"}</button>
                <button type="button" onClick={() => publish(plan)} disabled={blocked || busy || published || !approved} style={{border:"1px solid #22c55e66",borderRadius:8,padding:"8px 10px",background:!blocked&&approved&&!published?"#123522":"#17263c",color:!blocked&&approved&&!published?"#bbf7d0":"#64748b",fontSize:10,fontWeight:900,cursor:!blocked&&approved&&!published?"pointer":"not-allowed"}}>{blocked?"Yayın kapalı":published?"✓ Gerçek yayın tamam":busy?"Yayınlanıyor…":"2. Gerçek yayını gönder"}</button>
              </div>
            </article>;
          })}
        </div>
      </div> : null}
    </div>
  </section>;
}
