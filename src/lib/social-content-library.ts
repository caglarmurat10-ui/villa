import content01 from "@/data/social-content-01.json";
import content02 from "@/data/social-content-02.json";
import content03 from "@/data/social-content-03.json";
import content04 from "@/data/social-content-04.json";
import content05 from "@/data/social-content-05.json";
import content06 from "@/data/social-content-06.json";
import { resolveDriveMedia } from "./social-drive-media";
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
  driveFileId: string;
  driveViewUrl: string;
  previewUrl: string;
  mediaUrl: string;
};

type RawTemplate = Omit<
  SocialContentTemplate,
  "villa" | "format" | "contentType" | "mediaResolved" | "driveFileId" | "driveViewUrl" | "previewUrl" | "mediaUrl"
> & {
  villa: string;
  format: string;
};

function contentType(format: string): SocialContentType {
  if (format === "Story") return "Hikâye";
  if (format === "Reels") return "Reels";
  return "Gönderi";
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
  const media = resolveDriveMedia(villa, item.mediaFile);
  return {
    ...item,
    villa,
    format: (item.format === "Story" || item.format === "Reels" || item.format === "Carousel") ? item.format : "Feed",
    contentType: contentType(item.format),
    mediaResolved: Boolean(media),
    driveFileId: media?.fileId ?? "",
    driveViewUrl: media?.viewUrl ?? "",
    previewUrl: media?.previewUrl ?? "",
    mediaUrl: media?.proxyPath ?? "",
  };
});
