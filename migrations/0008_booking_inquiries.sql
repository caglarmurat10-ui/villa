CREATE TABLE IF NOT EXISTS booking_inquiries (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  guest_count INTEGER NOT NULL DEFAULT 2 CHECK (guest_count BETWEEN 1 AND 12),
  note TEXT NOT NULL DEFAULT '',
  quoted_total REAL,
  quoted_nights INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Yeni' CHECK (status IN ('Yeni', 'İletişime geçildi', 'Kapatıldı')),
  source TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS booking_inquiries_status_idx ON booking_inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_inquiries_phone_idx ON booking_inquiries (phone_normalized, created_at DESC);
