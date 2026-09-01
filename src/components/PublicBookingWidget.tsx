"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { PriceRange, Reservation, Villa } from "@/lib/types";
import VillaAvailabilityCalendar from "./VillaAvailabilityCalendar";
import styles from "./PublicBookingWidget.module.css";

const dateLabel = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
function formatDateLabel(iso: string) {
  if (!iso) return "Seçilmedi";
  return dateLabel.format(new Date(`${iso}T00:00:00Z`));
}

const KNOWN_SOURCES = new Set(["instagram", "facebook", "google", "whatsapp", "direct"]);

function resolveSource(): string {
  if (typeof window === "undefined") return "web";
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source")?.toLowerCase().trim();
    if (utmSource && KNOWN_SOURCES.has(utmSource)) return utmSource;
    if (utmSource) return utmSource.slice(0, 40);

    const referrer = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : "";
    if (referrer.includes("instagram.com")) return "instagram";
    if (referrer.includes("facebook.com") || referrer.includes("fb.com")) return "facebook";
    if (referrer.includes("google.")) return "google";
    if (referrer.includes("whatsapp.com")) return "whatsapp";
    return "direct";
  } catch {
    return "web";
  }
}

type BookingReservation = Pick<Reservation, "villa" | "checkIn" | "checkOut">;
type BookingPrice = Pick<PriceRange, "villa" | "startDate" | "endDate" | "nightlyRate">;

type AvailabilityResult = {
  kind: "available" | "busy" | "error";
  title: string;
  detail: string;
  total?: number;
  nights?: number;
  alternative?: Villa;
};

