import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Device } from "@capacitor/device";
import { loginRequest, logoutRequest, setAuthToken } from "../api/client";
import { clearToken, loadToken, saveToken } from "../lib/secureStorage";
import { isBiometricEnabled, requestBiometricUnlock } from "../lib/biometric";

type AuthStatus = "loading" | "signedOut" | "locked" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockWithBiometric: () => Promise<boolean>;
  fallbackToPasswordUnlock: () => void;
  loginError: string | null;
  loggingIn: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
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

  const login = useCallback(async (password: string) => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      let deviceLabel = "Villa Yönetim Mobil";
      try {
        const info = await Device.getInfo();
        deviceLabel = `${info.manufacturer ?? ""} ${info.model ?? ""}`.trim() || deviceLabel;
      } catch {
        // Device bilgisi opsiyonel - alınamazsa varsayılan etiket kullanılır.
      }
      const result = await loginRequest(password, deviceLabel);
      await saveToken(result.token);
      setAuthToken(result.token);
      setStatus("signedIn");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Giriş başarısız.");
      throw error;
    } finally {
      setLoggingIn(false);
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

  const fallbackToPasswordUnlock = useCallback(() => {
    // Biyometri başarısız/iptal - güvenli fallback: mevcut token'ı at, yeniden parola gerektir.
    (async () => {
      await clearToken();
      setAuthToken(null);
      setStatus("signedOut");
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status, login, logout, unlockWithBiometric, fallbackToPasswordUnlock, loginError, loggingIn,
  }), [status, login, logout, unlockWithBiometric, fallbackToPasswordUnlock, loginError, loggingIn]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
