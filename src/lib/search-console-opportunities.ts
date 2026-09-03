// Search Console "firsat motoru" - SAF fonksiyon, hicbir network/D1 cagrisi yok, kolay test edilir.
// Google'a gonderilen/degistirilen hicbir sey yok (yalnizca oku), title/meta otomatik degistirilmez -
// yalniz oneri metni uretir. Veri yetersizse UYDURULMAZ, hasEnoughData=false doner.

export type SearchConsoleQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleOpportunityType = "high_impression_low_ctr" | "mid_position";

export interface SearchConsoleOpportunity {
  type: SearchConsoleOpportunityType;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  suggestion: string;
}

export interface SearchConsoleOpportunities {
  hasEnoughData: boolean;
  opportunities: SearchConsoleOpportunity[];
}

const MIN_ROWS_FOR_SIGNAL = 3;
const MIN_IMPRESSIONS = 5;
const LOW_CTR_FACTOR = 0.5; // site ortalama CTR'sinin yarısından azi "dusuk" sayilir
const MID_POSITION_MIN = 4;
const MID_POSITION_MAX = 15;
const MAX_OPPORTUNITIES_PER_TYPE = 5;

export function computeSearchConsoleOpportunities(
  rows: SearchConsoleQueryRow[],
  siteAverageCtr: number,
): SearchConsoleOpportunities {
  const meaningfulRows = rows.filter((row) => row.impressions >= MIN_IMPRESSIONS);
  if (meaningfulRows.length < MIN_ROWS_FOR_SIGNAL) {
    return { hasEnoughData: false, opportunities: [] };
  }

  const lowCtrThreshold = siteAverageCtr * LOW_CTR_FACTOR;

  const highImpressionLowCtr = meaningfulRows
    .filter((row) => row.ctr < lowCtrThreshold)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_OPPORTUNITIES_PER_TYPE)
    .map((row): SearchConsoleOpportunity => ({
      ...row,
      type: "high_impression_low_ctr",
      suggestion: `"${row.query}" için ${row.impressions} gösterim var ama CTR düşük (%${(row.ctr * 100).toFixed(1)}) - başlık/meta description bu sorguyla daha net eşleşecek şekilde gözden geçirilebilir.`,
    }));

  const midPosition = meaningfulRows
    .filter((row) => row.position >= MID_POSITION_MIN && row.position <= MID_POSITION_MAX)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_OPPORTUNITIES_PER_TYPE)
    .map((row): SearchConsoleOpportunity => ({
      ...row,
      type: "mid_position",
      suggestion: `"${row.query}" ortalama ${row.position.toFixed(1)}. sırada - ilk sayfanın üstüne çıkma potansiyeli var, ilgili sayfanın içerik derinliği/iç bağlantıları güçlendirilebilir.`,
    }));

  return { hasEnoughData: true, opportunities: [...highImpressionLowCtr, ...midPosition] };
}
