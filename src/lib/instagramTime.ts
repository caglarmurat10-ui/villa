export const INSTAGRAM_TIMEZONE = "Europe/Istanbul";
export const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000;
export const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;
export const SCHEDULE_MEDIA_BUFFER_MS = 48 * 60 * 60 * 1000;

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const istanbulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: INSTAGRAM_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function formatterParts(date: Date): LocalDateTimeParts & { second: number } {
  const values = new Map(
    istanbulFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.get("year") ?? Number.NaN,
    month: values.get("month") ?? Number.NaN,
    day: values.get("day") ?? Number.NaN,
    hour: values.get("hour") ?? Number.NaN,
    minute: values.get("minute") ?? Number.NaN,
    second: values.get("second") ?? Number.NaN,
  };
}

function parseLocalParts(value: string): LocalDateTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const calendarCheck = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );

  if (
    parts.year < 2020 ||
    parts.year > 2200 ||
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    calendarCheck.getUTCFullYear() !== parts.year ||
    calendarCheck.getUTCMonth() + 1 !== parts.month ||
    calendarCheck.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

function timezoneOffsetMs(date: Date) {
  const parts = formatterParts(date);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - date.getTime()
  );
}

export function istanbulLocalToUtc(value: string) {
  const parts = parseLocalParts(value);
  if (!parts) throw new Error("Planlama tarihi veya saati geçersiz.");

  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  let candidate = new Date(localAsUtc);

  // IANA saat dilimi ofsetini hedef zamana iki geçişte uygular. Böylece
  // gelecekteki olası saat dilimi kural değişiklikleri sabit UTC+3 varsayılmaz.
  candidate = new Date(localAsUtc - timezoneOffsetMs(candidate));
  candidate = new Date(localAsUtc - timezoneOffsetMs(candidate));

  const verified = formatterParts(candidate);
  if (
    verified.year !== parts.year ||
    verified.month !== parts.month ||
    verified.day !== parts.day ||
    verified.hour !== parts.hour ||
    verified.minute !== parts.minute
  ) {
    throw new Error("Seçilen Türkiye saati geçerli değil.");
  }

  return candidate;
}

export function validateScheduledDate(
  localDateTime: string,
  timezone: string,
  now = new Date(),
) {
  if (timezone !== INSTAGRAM_TIMEZONE) {
    throw new Error("Planlama saat dilimi Europe/Istanbul olmalı.");
  }

  const scheduledAt = istanbulLocalToUtc(localDateTime);
  const distance = scheduledAt.getTime() - now.getTime();
  if (distance < MIN_SCHEDULE_LEAD_MS) {
    throw new Error("Planlanan zaman en az 2 dakika ileride olmalı.");
  }
  if (distance > MAX_SCHEDULE_AHEAD_MS) {
    throw new Error("Gönderi en fazla 90 gün sonrasına planlanabilir.");
  }
  return scheduledAt;
}

export function scheduledMediaExpirationTtl(
  scheduledAt: Date,
  now = new Date(),
) {
  const lifetimeMs =
    scheduledAt.getTime() - now.getTime() + SCHEDULE_MEDIA_BUFFER_MS;
  return Math.max(60, Math.ceil(lifetimeMs / 1000));
}

export function minimumScheduledMediaExpiration(scheduledAt: Date) {
  return new Date(scheduledAt.getTime() + SCHEDULE_MEDIA_BUFFER_MS);
}
