// Tek canonical WhatsApp/telefon kaynağı — işletme sahibi tarafından 2026-09-01'de doğrulandı.
// Başka hiçbir dosyada bu numarayı hard-code ETME; buradan import et.
export const WHATSAPP_PHONE_INTL = "905412424455";
export const WHATSAPP_PHONE_DISPLAY_INTL = "+90 541 242 44 55";
export const WHATSAPP_PHONE_DISPLAY_TR = "0541 242 44 55";

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_PHONE_INTL}?text=${encodeURIComponent(message)}`;
}
