// Türkiye 2016'dan beri DST uygulamıyor - Europe/Istanbul yıl boyu SABİT UTC+3. Bu yüzden
// "çıkış tarihi - 1 gün, saat 11:00 Europe/Istanbul" dönüşümü, ortam saat dilimine (runtime TZ)
// bağımlı olmayan saf UTC epoch aritmetiğiyle güvenle yapılabilir - Intl/timezone kütüphanesi
// gerekmez, ay/yıl sınırlarında da doğru çalışır (test edildi, bkz. schedule.test.ts).
const ISTANBUL_UTC_OFFSET_HOURS = 3;
const CHECKOUT_REMINDER_ISTANBUL_HOUR = 11;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// checkoutDate: rezervasyonun check_out'u (YYYY-MM-DD, saat bileşeni yok - uygulamadaki tüm
// tarihler gibi takvim günü olarak tutulur). Döner: o günden bir gün önce, saat 11:00
// Europe/Istanbul'un UTC ISO karşılığı.
export function computeCheckoutReminderScheduledAt(checkoutDate: string): string {
  if (!DATE_ONLY_PATTERN.test(checkoutDate)) {
    throw new Error(`Geçersiz çıkış tarihi formatı (YYYY-MM-DD bekleniyor): ${checkoutDate}`);
  }
  const checkoutMidnightUtc = new Date(`${checkoutDate}T00:00:00.000Z`);
  if (Number.isNaN(checkoutMidnightUtc.getTime())) {
    throw new Error(`Geçersiz çıkış tarihi: ${checkoutDate}`);
  }
  const reminderDayMidnightUtc = checkoutMidnightUtc.getTime() - 24 * 60 * 60 * 1000;
  const scheduledAt = reminderDayMidnightUtc + (CHECKOUT_REMINDER_ISTANBUL_HOUR - ISTANBUL_UTC_OFFSET_HOURS) * 60 * 60 * 1000;
  return new Date(scheduledAt).toISOString();
}

// "checkout_date - 1 gün" içindir - hatırlatmanın hangi takvim gününe ait olduğunu (Europe/Istanbul)
// insan tarafından okunur biçimde saklamak için ayrıca hesaplanmaz; scheduled_at zaten tek doğruluk
// kaynağıdır. Bu fonksiyon yalnız cron'un "bugün Istanbul'da hangi tarihteyiz" karşılaştırması için.
export function istanbulTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}
