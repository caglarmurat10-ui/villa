// 2026-09-02 canlı olayı: bir OTA feed'i ~370-548 gün süren tek bir blok gönderdi, bu da
// needs_review olsa bile (eski davranışta) veya tek başına "active" olsa bile takvimi neredeyse
// bir yıl boyunca kapatabiliyordu. Bu dosya, sync.ts'in her gelen ICS event'i için tekrarı önleyecek
// saf (D1/network'süz) bir kontrol sağlar - kolay test edilebilir olması bilerek burada tutuldu.

// Bir villa için normal bir tatil kiralaması rezervasyonu birkaç gün-birkaç hafta sürer; ilan
// sezonluk kapatılırsa bu da genelde birkaç ay ile sınırlıdır. 120 günün üzerindeki TEK bir ICS
// bloğu (tatil sezonu kapatması bile olsa) otomatik "active" sayılmayacak kadar sıra dışıdır -
// insan onayı için needs_review'e düşer, public takvimi kapatmaz.
export const MAX_TRUSTED_BLOCK_DAYS = 120;

// UTC gece yarısı karşılaştırması - saat dilimi kaymasından etkilenmez, ics-parser.ts'in ürettiği
// YYYY-MM-DD string'leriyle birebir uyumlu.
export function blockDurationDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function isAnomalousBlockDuration(startDate: string, endDate: string): boolean {
  const days = blockDurationDays(startDate, endDate);
  return Number.isFinite(days) && days > MAX_TRUSTED_BLOCK_DAYS;
}
