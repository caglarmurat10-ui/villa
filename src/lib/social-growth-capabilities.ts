// Social Growth Agent - Faz 1 yetkinlik matrisi. Bugünkü READ-ONLY audit'in tek kaynağı:
// hangi Growth Agent özelliği hangi Meta izniyle çalışır, hangisi hâlâ PENDING_PERMISSION.
// Granted izinler: instagram_business_basic, instagram_business_content_publish (src/lib/meta.ts
// - Instagram Login) ve pages_show_list/pages_read_engagement/pages_manage_posts/
// pages_manage_metadata/instagram_basic (src/lib/facebook.ts - Facebook Business Login).
// Bu dosyadaki her satır available:false OLARAK KALMALI - yeni izin gerçekten Meta App Review'dan
// geçip OAuth scope'larına eklenmeden `available:true` yapılmamalı (bkz. social-growth-capabilities.test.ts
// tripwire testi).
export type GrowthCapabilityKey =
  | "SCOUT_HASHTAG"
  | "SCOUT_BUSINESS_DISCOVERY"
  | "OWN_COMMENTS"
  | "MENTION_AGENT"
  | "DM_LEAD_AGENT"
  | "GROWTH_INSIGHTS";

export type GrowthCapabilityStatus = {
  key: GrowthCapabilityKey;
  label: string;
  available: boolean;
  requiredPermission: string;
};

export const GROWTH_CAPABILITIES: readonly GrowthCapabilityStatus[] = [
  {
    key: "SCOUT_HASHTAG",
    label: "Hashtag keşfi (Social Scout)",
    available: false,
    requiredPermission: "instagram_basic + Instagram Public Content Access (App Review feature)",
  },
  {
    key: "SCOUT_BUSINESS_DISCOVERY",
    label: "Business Discovery (başka hesap metadata)",
    available: false,
    requiredPermission: "Instagram Graph API Business Discovery (ek App Review gerektirir)",
  },
  {
    key: "OWN_COMMENTS",
    label: "Kendi gönderi yorumlarını okuma/yanıtlama",
    available: false,
    requiredPermission: "instagram_business_manage_comments",
  },
  {
    key: "MENTION_AGENT",
    label: "Mention tespiti",
    available: false,
    requiredPermission: "instagram_business_manage_comments",
  },
  {
    key: "DM_LEAD_AGENT",
    label: "DM lead sınıflandırma",
    available: false,
    requiredPermission: "instagram_business_manage_messages",
  },
  {
    key: "GROWTH_INSIGHTS",
    label: "Takipçi/reach/impressions analitiği",
    available: false,
    requiredPermission: "instagram_business_manage_insights",
  },
];

export function growthCapabilitiesSummary() {
  const available = GROWTH_CAPABILITIES.filter((item) => item.available).length;
  return { total: GROWTH_CAPABILITIES.length, available, pending: GROWTH_CAPABILITIES.length - available };
}
