"use client";

import { useState } from "react";
import type { Reservation, VillaLocations } from "@/lib/types";

type MessageType = "Giriş" | "Çıkış";

const MAP_LINKS = {
  Destan: "https://maps.app.goo.gl/8zCrgoegzri52ro79",
  Safira: "https://maps.app.goo.gl/fKBpCQhn5Qneuo5H6",
} as const;

function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

function villaName(reservation: Reservation) {
  return `${reservation.villa} Villa`;
}

function locationLink(reservation: Reservation, locations: VillaLocations) {
  return locations[reservation.villa] || MAP_LINKS[reservation.villa];
}

function messageText(reservation: Reservation, type: MessageType, locations: VillaLocations) {
  if (type === "Giriş") {
    const mapLink = locationLink(reservation, locations);
    return `Merhaba 👋\n\n${villaName(reservation)} rezervasyonunuz için sizi ağırlamaktan mutluluk duyacağız.\n\n📍 ${villaName(reservation)} konumu:\n${mapLink}\n\n🕓 Giriş saatimiz 16.00’dır.\n\nVarış saatinizi müsait olduğunuzda bizimle paylaşabilirsiniz.\n\nVillaya sorunsuz şekilde giriş yapabilmeniz için konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz.\n\nŞimdiden iyi yolculuklar dileriz.`;
  }

  return `Merhaba 👋\n\nBizi tercih ettiğiniz için teşekkür ederiz.\n\n🧳 Çıkış saatimiz 10.00’dır.\n\nÇıkış öncesinde size iletilen saat ve teslim bilgilerini kontrol etmenizi rica ederiz.\n\nGüzel anılarla ayrılmanızı diler, sizi yeniden ağırlamaktan memnuniyet duyarız.`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export default function MessageCenter({ reservations, locations }: { reservations: Reservation[]; locations: VillaLocations }) {
  const [notice, setNotice] = useState<Record<string, string>>({});

  function send(reservation: Reservation, type: MessageType) {
    const phone = (reservation.phone ?? "").trim();
    const number = normalizeWhatsAppNumber(phone);

    if (type === "Giriş" && !locationLink(reservation, locations)) {
      setNotice((current) => ({ ...current, [reservation.id]: `${villaName(reservation)} konum bağlantısı tanımlı değil.` }));
      return;
    }
    if (number.length < 10) {
      setNotice((current) => ({ ...current, [reservation.id]: "Bu rezervasyonda kayıtlı WhatsApp numarası yok. Ana Takip bölümünden rezervasyonu düzenleyip numarayı ekleyin." }));
      return;
    }

    const text = messageText(reservation, type, locations);
    const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

    // Kullanıcı tıklamasından hemen sonra, araya async kayıt işlemi sokmadan WhatsApp'a geç.
    // Mobil tarayıcıların popup engeline takılmaması için aynı sekmede yönlendiriyoruz.
    window.location.href = url;
  }

  return <main className="message-page">
    <div className="message-top"><a href="/">← Ana panele dön</a><span>Villa Yönetim</span></div>
    <section className="message-panel">
      <div className="message-hero"><div><span className="eyebrow">WHATSAPP MESAJLARI</span><h1>Hazır müşteri mesajları</h1><p>Rezervasyonda daha önce kaydedilen WhatsApp numarası kullanılır. Giriş veya çıkışa dokunduğunuzda ilgili kişi doğrudan WhatsApp'ta açılır.</p></div></div>
      <div className="message-list">{reservations.length === 0 ? <div className="message-empty">Aktif rezervasyon yok.</div> : reservations.map((reservation) => <article className="message-card" key={reservation.id}>
        <div className={`message-villa ${reservation.villa.toLowerCase()}`}>{reservation.villa[0]}</div>
        <div className="message-info"><strong>{reservation.guestName}</strong><span>{villaName(reservation)} · {formatDate(reservation.checkIn)} — {formatDate(reservation.checkOut)}</span><span className={reservation.phone ? "contact-ready" : "contact-missing"}>{reservation.phone ? `WhatsApp: ${reservation.phone}` : "WhatsApp numarası eksik"}</span>{notice[reservation.id] ? <small>{notice[reservation.id]}</small> : null}</div>
        <div className="message-actions"><button className="checkin" onClick={() => send(reservation, "Giriş")}>Giriş & konum</button><button className="checkout" onClick={() => send(reservation, "Çıkış")}>Çıkış</button></div>
      </article>)}</div>
    </section>
  </main>;
}
