import { describe, expect, it } from "vitest";
import {
  DESTAN_ADS_STATE,
  DESTAN_INSTAGRAM_HARD_BLOCK,
  META_ACTIVE_TARGETS,
  META_PROFILE_ACCESS,
  isMetaTargetHardBlocked,
  metaPublishGate,
} from "./social-account-policy";
import type { FacebookInstagramRelationshipClassification } from "./facebook-instagram-relationship";

describe("DESTAN_ADS / META_PROFILE_ACCESS - reklam yeterliliği organik yayından ayrı izlenir", () => {
  it("reklam kısıtı organik yayın politikasından bağımsızdır", () => {
    expect(DESTAN_ADS_STATE.state).toBe("BLOCKED_EXTERNAL_META_RESTRICTION");
    expect(DESTAN_ADS_STATE.reason.length).toBeGreaterThan(0);
    expect(META_PROFILE_ACCESS.note.length).toBeGreaterThan(0);
  });

  it("reklam ödeme/kısıt durumu bağımsız organik hedefleri bloklamaz", () => {
    const mismatch = classification("FACEBOOK_IG_LINK_MISMATCH", false);
    expect(metaPublishGate("Safira", "Instagram", mismatch).blocked).toBe(false);
    expect(metaPublishGate("Safira", "Facebook", mismatch).blocked).toBe(false);
    expect(metaPublishGate("Destan", "Facebook", mismatch).blocked).toBe(false);
  });
});

describe("Meta aktif hedef politikası", () => {
  it("dört organik Meta hedefini ayrı yayın hedefleri olarak izler", () => {
    expect(META_ACTIVE_TARGETS).toEqual([
      { villa: "Safira", platform: "Instagram" },
      { villa: "Safira", platform: "Facebook" },
      { villa: "Destan", platform: "Facebook" },
      { villa: "Destan", platform: "Instagram" },
    ]);
  });

  it("Destan Instagram doğrudan Instagram Login API nedeniyle artık hard-block değildir", () => {
    expect(DESTAN_INSTAGRAM_HARD_BLOCK.blocked).toBe(false);
    expect(isMetaTargetHardBlocked("Destan", "Instagram")).toBe(false);
    expect(isMetaTargetHardBlocked("Safira", "Instagram")).toBe(false);
    expect(isMetaTargetHardBlocked("Safira", "Facebook")).toBe(false);
    expect(isMetaTargetHardBlocked("Destan", "Facebook")).toBe(false);
  });
});

function classification(
  code: FacebookInstagramRelationshipClassification["code"],
  healthy: boolean | null,
): FacebookInstagramRelationshipClassification {
  return { code, status: "missing", healthy, label: `test:${code}` };
}

describe("metaPublishGate — Facebook ↔ Instagram ilişkisi bağımsız yayının gate'i değildir", () => {
  it("Destan Instagram + FACEBOOK_IG_LINK_MISSING bağımsız Instagram yayınını bloklamaz", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_MISSING", false));
    expect(gate.blocked).toBe(false);
    expect(gate.code).toBe("FACEBOOK_IG_LINK_MISSING");
  });

  it("Destan Instagram + FACEBOOK_IG_LINK_MISMATCH bağımsız Instagram yayınını bloklamaz", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_MISMATCH", false));
    expect(gate.blocked).toBe(false);
    expect(gate.code).toBe("FACEBOOK_IG_LINK_MISMATCH");
  });

  it("ilişki API sonucu okunamazsa bile bağımsız Instagram yayını bu teşhisten dolayı bloklanmaz", () => {
    const gate = metaPublishGate("Destan", "Instagram", null);
    expect(gate.blocked).toBe(false);
    expect(gate.code).toBe("FACEBOOK_IG_API_ERROR");
  });

  it("Safira Instagram da ilişki mismatch'inden dolayı bloklanmaz", () => {
    const gate = metaPublishGate("Safira", "Instagram", classification("FACEBOOK_IG_LINK_MISMATCH", false));
    expect(gate.blocked).toBe(false);
  });

  it("Facebook yayınları da Instagram ilişkisinden bağımsızdır", () => {
    const gate = metaPublishGate("Destan", "Facebook", classification("FACEBOOK_IG_LINK_MISSING", false));
    expect(gate.blocked).toBe(false);
  });

  it("açık hardBlockedOverride:true verilirse Destan Instagram fail-closed bloklanabilir", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_OK", true), true);
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("BLOCKED_EXTERNAL_META_OWNERSHIP");
  });

  it("hardBlockedOverride:false + sağlıklı ilişki normal açık kalır", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_OK", true), false);
    expect(gate.blocked).toBe(false);
    expect(gate.code).toBe("FACEBOOK_IG_LINK_OK");
  });
});
