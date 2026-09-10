import type { SocialPlatform, Villa } from "./types";
import type { FacebookInstagramRelationshipClassification } from "./facebook-instagram-relationship";

export type MetaPlatform = "Instagram" | "Facebook";

export type MetaTarget = {
  villa: Villa;
  platform: MetaPlatform;
};

// 2026-09-10: Instagram yayın mimarisi Meta'nın "Instagram API with Instagram Login" akışını
// kullanıyor (graph.instagram.com + Instagram User access token). Bu akışta profesyonel Instagram
// hesabının bir Facebook Page'e bağlı olması yayın için önkoşul değildir. Bu nedenle Destan'daki
// Facebook<->Instagram Business Portfolio uyuşmazlığı ilişki teşhisi olarak gösterilmeye devam eder,
// fakat bağımsız Instagram yayınını HARD BLOCK etmez. Eski 2026-09-05 ve öncesi Destan Instagram
// backlog'u ayrı güvenlik kapısında korunur ve yeniden yayınlanmaz.
export const DESTAN_INSTAGRAM_HARD_BLOCK = {
  villa: "Destan" as const,
  platform: "Instagram" as const,
  blocked: false as boolean,
  reason: "@villadestanpatara doğrudan Instagram Login API ile bağımsız yayınlanır. Facebook ↔ Instagram Business Portfolio ilişkisi ayrı bir teşhis/hesap bağlantısı konusudur ve doğrudan Instagram yayını için önkoşul değildir. 5 Eylül 2026 ve öncesi eski Destan Instagram kuyruğu güvenlik nedeniyle ayrıca engelli kalır.",
};

// Organik yayın için fiilen desteklenen Meta hedefleri. Dört hedef de birbirinden bağımsız yayın
// hedefidir; Facebook<->Instagram ilişki sağlığı ayrı olarak izlenir ve cross-platform teşhis amacı
// taşır, bağımsız yayın motorunu durdurmaz.
export const META_ACTIVE_TARGETS = [
  { villa: "Safira", platform: "Instagram" },
  { villa: "Safira", platform: "Facebook" },
  { villa: "Destan", platform: "Facebook" },
  { villa: "Destan", platform: "Instagram" },
] as const satisfies readonly MetaTarget[];

export function isMetaTargetHardBlocked(villa: Villa, platform: SocialPlatform) {
  return DESTAN_INSTAGRAM_HARD_BLOCK.blocked && villa === DESTAN_INSTAGRAM_HARD_BLOCK.villa && platform === DESTAN_INSTAGRAM_HARD_BLOCK.platform;
}

export function metaTargetLabel(target: MetaTarget) {
  return `${target.villa} ${target.platform}`;
}

// Facebook<->Instagram ilişki sonucu artık bağımsız organik yayın için bir gate değildir. Bu helper
// geçmiş çağrı noktaları/teşhis ekranlarıyla geriye uyumluluk için korunur. Yalnız açık bir statik
// hard-block varsa yayını durdurur; LINK_MISSING/MISMATCH/PERMISSION/API_ERROR sonuçları ilişki
// teşhisi olarak döner ancak Facebook veya Instagram'ın kendi token/account doğrulaması sağlıklıysa
// bağımsız yayın kanalını kapatmaz.
export type MetaPublishGateCode = FacebookInstagramRelationshipClassification["code"] | "BLOCKED_EXTERNAL_META_OWNERSHIP";

export type MetaPublishGateResult = {
  blocked: boolean;
  code: MetaPublishGateCode;
  label: string;
};

const DESTAN_OWNERSHIP_LABEL =
  "@villadestanpatara Facebook ↔ Instagram Business Portfolio ilişkisi Meta tarafında uyuşmuyor. Bu ilişki sorunu ayrı izlenir; doğrudan Instagram Login API yayınına engel değildir.";

export function metaPublishGate(
  villa: Villa,
  platform: MetaPlatform,
  relationship: FacebookInstagramRelationshipClassification | null,
  hardBlockedOverride?: boolean,
): MetaPublishGateResult {
  const isDestanInstagram = villa === "Destan" && platform === "Instagram";
  const destanInstagramHardBlocked = hardBlockedOverride ?? DESTAN_INSTAGRAM_HARD_BLOCK.blocked;

  if (isDestanInstagram && destanInstagramHardBlocked) {
    return { blocked: true, code: "BLOCKED_EXTERNAL_META_OWNERSHIP", label: DESTAN_OWNERSHIP_LABEL };
  }

  if (!relationship) {
    return {
      blocked: false,
      code: "FACEBOOK_IG_API_ERROR",
      label: `${villa} Facebook ↔ Instagram ilişki durumu okunamadı; bağımsız ${platform} yayını bu teşhisten etkilenmez.`,
    };
  }

  return {
    blocked: false,
    code: relationship.code,
    label: relationship.healthy === true
      ? relationship.label
      : `${relationship.label} · Bu ilişki uyarısı bağımsız ${platform} yayınını durdurmaz.`,
  };
}

// ============ Reklam yeterliliği (organik yayından TAMAMEN ayrı izlenir) ============
// Bölüm: "DESTAN_ADS ve organik yayın sağlığı ayrı izlenmeli". Bu proje Meta Ads KULLANMAZ (mutlak
// maliyet kuralı) - bu durum yalnız TEŞHİS/doğruluk amaçlı: bir admin paneli reklam hesabı
// durumuna bakarsa, organik yayının bundan etkilenmediğini ve reklam vermenin zaten hiç
// amaçlanmadığını net görsün. Ödeme yöntemi eksikliği asla bir "uygulama hatası" gibi gösterilmez.
export type MetaAdsState = "BLOCKED_EXTERNAL_META_RESTRICTION" | "NOT_USED_BY_DESIGN";

export const DESTAN_ADS_STATE: { state: MetaAdsState; reason: string } = {
  state: "BLOCKED_EXTERNAL_META_RESTRICTION",
  reason: "Meta, bu işletme hesabının reklam vermesine izin verilmediğini bildiriyor (\"Bu işletme hesabı Reklam İlkelerimize veya diğer standartlarımıza uymadı\"). Bu proje zaten Meta Ads kullanmıyor (mutlak maliyet kuralı) - bu durum yalnız teşhis amaçlı kaydedilir, organik yayını hiçbir şekilde etkilemez.",
};

// Kişisel Facebook profili erişim durumu (bölüm: META_PROFILE_ACCESS) - Meta destek ekibi geçici
// davranışsal/erişim blokları bildiriyor (bkz. proje notları). Bu API'den OKUNAMAZ (Meta bunu Graph
// API üzerinden ifşa etmez) - yalnız bilgilendirme amaçlı statik bir not. Otomatik reconnect/retry
// DAVRANIŞI TETİKLEMEZ (zaten kod hiçbir yerde OAuth'u otomatik tetiklemiyor - yalnız admin elle
// başlatır).
export type MetaProfileAccessState = "TEMPORARY_EXTERNAL_RESTRICTION" | "UNKNOWN";

export const META_PROFILE_ACCESS: { state: MetaProfileAccessState; note: string } = {
  state: "TEMPORARY_EXTERNAL_RESTRICTION",
  note: "Meta, hesabı yöneten kişisel profil için geçici erişim/davranış kısıtlamaları bildirdi (kalıcı yasaklama değil, süre garantisi yok). Bu durum otomatik olarak yeniden denenmez - OAuth yeniden bağlama her zaman admin'in elle başlattığı bir aksiyondur.",
};
