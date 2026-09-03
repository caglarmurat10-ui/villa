-- Additive: haftalık esas fiyat modeli (2027-06-15 -> 2027-09-15 Safira/Destan kararı).
-- Mevcut price_ranges satırlarını bozmaz - üç kolon da NULL kalabilir, bu durumda price-engine.ts
-- eskisi gibi nightly_rate x gece hesaplar. Yalnız bu üç kolon DOLU olan bir dönem için
-- price-engine.ts canonical toplamı base_price_minor/base_nights üzerinden minor-unit-safe
-- (yuvarlama sürüklenmesiz) hesaplar - bkz. src/lib/price-engine.ts computePriceQuote.
ALTER TABLE price_ranges ADD COLUMN base_nights INTEGER;
ALTER TABLE price_ranges ADD COLUMN base_price_minor INTEGER;
ALTER TABLE price_ranges ADD COLUMN minimum_nights INTEGER;
