"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { PriceRange, Reservation, Villa } from "@/lib/types";
import { toVillaId, trackCheckAvailability, trackGenerateLead } from "@/lib/analytics";
import { computePriceQuote, splitEvenInstallments, type PriceSegment } from "@/lib/price-engine";
import { validateBookingPrefill } from "@/lib/booking-prefill";
import { CLOSED_SEASON_MESSAGE, hasClosedSeasonNight } from "@/lib/season-policy";
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
type BookingPrice = Pick<PriceRange, "villa" | "startDate" | "endDate" | "nightlyRate" | "basePriceMinor" | "baseNights" | "minimumNights">;

type AvailabilityResult = {
  kind: "available" | "busy" | "error" | "price_gap" | "min_stay" | "closed_season";
  title: string;
  detail: string;
  total?: number;
  nights?: number;
  averageRate?: number;
  segments?: PriceSegment[];
  alternative?: Villa;
  minimumNights?: number;
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

// Haftalık esas fiyattan türetilen referans gecelik oran (ör. 130000/7 = 18571.428571...) tam
// kuruşa kadar gösterilmeli - money (0 ondalık) burada YETERSİZ, "₺18.571,43" gibi net gösterim şart.
const moneyPrecise = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Tam TL tutarları eskisi gibi 0 ondalıkla ("₺130.000"), küsuratlı tutarlar (haftalık esas fiyatın
// 7'ye tam bölünmediği kısmi konaklamalar gibi) 2 ondalıkla ("₺74.285,71") gösterilir - müşteriye
// gösterilen tutar HİÇBİR ZAMAN gerçek ödenecek tutardan sessizce yuvarlanmaz.
function formatMoney(amount: number): string {
  return Math.round(amount * 100) % 100 === 0 ? money.format(amount) : moneyPrecise.format(amount);
}

function isOccupied(reservations: BookingReservation[], villa: Villa, checkIn: string, checkOut: string) {
  return reservations.some(
    (item) => item.villa === villa && item.checkIn < checkOut && item.checkOut > checkIn,
  );
}

// Fiyattan bağımsız, saf takvim gece sayısı - sonuç kartındaki VILLA/TARİH/GECE recap satırı
// için (fiyat "gap"/hata olsa bile giriş-çıkış arasındaki gece sayısı gösterilebilir olmalı).
function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}


export default function PublicBookingWidget({
  reservations,
  prices,
  initialVilla,
  initialCheckIn,
  initialCheckOut,
  initialGuestCount,
  installmentVerified = false,
}: {
  reservations: BookingReservation[];
  prices: BookingPrice[];
  initialVilla?: Villa;
  // Google Vacation Rentals/GBP booking link gibi dış kaynaklardan gelen tarih/kişi sayısı
  // query param'ları - doğrulanmadan güvenilmez (gerçek olmayan bir tarih formatı sessizce
  // yok sayılır, forma hiç yansımaz).
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuestCount?: string;
  // getInstallmentCampaignReadiness() sonucundan gelir - false iken taksit satırı hiç render
  // edilmez (bkz. src/lib/payments/installment-campaign.ts, merchant doğrulaması tamamlanmadan
  // public'e asla çıkmaz).
  installmentVerified?: boolean;
}) {
  const prefill = validateBookingPrefill({ checkIn: initialCheckIn, checkOut: initialCheckOut, guestCount: initialGuestCount });

  const [villa, setVilla] = useState<Villa>(initialVilla ?? "Safira");
  const [checkIn, setCheckIn] = useState(prefill.checkIn);
  const [checkOut, setCheckOut] = useState(prefill.checkOut);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(prefill.guestCount);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [requestState, setRequestState] = useState<RequestState>({ kind: "idle", message: "" });
  const [source] = useState(() => resolveSource());

  const result = useMemo<AvailabilityResult | null>(() => {
    if (!checkIn || !checkOut) return null;
    if (checkOut <= checkIn) {
      return { kind: "error", title: "Tarihleri kontrol edin", detail: "Çıkış tarihi girişten sonra olmalı." };
    }

    if (hasClosedSeasonNight(checkIn, checkOut)) {
      return {
        kind: "closed_season",
        title: "Sezon kapalı",
        detail: CLOSED_SEASON_MESSAGE,
      };
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

    const villaRanges = prices.filter((item) => item.villa === villa);
    const quote = computePriceQuote(villaRanges, checkIn, checkOut);

    if (quote.status === "gap") {
      return {
        kind: "price_gap",
        title: `Villa ${villa} müsait`,
        detail: "Bu tarih aralığının fiyatı henüz tanımlanmadı. Lütfen bizimle iletişime geçin.",
      };
    }
    if (quote.status === "invalid_range") {
      return { kind: "error", title: "Tarihleri kontrol edin", detail: "Çıkış tarihi girişten sonra olmalı." };
    }
    if (quote.status === "min_stay") {
      return {
        kind: "min_stay",
        title: "Minimum konaklama süresi",
        detail: `Bu dönem için minimum konaklama süresi ${quote.minimumNights} gecedir.`,
        minimumNights: quote.minimumNights,
      };
    }

    return {
      kind: "available",
      title: `Villa ${villa} müsait`,
      detail: `${quote.nights} gece · Toplam konaklama bedeli`,
      total: quote.total,
      nights: quote.nights,
      averageRate: quote.averageRate,
      segments: quote.segments,
    };
  }, [checkIn, checkOut, prices, reservations, villa]);

  const alternativeHref = result?.alternative === "Safira" ? "/villa-safira" : "/villa-destan";
  const resultClass = result?.kind === "available" ? styles.available : result?.kind === "busy" || result?.kind === "closed_season" ? styles.busy : result?.kind === "error" ? styles.error : result?.kind === "price_gap" || result?.kind === "min_stay" ? styles.priceGap : "";
  const resultIcon = result?.kind === "available" ? "✓" : result?.kind === "price_gap" || result?.kind === "min_stay" ? "!" : result ? "✕" : "";
  const canSubmitInquiry = result?.kind === "available" || result?.kind === "price_gap";

  function resetRequestFeedback() {
    if (requestState.kind !== "idle") setRequestState({ kind: "idle", message: "" });
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitInquiry) return;
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
      trackGenerateLead({ villa_id: toVillaId(villa), villa_name: `Villa ${villa}` }, "booking_widget_form");
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
          if (nextCheckIn && nextCheckOut) {
            trackCheckAvailability({ villa_id: toVillaId(villa), villa_name: `Villa ${villa}` });
          }
        }}
      />

      <div className={`${styles.result} ${resultClass}`} aria-live="polite">
        {result ? (
          <>
            <div className={styles.resultRecap}>
              Villa {villa} · {formatDateLabel(checkIn)} – {formatDateLabel(checkOut)} · {nightsBetween(checkIn, checkOut)} gece
            </div>
            <div className={styles.resultTop}>
              <strong><span className={styles.resultIcon} aria-hidden="true">{resultIcon}</span>{result.title}</strong>
              {typeof result.total === "number" && <b>{formatMoney(result.total)}</b>}
            </div>
            <p>{result.detail}</p>
            {result.kind === "available" && installmentVerified && typeof result.total === "number" && (
              <div className={styles.installment}>
                <strong>Peşin fiyatına 3 veya 6 taksit</strong>
                <span>3 taksit: 3 × yaklaşık {formatMoney(splitEvenInstallments(result.total, 3)[0])}</span>
                <span>6 taksit: 6 × yaklaşık {formatMoney(splitEvenInstallments(result.total, 6)[0])}</span>
                <small>Toplam rezervasyon tutarı değişmez. Kesin taksit tutarları kartınıza göre ödeme ekranında gösterilir.</small>
              </div>
            )}
            {result.segments && result.segments.length > 1 ? (
              <div className={styles.breakdown}>
                <table>
                  <tbody>
                    {result.segments.map((segment) => (
                      <tr key={segment.startDate}>
                        <td>{formatDateLabel(segment.startDate)} – {formatDateLabel(segment.endDate)} · {segment.nights} gece × {formatMoney(segment.nightlyRate)}</td>
                        <td>{formatMoney(segment.subtotal)}</td>
                      </tr>
                    ))}
                    <tr className={styles.breakdownTotal}>
                      <td>TOPLAM · Ortalama gecelik {formatMoney(result.averageRate ?? 0)}</td>
                      <td>{formatMoney(result.total ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
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

      {canSubmitInquiry && (
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
        <span>✓ Ödeme sırasında işletme komisyonu eklenmez</span>
        <span>✓ Doğrudan rezervasyon</span>
      </div>
    </div>
  );
}
