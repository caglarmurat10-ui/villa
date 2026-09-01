export interface ParsedIcsEvent {
  uid: string;
  startDate: string;
  endDate: string;
}

// RFC5545 satır katlama açma: devam satırları tek boşluk/tab ile başlar.
function unfold(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

// Beklenen: YYYYMMDD (VALUE=DATE) ya da YYYYMMDDTHHMMSSZ (datetime) - ikinci durumda yalnız tarih
// kısmı alınır (takvim engelleme amaçlı saat önemsiz; tüm-gün etkinlik varsayımı bu entegrasyonun
// kapsamı - WS90/villa saatiyle karıştırılmaz).
function parseDateValue(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

// Yalnız DTSTART/DTEND/UID okur - SUMMARY/DESCRIPTION/ORGANIZER gibi diğer tüm alanlar bilerek
// yok sayılır (D1'e hiç ulaşmasın diye burada, kaynakta filtreleniyor).
export function parseIcsEvents(icsText: string): ParsedIcsEvent[] {
  const lines = unfold(icsText);
  const events: ParsedIcsEvent[] = [];
  let inEvent = false;
  let uid: string | null = null;
  let start: string | null = null;
  let end: string | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      uid = null;
      start = null;
      end = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && uid && start && end) {
        events.push({ uid, startDate: start, endDate: end });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const rawKey = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const key = rawKey.split(";")[0].toUpperCase();

    if (key === "UID") uid = value.trim();
    else if (key === "DTSTART") start = parseDateValue(value);
    else if (key === "DTEND") end = parseDateValue(value);
  }

  return events;
}
