import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";

export function LoginScreen() {
  const { login, loginError, loggingIn } = useAuth();
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await login(password);
    } catch {
      // loginError zaten context'te tutuluyor.
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100%", padding: "24px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: "#d5aa58", fontWeight: 900 }}>SAFİRA &amp; DESTAN</div>
        <h1 style={{ fontSize: 24, margin: "6px 0 0" }}>Villa Yönetim</h1>
        <p style={{ color: "#9fb0c5", fontSize: 12, marginTop: 8 }}>Yönetim ekibi için güvenli erişim</p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#9fb0c5" }}>
          Yönetim parolası
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 6 }}
            minLength={12}
            maxLength={256}
            required
          />
        </label>
        {loginError && <div style={{ color: "#fca5a5", fontSize: 12 }}>{loginError}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={loggingIn}>
          {loggingIn ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
      <p style={{ fontSize: 10, color: "#6b7787", textAlign: "center", marginTop: 24 }}>
        Bu uygulama yalnız Safira &amp; Destan Villas ekibi içindir.
      </p>
    </div>
  );
}
