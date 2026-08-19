"use client";

import { useState } from "react";
import type { Reservation, VillaLocations } from "@/lib/types";

type MessageType = "Giriş" | "Çıkış";

function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

function villaName(reservation: Reservation) {
  return `Villa ${reservation.villa}`;
}

function messageText(reservation: Reservation, type: MessageType, locations: VillaLocations) {
  if (type === "Giriş") {
    return `Merhaba, ${villaName(reservation)} rezervasyonunuz için sizi ağırlamaktan mutluluk duyacağız. Giriş saatimiz 16.00'dır. Varış saatinizi müsait olduğunuzda bizimle paylaşabilirsiniz.\n\nKonum bağlantımız:\n${locations[reservation.villa]}\n\nYola çıkmadan önce bağlantıyı açarak rotanızı kontrol etmenizi rica ederiz. Güvenli ve keyifli bir yolculuk dileriz.`;
  }
  return "Merhaba, bizi tercih ettiğiniz için teşekkür ederiz. Çıkış saatimiz 10.00'dır. Güzel anılarla ayrılmanızı diler, sizi yeniden ağırlamaktan mutluluk duyarız.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export default function MessageCenter({ reservations, locations }: { reservations: Reservation[]; locations: VillaLocations }) {
  const [phones, setPhones] = useState<Record<string, string>>(() => Object.fromEntries(reservations.map((r) => [r.id, r.phone ?? ""])));
  const [savedPhones, setSavedPhones] = useState<Record<string, string>>(() => Object.fromEntries(reservations.map((r) => [r.id, r.phone ?? ""])));
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});

  async function savePhone(reservation: Reservation) {
    const phone = (phones[reservation.id] ?? "").trim();
    if (normalizeWhatsAppNumber(phone).length < 10) {
      setNotice((n) => ({ ...n, [reservation.id]: "Geçerli WhatsApp numarası girin." }));
      return false;
    }
    setSaving(reservation.id);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice((n) => ({ ...n, [reservation.id]: data.error ?? "Numara kaydedilemedi." }));
        return false;
      }
      const stored = data.reservation?.phone ?? phone;
      setPhones((p) => ({ ...p, [reservation.id]: stored }));
      setSavedPhones((p) => ({ ...p, [reservation.id]: stored }));
      setNotice((n) => ({ ...n, [reservation.id]: "Numara kaydedildi." }));
      return true;
    } catch {
      setNotice((n) => ({ ...n, [reservation.id]: "Bağlantı hatası. Tekrar deneyin." }));
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function send(reservation: Reservation, type: MessageType) {
    const phone = (phones[reservation.id] ?? "").trim();
    if (type === "Giriş" && !locations[reservation.villa]) {
      setNotice((n) => ({ ...n, [reservation.id]: `${villaName(reservation)} konum bağlantısı Ayarlar bölümünde tanımlı değil.` }));
      return;
    }
    if (normalizeWhatsAppNumber(phone).length < 10) {
      setNotice((n) => ({ ...n, [reservation.id]: "Önce WhatsApp numarasını girin." }));
      return;
    }
    if (phone !== savedPhones[reservation.id]) {
      if (!await savePhone(reservation)) return;
    }
    const text = messageText({ ...reservation, phone }, type, locations);
    window.open(`https://wa.me/${normalizeWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return <main className="message-page">
    <div className="message-top"><a href="/">← Ana panele dön</a><span>Villa Yönetim</span></div>
    <section className="message-panel">
      <div className="message-hero"><div><span className="eyebrow">WHATSAPP MESAJLARI</span><h1>Numarayı burada gir, mesajı gönder</h1><p>Rezervasyon oluştururken telefon numarası girmen gerekmez. Burada bir kez kaydetmen yeterli.</p></div></div>
      <div className="message-list">{reservations.length === 0 ? <div className="message-empty">Aktif rezervasyon yok.</div> : reservations.map((r) => <article className="message-card" key={r.id}>
        <div className={`message-villa ${r.villa.toLowerCase()}`}>{r.villa[0]}</div>
        <div className="message-info"><strong>{r.guestName}</strong><span>{villaName(r)} · {formatDate(r.checkIn)} — {formatDate(r.checkOut)}</span><label>WhatsApp numarası<input type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" value={phones[r.id] ?? ""} onChange={(e) => setPhones((p) => ({ ...p, [r.id]: e.target.value }))} /></label>{notice[r.id] ? <small>{notice[r.id]}</small> : null}</div>
        <div className="message-actions"><button className="phone-save" disabled={saving === r.id} onClick={() => savePhone(r)}>{saving === r.id ? "Kaydediliyor…" : "Numarayı kaydet"}</button><button className="checkin" onClick={() => send(r, "Giriş")}>Giriş & konum</button><button className="checkout" onClick={() => send(r, "Çıkış")}>Çıkış</button></div>
      </article>)}</div>
    </section>
  </main>;
}
