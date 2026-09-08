import { describe, expect, it } from "vitest";
import {
  DESTAN_ADS_STATE,
  DESTAN_INSTAGRAM_HARD_BLOCK,
  META_ACTIVE_TARGETS,
  META_PROFILE_ACCESS,
  isMetaTargetHardBlocked,
  metaPublishGate,
} from "./social-account-policy";
import type { FacebookInstagramRelationshipClassification } from "./facebook-instagram-relationship";

describe("DESTAN_ADS / META_PROFILE_ACCESS - reklam yeterliliği organik yayından ayrı izlenir (bölüm 9)", () => {
  it("DESTAN_ADS_STATE reklam engelini bildirir - bu proje zaten Meta Ads kullanmadığı için organik yayını ETKİLEMEZ", () => {
    expect(DESTAN_ADS_STATE.state).toBe("BLOCKED_EXTERNAL_META_RESTRICTION");
    expect(DESTAN_ADS_STATE.reason.length).toBeGreaterThan(0);
  });
  it("META_PROFILE_ACCESS bilgilendirme amaçlıdır - hiçbir otomatik reconnect/retry tetiklemez (yalnız statik veri)", () => {
    expect(META_PROFILE_ACCESS.state).toBe("TEMPORARY_EXTERNAL_RESTRICTION");
    expect(META_PROFILE_ACCESS.note.length).toBeGreaterThan(0);
  });
  it("DESTAN_ADS ve DESTAN_INSTAGRAM_HARD_BLOCK bağımsız/ayrı alanlardır - biri diğerini set etmez", () => {
    // Reklam engeli ile organik yayın engeli AYNI obje/bayrak DEĞİL - iki farklı dış Meta durumu.
    expect(DESTAN_ADS_STATE).not.toBe(DESTAN_INSTAGRAM_HARD_BLOCK);
    expect("blocked" in DESTAN_ADS_STATE).toBe(false);
  });

  // Bölüm 15 test 10: "No advertising/payment dependency is required for organic operation."
  it("organik yayın kapı fonksiyonları (metaPublishGate/isMetaTargetHardBlocked) DESTAN_ADS_STATE'e hiç bağımlı değildir - reklam ödeme yöntemi eksikliği organik yayını asla etkilemez", () => {
    // SAFIRA_IG/SAFIRA_FB/DESTAN_FB tamamen sağlıklı davranır - reklam hesabının
    // PAYMENT_METHOD_MISSING/BLOCKED_EXTERNAL_META_RESTRICTION durumundan habersiz/etkilenmemiş.
    const healthyRelationship = classification("FACEBOOK_IG_LINK_OK", true);
    expect(metaPublishGate("Safira", "Instagram", healthyRelationship).blocked).toBe(false);
    expect(metaPublishGate("Safira", "Facebook", healthyRelationship).blocked).toBe(false);
    expect(metaPublishGate("Destan", "Facebook", healthyRelationship).blocked).toBe(false);
    // Reklam durumu DESTAN_ADS_STATE'in kendisi bağımsız olarak "engelli" kalabilir - bu organik
    // hedeflerin sonucunu DEĞİŞTİRMEZ (yukarıdaki üç hedef zaten hiç DESTAN_ADS_STATE okumuyor).
    expect(DESTAN_ADS_STATE.state).toBe("BLOCKED_EXTERNAL_META_RESTRICTION");
  });
});

describe("Meta aktif hedef politikası", () => {
  it("dört organik Meta hedefini aktif sayar", () => {
    expect(META_ACTIVE_TARGETS).toEqual([
      { villa: "Safira", platform: "Instagram" },
      { villa: "Safira", platform: "Facebook" },
      { villa: "Destan", platform: "Facebook" },
      { villa: "Destan", platform: "Instagram" },
    ]);
  });

  // 2026-09-08: Meta, @villadestanpatara'nın başka bir İşletme Portföyü ile ilişkili olduğunu
  // doğruladı - bu artık "geçici/OAuth eksik" değil, kalıcı bir dış sahiplik sorunu. Önceki
  // "aktivasyon doğrulandı, blok yok" varsayımı YANLIŞTI ve bu testin adı/beklentisi tersine çevrildi.
  it("Destan Instagram, doğrulanmış dış Meta sahiplik sorunu nedeniyle HARD BLOCK'tur - diğer üç hedef etkilenmez", () => {
    expect(DESTAN_INSTAGRAM_HARD_BLOCK.blocked).toBe(true);
    expect(isMetaTargetHardBlocked("Destan", "Instagram")).toBe(true);
    expect(isMetaTargetHardBlocked("Safira", "Instagram")).toBe(false);
    expect(isMetaTargetHardBlocked("Safira", "Facebook")).toBe(false);
    expect(isMetaTargetHardBlocked("Destan", "Facebook")).toBe(false);
  });
});

