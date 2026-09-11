import { describe, expect, it } from "vitest";
import { fridayVisualPath, fridayVisualVariant, FRIDAY_VISUAL_VARIANT_COUNT } from "./friday-visual";

describe("Friday visual rotation", () => {
  it("uses different same-day visuals for Safira and Destan", () => {
    expect(FRIDAY_VISUAL_VARIANT_COUNT).toBe(12);
    expect(fridayVisualVariant("2026-09-11", "Safira")).not.toBe(fridayVisualVariant("2026-09-11", "Destan"));
    expect(fridayVisualPath("2026-09-11", "Safira")).toMatch(/^\/social\/friday\/variant-\d{2}\.png\?date=2026-09-11&villa=safira$/);
  });
  it("rotates on the next Friday", () => {
    expect(fridayVisualVariant("2026-09-11", "Safira")).not.toBe(fridayVisualVariant("2026-09-18", "Safira"));
  });
});
