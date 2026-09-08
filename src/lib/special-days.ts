// Faz 6 bölüm 5/6/10 - Resmi/dini bayram ve özel gün motoru. SAF fonksiyonlar, D1/network çağrısı
// yok. Normal 30 günlük içerik karmasından (social-content-mix.ts) TAMAMEN AYRI bir sınıf - bu
// dosyadaki hiçbir theme social-content-mix.ts'in THEME_TO_CATEGORY eşlemesinde yer almaz (bkz.
// categoryForTheme(...) === null davranışı), yani normal karma yüzdelerini hiç etkilemez.
//
// SABİT (yasal, yıldan bağımsız) resmi/ulusal tatiller: 2429 sayılı Ulusal Bayram ve Genel
// Tatiller Hakkında Kanun'daki gün/ay sabit günlerdir - gerçek, değişmeyen yasal tarihler,
// UYDURULMADI, her zaman AUTO_SAFE olabilir (kaynak: T.C. mevzuatı, yıldan bağımsız).
//
// 2026-09-08 İŞLETME SAHİBİ KARARI (KALICI, İSTİSNASIZ): 15 Temmuz Demokrasi ve Millî Birlik Günü
// sosyal medya içerik takviminde ASLA kullanılmaz - üretilmez, planlanmaz, otomatik ya da elle
// yayınlanmaz. Bu bir gözden kaçırma DEĞİL, açık bir editoryal kısıtlama. FIXED_HOLIDAYS
// listesinden BİLEREK çıkarılmıştır; EXCLUDED_FIXED_HOLIDAY_IDS ayrıca ikinci bir savunma
// katmanıdır (biri listeye yanlışlıkla geri eklenirse bile getFixedHolidayForDate() onu yine de
// asla döndürmez) - bkz. special-days.test.ts'teki kalıcı regresyon testi.
const EXCLUDED_FIXED_HOLIDAY_IDS = new Set(["15-temmuz"]);
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
  // 15 Temmuz KASITLI OLARAK burada yok - bkz. yukarıdaki 2026-09-08 notu.
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
  if (holiday.id === "yilbasi") {
    return "Yeni yılınız kutlu olsun.";
  }
  return `${holiday.day} ${["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"][holiday.month]} ${holiday.name}${possessiveOurSuffix(holiday.name)} kutlu olsun.`;
}

export function getFixedHolidayForDate(dateIso: string): FixedHoliday | null {
  const [, monthStr, dayStr] = dateIso.split("-");
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const match = FIXED_HOLIDAYS.find((h) => h.month === month && h.day === day) ?? null;
  if (match && EXCLUDED_FIXED_HOLIDAY_IDS.has(match.id)) return null;
  return match;
}

export type ReligiousHolidayName =
  | "Ramazan Bayramı"
  | "Kurban Bayramı"
  | "Regaib Kandili"
  | "Miraç Kandili"
  | "Berat Kandili"
  | "Kadir Gecesi"
  | "Ramazan Başlangıcı"
  | "Mevlid Kandili"
  | "Hicri Yılbaşı"
  | "Aşure Günü";

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
// Başkanlığı'nın kendi alan adı) doğrulanmış yıllar burada yer alır. 2027 Ramazan/Kurban Bayramı
// kaydı 2026-09-03'te bu kaynaktan doğrudan alınmış ve kullanıcının kendi belirttiği tarihlerle
// birebir eşleşmiştir. 2026-09-08'de aynı kaynaktan (icerik=153 2026 sayfası, icerik=154 2027
// sayfası) kandil geceleri ve Ramazan başlangıcı için EK doğrulanmış kayıtlar alındı - yalnız
// BUGÜNDEN (2026-09-08) sonraki, henüz geçmemiş tarihler eklendi (geçmiş kayıt tutulmaz, çünkü
// otomatik yayın sistemi zaten yalnız ileriye dönük 30 günlük ufka bakar).
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
  {
    year: 2026, name: "Regaib Kandili", startDate: "2026-12-10", endDate: "2026-12-10",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=153",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Miraç Kandili", startDate: "2027-01-04", endDate: "2027-01-04",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Berat Kandili", startDate: "2027-01-22", endDate: "2027-01-22",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Ramazan Başlangıcı", startDate: "2027-02-08", endDate: "2027-02-08",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Kadir Gecesi", startDate: "2027-03-05", endDate: "2027-03-05",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Hicri Yılbaşı", startDate: "2027-06-06", endDate: "2027-06-06",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Aşure Günü", startDate: "2027-06-15", endDate: "2027-06-15",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
  {
    year: 2027, name: "Mevlid Kandili", startDate: "2027-08-13", endDate: "2027-08-13",
    sourceUrl: "https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154",
    retrievedAt: "2026-09-08T00:00:00.000Z", verified: true,
  },
];

