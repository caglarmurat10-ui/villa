"use client";

import { useState } from "react";
import { brandProfiles } from "@/lib/brand-profiles";
import { facebookCoverAssets, highlightAssets, profileAssets, verifiedMediaNotes } from "@/lib/brand-assets";
import { organicRevivalRules, socialAudiences } from "@/lib/social-audiences";
import type { Villa } from "@/lib/types";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function BrandProfileCenter() {
  const [villa, setVilla] = useState<Villa>("Safira");
  const [notice, setNotice] = useState("");
  const profile = brandProfiles[villa];
  const media = verifiedMediaNotes[villa];

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
      <header className="brand-hero"><div><span className="eyebrow">MARKA / PROFİL / CANLANDIRMA MERKEZİ</span><h1>Safira ve Destan sosyal medya standardı</h1><p>Profil ayarları, logo, Facebook kapağı, öne çıkan kapakları, Meta bağlantıları, hedef kitleler ve ilk 30 günlük canlandırma kuralları tek merkezde.</p></div><div className="brand-switch">{(["Safira","Destan"] as Villa[]).map((item) => <button type="button" key={item} className={villa===item?"active":""} onClick={()=>{setVilla(item);setNotice("");}}>Villa {item}</button>)}</div></header>
      {notice ? <p className="message brand-message">{notice}</p> : null}

      <article className="brand-assets-card">
        <div className="brand-assets-logo"><img src={profileAssets[villa]} alt={`Villa ${villa} profil logosu`} /><div><span className="eyebrow">HAZIR PROFİL VARLIĞI</span><h2>Villa {villa} profil logosu</h2><p>Lacivert-altın ortak marka ailesi. Instagram ve Facebook profil fotoğrafı için kare/daire güvenli alanla hazır.</p><a href={profileAssets[villa]} download>Logo SVG dosyasını aç →</a></div></div>
        <div className="brand-connect-actions"><a href={`/api/meta/instagram/connect?villa=${villa}`}>Instagram bağlantısını başlat</a><a href={`/api/meta/facebook/connect?villa=${villa}`}>Facebook bağlantısını başlat</a><a href="/sosyal">Meta durumunu kontrol et</a></div>
      </article>

      <article className="facebook-cover-card"><div className="facebook-cover-copy"><span className="eyebrow">FACEBOOK KAPAK</span><h2>Villa {villa} hazır marka kapağı</h2><p>Gerçek villa fotoğrafı doğrulanana kadar güvenle kullanılabilen, başka bir villayı temsil etmeyen marka kapağı.</p><a href={facebookCoverAssets[villa]} download>Kapak SVG dosyasını aç →</a></div><img src={facebookCoverAssets[villa]} alt={`Villa ${villa} Facebook kapak görseli`} /></article>

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

      <article className="brand-highlight-card"><div><span className="eyebrow">ÖNE ÇIKAN KAPAKLARI</span><h2>Tek tip Instagram Highlight sistemi</h2><p>Safira ve Destan aynı görsel dili kullanır; yalnız hesap adı ve gerçek medya ayrıdır.</p></div><div className="highlight-assets">{highlightAssets.map((asset)=><a key={asset.label} href={asset.path} download><img src={asset.path} alt={`${asset.label} öne çıkan kapağı`} /><span>{asset.label}</span></a>)}</div></article>

      <article className="brand-media-status"><div><span className="eyebrow">GERÇEK MEDYA GÜVENLİĞİ</span><h2>{media.status}</h2></div><ul>{media.notes.map((note)=><li key={note}>{note}</li>)}</ul></article>

      <article className="brand-visual"><div><span className="eyebrow">GÖRSEL SİSTEM</span><h2>Yayınlanacak görsel standardı</h2></div><div className="brand-visual-grid">
        <div><strong>Kırpma</strong><p>{profile.visual.feedRatio}</p></div>
        <div><strong>Renk yönü</strong><p>{profile.visual.colorDirection}</p></div>
        <div><strong>Fotoğraf kuralı</strong><p>{profile.visual.photoRule}</p></div>
        <div><strong>Metin bindirme</strong><p>{profile.visual.overlayRule}</p></div>
        <div><strong>Öne çıkan kapakları</strong><p>{profile.visual.highlightRule}</p></div>
      </div></article>

      <article className="brand-week"><div className="brand-week-head"><div><span className="eyebrow">7 GÜN CANLANDIRMA</span><h2>İlk hafta yayın akışı</h2></div><small>Her içerik yayın öncesi insan onayından geçer</small></div><div className="brand-week-list">{profile.launchWeek.map((item)=><div key={item.day}><b>Gün {item.day}</b><strong>{item.main}</strong><span>{item.format}</span><p>{item.story}</p><em>{item.goal}</em></div>)}</div></article>

      <article className="audience-center"><div className="audience-head"><div><span className="eyebrow">HEDEF KİTLE MERKEZİ</span><h2>Meta kampanya kitleleri</h2><p>Kitleler hazırdır; reklam harcaması açık kullanıcı onayı olmadan başlatılmaz.</p></div><strong>{socialAudiences.length} kitle seti</strong></div><div className="audience-grid">{socialAudiences.map((item)=><section key={item.id}><div className="audience-title"><h3>{item.name}</h3><span>{item.activation}</span></div><dl><div><dt>Coğrafya</dt><dd>{item.geography}</dd></div><div><dt>Yaş</dt><dd>{item.age}</dd></div><div><dt>Hedefleme</dt><dd>{item.targeting}</dd></div><div><dt>Amaç</dt><dd>{item.objective}</dd></div><div><dt>Kreatif</dt><dd>{item.creative}</dd></div></dl><p>{item.rule}</p></section>)}</div></article>

      <article className="revival-rules"><div><span className="eyebrow">30 GÜNLÜK OPERASYON KURALLARI</span><h2>Canlandırma guardrail'leri</h2></div><ol>{organicRevivalRules.map((rule)=><li key={rule}>{rule}</li>)}</ol></article>
    </section>
  </main>;
}
