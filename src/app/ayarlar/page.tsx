import SettingsCenter from "@/components/SettingsCenter";
import { getCommissionRate, getVillaLocations, listPriceRanges } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AyarlarPage() {
  const [commission, prices, locations] = await Promise.all([
    getCommissionRate(),
    listPriceRanges(),
    getVillaLocations(),
  ]);

  return <main className="ops-page">
    <header className="ops-page-head">
      <div><span className="ops-eyebrow">VİLLA YÖNETİM / SİSTEM</span><h1>Ayarlar</h1><p>Komisyon, villa konumları, dönemsel fiyatlar ve veri yedeklerini tek merkezden yönetin.</p></div>
    </header>
    <SettingsCenter initialCommission={commission} initialPrices={prices} initialLocations={locations} />
  </main>;
}
