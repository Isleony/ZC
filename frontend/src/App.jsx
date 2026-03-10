import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

function isPrivateOrLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function getDefaultApiBase() {
  if (typeof window === "undefined") return "http://localhost:8000";
  const { hostname, protocol } = window.location;
  if (isPrivateOrLocalHost(hostname)) {
    return `${protocol}//${hostname}:8000`;
  }
  return "/api";
}

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.VITE_API_HOST
    ? `${import.meta.env.VITE_API_PROTOCOL || "https"}://${import.meta.env.VITE_API_HOST}:${
        import.meta.env.VITE_API_PORT || "8000"
      }`
    : getDefaultApiBase());

const TYPES = ["tiroteio", "roubo", "homicidio", "furto", "violencia_domestica"];
const SEARCH_RADIUS_KM = 8;
const PERIOD_OPTIONS = [
  { key: "today", label: "Hoje" },
  { key: "6", label: "6h" },
  { key: "12", label: "12h" },
  { key: "24", label: "24h" },
  { key: "72", label: "72h" },
  { key: "168", label: "7 dias" },
  { key: "360", label: "15 dias" },
  { key: "720", label: "30 dias" },
];
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

function getHoursFromPeriod(periodKey) {
  if (periodKey === "today") {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const diffMs = now.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  }
  return Number(periodKey);
}

function formatIncidentTime(isoDate) {
  return new Date(isoDate).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const initialCenter = [-22.9068, -43.1729];
  const [periodKey, setPeriodKey] = useState("168");
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
  const hours = useMemo(() => getHoursFromPeriod(periodKey), [periodKey]);

  useEffect(() => {
    async function loadIncidents() {
      setError("");

      try {
        if (searchedLocation) {
          const query = new URLSearchParams({
            lat: String(searchedLocation.lat),
            lng: String(searchedLocation.lng),
            radius_km: String(SEARCH_RADIUS_KM),
            hours: String(hours),
          });

          const response = await fetch(`${API_BASE}/alerts/check?${query.toString()}`);
          if (!response.ok) throw new Error("Falha na busca por local");

          const data = await response.json();
          const filtered = data.filter((item) => types.includes(item.incident_type));
          setIncidents(filtered);

          if (filtered.length === 0) {
            setError(`Nenhuma ocorrencia encontrada em ${SEARCH_RADIUS_KM} km deste endereco.`);
          }
          return;
        }

        const typeQuery = types.map((t) => `types=${t}`).join("&");
        const response = await fetch(`${API_BASE}/incidents?hours=${hours}&${typeQuery}`);
        if (!response.ok) throw new Error("Falha na busca geral");
        const data = await response.json();
        setIncidents(data);
      } catch {
        setIncidents([]);
        setError("Nao foi possivel carregar as ocorrencias da API.");
      }
    }

    loadIncidents();

    fetch(`${API_BASE}/risk-zones?hours=${hours}&limit=10`)
      .then((r) => r.json())
      .then(setRisk)
      .catch(() => setRisk([]));
  }, [hours, types, searchedLocation]);

  const countsByType = useMemo(() => {
    const counts = {};
    for (const t of TYPES) counts[t] = 0;
    for (const item of incidents) {
      counts[item.incident_type] = (counts[item.incident_type] || 0) + 1;
    }
    return counts;
  }, [incidents]);

  const nearbyIncidents = useMemo(() => {
    if (!searchedLocation) return [];
    return incidents.slice(0, 12);
  }, [incidents, searchedLocation]);

  function toggleType(t) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function clearAddressSearch() {
    setSearchedLocation(null);
    setAddressError("");
    setMapCenter(initialCenter);
    setMapZoom(11);
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
      setMapZoom(15);
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
              {addressLoading ? "Buscando..." : "Pesquisar"}
            </button>
          </form>
          {addressError ? <p className="address-error">{addressError}</p> : null}
          {searchedLocation ? (
            <>
              <p className="address-hint">
                Buscando ocorrencias em ate {SEARCH_RADIUS_KM} km de: {searchedLocation.label}
              </p>
              <button type="button" className="clear-search" onClick={clearAddressSearch}>
                Voltar para visao geral
              </button>
            </>
          ) : null}

          <label>Periodo</label>
          <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
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
          {risk.map((r, i) => <p key={r.region}>{i + 1}. {r.region} ({r.weighted_risk}) - {formatIncidentTime(r.latest_incident)}</p>)}
          {searchedLocation ? (
            <>
              <h3>Ocorrencias proximas</h3>
              {nearbyIncidents.length === 0 ? (
                <p>Nenhuma ocorrencia proxima no periodo selecionado.</p>
              ) : (
                nearbyIncidents.map((item) => (
                  <p key={`near-${item.id}`}>
                    {TYPE_LABELS[item.incident_type] || item.incident_type} - {item.region} - {formatIncidentTime(item.occurred_at)}
                  </p>
                ))
              )}
            </>
          ) : null}
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
              const color = COLORS[x.incident_type] || "#fff";
              return (
                <CircleMarker
                  key={`ring-${x.id}`}
                  center={[x.lat, x.lng]}
                  radius={9}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0,
                    opacity: 0.9,
                    weight: 2,
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
                      {TYPE_LABELS[x.incident_type] || x.incident_type}: {x.title} - {x.region} - {formatIncidentTime(x.occurred_at)}
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
