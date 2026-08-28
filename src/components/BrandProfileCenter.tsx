"use client";

import { useState } from "react";
import { brandProfiles } from "@/lib/brand-profiles";
import { facebookCoverAssets, highlightAssetsForVilla, profileAssets, verifiedMediaNotes } from "@/lib/brand-assets";
import { organicRevivalRules, socialAudiences } from "@/lib/social-audiences";
import type { MetaSocialAccount } from "@/lib/meta-store";
import type { Villa } from "@/lib/types";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, "").toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
}

export default function BrandProfileCenter({ accounts }: { accounts: MetaSocialAccount[] }) {
  const [villa, setVilla] = useState<Villa>("Safira");
  const [notice, setNotice] = useState("");
  const profile = brandProfiles[villa];
  const media = verifiedMediaNotes[villa];
  const highlights = highlightAssetsForVilla(villa);
  const instagramAccount = accounts.find((item) => item.villa === villa && item.platform === "Instagram") ?? null;
  const facebookAccount = accounts.find((item) => item.villa === villa && item.platform === "Facebook") ?? null;
  const instagramHandleMatches = instagramAccount
    ? normalizeUsername(instagramAccount.username) === normalizeUsername(profile.instagram.preferredUsername)
    : false;

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
      <header className="brand-hero"><div><span className="eyebrow">MARKA / PROFİL / CANLANDIRMA MERKEZİ</span><h1>Safira ve Destan sosyal medya standardı</h1><p>Gerçek hesap bağlantısı, profil metinleri, Facebook kapağı, Instagram öne çıkanları, sabit gönderiler ve ilk 30 günlük operasyon tek merkezde.</p></div><div className="brand-switch">{(["Safira","Destan"] as Villa[]).map((item) => <button type="button" key={item} className={villa===item?"active":""} onClick={()=>{setVilla(item);setNotice("");}}>Villa {item}</button>)}</div></header>
      {notice ? <p className="message brand-message">{notice}</p> : null}

      <article className="brand-account-status">
        <div className="brand-account-title"><div><span className="eyebrow">GERÇEK HESAP DURUMU</span><h2>Villa {villa} bağlantıları</h2></div><small>Hesap adı değiştirilmeden önce bağlı hesabı doğrula</small></div>
        <div className="brand-account-grid">
          <section className={instagramAccount ? "connected" : "missing"}>
            <div><strong>Instagram</strong><span>{instagramAccount ? "✓ Bağlı" : "Bağlı değil"}</span></div>
            {instagramAccount ? <><p>Bağlı hesap: <b>@{instagramAccount.username.replace(/^@/, "")}</b></p><p>Hedef kullanıcı adı: <b>@{profile.instagram.preferredUsername}</b></p><em className={instagramHandleMatches ? "match" : "review"}>{instagramHandleMatches ? "✓ Kullanıcı adı marka standardıyla eşleşiyor" : "Kullanıcı adını değiştirmeden önce bu hesabın doğru hesap olduğunu kontrol et"}</em></> : <><p>Hedef: <b>@{profile.instagram.preferredUsername}</b></p><a href={`/api/meta/instagram/connect?villa=${villa}`}>Instagram hesabını bağla →</a></>}
          </section>
          <section className={facebookAccount ? "connected" : "missing"}>
            <div><strong>Facebook</strong><span>{facebookAccount ? "✓ Bağlı" : "Bağlı değil"}</span></div>
            {facebookAccount ? <><p>Bağlı Sayfa: <b>{facebookAccount.username}</b></p><p>Hedef Sayfa adı: <b>{profile.facebook.pageName}</b></p>{facebookAccount.profileUrl ? <a href={facebookAccount.profileUrl} target="_blank" rel="noreferrer">Facebook Sayfasını aç →</a> : null}</> : <><p>Hedef: <b>{profile.facebook.pageName}</b></p><a href={`/api/meta/facebook/connect?villa=${villa}`}>Facebook Sayfasını bağla →</a></>}
          </section>
        </div>
      </article>

      <article className="brand-assets-card">
        <div className="brand-assets-logo"><img src={profileAssets[villa]} alt={`Villa ${villa} profil logosu`} /><div><span className="eyebrow">PROFİL FOTOĞRAFI · PNG</span><h2>Villa {villa} marka logosu</h2><p>Yapay villa fotoğrafı içermez. Lacivert-altın monogram ve marka adı; Instagram/Facebook daire kırpmasına uygun 1080×1080 güvenli alan.</p><div className="brand-asset-actions"><a href={profileAssets[villa]} target="_blank" rel="noreferrer">Profil PNG'yi aç →</a><button type="button" onClick={()=>copy("Profil PNG adresi",new URL(profileAssets[villa],window.location.origin).toString())}>PNG adresini kopyala</button></div></div></div>
        <div className="brand-connect-actions"><a href={`/api/meta/instagram/connect?villa=${villa}`}>Instagram bağlantısını {instagramAccount ? "yenile" : "başlat"}</a><a href={`/api/meta/facebook/connect?villa=${villa}`}>Facebook bağlantısını {facebookAccount ? "yenile" : "başlat"}</a><a href="/sosyal">Meta durumunu kontrol et</a></div>
      </article>

      <article className="facebook-cover-card"><div className="facebook-cover-copy"><span className="eyebrow">FACEBOOK KAPAK · PNG</span><h2>Villa {villa} marka kapağı</h2><p>Kapak gerçek Villa {villa} Drive fotoğrafı üzerine güvenli lacivert-altın marka katmanı ile otomatik üretilir. Safira ve Destan medyası birbirine karışamaz.</p><div className="brand-asset-actions"><a href={facebookCoverAssets[villa]} target="_blank" rel="noreferrer">Kapak PNG'yi aç →</a><button type="button" onClick={()=>copy("Facebook kapak PNG adresi",new URL(facebookCoverAssets[villa],window.location.origin).toString())}>PNG adresini kopyala</button></div></div><img src={facebookCoverAssets[villa]} alt={`Villa ${villa} gerçek Facebook kapak görseli`} /></article>

      <div className="brand-grid">
        <article className="brand-card"><div className="brand-card-head"><div><span>INSTAGRAM</span><h2>Profil ayarları</h2></div></div>
          <dl className="brand-fields">
            <div><dt>Profil adı</dt><dd>{profile.instagram.profileName}<button type="button" onClick={()=>copy("Profil adı",profile.instagram.profileName)}>Kopyala</button></dd></div>
            <div><dt>Hedef kullanıcı adı</dt><dd>@{profile.instagram.preferredUsername}<button type="button" onClick={()=>copy("Instagram kullanıcı adı",profile.instagram.preferredUsername)}>Kopyala</button></dd></div>
            <div><dt>Kategori</dt><dd>{profile.instagram.category}<button type="button" onClick={()=>copy("Instagram kategori",profile.instagram.category)}>Kopyala</button></dd></div>
            <div><dt>İletişim</dt><dd>{profile.instagram.contactActions.join(" + ")}</dd></div>
          </dl>
          <div className="brand-copy-box"><div><strong>Bio</strong><button type="button" onClick={()=>copy("Instagram bio",profile.instagram.bio)}>Bio'yu kopyala</button></div><pre>{profile.instagram.bio}</pre></div>
          <div className="brand-list"><strong>Öne çıkanlar · sıra sabit</strong><div>{profile.instagram.highlights.map((item)=><span key={item}>{item}</span>)}</div></div>
          <div className="brand-list"><strong>Sabit 3 gönderi</strong><ol>{profile.instagram.pinnedPosts.map((item)=><li key={item}>{item}</li>)}</ol></div>
          <div className="brand-checks">{profile.instagram.setupChecklist.map((item)=><label key={item}><input type="checkbox" /> <span>{item}</span></label>)}</div>
        </article>

        <article className="brand-card facebook"><div className="brand-card-head"><div><span>FACEBOOK</span><h2>Sayfa ayarları</h2></div></div>
          <dl className="brand-fields">
            <div><dt>Sayfa adı</dt><dd>{profile.facebook.pageName}<button type="button" onClick={()=>copy("Facebook sayfa adı",profile.facebook.pageName)}>Kopyala</button></dd></div>
            <div><dt>Hedef kullanıcı adı</dt><dd>@{profile.facebook.preferredUsername}<button type="button" onClick={()=>copy("Facebook kullanıcı adı",profile.facebook.preferredUsername)}>Kopyala</button></dd></div>
            <div><dt>Kategori</dt><dd>{profile.facebook.category}<button type="button" onClick={()=>copy("Facebook kategori",profile.facebook.category)}>Kopyala</button></dd></div>
            <div><dt>CTA</dt><dd>{profile.facebook.cta}</dd></div>
            <div><dt>Kapak</dt><dd>{profile.facebook.cover}</dd></div>
          </dl>
          <div className="brand-copy-box"><div><strong>Giriş / Intro</strong><button type="button" onClick={()=>copy("Facebook giriş metni",profile.facebook.intro)}>Kopyala</button></div><pre>{profile.facebook.intro}</pre></div>
          <div className="brand-copy-box"><div><strong>Hakkında</strong><button type="button" onClick={()=>copy("Facebook hakkında",profile.facebook.about)}>Kopyala</button></div><pre>{profile.facebook.about}</pre></div>
          <div className="brand-list"><strong>Sabit 3 gönderi</strong><ol>{profile.facebook.pinnedPosts.map((item)=><li key={item}>{item}</li>)}</ol></div>
          <div className="brand-checks">{profile.facebook.checklist.map((item)=><label key={item}><input type="checkbox" /> <span>{item}</span></label>)}</div>
        </article>
      </div>

      <article className="brand-highlight-card"><div><span className="eyebrow">ÖNE ÇIKAN KAPAKLARI · PNG</span><h2>Villa {villa} Instagram Highlight seti</h2><p>7 kapak aynı lacivert-altın sistemde, 1080×1080 ve daire kırpmasına uygun. Safira ve Destan setleri ayrı URL'lerden üretilir.</p></div><div className="highlight-assets">{highlights.map((asset)=><a key={asset.label} href={asset.path} target="_blank" rel="noreferrer"><img src={asset.path} alt={`${villa} ${asset.label} öne çıkan kapağı`} /><span>{asset.label}</span></a>)}</div></article>

      <article className="brand-media-status"><div><span className="eyebrow">GERÇEK MEDYA GÜVENLİĞİ</span><h2>{media.status}</h2></div><ul>{media.notes.map((note)=><li key={note}>{note}</li>)}</ul></article>

      <article className="brand-visual"><div><span className="eyebrow">GÖRSEL SİSTEM</span><h2>Yayınlanacak görsel standardı</h2></div><div className="brand-visual-grid">
        <div><strong>Feed</strong><p>{profile.visual.feedRatio}</p></div>
        <div><strong>Story / Reels</strong><p>{profile.visual.storyRatio}</p></div>
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
