export interface IcsExportEvent {
  uid: string;
  startDate: string;
  endDate: string;
}

function toIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

// RFC5545 75 oktet satır katlama - bizim satırlarımız bu sınırı normalde aşmaz, yine de güvence.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    result += `\r\n ${rest.slice(0, 74)}`;
    rest = rest.slice(74);
  }
  return result;
}

// Yalnız DTSTART/DTEND/UID/SUMMARY:"Reserved" - misafir adı/telefon/e-posta/fiyat/not KESİNLİKLE
// buraya girmez çünkü ExportEvent tipi bunları hiç taşımıyor (kaynakta yok, çıkışta da olamaz).
export function buildIcsFeed(events: IcsExportEvent[]): string {
  const now = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Safira & Destan Villas//Calendar Sync//TR",
    "CALSCALE:GREGORIAN",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.startDate)}`,
      `DTEND;VALUE=DATE:${toIcsDate(event.endDate)}`,
      "SUMMARY:Reserved",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
