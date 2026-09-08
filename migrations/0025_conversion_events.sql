-- Hafif, Cloudflare-first (D1) dönüşüm/attribution günlüğü (bölüm 6). GA4/GTM zaten client-side
-- event izleme yapıyor (src/lib/analytics.ts) - bu tablo onun YERİNE değil, ONUNLA BİRLİKTE çalışır:
-- amaç, hangi UTM kaynağının (özellikle sosyal medya gönderilerindeki linklerin) WhatsApp/rezervasyon/
-- iletişim dönüşümüne yol açtığını, işletme sahibinin kendi D1'inde, üçüncü taraf bir analytics paneline
-- gitmeden basitçe sorgulayabilmesi. PII YOK - yalnız event adı, hangi villa, UTM parametreleri,
-- iniş sayfası ve referrer HOST'u (tam referrer URL değil - sorgu string sızıntısı riski olmasın).
CREATE TABLE IF NOT EXISTS conversion_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL CHECK (event_name IN ('page_view','whatsapp_click','booking_click','contact_submit','instagram_click','facebook_click')),
  villa TEXT CHECK (villa IN ('Safira','Destan') OR villa IS NULL),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  landing_path TEXT,
  referrer_host TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS conversion_events_event_name_idx ON conversion_events (event_name, created_at);
CREATE INDEX IF NOT EXISTS conversion_events_utm_source_idx ON conversion_events (utm_source, created_at);
