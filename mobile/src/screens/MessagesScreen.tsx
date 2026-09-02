import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TopBar } from "../components/common";
import { normalizeWhatsAppNumber, whatsappTemplateFor } from "../lib/messageTemplates";
import { openWhatsApp } from "../lib/deeplinks";
import {
  listRecentWhatsApp, rememberWhatsAppNumber, removeRecentWhatsApp, clearRecentWhatsApp,
  type RecentWhatsAppNumber,
} from "../lib/recentWhatsApp";

type Villa = "Safira" | "Destan";
type MessageKind = "confirmation" | "location" | "checkout" | "review";

const BUTTONS: { kind: MessageKind; label: string; icon: string }[] = [
  { kind: "confirmation", label: "Rezervasyon Onayı", icon: "✅" },
  { kind: "location", label: "Giriş & Konum", icon: "📍" },
  { kind: "checkout", label: "Çıkış", icon: "🧳" },
  { kind: "review", label: "Yorum İsteme", icon: "⭐" },
];

function isValidWhatsAppNumber(normalized: string): boolean {
  return /^90\d{10}$/.test(normalized);
}

function maskedLabel(number: string): string {
  const local = number.slice(2); // 90 önekini at
  if (local.length !== 10) return number;
  return `0${local.slice(0, 3)} ••• •• ${local.slice(8, 10)}`;
}

function localDisplay(number: string): string {
  const local = number.slice(2);
  return local.length === 10 ? `0${local}` : number;
}

export function MessagesScreen() {
  const [searchParams] = useSearchParams();
  const villaParam = searchParams.get("villa");
  const typeParam = searchParams.get("type") as MessageKind | null;

  // Numara yalnız bu ekranın state'inde tutulur - DB'ye, reservation'a, localStorage'a,
  // analytics'e veya loga hiç yazılmaz. Yalnız "son kullanılanlar" cihazın güvenli
  // depolamasında (Keystore/Keychain) tutulur - bkz. lib/recentWhatsApp.ts.
  const [phone, setPhone] = useState("");
  const [villa, setVilla] = useState<"" | Villa>(villaParam === "Safira" || villaParam === "Destan" ? villaParam : "");
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentWhatsAppNumber[]>([]);
  const [showAllRecent, setShowAllRecent] = useState(false);

  useEffect(() => { listRecentWhatsApp().then(setRecent); }, []);

  function pickRecent(entry: RecentWhatsAppNumber) {
    setPhone(localDisplay(entry.number));
    setError(null);
  }

  async function deleteRecent(number: string) {
    await removeRecentWhatsApp(number);
    setRecent(await listRecentWhatsApp());
  }

  async function clearAllRecent() {
    if (!confirm("Kayıtlı tüm numaraları silmek istediğinize emin misiniz?")) return;
    await clearRecentWhatsApp();
    setRecent([]);
  }

  async function send(kind: MessageKind) {
    setError(null);
    if (!villa) {
      setError("Önce villa seçin.");
      return;
    }
    const normalized = normalizeWhatsAppNumber(phone);
    if (!isValidWhatsAppNumber(normalized)) {
      setError("Geçerli bir WhatsApp numarası girin.");
      return;
    }
    const message = whatsappTemplateFor(kind, { villa });
    await openWhatsApp(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`);
    await rememberWhatsAppNumber(normalized, phone.trim());
    setRecent(await listRecentWhatsApp());
  }

  const shown = showAllRecent ? recent : recent.slice(0, 5);

  return (
    <div>
      <TopBar title="Mesajlar" />
      <div className="app-content">
        <div className="hero" style={{ marginBottom: 4 }}>
          <div className="hero-eyebrow" style={{ fontSize: 19 }}>WhatsApp Mesajı</div>
        </div>

        <input
          className="input"
          style={{ fontSize: 17, marginTop: 8 }}
          placeholder="05xx xxx xx xx"
          inputMode="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError(null); }}
        />

        {recent.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#9fb0c5", marginBottom: 6 }}>SON KULLANILANLAR</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {shown.map((entry) => (
                <div key={entry.number} style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #223a57", borderRadius: 999, padding: "6px 6px 6px 12px", background: "#0b1728" }}>
                  <button type="button" onClick={() => pickRecent(entry)} style={{ background: "none", border: "none", color: "#eef6ff", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                    {entry.label ? `${entry.label} · ` : ""}{maskedLabel(entry.number)}
                  </button>
                  <button type="button" onClick={() => deleteRecent(entry.number)} aria-label="Sil" style={{ background: "none", border: "none", color: "#6b7787", fontSize: 14, cursor: "pointer", padding: "0 4px" }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              {recent.length > 5 && (
                <button type="button" onClick={() => setShowAllRecent((s) => !s)} style={{ background: "none", border: "none", color: "#93c5fd", fontSize: 11, cursor: "pointer", padding: 0 }}>
                  {showAllRecent ? "Daha az göster" : `Diğerleri (${recent.length - 5})`}
                </button>
              )}
              <button type="button" onClick={clearAllRecent} style={{ background: "none", border: "none", color: "#6b7787", fontSize: 11, cursor: "pointer", padding: 0 }}>Tümünü temizle</button>
            </div>
          </div>
        )}

        <div className="section-heading">Villa</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          {(["Safira", "Destan"] as const).map((v) => (
            <button key={v} type="button" className="btn" style={{ flex: 1, minHeight: 48, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              Villa {v}
            </button>
          ))}
        </div>

        {error && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 10 }}>{error}</div>}

        <div className="section-heading">Mesaj Gönder</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          {BUTTONS.map((b) => (
            <button
              key={b.kind}
              type="button"
              className="card"
              style={{ minHeight: 76, fontSize: 13, fontWeight: 800, textAlign: "center", cursor: "pointer", borderColor: typeParam === b.kind ? "#d5aa58" : undefined, marginBottom: 0 }}
              onClick={() => send(b.kind)}
            >
              <div style={{ fontSize: 22 }}>{b.icon}</div>
              <div style={{ marginTop: 6 }}>{b.label}</div>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "#6b7787", marginTop: 14 }}>
          WhatsApp açılır, mesaj hazır gelir — göndermek için siz onaylarsınız. Otomatik gönderim yapılmaz. Numara yalnız bu cihazda güvenli şekilde saklanır, sunucuya hiç gönderilmez.
        </p>
      </div>
    </div>
  );
}
