import { describe, expect, it } from "vitest";
import {
  DESTAN_INSTAGRAM_HARD_BLOCK,
  META_ACTIVE_TARGETS,
  isMetaTargetHardBlocked,
} from "./social-account-policy";

describe("Meta aktif hedef politikası", () => {
  it("dört organik Meta hedefini aktif sayar", () => {
    expect(META_ACTIVE_TARGETS).toEqual([
      { villa: "Safira", platform: "Instagram" },
      { villa: "Safira", platform: "Facebook" },
      { villa: "Destan", platform: "Facebook" },
      { villa: "Destan", platform: "Instagram" },
    ]);
  });

  it("Destan Instagram OAuth doğrulaması sonrası HARD BLOCK değildir", () => {
    expect(DESTAN_INSTAGRAM_HARD_BLOCK.blocked).toBe(false);
    expect(isMetaTargetHardBlocked("Destan", "Instagram")).toBe(false);
    expect(isMetaTargetHardBlocked("Safira", "Instagram")).toBe(false);
    expect(isMetaTargetHardBlocked("Destan", "Facebook")).toBe(false);
  });
});
