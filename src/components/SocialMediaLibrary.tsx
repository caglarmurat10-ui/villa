"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { SocialMediaLibraryItem } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";
import SocialNav from "./SocialNav";
import styles from "./SocialOperations.module.css";

const imageCategories = ["Dış cephe", "Havuz", "Salon", "Mutfak", "Yatak odası", "Banyo", "Bahçe", "Manzara", "Gün batımı", "Patara", "Detay", "Diğer"];
const videoCategories = ["Villa turu", "Havuz", "Bahçe", "Gün batımı", "Reels", "Diğer"];

export default function SocialMediaLibrary() {
  const [items, setItems] = useState<SocialMediaLibraryItem[]>([]);
  const [villa, setVilla] = useState<Villa>("Destan");
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Havuz");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/social/media?villa=${villa}`);
    const data = await response.json().catch(() => ({}));
    if (response.ok) setItems(data.items ?? []);
  }, [villa]);
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/social/media?villa=${villa}`).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!cancelled && response.ok) setItems(data.items ?? []);
    });
    return () => { cancelled = true; };
  }, [villa]);

  async function upload() {
    if (!file) { setNotice("Önce JPEG/JPG veya MP4 dosyası seçin."); return; }
    setBusy(true); setNotice("");
    const form = new FormData(); form.set("file", file); form.set("villa", villa); form.set("label", label); form.set("category", category);
    const response = await fetch("/api/social/media", { method: "POST", body: form });
    const data = await response.json().catch(() => ({})); setBusy(false);
    setNotice(response.ok ? "Medya kalıcı kütüphaneye eklendi." : data.error ?? "Medya yüklenemedi.");
    if (response.ok) { setFile(null); setLabel(""); await load(); }
  }

  async function update(item: SocialMediaLibraryItem, changes: Partial<SocialMediaLibraryItem>) {
    const response = await fetch("/api/social/media", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: item.id, ...changes }) });
    if (response.ok) await load(); else setNotice("Medya güncellenemedi.");
  }
  async function deactivate(item: SocialMediaLibraryItem) {
    if (!confirm("Bu medya pasif yapılsın mı? Planlı yayın referansları korunur.")) return;
    const response = await fetch("/api/social/media", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate", id: item.id }) });
    if (response.ok) { setNotice("Medya pasif yapıldı."); await load(); }
  }

  const categories = file?.type === "video/mp4" ? videoCategories : imageCategories;
  return <main className={styles.page}><div className={styles.shell}><SocialNav />
    <section className={styles.hero}><div><span className={styles.eyebrow}>MEDYA KÜTÜPHANESİ</span><h1>Villa görsellerini kalıcı saklayın</h1><p>Destan ve Safira dosyaları ayrı tutulur; kısa süreli yayın medyasından bağımsızdır.</p></div></section>
    {notice ? <p className={styles.message}>{notice}</p> : null}
    <section className={styles.panel}><div className={styles.toolbar}>{(["Destan","Safira"] as const).map((value)=><button className={villa===value?styles.primary:styles.button} key={value} onClick={()=>setVilla(value)}>Villa {value}</button>)}</div>
      <div className={styles.upload}><label>JPEG/JPG veya MP4<input type="file" accept="image/jpeg,video/mp4" onChange={(event)=>{const selected=event.target.files?.[0]??null;setFile(selected);setCategory(selected?.type==="video/mp4"?"Villa turu":"Havuz");}}/></label>
        <label>Etiket<input value={label} maxLength={120} onChange={(event)=>setLabel(event.target.value)} placeholder="Örn. Akşam havuz"/></label>
        <label>Kategori<select value={category} onChange={(event)=>setCategory(event.target.value)}>{categories.map((value)=><option key={value}>{value}</option>)}</select></label>
        <button className={styles.primary} disabled={busy||!file} onClick={upload}>{busy?"Yükleniyor…":"Kütüphaneye ekle"}</button></div>
      <div className={styles.mediaGrid}>{items.map((item)=><article className={styles.mediaCard} key={item.id} style={{opacity:item.active?1:.55}}>
        {item.mediaType==="VIDEO"?<video className={styles.mediaPreview} controls preload="metadata" src={item.publicUrl}/>:<Image unoptimized width={600} height={400} className={styles.mediaPreview} src={item.publicUrl} alt={item.label||item.filename}/>}<div className={styles.mediaBody}><h3>{item.label||item.filename}</h3>
          <div className={styles.mediaMeta}><span>{item.mediaType==="VIDEO"?"Video":"Fotoğraf"} · {item.useCount} kullanım</span><span>{item.favorite?"★ Favori":"☆"}</span></div>
          <div className={styles.fields}><label>Kategori<select value={item.category} onChange={(event)=>update(item,{category:event.target.value})}>{(item.mediaType==="VIDEO"?videoCategories:imageCategories).map((value)=><option key={value}>{value}</option>)}</select></label>
            <label>Etiket<input value={item.label} onChange={(event)=>setItems((all)=>all.map((current)=>current.id===item.id?{...current,label:event.target.value}:current))} onBlur={()=>update(item,{label:item.label})}/></label></div>
          <div className={styles.actions}><button className={styles.button} onClick={()=>update(item,{favorite:!item.favorite})}>{item.favorite?"Favoriden çıkar":"Favori yap"}</button><button className={styles.button} onClick={()=>update(item,{active:!item.active})}>{item.active?"Pasif yap":"Aktif yap"}</button><button className={styles.danger} onClick={()=>deactivate(item)}>Kaldır</button></div></div></article>)}
        {!items.length?<div className={styles.empty}>Villa {villa} için henüz medya yok.</div>:null}</div></section>
  </div></main>;
}
