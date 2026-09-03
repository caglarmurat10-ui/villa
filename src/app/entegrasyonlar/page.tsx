import OtaIntegrationsPanel from "@/components/OtaIntegrationsPanel";
import IntegrationCenterPanel from "@/components/IntegrationCenterPanel";
import { listOtaConnectionsStatus } from "@/lib/ota/status";
import { checkHubReadiness, isHubActivated } from "@/lib/ota/hub";
import { getIntegrationCenterSnapshot } from "@/lib/integration-center";

export const dynamic = "force-dynamic";

export default async function EntegrasyonlarPage() {
  const [connections, hubActivated, hubReadiness, integrationSnapshot] = await Promise.all([
    listOtaConnectionsStatus(),
    isHubActivated(),
    checkHubReadiness(),
    getIntegrationCenterSnapshot(),
  ]);

  return (
    <main className="ops-page">
      <header className="ops-page-head">
        <div>
          <span className="ops-eyebrow">VİLLA YÖNETİM / SİSTEM</span>
          <h1>Entegrasyonlar</h1>
          <p>Airbnb ve Booking.com takvim senkronu - Faz 1: yalnız müsaitlik/tarih senkronu, çift rezervasyonu önler.</p>
        </div>
      </header>
      <IntegrationCenterPanel snapshot={integrationSnapshot} />
      <OtaIntegrationsPanel
        initialConnections={connections}
        initialHubActivated={hubActivated}
        initialHubReasons={hubReadiness.reasons}
      />
    </main>
  );
}
