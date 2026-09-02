import { TopBar, Skeleton, ErrorState } from "../components/common";
import { useApi } from "../lib/useApi";
import { openMaps, openWhatsApp, openPhone, openInstagram, openFacebook, openOtaListing } from "../lib/deeplinks";
import { normalizeWhatsAppNumber } from "../lib/messageTemplates";

interface Villa {
  slug: string; villa: string; name: string; address: string; coverImage: string;
  website: string; mapsUrl: string | null; instagram: string; facebook: string; whatsappUrl: string;
  phone: string; airbnbUrl: string | null; bookingUrl: string | null;
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
          <div className="card" key={v.slug} style={{ padding: 0, overflow: "hidden" }}>
            <img src={v.coverImage} alt={v.name} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} loading="lazy" />
            <div style={{ padding: 14 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>{v.name}</h2>
              <p style={{ fontSize: 12, color: "#9fb0c5", margin: "0 0 10px" }}>{v.address}</p>
              <a href={v.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: "block", marginBottom: 10 }}>{v.website.replace("https://", "")}</a>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => openWhatsApp(v.whatsappUrl)}>WhatsApp</button>
                {v.phone && <button className="btn" onClick={() => openPhone(normalizeWhatsAppNumber(v.phone))}>Ara</button>}
                {v.mapsUrl && <button className="btn" onClick={() => openMaps(v.mapsUrl!)}>Harita</button>}
                <button className="btn" onClick={() => openInstagram(v.instagram)}>Instagram</button>
                <button className="btn" onClick={() => openFacebook(v.facebook)}>Facebook</button>
                {v.airbnbUrl && <button className="btn" onClick={() => openOtaListing(v.airbnbUrl!)}>Airbnb</button>}
                {v.bookingUrl && <button className="btn" onClick={() => openOtaListing(v.bookingUrl!)}>Booking</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
