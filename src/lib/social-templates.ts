import type { AvailabilityGap } from "./social-availability";
import type { Villa } from "./types";

type Template = { id: string; body: string };

const destanTemplates: Template[] = [
  { id: "destan-01", body: "🌿 Villa Destan’da {dates} tarihleri müsait!\n\n🏡 Özel havuz\n☀️ Patara / Kaş\n🔐 Huzur ve mahremiyet\n\n{nights} gecelik bu boşluğu değerlendirmek için bize ulaşabilirsiniz." },
  { id: "destan-02", body: "Patara’da sakin bir mola için Villa Destan sizi bekliyor. ✨\n\n📅 {dates}\n🌙 {nights} gece müsaitlik\n🏊 Size özel havuz ve bahçe" },
  { id: "destan-03", body: "Tatil takviminde güzel bir boşluk açıldı! 🌴\n\nVilla Destan · {dates}\n{nights} gece boyunca Patara’nın huzurunu yaşayın." },
  { id: "destan-04", body: "Kaş / Patara’da mahrem ve keyifli bir villa tatili. 🏡\n\nVilla Destan için {dates} tarihleri, toplam {nights} gece müsait." },
  { id: "destan-05", body: "Güne havuz başında, akşama Patara’nın dinginliğinde merhaba deyin. 🌅\n\nVilla Destan · {dates}\n{nights} gece müsait." },
  { id: "destan-06", body: "Villa Destan’da tatil zamanı! ☀️\n\n{dates} tarihleri arasında {nights} gecelik özel bir konaklama fırsatı sizi bekliyor." },
  { id: "destan-07", body: "Kalabalıktan uzak, size ait bir tatil alanı. 🌿\n\nVilla Destan’da {dates} tarihleri {nights} gece için müsait." },
  { id: "destan-08", body: "Patara planınızı şimdi yapın. 📍\n\nVilla Destan · {dates}\n🏊 Özel havuz · 🌙 {nights} gece müsaitlik" },
];

const safiraTemplates: Template[] = [
  { id: "safira-01", body: "💎 Villa Safira’da {dates} tarihleri müsait!\n\n🌿 Ferah yaşam alanı\n🏊 Özel havuz\n☀️ Patara / Kaş\n\n{nights} gecelik bu fırsat için bize ulaşın." },
  { id: "safira-02", body: "Villa Safira’da zarif ve huzurlu bir Patara molası. ✨\n\n📅 {dates}\n🌙 {nights} gece müsaitlik" },
  { id: "safira-03", body: "Tatil takviminize biraz güneş ekleyin. ☀️\n\nVilla Safira · {dates}\n{nights} gece size özel villa keyfi." },
  { id: "safira-04", body: "Patara’nın dinginliğini Villa Safira’nın konforuyla buluşturun. 🌿\n\n{dates} tarihleri arasında {nights} gece müsait." },
  { id: "safira-05", body: "Havuz, bahçe ve sevdiklerinizle sakin bir tatil. 🏡\n\nVilla Safira · {dates}\n{nights} gecelik müsaitlik." },
  { id: "safira-06", body: "Villa Safira’da yeni bir tatil fırsatı açıldı! 🌸\n\n📅 {dates}\n🌙 {nights} gece\n📍 Patara / Kaş" },
  { id: "safira-07", body: "Günün telaşını kapıda bırakın; Villa Safira’da dinlenin. 💫\n\n{dates} tarihleri {nights} gece için müsait." },
  { id: "safira-08", body: "Kaş / Patara tatiliniz için ferah, özel ve huzurlu bir adres. 🌊\n\nVilla Safira · {dates} · {nights} gece" },
];

