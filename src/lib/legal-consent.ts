export const LEGAL_ACCEPTANCE_VERSION = "2026-09-04-v1";

export interface LegalConsentPayload {
  termsAccepted: boolean;
  privacyNoticeAcknowledged: boolean;
  legalVersion: string;
}

export function hasValidLegalConsent(value: unknown): value is LegalConsentPayload {
  if (!value || typeof value !== "object") return false;
  const consent = value as Partial<LegalConsentPayload>;
  return consent.termsAccepted === true
    && consent.privacyNoticeAcknowledged === true
    && consent.legalVersion === LEGAL_ACCEPTANCE_VERSION;
}
