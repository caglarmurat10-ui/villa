-- SOCIAL_AUTO_PUBLISH_TIME tek bir global saat olduğu için aynı gün due olan tüm içerik anında
-- birlikte yayına uygun hale geliyordu (cron her 15 dakikada LIMIT kadar çekiyor - içerik patlaması
-- riski). scheduled_time (HH:MM, Europe/Istanbul) her satırın kendi due anını global saatten
-- bağımsızlaştırır; NULL ise mevcut davranış (global SOCIAL_AUTO_PUBLISH_TIME) aynen korunur.
ALTER TABLE social_posts ADD COLUMN scheduled_time TEXT;
