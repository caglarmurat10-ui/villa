import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";

export function PairDeviceScreen() {
  const { pairDevice, pairError, pairing } = useAuth();
  const [code, setCode] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await pairDevice(code);
    } catch {
      // pairError zaten context'te tutuluyor.
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100%", padding: "24px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: "#d5aa58", fontWeight: 900 }}>SAFİRA &amp; DESTAN</div>
        <h1 style={{ fontSize: 24, margin: "6px 0 0" }}>Villa Yönetim</h1>
        <p style={{ color: "#9fb0c5", fontSize: 12, marginTop: 8 }}>Bu cihazı yetkilendirin</p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9fb0c5" }}>
          Cihaz Eşleştirme Kodu
          <input
            className="input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6 haneli kod"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ marginTop: 6, fontSize: 22, letterSpacing: 6, textAlign: "center" }}
            maxLength={6}
            required
          />
        </label>
        {pairError && <div style={{ color: "#fca5a5", fontSize: 12 }}>{pairError}</div>}
        <button className="btn btn-primary btn-block btn-hero" type="submit" disabled={pairing || code.length !== 6}>
          {pairing ? "Eşleştiriliyor…" : "Cihazı Yetkilendir"}
        </button>
      </form>
      <p style={{ fontSize: 10, color: "#6b7787", textAlign: "center", marginTop: 24 }}>
        Kodu Villa Yönetim yönetim panelinden "Ayarlar → Mobil Cihaz Ekle" ile alabilirsiniz. Kod 10 dakika geçerlidir ve yalnız bir kez kullanılabilir.
      </p>
    </div>
  );
}
