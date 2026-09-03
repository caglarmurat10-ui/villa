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
  anomalyCount: number; // son 30 gün icinde ANOMALOUS_BLOCK_DETECTED (bkz. anomaly.ts) sayisi
  healthScore: number; // 0-100, bkz. status.ts computeHealthScore - health (yesil/sari/kirmizi) ile ayni girdilerden turetilir
  health: OtaSyncHealth;
}

export interface AdminExternalBlock {
  villa: Villa;
  source: ExternalBlockSource;
  startDate: string;
  endDate: string;
  status: ExternalBlockStatus;
}
