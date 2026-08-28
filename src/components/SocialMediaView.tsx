"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SocialContentType, SocialPlatform, SocialPost, SocialPostStatus, Villa } from "@/lib/types";
import type { AvailabilityGap } from "@/lib/social-availability";
import type { SocialContentTemplate } from "@/lib/social-content-library";

const platforms: SocialPlatform[] = ["Instagram", "Facebook", "TikTok", "WhatsApp Durum"];
const types: Record<SocialPlatform, SocialContentType[]> = {
  Instagram: ["Gönderi", "Hikâye", "Reels"],
  Facebook: ["Gönderi", "Hikâye", "Reels"],
  TikTok: ["Gönderi", "Reels"],
  "WhatsApp Durum": ["Durum"],
};
const tone: Record<SocialPlatform, string> = { Instagram: "instagram", Facebook: "facebook", TikTok: "tiktok", "WhatsApp Durum": "whatsapp" };
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
const today = () => dateFmt.format(new Date());
const villaName = (v: Villa) => `Villa ${v}`;
const ideas = [
  ["Villa tanıtımı", (v: Villa) => `Doğayla iç içe, sakin ve keyifli bir tatil için ${villaName(v)} sizi bekliyor. Uygun tarihler ve rezervasyon bilgisi için mesaj gönderebilirsiniz.\n\n#Kaş #Patara #villa #villatatili #kiralıkvilla`],
  ["Hafta sonu", (v: Villa) => `Hafta sonunu huzur ve keyifle geçirmek isteyenlere: ${villaName(v)}. Patara, Kaş'ta özel villa tatili için uygunluk ve rezervasyon bilgisi mesajda. ✨\n\n#Kaş #Patara #villatatili`],
] as const;

function sort(posts: SocialPost[]) { return [...posts].sort((a,b) => a.status === b.status ? a.scheduledDate.localeCompare(b.scheduledDate) : a.status === "Planlandı" ? -1 : 1); }
function trDate(v: string) { return new Intl.DateTimeFormat("tr-TR", { day:"numeric", month:"long", year:"numeric", weekday:"short" }).format(new Date(`${v}T12:00:00`)); }
function shortDate(v: string) { return new Intl.DateTimeFormat("tr-TR", { day:"numeric", month:"long" }).format(new Date(`${v}T12:00:00`)); }
function campaignText(gap: AvailabilityGap, platform: SocialPlatform) {
  const dates = `${shortDate(gap.startDate)} – ${shortDate(gap.endDate)}`;
  if (platform === "WhatsApp Durum") return `${villaName(gap.villa)} için ${dates} tarihleri müsaittir. 🌿\nPatara, Kaş / Antalya\nRezervasyon ve bilgi için WhatsApp'tan ulaşabilirsiniz.`;
  if (platform === "TikTok") return `${villaName(gap.villa)} | Patara, Kaş 🌿\n${dates} tarihleri müsait. Tatil planınızı erkenden yapın.\n\n#Kaş #Patara #VillaTatil #Antalya`;
  return `${villaName(gap.villa)} için ${dates} tarihleri müsait. 🌿\n\nKaş Patara'da doğayla iç içe, huzurlu ve özel bir villa tatili için rezervasyonunuzu planlayabilirsiniz. Bilgi ve rezervasyon için mesaj gönderebilirsiniz.\n\n#Kaş #Patara #Antalya #villatatili #kiralıkvilla #tatil`;
}

