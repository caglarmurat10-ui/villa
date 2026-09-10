import type { WhatsappCredentials } from "./config";

const GRAPH_API_VERSION = "v26.0";

export const WHATSAPP_TARGET_DISPLAY_NAME = "Safira & Destan Villas";

export type WhatsappDisplayNameSnapshot = {
  configured: true;
  targetDisplayName: string;
  verifiedName: string | null;
  nameStatus: string | null;
  matchesTarget: boolean;
};

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function whatsappDisplayNameMatchesTarget(value: string | null | undefined) {
  if (!value) return false;
  return normalizeDisplayName(value) === normalizeDisplayName(WHATSAPP_TARGET_DISPLAY_NAME);
}

export async function getWhatsappDisplayNameSnapshot(
  credentials: WhatsappCredentials,
): Promise<WhatsappDisplayNameSnapshot> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(credentials.phoneNumberId)}`);
  url.searchParams.set("fields", "verified_name,name_status");

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  const payload = await response.json().catch(() => ({})) as {
    verified_name?: string;
    name_status?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message ?? `Meta API HTTP ${response.status}`;
    throw new Error(message.replace(/[A-Za-z0-9._~-]{40,}/g, "[REDACTED]").slice(0, 300));
  }

  const verifiedName = typeof payload.verified_name === "string" ? payload.verified_name : null;
  const nameStatus = typeof payload.name_status === "string" ? payload.name_status : null;

  return {
    configured: true,
    targetDisplayName: WHATSAPP_TARGET_DISPLAY_NAME,
    verifiedName,
    nameStatus,
    matchesTarget: whatsappDisplayNameMatchesTarget(verifiedName),
  };
}
