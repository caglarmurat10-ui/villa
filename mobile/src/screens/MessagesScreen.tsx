import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TopBar } from "../components/common";
import { normalizeWhatsAppNumber, whatsappTemplateFor } from "../lib/messageTemplates";
import { openWhatsApp } from "../lib/deeplinks";

type Villa = "Safira" | "Destan";
type MessageKind = "confirmation" | "location" | "checkout" | "review";

const BUTTONS: { kind: MessageKind; label: string }[] = [
  { kind: "confirmation", label: "Rezervasyon Onayı" },
  { kind: "location", label: "Giriş & Konum" },
  { kind: "checkout", label: "Çıkış" },
  { kind: "review", label: "Yorum İsteme" },
];

function isValidWhatsAppNumber(normalized: string): boolean {
  return /^90\d{10}$/.test(normalized);
}

export function MessagesScreen() {
  const [searchParams] = useSearchParams();
  const villaParam = searchParams.get("villa");
  const typeParam = searchParams.get("type") as MessageKind | null;

  // Numara yalnız bu ekranın state'inde tutulur - DB'ye, reservation'a, localStorage'a,
  // analytics'e veya loga hiç yazılmaz.
  const [phone, setPhone] = useState("");
  const [villa, setVilla] = useState<"" | Villa>(villaParam === "Safira" || villaParam === "Destan" ? villaParam : "");
  const [error, setError] = useState<string | null>(null);

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
  }

  return (
    <div>
      <TopBar title="Mesajlar" />
      <div className="app-content">
        <div className="section-heading" style={{ marginTop: 0 }}>WhatsApp Numarası</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="05xx xxx xx xx"
            inputMode="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null); }}
          />
          {phone && (
            <button type="button" className="btn" style={{ minHeight: 44, padding: "0 12px" }} onClick={() => { setPhone(""); setError(null); }}>
              Temizle
            </button>
          )}
        </div>

        <div className="section-heading">Villa</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["Safira", "Destan"] as const).map((v) => (
            <button key={v} type="button" className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              Villa {v}
            </button>
          ))}
        </div>

        {error && <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <div className="section-heading">Mesaj Gönder</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          {BUTTONS.map((b) => (
            <button
              key={b.kind}
              type="button"
              className="btn"
              style={{ minHeight: 52, fontSize: 13, borderColor: typeParam === b.kind ? "#d5aa58" : undefined }}
              onClick={() => send(b.kind)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "#6b7787", marginTop: 12 }}>
          WhatsApp açılır, mesaj hazır gelir — göndermek için siz onaylarsınız. Otomatik gönderim yapılmaz. Numara hiçbir yere kaydedilmez.
        </p>
      </div>
    </div>
  );
}
