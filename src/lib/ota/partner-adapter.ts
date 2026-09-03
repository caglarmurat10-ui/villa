// Airbnb Partner API / Booking.com Connectivity API icin NIYET/arayuz sozlesmesi - hicbir metodun
// GERCEK bir implementasyonu YOK. Bu dosya, gercek partner credential'lari (Airbnb: Partner API
// erisim onayi; Booking: Connectivity API sertifikasyonu) geldiginde "nereye eklenecegi" belli olsun
// diye hazirlanmis TEMIZ bir arayuz - hicbir yerden cagirilmiyor, hicbir sahte/mock veri
// UYDURMUYOR. Cagirilirsa (yanlislikla) acik bir hata firlatir, asla sessizce basarili gibi
// davranmaz. Mevcut, calisan iCal (sync.ts) akisina HICBIR sekilde dokunmaz/yerini almaz.

import type { Villa } from "@/lib/types";

export type OtaPartnerReadiness = "ICAL_READY" | "WAITING_PARTNER_ACCESS" | "WAITING_CONNECTIVITY_CERTIFICATION";

export interface PartnerReservation {
  externalId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  status: "confirmed" | "cancelled";
}

export interface PartnerAvailabilityUpdate {
  villa: Villa;
  startDate: string;
  endDate: string;
  available: boolean;
}

// Airbnb Partner API (resmi ortaklik onayi gerektirir - bkz. Airbnb "Connectivity Partner" programı).
// Faz 1 (mevcut, çalışan): yalnız iCal import/export - src/lib/ota/sync.ts, ics-parser.ts, ics-writer.ts.
// Faz 2 (bu arayüz): gerçek onay geldiğinde reservations.list/availability.update gibi doğrudan API
// çağrıları eklenebilir - iCal'in ~saatlik gecikmesi yerine gerçek zamanlı senkron.
export interface AirbnbPartnerAdapter {
  readiness(): OtaPartnerReadiness;
  listReservations(villa: Villa): Promise<PartnerReservation[]>;
  pushAvailability(update: PartnerAvailabilityUpdate): Promise<void>;
}

// Booking.com Connectivity API (resmi sertifikasyon süreci gerektirir - bkz. Booking.com Connectivity
// Partner sertifikasyon programı). Aynı Faz 1/Faz 2 ayrımı Airbnb ile birebir aynı mantıkla geçerli.
export interface BookingConnectivityAdapter {
  readiness(): OtaPartnerReadiness;
  listReservations(villa: Villa): Promise<PartnerReservation[]>;
  pushRatesAndAvailability(update: PartnerAvailabilityUpdate): Promise<void>;
}

function notImplemented(name: string): never {
  throw new Error(`${name}: partner API erişimi/sertifikasyonu henüz yok - bu bir taslak arayüz, gerçek implementasyon içermez.`);
}

// Gerçek credential'lar gelene kadar HER İKİ adapter de bu placeholder'ı döner - "readiness()" dışında
// hiçbir metot çağrılabilir durumda değildir (çağrılırsa yukarıdaki açık hatayı fırlatır).
export function createAirbnbPartnerAdapter(): AirbnbPartnerAdapter {
  return {
    readiness: () => "WAITING_PARTNER_ACCESS",
    listReservations: async () => notImplemented("AirbnbPartnerAdapter.listReservations"),
    pushAvailability: async () => notImplemented("AirbnbPartnerAdapter.pushAvailability"),
  };
}

export function createBookingConnectivityAdapter(): BookingConnectivityAdapter {
  return {
    readiness: () => "WAITING_CONNECTIVITY_CERTIFICATION",
    listReservations: async () => notImplemented("BookingConnectivityAdapter.listReservations"),
    pushRatesAndAvailability: async () => notImplemented("BookingConnectivityAdapter.pushRatesAndAvailability"),
  };
}
