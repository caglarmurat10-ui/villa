"use client";

import { useState } from "react";
import type { MapPresenceEntry } from "@/lib/map-presence";
import type { MapPlatform, MapPresenceStatus } from "@/lib/map-presence-content";
import { MAP_PRESENCE_STATUSES, buildSubmissionPacket } from "@/lib/map-presence-content";
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

const STATUS_LABELS: Record<MapPresenceStatus, string> = {
  NOT_CHECKED: "Kontrol edilmedi",
  EXISTS_CORRECT: "Kayıtlı ve doğru",
  NEEDS_CORRECTION: "Düzeltme gerekiyor",
  VERIFY_BEFORE_EXTERNAL_UPDATE: "Göndermeden önce doğrula",
  CLAIM_STARTED: "Başvuru başlatıldı",
  ADDITION_SUBMITTED: "Ekleme gönderildi",
  AWAITING_VERIFICATION: "Doğrulama bekleniyor",
  VERIFIED: "Doğrulandı",
  BLOCKED: "Engellendi",
};

const STATUS_COLORS: Record<MapPresenceStatus, string> = {
  NOT_CHECKED: "#8fa4bd",
  EXISTS_CORRECT: "#86efac",
  NEEDS_CORRECTION: "#fbbf24",
  VERIFY_BEFORE_EXTERNAL_UPDATE: "#f97316",
  CLAIM_STARTED: "#93c5fd",
  ADDITION_SUBMITTED: "#93c5fd",
  AWAITING_VERIFICATION: "#fbbf24",
  VERIFIED: "#86efac",
  BLOCKED: "#fca5a5",
};

function PacketDetails({ villa, platform }: { villa: Villa; platform: MapPlatform }) {
  const [copied, setCopied] = useState(false);
  const packet = buildSubmissionPacket(villa, platform);

  function copyPacket() {
    const text = [
      `İşletme adı: ${packet.businessName}`,
      `Adres: ${packet.address}`,
      `Telefon: ${packet.phone}`,
      `Web sitesi: ${packet.website}`,
      `Kategori: ${packet.category}`,
    ].join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div style={{ marginTop: 8, padding: "8px 9px", border: "1px solid #1e293b", borderRadius: 8, background: "#0a1322" }}>
      {packet.addressWarning && (
        <p style={{ margin: "0 0 8px", fontSize: 9, color: "#fdba74", lineHeight: 1.5, padding: "6px 7px", border: "1px solid #7c2d12", borderRadius: 6, background: "#1c0f04" }}>
          {packet.addressWarning}
        </p>
      )}
      <dl style={{ margin: 0, fontSize: 9, color: "#b8c6d8", lineHeight: 1.7 }}>
        <div><b style={{ color: "#dbeafe" }}>İşletme adı:</b> {packet.businessName}</div>
        <div><b style={{ color: "#dbeafe" }}>Adres:</b> {packet.address}</div>
        <div><b style={{ color: "#dbeafe" }}>Telefon:</b> {packet.phone}</div>
        <div><b style={{ color: "#dbeafe" }}>Web sitesi:</b> {packet.website}</div>
        <div><b style={{ color: "#dbeafe" }}>Kategori:</b> {packet.category}</div>
      </dl>
      <p style={{ margin: "8px 0 0", fontSize: 9, color: "#8fa4bd", lineHeight: 1.5 }}>{packet.platformInfo.processSummary}</p>
      {packet.platformInfo.limitationNote && (
        <p style={{ margin: "6px 0 0", fontSize: 9, color: "#fbbf24", lineHeight: 1.5 }}>Not: {packet.platformInfo.limitationNote}</p>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" onClick={copyPacket} style={{ border: "1px solid #47617f", borderRadius: 7, padding: "5px 8px", background: "#102238", color: "#dbeafe", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
          {copied ? "Kopyalandı" : "Bilgileri kopyala"}
        </button>
        <a href={packet.platformInfo.officialUrl} target="_blank" rel="noopener noreferrer" style={{ border: "1px solid #2563eb", borderRadius: 7, padding: "5px 8px", background: "#172554", color: "#bfdbfe", fontSize: 9, fontWeight: 700, textDecoration: "none" }}>
          {packet.platformInfo.label} sayfasını aç ↗
        </a>
      </div>
    </div>
  );
}

export default function MapPresencePanel({ initialEntries }: { initialEntries: MapPresenceEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

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
        <p style={{ margin: 0, color: "#9fb0c5", fontSize: 11 }}>
          Her platform için durum takibi ve başvuruda kullanılacak hazır bilgi paketi burada. Hiçbir dış servise otomatik başvuru gönderilmez - gerçek kayıt işlemi ilgili platformun kendi sayfasından, elle yapılır.
        </p>

        {villas.map((villa) => (
          <div key={villa} style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 12, color: "#dbeafe" }}>Villa {villa}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8, marginTop: 8 }}>
              {entries.filter((e) => e.villa === villa).map((entry) => {
                const key = `${entry.villa}:${entry.platform}`;
                const isOpen = openKey === key;
                return (
                  <div key={key} style={{ padding: "9px 10px", border: "1px solid #223a57", borderRadius: 10, background: "#0b1728" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 10, color: "#dbeafe" }}>{PLATFORM_LABELS[entry.platform]}</strong>
                      <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLORS[entry.status] }}>{STATUS_LABELS[entry.status]}</span>
                    </div>
                    <select
                      value={entry.status}
                      disabled={busyKey === key}
                      onChange={(e) => updateEntry(entry.villa, entry.platform, e.target.value as MapPresenceStatus, entry.note)}
                      style={{ marginTop: 6, width: "100%", padding: "5px 6px", borderRadius: 6, background: "#0f172a", color: "#eef6ff", border: "1px solid #334155", fontSize: 9 }}
                    >
                      {MAP_PRESENCE_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                    </select>
                    {entry.note && <p style={{ margin: "6px 0 0", fontSize: 9, color: "#8fa4bd" }}>{entry.note}</p>}
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : key)}
                      style={{ marginTop: 6, background: "none", border: "none", padding: 0, color: "#93c5fd", fontSize: 9, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                    >
                      {isOpen ? "Başvuru paketini gizle" : "Başvuru paketini gör"}
                    </button>
                    {isOpen && <PacketDetails villa={entry.villa} platform={entry.platform} />}
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
