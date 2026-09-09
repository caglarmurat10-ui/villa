"use client";

import { useState } from "react";
import type { Reservation, VillaLocations } from "@/lib/types";
import { normalizeWhatsappPhone } from "@/lib/whatsapp/phone";
import { CHECKOUT_REMINDER_MESSAGE_TEXT } from "@/lib/whatsapp/checkout-message";
import type { WhatsappScheduledMessage } from "@/lib/whatsapp/types";

type MessageType = "Giriş" | "Çıkış";

const MAP_LINKS = {
  Destan: "https://maps.app.goo.gl/8zCrgoegzri52ro79",
  Safira: "https://maps.app.goo.gl/fKBpCQhn5Qneuo5H6",
} as const;

function villaName(reservation: Reservation) {
  return `${reservation.villa} Villa`;
}

function locationLink(reservation: Reservation, locations: VillaLocations) {
  return locations[reservation.villa] || MAP_LINKS[reservation.villa];
}

function messageText(reservation: Reservation, type: MessageType, locations: VillaLocations) {
  if (type === "Giriş") {
    const mapLink = locationLink(reservation, locations);
    return `Merhaba 👋\n\n${villaName(reservation)} rezervasyonunuz için sizi ağırlamaktan mutluluk duyacağız.\n\n📍 ${villaName(reservation)} konumu:\n${mapLink}\n\n🕓 Giriş saatimiz 16.00’dır.\n\nVillaya sorunsuz şekilde giriş yapabilmeniz için konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz.\n\nŞimdiden iyi yolculuklar dileriz.`;
  }

  return CHECKOUT_REMINDER_MESSAGE_TEXT;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function automationStatusLine(message: WhatsappScheduledMessage | undefined): { label: string; className: string } | null {
  if (!message) return null;
  switch (message.status) {
    case "SCHEDULED":
      return { label: `Çıkış mesajı · ${formatDateTime(message.scheduledAt)} · Planlandı`, className: "scheduled" };
    case "SENDING":
      return { label: "Gönderiliyor…", className: "scheduled" };
    case "SENT":
      return { label: `Gönderildi · ${message.sentAt ? formatDateTime(message.sentAt) : ""}`, className: "sent" };
    case "DELIVERED":
      return { label: `İletildi · ${message.deliveredAt ? formatDateTime(message.deliveredAt) : ""}`, className: "delivered" };
    case "READ":
      return { label: `Okundu · ${message.readAt ? formatDateTime(message.readAt) : ""}`, className: "read" };
    case "FAILED":
      return { label: "Gönderilemedi", className: "failed" };
    case "SKIPPED_NOT_CONFIGURED":
      return { label: "WhatsApp otomasyonu bağlı değil", className: "not-configured" };
    case "CANCELLED":
      return { label: "Otomatik hatırlatma iptal edildi", className: "cancelled" };
    default:
      return null;
  }
}

export default function MessageCenter({ reservations, locations, checkoutReminders }: { reservations: Reservation[]; locations: VillaLocations; checkoutReminders: Record<string, WhatsappScheduledMessage> }) {
  const [items, setItems] = useState(reservations);
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>(() => Object.fromEntries(reservations.map((reservation) => [reservation.id, reservation.phone ?? ""])));
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [reminders, setReminders] = useState(checkoutReminders);
  const [previewOpenId, setPreviewOpenId] = useState<string | null>(null);
  const [automationBusy, setAutomationBusy] = useState<string | null>(null);

  async function automationAction(reservationId: string, action: "enable" | "disable" | "retry") {
    setAutomationBusy(reservationId);
    try {
      const response = await fetch(`/api/admin/whatsapp/checkout-reminders/${encodeURIComponent(reservationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "İşlem tamamlanamadı.");
      setReminders((current) => ({ ...current, [reservationId]: data.message }));
    } catch (error) {
      setNotice((current) => ({ ...current, [reservationId]: error instanceof Error ? error.message : "İşlem tamamlanamadı." }));
    } finally {
      setAutomationBusy(null);
    }
  }

  async function savePhone(reservation: Reservation) {
    const phone = (phoneDrafts[reservation.id] ?? "").trim();
    if (normalizeWhatsappPhone(phone).length < 10) {
      setNotice((current) => ({ ...current, [reservation.id]: "Geçerli bir WhatsApp numarası girin." }));
      return;
    }

    setSavingPhone(reservation.id);
    setNotice((current) => ({ ...current, [reservation.id]: "" }));
    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "WhatsApp numarası kaydedilemedi.");

      setItems((current) => current.map((item) => item.id === reservation.id ? data.reservation : item));
      setPhoneDrafts((current) => ({ ...current, [reservation.id]: data.reservation.phone ?? phone }));
      setNotice((current) => ({ ...current, [reservation.id]: "WhatsApp numarası kaydedildi." }));
    } catch (error) {
      setNotice((current) => ({ ...current, [reservation.id]: error instanceof Error ? error.message : "WhatsApp numarası kaydedilemedi." }));
    } finally {
      setSavingPhone(null);
    }
  }

  function send(reservation: Reservation, type: MessageType) {
    const phone = (reservation.phone ?? "").trim();
    const number = normalizeWhatsappPhone(phone);

    if (type === "Giriş" && !locationLink(reservation, locations)) {
      setNotice((current) => ({ ...current, [reservation.id]: `${villaName(reservation)} konum bağlantısı tanımlı değil.` }));
      return;
    }
    if (number.length < 10) {
      setNotice((current) => ({ ...current, [reservation.id]: "Önce aşağıdaki alana WhatsApp numarasını girip kaydedin." }));
      return;
    }

    const text = messageText(reservation, type, locations);
    const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    window.location.href = url;
  }

  return <main className="message-page">
    <div className="message-top"><a href="/">← Ana panele dön</a><span>Villa Yönetim</span></div>
    <section className="message-panel">
      <div className="message-hero"><div><span className="eyebrow">WHATSAPP MESAJLARI</span><h1>Hazır müşteri mesajları</h1><p>Her rezervasyonda WhatsApp numarasını buradan girebilir veya değiştirebilirsiniz. Kaydettikten sonra Giriş ya da Çıkış düğmesi ilgili kişiyi doğrudan WhatsApp'ta açar.</p></div></div>
      <div className="message-list">{items.length === 0 ? <div className="message-empty">Aktif rezervasyon yok.</div> : items.map((reservation) => <article className="message-card" key={reservation.id}>
        <div className={`message-villa ${reservation.villa.toLowerCase()}`}>{reservation.villa[0]}</div>
        <div className="message-info">
          <strong>{reservation.guestName}</strong>
          <span>{villaName(reservation)} · {formatDate(reservation.checkIn)} — {formatDate(reservation.checkOut)}</span>
          <span className={reservation.phone ? "contact-ready" : "contact-missing"}>{reservation.phone ? `Kayıtlı WhatsApp: ${reservation.phone}` : "WhatsApp numarası eksik"}</span>
          <label>
            <span>WhatsApp numarası</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="05xx xxx xx xx"
              value={phoneDrafts[reservation.id] ?? ""}
              onChange={(event) => setPhoneDrafts((current) => ({ ...current, [reservation.id]: event.target.value }))}
            />
          </label>
          {notice[reservation.id] ? <small>{notice[reservation.id]}</small> : null}
          {(() => {
            const reminder = reminders[reservation.id];
            const status = automationStatusLine(reminder);
            if (!status) return null;
            const showPreview = previewOpenId === reservation.id;
            const busy = automationBusy === reservation.id;
            return <div className="message-automation">
              <div className="automation-line">
                <span className={`automation-status ${status.className}`}>{status.label}</span>
                <button type="button" onClick={() => setPreviewOpenId(showPreview ? null : reservation.id)} style={{ background: "none", border: "none", color: "#93c5fd", fontSize: 10, cursor: "pointer", padding: 0 }}>
                  {showPreview ? "Metni gizle" : "Metni gör"}
                </button>
              </div>
              {showPreview ? <p className="automation-preview">{CHECKOUT_REMINDER_MESSAGE_TEXT}</p> : null}
              {reminder?.status === "SCHEDULED" ? (
                <div className="automation-row">
                  <button type="button" disabled={busy} onClick={() => void automationAction(reservation.id, reminder.autoEnabled ? "disable" : "enable")}>
                    {busy ? "İşleniyor…" : reminder.autoEnabled ? "Otomatik gönderimi kapat" : "Otomatik gönderimi aç"}
                  </button>
                </div>
              ) : null}
              {reminder?.status === "FAILED" ? (
                <div className="automation-row">
                  <span>{reminder.failureReason ?? "Bilinmeyen hata"}</span>
                  <button type="button" className="retry" disabled={busy} onClick={() => void automationAction(reservation.id, "retry")}>
                    {busy ? "İşleniyor…" : "Yeniden dene"}
                  </button>
                </div>
              ) : null}
            </div>;
          })()}
        </div>
        <div className="message-actions">
          <button className="phone-save" disabled={savingPhone === reservation.id} onClick={() => void savePhone(reservation)}>{savingPhone === reservation.id ? "Kaydediliyor…" : "Numarayı kaydet"}</button>
          <button className="checkin" onClick={() => send(reservation, "Giriş")}>Giriş & konum</button>
          <button className="checkout" onClick={() => send(reservation, "Çıkış")}>Çıkış</button>
        </div>
      </article>)}</div>
    </section>
  </main>;
}
