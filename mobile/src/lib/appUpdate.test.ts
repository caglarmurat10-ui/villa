import { describe, expect, it } from "vitest";
import { compareVersions } from "./appUpdate";

describe("compareVersions", () => {
  it("semantic sürümleri doğru karşılaştırır", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.0", "1.2.1")).toBeLessThan(0);
  });

  it("eksik parça ve build-benzeri sürümleri güvenli işler", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("2", "1.99.99")).toBeGreaterThan(0);
  });
});
