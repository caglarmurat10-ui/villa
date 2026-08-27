"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AiConfigurationStatus } from "@/lib/aiConfiguration";
import type { AiSocialSettings } from "@/lib/aiDb";
import type { AiContentOutput, AiMode, AiPurpose, VillaAiProfile } from "@/lib/aiTypes";
import type { PexelsResult } from "@/lib/pexels";
import type { Villa } from "@/lib/types";
import SocialNav from "./SocialNav";
import baseStyles from "./SocialOperations.module.css";
import aiStyles from "./AiContentStudio.module.css";

const styles = { ...baseStyles, ...aiStyles };

type SettingItem = { settings: AiSocialSettings; profile: VillaAiProfile; systemFlags: { image: boolean; video: boolean } };
type TodayItem = { villa: Villa; category: string; suggestion: string; reason: string; enabled: boolean; autopilotLevel: string; historyAvailable?: boolean };
type Usage = { service?: string; operation?: string; model?: string; villa?: Villa; calls?: number; estimated_units?: number };
type ResearchIdea = { id?: string; topic?: string; summary?: string; content_angle?: string; sourceUrls?: string[]; sourceTitles?: string[]; expires_at?: string };

function AiStatus({ configuration }: { configuration: AiConfigurationStatus }) {
  return <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>AI DURUMU</span><h2>Opsiyonel servisler</h2></div></div>
    <div className={styles.statusGrid}>
      <span>OpenAI: <strong>{configuration.openAiConfigured ? "Yapılandırıldı" : "Yapılandırılmadı"}</strong></span>
      <span>Pexels: <strong>{configuration.pexelsConfigured ? "Yapılandırıldı" : "Yapılandırılmadı"}</strong></span>
      <span>AI Autopilot: <strong>{configuration.autopilotEnabled ? "Açık" : "Kapalı"}</strong></span>
    </div>
  </section>;
}

const regionalTopics = ["Patara Antik Kenti", "Patara Plajı", "Kaş", "Kalkan", "Kaputaş", "Saklıkent", "Xanthos",
  "Letoon", "Likya Yolu", "Kekova", "Kaleköy", "Yerel gastronomi", "Doğa", "Gün batımı", "Mevsimsel gezi önerileri"];
const purposes: Array<[AiPurpose, string]> = [["villa","Villa Tanıtımı"],["availability","Müsaitlik"],["last-minute","Son Dakika"],
  ["regional-guide","Bölge Rehberi"],["travel","Gezi Önerisi"],["reels","Reels"],["carousel","Carousel"],["story","Story fikri"]];
const modes: Array<[AiMode, string]> = [["quick","Hızlı"],["creative","Yaratıcı"],["sales","Satış Odaklı"]];

async function data(response: Response) { return response.json().catch(() => ({})) as Promise<Record<string, unknown>>; }

