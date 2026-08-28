import type { Villa } from "./types";
import { villaProfile } from "./villaProfiles";

export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

export function buildVillaLocationMessage(villa: Villa, locationUrl: string) {
  const { name } = villaProfile(villa);
  return `Merhaba 👋

Rezervasyonunuz için teşekkür ederiz.

📍 ${name} konumu:
${locationUrl.trim()}

🕓 Giriş saati 16:00’dan sonradır.

Villaya sorunsuz şekilde giriş yapabilmeniz için konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz. Böylece sizi karşılamak için hazır olabiliriz.

İyi yolculuklar, sizi ağırlamaktan memnuniyet duyacağız. 🌿`;
}

export function buildVillaCheckoutMessage() {
  return "Merhaba, bizi tercih ettiğiniz için teşekkür ederiz. Çıkış saatimiz 10.00'dır. Güzel anılarla ayrılmanızı diler, sizi yeniden ağırlamaktan mutluluk duyarız.";
}

export function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/${normalizeWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`;
}
