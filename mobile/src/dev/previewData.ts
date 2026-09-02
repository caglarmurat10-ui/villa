// Yalnız tasarım önizlemesi (VITE_PREVIEW_MODE=true) için sahte/uydurma veri. Gerçek misafir
// PII'si YOK - isimler tamamen kurgusal. Bu dosya production/native build'e hiçbir davranış
// eklemez; import.meta.env.VITE_PREVIEW_MODE production'da varsayılan olarak "false"tur
// (bkz. api/client.ts, auth/AuthContext.tsx - fail closed).

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

const dashboard = {
  today: iso(today),
  checkInsToday: [
    { id: "preview-1", villa: "Safira", guestName: "Ayşe Yılmaz", phone: "905551112233", checkIn: addDays(0), checkOut: addDays(4), totalAmount: 24000, paidAmount: 12000 },
  ],
  checkOutsToday: [
    { id: "preview-2", villa: "Destan", guestName: "Mehmet Demir", phone: "905552223344", checkIn: addDays(-5), checkOut: addDays(0), totalAmount: 18000, paidAmount: 18000 },
  ],
  upcomingReservations: [
    { id: "preview-3", villa: "Safira", guestName: "Elif Kaya", checkIn: addDays(3), checkOut: addDays(7) },
    { id: "preview-4", villa: "Destan", guestName: "Can Öztürk", checkIn: addDays(6), checkOut: addDays(9) },
  ],
  villaStatus: { Safira: { activeReservations: 3 }, Destan: { activeReservations: 2 } },
  social: { scheduledToday: 2, publishedToday: 1, failed: 0, destanInstagramHardBlocked: true },
  otaNeedsReview: { count: 1, blocks: [{ villa: "Safira", source: "airbnb", startDate: addDays(10), endDate: addDays(12) }] },
};

const reservationList = [
  { id: "preview-1", villa: "Safira", guestName: "Ayşe Yılmaz", phone: "905551112233", checkIn: addDays(0), checkOut: addDays(4), totalAmount: 24000, paidAmount: 12000, channel: "Doğrudan" },
  { id: "preview-2", villa: "Destan", guestName: "Mehmet Demir", phone: "905552223344", checkIn: addDays(-5), checkOut: addDays(0), totalAmount: 18000, paidAmount: 18000, channel: "Airbnb" },
  { id: "preview-3", villa: "Safira", guestName: "Elif Kaya", phone: "", checkIn: addDays(3), checkOut: addDays(7), totalAmount: 21000, paidAmount: 5000, channel: "Booking" },
  { id: "preview-4", villa: "Destan", guestName: "Can Öztürk", phone: "905553334455", checkIn: addDays(6), checkOut: addDays(9), totalAmount: 16500, paidAmount: 0, channel: "Doğrudan" },
];

const reservations = { reservations: reservationList };

const calendar = {
  reservations: reservationList.map((r) => ({
    id: r.id, villa: r.villa, guestName: r.guestName, phone: r.phone, checkIn: r.checkIn, checkOut: r.checkOut,
    channel: r.channel, notes: "", totalAmount: r.totalAmount, paidAmount: r.paidAmount, source: "direct", confidence: "confirmed",
  })),
  otaBlocks: [
    { villa: "Safira", checkIn: addDays(10), checkOut: addDays(12), source: "airbnb", confidence: "needs_review" },
  ],
};

