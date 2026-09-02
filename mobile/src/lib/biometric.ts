import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { Preferences } from "@capacitor/preferences";

// Biyometri backend auth'un YERİNE geçmez - yalnız cihazda zaten geçerli olan session token'a
// erişmeden önce ikinci bir kilit katmanıdır. Backend, biyometri hakkında hiçbir şey bilmez.
const BIOMETRIC_ENABLED_KEY = "villa_yonetim_biometric_enabled";

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
  return value === "true";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: enabled ? "true" : "false" });
}

// Başarısızsa (biyometri yok/başarısız/iptal) false döner - çağıran taraf güvenli fallback
// (parola ile tekrar giriş) sunmalı, sessizce içeri almamalı.
export async function requestBiometricUnlock(): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason: "Villa Yönetim'e erişmek için kimliğinizi doğrulayın",
      cancelTitle: "İptal",
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}
