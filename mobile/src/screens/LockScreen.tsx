import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export function LockScreen() {
  const { unlockWithBiometric, disableBiometricAndContinue } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    unlockWithBiometric().then((ok) => {
      if (!ok) setFailed(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100%", gap: 16, padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <h1 style={{ fontSize: 18, margin: 0 }}>Villa Yönetim kilitli</h1>
      <p style={{ color: "#9fb0c5", fontSize: 13 }}>Devam etmek için kimliğinizi doğrulayın.</p>
      <button className="btn btn-primary" onClick={() => unlockWithBiometric().then((ok) => setFailed(!ok))}>
        Tekrar Dene
      </button>
      {failed && (
        <button className="btn" onClick={disableBiometricAndContinue}>
          Biyometriyi Kapat
        </button>
      )}
    </div>
  );
}
