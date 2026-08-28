"use client";

import { useState } from "react";
import { brandProfiles } from "@/lib/brand-profiles";
import type { Villa } from "@/lib/types";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function BrandProfileCenter() {
  const [villa, setVilla] = useState<Villa>("Safira");
  const [notice, setNotice] = useState("");
  const profile = brandProfiles[villa];

  async function copy(label: string, value: string) {
    try {
      await copyText(value);
      setNotice(`${label} kopyalandı.`);
    } catch {
      setNotice(`${label} kopyalanamadı.`);
    }
  }

  return <main className="brand-page">
    <div className="brand-top"><a href="/sosyal">← Sosyal medya merkezine dön</a><span>Villa Yönetim · Marka Ayarları</span></div>
    <section className="brand-shell">
      <header className="brand-hero"><div><span className="eyebrow">MARKA / PROFİL KONTROL MERKEZİ</span><h1>Safira ve Destan sosyal medya standardı</h1><p>Bio, profil adı, öne çıkanlar, sabit içerikler, Facebook CTA ve görsel kurallar tek kaynaktan yönetilir.</p></div><div className="brand-switch">{(["Safira","Destan"] as Villa[]).map((item) => <button type="button" key={item} className={villa===item?"active":""} onClick={()=>{setVilla(item);setNotice("");}}>Villa {item}</button>)}</div></header>
      {notice ? <p className="message brand-message">{notice}</p> : null}

      <div className="brand-grid">
        <article className="brand-card"><div className="brand-card-head"><div><span>INSTAGRAM</span><h2>Profil standardı</h2></div></div>
          <dl className="brand-fields">
            <div><dt>Profil adı</dt><dd>{profile.instagram.profileName}<button type="button" onClick={()=>copy("Profil adı",profile.instagram.profileName)}>Kopyala</button></dd></div>
            <div><dt>Kullanıcı adı</dt><dd>{profile.instagram.username ?? "Mevcut kullanıcı adını kontrol et / koru"}{profile.instagram.username ? <button type="button" onClick={()=>copy("Kullanıcı adı",profile.instagram.username!)}>Kopyala</button> : null}</dd></div>
          </dl>
          <div className="brand-copy-box"><div><strong>Bio</strong><button type="button" onClick={()=>copy("Instagram bio",profile.instagram.bio)}>Bio'yu kopyala</button></div><pre>{profile.instagram.bio}</pre></div>
          <div className="brand-list"><strong>Öne çıkanlar</strong><div>{profile.instagram.highlights.map((item)=><span key={item}>{item}</span>)}</div></div>
          <div className="brand-list"><strong>Sabit 3 gönderi</strong><ol>{profile.instagram.pinnedPosts.map((item)=><li key={item}>{item}</li>)}</ol></div>
        </article>

        <article className="brand-card facebook"><div className="brand-card-head"><div><span>FACEBOOK</span><h2>Sayfa standardı</h2></div></div>
          <dl className="brand-fields">
            <div><dt>Sayfa adı</dt><dd>{profile.facebook.pageName}<button type="button" onClick={()=>copy("Facebook sayfa adı",profile.facebook.pageName)}>Kopyala</button></dd></div>
            <div><dt>Kategori</dt><dd>{profile.facebook.category}</dd></div>
            <div><dt>Kapak</dt><dd>{profile.facebook.cover}</dd></div>
            <div><dt>CTA</dt><dd>{profile.facebook.cta}</dd></div>
          </dl>
          <div className="brand-checks">{profile.facebook.checklist.map((item)=><label key={item}><input type="checkbox" /> <span>{item}</span></label>)}</div>
        </article>
      </div>

      <article className="brand-visual"><div><span className="eyebrow">GÖRSEL SİSTEM</span><h2>Yayınlanacak görsel standardı</h2></div><div className="brand-visual-grid">
        <div><strong>Kırpma</strong><p>{profile.visual.feedRatio}</p></div>
        <div><strong>Renk yönü</strong><p>{profile.visual.colorDirection}</p></div>
        <div><strong>Fotoğraf kuralı</strong><p>{profile.visual.photoRule}</p></div>
        <div><strong>Metin bindirme</strong><p>{profile.visual.overlayRule}</p></div>
        <div><strong>Öne çıkan kapakları</strong><p>{profile.visual.highlightRule}</p></div>
      </div></article>

      <article className="brand-week"><div className="brand-week-head"><div><span className="eyebrow">7 GÜN CANLANDIRMA</span><h2>İlk hafta yayın akışı</h2></div><small>Her içerik yayın öncesi insan onayından geçer</small></div><div className="brand-week-list">{profile.launchWeek.map((item)=><div key={item.day}><b>Gün {item.day}</b><strong>{item.main}</strong><span>{item.format}</span><p>{item.story}</p><em>{item.goal}</em></div>)}</div></article>
    </section>
  </main>;
}