const lastMinuteTemplates: Template[] = [
  { id: "last-01", body: "🔥 Son dakika fırsatı! {displayName} için {dates} tarihleri açıldı. {nights} gecelik bu boşluğu kaçırmayın." },
  { id: "last-02", body: "Valizi hazırlamak için güzel bir sebep: {displayName} {dates} tarihleri arasında müsait. ✨" },
  { id: "last-03", body: "Son dakika Patara kaçamağı! 🌿 {displayName} · {dates} · {nights} gece." },
  { id: "last-04", body: "Takvimde kısa bir fırsat açıldı. ☀️ {displayName} için {dates} tarihleri müsait." },
  { id: "last-05", body: "Bu hafta Patara’da villa keyfine ne dersiniz? 🏊 {displayName} · {dates}." },
  { id: "last-06", body: "Beklenmedik bir boşluk, güzel bir tatil fırsatı. 💫 {displayName} {dates} tarihleri arasında müsait." },
];

const longStayTemplates: Template[] = [
  { id: "long-01", body: "Uzun ve sakin bir Patara tatili için takvim açıldı. 🌿 {displayName} · {dates} · {nights} gece." },
  { id: "long-02", body: "Acele etmeden dinlenmek isteyenlere uzun dönem müsaitlik. 🏡 {displayName} için {dates} tarihleri açık." },
  { id: "long-03", body: "Patara’yı gerçekten yaşamak için geniş bir tarih aralığı. ☀️ {displayName} · {dates}." },
  { id: "long-04", body: "Uzun tatil planınızı özel havuzlu villada tamamlayın. 🏊 {displayName}, {dates} arasında {nights} gece müsait." },
  { id: "long-05", body: "Çalışmaya, dinlenmeye ve keşfetmeye zaman ayırın. 🌅 {displayName} · {dates} uzun dönem müsaitliği." },
  { id: "long-06", body: "Kaş / Patara’da uzun bir mola için doğru zaman. ✨ {displayName} {dates} tarihleri arasında müsait." },
];

function localDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  timeZone: "Europe/Istanbul",
});

export function formatTurkishDateRange(startDate: string, endDate: string) {
  const start = localDate(startDate);
  const end = localDate(endDate);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const startMonth = monthFormatter.format(start);
  const endMonth = monthFormatter.format(end);
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth}`;
  }
  if (sameYear) {
    return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth}`;
  }
  return `${start.getUTCDate()} ${startMonth} ${start.getUTCFullYear()} – ${end.getUTCDate()} ${endMonth} ${end.getUTCFullYear()}`;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function templateBankSize(villa: Villa) {
  return (villa === "Destan" ? destanTemplates : safiraTemplates).length;
}

export function createAvailabilityCaption(
  gap: AvailabilityGap,
  options: {
    rotation?: number;
    whatsappCta?: boolean;
    websiteCta?: boolean;
    website?: string;
    priceText?: string | null;
  } = {},
) {
  const villaBank = gap.villa === "Destan" ? destanTemplates : safiraTemplates;
  const bank = gap.classification === "long-stay"
    ? [...villaBank, ...longStayTemplates]
    : gap.isLastMinute
      ? [...villaBank, ...lastMinuteTemplates]
      : villaBank;
  const seed = `${gap.villa}:${gap.startDate}:${gap.endDate}:${options.rotation ?? 0}`;
  const template = bank[stableHash(seed) % bank.length];
  const dates = formatTurkishDateRange(gap.startDate, gap.endDate);
  const displayName = `Villa ${gap.villa}`;
  let caption = template.body
    .replaceAll("{dates}", dates)
    .replaceAll("{nights}", String(gap.nights))
    .replaceAll("{displayName}", displayName);
  if (options.priceText) caption += `\n\n💰 ${options.priceText}`;
  if (options.whatsappCta !== false) caption += "\n\n📩 Rezervasyon ve bilgi için DM / WhatsApp";
  if (options.websiteCta && options.website) caption += `\n🌐 ${options.website}`;
  caption += "\n\n#Patara #Kaş #VillaTatili #KiralıkVilla";
  return { caption, templateId: template.id };
}

export const TEMPLATE_COUNTS = {
  Destan: destanTemplates.length,
  Safira: safiraTemplates.length,
  lastMinute: lastMinuteTemplates.length,
  longStay: longStayTemplates.length,
} as const;