// Mekanik bir vowel-harmony eki YERİNE her isim için doğru, bilinen-doğru Türkçe kalıp elle
// yazılır - "Kadir Gecesi"/"Aşure Günü" gibi isimler zaten 3. tekil iyelik eki taşıyan bileşik
// adlardır ("gece" + "-si", "gün" + "ü"); bunlara mekanik olarak "-ınız" eklemek çift-iyelik gibi
// dilbilgisi hatası üretir ("Kadir Gecesiniz" YANLIŞ). Doğru kalıp iyelik ekini 2. çoğul şahısla
// DEĞİŞTİRİR ("Kadir Geceniz", "Aşure Gününüz") - bu yüzden formül değil, açık eşleme kullanılır.
const RELIGIOUS_GREETING: Record<ReligiousHolidayName, string> = {
  "Ramazan Bayramı": "Ramazan Bayramınız mübarek olsun.",
  "Kurban Bayramı": "Kurban Bayramınız mübarek olsun.",
  "Regaib Kandili": "Regaib Kandiliniz mübarek olsun.",
  "Miraç Kandili": "Miraç Kandiliniz mübarek olsun.",
  "Berat Kandili": "Berat Kandiliniz mübarek olsun.",
  "Kadir Gecesi": "Kadir Geceniz mübarek olsun.",
  "Ramazan Başlangıcı": "Hayırlı Ramazanlar.",
  "Mevlid Kandili": "Mevlid Kandiliniz mübarek olsun.",
  "Hicri Yılbaşı": "Hicri Yılbaşınız mübarek olsun.",
  "Aşure Günü": "Aşure Gününüz mübarek olsun.",
};

export function religiousHolidayMessage(entry: ReligiousHolidayYearEntry): string {
  return RELIGIOUS_GREETING[entry.name];
}

// Bir tarih, kayıtlı bir dini bayram aralığına denk geliyorsa o kaydı döner (doğrulanmamış olsa
// bile - sınıflandırma kararı classifySpecialDaySafety'nin işi, burada yalnız EŞLEŞME bulunur).
export function getReligiousHolidayForDate(dateIso: string): ReligiousHolidayYearEntry | null {
  return RELIGIOUS_HOLIDAY_REGISTRY.find((entry) => dateIso >= entry.startDate && dateIso <= entry.endDate) ?? null;
}

// FRIDAY_MESSAGE (bölüm: kültürel/yerel editoryal takvim) - haftalık, sade, saygılı bir cuma
// mesajı. Uydurma bir dini alıntı/hadis/ayet ATFEDİLMEZ - yalnız genel, herkesçe bilinen, nötr
// iyi dilek ifadeleri. Agresif ticari CTA yok, sabit/deterministik seçim (ISO hafta numarasına
// göre) - her cuma FARKLI bir metin gelir ama aynı yıl/hafta için her zaman aynı sonucu üretir
// (test edilebilir, rastgele değil).
export const FRIDAY_MESSAGES: readonly string[] = [
  "Hayırlı cumalar.",
  "Cumanız mübarek olsun.",
  "Herkese huzurlu bir cuma günü diliyoruz.",
  "Hayırlı cumalar, iyi haftalar dileriz.",
  "Bugün güzel bir cuma günü olsun.",
  "Cumanız bereketli olsun.",
];

function isoWeekNumber(dateIso: string): number {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const dayNumber = (date.getUTCDay() + 6) % 7; // Pazartesi=0 ... Pazar=6
  date.setUTCDate(date.getUTCDate() - dayNumber + 3); // o haftanın Perşembesi
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstThursdayDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNumber + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

export function isFriday(dateIso: string): boolean {
  return new Date(`${dateIso}T00:00:00Z`).getUTCDay() === 5;
}

// Deterministik seçim - aynı tarih her zaman aynı mesajı üretir (rastgele/Math.random() yok),
// böylece hem test edilebilir hem de aynı gün iki kez çağrılırsa tutarlı kalır.
export function fridayMessageForDate(dateIso: string): string {
  const index = isoWeekNumber(dateIso) % FRIDAY_MESSAGES.length;
  return FRIDAY_MESSAGES[index];
}

export type SpecialDayMatch =
  | { kind: "fixed"; holiday: FixedHoliday; message: string }
  | { kind: "religious"; entry: ReligiousHolidayYearEntry; message: string }
  | { kind: "friday"; message: string };

// Bir tarih için özel gün eşleşmesi arar - öncelik sırası: sabit resmi tatil > dini bayram/kandil
// > cuma mesajı (Friday en düşük öncelikli - o gün zaten anlamlı bir özel gün varsa jenerik cuma
// mesajıyla ikiye bölünmesin).
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
  if (isFriday(dateIso)) {
    return { kind: "friday", message: fridayMessageForDate(dateIso) };
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
  if (match.kind === "friday") {
    return { automationClass: "AUTO_SAFE", reason: "Sabit, önceden yazılmış, deterministik cuma mesajı - değişken bilgi yok." };
  }
  if (match.entry.verified) {
    return { automationClass: "AUTO_SAFE", reason: `Diyanet İşleri Başkanlığı resmi kaynağından doğrulandı (${match.entry.sourceUrl}, ${match.entry.retrievedAt}).` };
  }
  return { automationClass: "REVIEW_REQUIRED", reason: `${match.entry.year} yılı ${match.entry.name} tarihi resmi Diyanet kaynağından henüz doğrulanmadı - otomatik yayınlanamaz.` };
}