function classification(
  code: FacebookInstagramRelationshipClassification["code"],
  healthy: boolean | null,
): FacebookInstagramRelationshipClassification {
  return { code, status: "missing", healthy, label: `test:${code}` };
}

describe("metaPublishGate — statik DESTAN_INSTAGRAM_HARD_BLOCK (varsayılan/gerçek production durumu: true)", () => {
  it("hardBlockedOverride verilmezse GERÇEK DESTAN_INSTAGRAM_HARD_BLOCK.blocked (true) kullanılır - canlı ilişki SAĞLIKLI olsa bile bloklanır (Graph API'ye hiç gidilmez)", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_OK", true));
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("BLOCKED_EXTERNAL_META_OWNERSHIP");
  });

  it("hardBlockedOverride verilmezse relationship=null olsa bile aynı statik kod döner (canlı kontrol hiç gerekmez)", () => {
    const gate = metaPublishGate("Destan", "Instagram", null);
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("BLOCKED_EXTERNAL_META_OWNERSHIP");
  });

  it("Safira Instagram statik Destan bloğundan HİÇ etkilenmez", () => {
    const gate = metaPublishGate("Safira", "Instagram", classification("FACEBOOK_IG_LINK_OK", true));
    expect(gate.blocked).toBe(false);
  });

  it("Destan Facebook statik Destan+Instagram bloğundan HİÇ etkilenmez (yalnız Instagram platformuna özel)", () => {
    const gate = metaPublishGate("Destan", "Facebook", classification("FACEBOOK_IG_LINK_OK", true));
    expect(gate.blocked).toBe(false);
  });
});

describe("metaPublishGate — hardBlockedOverride:false (Meta sorunu elle çözüldükten SONRAKİ davranış, yalnız test için)", () => {
  it("Destan Instagram + FACEBOOK_IG_LINK_MISSING -> BLOCKED_EXTERNAL_META_OWNERSHIP (dış Meta sorunu, canlı kontrol)", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_MISSING", false), false);
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("BLOCKED_EXTERNAL_META_OWNERSHIP");
  });

  it("Destan Instagram + FACEBOOK_IG_LINK_MISMATCH -> BLOCKED_EXTERNAL_META_OWNERSHIP (dış Meta sorunu, canlı kontrol)", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_MISMATCH", false), false);
    expect(gate.blocked).toBe(true);
    expect(gate.code).toBe("BLOCKED_EXTERNAL_META_OWNERSHIP");
  });

  it("statik bayrak temizlendikten SONRA + FACEBOOK_IG_LINK_OK -> yayına izin verir", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_LINK_OK", true), false);
    expect(gate.blocked).toBe(false);
    expect(gate.code).toBe("FACEBOOK_IG_LINK_OK");
  });

  it("statik bayrak temizlendikten sonra bile canlı ilişki kontrolü hiç okunamazsa (null) fail-closed bloklar - sağlıklı OLDUĞU asla varsayılmaz", () => {
    const gate = metaPublishGate("Destan", "Instagram", null, false);
    expect(gate.blocked).toBe(true);
  });

  it("Safira Instagram için aynı LINK_MISSING kodu BLOCKED_EXTERNAL_META_OWNERSHIP'a çevrilmez (yalnız Destan+Instagram'a özel)", () => {
    const gate = metaPublishGate("Safira", "Instagram", classification("FACEBOOK_IG_LINK_MISSING", false), false);
    expect(gate.code).toBe("FACEBOOK_IG_LINK_MISSING");
    expect(gate.blocked).toBe(true);
  });

  it("Destan Facebook için aynı LINK_MISSING kodu BLOCKED_EXTERNAL_META_OWNERSHIP'a çevrilmez (yalnız Instagram platformuna özel)", () => {
    const gate = metaPublishGate("Destan", "Facebook", classification("FACEBOOK_IG_LINK_MISSING", false), false);
    expect(gate.code).toBe("FACEBOOK_IG_LINK_MISSING");
  });

  it("Destan Instagram + FACEBOOK_IG_PERMISSION_MISSING (bizim tarafımızdaki bir sorun) BLOCKED_EXTERNAL_META_OWNERSHIP'a çevrilmez", () => {
    const gate = metaPublishGate("Destan", "Instagram", classification("FACEBOOK_IG_PERMISSION_MISSING", null), false);
    expect(gate.code).toBe("FACEBOOK_IG_PERMISSION_MISSING");
    expect(gate.blocked).toBe(true);
  });
});
