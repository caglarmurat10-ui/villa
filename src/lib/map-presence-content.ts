import { VILLAS as VILLA_CONTENT, formatAddress, type VillaSlug } from "./villa-content";
import { WHATSAPP_PHONE_DISPLAY_INTL } from "./contact";
import type { Villa } from "./types";

// Harita platformu sabitleri + başvuru paketi üretimi - SAF veri/mantık, D1 veya Cloudflare context'e
// bağımlı DEĞİL. Bilinçli olarak map-presence.ts'ten AYRI tutuluyor: bu dosya hem sunucu (API route)
// hem istemci (MapPresencePanel, "use client") tarafından import edilir. map-presence.ts ise
// getCloudflareContext/D1 içerdiği için yalnız sunucu tarafında kullanılmalı - aksi halde D1/Workers
// bağımlılıkları istemci bundle'ına sızar.
export const MAP_PLATFORMS = ["GOOGLE", "APPLE", "YANDEX", "HERE", "TOMTOM", "OPENSTREETMAP", "GARMIN"] as const;
export type MapPlatform = (typeof MAP_PLATFORMS)[number];

export const MAP_PRESENCE_STATUSES = [
  "NOT_CHECKED",
  "EXISTS_CORRECT",
  "NEEDS_CORRECTION",
  "VERIFY_BEFORE_EXTERNAL_UPDATE",
  "CLAIM_STARTED",
  "ADDITION_SUBMITTED",
  "AWAITING_VERIFICATION",
  "VERIFIED",
  "BLOCKED",
] as const;
export type MapPresenceStatus = (typeof MAP_PRESENCE_STATUSES)[number];

// ============ Başvuru paketleri (Apple/Yandex/HERE/TomTom/OSM/Garmin submission packet) ============
// Her platform için RESMİ/doğrulanmış süreç bilgisi - hiçbir URL/adım uydurulmadı, 2026-09-09'da
// bağımsız web araştırmasıyla doğrulandı (kaynaklar aşağıda). Bazı platformların TAM bir self-servis
// "işletme ekle" akışı YOK (TomTom Türkiye'de desteklenmiyor görünüyor, Garmin'in doğrudan bir
// kanalı yok) - bu durumlar OLDUĞU GİBİ, gizlenmeden belirtilir.
export interface MapPlatformInfo {
  label: string;
  officialUrl: string;
  processSummary: string;
  limitationNote: string | null; // varsa: bilinen kısıtlama (ör. ülke desteği, doğrulama gereksinimi)
  sourceUrl: string; // bu bilginin doğrulandığı kaynak (denetim/şeffaflık için)
}

