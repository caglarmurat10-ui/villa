"use client";

import { useMemo, useState } from "react";
import { socialContentTemplates, type SocialContentTemplate } from "@/lib/social-content-library";
import type { Villa } from "@/lib/types";

type VillaFilter = "Tümü" | Villa;

function shortDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", weekday: "short" })
    .format(new Date(`${value}T12:00:00`));
}

export default function SocialContentLibrary() {
  const [villa, setVilla] = useState<VillaFilter>("Tümü");
  const [theme, setTheme] = useState("Tümü");
  const [showAll, setShowAll] = useState(false);

  const themes = useMemo(
    () => ["Tümü", ...Array.from(new Set(socialContentTemplates.map((item) => item.theme)))],
    [],
  );

  const filtered = useMemo(
    () => socialContentTemplates.filter((item) =>
      (villa === "Tümü" || item.villa === villa) &&
      (theme === "Tümü" || item.theme === theme),
    ),
    [villa, theme],
  );

  const visible = showAll ? filtered : filtered.slice(0, 12);
  const resolved = filtered.filter((item) => item.mediaResolved).length;

  function useTemplate(template: SocialContentTemplate) {
    window.dispatchEvent(new CustomEvent("social-template-use", { detail: template }));
    document.querySelector(".social-compose")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <section className="content-library">
    <div className="content-library-head">
      <div><span className="eyebrow">HAZIR İÇERİK KÜTÜPHANESİ</span><h2>60 hazır Safira + Destan içeriği</h2><p>Drive klasörlerindeki gerçek villa medyasıyla eşleştirilmiştir. Bir kartı seçince doğru villa, metin, tarih ve medya otomatik yüklenir.</p></div>
      <strong>{resolved}/{filtered.length} gerçek medya eşleşti</strong>
    </div>
    <div className="content-library-filters">
      <div>{(["Tümü", "Safira", "Destan"] as const).map((item) => <button type="button" key={item} className={villa === item ? "active" : ""} onClick={() => { setVilla(item); setShowAll(false); }}>{item === "Tümü" ? "Tüm villalar" : `Villa ${item}`}</button>)}</div>
      <select aria-label="İçerik teması" value={theme} onChange={(event) => { setTheme(event.target.value); setShowAll(false); }}>
        {themes.map((item) => <option key={item} value={item}>{item === "Tümü" ? "Tüm temalar" : item}</option>)}
      </select>
    </div>
    <div className="content-template-grid">
      {visible.map((template) => <article key={template.id}>
        {template.previewUrl ? <a className="content-drive-preview" href={template.driveViewUrl} target="_blank" rel="noreferrer" aria-label={`${template.mediaFile} dosyasını Drive'da aç`}><img src={template.previewUrl} alt={`Villa ${template.villa} · ${template.mediaFile}`} /></a> : null}
        <div className="content-template-top"><span>{template.id}</span><span>{shortDate(template.scheduledDate)}</span></div>
        <div className="content-template-tags"><b>Villa {template.villa}</b><span>{template.format}</span><span>{template.theme}</span></div>
        <h3>{template.hook}</h3>
        <p className="content-media-name">{template.mediaResolved ? <><span className="drive-match-ok">✓ Drive doğrulandı</span> · <strong>{template.mediaFile}</strong></> : <>Medya bekleniyor: <strong>{template.mediaFile}</strong></>}</p>
        <p className="content-template-caption">{template.caption}</p>
        <div className="content-template-actions">
          <button type="button" disabled={!template.mediaResolved} onClick={() => useTemplate(template)}>{template.mediaResolved ? "Gerçek medya ile kullan →" : "Medya eşleşmesi bekleniyor"}</button>
          {template.driveViewUrl ? <a href={template.driveViewUrl} target="_blank" rel="noreferrer">Drive'da aç</a> : null}
        </div>
      </article>)}
    </div>
    {filtered.length > 12 ? <button type="button" className="content-show-all" onClick={() => setShowAll((value) => !value)}>{showAll ? "İlk 12 içeriği göster" : `Tüm ${filtered.length} içeriği göster`}</button> : null}
  </section>;
}