type RequestState = {
  kind: "idle" | "sending" | "success" | "error";
  message: string;
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function isOccupied(reservations: BookingReservation[], villa: Villa, checkIn: string, checkOut: string) {
  return reservations.some(
    (item) => item.villa === villa && item.checkIn < checkOut && item.checkOut > checkIn,
  );
}

export default function PublicBookingWidget({
  reservations,
  prices,
  initialVilla,
}: {
  reservations: BookingReservation[];
  prices: BookingPrice[];
  initialVilla?: Villa;
}) {
  const [villa, setVilla] = useState<Villa>(initialVilla ?? "Safira");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [requestState, setRequestState] = useState<RequestState>({ kind: "idle", message: "" });
  const [source] = useState(() => resolveSource());

  const result = useMemo<AvailabilityResult | null>(() => {
    if (!checkIn || !checkOut) return null;
    if (checkOut <= checkIn) {
      return { kind: "error", title: "Tarihleri kontrol edin", detail: "Çıkış tarihi girişten sonra olmalı." };
    }

    if (isOccupied(reservations, villa, checkIn, checkOut)) {
      const alternative: Villa = villa === "Safira" ? "Destan" : "Safira";
      const alternativeAvailable = !isOccupied(reservations, alternative, checkIn, checkOut);
      return {
        kind: "busy",
        title: `Villa ${villa} bu tarihlerde dolu`,
        detail: alternativeAvailable
          ? `Aynı tarihler için Villa ${alternative} müsait görünüyor.`
          : "Aynı tarihlerde diğer villamız da dolu görünüyor.",
        alternative: alternativeAvailable ? alternative : undefined,
      };
    }

    let total = 0;
    let nights = 0;
    let missingPrice = false;
    const end = new Date(`${checkOut}T00:00:00Z`);
    for (let cursor = new Date(`${checkIn}T00:00:00Z`); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const range = prices.find((item) => item.villa === villa && item.startDate <= date && item.endDate >= date);
      if (!range) missingPrice = true;
      else total += range.nightlyRate;
      nights += 1;
    }

    if (missingPrice) {
      return {
        kind: "available",
        title: `Villa ${villa} müsait`,
        detail: `${nights} gece için müsaitlik doğrulandı. Bu dönem için fiyat bilgisi yönetim ekibinden teyit edilecek.`,
        nights,
      };
    }

    return {
      kind: "available",
      title: `Villa ${villa} müsait`,
      detail: `${nights} gece · Toplam konaklama bedeli`,
      total,
      nights,
    };
  }, [checkIn, checkOut, prices, reservations, villa]);

  const alternativeHref = result?.alternative === "Safira" ? "/villa-safira" : "/villa-destan";
  const resultClass = result?.kind === "available" ? styles.available : result?.kind === "busy" ? styles.busy : result?.kind === "error" ? styles.error : "";

  function resetRequestFeedback() {
    if (requestState.kind !== "idle") setRequestState({ kind: "idle", message: "" });
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (result?.kind !== "available") return;
    setRequestState({ kind: "sending", message: "Talebiniz kaydediliyor…" });

    try {
      const response = await fetch("/api/public/booking-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          villa,
          guestName,
          phone,
          checkIn,
          checkOut,
          guestCount: Number(guestCount),
          note,
          website,
          source,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Rezervasyon talebi kaydedilemedi.");
      setRequestState({
        kind: "success",
        message: data.message ?? "Rezervasyon talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.",
      });
    } catch (error) {
      setRequestState({
        kind: "error",
        message: error instanceof Error ? error.message : "Rezervasyon talebi kaydedilemedi.",
      });
    }
  }

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>DOĞRUDAN · CANLI VERİ</span>
          <div className={styles.title}>Tarihinizi kontrol edin</div>
        </div>
        <span className={styles.live}><i /> Yönetim takvimiyle senkron</span>
      </div>

      <div className={styles.fields}>
        <label>
          <span>Villa</span>
          <select value={villa} onChange={(event) => { setVilla(event.target.value as Villa); setCheckIn(""); setCheckOut(""); resetRequestFeedback(); }} disabled={Boolean(initialVilla)}>
            <option value="Safira">Villa Safira</option>
            <option value="Destan">Villa Destan</option>
          </select>
        </label>
        <div className={styles.datePreview}>
          <div><span>Giriş</span><strong>{formatDateLabel(checkIn)}</strong></div>
          <div><span>Çıkış</span><strong>{formatDateLabel(checkOut)}</strong></div>
        </div>
      </div>

      <VillaAvailabilityCalendar
        villa={villa}
        reservations={reservations}
        checkIn={checkIn}
        checkOut={checkOut}
        onChange={({ checkIn: nextCheckIn, checkOut: nextCheckOut }) => {
          setCheckIn(nextCheckIn);
          setCheckOut(nextCheckOut);
          resetRequestFeedback();
        }}
      />

      <div className={`${styles.result} ${resultClass}`} aria-live="polite">
        {result ? (
          <>
            <div className={styles.resultTop}>
              <strong>{result.title}</strong>
              {typeof result.total === "number" && <b>{money.format(result.total)}</b>}
            </div>
            <p>{result.detail}</p>
            {result.alternative && (
              <Link className={styles.alternative} href={alternativeHref}>
                Villa {result.alternative}&apos;ı aynı tarihler için incele →
              </Link>
            )}
          </>
        ) : (
          <p>Villa, giriş ve çıkış tarihini seçin. Sistem rezervasyon ve fiyat kayıtlarını anında karşılaştırsın.</p>
        )}
      </div>

      {result?.kind === "available" && (
        <form className={styles.requestForm} onSubmit={submitInquiry}>
          <div className={styles.requestHeading}>
            <div>
              <span className={styles.eyebrow}>REZERVASYON TALEBİ</span>
              <strong>Bu tarihleri ayırtmak için bize ulaşın</strong>
            </div>
            <span>Ödeme alınmaz · Talep yönetim ekranına düşer</span>
          </div>

          <div className={styles.requestGrid}>
            <label>
              <span>Ad soyad</span>
              <input value={guestName} onChange={(event) => setGuestName(event.target.value)} autoComplete="name" minLength={2} maxLength={100} required />
            </label>
            <label>
              <span>Telefon / WhatsApp</span>
              <input type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" value={phone} onChange={(event) => setPhone(event.target.value)} minLength={7} maxLength={30} required />
            </label>
            <label>
              <span>Kişi sayısı</span>
              <select value={guestCount} onChange={(event) => setGuestCount(event.target.value)}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count} kişi</option>)}
              </select>
            </label>
          </div>

          <label className={styles.requestNote}>
            <span>Not <em>isteğe bağlı</em></span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Özel bir talebiniz varsa yazabilirsiniz." />
          </label>

          <label className={styles.honeypot} aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </label>

          <div className={styles.submitRow}>
            <button type="submit" disabled={requestState.kind === "sending" || requestState.kind === "success"}>
              {requestState.kind === "sending" ? "Gönderiliyor…" : requestState.kind === "success" ? "Talep alındı ✓" : "Rezervasyon talebi gönder"}
            </button>
            <small>Bilgileriniz yalnız rezervasyon talebiniz için kullanılır. Bu bir ön talep kaydıdır, ödeme alınmaz.</small>
          </div>

          <p className={styles.policyLinkRow}>
            <Link href="/rezervasyon-kosullari" target="_blank" rel="noopener noreferrer">Rezervasyon ve konaklama koşullarını inceleyin ↗</Link>
          </p>

          {requestState.kind !== "idle" && (
            <div className={`${styles.requestStatus} ${requestState.kind === "success" ? styles.requestSuccess : requestState.kind === "error" ? styles.requestError : ""}`} aria-live="polite">
              {requestState.message}
            </div>
          )}
        </form>
      )}

      <div className={styles.trust}>
        <span>✓ Canlı müsaitlik</span>
        <span>✓ Dönemsel fiyat</span>
        <span>✓ Doğrudan rezervasyon</span>
      </div>
    </div>
  );
}
