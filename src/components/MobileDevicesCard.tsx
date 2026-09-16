"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { relativeTimeTr, type MobileDeviceView } from "@/lib/mobile-pairing";

type PendingCode = { createdAt: string; expiresAt: string; secondsRemaining: number; status: string };
type Notice = { kind: "idle" | "success" | "error"; message: string };

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function platformLabel(platform: MobileDeviceView["platform"]): string {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  return "Bilinmiyor";
}

export default function MobileDevicesCard() {
  const [devices, setDevices] = useState<MobileDeviceView[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>({ kind: "idle", message: "" });
  const activeCountRef = useRef<number | null>(null);

  const loadDevices = useCallback(async (options: { announcePairing?: boolean } = {}) => {
    try {
      const response = await fetch("/api/admin/mobile-devices", { cache: "no-store" });
      if (!response.ok) throw new Error("Cihaz listesi alınamadı.");
      const data = await response.json() as { devices: MobileDeviceView[]; activeCount: number };
      setDevices(data.devices);

      // Cihaz bağlanınca durum otomatik güncellensin: aktif cihaz sayısı arttıysa kod tüketilmiştir.
      const previous = activeCountRef.current;
      activeCountRef.current = data.activeCount;
      if (options.announcePairing && previous !== null && data.activeCount > previous) {
        setCode(null);
        setPending(null);
        setNotice({ kind: "success", message: "Yeni cihaz başarıyla eşleştirildi." });
      }
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Cihaz listesi alınamadı." });
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/mobile-pairing", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { pending: PendingCode | null };
      setPending(data.pending);
      setSecondsLeft(data.pending?.secondsRemaining ?? 0);
      if (!data.pending) setCode(null);
    } catch {
      // Bekleyen kod bilgisi kritik değil - sessizce geçilir.
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([loadDevices(), loadPending()]);
      setLoading(false);
    })();
  }, [loadDevices, loadPending]);

  // Geri sayım
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        const next = current - 1;
        if (next <= 0) {
          setPending(null);
          setCode(null);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pending]);

  // Kod beklerken cihaz bağlanmasını yakalamak için kısa aralıklı yoklama
  useEffect(() => {
    if (!pending) return;
    const poll = setInterval(() => { void loadDevices({ announcePairing: true }); }, 5000);
    return () => clearInterval(poll);
  }, [pending, loadDevices]);

  async function createCode() {
    setBusy(true);
    setNotice({ kind: "idle", message: "" });
    try {
      const response = await fetch("/api/admin/mobile-pairing", { method: "POST" });
      if (!response.ok) throw new Error("Kod üretilemedi.");
      const data = await response.json() as { code: string; expiresIn: number; expiresAt: string };
      setCode(data.code);
      setPending({ createdAt: new Date().toISOString(), expiresAt: data.expiresAt, secondsRemaining: data.expiresIn, status: "active" });
      setSecondsLeft(data.expiresIn);
      activeCountRef.current = devices.filter((d) => d.active).length;
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Kod üretilemedi." });
    } finally {
      setBusy(false);
    }
  }

  async function cancelCode() {
    setBusy(true);
    try {
      await fetch("/api/admin/mobile-pairing", { method: "DELETE" });
      setCode(null);
      setPending(null);
      setSecondsLeft(0);
      setNotice({ kind: "success", message: "Eşleştirme kodu iptal edildi." });
    } catch {
      setNotice({ kind: "error", message: "Kod iptal edilemedi." });
    } finally {
      setBusy(false);
    }
  }

  async function revokeDevice(device: MobileDeviceView) {
    const confirmed = window.confirm(`"${device.deviceLabel}" cihazının yetkisi kaldırılsın mı? Cihaz bir sonraki açılışta yeniden eşleştirme kodu isteyecek.`);
    if (!confirmed) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/mobile-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", id: device.id }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Yetki kaldırılamadı.");
      setNotice({ kind: "success", message: "Cihaz yetkisi kaldırıldı." });
      await loadDevices();
    } catch (error) {
      setNotice({ kind: "error", message: error instanceof Error ? error.message : "Yetki kaldırılamadı." });
    } finally {
      setBusy(false);
    }
  }

  const now = useMemo(() => new Date(), [devices]);
  const activeDevices = devices.filter((d) => d.active);
  const inactiveDevices = devices.filter((d) => !d.active);

  return (
    <section className="settings-box">
      <span className="ops-eyebrow">MOBİL</span>
      <h2>Mobil Cihazlar</h2>
      <p>
        Villa Yönetim mobil uygulamasını bir telefona kurduktan sonra, cihazı bu ekrandan ürettiğiniz
        tek kullanımlık kodla yetkilendirin. Kod 10 dakika geçerlidir ve yalnız bir kez kullanılabilir.
      </p>

      {code ? (
        <div className="mobile-pairing-code-box">
          <div className="mobile-pairing-code-label">Cihaz Eşleştirme Kodu</div>
          <div className="mobile-pairing-code" aria-label="Eşleştirme kodu">{code}</div>
          <div className="mobile-pairing-countdown">
            Kalan süre: <strong>{formatCountdown(secondsLeft)}</strong>
          </div>
          <p className="mobile-pairing-hint">
            Mobil uygulamadaki “Cihaz Eşleştirme Kodu” alanına bu 6 haneyi girin. Bu kod bir daha
            gösterilemez; kaybolursa yeni kod üretin.
          </p>
          <div className="mobile-pairing-actions">
            <button type="button" className="settings-save" onClick={createCode} disabled={busy}>
              {busy ? "İşleniyor…" : "Yeni Kod Üret"}
            </button>
            <button type="button" className="mobile-device-secondary" onClick={cancelCode} disabled={busy}>
              İptal Et
            </button>
          </div>
        </div>
      ) : pending ? (
        <div className="mobile-pairing-code-box">
          <div className="mobile-pairing-code-label">Bekleyen eşleştirme kodu var</div>
          <div className="mobile-pairing-countdown">
            Kalan süre: <strong>{formatCountdown(secondsLeft)}</strong>
          </div>
          <p className="mobile-pairing-hint">
            Güvenlik nedeniyle kod yalnız üretildiği anda gösterilir. Kodu görmediyseniz yeni kod üretin.
          </p>
          <div className="mobile-pairing-actions">
            <button type="button" className="settings-save" onClick={createCode} disabled={busy}>
              {busy ? "İşleniyor…" : "Yeni Kod Üret"}
            </button>
            <button type="button" className="mobile-device-secondary" onClick={cancelCode} disabled={busy}>
              İptal Et
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="settings-save" onClick={createCode} disabled={busy}>
          {busy ? "Kod üretiliyor…" : "Yeni Cihaz Ekle"}
        </button>
      )}

      {notice.kind !== "idle" && notice.message && (
        <div className={`settings-notice ${notice.kind}`} style={{ marginTop: 12 }}>{notice.message}</div>
      )}

      <h3 className="mobile-device-list-title">Yetkili cihazlar</h3>
      {loading ? (
        <p className="mobile-device-empty">Yükleniyor…</p>
      ) : devices.length === 0 ? (
        <p className="mobile-device-empty">Henüz eşleştirilmiş cihaz yok.</p>
      ) : (
        <ul className="mobile-device-list">
          {[...activeDevices, ...inactiveDevices].map((device) => (
            <li key={device.id} className={`mobile-device-item ${device.active ? "" : "inactive"}`}>
              <div className="mobile-device-main">
                <span className="mobile-device-name">{device.deviceLabel}</span>
                <span className={`mobile-device-badge ${device.active ? "active" : ""}`}>
                  {device.active ? "Aktif" : "Pasif"}
                </span>
              </div>
              <div className="mobile-device-meta">
                <span>{platformLabel(device.platform)}</span>
                {device.appVersion && <span>Sürüm {device.appVersion}{device.appBuild ? ` (${device.appBuild})` : ""}</span>}
                <span>Eşleştirme: {new Date(device.pairedAt).toLocaleDateString("tr-TR")}</span>
                <span>Son görülme: {relativeTimeTr(device.lastSeenAt, now)}</span>
              </div>
              {device.active && (
                <button type="button" className="mobile-device-secondary" onClick={() => revokeDevice(device)} disabled={busy}>
                  Yetkiyi Kaldır
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
