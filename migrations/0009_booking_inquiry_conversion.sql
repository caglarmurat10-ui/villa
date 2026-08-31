ALTER TABLE booking_inquiries ADD COLUMN converted_reservation_id TEXT;
ALTER TABLE booking_inquiries ADD COLUMN converted_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS booking_inquiries_conversion_reservation_idx
ON booking_inquiries (converted_reservation_id);
