"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PriceRange, Reservation, Villa } from "@/lib/types";
import styles from "./PublicBookingWidget.module.css";

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
  const today = new Date().toISOString().slice(0, 10);

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
          <select value={villa} onChange={(event) => setVilla(event.target.value as Villa)} disabled={Boolean(initialVilla)}>
            <option value="Safira">Villa Safira</option>
            <option value="Destan">Villa Destan</option>
          </select>
        </label>
        <label>
          <span>Giriş</span>
          <input type="date" min={today} value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
        </label>
        <label>
          <span>Çıkış</span>
          <input type="date" min={checkIn || today} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
        </label>
      </div>

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

      <div className={styles.trust}>
        <span>✓ Canlı müsaitlik</span>
        <span>✓ Dönemsel fiyat</span>
        <span>✓ Doğrudan rezervasyon</span>
      </div>
    </div>
  );
}
