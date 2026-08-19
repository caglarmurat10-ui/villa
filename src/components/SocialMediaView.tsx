"use client";

import { FormEvent, useMemo, useState } from "react";
import type { SocialContentType, SocialPlatform, SocialPost, SocialPostStatus, Villa } from "@/lib/types";

const platforms: SocialPlatform[] = ["Instagram", "Facebook", "TikTok", "WhatsApp Durum"];
const types: Record<SocialPlatform, SocialContentType[]> = {
  Instagram: ["Gönderi", "Hikâye", "Reels"], Facebook: ["Gönderi", "Hikâye", "Reels"],
  TikTok: ["Gönderi", "Reels"], "WhatsApp Durum": ["Durum"],
};
const tone: Record<SocialPlatform, string> = { Instagram: "instagram", Facebook: "facebook", TikTok: "tiktok", "WhatsApp Durum": "whatsapp" };
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
const today = () => dateFmt.format(new Date());
const ideas = [
  ["Villa tanıtımı", (v: Villa) => `Doğayla iç içe, sakin ve keyifli bir tatil için ${v} Villa sizleri bekliyor. Uygun tarihler ve rezervasyon bilgisi için mesaj gönderebilirsiniz.\n\n#villa #tatil #villatatili #kiralıkvilla`],
  ["Uygun tarih", (v: Villa) => `${v} Villa için yeni uygun tarihlerimiz açıldı. Tatilinizi erkenden planlamak ve bilgi almak için bize mesaj gönderebilirsiniz.\n\n#tatilfırsatı #villa #rezervasyon`],
  ["Hafta sonu", (v: Villa) => `Hafta sonunu huzur ve keyifle geçirmek isteyenlere: ${v} Villa. Uygunluk ve rezervasyon için mesajlarınızı bekliyoruz. ✨`],
] as const;

function sort(posts: SocialPost[]) { return [...posts].sort((a,b) => a.status === b.status ? a.scheduledDate.localeCompare(b.scheduledDate) : a.status === "Planlandı" ? -1 : 1); }
function trDate(v: string) { return new Intl.DateTimeFormat("tr-TR", { day:"numeric", month:"long", year:"numeric", weekday:"short" }).format(new Date(`${v}T12:00:00`)); }

