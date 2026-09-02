import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Device } from "@capacitor/device";
import { pairDeviceRequest, logoutRequest, setAuthToken, PREVIEW_MODE } from "../api/client";
import { clearToken, loadToken, saveToken } from "../lib/secureStorage";
import { isBiometricEnabled, requestBiometricUnlock, setBiometricEnabled } from "../lib/biometric";

type AuthStatus = "loading" | "signedOut" | "locked" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  pairDevice: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockWithBiometric: () => Promise<boolean>;
  disableBiometricAndContinue: () => Promise<void>;
  pairError: string | null;
  pairing: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);

  useEffect(() => {
    if (PREVIEW_MODE) {
      // Tasarım önizlemesi: hiçbir gerçek eşleştirme/login isteği yapılmaz, doğrudan signedIn.
      setStatus("signedIn");
      return;
    }
    (async () => {
      const token = await loadToken();
      if (!token) {
        setStatus("signedOut");
        return;
      }
      setAuthToken(token);
      const biometricOn = await isBiometricEnabled();
      setStatus(biometricOn ? "locked" : "signedIn");
    })();
  }, []);

  const pairDevice = useCallback(async (code: string) => {
    setPairing(true);
    setPairError(null);
    try {
      let deviceLabel = "Villa Yönetim Mobil";
      try {
        const info = await Device.getInfo();
        deviceLabel = `${info.manufacturer ?? ""} ${info.model ?? ""}`.trim() || deviceLabel;
      } catch {
        // Device bilgisi opsiyonel - alınamazsa varsayılan etiket kullanılır.
      }
      const result = await pairDeviceRequest(code, deviceLabel);
      await saveToken(result.token);
      setAuthToken(result.token);
      setStatus("signedIn");
    } catch (error) {
      setPairError(error instanceof Error ? error.message : "Eşleştirme başarısız.");
      throw error;
    } finally {
      setPairing(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    await clearToken();
    setAuthToken(null);
    setStatus("signedOut");
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const ok = await requestBiometricUnlock();
    if (ok) setStatus("signedIn");
    return ok;
  }, []);

  // Biyometri başarısız/iptal olsa bile geçerli session token'ı ASLA silinmez - yalnız
  // kullanıcı açıkça "Bu cihazdan çıkış yap" dediğinde (logout()) tam çıkış olur. Burada
  // biyometriği kapatıp mevcut token ile devam edilir; bu, cihaz zaten kilidini açmış (ekran
  // kilidi vb.) güvenilir bir kullanıcı için makul bir ikincil kilit devre dışı bırakmadır.
  const disableBiometricAndContinue = useCallback(async () => {
    await setBiometricEnabled(false);
    setStatus("signedIn");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status, pairDevice, logout, unlockWithBiometric, disableBiometricAndContinue, pairError, pairing,
  }), [status, pairDevice, logout, unlockWithBiometric, disableBiometricAndContinue, pairError, pairing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
