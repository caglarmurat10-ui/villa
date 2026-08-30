import type { Villa } from "./types";

export type DriveMediaKind = "image" | "video";

export type DriveMediaAsset = {
  villa: Villa;
  fileName: string;
  fileId: string;
  mediaKind: DriveMediaKind;
  viewUrl: string;
  previewUrl: string;
  sourceUrl: string;
  proxyPath: string;
};

const source: Array<[Villa, string, string, DriveMediaKind]> = [
  ["Safira", "Villa Safira (6).jpg", "1xXvR6kjIL4S7UsCEr0RaiLtIYtGk1NOq", "image"],
  ["Safira", "Villa Safira (14).jpg", "1PGdf22BGfwu_WcUMzL_dJIMMznsp4XLn", "image"],
  ["Safira", "Villa Safira (18).jpg", "1pPw2PH_ADjnghDvx_WDFx_I5j7lUIeU0", "image"],
  ["Safira", "Villa Safira (21).jpg", "1R4cyepfNUiV8WX8QQJKjww7YdzoNF_QL", "image"],
  ["Safira", "Villa Safira (22).jpg", "1RqmKOcfGBYrSF1ZJHaJhKdN915nmUrlS", "image"],
  ["Safira", "Villa Safira (24).jpg", "1AXsPnczwLyu_GcSOnx5G2xB7Ftge7O1f", "image"],
  ["Safira", "Villa Safira (30).jpg", "1Nhv-aTFXScjrme9znJOUl86GwZp00qLE", "image"],
  ["Safira", "Villa Safira (35).jpg", "1cgx-l8NC-iKz4m-RiSjyePuJUqSVcXeC", "image"],
  ["Safira", "Villa Safira (38).jpg", "1uj3t-KihJntJU16_SsntdDaWFYXZwCV-", "image"],
  ["Safira", "Villa Safira (44).jpg", "1P2grXSd9NSG-zjGzHdi-TghTBD6DEj-I", "image"],
  ["Safira", "Villa Safira (47).jpg", "1NwvQ8PVRkjwFtyANCuOF0BUi5V96cWwM", "image"],
  ["Safira", "Villa Safira (50).jpg", "13ZC4v1qxGmUX0AXfNRWhpAkYprKpfkLB", "image"],
  ["Destan", "villa destan.jpg", "1YAM5xbBCHJn3WedtW6rvcgaSKimmVZq4", "image"],
  ["Destan", "villa destan_05.jpg", "1vTtiCMXHuPRG0PDPhSPokUL404woQnJu", "image"],
  ["Destan", "villa destan_12.jpg", "15PvAe31O0Imul_BbiTHbq041tXAhfGKc", "image"],
  ["Destan", "villa destan_25.jpg", "1B8wGQAPbQCWL3iGmH4btgLU7JEAUfJmk", "image"],
  ["Destan", "villa destan_37.jpg", "1NmKtSAV2d4SUdYZo3qpfTJuROhgRExIH", "image"],
  ["Destan", "villa destan_50.jpg", "1peLe7wJOg51rF95O7tgJQV9SN2E60hYt", "image"],
  ["Destan", "DJI_0332.jpg", "1IipTx5zZfOge9Y1rQJBpW8BK9zBU2tgj", "image"],
];

function toAsset([villa, fileName, fileId, mediaKind]: [Villa, string, string, DriveMediaKind]): DriveMediaAsset {
  return {
    villa,
    fileName,
    fileId,
    mediaKind,
    viewUrl: `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,
    previewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
    sourceUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    proxyPath: `/api/media/drive/${fileId}`,
  };
}

export const socialDriveMedia: DriveMediaAsset[] = source.map(toAsset);

const byVillaAndName = new Map(
  socialDriveMedia.map((asset) => [`${asset.villa}:${asset.fileName}`, asset]),
);
const byId = new Map(socialDriveMedia.map((asset) => [asset.fileId, asset]));

export function resolveDriveMedia(villa: Villa, fileName: string) {
  return byVillaAndName.get(`${villa}:${fileName}`) ?? null;
}

export function resolveDriveMediaById(fileId: string) {
  return byId.get(fileId) ?? null;
}

function proxyFileId(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/api\/media\/drive\/([^/]+)$/);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

export function isManagedMediaUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "drive.google.com" || parsed.hostname === "docs.google.com" || Boolean(proxyFileId(url));
  } catch {
    return false;
  }
}

export function isApprovedMediaUrl(villa: Villa, url: string) {
  const fileId = proxyFileId(url);
  if (fileId) return resolveDriveMediaById(fileId)?.villa === villa;
  return socialDriveMedia.some((asset) =>
    asset.villa === villa &&
    (asset.sourceUrl === url || asset.previewUrl === url || asset.viewUrl === url),
  );
}

export function approvedProxyMediaAsset(villa: Villa, url: string, allowedOrigins: string[]) {
  try {
    const parsed = new URL(url);
    if (!allowedOrigins.includes(parsed.origin)) return null;
    const fileId = proxyFileId(url);
    if (!fileId) return null;
    const asset = resolveDriveMediaById(fileId);
    return asset?.villa === villa ? asset : null;
  } catch {
    return null;
  }
}

export function isApprovedProxyMediaUrl(villa: Villa, url: string, allowedOrigins: string[]) {
  return Boolean(approvedProxyMediaAsset(villa, url, allowedOrigins));
}
