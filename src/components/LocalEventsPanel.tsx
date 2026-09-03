"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

type EventStatus = "pending_review" | "approved" | "rejected" | "published";

type LocalEventCandidate = {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  eventDateEnd: string | null;
  venue: string;
  feeInfo: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  status: EventStatus;
  createdAt: string;
};

const STATUS_LABEL: Record<EventStatus, string> = {
  pending_review: "REVIEW_REQUIRED",
  approved: "Onaylandı (yine de otomatik yayınlanmaz)",
  rejected: "Reddedildi",
  published: "Yayınlandı (elle)",
};
const STATUS_COLOR: Record<EventStatus, string> = {
  pending_review: "#fbbf24",
  approved: "#86efac",
  rejected: "#fca5a5",
  published: "#93c5fd",
};

const emptyForm = { title: "", description: "", eventDate: "", eventDateEnd: "", venue: "", feeInfo: "", sourceName: "", sourceUrl: "" };

// Faz 6.1 bölüm 10 - backend (local-events.ts, /api/admin/local-events) zaten vardı, admin UI'ı
// buydu. Haftalık manuel kaynak-kontrolü iş akışını destekler - GERÇEK bir otomatik scraper
// DEĞİL (Kaş Belediyesi/bölge kültür-turizm kaynakları için güvenilir bir canlı API yok).
// "approved" yapmak dahi otomatik yayın ANLAMINA GELMEZ - yalnız "bu bilgi doğrulandı, bir sosyal
// gönderi taslağı hazırlanabilir" demektir; gerçek gönderiyi admin ayrı, elle oluşturur.
export default function LocalEventsPanel() {
  const [events, setEvents] = useState<LocalEventCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/local-events", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Etkinlik listesi alınamadı.");
        return;
      }
      setEvents((body.candidates ?? []) as LocalEventCandidate[]);
    } catch {
      setError("Etkinlik listesine ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // queueMicrotask: bkz. GbpLocationPicker.tsx aynı desen - load()'ın ilk satırı senkron
    // setState, mikro-görev ertelemesi derleyici uyarısını davranışı değiştirmeden kırar.
    queueMicrotask(() => { load(); });
  }, []);

  async function submitCandidate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/local-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Etkinlik kaydedilemedi.");
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: EventStatus) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/local-events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px" }}>
      <div style={{ border: "1px solid #223a57", borderRadius: 14, background: "#0b1728", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 1.5, color: "#93c5fd", fontWeight: 800 }}>YEREL ETKİNLİKLER</span>
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#8fa4bd" }}>
              Haftalık manuel kaynak kontrolü (Kaş Belediyesi, resmî kültür-turizm kaynakları) - hiçbir aday otomatik yayınlanmaz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            style={{ padding: "8px 12px", border: "1px solid #47617f", borderRadius: 8, background: "#102238", color: "#dbeafe", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
          >
            {showForm ? "Vazgeç" : "+ Aday Ekle"}
          </button>
        </div>

        {error ? <p style={{ marginTop: 8, fontSize: 10, color: "#fca5a5" }}>{error}</p> : null}

        {showForm ? (
          <form onSubmit={submitCandidate} style={{ marginTop: 12, display: "grid", gap: 8, padding: 12, border: "1px solid #223a57", borderRadius: 10, background: "#081522" }}>
            <input required placeholder="Etkinlik adı" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <textarea placeholder="Açıklama (isteğe bağlı)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={labelStyle}>Tarih<input required type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Bitiş (isteğe bağlı)<input type="date" value={form.eventDateEnd} onChange={(e) => setForm({ ...form, eventDateEnd: e.target.value })} style={inputStyle} /></label>
            </div>
            <input placeholder="Yer" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} style={inputStyle} />
            <input placeholder="Ücret bilgisi (isteğe bağlı, doğrulanmış kaynaktan)" value={form.feeInfo} onChange={(e) => setForm({ ...form, feeInfo: e.target.value })} style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={labelStyle}>Kaynak adı<input required placeholder="ör. Kaş Belediyesi" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Kaynak URL<input required type="url" placeholder="https://..." value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} style={inputStyle} /></label>
            </div>
            <button type="submit" disabled={saving} style={{ padding: "8px 12px", border: "1px solid #47617f", borderRadius: 8, background: "#173f2a", color: "#bbf7d0", fontSize: 10, fontWeight: 800, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Kaydediliyor…" : "Aday olarak kaydet (REVIEW_REQUIRED)"}
            </button>
          </form>
        ) : null}

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {loading ? <p style={{ fontSize: 10, color: "#8fa4bd" }}>Yükleniyor…</p> : null}
          {!loading && events.length === 0 ? <p style={{ fontSize: 10, color: "#8fa4bd" }}>Henüz etkinlik adayı yok.</p> : null}
          {events.map((ev) => (
            <div key={ev.id} style={{ padding: "10px 12px", border: "1px solid #223a57", borderRadius: 10, background: "#0e1f33" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <b style={{ fontSize: 11, color: "#e2e8f0" }}>{ev.title}</b>
                <span style={{ fontSize: 9, fontWeight: 800, color: STATUS_COLOR[ev.status] }}>{STATUS_LABEL[ev.status]}</span>
              </div>
              <p style={{ margin: "4px 0", fontSize: 9, color: "#9fb0c5" }}>
                {ev.eventDate}{ev.eventDateEnd ? ` – ${ev.eventDateEnd}` : ""}{ev.venue ? ` · ${ev.venue}` : ""}{ev.feeInfo ? ` · ${ev.feeInfo}` : ""}
              </p>
              <p style={{ margin: "4px 0", fontSize: 9, color: "#7c8ba3" }}>
                Kaynak: {ev.sourceName} — <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#93c5fd" }}>{ev.sourceUrl}</a>
                <br />retrieved_at: {new Date(ev.retrievedAt).toLocaleString("tr-TR")}
              </p>
              {ev.status === "pending_review" ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" disabled={busyId === ev.id} onClick={() => setStatus(ev.id, "approved")} style={{ padding: "6px 10px", border: "1px solid #16653488", borderRadius: 7, background: "#0f2e1c", color: "#86efac", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>Onayla (doğrulandı)</button>
                  <button type="button" disabled={busyId === ev.id} onClick={() => setStatus(ev.id, "rejected")} style={{ padding: "6px 10px", border: "1px solid #7f1d1d88", borderRadius: 7, background: "#2a1212", color: "#fca5a5", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>Reddet</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const inputStyle: CSSProperties = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #334155", background: "#081522", color: "#e2e8f0", fontSize: 10 };
const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 9, color: "#9fb0c5" };
