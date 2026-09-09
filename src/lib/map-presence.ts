import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "./types";

// Harita görünürlüğü takip/iş akışı (bölüm 10/11, round 4'te operasyon merkezine genişletildi) -
// yalnız DURUM izleme + D1 kalıcılığı. Sabitler (MAP_PLATFORMS, MAP_PRESENCE_STATUSES) ve saf
// başvuru paketi mantığı (buildSubmissionPacket, MAP_PLATFORM_INFO) ./map-presence-content.ts'e
// taşındı - bu dosya D1/getCloudflareContext içerdiği için yalnız SUNUCU tarafında kullanılmalı,
// istemci bileşenleri (MapPresencePanel gibi) doğrudan map-presence-content'i import etmeli.
export {
  MAP_PLATFORMS,
  MAP_PRESENCE_STATUSES,
  MAP_PLATFORM_INFO,
  buildSubmissionPacket,
  type MapPlatform,
  type MapPresenceStatus,
  type MapPlatformInfo,
  type SubmissionPacket,
} from "./map-presence-content";
import type { MapPlatform, MapPresenceStatus } from "./map-presence-content";
import { MAP_PLATFORMS as PLATFORMS } from "./map-presence-content";

export interface MapPresenceEntry {
  villa: Villa;
  platform: MapPlatform;
  status: MapPresenceStatus;
  note: string;
  updatedAt: string;
}

type MapPresenceRow = {
  villa: Villa;
  platform: MapPlatform;
  status: MapPresenceStatus;
  note: string;
  updated_at: string;
};

let tableReady: Promise<void> | null = null;

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function prepareTable(db: D1Database): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS map_presence_status (
      villa TEXT NOT NULL, platform TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'NOT_CHECKED',
      note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (villa, platform)
    )`.replace(/\s+/g, " "),
  );
}

async function ensureTable(db: D1Database): Promise<void> {
  if (!tableReady) {
    tableReady = prepareTable(db).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

const VILLAS: Villa[] = ["Safira", "Destan"];

function mapRow(row: MapPresenceRow): MapPresenceEntry {
  return { villa: row.villa, platform: row.platform, status: row.status, note: row.note, updatedAt: row.updated_at };
}

// Her (villa, platform) çifti için var olan bir kayıt yoksa NOT_CHECKED varsayılan görünür - D1'e
// önceden 14 satır seed etmeye gerek yok, eksik kombinasyonlar burada tamamlanır.
export async function listMapPresence(): Promise<MapPresenceEntry[]> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare("SELECT * FROM map_presence_status").all<MapPresenceRow>();
  const existing = new Map((result.results ?? []).map((row) => [`${row.villa}:${row.platform}`, mapRow(row)]));
  const complete: MapPresenceEntry[] = [];
  for (const villa of VILLAS) {
    for (const platform of PLATFORMS) {
      const key = `${villa}:${platform}`;
      complete.push(existing.get(key) ?? { villa, platform, status: "NOT_CHECKED", note: "", updatedAt: "" });
    }
  }
  return complete;
}

export async function setMapPresenceStatus(villa: Villa, platform: MapPlatform, status: MapPresenceStatus, note?: string): Promise<MapPresenceEntry> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO map_presence_status (villa, platform, status, note, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (villa, platform) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`,
  ).bind(villa, platform, status, note ?? "", now).run();
  return { villa, platform, status, note: note ?? "", updatedAt: now };
}
