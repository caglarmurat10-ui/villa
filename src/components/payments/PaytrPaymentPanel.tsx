"use client";

import { useEffect, useState } from "react";
import type { Reservation } from "@/lib/types";

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

interface PaymentRow {
  id: string;
  paymentType: "deposit" | "full_payment" | "balance_payment";
  status: string;
  requestedAmountMinor: number;
  createdAt: string;
  paidAt: string | null;
  testMode: boolean;
}

const TYPE_LABEL: Record<string, string> = { deposit: "%20 Ön Ödeme", full_payment: "Tam Ödeme", balance_payment: "Kalan Bakiye" };
const STATUS_LABEL: Record<string, string> = {
  created: "Oluşturuldu",
  pending: "Ödeme bekleniyor",
  paid: "Ödendi ✓",
  failed: "Başarısız",
  cancelled: "İptal edildi",
  refunded: "İade edildi",
  partial_refund: "Kısmi iade",
};

export default function PaytrPaymentPanel({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<{ reservationTotalMinor: number; paidTotalMinor: number; remainingTotalMinor: number } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"deposit" | "full_payment" | null>(null);
  const [notice, setNotice] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch(`/api/admin/payments?reservationId=${encodeURIComponent(reservation.id)}`);
    const data = await response.json().catch(() => ({}));
    setPayments(data.payments ?? []);
    setSummary(data.summary ?? null);
    setConfigured(Boolean(data.paytrConfigured));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation.id]);

  async function createPayment(paymentType: "deposit" | "full_payment") {
    setBusy(paymentType);
    setNotice("");
    setLastLink(null);
    try {
      const response = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: reservation.id, paymentType }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Ödeme oluşturulamadı.");
      const link = `${window.location.origin.replace("admin.", "")}${data.checkoutUrl}`;
      setLastLink(link);
      setNotice("✓ Ödeme linki oluşturuldu - aşağıdan kopyalayıp müşteriye gönderin.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ödeme oluşturulamadı.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,10,8,.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ maxWidth: 560, width: "100%", maxHeight: "86vh", overflowY: "auto", border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 20, color: "#eef6ff" }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>PAYTR ÖDEME</small>
            <h2 style={{ margin: "5px 0 4px", fontSize: 16 }}>{reservation.guestName} · {reservation.villa}</h2>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", color: "#8fa4bd", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        {configured === false ? (
          <div style={{ marginTop: 14, padding: "10px 12px", border: "1px solid #a16207", borderRadius: 9, background: "#241a06", color: "#fbbf24", fontSize: 11 }}>
            PayTR yapılandırılmadı - ödeme linki oluşturulamaz. Cloudflare secret'ları eklendiğinde bu bölüm otomatik aktif olacak.
          </div>
        ) : null}

        {summary ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14, fontSize: 11, color: "#9fb0c5" }}>
            <div>Toplam<br /><b style={{ color: "#eef6ff", fontSize: 14 }}>{money.format(summary.reservationTotalMinor / 100)}</b></div>
            <div>Ödenen<br /><b style={{ color: "#86efac", fontSize: 14 }}>{money.format(summary.paidTotalMinor / 100)}</b></div>
            <div>Kalan<br /><b style={{ color: summary.remainingTotalMinor > 0 ? "#fbbf24" : "#86efac", fontSize: 14 }}>{money.format(summary.remainingTotalMinor / 100)}</b></div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => createPayment("deposit")}
            disabled={busy !== null || configured === false}
            style={{ flex: 1, border: "1px solid #47617f", borderRadius: 9, padding: "10px 12px", background: "#102238", color: "#dbeafe", fontSize: 11, fontWeight: 800, cursor: configured === false ? "not-allowed" : "pointer" }}
          >
            {busy === "deposit" ? "Oluşturuluyor…" : "%20 Ön Ödeme Oluştur"}
          </button>
          <button
            type="button"
            onClick={() => createPayment("full_payment")}
            disabled={busy !== null || configured === false}
            style={{ flex: 1, border: "1px solid #47617f", borderRadius: 9, padding: "10px 12px", background: "#102238", color: "#dbeafe", fontSize: 11, fontWeight: 800, cursor: configured === false ? "not-allowed" : "pointer" }}
          >
            {busy === "full_payment" ? "Oluşturuluyor…" : "Tam Ödeme Oluştur"}
          </button>
        </div>

        {notice ? <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid #2e5075", background: "#0b1b2e", color: "#bfdbfe", fontSize: 10 }}>{notice}</div> : null}
        {lastLink ? (
          <div style={{ marginTop: 8, padding: "8px 10px", border: "1px dashed #47617f", borderRadius: 8, fontSize: 10, color: "#dbeafe", overflowWrap: "anywhere" }}>
            {lastLink}
          </div>
        ) : null}

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #203954" }}>
          <strong style={{ fontSize: 11, color: "#93c5fd" }}>Ödeme geçmişi</strong>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {payments.length === 0 ? (
              <p style={{ fontSize: 10, color: "#8fa4bd", margin: 0 }}>Henüz ödeme kaydı yok.</p>
            ) : payments.map((payment) => (
              <div key={payment.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", border: `1px solid ${payment.testMode ? "#a16207" : "#1f3551"}`, borderRadius: 8, background: "#0b1728", fontSize: 10 }}>
                <span>{payment.testMode ? <b style={{ color: "#fbbf24" }}>TEST · </b> : null}{TYPE_LABEL[payment.paymentType] ?? payment.paymentType}</span>
                <span style={{ color: payment.status === "paid" ? "#86efac" : payment.status === "failed" ? "#fca5a5" : "#9fb0c5" }}>{payment.testMode && payment.status === "paid" ? "TEST — Başarılı" : (STATUS_LABEL[payment.status] ?? payment.status)}</span>
                <b>{money.format(payment.requestedAmountMinor / 100)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
