import { describe, expect, it } from "vitest";
import { LEGAL_ACCEPTANCE_VERSION, hasValidLegalConsent } from "@/lib/legal-consent";

describe("legal consent", () => {
  it("accepts only the current version with both explicit confirmations", () => {
    expect(hasValidLegalConsent({
      termsAccepted: true,
      privacyNoticeAcknowledged: true,
      legalVersion: LEGAL_ACCEPTANCE_VERSION,
    })).toBe(true);
  });

  it("rejects missing, false, or stale consent", () => {
    expect(hasValidLegalConsent(null)).toBe(false);
    expect(hasValidLegalConsent({ termsAccepted: false, privacyNoticeAcknowledged: true, legalVersion: LEGAL_ACCEPTANCE_VERSION })).toBe(false);
    expect(hasValidLegalConsent({ termsAccepted: true, privacyNoticeAcknowledged: false, legalVersion: LEGAL_ACCEPTANCE_VERSION })).toBe(false);
    expect(hasValidLegalConsent({ termsAccepted: true, privacyNoticeAcknowledged: true, legalVersion: "old-version" })).toBe(false);
  });
});
