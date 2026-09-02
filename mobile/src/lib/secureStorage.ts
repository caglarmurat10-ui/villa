import { SecureStorage } from "@aparajita/capacitor-secure-storage";

// Token ASLA localStorage'a veya JS bundle'a yazılmaz - yalnız Android Keystore / iOS Keychain
// destekli bu plugin üzerinden. Web (tarayıcıda geliştirme) fallback'i plugin'in kendi web
// implementasyonu (sessionStorage tabanlı, yalnız dev için).
const TOKEN_KEY = "villa_yonetim_session_token";

export async function saveToken(token: string): Promise<void> {
  await SecureStorage.setItem(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStorage.removeItem(TOKEN_KEY);
  } catch {
    // Zaten yoksa sorun değil.
  }
}
