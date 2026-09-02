// Tüm tarih hesaplamaları UTC epoch üzerinden yapılır ve "YYYY-MM-DD" string'e
// geri yazılır - böylece cihazın yerel saat dilimi ay/gün kaydırmasına yol açmaz.
// checkIn/checkOut karşılaştırmaları da ISO string lexicographic compare ile yapılır.

export interface MonthCursor {
  year: number;
  month: number; // 0-11
}

export interface DayCell {
  date: string; // YYYY-MM-DD
  dayNum: number;
  inMonth: boolean;
}

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_LABELS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toISODate(year: number, monthIndex: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIndex, day));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// Pazartesi=0 ... Pazar=6 olacak şekilde JS'in Pazar=0 haftasını çevirir.
function mondayIndex(jsWeekday: number): number {
  return (jsWeekday + 6) % 7;
}

export function monthLabel(cursor: MonthCursor): string {
  return `${MONTH_LABELS[cursor.month]} ${cursor.year}`;
}

export function weekdayLabels(): string[] {
  return WEEKDAY_LABELS;
}

export function addMonths(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + cursor.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function currentCursor(): MonthCursor {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

// Ayın 1'inin denk geldiği haftanın Pazartesi'sinden, ay sonunun denk geldiği
// haftanın Pazar'ına kadar tam haftalık satırlar halinde 7 sütunluk grid üretir.
export function buildMonthGrid(cursor: MonthCursor): DayCell[][] {
  const firstOfMonth = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const leadingBlanks = mondayIndex(firstOfMonth.getUTCDay());

  const cells: DayCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    const prev = addMonths(cursor, -1);
    const prevDaysInMonth = new Date(Date.UTC(prev.year, prev.month + 1, 0)).getUTCDate();
    const actualDay = prevDaysInMonth - leadingBlanks + i + 1;
    cells.push({ date: toISODate(prev.year, prev.month, actualDay), dayNum: actualDay, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toISODate(cursor.year, cursor.month, d), dayNum: d, inMonth: true });
  }
  const trailingBlanks = (7 - (cells.length % 7)) % 7;
  const next = addMonths(cursor, 1);
  for (let i = 0; i < trailingBlanks; i++) {
    cells.push({ date: toISODate(next.year, next.month, i + 1), dayNum: i + 1, inMonth: false });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function isNightOccupied(date: string, checkIn: string, checkOut: string): boolean {
  return date >= checkIn && date < checkOut;
}
