"use client";

import { useState } from "react";
import type { StoredPlatformPackage } from "@/lib/platform-content-packages";
import type { Villa } from "@/lib/types";

type MediaOption = { fileId: string; fileName: string };

const PLATFORM_LABELS: Record<StoredPlatformPackage["platform"], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  pinterest: "Pinterest",
};

function PackageCard({ pkg, onConfirm, busy }: { pkg: StoredPlatformPackage; onConfirm: (id: string) => void; busy: boolean }) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const text = [pkg.title, pkg.caption, pkg.hashtags.map((h) => `#${h}`).join(" "), pkg.cta, pkg.utmUrl].filter(Boolean).join("\n\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <article style={{ padding: "10px 11px", border: "1px solid #223a57", borderRadius: 11, background: "#0b1728" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
        <strong style={{ fontSize: 10, color: "#93c5fd" }}>{PLATFORM_LABELS[pkg.platform]}</strong>
        <span style={{ fontSize: 9, color: "#8fa4bd" }}>{pkg.recommendedRatio}</span>
      </div>
      {pkg.title && <p style={{ margin: "6px 0 0", fontSize: 10, fontWeight: 700, color: "#dbeafe" }}>{pkg.title}</p>}
      <p style={{ margin: "6px 0 0", fontSize: 9, lineHeight: 1.5, color: "#b8c6d8", whiteSpace: "pre-wrap" }}>{pkg.caption}</p>
      <p style={{ margin: "6px 0 0", fontSize: 9, color: "#7f94ae" }}>{pkg.hashtags.map((h) => `#${h}`).join(" ")}</p>
      <p style={{ margin: "6px 0 0", fontSize: 9, color: "#86efac" }}>{pkg.cta}</p>
      <code style={{ display: "block", marginTop: 6, fontSize: 8, color: "#70869f", overflowWrap: "anywhere" }}>{pkg.utmUrl}</code>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" onClick={copyAll} style={{ border: "1px solid #47617f", borderRadius: 8, padding: "6px 9px", background: "#102238", color: "#dbeafe", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>
          {copied ? "✓ Kopyalandı" : "Metni kopyala"}
        </button>
        {pkg.manualPublishState === "MANUALLY_PUBLISHED" ? (
          <span style={{ fontSize: 9, fontWeight: 900, color: "#86efac", alignSelf: "center" }}>✓ Manuel paylaşıldı</span>
        ) : (
          <button type="button" onClick={() => onConfirm(pkg.id)} disabled={busy} style={{ border: "1px solid #1f5f3b", borderRadius: 8, padding: "6px 9px", background: "#0f2a1c", color: "#86efac", fontSize: 9, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
            Elle paylaştım - onayla
          </button>
        )}
      </div>
    </article>
  );
}

export default function ContentPackagesPanel({ initialPackages, mediaByVilla }: { initialPackages: StoredPlatformPackage[]; mediaByVilla: Record<Villa, MediaOption[]> }) {
  const [packages, setPackages] = useState(initialPackages);
  const [villa, setVilla] = useState<Villa>("Safira");
  const [mediaFileId, setMediaFileId] = useState(mediaByVilla.Safira[0]?.fileId ?? "");
  const [theme, setTheme] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  function onVillaChange(next: Villa) {
    setVilla(next);
    setMediaFileId(mediaByVilla[next][0]?.fileId ?? "");
  }

  async function generate() {
    if (!theme.trim() || !campaignId.trim() || !mediaFileId) {
      setNotice("Tema, kampanya adı ve medya seçimi zorunludur.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/content-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa, mediaFileId, theme, campaignId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Paketler oluşturulamadı.");
      setPackages((current) => [...(data.packages as StoredPlatformPackage[]), ...current]);
      setNotice(`✓ ${data.packages.length} platform paketi oluşturuldu.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Paketler oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPublished(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/content-packages/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Onaylanamadı.");
      setPackages((current) => current.map((p) => (p.id === id ? data.package : p)));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Onaylanamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px" }}>
      <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
        <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>ÇOK PLATFORMLU İÇERİK PAKETLERİ</small>
        <h2 style={{ margin: "5px 0 4px", fontSize: 18 }}>Gerçek medyadan platform paketleri</h2>
        <p style={{ margin: 0, color: "#9fb0c5", fontSize: 11 }}>Tek bir gerçek villa fotoğrafı/videosundan Instagram, Facebook, YouTube Shorts, TikTok ve Pinterest için ayrı caption/CTA/UTM üretir. Yalnız REAL_UPLOAD medya kullanılabilir.</p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <select value={villa} onChange={(e) => onVillaChange(e.target.value as Villa)} style={{ padding: "7px 9px", borderRadius: 8, background: "#0f172a", color: "#eef6ff", border: "1px solid #334155", fontSize: 11 }}>
            <option value="Safira">Villa Safira</option>
            <option value="Destan">Villa Destan</option>
          </select>
          <select value={mediaFileId} onChange={(e) => setMediaFileId(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, background: "#0f172a", color: "#eef6ff", border: "1px solid #334155", fontSize: 11, minWidth: 180 }}>
            {mediaByVilla[villa].map((item) => <option key={item.fileId} value={item.fileId}>{item.fileName}</option>)}
          </select>
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Tema (ör. Havuz, Bahçe)" style={{ padding: "7px 9px", borderRadius: 8, background: "#0f172a", color: "#eef6ff", border: "1px solid #334155", fontSize: 11 }} />
          <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="Kampanya adı (ör. destan_pool)" style={{ padding: "7px 9px", borderRadius: 8, background: "#0f172a", color: "#eef6ff", border: "1px solid #334155", fontSize: 11 }} />
          <button type="button" onClick={generate} disabled={busy} style={{ border: "1px solid #2563eb", borderRadius: 8, padding: "8px 12px", background: "#172554", color: "#bfdbfe", fontSize: 11, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Oluşturuluyor…" : "5 platform paketi oluştur"}
          </button>
        </div>

        {notice && <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 10, border: "1px solid #2e5075", background: "#0b1b2e", color: "#bfdbfe", fontSize: 10 }}>{notice}</div>}

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8 }}>
          {packages.slice(0, 20).map((pkg) => <PackageCard key={pkg.id} pkg={pkg} onConfirm={confirmPublished} busy={busy} />)}
        </div>
        {packages.length === 0 && <p style={{ marginTop: 12, fontSize: 11, color: "#8fa4bd" }}>Henüz paket oluşturulmadı.</p>}
      </div>
    </section>
  );
}
