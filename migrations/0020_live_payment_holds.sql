-- Public self-service CANLI PayTR ödemesinde tarihleri ödeme süresince geçici olarak kilitler.
-- Amaç: iki müşterinin aynı villa/tarih için eşzamanlı gerçek tahsilata girmesini ve yönetim
-- panelinden ödeme sürerken çakışan rezervasyon açılmasını D1 seviyesinde engellemek.
CREATE TABLE IF NOT EXISTS booking_payment_holds (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'finalizing', 'paid', 'released')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS booking_payment_holds_overlap_idx
ON booking_payment_holds (villa, status, check_in, check_out, expires_at);

CREATE INDEX IF NOT EXISTS booking_payment_holds_inquiry_idx
ON booking_payment_holds (inquiry_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS booking_payment_holds_one_active_inquiry_idx
ON booking_payment_holds (inquiry_id)
WHERE status IN ('active', 'finalizing');

-- Yönetim/API tarafındaki tüm reservation INSERT yollarını merkezi olarak korur. Canlı ödeme
-- callback'i kendi hold'unu aynı transaction içinde önce 'finalizing' yaptığı için yalnız kendi
-- rezervasyonunu oluşturabilir; başka bir aktif hold ise INSERT'i abort eder.
CREATE TRIGGER IF NOT EXISTS booking_payment_holds_block_reservation_insert
BEFORE INSERT ON reservations
WHEN NEW.deleted_at IS NULL AND EXISTS (
  SELECT 1
  FROM booking_payment_holds h
  WHERE h.status = 'active'
    AND julianday(h.expires_at) > julianday('now')
    AND h.villa = NEW.villa
    AND h.check_in < NEW.check_out
    AND h.check_out > NEW.check_in
)
BEGIN
  SELECT RAISE(ABORT, 'Bu tarihler için müşteri kart ödeme işlemi sürüyor.');
END;

-- Mevcut bir rezervasyonun tarih/villasını ödeme kilidinin üstüne taşımayı da engeller.
CREATE TRIGGER IF NOT EXISTS booking_payment_holds_block_reservation_update
BEFORE UPDATE OF villa, check_in, check_out, deleted_at ON reservations
WHEN NEW.deleted_at IS NULL AND EXISTS (
  SELECT 1
  FROM booking_payment_holds h
  WHERE h.status = 'active'
    AND julianday(h.expires_at) > julianday('now')
    AND h.villa = NEW.villa
    AND h.check_in < NEW.check_out
    AND h.check_out > NEW.check_in
)
BEGIN
  SELECT RAISE(ABORT, 'Bu tarihler için müşteri kart ödeme işlemi sürüyor.');
END;
