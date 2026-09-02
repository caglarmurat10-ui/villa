import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar, Skeleton, ErrorState } from "../components/common";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../api/client";
import { normalizeWhatsAppNumber, whatsappTemplateFor } from "../lib/messageTemplates";
import { openWhatsApp } from "../lib/deeplinks";

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

            {data.reservation.phone && (
              <>
                <div className="section-heading">WhatsApp Mesajları — Gönderim İçin Onay Gerekir</div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                  <button className="btn" onClick={() => sendWhatsApp("confirmation")}>Rezervasyon Onayı</button>
                  <button className="btn" onClick={() => sendWhatsApp("location")}>Konum + Giriş</button>
                  <button className="btn" onClick={() => sendWhatsApp("checkout")}>Çıkış Bilgisi</button>
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
    </div>
  );
}
