import { describe, expect, it } from "vitest";
import { compareVersions } from "./versionCompare";

describe("compareVersions", () => {
  it("semantic sÃ¼rÃ¼mleri doÄŸru karÅŸÄ±laÅŸtÄ±rÄ±r", () => {
    expect(compareVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.0", "1.2.1")).toBeLessThan(0);
  });

  it("eksik parÃ§a ve build-benzeri sÃ¼rÃ¼mleri gÃ¼venli iÅŸler", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("2", "1.99.99")).toBeGreaterThan(0);
  });
});

