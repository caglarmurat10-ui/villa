import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/common";
import { api, ApiError } from "../api/client";

export function NewReservationScreen() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    villa: "Safira" as "Safira" | "Destan",
    guestName: "", phone: "", checkIn: "", checkOut: "",
    channel: "Doğrudan" as "Doğrudan" | "Booking" | "Airbnb" | "Diğer",
    nightlyRate: "", paidAmount: "0", notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<{ reservation: { id: string } }>("/reservations", {
        ...form,
        nightlyRate: Number(form.nightlyRate) || 0,
        paidAmount: Number(form.paidAmount) || 0,
      });
      navigate(`/rezervasyonlar/${result.reservation.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kayıt oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <TopBar title="Yeni Rezervasyon" />
      <div className="app-content">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Safira", "Destan"] as const).map((v) => (
              <button key={v} type="button" className="btn" style={{ flex: 1, background: form.villa === v ? "#d5aa58" : undefined, color: form.villa === v ? "#1a1408" : undefined }} onClick={() => setForm({ ...form, villa: v })}>
                Villa {v}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Misafir adı" required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
          <input className="input" placeholder="Telefon (WhatsApp)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" type="date" required value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
            <input className="input" type="date" required value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </div>
          <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as typeof form.channel })}>
            <option>Doğrudan</option><option>Booking</option><option>Airbnb</option><option>Diğer</option>
          </select>
          <input className="input" type="number" min={0} placeholder="Gecelik ücret (₺)" value={form.nightlyRate} onChange={(e) => setForm({ ...form, nightlyRate: e.target.value })} />
          <input className="input" type="number" min={0} placeholder="Ödenen tutar (₺)" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} />
          <textarea className="input" placeholder="Not" rows={3} style={{ minHeight: 80, paddingTop: 10 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {error && <div style={{ color: "#fca5a5", fontSize: 12 }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "Rezervasyonu Kaydet"}</button>
        </form>
      </div>
    </div>
  );
}
