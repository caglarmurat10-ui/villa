"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { PriceRange, Villa, VillaLocations } from "@/lib/types";

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const villas: Villa[] = ["Safira", "Destan"];

function fmt(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function sortPrices(rows: PriceRange[]) {
  return [...rows].sort((a, b) => a.villa.localeCompare(b.villa, "tr-TR") || a.startDate.localeCompare(b.startDate));
}

export default function SettingsCenter({ initialCommission, initialPrices, initialLocations }: { initialCommission: number; initialPrices: PriceRange[]; initialLocations: VillaLocations }) {
  const [commission, setCommission] = useState(initialCommission);
  const [prices, setPrices] = useState(() => sortPrices(initialPrices));
  const [locations, setLocations] = useState(initialLocations);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<"checking" | "healthy" | "unhealthy">("checking");

  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const activePrice = useMemo(() => Object.fromEntries(villas.map((villa) => [villa, prices.find((p) => p.villa === villa && p.startDate <= currentDate && p.endDate >= currentDate) ?? null])) as Record<Villa, PriceRange | null>, [prices, currentDate]);

  async function checkHealth() {
    setHealth("checking");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      setHealth(response.ok ? "healthy" : "unhealthy");
    } catch {
      setHealth("unhealthy");
    }
  }

  useEffect(() => { void checkHealth(); }, []);

  function resetMessages() { setNotice(""); setError(""); }

  async function saveCommission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetMessages(); setBusy("commission");
    const form = new FormData(event.currentTarget);
    const commissionRate = Number(form.get("commissionRate"));
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commissionRate }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Komisyon kaydedilemedi.");
      setCommission(data.commissionRate); setNotice("Komisyon oranı kaydedildi.");
    } catch (err) { setError(err instanceof Error ? err.message : "Komisyon kaydedilemedi."); }
    finally { setBusy(null); }
  }

  async function saveLocations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetMessages(); setBusy("locations");
    const form = new FormData(event.currentTarget);
    const next: VillaLocations = { Safira: String(form.get("Safira") ?? "").trim(), Destan: String(form.get("Destan") ?? "").trim() };
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locations: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Konumlar kaydedilemedi.");
      setLocations(data.locations); setNotice("Villa konum bağlantıları kaydedildi.");
    } catch (err) { setError(err instanceof Error ? err.message : "Konumlar kaydedilemedi."); }
    finally { setBusy(null); }
  }

  async function addPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetMessages(); setBusy("price");
    const formElement = event.currentTarget;
    const payload = Object.fromEntries(new FormData(formElement).entries());
    try {
      const response = await fetch("/api/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Fiyat dönemi eklenemedi.");
      setPrices((current) => sortPrices([...current, data.price]));
      formElement.reset(); setNotice("Yeni fiyat dönemi eklendi.");
    } catch (err) { setError(err instanceof Error ? err.message : "Fiyat dönemi eklenemedi."); }
    finally { setBusy(null); }
  }

  async function removePrice(price: PriceRange) {
    if (!confirm(`${price.villa} · ${fmt(price.startDate)} – ${fmt(price.endDate)} fiyat dönemini silmek istiyor musunuz?`)) return;
    resetMessages(); setBusy(price.id);
    try {
      const response = await fetch(`/api/prices/${price.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Fiyat dönemi silinemedi.");
      setPrices((current) => current.filter((item) => item.id !== price.id)); setNotice("Fiyat dönemi silindi.");
    } catch (err) { setError(err instanceof Error ? err.message : "Fiyat dönemi silinemedi."); }
    finally { setBusy(null); }
  }

  return <div className="settings-center">
    {(notice || error) && <div className={`settings-notice ${error ? "error" : "success"}`}>{error || notice}</div>}

    <section className="settings-status-grid">
      <article><span>Sistem</span><strong className={health === "healthy" ? "ok" : health === "unhealthy" ? "bad" : ""}>{health === "checking" ? "Kontrol ediliyor…" : health === "healthy" ? "D1 bağlantısı açık" : "Bağlantı sorunu"}</strong><button type="button" onClick={() => void checkHealth()}>Tekrar test et</button></article>
      <article><span>Komisyon</span><strong>%{commission}</strong><small>Finans hesaplarında aktif</small></article>
      {villas.map((villa) => <article key={villa}><span>Villa {villa} fiyatı</span><strong>{activePrice[villa] ? money.format(activePrice[villa]!.nightlyRate) : "Tanımsız"}</strong><small>{activePrice[villa] ? `${fmt(activePrice[villa]!.startDate)} – ${fmt(activePrice[villa]!.endDate)}` : "Bugün için fiyat dönemi yok"}</small></article>)}
    </section>

    <div className="settings-main-grid">
      <form className="settings-box" onSubmit={saveCommission}>
        <span className="ops-eyebrow">FİNANS</span><h2>Komisyon oranı</h2><p>Brüt/net gelir ve rapor hesaplarında kullanılan merkezi oran.</p>
        <label>Komisyon %<input name="commissionRate" type="number" min="0" max="100" step="0.1" defaultValue={commission} required /></label>
        <button className="settings-save" disabled={busy === "commission"}>{busy === "commission" ? "Kaydediliyor…" : "Komisyonu kaydet"}</button>
      </form>

      <form className="settings-box" onSubmit={saveLocations}>
        <span className="ops-eyebrow">WHATSAPP / KONUM</span><h2>Villa konumları</h2><p>Giriş mesajındaki konum bağlantısı bu iki alandan alınır.</p>
        <label>Safira Google Maps bağlantısı<input name="Safira" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/..." defaultValue={locations.Safira} /></label>
        <label>Destan Google Maps bağlantısı<input name="Destan" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/..." defaultValue={locations.Destan} /></label>
        <button className="settings-save" disabled={busy === "locations"}>{busy === "locations" ? "Kaydediliyor…" : "Konumları kaydet"}</button>
      </form>

      <form className="settings-box price-create" onSubmit={addPrice}>
        <span className="ops-eyebrow">FİYATLANDIRMA</span><h2>Yeni fiyat dönemi</h2><p>Aynı villa için tarih aralıkları çakışamaz. Rezervasyon toplamı bu dönemlerden otomatik hesaplanır.</p>
        <label>Villa<select name="villa" required><option>Safira</option><option>Destan</option></select></label>
        <div className="settings-two"><label>Başlangıç<input name="startDate" type="date" required /></label><label>Bitiş<input name="endDate" type="date" required /></label></div>
        <label>Gecelik fiyat (₺)<input name="nightlyRate" type="number" min="1" step="1" required /></label>
        <button className="settings-save" disabled={busy === "price"}>{busy === "price" ? "Ekleniyor…" : "Fiyat dönemini ekle"}</button>
      </form>

      <section className="settings-box backup-box">
        <span className="ops-eyebrow">VERİ GÜVENLİĞİ</span><h2>Yedek ve dışa aktarma</h2><p>Rezervasyon verisini gerektiğinde indirip yerel yedek olarak saklayabilirsiniz.</p>
        <div className="settings-link-stack"><a href="/api/backup">JSON yedeğini indir</a><a href="/api/export">CSV raporunu indir</a></div>
      </section>
    </div>

    <section className="settings-price-section">
      <div className="settings-section-head"><div><span className="ops-eyebrow">DÖNEMSEL FİYATLAR</span><h2>Fiyat takvimi</h2></div><b>{prices.length} dönem</b></div>
      <div className="settings-price-columns">{villas.map((villa) => {
        const rows = prices.filter((price) => price.villa === villa);
        return <div className="settings-price-column" key={villa}><h3>Villa {villa}</h3>{rows.length === 0 ? <div className="ops-empty">Fiyat dönemi tanımlı değil.</div> : rows.map((price) => <article className={price.startDate <= currentDate && price.endDate >= currentDate ? "current" : ""} key={price.id}><div><strong>{money.format(price.nightlyRate)} <small>/ gece</small></strong><span>{fmt(price.startDate)} – {fmt(price.endDate)}</span>{price.startDate <= currentDate && price.endDate >= currentDate ? <em>Şu an aktif</em> : null}</div><button type="button" disabled={busy === price.id} onClick={() => void removePrice(price)}>{busy === price.id ? "…" : "Sil"}</button></article>)}</div>;
      })}</div>
    </section>
  </div>;
}
