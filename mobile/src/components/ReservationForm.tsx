import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";

export interface ReservationFormValues {
  villa: "Safira" | "Destan";
  guestName: string;
  checkIn: string;
  checkOut: string;
  channel: "Doğrudan" | "Booking" | "Airbnb" | "Diğer";
  paidAmount: string;
  notes: string;
}

interface Quote { total: number; nights: number; averageRate: number }

const EMPTY: ReservationFormValues = {
  villa: "Safira", guestName: "", checkIn: "", checkOut: "",
  channel: "Doğrudan", paidAmount: "0", notes: "",
};

export function ReservationForm({
  initial, submitLabel, onSubmit,
}: {
  initial?: Partial<ReservationFormValues>;
  submitLabel: string;
  onSubmit: (values: ReservationFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<ReservationFormValues>({ ...EMPTY, ...initial });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Villa/tarih seçilince fiyatı otomatik göster - kullanıcı manuel gecelik ücret girmez.
  useEffect(() => {
    if (!form.villa || !form.checkIn || !form.checkOut || form.checkOut <= form.checkIn) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api.post<Quote>("/quote", { villa: form.villa, checkIn: form.checkIn, checkOut: form.checkOut });
        if (!cancelled) { setQuote(result); setQuoteError(null); }
      } catch (err) {
        if (!cancelled) { setQuote(null); setQuoteError(err instanceof ApiError ? err.message : "Fiyat hesaplanamadı."); }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.villa, form.checkIn, form.checkOut]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!quote) {
      setError("Önce geçerli bir fiyat hesaplanmalı.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {(["Safira", "Destan"] as const).map((v) => (
          <button key={v} type="button" className="btn" style={{ flex: 1, background: form.villa === v ? "#d5aa58" : undefined, color: form.villa === v ? "#1a1408" : undefined }} onClick={() => setForm({ ...form, villa: v })}>
            Villa {v}
          </button>
        ))}
      </div>
      <input className="input" placeholder="Misafir adı" required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input" type="date" required value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} aria-label="Giriş" />
        <input className="input" type="date" required value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} aria-label="Çıkış" />
      </div>
      <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as typeof form.channel })}>
        <option>Doğrudan</option><option>Booking</option><option>Airbnb</option><option>Diğer</option>
      </select>

      <div className="card" style={{ margin: 0 }}>
        {quoteLoading && <p style={{ fontSize: 12, color: "#9fb0c5", margin: 0 }}>Fiyat hesaplanıyor…</p>}
        {!quoteLoading && quote && (
          <p style={{ fontSize: 14, margin: 0 }}><b>{quote.nights} gece</b> · Toplam <b>{quote.total.toLocaleString("tr-TR")}₺</b></p>
        )}
        {!quoteLoading && quoteError && <p style={{ fontSize: 12, color: "#fca5a5", margin: 0 }}>{quoteError}</p>}
        {!quoteLoading && !quote && !quoteError && <p style={{ fontSize: 12, color: "#9fb0c5", margin: 0 }}>Villa ve tarihleri seçin, fiyat otomatik hesaplanır.</p>}
      </div>

      <input className="input" type="number" min={0} placeholder="Alınan ödeme (₺)" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
      <textarea className="input" placeholder="Not" rows={3} style={{ minHeight: 80, paddingTop: 10 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      {error && <div style={{ color: "#fca5a5", fontSize: 12 }}>{error}</div>}
      <button className="btn btn-primary btn-block btn-hero" type="submit" disabled={saving || !quote} style={{ marginTop: 6 }}>{saving ? "Kaydediliyor…" : submitLabel}</button>
    </form>
  );
}
