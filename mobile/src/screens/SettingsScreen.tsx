import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { TopBar } from "../components/common";
import { useAuth } from "../auth/AuthContext";
import { checkBackendHealth } from "../api/client";
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled } from "../lib/biometric";
import { checkForAppUpdate, openAppUpdate, type UpdateInfo } from "../lib/appUpdate";

export function SettingsScreen() {
  const { logout } = useAuth();
  const [appVersion, setAppVersion] = useState("-");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricOn, setBiometricOn] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);

  useEffect(() => {
    App.getInfo().then((info) => setAppVersion(`${info.version} (${info.build})`)).catch(() => setAppVersion("-"));
    checkBackendHealth().then(setBackendOk);
    isBiometricAvailable().then(setBiometricAvailable);
    isBiometricEnabled().then(setBiometricOn);
    checkForAppUpdate().then(setUpdateInfo);
  }, []);

  async function toggleBiometric() {
    const next = !biometricOn;
    await setBiometricEnabled(next);
    setBiometricOn(next);
  }

  async function refreshUpdate() {
    setUpdateChecking(true);
    try {
      setUpdateInfo(await checkForAppUpdate());
    } finally {
      setUpdateChecking(false);
    }
  }

  async function installUpdate() {
    if (updateInfo?.latest.url) await openAppUpdate(updateInfo.latest.url);
  }

  const updateText = updateChecking
    ? "Kontrol ediliyor…"
    : !updateInfo
      ? "Güncelleme bilgisi alınamadı."
      : updateInfo.updateAvailable
        ? `Yeni sürüm: ${updateInfo.latest.version} (${updateInfo.latest.build})`
        : "Uygulama güncel.";

  return (
    <div>
      <TopBar title="Ayarlar" />
      <div className="app-content">
        <div className="card">
          <div className="card-title">Uygulama Sürümü</div>
          <p style={{ margin: "8px 0 0" }}>Villa Yönetim {appVersion}</p>
        </div>
        <div className="card">
          <div className="card-title">Güncelleme</div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#9fb0c5" }}>{updateText}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={refreshUpdate} disabled={updateChecking}>Kontrol Et</button>
            {updateInfo?.updateAvailable && updateInfo.canOpenUpdate && (
              <button className="btn" onClick={installUpdate}>Güncelle</button>
            )}
          </div>
          {updateInfo?.updateAvailable && !updateInfo.canOpenUpdate && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f6c66b" }}>
              iOS güncellemesi App Store/TestFlight dağıtımı hazır olduğunda buradan açılacak.
            </p>
          )}
        </div>
        <div className="card">
          <div className="card-title">Backend Bağlantısı</div>
          <p style={{ margin: "8px 0 0" }}>{backendOk === null ? "Kontrol ediliyor…" : backendOk ? "✓ Bağlı" : "✕ Bağlanılamadı"}</p>
        </div>
        <div className="card">
          <div className="card-title">Cihaz</div>
          <p style={{ margin: "8px 0 0" }}>✓ Yetkili</p>
        </div>
        {biometricAvailable && (
          <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="card-title">Biyometrik Kilit</div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9fb0c5" }}>Uygulamayı açarken parmak izi/Face ID iste</p>
            </div>            <button className="btn" style={{ background: biometricOn ? "#d5aa58" : undefined, color: biometricOn ? "#1a1408" : undefined }} onClick={toggleBiometric}>
              {biometricOn ? "Açık" : "Kapalı"}
            </button>
          </div>
        )}
        <div className="card">
          <div className="card-title">Bildirimler</div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9fb0c5" }}>
            Altyapı hazır; gerçek Firebase (Android) ve APNs (iOS) kimlik bilgileri tanımlanana kadar bildirim gönderilemez.
          </p>
        </div>
        <div className="card">
          <div className="card-title">Hakkında</div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9fb0c5" }}>
            Safira &amp; Destan Villas — yalnız işletme ekibi için yönetim uygulaması.
          </p>
        </div>
        <button className="btn btn-block" style={{ marginTop: 16, borderColor: "#dc2626", color: "#fca5a5" }} onClick={logout}>
          Bu Cihazdan Çıkış Yap
        </button>
      </div>
    </div>
  );
}
