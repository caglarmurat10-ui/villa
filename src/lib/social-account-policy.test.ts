import { describe, expect, it } from "vitest";
import {
  DESTAN_INSTAGRAM_HARD_BLOCK,
  META_ACTIVE_TARGETS,
  isMetaTargetHardBlocked,
  metaPublishGate,
} from "./social-account-policy";
import type { FacebookInstagramRelationshipClassification } from "./facebook-instagram-relationship";

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

function classification(
  code: FacebookInstagramRelationshipClassification["code"],
  healthy: boolean | null,
): FacebookInstagramRelationshipClassification {
  return { code, status: "missing", healthy, label: `test:${code}` };
}

describe("metaPublishGate — BLOCKED_EXTERNAL_META_SETUP (bölüm 8)", () => {
  it("Destan Instagram + FACEBOOK_IG_LINK_MISSING -> BLOCKED_EXTERNAL_META_SETUP (dış Meta sorunu)", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_MISSING", false));
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("BLOCKED_EXTERNAL_META_SETUP");
  });

  it("Destan Instagram + FACEBOOK_IG_LINK_MISMATCH -> BLOCKED_EXTERNAL_META_SETUP (dış Meta sorunu)", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_MISMATCH", false));
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("BLOCKED_EXTERNAL_META_SETUP");
  });

  it("Destan Instagram + FACEBOOK_IG_LINK_OK -> yayına izin verir", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_OK", true));
    expect(gate.blocked).toBe(false);
    expect(gate.code).toBe("FACEBOOK_IG_LINK_OK");
  });

  it("canlı ilişki kontrolü hiç okunamazsa (null) fail-closed bloklar - sağlıklı OLDUĞU asla varsayılmaz", () => {
    const gate = metaPublishGate("Destan", "Instagram", null);
    expect(gate.blocked).toBe(true);
  });

  it("Safira Instagram için aynı LINK_MISSING kodu BLOCKED_EXTERNAL_META_SETUP'a çevrilmez (yalnız Destan+Instagram'a özel)", () => {
    const gate = metaPublishGate("Safira", "Instagram", classification("FACEBOOK_IG_LINK_MISSING", false));
    expect(gate.code).toBe("FACEBOOK_IG_LINK_MISSING");
    expect(gate.blocked).toBe(true);
  });

  it("Destan Facebook için aynı LINK_MISSING kodu BLOCKED_EXTERNAL_META_SETUP'a çevrilmez (yalnız Instagram platformuna özel)", () => {
    const gate = metaPublishGate("Destan", "Facebook", classification("FACEBOOK_IG_LINK_MISSING", false));
    expect(gate.code).toBe("FACEBOOK_IG_LINK_MISSING");
  });

  it("Destan Instagram + FACEBOOK_IG_PERMISSION_MISSING (bizim tarafımızdaki bir sorun) BLOCKED_EXTERNAL_META_SETUP'a çevrilmez", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_PERMISSION_MISSING", null));
    expect(gate.code).toBe("FACEBOOK_IG_PERMISSION_MISSING");
    expect(gate.blocked).toBe(true);
  });
});
