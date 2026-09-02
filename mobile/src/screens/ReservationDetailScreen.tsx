import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TopBar, Skeleton, ErrorState } from "../components/common";
import { BottomSheet } from "../components/BottomSheet";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../api/client";
import { normalizeWhatsAppNumber, whatsappTemplateFor } from "../lib/messageTemplates";
import { openWhatsApp, openPhone } from "../lib/deeplinks";

interface Reservation {
  id: string; villa: "Safira" | "Destan"; guestName: string; phone: string;
  checkIn: string; checkOut: string; totalAmount: number; paidAmount: number;
  channel: string; notes: string;
}

export function ReservationDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi<{ reservation: Reservation }>(`/reservations/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidInput, setPaidInput] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function cancelReservation() {
    if (!confirm("Bu rezervasyonu iptal etmek istediğinize emin misiniz?")) return;
    setBusy(true);
    try {
      await api.delete(`/reservations/${id}`);
      navigate("/rezervasyonlar", { replace: true });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "İptal edilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function sendWhatsApp(kind: "confirmation" | "location" | "checkout" | "review") {
    if (!data) return;
    const message = whatsappTemplateFor(kind, data.reservation);
    await openWhatsApp(`https://wa.me/${normalizeWhatsAppNumber(data.reservation.phone)}?text=${encodeURIComponent(message)}`);
  }

  function openPaymentSheet() {
    if (!data) return;
    setPaidInput(String(data.reservation.paidAmount));
    setPaymentError(null);
    setPaymentOpen(true);
  }

  async function savePayment() {
    setPaymentSaving(true);
    setPaymentError(null);
    try {
      await api.patch(`/reservations/${id}`, { paidAmount: Number(paidInput) || 0 });
      setPaymentOpen(false);
      await reload();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : "Güncellenemedi.");
    } finally {
      setPaymentSaving(false);
    }
  }

  return (
    <div>
      <TopBar title="Rezervasyon Detayı" />
      <div className="app-content">
        {loading && <Skeleton count={3} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && (
          <>
            <div className="card">
              <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{data.reservation.guestName}</h2>
              <div style={{ fontSize: 13, color: "#9fb0c5" }}>Villa {data.reservation.villa} · {data.reservation.channel}</div>
              <div style={{ marginTop: 10, fontSize: 13 }}>{data.reservation.checkIn} → {data.reservation.checkOut}</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>{data.reservation.paidAmount.toLocaleString("tr-TR")}₺ / {data.reservation.totalAmount.toLocaleString("tr-TR")}₺ ödendi</div>
              {data.reservation.phone && <div style={{ marginTop: 6, fontSize: 13, color: "#9fb0c5" }}>{data.reservation.phone}</div>}
              {data.reservation.notes && <div style={{ marginTop: 10, fontSize: 12, color: "#9fb0c5" }}>{data.reservation.notes}</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "14px 0" }}>
              <Link to={`/rezervasyonlar/${id}/duzenle`} className="btn" style={{ textAlign: "center" }}>✏️ Düzenle</Link>
              <button className="btn" onClick={openPaymentSheet}>💳 Ödeme Güncelle</button>
              {data.reservation.phone ? (
                <button className="btn" onClick={() => openPhone(normalizeWhatsAppNumber(data.reservation.phone))}>📞 Ara</button>
              ) : <div />}
              {data.reservation.phone ? (
                <button className="btn" onClick={() => sendWhatsApp("confirmation")}>💬 WhatsApp</button>
              ) : <div />}
            </div>

            {data.reservation.phone && (
              <>
                <div className="section-heading">Mesaj Şablonları — Gönderim İçin Onay Gerekir</div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                  <button className="btn" onClick={() => sendWhatsApp("confirmation")}>Rezervasyon Onayı</button>
                  <button className="btn" onClick={() => sendWhatsApp("location")}>Giriş &amp; Konum</button>
                  <button className="btn" onClick={() => sendWhatsApp("checkout")}>Çıkış</button>
                  <button className="btn" onClick={() => sendWhatsApp("review")}>Yorum İsteme</button>
                </div>
                <p style={{ fontSize: 10, color: "#6b7787", marginTop: 8 }}>WhatsApp açılır, mesaj hazır gelir — göndermek için siz onaylarsınız. Otomatik gönderim yapılmaz.</p>
              </>
            )}

            {actionError && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 10 }}>{actionError}</div>}
            <button className="btn btn-block" style={{ marginTop: 16, borderColor: "#dc2626", color: "#fca5a5" }} onClick={cancelReservation} disabled={busy}>
              {busy ? "İşleniyor…" : "Rezervasyonu İptal Et"}
            </button>
          </>
        )}
      </div>

      <BottomSheet open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Ödeme Güncelle">
        {data && (
          <>
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>Toplam: <b>{data.reservation.totalAmount.toLocaleString("tr-TR")}₺</b></p>
            <p style={{ fontSize: 13, margin: "0 0 4px" }}>Alınan: <b>{Number(paidInput || 0).toLocaleString("tr-TR")}₺</b></p>
            <p style={{ fontSize: 13, margin: "0 0 14px" }}>Kalan: <b>{Math.max(0, data.reservation.totalAmount - (Number(paidInput) || 0)).toLocaleString("tr-TR")}₺</b></p>
            <input className="input" type="number" min={0} placeholder="Alınan toplam ödeme (₺)" value={paidInput} onChange={(e) => setPaidInput(e.target.value)} />
            {paymentError && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 8 }}>{paymentError}</div>}
            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={savePayment} disabled={paymentSaving}>
              {paymentSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
