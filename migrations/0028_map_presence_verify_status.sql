-- 0027'deki map_presence_status.status CHECK constraint'i VERIFY_BEFORE_EXTERNAL_UPDATE'i
-- içermiyordu (round 4'te eklenen yeni durum - Destan'ın kapı numarası belirsizliği ["No:30" mu
-- "No:30/1" mi] doğrulanana kadar dış platformlara gönderim öncesi uyarı amaçlı). SQLite CHECK
-- constraint'i doğrudan ALTER TABLE ile değiştirilemediğinden tabloyu yeniden oluşturuyoruz -
-- veri kaybı olmadan (mevcut satırlar aynen kopyalanır). Migration 0027 hiç uygulanmamışsa (yalnız
-- self-heal CREATE TABLE IF NOT EXISTS çalıştıysa, ki o zaten CHECK constraint taşımıyordu) bu
-- migration yine sorunsuz çalışır.
CREATE TABLE map_presence_status_new (
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  platform TEXT NOT NULL CHECK (platform IN ('GOOGLE', 'APPLE', 'YANDEX', 'HERE', 'TOMTOM', 'OPENSTREETMAP', 'GARMIN')),
  status TEXT NOT NULL DEFAULT 'NOT_CHECKED' CHECK (status IN ('NOT_CHECKED', 'EXISTS_CORRECT', 'NEEDS_CORRECTION', 'VERIFY_BEFORE_EXTERNAL_UPDATE', 'CLAIM_STARTED', 'ADDITION_SUBMITTED', 'AWAITING_VERIFICATION', 'VERIFIED', 'BLOCKED')),
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (villa, platform)
);

INSERT INTO map_presence_status_new (villa, platform, status, note, updated_at)
  SELECT villa, platform, status, note, updated_at FROM map_presence_status;

DROP TABLE map_presence_status;

ALTER TABLE map_presence_status_new RENAME TO map_presence_status;
