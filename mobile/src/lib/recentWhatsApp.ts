import { SecureStorage } from "@aparajita/capacitor-secure-storage";

// Yalnız cihaz içi Keystore/Keychain destekli güvenli depolama - hiçbir rezervasyona, D1'e,
// API'ye veya analytics'e yazılmaz. Kullanıcı bu ekranı sildiğinde/uygulamayı kaldırdığında
// veri de gider - bu bilinçli bir tasarım, sunucu tarafı bir "adres defteri" DEĞİL.
const RECENT_KEY = "villa_yonetim_recent_whatsapp";
const MAX_RECENT = 20;

export interface RecentWhatsAppNumber {
  number: string; // normalize edilmiş, örn. 905321234567
  display: string; // kullanıcının yazdığı orijinal biçim
  lastUsedAt: string;
  label?: string;
}

async function readAll(): Promise<RecentWhatsAppNumber[]> {
  try {
    const raw = await SecureStorage.getItem(RECENT_KEY);
    if (!raw || typeof raw !== "string") return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(list: RecentWhatsAppNumber[]): Promise<void> {
  try {
    await SecureStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Depolama başarısız olsa bile mesaj gönderimi engellenmemeli - sessizce yoksay.
  }
}

export async function listRecentWhatsApp(): Promise<RecentWhatsAppNumber[]> {
  return readAll();
}

// Aynı numara tekrar kullanılırsa duplicate oluşturmaz, listenin başına taşır.
export async function rememberWhatsAppNumber(number: string, display: string): Promise<void> {
  const current = await readAll();
  const existing = current.find((entry) => entry.number === number);
  const entry: RecentWhatsAppNumber = {
    number,
    display,
    lastUsedAt: new Date().toISOString(),
    label: existing?.label,
  };
  const rest = current.filter((item) => item.number !== number);
  await writeAll([entry, ...rest]);
}

export async function removeRecentWhatsApp(number: string): Promise<void> {
  const current = await readAll();
  await writeAll(current.filter((item) => item.number !== number));
}

export async function clearRecentWhatsApp(): Promise<void> {
  try {
    await SecureStorage.removeItem(RECENT_KEY);
  } catch {
    // Zaten yoksa sorun değil.
  }
}
