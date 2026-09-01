"use client";

import { useState } from "react";
import type { OtaConnectionStatus, OtaPlatform, OtaSyncHealth } from "@/lib/ota/types";
import type { Villa } from "@/lib/types";

const PLATFORM_LABEL: Record<OtaPlatform, string> = { airbnb: "AIRBNB", booking: "BOOKING.COM" };
const HEALTH_LABEL: Record<OtaSyncHealth, string> = {
  green: "Senkronizasyon güncel",
  yellow: "Gecikme var",
  red: "Takvim bağlantısı güncellenemiyor",
  pending: "Takvim bağlantısı bekleniyor",
};
const HEALTH_COLOR: Record<OtaSyncHealth, string> = { green: "#22c55e", yellow: "#f59e0b", red: "#ef4444", pending: "#6b7280" };

function formatTime(value: string | null) {
  if (!value) return "Hiç";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

interface VerifyPreview {
  eventCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  conflictCount: number;
}

interface ConnectFormState {
  open: boolean;
  url: string;
  verifying: boolean;
  saving: boolean;
  preview: VerifyPreview | null;
  error: string;
}

const EMPTY_FORM: ConnectFormState = { open: false, url: "", verifying: false, saving: false, preview: null, error: "" };

export default function OtaIntegrationsPanel({
  initialConnections,
  initialHubActivated,
  initialHubReasons,
}: {
  initialConnections: OtaConnectionStatus[];
  initialHubActivated: boolean;
  initialHubReasons: string[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [forms, setForms] = useState<Record<string, ConnectFormState>>({});
  const [hubActivated, setHubActivated] = useState(initialHubActivated);
  const [hubReasons, setHubReasons] = useState(initialHubReasons);
  const [hubBusy, setHubBusy] = useState(false);

  function formFor(key: string): ConnectFormState {
    return forms[key] ?? EMPTY_FORM;
  }
  function setForm(key: string, patch: Partial<ConnectFormState>) {
    setForms((current) => ({ ...current, [key]: { ...formFor(key), ...patch } }));
  }

  async function refresh() {
    const [connRes, hubRes] = await Promise.all([fetch("/api/ota/connections"), fetch("/api/ota/hub/status")]);
    const connData = await connRes.json().catch(() => null);
    const hubData = await hubRes.json().catch(() => null);
    if (connData?.connections) setConnections(connData.connections);
    if (hubData) {
      setHubActivated(Boolean(hubData.activated));
      setHubReasons(hubData.reasons ?? []);
    }
  }

  async function syncNow(villa: Villa, platform: OtaPlatform) {
    const key = `${villa}:${platform}`;
    setBusyKey(key);
    setNotice("");
    try {
      const response = await fetch("/api/ota/connections/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa, platform }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Senkronizasyon başarısız.");
      setNotice(`✓ ${villa} · ${PLATFORM_LABEL[platform]}: ${data.count ?? 0} etkinlik senkronize edildi.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Senkronizasyon başarısız.");
    } finally {
      setBusyKey(null);
    }
  }

  async function revealFeed(villa: Villa, platform: OtaPlatform) {
    const key = `${villa}:${platform}`;
    setBusyKey(`reveal:${key}`);
    try {
      const response = await fetch(`/api/ota/export-feed?villa=${encodeURIComponent(villa)}&platform=${platform}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Feed URL'si alınamadı.");
      setRevealed((current) => ({ ...current, [key]: data.feedUrl }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Feed URL'si alınamadı.");
    } finally {
      setBusyKey(null);
    }
  }

  async function verifyUrl(villa: Villa, platform: OtaPlatform) {
    const key = `${villa}:${platform}`;
    const form = formFor(key);
    if (!form.url.trim()) return;
    setForm(key, { verifying: true, error: "", preview: null });
    try {
      const response = await fetch("/api/ota/connections/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa, platform, icsUrl: form.url.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        const stageNote = data.stage ? ` (aşama: ${data.stage})` : "";
        throw new Error(`${data.message ?? "Doğrulama başarısız."}${stageNote}`);
      }
      setForm(key, {
        verifying: false,
        preview: { eventCount: data.eventCount, earliestDate: data.earliestDate, latestDate: data.latestDate, conflictCount: data.conflictCount },
      });
    } catch (error) {
      setForm(key, { verifying: false, error: error instanceof Error ? error.message : "Doğrulama başarısız." });
    }
  }

  async function saveConnection(villa: Villa, platform: OtaPlatform) {
    const key = `${villa}:${platform}`;
    const form = formFor(key);
    if (!form.preview) return;
    setForm(key, { saving: true, error: "" });
    try {
      const response = await fetch("/api/ota/connections/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa, platform, icsUrl: form.url.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.connected) throw new Error(data.error ?? "Bağlantı kaydedilemedi.");
      setForms((current) => ({ ...current, [key]: EMPTY_FORM }));
      setNotice(`✓ ${villa} · ${PLATFORM_LABEL[platform]} bağlandı - ${data.eventCount ?? 0} takvim bloğu, ${data.conflictCount ?? 0} çakışma.`);
      await refresh();
    } catch (error) {
      setForm(key, { saving: false, error: error instanceof Error ? error.message : "Bağlantı kaydedilemedi." });
    }
  }

  async function disconnect(villa: Villa, platform: OtaPlatform) {
    const key = `${villa}:${platform}`;
    if (!window.confirm(`${villa} · ${PLATFORM_LABEL[platform]} takvim bağlantısı kaldırılsın mı? Bu, o kaynaktan gelen tüm blokları da kaldırır.`)) return;
    setBusyKey(`disconnect:${key}`);
    setNotice("");
    try {
      const response = await fetch("/api/ota/connections/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa, platform }),
      });
      if (!response.ok) throw new Error("Bağlantı kaldırılamadı.");
      setNotice(`✓ ${villa} · ${PLATFORM_LABEL[platform]} bağlantısı kaldırıldı.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Bağlantı kaldırılamadı.");
    } finally {
      setBusyKey(null);
    }
  }

  async function activateHubNow() {
    if (!window.confirm("Merkezi takvimi devreye almayı onaylıyor musunuz? Bu, eski Airbnb<->Booking bağlantılarını KALDIRMAZ - onları platform arayüzlerinden siz kontrollü olarak kaldıracaksınız.")) return;
    setHubBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/ota/hub/activate", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.activated) throw new Error("Henüz hazır değil - tüm bağlantılar temiz olmalı.");
      setHubActivated(true);
      setHubReasons([]);
      setNotice("✓ Merkezi takvim devreye alındı.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Aktivasyon başarısız.");
    } finally {
      setHubBusy(false);
    }
  }

  const platforms: OtaPlatform[] = ["airbnb", "booking"];

  return (
    <section style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px" }}>
      <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
        <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>ENTEGRASYONLAR</small>
        <h2 style={{ margin: "5px 0 4px", fontSize: 18 }}>Airbnb + Booking.com takvim senkronu</h2>
        <p style={{ margin: 0, color: "#9fb0c5", fontSize: 11 }}>
          Faz 1: yalnız müsaitlik/tarih senkronu. Gizli takvim bağlantıları yalnız bu ekrandan, bir kez girilir - sonrasında hiçbir yerde gösterilmez.
        </p>

        {notice ? (
          <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 10, border: "1px solid #2e5075", background: "#0b1b2e", color: "#bfdbfe", fontSize: 10 }}>
            {notice}
          </div>
        ) : null}

        <div style={{ marginTop: 14, padding: "12px 14px", border: `1px solid ${hubActivated ? "#1f5f3b" : "#334b69"}`, borderRadius: 11, background: hubActivated ? "#071b16" : "#0b1728" }}>
          {hubActivated ? (
            <div style={{ color: "#86efac", fontSize: 11, fontWeight: 800 }}>✓ Merkezi takvim devrede. Eski Airbnb↔Booking bağlantılarını artık kendi platform arayüzlerinizden kontrollü olarak kaldırabilirsiniz.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong style={{ fontSize: 11 }}>Merkezi Takvimi Devreye Al</strong>
                  <p style={{ margin: "3px 0 0", fontSize: 9, color: "#8fa4bd" }}>Dört bağlantının tamamı temiz olmadan aktif edilemez. Eski bağlantıları otomatik kaldırmaz.</p>
                </div>
                <button
                  type="button"
                  onClick={activateHubNow}
                  disabled={hubReasons.length > 0 || hubBusy}
                  style={{ border: "1px solid #47617f", borderRadius: 8, padding: "8px 14px", background: hubReasons.length > 0 ? "#1a2534" : "#123522", color: hubReasons.length > 0 ? "#5f7386" : "#86efac", fontSize: 10, fontWeight: 900, cursor: hubReasons.length > 0 ? "not-allowed" : "pointer" }}
                >
                  {hubBusy ? "İşleniyor…" : "Merkezi Takvimi Devreye Al"}
                </button>
              </div>
              {hubReasons.length > 0 ? (
                <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 9, color: "#fbbf24" }}>
                  {hubReasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              ) : null}
            </>
          )}
        </div>

        {platforms.map((platform) => (
          <div key={platform} style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #203954" }}>
            <strong style={{ fontSize: 11, letterSpacing: 1, color: "#93c5fd" }}>{PLATFORM_LABEL[platform]}</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {connections.filter((c) => c.platform === platform).map((connection) => {
                const key = `${connection.villa}:${connection.platform}`;
                const busy = busyKey === key;
                const revealBusy = busyKey === `reveal:${key}`;
                const disconnectBusy = busyKey === `disconnect:${key}`;
                const form = formFor(key);
                return (
                  <article key={key} style={{ padding: "12px 14px", border: `1px solid ${connection.conflictCount > 0 ? "#a16207" : "#223a57"}`, borderRadius: 11, background: "#0b1728" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ fontSize: 12 }}>Villa {connection.villa}</strong>
                        <span style={{ marginLeft: 8, padding: "3px 8px", borderRadius: 999, fontSize: 9, fontWeight: 900, background: connection.connected ? "#123522" : "#2a2a2a", color: connection.connected ? "#86efac" : "#c8c8c8" }}>
                          {connection.connected ? "Bağlı" : "Takvim bağlantısı bekleniyor"}
                        </span>
                        <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 800, color: "#9fb0c5" }}>
                          <i style={{ width: 8, height: 8, borderRadius: "50%", background: HEALTH_COLOR[connection.health], display: "inline-block" }} />
                          {HEALTH_LABEL[connection.health]}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {connection.connected ? (
                          <>
                            <button
                              type="button"
                              onClick={() => syncNow(connection.villa, connection.platform)}
                              disabled={busyKey !== null}
                              style={{ border: "1px solid #47617f", borderRadius: 8, padding: "6px 10px", background: "#102238", color: "#dbeafe", fontSize: 9, fontWeight: 800, cursor: busyKey ? "wait" : "pointer" }}
                            >
                              {busy ? "Senkronize ediliyor…" : "Şimdi Senkronize Et"}
                            </button>
                            <button
                              type="button"
                              onClick={() => revealFeed(connection.villa, connection.platform)}
                              disabled={busyKey !== null}
                              style={{ border: "1px solid #47617f", borderRadius: 8, padding: "6px 10px", background: "#1a1030", color: "#e9d5ff", fontSize: 9, fontWeight: 800, cursor: busyKey ? "wait" : "pointer" }}
                            >
                              {revealBusy ? "Alınıyor…" : "Dışa Aktarım Feed URL'sini Göster"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm(key, { ...EMPTY_FORM, open: true })}
                              disabled={busyKey !== null}
                              style={{ border: "1px solid #47617f", borderRadius: 8, padding: "6px 10px", background: "#0f1f33", color: "#93c5fd", fontSize: 9, fontWeight: 800, cursor: busyKey ? "wait" : "pointer" }}
                            >
                              Bağlantıyı Değiştir
                            </button>
                            <button
                              type="button"
                              onClick={() => disconnect(connection.villa, connection.platform)}
                              disabled={busyKey !== null}
                              style={{ border: "1px solid #7f1d1d", borderRadius: 8, padding: "6px 10px", background: "#2a0f0f", color: "#fca5a5", fontSize: 9, fontWeight: 800, cursor: busyKey ? "wait" : "pointer" }}
                            >
                              {disconnectBusy ? "Kaldırılıyor…" : "Bağlantıyı Kaldır"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setForm(key, { ...EMPTY_FORM, open: !form.open })}
                            style={{ border: "1px solid #47617f", borderRadius: 8, padding: "6px 10px", background: "#102238", color: "#dbeafe", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                          >
                            {form.open ? "İptal" : "Takvim Bağla"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 10, fontSize: 10, color: "#9fb0c5" }}>
                      <div>Son başarılı: <b style={{ color: "#eef6ff" }}>{formatTime(connection.lastSuccessAt)}</b></div>
                      <div>Son deneme: <b style={{ color: "#eef6ff" }}>{formatTime(connection.lastSyncedAt)}</b></div>
                      <div>Aktif blok: <b style={{ color: "#eef6ff" }}>{connection.activeBlockCount}</b></div>
                      <div>
                        Çakışma:{" "}
                        <b style={{ color: connection.conflictCount > 0 ? "#fca5a5" : "#eef6ff" }}>{connection.conflictCount}</b>
                        {connection.conflictCount > 0 ? <span style={{ marginLeft: 6, fontSize: 9, color: "#fbbf24" }}>⚠ inceleme gerekiyor</span> : null}
                      </div>
                    </div>

                    {connection.lastError ? (
                      <div style={{ marginTop: 8, fontSize: 9, color: "#fca5a5" }}>Son hata: {connection.lastError}</div>
                    ) : null}

                    {revealed[key] ? (
                      <div style={{ marginTop: 10, padding: "8px 10px", border: "1px dashed #47617f", borderRadius: 8, fontSize: 9, color: "#dbeafe", overflowWrap: "anywhere" }}>
                        {revealed[key]}
                        <div style={{ marginTop: 4, color: "#8fa4bd" }}>Bu URL yalnız bu oturumda görünür - {PLATFORM_LABEL[platform]}&apos;in ilgili villa için &quot;Import calendar&quot; alanına yapıştırın.</div>
                      </div>
                    ) : null}

                    {form.open ? (
                      <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid #334b69", borderRadius: 9, background: "#081522" }}>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 800, color: "#93c5fd", marginBottom: 6 }}>
                          {PLATFORM_LABEL[platform]} gizli takvim (.ics) bağlantısı
                        </label>
                        <input
                          type="url"
                          autoComplete="off"
                          value={form.url}
                          onChange={(event) => setForm(key, { url: event.target.value, preview: null, error: "" })}
                          placeholder="https://..."
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #334b69", background: "#0b1728", color: "#eef6ff", fontSize: 10, boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button
                            type="button"
                            onClick={() => verifyUrl(connection.villa, connection.platform)}
                            disabled={!form.url.trim() || form.verifying || form.saving}
                            style={{ border: "1px solid #47617f", borderRadius: 7, padding: "6px 10px", background: "#102238", color: "#dbeafe", fontSize: 9, fontWeight: 800, cursor: "pointer" }}
                          >
                            {form.verifying ? "Doğrulanıyor…" : "Bağlantıyı Doğrula"}
                          </button>
                          <button
                            type="button"
                            onClick={() => saveConnection(connection.villa, connection.platform)}
                            disabled={!form.preview || form.saving}
                            style={{ border: "1px solid #1f5f3b", borderRadius: 7, padding: "6px 10px", background: form.preview ? "#123522" : "#1a2534", color: form.preview ? "#86efac" : "#5f7386", fontSize: 9, fontWeight: 800, cursor: form.preview ? "pointer" : "not-allowed" }}
                          >
                            {form.saving ? "Kaydediliyor…" : "Kaydet ve Etkinleştir"}
                          </button>
                        </div>
                        {form.error ? <div style={{ marginTop: 8, fontSize: 9, color: "#fca5a5" }}>{form.error}</div> : null}
                        {form.preview ? (
                          <div style={{ marginTop: 8, fontSize: 9, color: "#a7f3d0" }}>
                            ✓ {form.preview.eventCount} takvim bloğu bulundu
                            {form.preview.earliestDate ? ` (${form.preview.earliestDate} – ${form.preview.latestDate})` : ""}.{" "}
                            {form.preview.conflictCount > 0 ? <span style={{ color: "#fbbf24" }}>⚠ {form.preview.conflictCount} çakışma</span> : "0 çakışma."}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
