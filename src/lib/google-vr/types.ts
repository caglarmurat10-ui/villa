// Google Vacation Rentals - resmi entegrasyona uygun INTERNAL feed modeli. Google'a ozel bir
// XML/API cagrisi burada YAPILMAZ (connectivity credential'lari yok) - bu yalniz "hazir oldugunda
// neyi gonderecegiz" sorusuna net bir tip sozlesmesi. Tek kaynak: D1 price_ranges + reservations +
// dogrulanmis (yalniz status='active') OTA bloklari - needs_review veya fiyat tanimsiz hicbir
// tarih burada "bookable" olarak temsil edilmez.
import type { Villa } from "@/lib/types";

export type GoogleVrPropertyId = "SAFIRA" | "DESTAN";

export function villaToPropertyId(villa: Villa): GoogleVrPropertyId {
  return villa === "Safira" ? "SAFIRA" : "DESTAN";
}
export function propertyIdToVilla(propertyId: GoogleVrPropertyId): Villa {
  return propertyId === "SAFIRA" ? "Safira" : "Destan";
}

export interface GoogleVrNightlyBreakdown {
  date: string; // YYYY-MM-DD
  rateMinor: number;
}

// Tek bir gun icin Google'a gonderilecek durum - available=false oldugunda rate/total ALAKASIZ
// (hicbir zaman "AVAILABLE_WITH_PRICE" olarak fiyatli-ama-musait-degil bir sey gonderilmez).
export interface GoogleVrAvailabilityDay {
  date: string;
  available: boolean;
  rateMinor: number | null; // yalniz available=true VE fiyat tanimliysa dolu
}

export interface GoogleVrQuote {
  propertyId: GoogleVrPropertyId;
  checkIn: string;
  checkOut: string;
  occupancy: number;
  available: boolean;
  nightlyBreakdown: GoogleVrNightlyBreakdown[];
  totalMinor: number | null; // available=false veya fiyat eksikse null - asla tahmini deger degil
  currency: "TRY";
  lastUpdated: string; // ISO timestamp - feed'in hesaplandigi an
}