export default function SocialMediaView({ initialPosts }: { initialPosts: SocialPost[] }) {
  const [posts,setPosts]=useState(sort(initialPosts)), [villa,setVilla]=useState<Villa>("Safira"), [platform,setPlatform]=useState<SocialPlatform>("Instagram"), [contentType,setContentType]=useState<SocialContentType>("Gönderi"), [scheduledDate,setScheduledDate]=useState(today), [caption,setCaption]=useState(""), [filter,setFilter]=useState<"Tümü"|SocialPostStatus>("Tümü"), [notice,setNotice]=useState(""), [saving,setSaving]=useState(false);
  const visible=useMemo(()=>filter==="Tümü"?posts:posts.filter(p=>p.status===filter),[posts,filter]);
  const planned=posts.filter(p=>p.status==="Planlandı").length, published=posts.filter(p=>p.status==="Yayınlandı").length;

  async function addPost(e: FormEvent) {
    e.preventDefault(); setSaving(true); setNotice("");
    try { const r=await fetch("/api/social-posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({villa,platform,contentType,scheduledDate,caption})}); const d=await r.json().catch(()=>({})); if(r.ok){setPosts(p=>sort([d.post,...p]));setCaption("");setNotice("Paylaşım plana eklendi.");}else setNotice(d.error??"Paylaşım kaydedilemedi."); }
    catch { setNotice("Bağlantı kurulamadı. Tekrar deneyin."); } finally { setSaving(false); }
  }
  async function status(post: SocialPost) { const next:SocialPostStatus=post.status==="Planlandı"?"Yayınlandı":"Planlandı"; try{const r=await fetch(`/api/social-posts/${post.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});const d=await r.json().catch(()=>({}));if(r.ok){setPosts(p=>sort(p.map(x=>x.id===post.id?d.post:x)));setNotice("Paylaşım durumu güncellendi.");}else setNotice(d.error??"Durum değiştirilemedi.");}catch{setNotice("Bağlantı kurulamadı.");} }
  async function remove(post: SocialPost) { if(!confirm("Bu sosyal medya planını silmek istiyor musunuz?"))return; try{const r=await fetch(`/api/social-posts/${post.id}`,{method:"DELETE"});if(r.ok){setPosts(p=>p.filter(x=>x.id!==post.id));setNotice("Paylaşım planı silindi.");}else setNotice("Paylaşım silinemedi.");}catch{setNotice("Bağlantı kurulamadı.");} }
  async function copy(post: SocialPost){try{await navigator.clipboard.writeText(post.caption);setNotice("Paylaşım metni kopyalandı.");}catch{setNotice("Metin kopyalanamadı.");}}

  return <main className="social-page"><div className="social-top"><a href="/">← Ana panele dön</a><span>Villa Yönetim</span></div><section className="social-panel">
    <div className="social-hero"><div><span className="eyebrow">SOSYAL MEDYA PLANI</span><h1>İçerikleri planla ve takip et</h1><p>Safira ve Destan için paylaşım metinlerini tek merkezden hazırlayın.</p></div><div className="social-overview"><article><span>Planlanan</span><strong>{planned}</strong></article><article><span>Yayınlanan</span><strong>{published}</strong></article></div></div>
    {notice&&<p className="message social-message">{notice}</p>}
    <div className="social-layout"><form className="social-compose" onSubmit={addPost}><div className="social-section-title"><h2>Yeni paylaşım</h2><small>{caption.length}/2200</small></div>
      <div className="two"><label>Villa<select value={villa} onChange={e=>setVilla(e.target.value as Villa)}><option>Safira</option><option>Destan</option></select></label><label>Platform<select value={platform} onChange={e=>{const n=e.target.value as SocialPlatform;setPlatform(n);if(!types[n].includes(contentType))setContentType(types[n][0]);}}>{platforms.map(x=><option key={x}>{x}</option>)}</select></label></div>
      <div className="two"><label>Paylaşım türü<select value={contentType} onChange={e=>setContentType(e.target.value as SocialContentType)}>{types[platform].map(x=><option key={x}>{x}</option>)}</select></label><label>Planlanan tarih<input type="date" min={today()} value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} required/></label></div>
      <div className="idea-area"><span>Hazır metin fikirleri</span><div className="idea-buttons">{ideas.map(([label,fn])=><button type="button" key={label} onClick={()=>setCaption(fn(villa))}>{label}</button>)}</div></div>
      <label>Paylaşım metni<textarea rows={8} maxLength={2200} value={caption} onChange={e=>setCaption(e.target.value)} required/></label><button className="save" disabled={saving||!caption.trim()}>{saving?"Kaydediliyor…":"Paylaşımı planla"}</button></form>
      <div className="social-calendar"><div className="social-calendar-head"><h2>Paylaşım takvimi</h2><div className="social-filters">{(["Tümü","Planlandı","Yayınlandı"] as const).map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div></div>
      <div className="social-post-list">{visible.length===0?<div className="empty">Henüz paylaşım yok.</div>:visible.map(post=><article className={`social-post ${post.status==="Yayınlandı"?"published":""}`} key={post.id}><div className="social-post-top"><div className="social-badges"><span className={`platform-badge ${tone[post.platform]}`}>{post.platform}</span><span>{post.contentType}</span><span>{post.villa}</span></div><span className={`social-status ${post.status==="Yayınlandı"?"done":"planned"}`}>{post.status}</span></div><strong className="social-date">{trDate(post.scheduledDate)}</strong><p className="social-caption">{post.caption}</p><div className="social-actions"><button onClick={()=>copy(post)}>Metni kopyala</button><button className="status-action" onClick={()=>status(post)}>{post.status==="Planlandı"?"Yayınlandı ✓":"Plana geri al"}</button><button className="delete" onClick={()=>remove(post)}>Sil</button></div></article>)}</div></div>
    </div></section></main>;
}
