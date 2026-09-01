import type { Villa } from "@/lib/types";

export type OtaPlatform = "airbnb" | "booking";
export type ExternalBlockSource = OtaPlatform | "manual";
export type ExternalBlockStatus = "active" | "needs_review" | "removed";

export const OTA_VILLAS: Villa[] = ["Safira", "Destan"];
export const OTA_PLATFORMS: OtaPlatform[] = ["airbnb", "booking"];

export type OtaSyncHealth = "pending" | "green" | "yellow" | "red";

export interface OtaConnectionStatus {
  villa: Villa;
  platform: OtaPlatform;
  connected: boolean;
  lastSyncedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  activeBlockCount: number;
  conflictCount: number;
  health: OtaSyncHealth;
}

export interface AdminExternalBlock {
  villa: Villa;
  source: ExternalBlockSource;
  startDate: string;
  endDate: string;
  status: ExternalBlockStatus;
}
