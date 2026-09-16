import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { API_BASE } from "../api/client";
import { compareVersions } from "./versionCompare";

export type PlatformRelease = {
  version: string;
  build: number;
  url: string | null;
};

export type UpdateInfo = {
  currentVersion: string;
  currentBuild: number;
  latest: PlatformRelease;
  updateAvailable: boolean;
  canOpenUpdate: boolean;
};

export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
  try {
    const [appInfo, response] = await Promise.all([
      App.getInfo(),
      fetch(`${API_BASE}/version`, { method: "GET", cache: "no-store" }),
    ]);
    if (!response.ok) return null;
    const payload = await response.json() as { android: PlatformRelease; ios: PlatformRelease };
    const platform = Capacitor.getPlatform();
    const latest = platform === "ios" ? payload.ios : payload.android;
    const currentBuild = Number.parseInt(String(appInfo.build), 10) || 0;
    const versionNewer = compareVersions(latest.version, appInfo.version) > 0;
    const buildNewer = latest.build > currentBuild;
    return {
      currentVersion: appInfo.version,
      currentBuild,
      latest,
      updateAvailable: versionNewer || buildNewer,
      canOpenUpdate: Boolean(latest.url),
    };
  } catch {
    return null;
  }
}

export async function openAppUpdate(url: string) {
  await Browser.open({ url });
}


