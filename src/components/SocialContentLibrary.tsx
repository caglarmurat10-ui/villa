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

  function useTemplate(template: SocialContentTemplate) {
    window.dispatchEvent(new CustomEvent("social-template-use", { detail: template }));
    document.querySelector(".social-compose")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <section className="content-library">
    <div className="content-library-head">
      <div><span className="eyebrow">HAZIR İÇERİK KÜTÜPHANESİ</span><h2>60 hazır Safira + Destan içeriği</h2><p>Önceden hazırlanan gerçek içerik planı. Bir kartı seçince paylaşım formu otomatik doldurulur.</p></div>
      <strong>{filtered.length} içerik</strong>
    </div>
    <div className="content-library-filters">
      <div>{(["Tümü", "Safira", "Destan"] as const).map((item) => <button type="button" key={item} className={villa === item ? "active" : ""} onClick={() => { setVilla(item); setShowAll(false); }}>{item === "Tümü" ? "Tüm villalar" : `Villa ${item}`}</button>)}</div>
      <select aria-label="İçerik teması" value={theme} onChange={(event) => { setTheme(event.target.value); setShowAll(false); }}>
        {themes.map((item) => <option key={item} value={item}>{item === "Tümü" ? "Tüm temalar" : item}</option>)}
      </select>
    </div>
    <div className="content-template-grid">
      {visible.map((template) => <article key={template.id}>
        <div className="content-template-top"><span>{template.id}</span><span>{shortDate(template.scheduledDate)}</span></div>
        <div className="content-template-tags"><b>Villa {template.villa}</b><span>{template.format}</span><span>{template.theme}</span></div>
        <h3>{template.hook}</h3>
        <p className="content-media-name">Medya önerisi: <strong>{template.mediaFile}</strong></p>
        <p className="content-template-caption">{template.caption}</p>
        <button type="button" onClick={() => useTemplate(template)}>Bu içeriği kullan →</button>
      </article>)}
    </div>
    {filtered.length > 12 ? <button type="button" className="content-show-all" onClick={() => setShowAll((value) => !value)}>{showAll ? "İlk 12 içeriği göster" : `Tüm ${filtered.length} içeriği göster`}</button> : null}
  </section>;
}
