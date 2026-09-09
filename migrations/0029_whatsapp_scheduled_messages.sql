-- Otomatik WhatsApp çıkış hatırlatma mesajları (yalnız resmi Meta WhatsApp Business Platform /
-- Cloud API için hazırlık - tarayıcı wa.me otomasyonu YOK, üçüncü taraf/gayri resmi kütüphane YOK).
-- Gerçek kimlik bilgileri (WHATSAPP_ACCESS_TOKEN vb.) yapılandırılana ve şablon Meta tarafından
-- ONAYLANANA kadar gönderim fail-closed kalır (bkz. src/lib/whatsapp/config.ts) - bu tablo o zamana
-- kadar da güvenle dolar (SKIPPED_NOT_CONFIGURED durumuyla), hiçbir sahte "gönderildi" üretmez.
--
-- IDEMPOTENCY: UNIQUE(reservation_id, message_type, checkout_date) - aynı rezervasyon aynı çıkış
-- tarihi için asla iki kez otomatik mesaj planlanamaz/gönderilemez. Çıkış tarihi değişirse yeni bir
-- satır (yeni checkout_date) açılır, eskisi CANCELLED işaretlenir - src/lib/whatsapp/store.ts'teki
-- syncCheckoutReminderForReservation() bu garantiyi ON CONFLICT ... DO UPDATE ... WHERE status =
-- 'SCHEDULED' deseniyle sağlar (yalnız hâlâ bekleyen bir satır güncellenir, SENT bir satıra asla
-- dokunulmaz).
CREATE TABLE IF NOT EXISTS whatsapp_scheduled_messages (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('CHECKOUT_REMINDER')),
  checkout_date TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
    'SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED', 'SKIPPED_NOT_CONFIGURED'
  )),
  provider_message_id TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  failed_at TEXT,
  failure_reason TEXT,
  -- Rezervasyon bazlı açık/kapalı anahtarı (admin panelinden) - senkronizasyon (telefon/tarih
  -- güncellemesi) bu alana DOKUNMAZ, yalnız explicit toggle endpoint'i değiştirir.
  auto_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (reservation_id, message_type, checkout_date)
);

CREATE INDEX IF NOT EXISTS whatsapp_scheduled_messages_due_idx ON whatsapp_scheduled_messages (status, scheduled_at);
CREATE INDEX IF NOT EXISTS whatsapp_scheduled_messages_reservation_idx ON whatsapp_scheduled_messages (reservation_id, message_type);
