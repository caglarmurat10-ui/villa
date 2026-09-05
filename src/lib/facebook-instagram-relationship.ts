import type { Villa } from "./types";

// Meta Graph API v26: Page.instagram_business_account / Page.connected_instagram_account
// alanlarını okumak "instagram_basic" iznini gerektirir (Facebook Login for Business akışında
// pages_show_list/pages_read_engagement/pages_manage_posts/pages_manage_metadata bu alanları
// AÇMAZ). İzin eksikse Graph API çoğu zaman hata DÖNDÜRMEDEN alanı sessizce boş bırakır; bu da
// gerçekten bağlı bir Instagram hesabıyla, izin eksikliği yüzünden görünmeyen bir hesabı API
// yanıtında birebir aynı gösterir. Bu yüzden ilişkiyi okumadan ÖNCE token'ın gerçekten bu izne
// sahip olup olmadığı ayrıca (debug_token ile) doğrulanmalı; aksi halde "bağlı değil" sonucu
// false-negative olabilir.
export const FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION = "instagram_basic";

export const FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL =
  "Meta ilişki bilgisi okunamıyor; Facebook ↔ Instagram bağlı değil sonucu çıkarılamaz";

export type FacebookInstagramRelationshipCode =
  | "FACEBOOK_IG_LINK_OK"
  | "FACEBOOK_IG_LINK_MISSING"
  | "FACEBOOK_IG_LINK_MISMATCH"
  | "FACEBOOK_IG_PERMISSION_MISSING"
  | "FACEBOOK_IG_SCOPE_UNAVAILABLE"
  | "FACEBOOK_IG_API_ERROR";

// Eski istemcilerle (varsa) uyum için korunan özet durum; yeni tüketiciler `code` alanını kullanmalı.
export type LegacyRelationshipStatus = "healthy" | "mismatch" | "missing" | "unavailable";

export type FacebookInstagramLinkAccount = { id?: string; username?: string } | null | undefined;

export type FacebookTokenScopesResult =
  | { ok: true; scopes: string[] }
  | { ok: false };

export type FacebookInstagramRelationResult =
  | {
      ok: true;
      pageName?: string;
      instagramBusinessAccount: FacebookInstagramLinkAccount;
      connectedInstagramAccount: FacebookInstagramLinkAccount;
    }
  | { ok: false };

export type ClassifyFacebookInstagramRelationshipInput = {
  villa: Villa;
  pageName: string;
  storedInstagramAccountId: string;
  scopesResult: FacebookTokenScopesResult;
  // En az bir başka bağlı Facebook Sayfası tokenında bu izin GRANTED ise true. Bu, "Meta App
  // yapılandırması izni hiç desteklemiyor" (SCOPE_UNAVAILABLE) ile "yapılandırma izni destekliyor
  // ama bu token henüz yeniden bağlanıp güncel izni almadı" (PERMISSION_MISSING) durumlarını
  // ayırt etmek için kullanılır.
  scopeGrantedElsewhere: boolean;
  relationResult: FacebookInstagramRelationResult;
};

export type FacebookInstagramRelationshipClassification = {
  code: FacebookInstagramRelationshipCode;
  status: LegacyRelationshipStatus;
  healthy: boolean | null;
  label: string;
};

export function legacyRelationshipStatus(code: FacebookInstagramRelationshipCode): LegacyRelationshipStatus {
  switch (code) {
    case "FACEBOOK_IG_LINK_OK":
      return "healthy";
    case "FACEBOOK_IG_LINK_MISMATCH":
      return "mismatch";
    case "FACEBOOK_IG_LINK_MISSING":
      return "missing";
    case "FACEBOOK_IG_PERMISSION_MISSING":
    case "FACEBOOK_IG_SCOPE_UNAVAILABLE":
    case "FACEBOOK_IG_API_ERROR":
      return "unavailable";
  }
}

function result(code: FacebookInstagramRelationshipCode, healthy: boolean | null, label: string): FacebookInstagramRelationshipClassification {
  return { code, status: legacyRelationshipStatus(code), healthy, label };
}

export function classifyFacebookInstagramRelationship(
  input: ClassifyFacebookInstagramRelationshipInput,
): FacebookInstagramRelationshipClassification {
  const { villa, pageName, storedInstagramAccountId, scopesResult, scopeGrantedElsewhere, relationResult } = input;

  if (!scopesResult.ok) {
    return result(
      "FACEBOOK_IG_API_ERROR",
      null,
      `${pageName} için Facebook token izin bilgisi Meta API'den şu an okunamadı; Facebook ↔ Instagram ilişkisi bu yüzden doğrulanamadı. ${FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL}.`,
    );
  }

  const hasPermission = scopesResult.scopes.includes(FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION);
  if (!hasPermission) {
    if (scopeGrantedElsewhere) {
      return result(
        "FACEBOOK_IG_PERMISSION_MISSING",
        null,
        `${FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL}. ${pageName} tokenında "${FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION}" izni yok; Villa ${villa} Facebook bağlantısını yeniden kurarak güncel izinleri alın.`,
      );
    }
    return result(
      "FACEBOOK_IG_SCOPE_UNAVAILABLE",
      null,
      `${FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL}. Meta App Dashboard > Facebook İşletme Girişi yapılandırmasında "${FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION}" izni tanımlı değil; bu, panelden yeniden bağlanarak düzelmez, Meta App Dashboard'da yapılandırmaya elle eklenmesi gerekir.`,
    );
  }

  if (!relationResult.ok) {
    return result(
      "FACEBOOK_IG_API_ERROR",
      null,
      `${pageName} için Facebook–Instagram ilişki bilgisi Meta API'den şu an okunamadı; hesap bağlantıları ayrı ayrı test edilmeye devam ediyor.`,
    );
  }

  const linked = [relationResult.instagramBusinessAccount, relationResult.connectedInstagramAccount]
    .filter((item): item is { id: string; username?: string } => Boolean(item?.id));

  if (!linked.length) {
    return result(
      "FACEBOOK_IG_LINK_MISSING",
      false,
      `${pageName} Facebook Sayfasında bağlı Instagram profesyonel hesabı görünmüyor`,
    );
  }

  const exact = linked.find((item) => item.id === storedInstagramAccountId);
  if (!exact) {
    const visibleName = linked.find((item) => item.username)?.username;
    return result(
      "FACEBOOK_IG_LINK_MISMATCH",
      false,
      visibleName
        ? `Facebook Sayfası @${visibleName} hesabına bağlı; Villa ${villa} için kaydettiğimiz Instagram hesabıyla eşleşmiyor`
        : `Facebook Sayfasına bağlı Instagram hesabı Villa ${villa} için kaydettiğimiz hesapla eşleşmiyor`,
    );
  }

  return result(
    "FACEBOOK_IG_LINK_OK",
    true,
    `Facebook ↔ Instagram eşleşmesi doğru${exact.username ? ` · @${exact.username}` : ""}`,
  );
}
