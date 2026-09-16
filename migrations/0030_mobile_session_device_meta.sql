-- Mobil cihaz listesinde platform ve uygulama sürümünü gösterebilmek için mobile_sessions'a
-- üç opsiyonel sütun eklenir. Tamamen ek (additive) bir değişikliktir: mevcut satırlar NULL
-- kalır, hiçbir veri taşınmaz/silinmez, müşteri/rezervasyon/ödeme tablolarına dokunulmaz.
--
-- Platform eşleştirme anında payload'dan ya da User-Agent'tan çıkarılır (bkz.
-- src/lib/mobile-pairing.ts -> resolvePlatform), böylece hâlihazırda yayında olan mobil
-- sürümler için de yeni build gerekmeden doldurulabilir.
ALTER TABLE mobile_sessions ADD COLUMN platform TEXT;
ALTER TABLE mobile_sessions ADD COLUMN app_version TEXT;
ALTER TABLE mobile_sessions ADD COLUMN app_build TEXT;
