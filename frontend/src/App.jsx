import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TYPES = ["tiroteio", "roubo", "homicidio", "furto", "violencia_domestica"];
const TYPE_LABELS = {
  tiroteio: "Tiroteio",
  roubo: "Roubo",
  homicidio: "Homicidio",
  furto: "Furto",
  violencia_domestica: "Violencia domestica",
};
const COLORS = {
  tiroteio: "#ef4444",
  roubo: "#f59e0b",
  homicidio: "#dc2626",
  furto: "#fde047",
  violencia_domestica: "#7c3aed",
};

function makeDotIcon(color) {
  return L.divIcon({
    className: "crime-marker-icon",
    html: `<span style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function isRecentShootout(incident) {
  if (incident.incident_type !== "tiroteio") return false;
  const ageMs = Date.now() - new Date(incident.occurred_at).getTime();
  return ageMs <= 24 * 60 * 60 * 1000;
}

function MapFlyTo({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);

  return null;
}

export default function App() {
  const initialCenter = [-22.9068, -43.1729];
  const [hours, setHours] = useState(168);
  const [types, setTypes] = useState(TYPES);
  const [incidents, setIncidents] = useState([]);
  const [risk, setRisk] = useState([]);
  const [error, setError] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [mapZoom, setMapZoom] = useState(11);

  useEffect(() => {
    const typeQuery = types.map((t) => `types=${t}`).join("&");
    setError("");

    fetch(`${API_BASE}/incidents?hours=${hours}&${typeQuery}`)
      .then((r) => r.json())
      .then(setIncidents)
      .catch(() => setError("Nao foi possivel carregar as ocorrencias da API."));

    fetch(`${API_BASE}/risk-zones?hours=${hours}&limit=10`)
      .then((r) => r.json())
      .then(setRisk)
      .catch(() => setRisk([]));
  }, [hours, types]);

  const countsByType = useMemo(() => {
    const counts = {};
    for (const t of TYPES) counts[t] = 0;
    for (const item of incidents) {
      counts[item.incident_type] = (counts[item.incident_type] || 0) + 1;
    }
    return counts;
  }, [incidents]);

  function toggleType(t) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function handleAddressSearch(event) {
    event.preventDefault();

    const query = addressQuery.trim();
    if (!query) {
      setAddressError("Digite um endereco para buscar.");
      return;
    }

    setAddressError("");
    setAddressLoading(true);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Falha na busca de endereco");
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        setAddressError("Endereco nao encontrado. Tente com bairro, cidade ou CEP.");
        return;
      }

      const first = data[0];
      const lat = Number(first.lat);
      const lng = Number(first.lon);

      setSearchedLocation({
        lat,
        lng,
        label: first.display_name,
      });
      setMapCenter([lat, lng]);
      setMapZoom(14);
    } catch {
      setAddressError("Nao foi possivel buscar esse endereco agora.");
    } finally {
      setAddressLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Zona Perigosa</h1>
      <div className="grid">
        <aside>
          <label>Buscar endereco</label>
          <form className="address-form" onSubmit={handleAddressSearch}>
            <input
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              placeholder="Ex: Av Paulista 1000, Sao Paulo"
            />
            <button type="submit" disabled={addressLoading}>
              {addressLoading ? "Buscando..." : "Ver local"}
            </button>
          </form>
          {addressError ? <p className="address-error">{addressError}</p> : null}

          <label>Periodo</label>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={24}>24h</option>
            <option value={72}>72h</option>
            <option value={168}>7 dias</option>
            <option value={720}>30 dias</option>
          </select>
          <div className="chips">
            {TYPES.map((t) => (
              <button key={t} className={types.includes(t) ? "on" : ""} onClick={() => toggleType(t)}>
                <span className="legend-dot" style={{ background: COLORS[t] }} />
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="legend-list">
            {TYPES.map((t) => (
              <div key={`legend-${t}`} className="legend-item">
                <span className="legend-dot" style={{ background: COLORS[t] }} />
                <span>{TYPE_LABELS[t]}</span>
                <strong>{countsByType[t] || 0}</strong>
              </div>
            ))}
          </div>
          <h3>Zonas de risco</h3>
          {risk.map((r, i) => <p key={r.region}>{i + 1}. {r.region} ({r.weighted_risk})</p>)}
        </aside>
        <section className="mapwrap">
          {error ? <div className="map-message">{error}</div> : null}
          {!error && incidents.length === 0 ? <div className="map-message">Nenhuma ocorrencia no filtro atual.</div> : null}
          <MapContainer center={mapCenter} zoom={mapZoom} className="map">
            <MapFlyTo center={mapCenter} zoom={mapZoom} />
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {searchedLocation ? (
              <CircleMarker
                center={[searchedLocation.lat, searchedLocation.lng]}
                radius={12}
                pathOptions={{
                  color: "#22d3ee",
                  fillColor: "#22d3ee",
                  fillOpacity: 0.35,
                  weight: 2,
                }}
              >
                <Tooltip>
                  Endereco pesquisado: {searchedLocation.label}
                </Tooltip>
              </CircleMarker>
            ) : null}

            {incidents.map((x) => {
              const color = COLORS[x.incident_type] || "#fff";
              const weight = Math.max(0.3, (x.confidence || 0.6) * 1.6);

              return (
                <CircleMarker
                  key={`heat-${x.id}`}
                  center={[x.lat, x.lng]}
                  radius={14 + Math.round(weight * 10)}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.08 + weight * 0.06,
                    weight: 0,
                  }}
                />
              );
            })}

            {incidents.map((x) => {
              if (!isRecentShootout(x)) return null;
              return (
                <CircleMarker
                  key={`pulse-${x.id}`}
                  center={[x.lat, x.lng]}
                  radius={10}
                  pathOptions={{
                    color: "#ef4444",
                    fillColor: "#ef4444",
                    fillOpacity: 0.18,
                    weight: 1,
                    className: "pulse-shootout",
                  }}
                />
              );
            })}

            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              showCoverageOnHover={false}
              spiderfyOnMaxZoom
            >
              {incidents.map((x) => {
                const color = COLORS[x.incident_type] || "#fff";
                return (
                  <Marker key={x.id} position={[x.lat, x.lng]} icon={makeDotIcon(color)}>
                    <Tooltip>
                      {TYPE_LABELS[x.incident_type] || x.incident_type}: {x.title} - {x.region}
                    </Tooltip>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </section>
      </div>
    </div>
  );
}
