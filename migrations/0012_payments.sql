CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'paytr'),
  merchant_oid TEXT NOT NULL UNIQUE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'full_payment', 'balance_payment')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded', 'partial_refund')),
  currency TEXT NOT NULL DEFAULT 'TRY',
  reservation_total_minor INTEGER NOT NULL CHECK (reservation_total_minor > 0),
  requested_amount_minor INTEGER NOT NULL CHECK (requested_amount_minor > 0),
  provider_customer_total_minor INTEGER,
  provider_fee_minor INTEGER,
  merchant_net_minor INTEGER,
  guest_email TEXT,
  no_installment INTEGER NOT NULL DEFAULT 1,
  max_installment INTEGER NOT NULL DEFAULT 0,
  token TEXT,
  token_expires_at TEXT,
  test_mode INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  failed_at TEXT
);
CREATE INDEX IF NOT EXISTS payments_reservation_idx ON payments (reservation_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
