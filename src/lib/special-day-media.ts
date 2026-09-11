import { classifySpecialDaySafety, getSpecialDayForDate } from "./special-days";
import type { Villa } from "./types";
import { fridayVisualVariant } from "./friday-visual";

export type ApprovedSpecialDayMedia = {
  mediaKind: "image";
  format: "feed" | "story";
};

function villaSlug(villa: Villa) {
  return villa === "Safira" ? "safira" : "destan";
}

/**
 * Fail-closed doğrulama: yalnız bizim first-party special-day renderer URL'leri kabul edilir.
 * URL'deki villa ve tarih D1 satırıyla birebir eşleşmeli; ayrıca özel gün AUTO_SAFE olmalıdır.
 * Böylece keyfi harici/AI medya otomatik yayına açılamaz, fakat doğrulanmış resmi/dini gün ve
 * Cuma görselleri güvenli biçimde Instagram/Facebook yayın akışına girebilir.
 */
export function approvedSpecialDayMedia(
  post: { villa: Villa; scheduledDate: string },
  url: string,
  allowedOrigins: string[],
): ApprovedSpecialDayMedia | null {
  try {
    const parsed = new URL(url);
    if (!allowedOrigins.includes(parsed.origin)) return null;

    const fridayStatic = parsed.pathname.match(/^\/social\/friday\/variant-(\d{2})\.png$/);
    if (fridayStatic) {
      const date = parsed.searchParams.get("date");
      const villaParam = parsed.searchParams.get("villa");
      if (!date || date !== post.scheduledDate || villaParam !== villaSlug(post.villa)) return null;
      const specialDay = getSpecialDayForDate(date);
      if (!specialDay || specialDay.kind !== "friday") return null;
      if (classifySpecialDaySafety(specialDay).automationClass !== "AUTO_SAFE") return null;
      if (Number(fridayStatic[1]) !== fridayVisualVariant(date, post.villa)) return null;
      return { mediaKind: "image", format: "feed" };
    }

    const match = parsed.pathname.match(
      /^\/api\/public\/social-assets\/(safira|destan)_special-day_(\d{4}-\d{2}-\d{2})\/(feed|story)$/,
    );
    if (!match) return null;

    const [, slug, date, format] = match;
    if (slug !== villaSlug(post.villa) || date !== post.scheduledDate) return null;

    const specialDay = getSpecialDayForDate(date);
    if (!specialDay) return null;
    if (classifySpecialDaySafety(specialDay).automationClass !== "AUTO_SAFE") return null;

    return { mediaKind: "image", format: format as "feed" | "story" };
  } catch {
    return null;
  }
}