export const MAP_PLATFORM_INFO: Record<MapPlatform, MapPlatformInfo> = {
  GOOGLE: {
    label: "Google Business Profile",
    officialUrl: "https://business.google.com",
    processSummary: "Google hesabıyla giriş yapıp işletmeyi arayın/ekleyin, adres ve telefonu doğrulayın. Bu uygulamada zaten OAuth tabanlı gerçek konum eşleme akışı var (bkz. Google Görünürlüğü paneli).",
    limitationNote: null,
    sourceUrl: "https://business.google.com",
  },
  APPLE: {
    label: "Apple Business Connect",
    officialUrl: "https://businessconnect.apple.com",
    processSummary: "Apple ID ile giriş yapıp Locations → Add ile işletme aranır/eklenir. 2026 itibarıyla İKİ doğrulama yöntemi gerekiyor: (Business ID/D-U-N-S/EIN, alan adı DNS TXT doğrulaması, App Store Connect bağlantısı) seçeneklerinden biri VE resmi bir belge (işyeri ruhsatı, vergi levhası, kira sözleşmesi, fatura gibi) - hangisinin en pratik olduğuna işletme sahibi karar vermeli.",
    limitationNote: "Doğrulama için resmi bir işletme belgesi (vergi levhası/işyeri ruhsatı gibi) hazır bulundurulmalı - bu adım uygulama tarafından atlanamaz/otomatikleştirilemez.",
    sourceUrl: "https://www.brightlocal.com/learn/add-claim-apple-maps-business-listing/",
  },
  YANDEX: {
    label: "Yandex Business (Haritalar)",
    officialUrl: "https://business.yandex.com.tr",
    processSummary: "Yandex ID ile giriş yapıp \"İşletme ekle\" ile ad/kategori/tam adres/telefon/çalışma saatleri girilir. Telefon doğrulama koduyla onaylanır, değerlendirme genellikle 3-4 gün sürer. Temel kayıt ücretsizdir.",
    limitationNote: "Telefon doğrulaması için verilen numaraya gelen aramayı yanıtlamak gerekir.",
    sourceUrl: "https://business.yandex.com.tr",
  },
  HERE: {
    label: "HERE WeGo / Map Creator",
    officialUrl: "https://mapcreator.here.com",
    processSummary: "HERE Map Creator üzerinden hesap açıp doğrudan haritaya işletme (nokta/POI) eklenir - fotoğraf ve çalışma saatleri de girilebilir. Alternatif: appsupport@here.com adresine işletme bilgileriyle e-posta gönderilebilir.",
    limitationNote: null,
    sourceUrl: "https://here.freshdesk.com/en/support/solutions/articles/24000068345",
  },
  TOMTOM: {
    label: "TomTom Places",
    officialUrl: "https://places.tomtom.com",
    processSummary: "Önce TomTom Places'te işletme aranır; yoksa TomTom hesabıyla MapShare Reporter üzerinden pin bırakılıp bilgiler girilir.",
    limitationNote: "TomTom'un doğrudan self-servis ekleme hizmeti bilinen kaynaklara göre yalnız belirli ülkelerde sunuluyor ve Türkiye bu listede görünmüyor - başvuru öncesi TomTom Places'te güncel durumu kontrol edin, hizmet bu bölgede sunulmuyor olabilir.",
    sourceUrl: "https://discussions.tomtom.com/en/discussion/1032232/add-my-business-on-mydrive",
  },
  OPENSTREETMAP: {
    label: "OpenStreetMap",
    officialUrl: "https://www.openstreetmap.org",
    processSummary: "Ücretsiz bir OSM hesabı oluşturup haritada ilgili konuma \"Edit\" (iD editör) ile bir nokta eklenir; konaklama için amenity=hotel veya guest_house gibi etiketler kullanılır.",
    limitationNote: "Topluluk tarafından düzenlenen açık bir veri kaynağıdır - eklenen bilgi diğer katkıcılar tarafından da düzenlenebilir.",
    sourceUrl: "https://help.openstreetmap.org/questions/13845/add-my-own-business-to-openstreetmap/",
  },
  GARMIN: {
    label: "Garmin",
    officialUrl: "https://support.garmin.com",
    processSummary: "Garmin'in kendi başına bağımsız bir self-servis \"işletme ekle\" kanalı yok - Garmin haritaları büyük ölçüde HERE/TomTom gibi üçüncü taraf veri sağlayıcılarından besleniyor. En pratik yol: işletmeyi HERE, TomTom ve OpenStreetMap'e eklemek; bu veriler zamanla Garmin haritalarına yansıyabilir.",
    limitationNote: "Doğrudan/garantili bir zaman çizelgesi yok - güncelleme haritanın hangi veri sağlayıcısını kullandığına bağlı.",
    sourceUrl: "https://www.navigation-professionell.de/en/point-of-interest-marketing-adding-a-poi-to-a-navi-map/",
  },
};

export interface SubmissionPacket {
  villa: Villa;
  platform: MapPlatform;
  platformInfo: MapPlatformInfo;
  businessName: string;
  address: string;
  phone: string;
  website: string;
  category: string;
  addressWarning: string | null;
}

// Villa Destan'ın kapı numarası konusunda BİLİNEN bir belirsizlik var (No:30 mu No:30/1 mi) -
// villa-content.ts'teki TEK kayıtlı değer "No:30", ama bu round 4'te işletme sahibi tarafından
// kesin olmadığı belirtildi. Bu KOD BU BELİRSİZLİĞİ ÇÖZMEZ/TAHMİN ETMEZ - yalnız dış platformlara
// (Apple/Yandex/HERE/TomTom/OSM/Garmin) gönderilecek her pakette AÇIK bir uyarı taşır, böylece
// yanlış adres sessizce dışarı sızmaz. Adres gerçekten doğrulandığında (tapu/tabela kontrolü) bu
// uyarı villa-content.ts'teki tek kaynaktan kaldırılmalı - burada değil.
const DESTAN_ADDRESS_VERIFICATION_WARNING =
  "Kapı numarası doğrulanmalı: sistemde \"No:30\" kayıtlı, ancak gerçek kapı numarasının \"No:30/1\" olabileceği belirtildi. Bu paketi herhangi bir dış harita platformuna göndermeden ÖNCE gerçek tabela/tapu kaydından kesin numarayı doğrulayın.";

export function buildSubmissionPacket(villa: Villa, platform: MapPlatform): SubmissionPacket {
  const slug: VillaSlug = villa === "Safira" ? "villa-safira" : "villa-destan";
  const content = VILLA_CONTENT[slug];
  return {
    villa,
    platform,
    platformInfo: MAP_PLATFORM_INFO[platform],
    businessName: content.name,
    address: formatAddress(content.address),
    phone: WHATSAPP_PHONE_DISPLAY_INTL,
    website: "https://safiradestan.com",
    category: "Tatil evi / Villa kiralama (Vacation rental)",
    addressWarning: villa === "Destan" ? DESTAN_ADDRESS_VERIFICATION_WARNING : null,
  };
}
