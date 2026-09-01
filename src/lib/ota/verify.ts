import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";
import type { OtaPlatform } from "./types";
import { fetchIcsSafelyStaged, hasAllowlistedHosts, StagedFetchError, type OtaVerifyStage } from "./security";
import { parseIcsEvents, type ParsedIcsEvent } from "./ics-parser";

// Kullanıcıya asla full URL/path/token gösterilmez - yalnız platforma özel, güvenli bir mesaj +
// hangi aşamada başarısız olduğu (stage). Bu, Airbnb gibi allowlist'i "doğru" görünen ama gerçek
// URL'de yine de başarısız olan durumlarda, secret hiçbir şey açığa çıkarmadan teşhis koymayı
// sağlar - hangi aşamanın başarısız olduğu güvenlidir, URL'nin kendisi değildir.
const UNSUPPORTED_FORMAT_MESSAGE: Record<OtaPlatform, string> = {
  airbnb: "Airbnb takvim bağlantısı doğrulanamadı.",
  booking: "Bu Booking.com takvim bağlantısı desteklenen export formatında değil.",
};

export interface IcsVerifyResult {
  ok: boolean;
  eventCount?: number;
  earliestDate?: string | null;
  latestDate?: string | null;
  conflictCount?: number;
  stage?: OtaVerifyStage;
  message?: string;
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function countConflicts(db: D1Database, villa: Villa, platform: OtaPlatform, events: ParsedIcsEvent[]): Promise<number> {
  let count = 0;
  for (const event of events) {
    const directConflict = await db.prepare(
      "SELECT id FROM reservations WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1",
    ).bind(villa, event.endDate, event.startDate).first();
    const otherOtaConflict = await db.prepare(
      "SELECT id FROM external_blocks WHERE villa = ? AND source != ? AND status IN ('active','needs_review') AND start_date < ? AND end_date > ? LIMIT 1",
    ).bind(villa, platform, event.endDate, event.startDate).first();
    if (directConflict || otherOtaConflict) count += 1;
  }
  return count;
}

// Gerçek fetch + gerçek parse + gerçek çakışma sayımı - hiçbir sahte/varsayılan sonuç üretmez.
// Ham ICS metnini, URL'yi veya query/token'ı ASLA loglamaz ya da döndürmez - yalnız sayısal özet
// + (başarısızlıkta) hangi aşamada durduğu döner. Bu fonksiyon KV/D1'e HİÇBİR ŞEY YAZMAZ (yalnız
// okuma) - kaydetme kararı çağıran route'a ait.
export async function verifyIcsUrl(villa: Villa, platform: OtaPlatform, url: string): Promise<IcsVerifyResult> {
  if (!hasAllowlistedHosts(platform)) {
    return { ok: false, stage: "initial-url-validation", message: `${UNSUPPORTED_FORMAT_MESSAGE[platform]} (platform henüz yapılandırılmadı)` };
  }

  let icsText: string;
  try {
    icsText = await fetchIcsSafelyStaged(url, platform);
  } catch (error) {
    if (error instanceof StagedFetchError) {
      return { ok: false, stage: error.stage, message: UNSUPPORTED_FORMAT_MESSAGE[platform] };
    }
    return { ok: false, stage: "fetch", message: UNSUPPORTED_FORMAT_MESSAGE[platform] };
  }

  if (!icsText.includes("BEGIN:VCALENDAR")) {
    return { ok: false, stage: "ics-content-validation", message: "Geçerli bir ICS/VCALENDAR formatı değil." };
  }

  let events: ParsedIcsEvent[];
  try {
    events = parseIcsEvents(icsText);
  } catch {
    return { ok: false, stage: "ics-parse", message: "Takvim içeriği ayrıştırılamadı." };
  }

  const dates = events.flatMap((event) => [event.startDate, event.endDate]).sort();
  const db = await database();
  const conflictCount = await countConflicts(db, villa, platform, events);

  return {
    ok: true,
    eventCount: events.length,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    conflictCount,
  };
}
