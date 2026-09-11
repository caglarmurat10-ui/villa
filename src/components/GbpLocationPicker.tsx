"use client";

import { useEffect, useState } from "react";
import type { Villa } from "@/lib/types";

type GbpLocation = {
  name: string;
  title: string;
  address: string | null;
  phone: string | null;
  websiteUri: string | null;
  primaryCategory: string | null;
  hasHours: boolean;
};

type DiscoveryState = "WAITING_API_ACCESS" | "ACCESS_DENIED" | "RATE_LIMITED" | "WAITING_OWNER_ACCESS" | "NO_LOCATIONS" | "READY_READ_ONLY";

type DiscoveryResponse = {
  discovery: { state: DiscoveryState; accounts: Array<{ accountName: string }>; locations: GbpLocation[]; error: string | null };
  mappings: Record<Villa, { locationName: string; locationTitle: string; selectedAt: string } | null>;
};

const STATE_LABEL: Record<DiscoveryState, string> = {
  WAITING_API_ACCESS: "Henüz bağlı değil — önce yukarıdan GBP'ye bağlanın",
  ACCESS_DENIED: "Erişim reddedildi — Google Cloud projesinde Business Profile API'sini ve OAuth kapsamını kontrol edin",
  RATE_LIMITED: "Google Cloud Business Profile API kota/erişim limiti — OAuth bağlantısı çalışıyor; QPM durumunu Google Cloud Console’dan kontrol edin",
  WAITING_OWNER_ACCESS: "Bağlantı başarılı ama bu Google hesabına bağlı hiçbir işletme profili yok — Safira/Destan'ın gerçek sahibi hesapla bağlanmanız gerekebilir",
  NO_LOCATIONS: "Hesap bulundu ama hiçbir location yok",
  READY_READ_ONLY: "Hazır — aşağıdan villa başına doğru location'ı seçin",
};

