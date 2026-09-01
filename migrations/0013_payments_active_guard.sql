-- Aynı rezervasyon için birden fazla eşzamanlı aktif (created/pending) GERÇEK (test_mode=0) ödeme
-- denemesi oluşturulmasını D1/SQLite seviyesinde engeller - application-level "önce SELECT sonra
-- INSERT" kontrolüne güvenmez (o kontrol iki eşzamanlı istek arasında race'e açıktı).
-- Doğrulandı (remote D1'e karşı, bu migration'dan önce elle test edildi): partial UNIQUE index
-- SQLITE_CONSTRAINT_UNIQUE ile bekleneni reddediyor, test_mode=1 satırları etkilemiyor.
CREATE UNIQUE INDEX IF NOT EXISTS payments_active_real_reservation_idx
ON payments (reservation_id)
WHERE test_mode = 0 AND status IN ('created', 'pending');
