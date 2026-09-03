import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "../types";

// Safira/Destan -> GBP location eslesmesi YALNIZ admin'in acikca "Location seç" ile onayladigi
// deger olarak GOOGLE_PRIVATE KV'de tutulur. Bu dosyada hicbir isim-benzerligi/otomatik eslestirme
// mantigi YOK - setGbpLocationMapping yalnizca dogrudan bir admin action'indan cagrilmali.
function mappingKey(villa: Villa): string {
  return `gbp:location:${villa}`;
}

export interface GbpLocationMapping {
  locationName: string; // "accounts/{id}/locations/{id}"
  locationTitle: string; // yalniz gorunum icin - yeniden dogrulama gerektiginde adapter'dan tazelenir
  selectedAt: string;
}

export async function getGbpLocationMapping(villa: Villa): Promise<GbpLocationMapping | null> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GOOGLE_PRIVATE) return null;
  const raw = await env.GOOGLE_PRIVATE.get(mappingKey(villa));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GbpLocationMapping;
  } catch {
    return null;
  }
}

export async function getAllGbpLocationMappings(): Promise<Record<Villa, GbpLocationMapping | null>> {
  const [safira, destan] = await Promise.all([getGbpLocationMapping("Safira"), getGbpLocationMapping("Destan")]);
  return { Safira: safira, Destan: destan };
}

// Yalniz bu fonksiyon KV'ye yazar - admin acikca bir location secip onayladiginda cagrilir
// (bkz. /api/admin/google/gbp/select-location). locationName, discoverGbpAccountsAndLocations()
// sonucunda gerçekten dönen bir kayıttan gelmeli - çağıran taraf bunu doğrulamalı.
export async function setGbpLocationMapping(villa: Villa, locationName: string, locationTitle: string): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GOOGLE_PRIVATE) throw new Error("GOOGLE_PRIVATE_NOT_CONFIGURED");
  const mapping: GbpLocationMapping = { locationName, locationTitle, selectedAt: new Date().toISOString() };
  await env.GOOGLE_PRIVATE.put(mappingKey(villa), JSON.stringify(mapping));
}

export async function clearGbpLocationMapping(villa: Villa): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GOOGLE_PRIVATE) return;
  await env.GOOGLE_PRIVATE.delete(mappingKey(villa));
}