const social = {
  posts: [
    { id: "s1", villa: "Safira", platform: "Instagram", contentType: "Gönderi", caption: "Patara'da doğayla iç içe, sakin ve keyifli bir tatil için Villa Safira sizi bekliyor.", mediaUrl: "", scheduledDate: addDays(0), scheduledTime: "11:30", status: "Planlandı", approvalStatus: "Onaylandı", lastPublishError: null, automationClass: "AUTO_SAFE" as const, destanInstagramHardBlocked: false },
    { id: "s2", villa: "Destan", platform: "Facebook", contentType: "Hikâye", caption: "Villa Destan'da hafta sonu kaçamağı.", mediaUrl: "", scheduledDate: addDays(1), scheduledTime: "09:00", status: "Planlandı", approvalStatus: "İnsan onayı", lastPublishError: null, automationClass: "REVIEW_REQUIRED" as const, destanInstagramHardBlocked: false },
    { id: "s3", villa: "Destan", platform: "Instagram", contentType: "Reels", caption: "Villa Destan tanıtım videosu.", mediaUrl: "", scheduledDate: addDays(2), scheduledTime: "10:00", status: "Planlandı", approvalStatus: "İnsan onayı", lastPublishError: null, automationClass: "BLOCKED" as const, destanInstagramHardBlocked: true },
    { id: "s4", villa: "Safira", platform: "Facebook", contentType: "Gönderi", caption: "Geçtiğimiz hafta yayınlandı.", mediaUrl: "", scheduledDate: addDays(-1), scheduledTime: null, status: "Yayınlandı", approvalStatus: "Onaylandı", lastPublishError: null, automationClass: "AUTO_SAFE" as const, destanInstagramHardBlocked: false },
  ],
};

// Gerçek, halka açık villa tanıtım görselleri (safiradestan.com'da zaten yayında - PII değil).
const villas = {
  villas: [
    { slug: "villa-safira", villa: "Safira", name: "Villa Safira", address: "Gelemiş Mah. Karaağaçlıboğaz Sk. Kale Mevki No:60/9, 07976 Kaş/Antalya", coverImage: "https://safiradestan.com/villas/safira-hero-20260830.jpg", website: "https://safiradestan.com/villa-safira", mapsUrl: "https://maps.app.goo.gl/fKBpCQhn5Qneuo5H6", instagram: "https://instagram.com/villasafirapatara/", facebook: "https://www.facebook.com/villasafirapatara", whatsappUrl: "https://wa.me/905412424455", phone: "905412424455", airbnbUrl: "https://www.airbnb.com/rooms/48761834", bookingUrl: null },
    { slug: "villa-destan", villa: "Destan", name: "Villa Destan", address: "Gelemiş Mah. Patara, 07976 Kaş/Antalya", coverImage: "https://safiradestan.com/villas/destan-hero-20260830.jpg", website: "https://safiradestan.com/villa-destan", mapsUrl: "https://maps.app.goo.gl/8zCrgoegzri52ro79", instagram: "https://instagram.com/villadestanpatara/", facebook: "https://www.facebook.com/villadestanpatara", whatsappUrl: "https://wa.me/905412424455", phone: "905412424455", airbnbUrl: "https://www.airbnb.com/rooms/51842201", bookingUrl: null },
  ],
};

const googleVisibility = {
  snapshot: {
    sitemapUrls: Array.from({ length: 10 }, (_, i) => `https://safiradestan.com/preview-${i}`),
    jsonLdPages: ["/ (WebSite, Organization, FAQPage)", "/villa-safira", "/villa-destan"],
    mapsLinkConfigured: { Safira: true, Destan: true },
    placesApiConfigured: false,
    placeIdConfigured: { Safira: false, Destan: false },
    reviewRequestUrlConfigured: { Safira: false, Destan: false },
    gbpState: "WAITING_API_ACCESS",
    reviewAutomationState: "WAITING_API_ACCESS",
    napPhone: "+90 541 242 44 55",
  },
};

export function getPreviewFixture(path: string, method: string, body?: unknown): unknown | undefined {
  if (method === "GET" && path.startsWith("/dashboard")) return dashboard;
  if (method === "GET" && path.startsWith("/reservations")) return reservations;
  if (method === "GET" && path.startsWith("/calendar")) return calendar;
  if (method === "GET" && path.startsWith("/social")) return social;
  if (method === "GET" && path.startsWith("/villas")) return villas;
  if (method === "GET" && path.startsWith("/google-visibility")) return googleVisibility;
  if (method === "POST" && path.startsWith("/quote")) {
    const input = body as { checkIn?: string; checkOut?: string } | undefined;
    const nights = input?.checkIn && input?.checkOut
      ? Math.max(1, Math.round((new Date(input.checkOut).getTime() - new Date(input.checkIn).getTime()) / 86400000))
      : 1;
    const averageRate = 6000;
    return { total: nights * averageRate, nights, averageRate };
  }
  return undefined;
}