export default function AiContentStudio() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [configuration, setConfiguration] = useState<AiConfigurationStatus | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [settingItems, setSettingItems] = useState<SettingItem[]>([]);
  const [today, setToday] = useState<TodayItem[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [researchIdeas, setResearchIdeas] = useState<ResearchIdea[]>([]);
  const [villa, setVilla] = useState<Villa>("Destan");
  const [mode, setMode] = useState<AiMode>("quick");
  const [purpose, setPurpose] = useState<AiPurpose>("villa");
  const [brief, setBrief] = useState("");
  const [weekly, setWeekly] = useState(false);
  const [output, setOutput] = useState<AiContentOutput | null>(null);
  const [topic, setTopic] = useState(regionalTopics[0]);
  const [pexelsQuery, setPexelsQuery] = useState("Patara Turkey");
  const [pexelsKind, setPexelsKind] = useState<"photo" | "video">("photo");
  const [pexelsResults, setPexelsResults] = useState<PexelsResult[]>([]);
  const [imagePrompt, setImagePrompt] = useState("Patara temalı zarif yaz tatili duyurusu");
  const [notice, setNotice] = useState("");
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const endpoints = ["/api/social/ai/settings", "/api/social/ai/today", "/api/social/ai/research"] as const;
    const results = await Promise.allSettled(endpoints.map(async (endpoint) => {
      const response = await fetch(endpoint); return { response, body: await data(response) };
    }));
    if (results.some((result) => result.status === "fulfilled" && result.value.response.status === 401)) {
      setAuthenticated(false); return;
    }
    const section = (index: number) => {
      const result = results[index]; return result?.status === "fulfilled" && result.value.response.ok ? result.value.body : null;
    };
    const settings = section(0), suggestions = section(1), research = section(2);
    const warnings = [
      ...(settings ? (settings.warnings as string[] | undefined) ?? [] : ["AI ayarları şu anda yüklenemedi. Lütfen yeniden deneyin."]),
      ...(suggestions ? (suggestions.warnings as string[] | undefined) ?? [] : ["İçerik geçmişi şu anda yüklenemedi. İçerik üretmeye devam edebilirsiniz."]),
      ...(research ? (research.warnings as string[] | undefined) ?? [] : ["Bölgesel fikirler şu anda yüklenemedi. İçerik üretmeye devam edebilirsiniz."]),
    ];
    if (settings?.configuration) setConfiguration(settings.configuration as AiConfigurationStatus);
    setSettingItems((settings?.items as SettingItem[]) ?? []); setUsage((settings?.usage as Usage[]) ?? []);
    setToday((suggestions?.items as TodayItem[]) ?? []); setResearchIdeas((research?.items as ResearchIdea[]) ?? []);
    setLoadWarnings([...new Set(warnings)]); setAuthenticated(true);
  }, []);

  useEffect(() => { void fetch("/api/social/ai/session").then(data).then((result) => {
    if (result.configuration) setConfiguration(result.configuration as AiConfigurationStatus);
    const active = result.authenticated === true; setAuthenticated(active); if (active) void load();
  }); }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice("");
    const response = await fetch("/api/social/ai/session", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey }) });
    const result = await data(response); setAccessKey(""); setBusy(false);
    if (!response.ok) { setNotice(String(result.error ?? "Giriş yapılamadı.")); return; }
    setAuthenticated(true); await load();
  }

  function updateSetting(target: Villa, update: (item: SettingItem) => SettingItem) {
    setSettingItems((items) => items.map((item) => item.settings.villa === target ? update(item) : item));
  }

  async function saveSettings(item: SettingItem) {
    setBusy(true); const response = await fetch("/api/social/ai/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
    const result = await data(response); setBusy(false); setNotice(response.ok ? `Villa ${item.settings.villa} AI ayarları kaydedildi.` : String(result.error ?? "Ayarlar kaydedilemedi."));
    if (response.ok) await load();
  }

  async function createContent() {
    setBusy(true); setOutput(null); setNotice("AI taslağı hazırlanıyor...");
    const response = await fetch("/api/social/ai/content", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ villa, mode, purpose, userBrief: brief, weekly }) });
    const result = await data(response); setBusy(false);
    if (!response.ok) { setNotice(String(result.error ?? "İçerik üretilemedi.")); return; }
    setOutput(result.output as AiContentOutput); setNotice(weekly ? "Haftalık plan taslak olarak kaydedildi." : "AI içerik taslağı kaydedildi; otomatik yayın yapılmadı."); await load();
  }

  async function research() {
    setBusy(true); setNotice("Kaynaklı bölgesel araştırma hazırlanıyor...");
    const response = await fetch("/api/social/ai/research", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ villa, topic, region: "Patara, Kaş, Kalkan" }) });
    const result = await data(response); setBusy(false);
    setNotice(response.ok ? (result.cached ? "Önbellekteki doğrulanmış araştırma kullanıldı." : "Yeni kaynaklı araştırma kaydedildi.") : String(result.error ?? "Araştırma yapılamadı."));
    if (response.ok) await load();
  }

  async function searchMedia() {
    setBusy(true); setNotice(""); const response = await fetch(`/api/social/ai/pexels?kind=${pexelsKind}&query=${encodeURIComponent(pexelsQuery)}`);
    const result = await data(response); setBusy(false); setPexelsResults(response.ok ? (result.items as PexelsResult[]) ?? [] : []);
    if (!response.ok) setNotice(String(result.error ?? "Pexels araması yapılamadı."));
  }

  async function importMedia(item: PexelsResult) {
    setBusy(true); const response = await fetch("/api/social/ai/pexels", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ villa, kind: item.kind, id: item.id, query: pexelsQuery }) });
    const result = await data(response); setBusy(false); setNotice(response.ok ? "Pexels medyası kaynak bilgisiyle kütüphaneye eklendi." : String(result.error ?? "Medya eklenemedi."));
  }

  async function createImage() {
    setBusy(true); setNotice("AI illüstrasyonu oluşturuluyor...");
    const response = await fetch("/api/social/ai/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ villa, prompt: imagePrompt }) });
    const result = await data(response); setBusy(false); setNotice(response.ok ? "AI illüstrasyonu işaretlenerek medya kütüphanesine eklendi." : String(result.error ?? "Görsel oluşturulamadı."));
  }

  const activeSettings = settingItems.find((item) => item.settings.villa === villa);
  if (authenticated === null) return <main className={styles.page}><div className={styles.shell}><SocialNav/><section className={styles.panel}>AI merkezi yükleniyor...</section></div></main>;
  if (!authenticated) return <main className={styles.page}><div className={styles.shell}><SocialNav/>
    {configuration ? <AiStatus configuration={configuration}/> : null}
    <section className={styles.authCard}><span className={styles.eyebrow}>KORUMALI ALAN</span><h1>AI İçerik Stüdyosu</h1>
      {!configuration?.adminConfigured ? <><p className={styles.notice}>AI yönetici erişimi yapılandırılmadı. Mevcut uygulama, Instagram yayınları ve hazır içerik şablonları çalışmaya devam eder.</p>
        {!configuration?.openAiConfigured ? <p className={styles.muted}>OpenAI yapılandırılmadı.</p> : null}
        {!configuration?.pexelsConfigured ? <p className={styles.muted}>Pexels yapılandırılmadı; kendi villa medyalarınızı kullanabilirsiniz.</p> : null}</>
        : <><p className={styles.muted}>Ücretli AI çağrıları ve medya aktarımları yönetici oturumuyla korunur.</p>
          {notice ? <p className={styles.notice}>{notice}</p> : null}<form className={styles.form} onSubmit={login}><label>AI yönetici erişim anahtarı<input type="password" autoComplete="current-password" value={accessKey} onChange={(event)=>setAccessKey(event.target.value)} required/></label><button className={styles.primary} disabled={busy}>Güvenli giriş</button></form></>}
    </section></div></main>;

  return <main className={styles.page}><div className={styles.shell}><SocialNav/>
    <section className={styles.hero}><div><span className={styles.eyebrow}>AI İÇERİK STÜDYOSU</span><h1>Fikirden kontrollü taslağa</h1><p>Doğrulanmış villa bilgisi, gerçek içerik geçmişi ve kaynaklı bölge araştırması kullanılır. AI kendi kendine yayın yapmaz.</p></div><div className={styles.statusStack}><span>Metin: kullanıcı isteğiyle</span><span>Görsel: varsayılan kapalı</span><span>Video: mimari hazır, çağrı kapalı</span></div></section>
    {configuration ? <AiStatus configuration={configuration}/> : null}
    {loadWarnings.map((warning)=><p className={styles.notice} key={warning}>{warning}</p>)}
    {notice ? <p className={styles.message}>{notice}</p> : null}
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>BUGÜN NE PAYLAŞALIM?</span><h2>İçerik geçmişine dayalı öneriler</h2></div></div><div className={styles.grid}>{today.map((item)=><article className={styles.ideaCard} key={item.villa}><strong>Villa {item.villa}</strong><p>{item.suggestion}</p><small>Neden: {item.reason}</small><span>AI autopilot: {item.autopilotLevel === "off" ? "Kapalı" : item.autopilotLevel}</span></article>)}</div></section>
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>İÇERİK ÜRET</span><h2>Caption, Carousel, Reels ve haftalık plan</h2></div></div><div className={styles.fields}>
      <label>Villa<select value={villa} onChange={(event)=>setVilla(event.target.value as Villa)}><option>Destan</option><option>Safira</option></select></label>
      <label>AI modu<select value={mode} onChange={(event)=>setMode(event.target.value as AiMode)}>{modes.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label>İçerik amacı<select value={purpose} onChange={(event)=>setPurpose(event.target.value as AiPurpose)}>{purposes.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label className={styles.switch}><input type="checkbox" checked={weekly} onChange={(event)=>setWeekly(event.target.checked)}/> 7 günlük plan taslağı</label>
      <label className={styles.wide}>Ek istek<textarea rows={4} maxLength={1000} value={brief} onChange={(event)=>setBrief(event.target.value)} placeholder="Örn. sakin, samimi ve kısa bir carousel..."/></label></div>
      <button className={styles.primary} disabled={busy || !configuration?.openAiConfigured || !activeSettings?.settings.aiEnabled} onClick={createContent}>{weekly ? "Haftalık plan taslağı üret" : "AI içerik taslağı üret"}</button>
      {!configuration?.openAiConfigured ? <p className={styles.muted}>OpenAI yapılandırılmadı; hazır caption ve kampanya şablonları çalışmaya devam eder.</p>
        : !activeSettings?.settings.aiEnabled ? <p className={styles.muted}>Önce aşağıdaki Villa {villa} AI ayarını açın.</p> : null}
      {output ? <div className={styles.aiOutput}><h3>{output.title}</h3><strong>{output.hook}</strong><p>{output.caption}</p><div className={styles.tags}>{output.hashtags.map((tag)=><span className={styles.tag} key={tag}>{tag}</span>)}</div>{output.carouselSlides.length?<ol>{output.carouselSlides.map((slide)=><li key={slide}>{slide}</li>)}</ol>:null}{output.reelsStoryboard.length?<div>{output.reelsStoryboard.map((scene)=><p key={`${scene.startSecond}-${scene.endSecond}`}><b>{scene.startSecond}–{scene.endSecond} sn:</b> {scene.scene} · {scene.overlayText}</p>)}</div>:null}{output.weeklyPlan.length?<div>{output.weeklyPlan.map((item)=><p key={`${item.day}-${item.villa}`}><b>{item.day} · {item.villa}:</b> {item.topic} ({item.contentType})</p>)}</div>:null}</div>:null}
    </section>
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>BÖLGE ARAŞTIRMA MOTORU</span><h2>Patara, Kaş ve Kalkan için kaynaklı fikirler</h2></div></div><div className={styles.toolbar}><select value={topic} onChange={(event)=>setTopic(event.target.value)}>{regionalTopics.map((item)=><option key={item}>{item}</option>)}</select><button className={styles.primary} disabled={busy || !configuration?.openAiConfigured || !activeSettings?.settings.aiEnabled} onClick={research}>Kaynaklarla araştır</button></div>
      <div className={styles.ideaList}>{researchIdeas.slice(0,8).map((idea)=><article className={styles.ideaCard} key={idea.id}><strong>{idea.topic}</strong><p>{idea.summary}</p><small>{idea.content_angle}</small><div><b>Kaynaklar</b>{(idea.sourceUrls??[]).map((url,index)=><a href={url} target="_blank" rel="noreferrer" key={url}>{idea.sourceTitles?.[index]??new URL(url).hostname}</a>)}</div></article>)}</div></section>
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>PEXELS MEDYA</span><h2>Lisans ve kaynak bilgisi korunan fotoğraf/video</h2></div></div><div className={styles.toolbar}><input value={pexelsQuery} onChange={(event)=>setPexelsQuery(event.target.value)} maxLength={100}/><select value={pexelsKind} onChange={(event)=>setPexelsKind(event.target.value as "photo"|"video")}><option value="photo">Fotoğraf</option><option value="video">Video</option></select><button className={styles.primary} disabled={busy || !configuration?.pexelsConfigured} onClick={searchMedia}>Pexels ara</button></div>
      {!configuration?.pexelsConfigured ? <p className={styles.muted}>Pexels yapılandırılmadı; kendi villa medya kütüphaneniz ve yayın sistemi kullanılabilir.</p> : null}
      <div className={styles.stockGrid}>{pexelsResults.map((item)=><article className={styles.mediaCard} key={`${item.kind}-${item.id}`}><div className={styles.stockPreview} style={{backgroundImage:`url(${item.previewUrl})`}}/><div className={styles.mediaBody}><strong>{item.photographer}</strong><p className={styles.muted}>{item.geographicClaim}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">Pexels kaynağı</a><button className={styles.success} disabled={busy} onClick={()=>importMedia(item)}>Villa {villa} kütüphanesine ekle</button></div></article>)}</div></section>
    <section className={styles.grid}><article className={styles.panel}><span className={styles.eyebrow}>AI GÖRSEL STÜDYOSU</span><h2>İllüstrasyon üretimi</h2><p className={styles.muted}>Gerçek villa görünümü uydurulmaz; çıktı “AI üretimi” olarak işaretlenir.</p><div className={styles.form}><label>Açıklama<textarea rows={4} value={imagePrompt} onChange={(event)=>setImagePrompt(event.target.value)}/></label><button className={styles.primary} disabled={busy || !activeSettings?.systemFlags.image || !activeSettings.settings.imageEnabled} onClick={createImage}>AI görsel oluştur</button></div></article>
      <article className={styles.panel}><span className={styles.eyebrow}>AI VIDEO / REELS</span><h2>Storyboard öncelikli</h2><p className={styles.muted}>15/30 saniyelik sahne, overlay, voice-over ve CTA metni içerik üreticisinden hazırlanır. Ücretli video API çağrısı ayrıca onaylanmadan çalışmaz.</p><span className={styles.tag}>AI_VIDEO_ENABLED=false varsayılan</span></article></section>
    <section className={styles.panel}><div className={styles.panelHead}><div><span className={styles.eyebrow}>AI AYARLARI VE MALİYET</span><h2>Villa bazlı sınırlar</h2></div><span className={styles.muted}>Aylık çağrılar: {usage.reduce((sum,item)=>sum+Number(item.calls??0),0)}</span></div><div className={styles.settingsGrid}>{settingItems.map((item)=><article className={styles.settingsBox} key={item.settings.villa}><h3>Villa {item.settings.villa}</h3><div className={styles.fields}>
      <label className={styles.switch}><input type="checkbox" checked={item.settings.aiEnabled} disabled={!configuration?.openAiConfigured} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,aiEnabled:event.target.checked}}))}/> AI açık</label>
      <label>Autopilot<select value={item.settings.autopilotLevel} disabled={!configuration?.openAiConfigured} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,autopilotLevel:event.target.value as AiSocialSettings["autopilotLevel"]}}))}><option value="off">Kapalı</option><option value="suggestion">Öneri</option><option value="draft">Taslak</option><option value="auto_schedule">Otomatik plan isteği (taslakta bekler)</option></select></label>
      <label>Günlük metin çağrısı<input type="number" min="0" max="100" value={item.settings.dailyTextLimit} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,dailyTextLimit:Number(event.target.value)}}))}/></label>
      <label>Günlük web araştırması<input type="number" min="0" max="50" value={item.settings.dailyResearchLimit} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,dailyResearchLimit:Number(event.target.value)}}))}/></label>
      <label className={styles.switch}><input type="checkbox" checked={item.settings.imageEnabled} disabled={!item.systemFlags.image} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,imageEnabled:event.target.checked}}))}/> AI görsel</label>
      <label className={styles.switch}><input type="checkbox" checked={item.settings.videoEnabled} disabled={!item.systemFlags.video} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,videoEnabled:event.target.checked}}))}/> AI video</label>
      <label className={styles.wide}>Doğrulanmış villa gerçekleri<textarea rows={5} value={item.profile.facts.join("\n")} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,profile:{...current.profile,facts:event.target.value.split("\n").map((line)=>line.trim()).filter(Boolean)}}))}/></label>
      <label className={styles.wide}>Kesinlikle iddia edilmesin<textarea rows={3} value={item.profile.prohibitedClaims.join("\n")} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,profile:{...current.profile,prohibitedClaims:event.target.value.split("\n").map((line)=>line.trim()).filter(Boolean)}}))}/></label>
      {Object.entries(item.settings.contentMix).map(([key,value])=><label key={key}>{key} %<input type="number" min="0" max="100" value={value} onChange={(event)=>updateSetting(item.settings.villa,(current)=>({...current,settings:{...current.settings,contentMix:{...current.settings.contentMix,[key]:Number(event.target.value)}}}))}/></label>)}</div><button className={styles.primary} disabled={busy} onClick={()=>saveSettings(item)}>Ayarları kaydet</button></article>)}</div>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Servis</th><th>İşlem</th><th>Villa</th><th>Model</th><th>Çağrı</th><th>Tahmini birim</th></tr></thead><tbody>{usage.map((item,index)=><tr key={`${item.service}-${item.villa}-${index}`}><td>{item.service}</td><td>{item.operation}</td><td>{item.villa??"—"}</td><td>{item.model}</td><td>{item.calls}</td><td>{item.estimated_units??0}</td></tr>)}</tbody></table></div></section>
  </div></main>;
}
