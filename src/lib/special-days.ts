// Faz 6 bölüm 5/6/10 - Resmi/dini bayram ve özel gün motoru. SAF fonksiyonlar, D1/network çağrısı
// yok. Normal 30 günlük içerik karmasından (social-content-mix.ts) TAMAMEN AYRI bir sınıf - bu
// dosyadaki hiçbir theme social-content-mix.ts'in THEME_TO_CATEGORY eşlemesinde yer almaz (bkz.
// categoryForTheme(...) === null davranışı), yani normal karma yüzdelerini hiç etkilemez.
//
// SABİT (yasal, yıldan bağımsız) resmi/ulusal tatiller: 2429 sayılı Ulusal Bayram ve Genel
// Tatiller Hakkında Kanun'daki gün/ay sabit günlerdir - gerçek, değişmeyen yasal tarihler,
// UYDURULMADI, her zaman AUTO_SAFE olabilir (kaynak: T.C. mevzuatı, yıldan bağımsız).
//
// DEĞİŞKEN (ay takvimine göre yıldan yıla kayan) dini bayramlar SABİT KOPYALANMAZ - yıllık bir
// KAYIT (registry) gerektirir, her kayıt kaynak URL + retrievedAt + verified taşır. Yalnız
// verified:true olan bir yılın kaydı AUTO_SAFE olabilir; doğrulanmamış/eksik bir yıl için ASLA
// tahmin/hesaplama YAPILMAZ (hicri takvim astronomik hesaplaması Diyanet'in resmi ilanından 1 gün
// farklı olabilir) - o yıl REVIEW_REQUIRED'a düşer (bkz. classifySpecialDaySafety).
import type { AutomationClass } from "./social-content-planner";

export type SpecialDayCategory = "resmi" | "dini";

export interface SpecialDayDefinition {
  id: string; // sabit, kararlı - şablon id key'i olarak da kullanılır
  category: SpecialDayCategory;
  name: string;
}

export interface FixedHoliday extends SpecialDayDefinition {
  month: number; // 1-12
  day: number;
}

