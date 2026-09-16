import { describe, expect, it } from "vitest";
import {
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_TTL_SECONDS,
  derivePairingStatus,
  generatePairingCode,
  hashPairingCode,
  isSessionActive,
  normalizePairingCode,
  pairingExpiresAt,
  pairingSecondsRemaining,
  relativeTimeTr,
  resolvePlatform,
  toDeviceView,
  type MobileSessionRow,
} from "./mobile-pairing";

const NOW = new Date("2026-09-16T12:00:00.000Z");

function codeRow(overrides: Partial<{ expires_at: string; used_at: string | null }> = {}) {
  return {
    id: "code-1",
    created_at: "2026-09-16T11:55:00.000Z",
    expires_at: "2026-09-16T12:05:00.000Z",
    used_at: null,
    ...overrides,
  };
}

function sessionRow(overrides: Partial<MobileSessionRow> = {}): MobileSessionRow {
  return {
    id: "session-1",
    device_label: "Apple iPhone14,2",
    platform: "ios",
    app_version: "1.2.0",
    app_build: "7",
    created_at: "2026-09-16T10:00:00.000Z",
    expires_at: "2026-10-16T10:00:00.000Z",
    last_seen_at: "2026-09-16T11:30:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

describe("pairing code üretimi", () => {
  it("her zaman 6 haneli sayısal kod üretir", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generatePairingCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
    }
  });

  it("modulo bias yaratan baytları reddeder", () => {
    // 250..255 reddedilmeli; yalnız bu baytlar gelirse sonsuz döngüye girmeden
    // bir sonraki chunk'tan okumalı.
    const chunks = [
      new Uint8Array([250, 251, 252, 253, 254, 255]),
      new Uint8Array([0, 1, 2, 3, 4, 5]),
    ];
    let index = 0;
    const code = generatePairingCode(() => chunks[Math.min(index++, chunks.length - 1)]);
    expect(code).toBe("012345");
  });

  it("rakam dağılımı kabaca düzgün olur (bias regresyon testi)", () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 2000; i += 1) {
      for (const ch of generatePairingCode()) counts[Number(ch)] += 1;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const expected = total / 10;
    for (const count of counts) {
      // Her rakam beklenenin %25'i içinde kalmalı - eski `byte % 10` yaklaşımı
      // 0-5 lehine sistematik sapma üretiyordu.
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.25);
    }
  });

  it("aynı kod için kararlı, farklı kodlar için farklı hash üretir", async () => {
    const a = await hashPairingCode("123456");
    const b = await hashPairingCode("123456");
    const c = await hashPairingCode("123457");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("123456");
  });
});

describe("kod normalizasyonu", () => {
  it("boşluk ve tireleri temizler", () => {
    expect(normalizePairingCode("12 34-56")).toBe("123456");
  });

  it("yanlış uzunluk ve tipleri reddeder", () => {
    expect(normalizePairingCode("12345")).toBeNull();
    expect(normalizePairingCode("1234567")).toBeNull();
    expect(normalizePairingCode("abcdef")).toBeNull();
    expect(normalizePairingCode(123456)).toBeNull();
    expect(normalizePairingCode(null)).toBeNull();
  });
});

describe("expiration ve single-use", () => {
  it("son kullanma tarihi 10 dakika sonrasıdır", () => {
    const expires = pairingExpiresAt(NOW);
    expect(Date.parse(expires) - NOW.getTime()).toBe(PAIRING_CODE_TTL_SECONDS * 1000);
    expect(PAIRING_CODE_TTL_SECONDS).toBe(600);
  });

  it("süresi dolmamış kullanılmamış kod aktiftir", () => {
    expect(derivePairingStatus(codeRow(), NOW)).toBe("active");
  });

  it("süresi dolmuş kod expired olur", () => {
    expect(derivePairingStatus(codeRow({ expires_at: "2026-09-16T11:59:59.000Z" }), NOW)).toBe("expired");
  });

  it("kullanılmış kod süresi dolmamış olsa bile used olur (single-use)", () => {
    const row = codeRow({ used_at: "2026-09-16T11:58:00.000Z" });
    expect(derivePairingStatus(row, NOW)).toBe("used");
  });

  it("kalan süre negatif olmaz", () => {
    expect(pairingSecondsRemaining("2026-09-16T12:05:00.000Z", NOW)).toBe(300);
    expect(pairingSecondsRemaining("2026-09-16T11:00:00.000Z", NOW)).toBe(0);
  });
});

describe("platform tespiti", () => {
  it("açık payload alanını tercih eder", () => {
    expect(resolvePlatform("ios", "Mozilla/5.0 (Linux; Android 14)")).toBe("ios");
    expect(resolvePlatform("Android", null)).toBe("android");
  });

  it("payload yoksa User-Agent'tan çıkarır", () => {
    expect(resolvePlatform(undefined, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(resolvePlatform(undefined, "Mozilla/5.0 (Linux; Android 14; SM-S911B)")).toBe("android");
  });

  it("bilinmeyen değerleri null yapar", () => {
    expect(resolvePlatform("windows", "Mozilla/5.0 (Windows NT 10.0)")).toBeNull();
    expect(resolvePlatform(null, null)).toBeNull();
  });
});

describe("cihaz oturumu görünümü", () => {
  it("aktif oturumu doğru işaretler", () => {
    expect(isSessionActive(sessionRow(), NOW)).toBe(true);
  });

  it("revoke edilmiş oturum aktif değildir", () => {
    const row = sessionRow({ revoked_at: "2026-09-16T11:00:00.000Z" });
    expect(isSessionActive(row, NOW)).toBe(false);
    expect(toDeviceView(row, NOW).active).toBe(false);
  });

  it("süresi dolmuş oturum aktif değildir", () => {
    expect(isSessionActive(sessionRow({ expires_at: "2026-09-15T10:00:00.000Z" }), NOW)).toBe(false);
  });

  it("görünüm alanlarını doldurur ve token sızdırmaz", () => {
    const view = toDeviceView(sessionRow(), NOW);
    expect(view).toMatchObject({
      id: "session-1",
      deviceLabel: "Apple iPhone14,2",
      platform: "ios",
      appVersion: "1.2.0",
      appBuild: "7",
      active: true,
    });
    expect(JSON.stringify(view)).not.toContain("token");
  });

  it("etiket yoksa ve platform bilinmiyorsa güvenli varsayılan kullanır", () => {
    const view = toDeviceView(sessionRow({ device_label: "  ", platform: null }), NOW);
    expect(view.deviceLabel).toBe("İsimsiz cihaz");
    expect(view.platform).toBe("bilinmiyor");
  });
});

describe("göreli zaman metni", () => {
  it("Türkçe kısa metin üretir", () => {
    expect(relativeTimeTr(null, NOW)).toBe("hiç");
    expect(relativeTimeTr("2026-09-16T11:59:30.000Z", NOW)).toBe("az önce");
    expect(relativeTimeTr("2026-09-16T11:30:00.000Z", NOW)).toBe("30 dk önce");
    expect(relativeTimeTr("2026-09-16T09:00:00.000Z", NOW)).toBe("3 saat önce");
    expect(relativeTimeTr("2026-09-13T12:00:00.000Z", NOW)).toBe("3 gün önce");
  });
});
