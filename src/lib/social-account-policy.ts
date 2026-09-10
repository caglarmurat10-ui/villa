import type { SocialPlatform, Villa } from "./types";
import type { FacebookInstagramRelationshipClassification } from "./facebook-instagram-relationship";

export type MetaPlatform = "Instagram" | "Facebook";

export type MetaTarget = {
  villa: Villa;
  platform: MetaPlatform;
};

// 2026-09-08 GÜNCEL DOĞRULANMIŞ META DURUMU (işletme sahibinin Meta destek/backend kontrolünden
// gelen en güncel bilgi - önceki "OAuth doğrulandı, aktif hedef" varsayımının YERİNE geçer):
// @villadestanpatara (Instagram Asset ID 17841439303443100) şu anda "Safira & Destan Villas" iş
// portföyüne (Business ID 625405565257264) TAM BAĞLI/SAHİPLİ değil - Meta bu varlığın BAŞKA bir
// Business Manager/Portföy ile ilişkili olduğunu bildiriyor, hangi işletme olduğunu güvenlik
// nedeniyle paylaşmıyor ve mevcut kullanıcının o işletmede yönetici erişimi yok. Bu GEÇİCİ/API
// hatası DEĞİL - dış bir mülkiyet/sahiplik sorunu, yalnız Meta tarafında elle çözülebilir. Bu
// yüzden statik olarak bloklanır (canlı Graph API'ye tekrar tekrar sormak - "spam" - yerine).
// Instagram hesabının kendisi Instagram uygulamasında ELLE kullanılabilir durumda (bkz.
// social-manual-publish.ts) - yalnız BU uygulamanın Graph API ile OTOMATİK yayın yapması engelli.
export const DESTAN_INSTAGRAM_HARD_BLOCK = {
  villa: "Destan" as const,
  platform: "Instagram" as const,
  blocked: true as boolean,
  reason: "@villadestanpatara Instagram varlığı şu anda başka bir Meta İşletme Portföyü ile ilişkilendirilmiş görünüyor; Safira & Destan Villas işletme portföyünün tam yönetici erişimi yok. Bu, Meta'nın kendi tarafında çözülmesi gereken bir sahiplik/mülkiyet sorunu - kodumuzdaki bir hata değil. Instagram hesabı uygulamada elle kullanılabilir; otomatik (Graph API) yayın bu sorun çözülene kadar devre dışı.",
};

// Organik yayın için fiilen desteklenen Meta hedefleri. Dört hedef de burada listelenir (Destan
// Instagram dahil) - "aktif" hedef olmak "şu an sağlıklı" anlamına gelmez, yalnız "izlenen/gerçek
// bir hedef" anlamına gelir. Sağlık durumu ayrıca DESTAN_INSTAGRAM_HARD_BLOCK ile izlenir.
export const META_ACTIVE_TARGETS = [
  { villa: "Safira", platform: "Instagram" },
  { villa: "Safira", platform: "Facebook" },
  { villa: "Destan", platform: "Facebook" },
  { villa: "Destan", platform: "Instagram" },
] as const satisfies readonly MetaTarget[];

// Sağlık ekranı SocialPost.platform (Instagram/Facebook/TikTok/WhatsApp Durum) ile çalışır.
// Bu helper yalnız politika bayrağı tekrar açılırsa Destan+Instagram kombinasyonunu bloklar;
// OAuth doğrulaması sonrası mevcut production politikası blocked=false olduğu için dört Meta hedefi aktiftir.
export function isMetaTargetHardBlocked(villa: Villa, platform: SocialPlatform) {
  return DESTAN_INSTAGRAM_HARD_BLOCK.blocked && villa === DESTAN_INSTAGRAM_HARD_BLOCK.villa && platform === DESTAN_INSTAGRAM_HARD_BLOCK.platform;
}

export function metaTargetLabel(target: MetaTarget) {
  return `${target.villa} ${target.platform}`;
}