// 2429 sayılı Kanun'daki sabit resmi/ulusal tatiller (ay-gün, yıldan bağımsız). Mesaj tonu bölüm
// 6'daki kurala uyar: sade, saygılı, ticari CTA/fiyat/müsaitlik iddiası yok.
export const FIXED_HOLIDAYS: FixedHoliday[] = [
  { id: "yilbasi", category: "resmi", month: 1, day: 1, name: "Yılbaşı" },
  { id: "23-nisan", category: "resmi", month: 4, day: 23, name: "Ulusal Egemenlik ve Çocuk Bayramı" },
  { id: "1-mayis", category: "resmi", month: 5, day: 1, name: "Emek ve Dayanışma Günü" },
  { id: "19-mayis", category: "resmi", month: 5, day: 19, name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
  { id: "15-temmuz", category: "resmi", month: 7, day: 15, name: "Demokrasi ve Millî Birlik Günü" },
  { id: "30-agustos", category: "resmi", month: 8, day: 30, name: "Zafer Bayramı" },
  { id: "29-ekim", category: "resmi", month: 10, day: 29, name: "Cumhuriyet Bayramı" },
];

// Cumhuriyet 1923'te ilan edildi (yaygın bilinen, tartışmasız tarihsel gerçek) - "Cumhuriyetimizin
// N. yılı" ifadesindeki N, basit yıl farkı ile hesaplanır; bu bir TAHMİN değil, aritmetiktir.
const REPUBLIC_FOUNDING_YEAR = 1923;

// Resmi tatil adları (2429 sayılı Kanun'daki kendi tam adları) zaten 3. tekil şahıs iyelik ekiyle
// biter ("Bayramı", "Günü") - "bizim" anlamını eklemek için doğrudan "ımız" EKLENEMEZ (çift "ı"
// üretir: "Bayramıımız" - yanlış). Son sesli harfe göre yalnız "mız"/"müz" eklenir: "Bayramı" + "mız"
// = "Bayramımız", "Günü" + "müz" = "Günümüz" (doğru büyük ünlü uyumu).
function possessiveOurSuffix(name: string): string {
  const last = name.slice(-1);
  if (last === "ı") return "mız";
  if (last === "ü") return "müz";
  if (last === "u") return "muz";
  if (last === "i") return "miz";
  return "ımız"; // savunma amaçlı varsayılan - şu an bilinen tüm sabit tatil adları yukarıdaki 4 durumdan birine uyuyor
}

export function fixedHolidayMessage(holiday: FixedHoliday, year: number): string {
  if (holiday.id === "29-ekim") {
    return `29 Ekim Cumhuriyet Bayramımız kutlu olsun. Cumhuriyetimizin ${year - REPUBLIC_FOUNDING_YEAR}. yılı kutlu olsun.`;
  }
  if (holiday.id === "15-temmuz") {
    return "15 Temmuz Demokrasi ve Millî Birlik Günümüzü saygıyla anıyoruz.";
  }
  if (holiday.id === "yilbasi") {
    return "Yeni yılınız kutlu olsun.";
  }
  return `${holiday.day} ${["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][holiday.month]} ${holiday.name}${possessiveOurSuffix(holiday.name)} kutlu olsun.`;
}

export function getFixedHolidayForDate(dateIso: string): FixedHoliday | null {
  const [, monthStr, dayStr] = dateIso.split("-");
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  return FIXED_HOLIDAYS.find((h) => h.month === month && h.day === day) ?? null;
}

export type ReligiousHolidayName = "Ramazan Bayramı" | "Kurban Bayramı";

export interface ReligiousHolidayYearEntry {
  year: number;
  name: ReligiousHolidayName;
  startDate: string; // YYYY-MM-DD dahil
  endDate: string; // YYYY-MM-DD dahil
  sourceUrl: string;
  retrievedAt: string; // ISO
  verified: boolean;
}

// Yalnız GERÇEKTEN resmi bir kaynaktan (vakithesaplama.diyanet.gov.tr - Diyanet İşleri
// Başkanlığı'nın kendi alan adı) doğrulanmış yıllar burada yer alır. 2027 kaydı 2026-09-03'te bu
// kaynaktan doğrudan alınmış ve kullanıcının kendi belirttiği tarihlerle birebir eşleşmiştir.
export const RELIGIOUS_HOLIDAY_REGISTRY: ReligiousHolidayYearEntry[] = [
  {
    year: 2027, name: "Ramazan Bayramı", startDate: "2027-03-09", endDate: "2027-03-11",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-03T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Kurban Bayramı", startDate: "2027-05-16", endDate: "2027-05-19",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-03T00:00:00.000Z", verified: true,
  },
];

export function religiousHolidayMessage(entry: ReligiousHolidayYearEntry): string {
  return `${entry.name}ınız mübarek olsun.`;
}

// Bir tarih, kayıtlı bir dini bayram aralığına denk geliyorsa o kaydı döner (doğrulanmamış olsa
// bile - sınıflandırma kararı classifySpecialDaySafety'nin işi, burada yalnız EŞLEŞME bulunur).
export function getReligiousHolidayForDate(dateIso: string): ReligiousHolidayYearEntry | null {
  return RELIGIOUS_HOLIDAY_REGISTRY.find((entry) => dateIso >= entry.startDate && dateIso <= entry.endDate) ?? null;
}

export type SpecialDayMatch =
  | { kind: "fixed"; holiday: FixedHoliday; message: string }
  | { kind: "religious"; entry: ReligiousHolidayYearEntry; message: string };

// Bir tarih için özel gün eşleşmesi arar - sabit resmi tatiller dini bayramlardan ÖNCELİKLİDİR
// (ikisi aynı takvim gününe denk gelirse, ki 2429 sayılı sabit günlerle dini bayramlar teorik
// olarak çakışabilir - sabit/kesin olan öncelik alır).
export function getSpecialDayForDate(dateIso: string): SpecialDayMatch | null {
  const fixed = getFixedHolidayForDate(dateIso);
  if (fixed) {
    const year = Number.parseInt(dateIso.slice(0, 4), 10);
    return { kind: "fixed", holiday: fixed, message: fixedHolidayMessage(fixed, year) };
  }
  const religious = getReligiousHolidayForDate(dateIso);
  if (religious) {
    return { kind: "religious", entry: religious, message: religiousHolidayMessage(religious) };
  }
  return null;
}

// Section 10 - AUTO_SAFE olabilir: resmî bayram sabit tarihleri + yıllık Diyanet kaynağı
// DOĞRULANMIŞ bayram paylaşımı. Doğrulanmamış bir dini bayram yılı REVIEW_REQUIRED'a düşer -
// otomatik olarak AUTO_SAFE sayılmaz (bkz. bölüm 4/10, "Etkinlik otomatik olarak AUTO_SAFE
// sayılmasın" ilkesiyle aynı disiplin, burada bayram için).
export function classifySpecialDaySafety(match: SpecialDayMatch): { automationClass: AutomationClass; reason: string } {
  if (match.kind === "fixed") {
    return { automationClass: "AUTO_SAFE", reason: "2429 sayılı Kanun'daki sabit resmi tatil - yıldan bağımsız, doğrulanmış tarih." };
  }
  if (match.entry.verified) {
    return { automationClass: "AUTO_SAFE", reason: `Diyanet İşleri Başkanlığı resmi kaynağından doğrulandı (${match.entry.sourceUrl}, ${match.entry.retrievedAt}).` };
  }
  return { automationClass: "REVIEW_REQUIRED", reason: `${match.entry.year} yılı ${match.entry.name} tarihi resmi Diyanet kaynağından henüz doğrulanmadı - otomatik yayınlanamaz.` };
}
