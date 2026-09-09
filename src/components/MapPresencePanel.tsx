"use client";

import { useState } from "react";
import type { MapPresenceEntry, MapPlatform, MapPresenceStatus } from "@/lib/map-presence";
import { MAP_PRESENCE_STATUSES } from "@/lib/map-presence";
import type { Villa } from "@/lib/types";

const PLATFORM_LABELS: Record<MapPlatform, string> = {
  GOOGLE: "Google Maps",
  APPLE: "Apple Maps",
  YANDEX: "Yandex Maps",
  HERE: "HERE",
  TOMTOM: "TomTom",
  OPENSTREETMAP: "OpenStreetMap",
  GARMIN: "Garmin",
};

const STATUS_COLORS: Record<MapPresenceStatus, string> = {
  NOT_CHECKED: "#8fa4bd",
  EXISTS_CORRECT: "#86efac",
  NEEDS_CORRECTION: "#fbbf24",
  CLAIM_STARTED: "#93c5fd",
  ADDITION_SUBMITTED: "#93c5fd",
  AWAITING_VERIFICATION: "#fbbf24",
  VERIFIED: "#86efac",
  BLOCKED: "#fca5a5",
};

export default function MapPresencePanel({ initialEntries }: { initialEntries: MapPresenceEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function updateEntry(villa: Villa, platform: MapPlatform, status: MapPresenceStatus, note: string) {
    const key = `${villa}:${platform}`;
    setBusyKey(key);
    try {
      const response = await fetch("/api/admin/map-presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa, platform, status, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setEntries((current) => current.map((e) => (e.villa === villa && e.platform === platform ? data.entry : e)));
      }
    } finally {
      setBusyKey(null);
    }
  }

  const villas: Villa[] = ["Safira", "Destan"];

  return (
    <section style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px" }}>
      <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
        <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>HARİTA GÖRÜNÜRLÜĞÜ</small>
        <h2 style={{ margin: "5px 0 4px", fontSize: 18 }}>Harita platformu takibi</h2>
        <p style={{ margin: 0, color: "#9fb0c5", fontSize: 11 }}>Yalnız durum/iş akışı izlenir - hiçbir dış harita servisine otomatik başvuru gönderilmez. Gerçek başvuru resmi kanaldan (tarayıcı/giriş gerektirir) elle yapılır.</p>

        {villas.map((villa) => (
          <div key={villa} style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 12, color: "#dbeafe" }}>Villa {villa}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8, marginTop: 8 }}>
              {entries.filter((e) => e.villa === villa).map((entry) => {
                const key = `${entry.villa}:${entry.platform}`;
                return (
                  <div key={key} style={{ padding: "9px 10px", border: "1px solid #223a57", borderRadius: 10, background: "#0b1728" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 10, color: "#dbeafe" }}>{PLATFORM_LABELS[entry.platform]}</strong>
                      <span style={{ fontSize: 9, fontWeight: 900, color: STATUS_COLORS[entry.status] }}>{entry.status}</span>
                    </div>
                    <select
                      value={entry.status}
                      disabled={busyKey === key}
                      onChange={(e) => updateEntry(entry.villa, entry.platform, e.target.value as MapPresenceStatus, entry.note)}
                      style={{ marginTop: 6, width: "100%", padding: "5px 6px", borderRadius: 6, background: "#0f172a", color: "#eef6ff", border: "1px solid #334155", fontSize: 9 }}
                    >
                      {MAP_PRESENCE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    {entry.note && <p style={{ margin: "6px 0 0", fontSize: 9, color: "#8fa4bd" }}>{entry.note}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
