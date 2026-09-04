import OtaIntegrationsPanel from "@/components/OtaIntegrationsPanel";
import IntegrationCenterPanel from "@/components/IntegrationCenterPanel";
import GbpLocationPicker from "@/components/GbpLocationPicker";
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
      <section style={{ maxWidth: 1250, margin: "0 auto 18px", padding: "0 20px" }}>
        <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
          <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>GOOGLE BUSINESS PROFILE</small>
          <h2 style={{ margin: "5px 0 4px", fontSize: 18 }}>Safira / Destan işletme eşlemesi</h2>
          <p style={{ margin: 0, color: "#9fb0c5", fontSize: 10, lineHeight: 1.55 }}>
            Google hesabındaki doğrulanmış işletmeleri salt-okunur keşfeder. İsim benzerliğiyle otomatik eşleştirme yapılmaz; Villa Safira ve Villa Destan konumlarını aşağıdan açıkça seçin.
          </p>
          <GbpLocationPicker />
        </div>
      </section>
      <OtaIntegrationsPanel
        initialConnections={connections}
        initialHubActivated={hubActivated}
        initialHubReasons={hubReadiness.reasons}
      />
    </main>
  );
}
