import { describe, expect, it } from "vitest";
import {
  DESTAN_INSTAGRAM_HARD_BLOCK,
  META_ACTIVE_TARGETS,
  isMetaTargetHardBlocked,
} from "./social-account-policy";

describe("Meta aktif hedef politikası", () => {
  it("yalnız desteklenen üç organik hedefi aktif sayar", () => {
    expect(META_ACTIVE_TARGETS).toEqual([
      { villa: "Safira", platform: "Instagram" },
      { villa: "Safira", platform: "Facebook" },
      { villa: "Destan", platform: "Facebook" },
    ]);
  });

  it("Destan Instagram'i HARD BLOCK olarak tutar", () => {
    expect(DESTAN_INSTAGRAM_HARD_BLOCK.blocked).toBe(true);
    expect(isMetaTargetHardBlocked("Destan", "Instagram")).toBe(true);
    expect(isMetaTargetHardBlocked("Safira", "Instagram")).toBe(false);
    expect(isMetaTargetHardBlocked("Destan", "Facebook")).toBe(false);
  });
});
