import content01 from "@/data/social-content-01.json";
import content02 from "@/data/social-content-02.json";
import content03 from "@/data/social-content-03.json";
import content04 from "@/data/social-content-04.json";
import content05 from "@/data/social-content-05.json";
import content06 from "@/data/social-content-06.json";
import { resolveDriveMedia, socialDriveMedia, type DriveMediaAsset, type DriveMediaKind } from "./social-drive-media";
import type { SocialContentType, Villa } from "./types";

export type SocialContentTemplate = {
  id: string;
  scheduledDate: string;
  villa: Villa;
  format: "Story" | "Reels" | "Carousel" | "Feed";
  contentType: SocialContentType;
  theme: string;
  mediaFile: string;
  hook: string;
  caption: string;
  mediaResolved: boolean;
  mediaKind: DriveMediaKind | "";
  driveFileId: string;
  driveViewUrl: string;
  previewUrl: string;
  mediaUrl: string;
  mediaUrls: string[];
};

type RawTemplate = Omit<
  SocialContentTemplate,
  "villa" | "format" | "contentType" | "mediaResolved" | "mediaKind" | "driveFileId" | "driveViewUrl" | "previewUrl" | "mediaUrl" | "mediaUrls"
> & {
  villa: string;
  format: string;
};

function contentType(format: string): SocialContentType {
  if (format === "Story") return "Hikâye";
  if (format === "Reels") return "Reels";
  return "Gönderi";
}

function stableNumber(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) total = (total * 31 + value.charCodeAt(index)) >>> 0;
  return total;
}

function carouselAssets(villa: Villa, primary: DriveMediaAsset | null, seed: string) {
  const pool = socialDriveMedia.filter((asset) => asset.villa === villa && asset.mediaKind === "image");
  if (pool.length === 0) return [];
  const result: DriveMediaAsset[] = [];
  if (primary?.mediaKind === "image") result.push(primary);
  const start = stableNumber(seed) % pool.length;
  for (let offset = 0; offset < pool.length && result.length < 4; offset += 1) {
    const asset = pool[(start + offset) % pool.length];
    if (!result.some((item) => item.fileId === asset.fileId)) result.push(asset);
  }
  return result;
}

const raw = [
  ...content01,
  ...content02,
  ...content03,
  ...content04,
  ...content05,
  ...content06,
] as RawTemplate[];

export const socialContentTemplates: SocialContentTemplate[] = raw.map((item) => {
  const villa: Villa = item.villa === "Destan" ? "Destan" : "Safira";
  const format = (item.format === "Story" || item.format === "Reels" || item.format === "Carousel") ? item.format : "Feed";
  const requestedFile = format === "Reels" ? (villa === "Safira" ? "safira.mp4" : "destan.mp4") : item.mediaFile;
  const primary = resolveDriveMedia(villa, requestedFile);
  const selected = format === "Carousel" ? carouselAssets(villa, primary, item.id) : (primary ? [primary] : []);
  const first = selected[0] ?? null;
  const resolved = format === "Carousel" ? selected.length >= 2 : Boolean(first);

  return {
    ...item,
    villa,
    format,
    contentType: contentType(format),
    mediaFile: first?.fileName ?? requestedFile,
    mediaResolved: resolved,
    mediaKind: first?.mediaKind ?? "",
    driveFileId: first?.fileId ?? "",
    driveViewUrl: first?.viewUrl ?? "",
    previewUrl: first?.previewUrl ?? "",
    mediaUrl: first?.proxyPath ?? "",
    mediaUrls: selected.map((asset) => asset.proxyPath),
  };
});