export default function SocialMediaView({ initialPosts, availabilityGaps }: { initialPosts: SocialPost[]; availabilityGaps: AvailabilityGap[] }) {
  const [posts,setPosts]=useState(sort(initialPosts));
  const [villa,setVilla]=useState<Villa>("Safira");
  const [platform,setPlatform]=useState<SocialPlatform>("Instagram");
  const [contentType,setContentType]=useState<SocialContentType>("Gönderi");
  const [scheduledDate,setScheduledDate]=useState(today);
  const [caption,setCaption]=useState("");
  const [mediaUrl,setMediaUrl]=useState("");
  const [filter,setFilter]=useState<"Tümü"|SocialPostStatus>("Tümü");
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState(false);
  const [publishing,setPublishing]=useState<string | null>(null);
  const [approving,setApproving]=useState<string | null>(null);
  const visible=useMemo(()=>filter==="Tümü"?posts:posts.filter(p=>p.status===filter),[posts,filter]);
  const planned=posts.filter(p=>p.status==="Planlandı").length;
  const published=posts.filter(p=>p.status==="Yayınlandı").length;
  const approvalPending=posts.filter(p=>p.status==="Planlandı"&&p.approvalStatus!=="Onaylandı").length;
  const gaps=availabilityGaps.filter(g=>g.startDate>=today()).slice(0,10);

  useEffect(() => {
    function handleTemplate(event: Event) {
      const template = (event as CustomEvent<SocialContentTemplate>).detail;
      if (!template) return;
      setVilla(template.villa);
      setPlatform("Instagram");
      setContentType(template.contentType);
      setScheduledDate(template.scheduledDate >= today() ? template.scheduledDate : today());
      setCaption(template.caption);
      setMediaUrl("");
      setNotice(`${template.id} forma yüklendi. Önerilen gerçek medya dosyası: ${template.mediaFile}. Görsel bağlantısını ekleyip paylaşımı kontrol edin.`);
    }
    window.addEventListener("social-template-use", handleTemplate);
    return () => window.removeEventListener("social-template-use", handleTemplate);
  }, []);

  function useGap(gap: AvailabilityGap) {
    setVilla(gap.villa);
    setCaption(campaignText(gap, platform));
    setScheduledDate(today());
    setNotice(`${villaName(gap.villa)} boş tarih kampanyası hazırlandı.`);
  }

  async function addPost(e: FormEvent) {
    e.preventDefault(); setSaving(true); setNotice("");
    try {
      const r=await fetch("/api/social-posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({villa,platform,contentType,scheduledDate,caption,mediaUrl})});
      const d=await r.json().catch(()=>({}));
      if(r.ok){setPosts(p=>sort([d.post,...p]));setCaption("");setMediaUrl("");setNotice("Paylaşım plana eklendi. Yayınlamadan önce insan onayı gerekli.");}
      else setNotice(d.error??"Paylaşım kaydedilemedi.");
    } catch { setNotice("Bağlantı kurulamadı. Tekrar deneyin."); } finally { setSaving(false); }
  }

  async function approval(post: SocialPost) {
    if (post.status === "Yayınlandı") return;
    const next = post.approvalStatus === "Onaylandı" ? "İnsan onayı" : "Onaylandı";
    setApproving(post.id); setNotice("");
    try {
      const r=await fetch(`/api/social-posts/${post.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({approvalStatus:next})});
      const d=await r.json().catch(()=>({}));
      if(r.ok){setPosts(p=>sort(p.map(x=>x.id===post.id?d.post:x)));setNotice(next==="Onaylandı"?"Paylaşım insan onayından geçti. Yayına hazır.":"İnsan onayı kaldırıldı.");}
      else setNotice(d.error??"Onay durumu değiştirilemedi.");
    } catch { setNotice("Onay işlemi sırasında bağlantı kurulamadı."); } finally { setApproving(null); }
  }

  async function publishInstagram(post: SocialPost) {
    if (post.approvalStatus !== "Onaylandı") { setNotice("Instagram yayını için önce insan onayı verin."); return; }
    if (!post.mediaUrl) { setNotice("Instagram yayını için önce görsel bağlantısı ekleyin."); return; }
    setPublishing(post.id); setNotice("");
    try {
      const r=await fetch("/api/meta/instagram/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({postId:post.id})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok){setNotice(d.error??"Instagram yayını başarısız.");return;}
      if(d.post) setPosts(p=>sort(p.map(x=>x.id===post.id?d.post:x)));
      setNotice(`Instagram yayını gönderildi${d.username?` (@${d.username})`:""}.`);
    } catch { setNotice("Instagram bağlantısı kurulamadı."); } finally { setPublishing(null); }
  }

  async function status(post: SocialPost) {
    const next:SocialPostStatus=post.status==="Planlandı"?"Yayınlandı":"Planlandı";
    if(next==="Yayınlandı"&&post.approvalStatus!=="Onaylandı"){setNotice("Paylaşım yayınlandı olarak işaretlenmeden önce insan onayı verin.");return;}
    try{const r=await fetch(`/api/social-posts/${post.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});const d=await r.json().catch(()=>({}));if(r.ok){setPosts(p=>sort(p.map(x=>x.id===post.id?d.post:x)));setNotice("Paylaşım durumu güncellendi.");}else setNotice(d.error??"Durum değiştirilemedi.");}catch{setNotice("Bağlantı kurulamadı.");}
  }
  async function remove(post: SocialPost) { if(!confirm("Bu sosyal medya planını silmek istiyor musunuz?"))return; try{const r=await fetch(`/api/social-posts/${post.id}`,{method:"DELETE"});if(r.ok){setPosts(p=>p.filter(x=>x.id!==post.id));setNotice("Paylaşım planı silindi.");}else setNotice("Paylaşım silinemedi.");}catch{setNotice("Bağlantı kurulamadı.");} }
  async function copy(post: SocialPost){try{await navigator.clipboard.writeText(post.caption);setNotice("Paylaşım metni kopyalandı.");}catch{setNotice("Metin kopyalanamadı.");}}

  return <main className="social-page"><div className="social-top"><a href="/">← Ana panele dön</a><span>Villa Yönetim</span></div><section className="social-panel">
    <div className="social-hero"><div><span className="eyebrow">SOSYAL MEDYA MERKEZİ</span><h1>Boş tarihleri içeriğe dönüştür</h1><p>Villa Safira ve Villa Destan için rezervasyon takviminden kampanya üretin, insan onayından geçirin, planlayın ve takip edin.</p></div><div className="social-overview"><article><span>Planlanan</span><strong>{planned}</strong></article><article><span>Onay bekleyen</span><strong>{approvalPending}</strong></article><article><span>Yayınlanan</span><strong>{published}</strong></article></div></div>
    <div className="availability-box"><div className="availability-head"><div><span className="eyebrow">OTOMATİK UYGUNLUK</span><h2>Yaklaşan boş tarihler</h2></div><small>Rezervasyon takviminden otomatik hesaplanır</small></div><div className="availability-list">{gaps.length===0?<div className="empty">Önümüzdeki 120 günde 2 gece ve üzeri boşluk bulunamadı.</div>:gaps.map((gap,i)=><button type="button" key={`${gap.villa}-${gap.startDate}-${i}`} onClick={()=>useGap(gap)}><strong>{villaName(gap.villa)}</strong><span>{shortDate(gap.startDate)} – {shortDate(gap.endDate)}</span><em>{gap.nights} gece · kampanya hazırla</em></button>)}</div></div>
    {notice&&<p className="message social-message">{notice}</p>}
    <div className="social-layout"><form className="social-compose" onSubmit={addPost}><div className="social-section-title"><h2>Yeni paylaşım</h2><small>{caption.length}/2200</small></div>
      <div className="two"><label>Villa<select value={villa} onChange={e=>setVilla(e.target.value as Villa)}><option value="Safira">Villa Safira</option><option value="Destan">Villa Destan</option></select></label><label>Platform<select value={platform} onChange={e=>{const n=e.target.value as SocialPlatform;setPlatform(n);if(!types[n].includes(contentType))setContentType(types[n][0]);}}>{platforms.map(x=><option key={x}>{x}</option>)}</select></label></div>
      <div className="two"><label>Paylaşım türü<select value={contentType} onChange={e=>setContentType(e.target.value as SocialContentType)}>{types[platform].map(x=><option key={x}>{x}</option>)}</select></label><label>Planlanan tarih<input type="date" min={today()} value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} required/></label></div>
      <div className="idea-area"><span>Hazır içerik fikirleri</span><div className="idea-buttons">{ideas.map(([label,fn])=><button type="button" key={label} onClick={()=>setCaption(fn(villa))}>{label}</button>)}</div></div>
      <label>Görsel bağlantısı<input type="url" placeholder="https://.../villa-fotografi.jpg" value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} /></label>
      <div className="social-preview"><div className="social-preview-media">{mediaUrl?<img src={mediaUrl} alt={`${villaName(villa)} paylaşım önizlemesi`} />:<span>Görsel bağlantısı ekleyince önizleme burada görünür.</span>}</div><div className="social-preview-copy"><strong>{villaName(villa)}</strong><small>{platform} · {contentType}</small><p>{caption||"Paylaşım metni önizlemesi"}</p></div></div>
      <label>Paylaşım metni<textarea rows={8} maxLength={2200} value={caption} onChange={e=>setCaption(e.target.value)} required/></label><button className="save" disabled={saving||!caption.trim()}>{saving?"Kaydediliyor…":"Paylaşımı planla"}</button></form>
      <div className="social-calendar"><div className="social-calendar-head"><h2>Paylaşım takvimi</h2><div className="social-filters">{(["Tümü","Planlandı","Yayınlandı"] as const).map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div></div>
      <div className="social-post-list">{visible.length===0?<div className="empty">Henüz paylaşım yok.</div>:visible.map(post=><article className={`social-post ${post.status==="Yayınlandı"?"published":""}`} key={post.id}>{post.mediaUrl?<img className="social-post-image" src={post.mediaUrl} alt="" />:null}<div className="social-post-top"><div className="social-badges"><span className={`platform-badge ${tone[post.platform]}`}>{post.platform}</span><span>{post.contentType}</span><span>{villaName(post.villa)}</span></div><div className="social-state-badges"><span className={`approval-status ${post.approvalStatus==="Onaylandı"?"approved":"pending"}`}>{post.approvalStatus==="Onaylandı"?"✓ Onaylandı":"İnsan onayı"}</span><span className={`social-status ${post.status==="Yayınlandı"?"done":"planned"}`}>{post.status}</span></div></div><strong className="social-date">{trDate(post.scheduledDate)}</strong><p className="social-caption">{post.caption}</p><div className="social-actions"><button onClick={()=>copy(post)}>Metni kopyala</button>{post.status==="Planlandı"?<button className={`approval-action ${post.approvalStatus==="Onaylandı"?"approved":""}`} disabled={approving===post.id||publishing===post.id} onClick={()=>approval(post)}>{approving===post.id?"İşleniyor…":post.approvalStatus==="Onaylandı"?"Onayı kaldır":"Onay ver ✓"}</button>:null}{post.platform==="Instagram"&&post.status==="Planlandı"?<button className="publish-action" disabled={publishing===post.id||post.approvalStatus!=="Onaylandı"||!post.mediaUrl} onClick={()=>publishInstagram(post)}>{publishing===post.id?"Yayınlanıyor…":post.approvalStatus!=="Onaylandı"?"Önce onay gerekli":"Instagram'da yayınla"}</button>:<button className="status-action" disabled={post.status==="Planlandı"&&post.approvalStatus!=="Onaylandı"} onClick={()=>status(post)}>{post.status==="Planlandı"?"Yayınlandı ✓":"Plana geri al"}</button>}<button className="delete" onClick={()=>remove(post)}>Sil</button></div></article>)}</div></div>
    </div></section></main>;
}