import type { SocialPlatform, Villa } from "./types";
import type { FacebookInstagramRelationshipClassification } from "./facebook-instagram-relationship";

export type MetaPlatform = "Instagram" | "Facebook";

export type MetaTarget = {
  villa: Villa;
  platform: MetaPlatform;
};

export const DESTAN_INSTAGRAM_HARD_BLOCK = {
  villa: "Destan" as const,
  platform: "Instagram" as const,
  blocked: false as boolean,
  reason: "Instagram OAuth bağlantısı başarıyla doğrulandı; Destan Instagram aktif Meta hedefidir.",
};

// Organik yayın için fiilen desteklenen Meta hedefleri. Destan Instagram OAuth bağlantısı
// 2026-09-05 tarihinde başarıyla doğrulandığı için aktif hedefler arasına alınmıştır.
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

// Bölüm 8: Villa Destan Instagram, kendi tarafımızda OAuth token'ı bağlı görünse bile Meta Business
// Suite tarafında Facebook Sayfası <-> Instagram profesyonel hesabı ilişkisi kurulmamışsa
// ("Bir Instagram profili bağla" uyarısı) gerçek yayın gönderilemez - bu bizim kontrolümüz dışında,
// dış bir Meta yapılandırma eksikliği. FACEBOOK_IG_LINK_MISSING/MISMATCH bu spesifik dış nedenden
// kaynaklandığında, Destan+Instagram için ayrı ve açık bir BLOCKED_EXTERNAL_META_SETUP etiketiyle
// raporlanır - "bizim hatamız" (PERMISSION_MISSING/SCOPE_UNAVAILABLE/API_ERROR) ile karıştırılmaz.
// Bu durum statik bir bayrak DEĞİL - her çağrıda canlı Graph API ilişki kontrolüne (bkz.
// facebook-instagram-relationship-live.ts) dayanır, dış Meta ayarı düzeltildiği anda otomatik olarak
// kendi kendine düzelir (kod değişikliği/redeploy gerekmez).
export type MetaPublishGateCode = FacebookInstagramRelationshipClassification["code"] | "BLOCKED_EXTERNAL_META_SETUP";

export type MetaPublishGateResult = {
  blocked: boolean;
  code: MetaPublishGateCode;
  label: string;
};

export function metaPublishGate(
  villa: Villa,
  platform: MetaPlatform,
  relationship: FacebookInstagramRelationshipClassification | null,
): MetaPublishGateResult {
  if (!relationship) {
    return {
      blocked: true,
      code: "FACEBOOK_IG_API_ERROR",
      label: `${villa} ${platform} ilişki durumu okunamadı; yayın güvenlik nedeniyle durduruldu.`,
    };
  }

  const isDestanInstagram = villa === "Destan" && platform === "Instagram";
  if (isDestanInstagram && (relationship.code === "FACEBOOK_IG_LINK_MISSING" || relationship.code === "FACEBOOK_IG_LINK_MISMATCH")) {
    return {
      blocked: true,
      code: "BLOCKED_EXTERNAL_META_SETUP",
      label: "Meta Business Suite'te Villa Destan Facebook Sayfası'na bağlı bir Instagram profesyonel hesabı görünmüyor (\"Bir Instagram profili bağla\"). Bu, Meta'nın kendi arayüzünden elle düzeltilmesi gereken dış bir yapılandırma eksikliği - kodumuzdaki bir hata değil. Düzeltildikten sonra bu kontrol otomatik olarak sağlıklı görünecektir.",
    };
  }

  return {
    blocked: !relationship.healthy,
    code: relationship.code,
    label: relationship.label,
  };
}