// Bölüm 8 (2026-09-08 güncellendi): Villa Destan Instagram, kendi tarafımızda OAuth token'ı bağlı
// görünse bile Meta'nın kendisi bu varlığın (Instagram Asset ID 17841439303443100) başka bir
// Business Manager/Portföy ile ilişkili olduğunu bildiriyor - Facebook Sayfası <-> Instagram
// profesyonel hesabı ilişkisi bu YÜZDEN kurulamıyor. Bu bizim kontrolümüz dışında, dış bir Meta
// SAHİPLİK sorunu (yalnız "bağlantı eksik" değil - "bu hesap zaten başka bir işletmenin").
// FACEBOOK_IG_LINK_MISSING/MISMATCH bu spesifik dış nedenden kaynaklandığında, Destan+Instagram
// için ayrı ve açık bir BLOCKED_EXTERNAL_META_OWNERSHIP etiketiyle raporlanır - "bizim hatamız"
// (PERMISSION_MISSING/SCOPE_UNAVAILABLE/API_ERROR) ile karıştırılmaz. NOT: Bu artık yalnız canlı
// Graph API kontrolüne değil, DESTAN_INSTAGRAM_HARD_BLOCK statik bayrağına da dayanır - Meta
// destek ekibinin doğruladığı bir sahiplik sorunu GEÇİCİ değildir, her 15 dakikada bir canlı
// kontrol/Graph API isteği tekrarlamak (spam) yerine statik olarak bloklanır. Bayrak, admin bir
// reconnect/health check ile sorunun çözüldüğünü doğruladıktan sonra elle false'a çevrilir.
export type MetaPublishGateCode = FacebookInstagramRelationshipClassification["code"] | "BLOCKED_EXTERNAL_META_OWNERSHIP";

export type MetaPublishGateResult = {
  blocked: boolean;
  code: MetaPublishGateCode;
  label: string;
};

const DESTAN_OWNERSHIP_LABEL =
  "@villadestanpatara şu anda başka bir Meta İşletme Portföyü ile ilişkilendirilmiş görünüyor; Safira & Destan Villas işletme portföyünün tam yönetici erişimi yok. Bu, Meta'nın kendi tarafında çözülmesi gereken bir sahiplik/mülkiyet sorunu - kodumuzdaki bir hata değil. Instagram hesabı uygulamada elle kullanılabilir; otomatik yayın bu sorun çözülene kadar devre dışı.";

// hardBlockedOverride parametresi YALNIZ testler içindir - gerçek çağrı yerleri (publish route,
// health route) hiç geçirmez ve gerçek DESTAN_INSTAGRAM_HARD_BLOCK.blocked bayrağı kullanılır. Bu
// sayede fonksiyon hem "şu an gerçekten bloklu" (varsayılan/production) hem "bayrak temizlendikten
// sonra" davranışını mock/module-mutation olmadan test edebilir.
export function metaPublishGate(
  villa: Villa,
  platform: MetaPlatform,
  relationship: FacebookInstagramRelationshipClassification | null,
  hardBlockedOverride?: boolean,
): MetaPublishGateResult {
  const isDestanInstagram = villa === "Destan" && platform === "Instagram";
  const destanInstagramHardBlocked = hardBlockedOverride ?? DESTAN_INSTAGRAM_HARD_BLOCK.blocked;

  // Doğrulanmış, kalıcı dış sahiplik sorunu - canlı Graph API kontrolüne HİÇ gitmeden statik
  // olarak bloklanır (bkz. yukarıdaki not - "do not create Graph spam").
  if (isDestanInstagram && destanInstagramHardBlocked) {
    return { blocked: true, code: "BLOCKED_EXTERNAL_META_OWNERSHIP", label: DESTAN_OWNERSHIP_LABEL };
  }

  if (!relationship) {
    return {
      blocked: true,
      code: "FACEBOOK_IG_API_ERROR",
      label: `${villa} ${platform} ilişki durumu okunamadı; yayın güvenlik nedeniyle durduruldu.`,
    };
  }

  if (isDestanInstagram && (relationship.code === "FACEBOOK_IG_LINK_MISSING" || relationship.code === "FACEBOOK_IG_LINK_MISMATCH")) {
    return { blocked: true, code: "BLOCKED_EXTERNAL_META_OWNERSHIP", label: DESTAN_OWNERSHIP_LABEL };
  }

  return {
    blocked: !relationship.healthy,
    code: relationship.code,
    label: relationship.label,
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
