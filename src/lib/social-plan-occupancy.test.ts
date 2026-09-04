import { describe, expect, it } from "vitest";
import { occupiesRollingFutureSlot } from "./social-plan-occupancy";

describe("rolling social plan future-slot occupancy", () => {
  it("quarantined legacy Planlandı + İnsan onayı kaydı future slot'u işgal etmez", () => {
    expect(occupiesRollingFutureSlot({ status: "Planlandı", approvalStatus: "İnsan onayı" })).toBe(false);
  });

  it("otomatik yayına uygun Planlandı + Onaylandı kaydı future slot'u işgal eder", () => {
    expect(occupiesRollingFutureSlot({ status: "Planlandı", approvalStatus: "Onaylandı" })).toBe(true);
  });

  it("Yayınlandı kayıt approval durumundan bağımsız olarak tamamlanmış slot sayılır", () => {
    expect(occupiesRollingFutureSlot({ status: "Yayınlandı", approvalStatus: "İnsan onayı" })).toBe(true);
  });

  it("başka durumlar rolling future slot'u işgal etmez", () => {
    expect(occupiesRollingFutureSlot({ status: "Başarısız", approvalStatus: "Onaylandı" })).toBe(false);
  });
});
