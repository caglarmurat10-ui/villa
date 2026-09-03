import { describe, expect, it } from "vitest";
import { createAirbnbPartnerAdapter, createBookingConnectivityAdapter } from "./partner-adapter";

describe("OTA partner adapter taslakları (gerçek credential yok, sahte API çağrısı YAPILMAZ)", () => {
  it("Airbnb adapter readiness() WAITING_PARTNER_ACCESS doner", () => {
    const adapter = createAirbnbPartnerAdapter();
    expect(adapter.readiness()).toBe("WAITING_PARTNER_ACCESS");
  });

  it("Booking adapter readiness() WAITING_CONNECTIVITY_CERTIFICATION doner", () => {
    const adapter = createBookingConnectivityAdapter();
    expect(adapter.readiness()).toBe("WAITING_CONNECTIVITY_CERTIFICATION");
  });

  it("Airbnb adapter'in gercek metotlari cagrilirsa acik hata firlatir - sessizce basarili gibi DAVRANMAZ", async () => {
    const adapter = createAirbnbPartnerAdapter();
    await expect(adapter.listReservations("Safira")).rejects.toThrow(/partner API erişimi/);
    await expect(adapter.pushAvailability({ villa: "Safira", startDate: "2026-01-01", endDate: "2026-01-02", available: true })).rejects.toThrow();
  });

  it("Booking adapter'in gercek metotlari cagrilirsa acik hata firlatir", async () => {
    const adapter = createBookingConnectivityAdapter();
    await expect(adapter.listReservations("Destan")).rejects.toThrow();
    await expect(adapter.pushRatesAndAvailability({ villa: "Destan", startDate: "2026-01-01", endDate: "2026-01-02", available: false })).rejects.toThrow();
  });
});
