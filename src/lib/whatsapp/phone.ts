// Tek canonical MÜŞTERİ telefon normalizasyon kaynağı - src/components/MessageCenter.tsx'teki
// (manuel wa.me akışı) ve otomatik hatırlatma zamanlayıcısının İKİSİ de bu fonksiyonları kullanır.
// Not: WHATSAPP_PHONE_INTL (contact.ts) işletmenin KENDİ numarasıdır, bununla karıştırılmamalı -
// burası misafirin kaydettiği numarayı normalize eder.
export function normalizeWhatsappPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}

// E.164 kaba sağlık kontrolü (ülke kodu dahil 10-15 hane) - WhatsApp Cloud API "to" alanı için
// yeterli bir ön doğrulama. Gerçek numaranın var/ulaşılabilir olduğu yalnız Meta'nın kendi
// yanıtından (veya webhook "failed" durumundan) anlaşılır, burada iddia edilmez.
export function isValidWhatsappPhone(value: string): boolean {
  const normalized = normalizeWhatsappPhone(value);
  return /^\d{10,15}$/.test(normalized);
}
