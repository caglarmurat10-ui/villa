"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MetaSocialAccount } from "@/lib/meta-store";
import { contentScore } from "@/lib/social-rules";
import { formatTurkishDateRange } from "@/lib/social-templates";
import type { SocialBrandProfile, SocialCampaign, SocialMediaLibraryItem, SocialVillaSettings } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";
import SocialNav from "./SocialNav";
import AiTodayWidget from "./AiTodayWidget";
import styles from "./SocialOperations.module.css";

type Gap = {
  villa: Villa; startDate: string; endDate: string; nights: number; classificationLabel: string;
  isLastMinute: boolean; priority: "normal" | "high"; suggestedMedia: SocialMediaLibraryItem | null;
};
type SettingItem = { settings: SocialVillaSettings; brand: SocialBrandProfile };
type ScheduledItem = { villa: Villa; status: string; scheduledAt: string };

function defaultSchedule() {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(future).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T19:30`;
}

async function json(response: Response) {
  return await response.json().catch(() => ({})) as Record<string, unknown>;
}

export default function SocialOperationsCenter({ accounts }: { accounts: MetaSocialAccount[] }) {
  const [days, setDays] = useState(90);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [media, setMedia] = useState<SocialMediaLibraryItem[]>([]);
  const [settingItems, setSettingItems] = useState<SettingItem[]>([]);
  const [activeDraft, setActiveDraft] = useState<SocialCampaign | null>(null);
  const [draftCaption, setDraftCaption] = useState("");
  const [draftMediaId, setDraftMediaId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [availabilityResponse, calendarResponse, settingsResponse] = await Promise.all([
      fetch(`/api/social/availability?days=${days}`), fetch("/api/social/calendar"), fetch("/api/social/settings"),
    ]);
    const [availability, calendar, settings] = await Promise.all([
      json(availabilityResponse), json(calendarResponse), json(settingsResponse),
    ]);
    if (availabilityResponse.ok) setGaps((availability.gaps as Gap[]) ?? []);
    if (calendarResponse.ok) {
      setCampaigns((calendar.campaigns as SocialCampaign[]) ?? []);
      setScheduled((calendar.scheduled as ScheduledItem[]) ?? []);
      setMedia((calendar.media as SocialMediaLibraryItem[]) ?? []);
    }
    if (settingsResponse.ok) setSettingItems((settings.items as SettingItem[]) ?? []);
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`/api/social/availability?days=${days}`),
      fetch("/api/social/calendar"),
      fetch("/api/social/settings"),
    ]).then(async ([availabilityResponse, calendarResponse, settingsResponse]) => {
      const [availability, calendar, settings] = await Promise.all([
        json(availabilityResponse), json(calendarResponse), json(settingsResponse),
      ]);
      if (cancelled) return;
      if (availabilityResponse.ok) setGaps((availability.gaps as Gap[]) ?? []);
      if (calendarResponse.ok) {
        setCampaigns((calendar.campaigns as SocialCampaign[]) ?? []);
        setScheduled((calendar.scheduled as ScheduledItem[]) ?? []);
        setMedia((calendar.media as SocialMediaLibraryItem[]) ?? []);
      }
      if (settingsResponse.ok) setSettingItems((settings.items as SettingItem[]) ?? []);
    });
    return () => { cancelled = true; };
  }, [days]);

  const summary = useMemo(() => (["Destan", "Safira"] as const).map((villa) => ({
    villa, connected: accounts.some((account) => account.villa === villa),
    planned: scheduled.filter((item) => item.villa === villa && ["scheduled", "processing"].includes(item.status)).length,
    published: scheduled.filter((item) => item.villa === villa && item.status === "published").length,
  })), [accounts, scheduled]);

  async function createDraft(gap: Gap, intent: "create" | "schedule") {
    setBusy(true); setNotice("");
    const response = await fetch("/api/social/campaigns", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", villa: gap.villa, startDate: gap.startDate, endDate: gap.endDate }) });
    const data = await json(response);
    setBusy(false);
    if (!response.ok) { setNotice(String(data.error ?? "Taslak oluşturulamadı.")); return; }
    const campaign = data.campaign as SocialCampaign;
    setActiveDraft(campaign); setDraftCaption(campaign.caption); setDraftMediaId(campaign.mediaIds[0] ?? "");
    setNotice(intent === "schedule" ? "Taslak hazır. Medyayı ve zamanı kontrol edip planlayın." : "İçerik taslağı hazırlandı.");
    await load();
  }

  async function ignore(gap: Gap) {
    const response = await fetch("/api/social/campaigns", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ignore", villa: gap.villa, startDate: gap.startDate, endDate: gap.endDate }) });
    if (response.ok) { setNotice("Müsaitlik önerisi yoksayıldı."); await load(); }
  }

  async function scheduleDraft() {
    if (!activeDraft) return;
    setBusy(true); setNotice("");
    const update = await fetch(`/api/social/campaigns/${activeDraft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: draftCaption, mediaIds: draftMediaId ? [draftMediaId] : [] }) });
    if (!update.ok) { const data = await json(update); setNotice(String(data.error ?? "Taslak güncellenemedi.")); setBusy(false); return; }
    const response = await fetch("/api/social/campaigns", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "schedule", campaignId: activeDraft.id, scheduledAt }) });
    const data = await json(response); setBusy(false);
    if (!response.ok) { setNotice(String(data.error ?? "Kampanya planlanamadı.")); return; }
    setNotice("Kampanya planlandı. Yayın öncesi müsaitlik yeniden kontrol edilecek."); setActiveDraft(null); await load();
  }

  async function saveSettings(item: SettingItem) {
    setBusy(true);
    const response = await fetch("/api/social/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    const data = await json(response); setBusy(false);
    setNotice(response.ok ? `Villa ${item.settings.villa} sosyal medya ayarları kaydedildi.` : String(data.error ?? "Ayarlar kaydedilemedi."));
    if (response.ok) await load();
  }

  function updateSetting(villa: Villa, update: (item: SettingItem) => SettingItem) {
    setSettingItems((items) => items.map((item) => item.settings.villa === villa ? update(item) : item));
  }

  const selectedMedia = media.find((item) => item.id === draftMediaId);
  const score = contentScore({ caption: draftCaption, hasCta: /DM|WhatsApp|ulaş/i.test(draftCaption),
    hasMedia: Boolean(selectedMedia), dateValid: Boolean(scheduledAt), mediaRecentlyUsed: false,
    duplicate: false, availabilityValid: Boolean(activeDraft?.availabilityStart) });

  return <main className={styles.page}><div className={styles.shell}>
    <SocialNav />
    <section className={styles.hero}><div><span className={styles.eyebrow}>SOSYAL MEDYA OPERASYON MERKEZİ</span>
      <h1>İçerik, takvim ve performans tek yerde</h1><p>Müsait tarihleri güvenli kampanyalara dönüştürün; pilotu yalnız hazır olduğunuzda açın.</p></div>
      <div className={styles.summary}>{summary.map((item) => <article key={item.villa}><span>Villa {item.villa}</span>
        <b>{item.connected ? "✓ Instagram bağlı" : "Bağlantı gerekli"}</b><small>{item.planned} planlı · {item.published} yayınlandı</small></article>)}</div></section>
    <div className={styles.linkCards}><a href="/sosyal/yayinla"><strong>Şimdi yayınla</strong><span>Fotoğraf, Carousel veya Reels</span></a>
      <a href="/sosyal/takvim"><strong>İçerik takvimi</strong><span>Taslak ve planlı yayınlar</span></a>
      <a href="/sosyal/medya"><strong>Medya kütüphanesi</strong><span>Kalıcı villa fotoğraf ve videoları</span></a>
      <a href="/sosyal/istatistik"><strong>Performans</strong><span>Gerçek Instagram insights</span></a></div>
    {notice ? <p className={styles.message}>{notice}</p> : null}
    <AiTodayWidget />
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>OTOMATİK UYGUNLUK</span><h2>Rezervasyon takvimindeki boşluklar</h2></div>
      <div className={`${styles.toolbar} ${styles.horizon}`}>{[30,60,90,180].map((value) => <button key={value} className={days === value ? styles.active : ""} onClick={() => setDays(value)}>{value} gün</button>)}</div></div>
      <div className={styles.grid}>{(["Destan","Safira"] as const).map((villa) => <div key={villa}><h3>Villa {villa}</h3><div className={styles.gapList}>
        {gaps.filter((gap) => gap.villa === villa).slice(0, 8).map((gap) => <article className={styles.gap} key={`${gap.startDate}-${gap.endDate}`}><div className={styles.gapTop}><strong>{formatTurkishDateRange(gap.startDate, gap.endDate)}</strong><small>{gap.nights} gece</small></div>
          <div className={styles.tags}><span className={styles.tag}>{gap.classificationLabel}</span>{gap.isLastMinute ? <span className={`${styles.tag} ${styles.urgent}`}>{gap.priority === "high" ? "Yüksek öncelik" : "Son dakika"}</span> : null}</div>
          <div className={styles.actions}><button className={styles.success} disabled={busy} onClick={() => createDraft(gap,"create")}>İçerik oluştur</button><button className={styles.primary} disabled={busy} onClick={() => createDraft(gap,"schedule")}>Planla</button><button className={styles.button} onClick={() => ignore(gap)}>Yoksay</button></div></article>)}
        {!gaps.some((gap) => gap.villa === villa) ? <div className={styles.empty}>Seçilen dönemde uygun boşluk yok.</div> : null}</div></div>)}</div></section>
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>AUTOMATIC SOCIAL PILOT</span><h2>Her villa için kontrollü otomasyon</h2></div><span className={styles.muted}>Varsayılan kapalı</span></div>
      <div className={styles.pilotGrid}>{settingItems.map((item) => <article className={styles.pilot} key={item.settings.villa}><div className={styles.pilotTop}><strong>Villa {item.settings.villa}</strong><label className={styles.switch}><input type="checkbox" checked={item.settings.pilotEnabled} onChange={(event) => updateSetting(item.settings.villa, (current) => ({...current,settings:{...current.settings,pilotEnabled:event.target.checked}}))}/>{item.settings.pilotEnabled ? "Açık" : "Kapalı"}</label></div>
        <div className={styles.fields}><label>Haftalık hedef<select value={item.settings.weeklyTarget} onChange={(event) => updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,weeklyTarget:Number(event.target.value)}}))}>{[1,2,3,4,5,6,7].map((value)=><option key={value}>{value}</option>)}</select></label>
          <label>Yayın saatleri<input value={item.settings.preferredTimes.join(", ")} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,preferredTimes:event.target.value.split(",").map((value)=>value.trim()).filter(Boolean)}}))}/></label>
          <label>Minimum boşluk<input type="number" min="1" max="30" value={item.settings.minGapNights} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,minGapNights:Number(event.target.value)}}))}/></label>
          <label>İleri kampanya<select value={item.settings.maxCampaignDays} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,maxCampaignDays:Number(event.target.value)}}))}>{[30,60,90,180].map((value)=><option key={value}>{value} gün</option>)}</select></label>
          <label>Son dakika eşiği<input type="number" min="1" max="30" value={item.settings.lastMinuteDays} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,lastMinuteDays:Number(event.target.value)}}))}/></label>
          <label className={styles.switch}><input type="checkbox" checked={item.settings.includePrice} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,includePrice:event.target.checked}}))}/> Fiyatı metinde göster</label>
          <label>Görünen ad<input value={item.brand.displayName} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,brand:{...current.brand,displayName:event.target.value}}))}/></label>
          <label>Instagram kullanıcı adı<input value={item.brand.instagramUsername} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,brand:{...current.brand,instagramUsername:event.target.value}}))}/></label>
          <label>Varsayılan CTA<input value={item.brand.defaultCta} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,brand:{...current.brand,defaultCta:event.target.value}}))}/></label>
          <label>Emoji stili<select value={item.brand.emojiStyle} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,brand:{...current.brand,emojiStyle:event.target.value}}))}><option value="natural">Doğal</option><option value="minimal">Az</option><option value="none">Yok</option></select></label>
          <label>Website<input value={item.brand.website} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,brand:{...current.brand,website:event.target.value}}))}/></label>
          <label>WhatsApp<input value={item.brand.whatsapp} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,brand:{...current.brand,whatsapp:event.target.value}}))}/></label>
          <label>Villa tanıtımı %<input type="number" min="0" max="100" value={item.settings.contentMix.villa} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,contentMix:{...current.settings.contentMix,villa:Number(event.target.value)}}}))}/></label>
          <label>Müsaitlik %<input type="number" min="0" max="100" value={item.settings.contentMix.availability} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,contentMix:{...current.settings.contentMix,availability:Number(event.target.value)}}}))}/></label>
          <label>Patara / çevre %<input type="number" min="0" max="100" value={item.settings.contentMix.region} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,contentMix:{...current.settings.contentMix,region:Number(event.target.value)}}}))}/></label>
          <label>Özel içerik %<input type="number" min="0" max="100" value={item.settings.contentMix.special} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,contentMix:{...current.settings.contentMix,special:Number(event.target.value)}}}))}/></label>
          <label className={styles.wide}>Özel caption şablonları<textarea rows={3} value={item.brand.customTemplates.join("\n")} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,brand:{...current.brand,customTemplates:event.target.value.split("\n").filter(Boolean)}}))}/></label>
          <label className={styles.switch}><input type="checkbox" checked={item.settings.whatsappCta} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,whatsappCta:event.target.checked}}))}/> WhatsApp CTA</label>
          <label className={styles.switch}><input type="checkbox" checked={item.settings.websiteCta} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,websiteCta:event.target.checked}}))}/> Site CTA</label></div>
        <button className={styles.primary} disabled={busy} onClick={()=>saveSettings(item)}>Villa {item.settings.villa} ayarlarını kaydet</button></article>)}</div></section>
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>İÇERİK DENGESİ</span><h2>Son 9 kampanya</h2></div></div><div className={styles.balance}>{campaigns.slice(0,9).map((item)=><span key={item.id}>{item.villa}<br/>{item.contentCategory ?? item.campaignType}</span>)}{!campaigns.length?<div className={styles.empty}>Henüz kampanya yok.</div>:null}</div></section>
    {activeDraft ? <div className={styles.modal} role="dialog" aria-modal="true"><div className={styles.modalCard}><h2>Villa {activeDraft.villa} kampanya taslağı</h2><div className={styles.form}>
      <label>Caption<textarea rows={10} maxLength={2200} value={draftCaption} onChange={(event)=>setDraftCaption(event.target.value)}/></label>
      <label>Medya<select value={draftMediaId} onChange={(event)=>setDraftMediaId(event.target.value)}><option value="">Medya seçin</option>{media.filter((item)=>item.villa===activeDraft.villa&&item.active).map((item)=><option value={item.id} key={item.id}>{item.category} · {item.label||item.filename}</option>)}</select></label>
      <label>Yayın zamanı (Türkiye)<input type="datetime-local" value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label>
      <div className={styles.score}><strong>İçerik skoru: {score.score}/100</strong>{score.reasons.length?<ul>{score.reasons.map((reason)=><li key={reason}>{reason}</li>)}</ul>:null}</div>
      <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={scheduleDraft}>Planlı yayına ekle</button><button className={styles.button} onClick={()=>setActiveDraft(null)}>Kapat</button></div></div></div></div>:null}
  </div></main>;
}
