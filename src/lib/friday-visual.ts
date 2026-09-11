import type { Villa } from "./types";
export const FRIDAY_VISUAL_VARIANT_COUNT = 12;
export function fridayVisualVariant(date: string, villa: Villa): number {
  const week = Math.floor(Date.parse(`${date}T00:00:00Z`) / (7 * 24 * 60 * 60 * 1000));
  const offset = villa === "Safira" ? 0 : FRIDAY_VISUAL_VARIANT_COUNT / 2;
  return Math.abs(week + offset) % FRIDAY_VISUAL_VARIANT_COUNT;
}
export function fridayVisualPath(date: string, villa: Villa): string {
  const variant = fridayVisualVariant(date, villa).toString().padStart(2, "0");
  const villaSlug = villa === "Safira" ? "safira" : "destan";
  return `/social/friday/variant-${variant}.png?date=${encodeURIComponent(date)}&villa=${villaSlug}`;
}
