import { describe, expect, it } from "vitest";
import { validateBookingPrefill } from "./booking-prefill";

describe("validateBookingPrefill (Google booking URL date prefill)", () => {
  it("gecerli ISO tarihleri ve misafir sayisini oldugu gibi kabul eder", () => {
    const result = validateBookingPrefill({ checkIn: "2026-06-12", checkOut: "2026-06-19", guestCount: "4" });
    expect(result).toEqual({ checkIn: "2026-06-12", checkOut: "2026-06-19", guestCount: "4" });
  });

  it("gecersiz tarih formatini sessizce reddeder (bos string doner)", () => {
    const result = validateBookingPrefill({ checkIn: "12 Haziran 2026", checkOut: "2026-06-19" });
    expect(result.checkIn).toBe("");
  });

  it("checkOut <= checkIn oldugunda checkOut'u reddeder", () => {
    const result = validateBookingPrefill({ checkIn: "2026-06-19", checkOut: "2026-06-12" });
    expect(result.checkIn).toBe("2026-06-19");
    expect(result.checkOut).toBe(""); // mantiksiz aralik - kabul edilmez
  });

  it("araligin disindaki (0, 13+) misafir sayisini varsayilan 2'ye dusurur", () => {
    expect(validateBookingPrefill({ guestCount: "0" }).guestCount).toBe("2");
    expect(validateBookingPrefill({ guestCount: "13" }).guestCount).toBe("2");
    expect(validateBookingPrefill({ guestCount: "abc" }).guestCount).toBe("2");
  });

  it("hicbir parametre verilmezse guvenli varsayilanlar doner", () => {
    expect(validateBookingPrefill({})).toEqual({ checkIn: "", checkOut: "", guestCount: "2" });
  });

  it("yalniz checkOut verilip checkIn verilmezse - checkOut yine de kabul edilir (checkIn bos oldugu icin karsilastirma atlanir)", () => {
    const result = validateBookingPrefill({ checkOut: "2026-06-19" });
    expect(result.checkIn).toBe("");
    expect(result.checkOut).toBe("2026-06-19");
  });
});
