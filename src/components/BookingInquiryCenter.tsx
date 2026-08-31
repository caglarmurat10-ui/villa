"use client";

import { useMemo, useState } from "react";
import type { BookingInquiry, BookingInquiryStatus } from "@/lib/booking-inquiries";

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function formatStay(checkIn: string, checkOut: string) {
  const formatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  return `${formatter.format(new Date(`${checkIn}T12:00:00`))} — ${formatter.format(new Date(`${checkOut}T12:00:00`))}`;
}

function formatCreated(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeWhatsAppNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `90${digits}`;
  else if (digits.length === 11 && digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  return digits;
}

export default function BookingInquiryCenter({ initialItems }: { initialItems: BookingInquiry[] }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<"Tümü" | BookingInquiryStatus>("Tümü");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const counts = useMemo(() => ({
    all: items.length,
    new: items.filter((item) => item.status === "Yeni").length,
    contacted: items.filter((item) => item.status === "İletişime geçildi").length,
  }), [items]);

  const visible = filter === "Tümü" ? items : items.filter((item) => item.status === filter);

  async function changeStatus(id: string, status: BookingInquiryStatus) {
    setBusyId(id);
    setNotice("");
    try {
      const response = await fetch(`/api/booking-inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Talep güncellenemedi.");
      setItems((current) => current.map((item) => item.id === id ? data.inquiry : item));
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Talep güncellenemedi.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function openWhatsApp(item: BookingInquiry) {
    const number = normalizeWhatsAppNumber(item.phone);
    if (number.length < 10) {
      setNotice("Bu talepte geçerli bir WhatsApp numarası bulunmuyor.");
      return;
    }
    if (item.status === "Yeni" && !item.convertedReservationId) await changeStatus(item.id, "İletişime geçildi");
    const text = `Merhaba, Villa ${item.villa} için ${formatStay(item.checkIn, item.checkOut)} tarihli rezervasyon talebiniz bize ulaştı. Size yardımcı olmaktan memnuniyet duyarız.`;
    window.location.href = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  }

  async function convertInquiry(item: BookingInquiry) {
    if (item.convertedReservationId) return;
    const accepted = window.confirm(
      `${item.guestName} talebini Villa ${item.villa} için gerçek rezervasyona dönüştürmek istiyor musunuz?\n\nTarihler ve güncel fiyat yeniden kontrol edilecek.`,
    );
    if (!accepted) return;

    setBusyId(item.id);
    setNotice("");
    try {
      const response = await fetch(`/api/booking-inquiries/${item.id}/convert`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Talep rezervasyona dönüştürülemedi.");
      setItems((current) => current.map((entry) => entry.id === item.id ? data.inquiry : entry));
      setNotice(data.alreadyConverted
        ? "Bu talep zaten rezervasyona dönüştürülmüş."
        : "Rezervasyon oluşturuldu. Talep otomatik olarak kapatıldı.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Talep rezervasyona dönüştürülemedi.");
    } finally {
      setBusyId(null);
    }
  }

  return <main className="inquiry-page">
    <section className="inquiry-shell">
      <div className="inquiry-hero">
        <div>
          <span className="eyebrow">DOĞRUDAN REZERVASYON</span>
          <h1>Web talepleri</h1>
          <p>safiradestan.com üzerinden gelen talepleri burada takip edin, WhatsApp ile yanıtlayın ve onaylanan talebi tek işlemle gerçek rezervasyona dönüştürün.</p>
        </div>
        <div className="inquiry-stats">
          <div><strong>{counts.new}</strong><span>Yeni</span></div>
          <div><strong>{counts.contacted}</strong><span>İletişimde</span></div>
          <div><strong>{counts.all}</strong><span>Toplam</span></div>
        </div>
      </div>

      <div className="inquiry-toolbar" aria-label="Talep filtresi">
        {(["Tümü", "Yeni", "İletişime geçildi", "Kapatıldı"] as const).map((value) =>
          <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>
        )}
      </div>

      {notice ? <div className="inquiry-notice">{notice}</div> : null}

      <div className="inquiry-list">
        {visible.length === 0 ? <div className="inquiry-empty">Bu filtrede rezervasyon talebi yok.</div> : visible.map((item) =>
          <article className="inquiry-card" key={item.id}>
            <div className="inquiry-card-head">
              <div>
                <span className={`inquiry-villa ${item.villa.toLowerCase()}`}>Villa {item.villa}</span>
                <h2>{item.guestName}</h2>
                <p>{formatStay(item.checkIn, item.checkOut)} · {item.guestCount} kişi · {item.quotedNights} gece</p>
              </div>
              <div className="inquiry-state-stack">
                <span className={`inquiry-status status-${item.status === "Yeni" ? "new" : item.status === "İletişime geçildi" ? "contacted" : "closed"}`}>{item.status}</span>
                {item.convertedReservationId ? <span className="inquiry-converted">✓ Rezervasyona dönüştürüldü</span> : null}
              </div>
            </div>

            <div className="inquiry-details">
              <div><span>Telefon / WhatsApp</span><strong>{item.phone}</strong></div>
              <div><span>Fiyat</span><strong>{item.quotedTotal === null ? "Teyit gerekli" : money.format(item.quotedTotal)}</strong></div>
              <div><span>Talep zamanı</span><strong>{formatCreated(item.createdAt)}</strong></div>
              <div><span>Kaynak</span><strong>{item.source}</strong></div>
            </div>

            {item.note ? <div className="inquiry-note"><span>Misafir notu</span><p>{item.note}</p></div> : null}

            <div className="inquiry-actions">
              <button className="inquiry-whatsapp" disabled={busyId === item.id} onClick={() => void openWhatsApp(item)}>WhatsApp&apos;ta aç</button>
              {item.convertedReservationId ? (
                <a className="inquiry-reservation-link" href="/rezervasyonlar">Rezervasyonları aç</a>
              ) : (
                <button className="inquiry-convert" disabled={busyId === item.id || item.status === "Kapatıldı"} onClick={() => void convertInquiry(item)}>
                  {busyId === item.id ? "İşleniyor…" : "Rezervasyona dönüştür"}
                </button>
              )}
              <button disabled={busyId === item.id || Boolean(item.convertedReservationId) || item.status === "Yeni"} onClick={() => void changeStatus(item.id, "Yeni")}>Yeni</button>
              <button disabled={busyId === item.id || Boolean(item.convertedReservationId) || item.status === "İletişime geçildi"} onClick={() => void changeStatus(item.id, "İletişime geçildi")}>İletişime geçildi</button>
              <button disabled={busyId === item.id || Boolean(item.convertedReservationId) || item.status === "Kapatıldı"} onClick={() => void changeStatus(item.id, "Kapatıldı")}>Kapat</button>
            </div>
          </article>
        )}
      </div>
    </section>
  </main>;
}
