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

export default function OtaIntegrationsPanel({ initialConnections }: { initialConnections: OtaConnectionStatus[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  async function refresh() {
    const response = await fetch("/api/ota/connections");
    const data = await response.json().catch(() => null);
    if (data?.connections) setConnections(data.connections);
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

  const platforms: OtaPlatform[] = ["airbnb", "booking"];

  return (
    <section style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px" }}>
      <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
        <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>ENTEGRASYONLAR</small>
        <h2 style={{ margin: "5px 0 4px", fontSize: 18 }}>Airbnb + Booking.com takvim senkronu</h2>
        <p style={{ margin: 0, color: "#9fb0c5", fontSize: 11 }}>
          Faz 1: yalnız müsaitlik/tarih senkronu. Ham takvim bağlantıları burada asla gösterilmez.
        </p>

        {notice ? (
          <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 10, border: "1px solid #2e5075", background: "#0b1b2e", color: "#bfdbfe", fontSize: 10 }}>
            {notice}
          </div>
        ) : null}

        {platforms.map((platform) => (
          <div key={platform} style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #203954" }}>
            <strong style={{ fontSize: 11, letterSpacing: 1, color: "#93c5fd" }}>{PLATFORM_LABEL[platform]}</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {connections.filter((c) => c.platform === platform).map((connection) => {
                const key = `${connection.villa}:${connection.platform}`;
                const busy = busyKey === key;
                const revealBusy = busyKey === `reveal:${key}`;
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
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => syncNow(connection.villa, connection.platform)}
                          disabled={busyKey !== null || !connection.connected}
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
