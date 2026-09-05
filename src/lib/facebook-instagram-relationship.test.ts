import { describe, expect, it } from "vitest";
import {
  FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION,
  FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL,
  classifyFacebookInstagramRelationship,
  legacyRelationshipStatus,
} from "./facebook-instagram-relationship";

const GRANTED_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata", FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION];
const SCOPES_WITHOUT_RELATIONSHIP_PERMISSION = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_manage_metadata"];

describe("classifyFacebookInstagramRelationship", () => {
  it("izin mevcut ve doğru Instagram hesabı bağlıysa FACEBOOK_IG_LINK_OK döner (healthy ilişki)", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Safira",
      pageName: "Villa Safira",
      storedInstagramAccountId: "17800000000000001",
      scopesResult: { ok: true, scopes: GRANTED_SCOPES },
      scopeGrantedElsewhere: true,
      relationResult: {
        ok: true,
        instagramBusinessAccount: { id: "17800000000000001", username: "villasafirapatara" },
        connectedInstagramAccount: null,
      },
    });
    expect(result.code).toBe("FACEBOOK_IG_LINK_OK");
    expect(result.healthy).toBe(true);
    expect(result.status).toBe("healthy");
    expect(result.label).toContain("villasafirapatara");
  });

  it("izin mevcut ama Sayfada hiç bağlı Instagram hesabı yoksa FACEBOOK_IG_LINK_MISSING döner (gerçek eksik ilişki)", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Safira",
      pageName: "Villa Safira",
      storedInstagramAccountId: "17800000000000001",
      scopesResult: { ok: true, scopes: GRANTED_SCOPES },
      scopeGrantedElsewhere: true,
      relationResult: { ok: true, instagramBusinessAccount: null, connectedInstagramAccount: null },
    });
    expect(result.code).toBe("FACEBOOK_IG_LINK_MISSING");
    expect(result.healthy).toBe(false);
    expect(result.status).toBe("missing");
    expect(result.label).toContain("bağlı Instagram profesyonel hesabı görünmüyor");
  });

  it("izin mevcut ama bağlı Instagram hesabı kayıtlı hesapla eşleşmiyorsa FACEBOOK_IG_LINK_MISMATCH döner", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Destan",
      pageName: "Villa Destan",
      storedInstagramAccountId: "17800000000000002",
      scopesResult: { ok: true, scopes: GRANTED_SCOPES },
      scopeGrantedElsewhere: true,
      relationResult: {
        ok: true,
        instagramBusinessAccount: { id: "99900000000000009", username: "baskahesap" },
        connectedInstagramAccount: null,
      },
    });
    expect(result.code).toBe("FACEBOOK_IG_LINK_MISMATCH");
    expect(result.healthy).toBe(false);
    expect(result.status).toBe("mismatch");
    expect(result.label).toContain("baskahesap");
  });

  it("instagram_basic izni yoksa ve başka hiçbir villa tokenında da yoksa FACEBOOK_IG_SCOPE_UNAVAILABLE döner (Meta yapılandırma boşluğu) ve yanlış 'bağlı değil' sonucu üretmez", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Safira",
      pageName: "Villa Safira",
      storedInstagramAccountId: "17800000000000001",
      scopesResult: { ok: true, scopes: SCOPES_WITHOUT_RELATIONSHIP_PERMISSION },
      scopeGrantedElsewhere: false,
      relationResult: { ok: false },
    });
    expect(result.code).toBe("FACEBOOK_IG_SCOPE_UNAVAILABLE");
    expect(result.healthy).toBeNull();
    expect(result.status).toBe("unavailable");
    expect(result.label).toContain(FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL);
    expect(result.label).toContain("Meta App Dashboard");
  });

  it("instagram_basic bu tokende yok ama başka bir villa tokeninde varsa FACEBOOK_IG_PERMISSION_MISSING döner (yeniden bağlanma yeterli)", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Destan",
      pageName: "Villa Destan",
      storedInstagramAccountId: "17800000000000002",
      scopesResult: { ok: true, scopes: SCOPES_WITHOUT_RELATIONSHIP_PERMISSION },
      scopeGrantedElsewhere: true,
      relationResult: { ok: false },
    });
    expect(result.code).toBe("FACEBOOK_IG_PERMISSION_MISSING");
    expect(result.healthy).toBeNull();
    expect(result.status).toBe("unavailable");
    expect(result.label).toContain(FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL);
    expect(result.label).toContain("yeniden kurarak");
  });

  it("token izin bilgisi (debug_token) okunamazsa FACEBOOK_IG_API_ERROR döner, 'bağlı değil' iddia etmez", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Safira",
      pageName: "Villa Safira",
      storedInstagramAccountId: "17800000000000001",
      scopesResult: { ok: false },
      scopeGrantedElsewhere: false,
      relationResult: { ok: false },
    });
    expect(result.code).toBe("FACEBOOK_IG_API_ERROR");
    expect(result.healthy).toBeNull();
    expect(result.status).toBe("unavailable");
    expect(result.label).toContain(FACEBOOK_IG_PERMISSION_UNCERTAIN_LABEL);
  });

  it("izin mevcut ama ilişki alanları sorgusu Graph API hatası verirse FACEBOOK_IG_API_ERROR döner", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Safira",
      pageName: "Villa Safira",
      storedInstagramAccountId: "17800000000000001",
      scopesResult: { ok: true, scopes: GRANTED_SCOPES },
      scopeGrantedElsewhere: true,
      relationResult: { ok: false },
    });
    expect(result.code).toBe("FACEBOOK_IG_API_ERROR");
    expect(result.healthy).toBeNull();
    expect(result.status).toBe("unavailable");
  });

  it("connected_instagram_account alanı üzerinden de eşleşme kabul eder", () => {
    const result = classifyFacebookInstagramRelationship({
      villa: "Safira",
      pageName: "Villa Safira",
      storedInstagramAccountId: "17800000000000001",
      scopesResult: { ok: true, scopes: GRANTED_SCOPES },
      scopeGrantedElsewhere: true,
      relationResult: {
        ok: true,
        instagramBusinessAccount: null,
        connectedInstagramAccount: { id: "17800000000000001", username: "villasafirapatara" },
      },
    });
    expect(result.code).toBe("FACEBOOK_IG_LINK_OK");
    expect(result.healthy).toBe(true);
  });
});

describe("legacyRelationshipStatus", () => {
  it("her yeni kodu geriye dönük durum sözlüğüne doğru eşler", () => {
    expect(legacyRelationshipStatus("FACEBOOK_IG_LINK_OK")).toBe("healthy");
    expect(legacyRelationshipStatus("FACEBOOK_IG_LINK_MISSING")).toBe("missing");
    expect(legacyRelationshipStatus("FACEBOOK_IG_LINK_MISMATCH")).toBe("mismatch");
    expect(legacyRelationshipStatus("FACEBOOK_IG_PERMISSION_MISSING")).toBe("unavailable");
    expect(legacyRelationshipStatus("FACEBOOK_IG_SCOPE_UNAVAILABLE")).toBe("unavailable");
    expect(legacyRelationshipStatus("FACEBOOK_IG_API_ERROR")).toBe("unavailable");
  });
});
