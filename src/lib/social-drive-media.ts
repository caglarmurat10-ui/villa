import type { Villa } from "./types";

export type DriveMediaKind = "image" | "video";

// Medya kaynağı doğrulaması (bölüm 11): otomatik yayın YALNIZ sourceOrigin === "REAL_UPLOAD" olan
// medyaya izin verir - fail closed. Bu alan İSTEĞE BAĞLI DEĞİL (opsiyonel olsaydı yeni bir girdi
// hiç işaretlenmeden sessizce eklenip otomatik yayına girebilirdi) - her yeni medya eklerken kaynağı
// EXPLICIT olarak seçmek zorunlu, derleme zamanında garanti edilir. AI_GENERATED (örn. Higgsfield) veya
// OTHER (kaynağı belirsiz) medya approvedProxyMediaAsset() tarafından her zaman reddedilir.
export type MediaSourceOrigin = "REAL_UPLOAD" | "AI_GENERATED" | "OTHER";

export type DriveMediaAsset = {
  villa: Villa;
  fileName: string;
  fileId: string;
  mediaKind: DriveMediaKind;
  sourceOrigin: MediaSourceOrigin;
  viewUrl: string;
  previewUrl: string;
  sourceUrl: string;
  proxyPath: string;
};

// Tüm mevcut girdiler işletme sahibinin Google Drive'a yüklediği gerçek villa fotoğraf/video
// envanterinden gelir (bkz. villa-content.ts üst notu) - hepsi REAL_UPLOAD olarak işaretlendi.
const source: Array<[Villa, string, string, DriveMediaKind, MediaSourceOrigin]> = [
  ["Safira", "safira.mp4", "1dgpGq8V3gwVrMfeJrslGEY-l2nB34pMD", "video", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (6).jpg", "1xXvR6kjIL4S7UsCEr0RaiLtIYtGk1NOq", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (14).jpg", "1PGdf22BGfwu_WcUMzL_dJIMMznsp4XLn", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (18).jpg", "1pPw2PH_ADjnghDvx_WDFx_I5j7lUIeU0", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (21).jpg", "1R4cyepfNUiV8WX8QQJKjww7YdzoNF_QL", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (22).jpg", "1RqmKOcfGBYrSF1ZJHaJhKdN915nmUrlS", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (24).jpg", "1AXsPnczwLyu_GcSOnx5G2xB7Ftge7O1f", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (30).jpg", "1Nhv-aTFXScjrme9znJOUl86GwZp00qLE", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (35).jpg", "1cgx-l8NC-iKz4m-RiSjyePuJUqSVcXeC", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (38).jpg", "1uj3t-KihJntJU16_SsntdDaWFYXZwCV-", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (44).jpg", "1P2grXSd9NSG-zjGzHdi-TghTBD6DEj-I", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (47).jpg", "1NwvQ8PVRkjwFtyANCuOF0BUi5V96cWwM", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (50).jpg", "13ZC4v1qxGmUX0AXfNRWhpAkYprKpfkLB", "image", "REAL_UPLOAD"],
  ["Destan", "destan.mp4", "112oripO5bo-yomytO7R8maziaEHPzhgl", "video", "REAL_UPLOAD"],
  ["Destan", "villa destan.jpg", "1YAM5xbBCHJn3WedtW6rvcgaSKimmVZq4", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_05.jpg", "1vTtiCMXHuPRG0PDPhSPokUL404woQnJu", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_12.jpg", "15PvAe31O0Imul_BbiTHbq041tXAhfGKc", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_25.jpg", "1B8wGQAPbQCWL3iGmH4btgLU7JEAUfJmk", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_37.jpg", "1NmKtSAV2d4SUdYZo3qpfTJuROhgRExIH", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_50.jpg", "1peLe7wJOg51rF95O7tgJQV9SN2E60hYt", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0332.jpg", "1IipTx5zZfOge9Y1rQJBpW8BK9zBU2tgj", "image", "REAL_UPLOAD"],
  // 2026-09-10: İşletme sahibinin paylaştığı Drive klasörlerindeki (Safira/Destan) TAM envanter -
  // yukarıdaki ilk parti dışında kalan, aynı gerçek çekimden gelen fotoğraflar. Hepsi aynı kaynak
  // klasörden, aynı REAL_UPLOAD doğrulamasıyla eklendi - sosyal medya içerik havuzunu genişletir.
  ["Safira", "Villa Safira (7).jpg", "1bxLSYTadiMGTjxMhPAXlUOTCN2ZRIOja", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (8).jpg", "1_KWTtdaCZqMEBNxNaZzdGTujhu905Dde", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (9).jpg", "1tFNkVUYR_-QgxZMmkyhWH5cjZjVbOwNC", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (10).jpg", "12nsDanEfNFopPqa0GjrAsD-TcJCs8Fs0", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (11).jpg", "1gwb4Rc_zGKFVd97FTx-x8CilTPWdyGT8", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (12).jpg", "1gMO85Fd5hz-Rguu500WTPzABKg7NDgDN", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (13).jpg", "1grqjmhP7wGR4O3kk1n9E3puEmR1Jrjvu", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (15).jpg", "1dMmipDGTvU7A1YtpOzLpQNhwqRDbzPvi", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (16).jpg", "1ejjyw64Z1g77zgJbS-TPhi_Vmtg-xH9c", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (17).jpg", "1UTs-8jOcQp_jJOCOtsu8xj8TWVZEzVCQ", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (19).jpg", "1vWe569vqC4kU-REzFQ0aGnJqvqvVdn3v", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (20).jpg", "1W4Wv2kHbMOkTZUreRnsl2O8wDP7cVkXA", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (23).jpg", "16gPPgAFAtInZBe5k2uumwvePzUaP_UrY", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (25).jpg", "1_Fo9VgiO8pKeFu5KD57izSrgnxo-l7xY", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (26).jpg", "123MdTJCtBrEypyxsHUgYbXQz6F3f42Gs", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (27).jpg", "1KD_nQjFFDfd97JTqqrRl4asSjZZG4KW1", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (28).jpg", "16oMNLo27-AEXtHcIMO-Aoeh43WInHEg-", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (29).jpg", "1JL-isYYwAC7gtdKvIVogGnvZjB_3rXs5", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (31).jpg", "1D7eIhBWda80KVp5DT6wm-b8A_EVSmiKU", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (32).jpg", "12kEE1QhiCGGfXQzyh7HlCYorop2zfyOK", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (33).jpg", "1PUrADYQsb3Ix3Yh_O9TpgxUYjnbBxMdn", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (34).jpg", "1ow6bASFggUMHQwB7oUruD_skpATcvCaI", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (36).jpg", "1KF94MaT_H1-BAiL806YObOj_T1Zpg737", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (37).jpg", "1p2uDWRJLwk-oogl3mbzFM0JhN9pyiS_A", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (39).jpg", "1YX3pBq6dBADqMyovMSGcgGogYgz4gUOL", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (40).jpg", "1oemEUgf1yqqGo4hy0miGc6bz8qgW3m8v", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (41).jpg", "1NL2XNascx657iFG9Fn8nr9OR3PoqiJc1", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (42).jpg", "1k0GDjgu1Z-Jyv6iO3olx8OqcIVKtBzfu", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (43).jpg", "1BL2Zs2VU_AlBQG94groq40I6LS4f-lkW", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (45).jpg", "18BUkc9DmPA4HgQmIbDM2Qen3uzzILscV", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (46).jpg", "1KFQPzuytxEpfO7m7Rtiv35SMIixseG02", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (48).jpg", "1X-IrCLxakeny9q1c2weHYDTbubkwCvnu", "image", "REAL_UPLOAD"],
  ["Safira", "Villa Safira (49).jpg", "11lUqcgUVvgjK3xHN1c4D4hjsHwIM_K20", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0319.jpg", "1Y2LxTgSDZUx5C0mNb4RKD-iKAOshM87N", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0320.jpg", "1FbGa_1J2H6U3m-ZWxzBKSd5IPag1iIm5", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0322.jpg", "1PQTECuakM4lAko0gUlvRjr1dGGTC04Qf", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0323.jpg", "1EHQLlzA6cwZ-md1jR_wL4KASvLGSppJO", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0327.jpg", "1OtHFQP1vaAyo7i0tenTWgoS6PFaZbBOR", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0328.jpg", "16bhkdTtWfEKfdEEYHpyX0QjFVdBOwffU", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0329.jpg", "1Tp1-5MQb2Lu-1z17q10tQOnwbn4tJLxc", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0331.jpg", "1IQQ_MDE3tRZ7uBSwtTMphxZ_m3tG4fEL", "image", "REAL_UPLOAD"],
  ["Destan", "DJI_0333.jpg", "15Ioi2Bqi84qBjUQcyxGyLworPmDiL7aZ", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_01.jpg", "183mTBDeH9OuQPJ1Ts_ZjlqhqLhHOx_7X", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_02.jpg", "1SxSSH0LUP12jJp8RoDYYNurnmikZULLn", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_03.jpg", "12Iqo1_H142QKz6pOUzlEaFzb3bx01vFI", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_04.jpg", "1-lewUm7iRr4UqN5ZdLjQ0_CGxBI8y0P6", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_06.jpg", "1y2WLuwNC7WPPnpDkt8cEZa-tuu_BTLN0", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_07.jpg", "1pS7188_J0Jyfp5cwFXKNYuUrNFllU0HO", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_08.jpg", "1PSZ7N0McUHB7OGP0kkVsQM1ffNqrf2hb", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_09.jpg", "1z4H0-eN7O79XInVCaryoNpJlt_nFXhN4", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_10.jpg", "1cg04IYmyZg2Tep0osV7d21c0MlOUSLw9", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_11.jpg", "1e1cOSaEWLM9L99L04TJC4qf2H__n4WVa", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_13.jpg", "1vOu9vKMPu07GhQtKntvT5M5fgLxY-9uY", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_14.jpg", "1q-FQUX1s4zbWddhuZNHpyFD_8lx5BC-P", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_15.jpg", "10gxcxM54FMfwv9RIQDjHO792HvXqRDEL", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_16.jpg", "1nHu9FEwTWrA2fb3tOuR7br6nKm6UOdta", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_17.jpg", "1uKpYeGVJ059ZFHjzn8JeNqXLMg7rC-Vj", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_18.jpg", "1Us0QO6XyOgF0VNxqQU9X3HaXjiqcS5WC", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_19.jpg", "1NIm-0raI7yq11QG3IOybCL3M6ZEFlH-Q", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_20.jpg", "19gw2-GPqOMNXHyaw5_ZyArlv8DHwbzOh", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_21.jpg", "1N8Hir67q7ZbsiUf1tvgXQHCVaHlKKpgP", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_22.jpg", "1gZSAB8E72sS6UpmSLz8ZqDuBLocl1Y4z", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_23.jpg", "1JSQCeGFILq_MN0SJhTs93ifh-7BLZ1Al", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_24.jpg", "15XYvzcgAf2Xg5jcO0cQmnfFyyT01RWds", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_26.jpg", "1QQOzqiXJV8REzem6Y48ZZowbZDLutuXO", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_27.jpg", "1EAys2YAsUcvwxbAKLXeSu-eERvpgyuss", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_28.jpg", "1S_S4useRvADyT8OHOtK8SBYlPtvKnG59", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_29.jpg", "1hU6YLLEnfwLpLlywSWEIGycwsXVZyLFV", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_30.jpg", "1pL43Ykv8qm64NwXiy_r2tqWYgCp_F359", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_31.jpg", "1Ju29Hktr1rbgvH0qiLDHGag7pQePRY8n", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_32.jpg", "1duNV_zSbkv7RGJc5v-NKYqzmW1RetWf0", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_33.jpg", "14LSN6yOGUQ704iw8TFozq-LjbD2Aqij2", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_34.jpg", "1Zl8shy6IqW4X2rYDr-l25SZnzmrLMoEk", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_35.jpg", "1QxnK7WS3HBMBtv9Lysw-RShkwlLspjVj", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_36.jpg", "1uuZiWtjCA10_RJy9fG-QR3HdX47HRwHU", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_38.jpg", "1Aby2DexWK96ddQ5DVCSqZxGnTim8Rpfl", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_39.jpg", "1wXPJ6vizOxN51QcJv6MvF-TI_UXchgMk", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_40.jpg", "1Jjm060FFDFDYII9gmmOeFQseGdm8oFWB", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_41.jpg", "1vXeDycrc_yOVg2gilDpZY1ZXCZdvZ8sb", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_42.jpg", "1qdSrB4BBgqggDP5MC2sQTFPSCOIZW4XL", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_43.jpg", "19N6oheu9ROVlyRnh_Il548Y1IaTVJJjt", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_44.jpg", "1-4YG_v6mgZqoom3SkRMBhKZwQ55doii2", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_45.jpg", "1EfZZcENIjQnbs2KRHennJWUsthS8jSFc", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_46.jpg", "1fATEOB_6JvQ3iUliQnWolxN8xn6gl5nH", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_47.jpg", "1jEJGxltWBCJJ5DygACOYF6l7QIDXYOPG", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_48.jpg", "11pZMn8gDSFdpJhkyBY0C7vWC0LB8YEDa", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_49.jpg", "1COo3B_68mtTR-cvy8GEhp6oF8o7cOmc8", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_51.jpg", "1nqqB70Up8f_g0zzrtKzqu9AmU_-bPu-Q", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_52.jpg", "1raYsC00WdCYTsyt5KmphViQ8V8mPuAqy", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_53.jpg", "1iCZYl6cogRl-QrX4NzSOJSdoBBDUvJJN", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_54.jpg", "1VHOYmpPylTCv1d-smTDDOTV7d4ElL4-8", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_55.jpg", "12a1KrN_MG8j4mfzA3uzZ_RIrltws10FE", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_56.jpg", "1IwsEdlqAUs0k19BC3_nKipuS0a9_hmNH", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_57.jpg", "1zbjMIlZc-c0QSo4r363Wf3kc9B0DZO6h", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_58.jpg", "136qwxrD21RYiw4YfTHf0yx6rmnbCZPBl", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_59.jpg", "1Eh2Bu6odtoJ63qV0gpzVbzGI7Et6ff9I", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_60.jpg", "1gmSgNwpNYbDGVi_aAzYBBrO6FXzUoI5j", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_61.jpg", "1tIu8Y_snDUW7zqIDOEIBxKfzpNfVDK_H", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_62.jpg", "1Az8y2bi3dvX-A6BKpvHJ8yvKr0LVYoVf", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_63.jpg", "1IV3ocu7XttD9CNhTbtEv47OtlpBQmjFM", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_64.jpg", "1JMgoH2p35h32uXEcsQHJzad8Vxez99c7", "image", "REAL_UPLOAD"],
  ["Destan", "villa destan_65.jpg", "1CS9zwqC1_r-spOZEAdDuvLx9OQT4yF6H", "image", "REAL_UPLOAD"],
];

function toAsset([villa, fileName, fileId, mediaKind, sourceOrigin]: [Villa, string, string, DriveMediaKind, MediaSourceOrigin]): DriveMediaAsset {
  return {
    villa,
    fileName,
    fileId,
    mediaKind,
    sourceOrigin,
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

// Otomatik yayın izni için tek geçit: villa (property_id) eşleşmeli VE sourceOrigin === "REAL_UPLOAD"
// olmalı. Fail closed - villa eşleşse bile AI_GENERATED/OTHER veya kaydı bulunamayan (bilinmeyen
// property/kaynak) medya reddedilir; iki koşuldan biri eksikse null döner, hiçbir şey varsayılmaz.
export function approvedProxyMediaAsset(villa: Villa, url: string, allowedOrigins: string[]) {
  try {
    const parsed = new URL(url);
    if (!allowedOrigins.includes(parsed.origin)) return null;
    const fileId = proxyFileId(url);
    if (!fileId) return null;
    const asset = resolveDriveMediaById(fileId);
    if (!asset || asset.villa !== villa) return null;
    if (asset.sourceOrigin !== "REAL_UPLOAD") return null;
    return asset;
  } catch {
    return null;
  }
}

export function isApprovedProxyMediaUrl(villa: Villa, url: string, allowedOrigins: string[]) {
  return Boolean(approvedProxyMediaAsset(villa, url, allowedOrigins));
}
