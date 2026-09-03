import SettingsCenter from "@/components/SettingsCenter";
import SecuritySettingsCard from "@/components/SecuritySettingsCard";
import { getCommissionRate, getVillaLocations, listPriceRanges } from "@/lib/db";
import { computePriceCoverage } from "@/lib/price-engine";
import type { PriceCoverageReport } from "@/lib/price-engine";
import { isClosedSeasonDate } from "@/lib/season-policy";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

const COVERAGE_WINDOW_DAYS = 330; // Google Vacation Rentals'ın desteklediği booking window ile aynı - tek kaynak

export default async function AyarlarPage() {
  const [commission, prices, locations] = await Promise.all([
    getCommissionRate(),
    listPriceRanges(),
    getVillaLocations(),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const villas: Villa[] = ["Safira", "Destan"];
  const priceCoverage = Object.fromEntries(
    villas.map((villa) => [villa, computePriceCoverage(prices.filter((p) => p.villa === villa), todayIso, COVERAGE_WINDOW_DAYS, isClosedSeasonDate)]),
  ) as Record<Villa, PriceCoverageReport>;

  return <main className="ops-page">
    <header className="ops-page-head">
      <div><span className="ops-eyebrow">VİLLA YÖNETİM / SİSTEM</span><h1>Ayarlar</h1><p>Komisyon, villa konumları, dönemsel fiyatlar ve veri yedeklerini tek merkezden yönetin.</p></div>
    </header>
    <SettingsCenter initialCommission={commission} initialPrices={prices} initialLocations={locations} priceCoverage={priceCoverage} />
    <SecuritySettingsCard />
  </main>;
}
