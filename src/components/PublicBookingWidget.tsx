"use client";

import { useMemo, useState } from "react";
import type { PriceRange, Reservation, Villa } from "@/lib/types";

type BookingReservation = Pick<Reservation, "villa" | "checkIn" | "checkOut">;
type BookingPrice = Pick<PriceRange, "villa" | "startDate" | "endDate" | "nightlyRate">;

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

  const result = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    if (checkOut <= checkIn) return { kind: "error" as const, text: "Çıkış tarihi girişten sonra olmalı." };

    const occupied = reservations.some(
      (item) => item.villa === villa && item.checkIn < checkOut && item.checkOut > checkIn,
    );
    if (occupied) return { kind: "busy" as const, text: "Seçtiğiniz tarihlerde bu villa dolu." };

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

    if (missingPrice) return { kind: "available" as const, text: `Müsait görünüyor · ${nights} gece · Fiyat için bize ulaşın.` };
    return {
      kind: "available" as const,
      text: `Müsait · ${nights} gece · ${new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(total)}`,
    };
  }, [checkIn, checkOut, prices, reservations, villa]);

  return (
    <div className="publicBookingWidget">
      <div className="publicBookingTitle">Tarihinizi kontrol edin</div>
      <div className="publicBookingFields">
        <label>
          <span>Villa</span>
          <select value={villa} onChange={(event) => setVilla(event.target.value as Villa)} disabled={Boolean(initialVilla)}>
            <option value="Safira">Villa Safira</option>
            <option value="Destan">Villa Destan</option>
          </select>
        </label>
        <label>
          <span>Giriş</span>
          <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
        </label>
        <label>
          <span>Çıkış</span>
          <input type="date" min={checkIn || undefined} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
        </label>
      </div>
      <div className={`publicBookingResult ${result?.kind ?? "idle"}`} aria-live="polite">
        {result?.text ?? "Villa, giriş ve çıkış tarihini seçin; sistem mevcut rezervasyon takvimini anında kontrol etsin."}
      </div>
    </div>
  );
}
