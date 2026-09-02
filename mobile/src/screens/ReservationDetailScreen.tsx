import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TopBar, Skeleton, ErrorState } from "../components/common";
import { BottomSheet } from "../components/BottomSheet";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../api/client";

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
              {data.reservation.notes && <div style={{ marginTop: 10, fontSize: 12, color: "#9fb0c5" }}>{data.reservation.notes}</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "14px 0" }}>
              <Link to={`/rezervasyonlar/${id}/duzenle`} className="btn" style={{ textAlign: "center", fontSize: 12, padding: "0 6px" }}>✏️ Düzenle</Link>
              <button className="btn" style={{ fontSize: 12, padding: "0 6px" }} onClick={openPaymentSheet}>💳 Ödeme Güncelle</button>
              <Link to={`/mesajlar?villa=${data.reservation.villa}`} className="btn" style={{ textAlign: "center", fontSize: 12, padding: "0 6px" }}>💬 Mesaj Hazırla</Link>
            </div>

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
