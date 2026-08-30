"use client";

import { useState } from "react";

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

type Readiness = {
  checkedAt: string;
  ready: boolean;
  accountsReady: boolean;
  mediaReady: boolean;
  checks: Check[];
};

export default function MetaPublishTestCenter() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [preparing, setPreparing] = useState(false);

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
        ? "✓ Dört Meta hedefi ve doğrulanmış Drive medya havuzu yayın testine hazır."
        : "Ön kontrolde eksik var; kırmızı satırlar düzeltilmeden gerçek yayın yapılmayacak.");
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
      setNotice(`${data.message} Yeni: ${data.createdCount}, mevcut: ${data.existingCount}.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setNotice("Kontrollü yayın planları hazırlanırken bağlantı kurulamadı.");
    } finally {
      setPreparing(false);
    }
  }

  return <section style={{maxWidth:1250,margin:"12px auto",padding:"0 20px"}}>
    <div style={{border:"1px solid #2e5075",borderRadius:16,background:"linear-gradient(135deg,#0a1a2e,#081522)",padding:16,color:"#eef6ff"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div>
          <small style={{display:"block",fontSize:9,fontWeight:900,letterSpacing:1.4,color:"#93c5fd"}}>KONTROLLÜ META YAYIN TESTİ</small>
          <h2 style={{margin:"5px 0 4px",fontSize:18}}>Ön kontrol → güvenli plan → insan onayı → gerçek yayın</h2>
          <p style={{margin:0,maxWidth:760,color:"#9fb0c5",fontSize:11,lineHeight:1.55}}>Bu merkez Facebook ve Instagram hesaplarını, yayın kotasını ve doğrulanmış Safira/Destan medya havuzunu kontrol eder. Test planları otomatik hazırlanabilir ancak insan onayı verilmeden hiçbir içerik Meta'ya gönderilmez.</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button type="button" onClick={runCheck} disabled={checking} style={{border:0,borderRadius:10,padding:"10px 13px",background:"#1d4ed8",color:"white",fontSize:11,fontWeight:900,cursor:"pointer"}}>{checking?"Kontrol ediliyor…":"Ön kontrolü çalıştır"}</button>
          <button type="button" onClick={preparePlans} disabled={preparing || readiness?.ready !== true} style={{border:"1px solid #22c55e66",borderRadius:10,padding:"10px 13px",background:readiness?.ready?"#123522":"#17263c",color:readiness?.ready?"#bbf7d0":"#7f8ea3",fontSize:11,fontWeight:900,cursor:readiness?.ready?"pointer":"not-allowed"}}>{preparing?"Planlar hazırlanıyor…":"4 güvenli yayın planı hazırla"}</button>
        </div>
      </div>

      {notice ? <div style={{marginTop:12,padding:"10px 12px",borderRadius:10,background:"#071b16",border:"1px solid #22c55e44",color:"#bbf7d0",fontSize:11}}>{notice}</div> : null}

      {readiness ? <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:9,marginTop:12}}>
        {readiness.checks.map((check) => <article key={`${check.villa}-${check.platform}`} style={{padding:12,border:`1px solid ${check.ready?"#22c55e55":"#ef444466"}`,borderRadius:12,background:"#071321"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong style={{fontSize:11}}>Villa {check.villa} · {check.platform}</strong><b style={{fontSize:10,color:check.ready?"#86efac":"#fca5a5"}}>{check.ready?"✓ Hazır":"✕ Eksik"}</b></div>
          <p style={{margin:"7px 0 0",fontSize:10,color:"#b8c6d8"}}>{check.account ?? check.error ?? "Hesap doğrulanamadı"}</p>
          <p style={{margin:"5px 0 0",fontSize:9,color:"#8fa4bd"}}>Medya: {check.imageAssets} görsel · {check.videoAssets} video · Onaylı hazır plan: {check.readyPosts}</p>
          {check.platform === "Instagram" && check.quota ? <p style={{margin:"5px 0 0",fontSize:9,color:"#93c5fd"}}>Instagram kotası: {check.quota.remaining ?? "?"}/{check.quota.quotaTotal ?? "?"}</p> : null}
          <p style={{margin:"5px 0 0",fontSize:9,color:"#8fa4bd"}}>Destek: {check.capabilities.join(" · ")}{check.manualOnly?.length?` · Manuel: ${check.manualOnly.join(", ")}`:""}</p>
        </article>)}
      </div> : null}
    </div>
  </section>;
}
