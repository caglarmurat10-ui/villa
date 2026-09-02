import { TopBar, Skeleton, ErrorState } from "../components/common";
import { useApi } from "../lib/useApi";
import { openMaps, openWhatsApp, openInstagram, openFacebook } from "../lib/deeplinks";

interface Villa {
  slug: string; villa: string; name: string; address: string; coverImage: string;
  website: string; mapsUrl: string | null; instagram: string; facebook: string; whatsappUrl: string;
}

export function VillasScreen() {
  const { data, loading, error, reload } = useApi<{ villas: Villa[] }>("/villas");

  return (
    <div>
      <TopBar title="Villalar" />
      <div className="app-content">
        {loading && <Skeleton count={2} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data?.villas.map((v) => (
          <div className="card" key={v.slug}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>{v.name}</h2>
            <p style={{ fontSize: 12, color: "#9fb0c5", margin: "0 0 10px" }}>{v.address}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => openWhatsApp(v.whatsappUrl)}>WhatsApp</button>
              {v.mapsUrl && <button className="btn" onClick={() => openMaps(v.mapsUrl!)}>Harita</button>}
              <button className="btn" onClick={() => openInstagram(v.instagram)}>Instagram</button>
              <button className="btn" onClick={() => openFacebook(v.facebook)}>Facebook</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