// Mutation YOK GBP API'sine - yalnız kendi GOOGLE_PRIVATE eşlememize (villa -> location) yazar.
// İsim benzerliğiyle otomatik eşleştirme YOK - admin her villa için listeden açıkça seçim yapar.
export default function GbpLocationPicker() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [mappings, setMappings] = useState<DiscoveryResponse["mappings"]>({ Safira: null, Destan: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<Villa | null>(null);
  const [notice, setNotice] = useState("");

  async function discover() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/google/gbp/locations", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "GBP keşfi başarısız.");
        return;
      }
      const nextData = body as DiscoveryResponse;
      setData(nextData);
      setMappings(nextData.mappings);
    } catch {
      setError("GBP keşfine ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  // Sayfa yüklenirken yalnız kendi kalıcı villa→location eşlememizi okuruz. Google GBP API
  // probe'u artık otomatik değildir; böylece /sosyal refresh'leri accounts.list kotasını tüketmez.
  // Gerçek GBP keşfi yalnız kullanıcının "Keşfet" düğmesine açıkça basmasıyla yapılır.
  useEffect(() => {
    queueMicrotask(() => {
      void fetch("/api/admin/google/gbp/locations?mappingsOnly=1", { cache: "no-store" })
        .then(async (response) => response.ok ? await response.json() : null)
        .then((body: { mappings?: DiscoveryResponse["mappings"] } | null) => {
          if (body?.mappings) setMappings(body.mappings);
        })
        .catch(() => undefined);
    });
  }, []);

  async function selectLocation(villa: Villa, locationName: string) {
    if (!locationName) return;
    setSaving(villa);
    setNotice("");
    try {
      const response = await fetch("/api/admin/google/gbp/select-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa, locationName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.persisted) {
        // persisted:true olmadan ASLA "kaydedildi" denmez - read-back doğrulaması başarısız
        // olduysa (bkz. select-location/route.ts) burası da başarı gibi GÖRÜNMEZ.
        setNotice(body.error ?? "Location kaydedilemedi - lütfen tekrar deneyin.");
        return;
      }
      // discover() ayrıca KV'den taze bir read-back yapar (getAllGbpLocationMappings) - bu satırın
      // kendisi zaten route'un kendi read-back'inden geçti, discover() ise BAĞIMSIZ bir ikinci
      // doğrulama (farklı bir request/round-trip) sağlıyor.
      await discover();
      setNotice(`Villa ${villa} → ${body.locationTitle} olarak kaydedildi. Kalıcı kayıt doğrulandı.`);
    } catch {
      setNotice("Bağlantı hatası.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={discover}
        disabled={loading}
        style={{ padding: "8px 12px", border: "1px solid #47617f", borderRadius: 8, background: "#102238", color: "#dbeafe", fontSize: 10, fontWeight: 800, cursor: loading ? "wait" : "pointer" }}
      >
        {loading ? "Keşfediliyor…" : "GBP Hesap/Location Keşfet (read-only)"}
      </button>
      {error ? <p style={{ marginTop: 6, fontSize: 10, color: "#fca5a5" }}>{error}</p> : null}
      {notice ? <p style={{ marginTop: 6, fontSize: 10, color: "#bfdbfe" }}>{notice}</p> : null}

      {(mappings.Safira || mappings.Destan) ? <div style={{ marginTop: 7, display: "grid", gap: 3 }}>
        {(["Safira", "Destan"] as const).map((villa) => mappings[villa] ? <small key={villa} style={{ color: "#86efac" }}>✓ Villa {villa}: {mappings[villa]!.locationTitle}</small> : null)}
      </div> : null}

      {data ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 10, color: "#9fb0c5" }}>{STATE_LABEL[data.discovery.state]}</p>
          {data.discovery.error ? <p style={{ fontSize: 10, color: "#fca5a5" }}>{data.discovery.error}</p> : null}

          {data.discovery.state === "RATE_LIMITED" ? <div style={{ margin: "8px 0", padding: "9px 10px", border: "1px solid #a1620755", borderRadius: 9, background: "#241a06", fontSize: 10, color: "#dbeafe", lineHeight: 1.55 }}>
            <b style={{ color: "#fbbf24" }}>Google Cloud tarafında kontrol edilmesi gereken nokta</b>
            <p style={{ margin: "4px 0" }}>Google&apos;ın GBP dokümantasyonuna göre proje kotası 0 QPM ise API erişimi henüz onaylanmamıştır; 300 QPM ise standart erişim onaylıdır. 0 QPM durumunda kota artırımı değil, Basic API Access başvurusu yapılmalıdır.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="https://developers.google.com/my-business/content/prereqs" target="_blank" rel="noreferrer" style={{ color: "#93c5fd", fontWeight: 800 }}>Basic API Access gereksinimleri →</a>
              <a href="https://developers.google.com/my-business/content/limits" target="_blank" rel="noreferrer" style={{ color: "#93c5fd", fontWeight: 800 }}>GBP kota açıklaması →</a>
            </div>
          </div> : null}

          {data.discovery.state === "READY_READ_ONLY" ? (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {(["Safira", "Destan"] as const).map((villa) => {
                const currentMapping = mappings[villa];
                return (
                  <div key={villa} style={{ padding: "8px 10px", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728" }}>
                    <b style={{ fontSize: 10, color: "#dbeafe" }}>Villa {villa}</b>
                    {currentMapping ? (
                      <p style={{ margin: "4px 0", fontSize: 9, color: "#86efac" }}>
                        ✓ Seçili: {currentMapping.locationTitle}
                        <br />Kalıcı kayıt doğrulandı ({new Date(currentMapping.selectedAt).toLocaleString("tr-TR")})
                      </p>
                    ) : (
                      <p style={{ margin: "4px 0", fontSize: 9, color: "#fbbf24" }}>Henüz seçilmedi</p>
                    )}
                    <select
                      defaultValue=""
                      disabled={saving === villa}
                      onChange={(event) => selectLocation(villa, event.target.value)}
                      style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #334155", background: "#081522", color: "#e2e8f0", fontSize: 9 }}
                    >
                      <option value="">{saving === villa ? "Kaydediliyor…" : "Location seç…"}</option>
                      {data.discovery.locations.map((loc) => (
                        <option key={loc.name} value={loc.name}>
                          {loc.title}{loc.address ? ` — ${loc.address}` : ""}{loc.primaryCategory ? ` (${loc.primaryCategory})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
