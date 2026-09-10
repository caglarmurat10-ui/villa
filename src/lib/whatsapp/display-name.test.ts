import { describe, expect, it } from "vitest";
import {
  WHATSAPP_TARGET_DISPLAY_NAME,
  whatsappDisplayNameMatchesTarget,
} from "./display-name";

describe("WhatsApp sender display name policy", () => {
  it("uses the approved joint Safira/Destan brand target", () => {
    expect(WHATSAPP_TARGET_DISPLAY_NAME).toBe("Safira & Destan Villas");
  });

  it("matches harmless whitespace/case differences only", () => {
    expect(whatsappDisplayNameMatchesTarget(" Safira   & Destan Villas ")).toBe(true);
    expect(whatsappDisplayNameMatchesTarget("SAFIRA & DESTAN VILLAS")).toBe(true);
    expect(whatsappDisplayNameMatchesTarget("Villa Safira")).toBe(false);
    expect(whatsappDisplayNameMatchesTarget(null)).toBe(false);
  });
});
