import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Approximate lat/lng for known wheat-exporting countries
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Canada: [56, -106],
  Australia: [-25, 134],
  USA: [38, -97],
  Argentina: [-34, -64],
  France: [46, 2],
  Ukraine: [49, 32],
  Russia: [56, 38],
  India: [21, 78],
  Germany: [51, 10],
  Kazakhstan: [48, 67],
};

// Vibrant color palette for each country (unique per marker)
const COUNTRY_COLORS: Record<string, { fill: string; border: string }> = {
  Canada:     { fill: "#e63946", border: "#b7202d" },   // vivid red
  Australia:  { fill: "#f77f00", border: "#c56600" },   // bright orange
  USA:        { fill: "#3a86ff", border: "#1d6de0" },   // electric blue
  Argentina:  { fill: "#06d6a0", border: "#04a87d" },   // teal-green
  France:     { fill: "#8338ec", border: "#6a2bc7" },   // purple
  Ukraine:    { fill: "#ffbe0b", border: "#d6a000" },   // golden yellow
  Russia:     { fill: "#fb5607", border: "#c94505" },   // deep orange
  India:      { fill: "#ff006e", border: "#cc0058" },   // hot pink
  Germany:    { fill: "#2ec4b6", border: "#239e92" },   // cyan-teal
  Kazakhstan: { fill: "#80b918", border: "#669413" },   // lime green
};

// Fallback colors for unknown countries — cycle through
const FALLBACK_COLORS = [
  { fill: "#7209b7", border: "#5a0790" },
  { fill: "#4361ee", border: "#334fbe" },
  { fill: "#f72585", border: "#c41d6a" },
  { fill: "#4cc9f0", border: "#38a1c0" },
  { fill: "#b5179e", border: "#8e127e" },
];

export interface WheatOrigin {
  country: string;
  volume: number;
  avgCost: number;
  lat?: number;
  lng?: number;
}

interface WheatOriginMapProps {
  origins: WheatOrigin[];
  /** Total volume across all origins (for sizing bubbles) */
  totalVolume: number;
  /** Average cost across all origins (for colouring thresholds) */
  avgCostAll: number;
  /** Height of the map container */
  height?: number;
}

// Small helper to auto-fit the map bounds to the markers
function FitBounds({ origins }: { origins: WheatOrigin[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || origins.length === 0) return;
    const bounds = origins.map((o) => {
      const coords = COUNTRY_COORDS[o.country];
      return coords ?? [o.lat ?? 0, o.lng ?? 0];
    }) as [number, number][];

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 4 });
      fitted.current = true;
    }
  }, [map, origins]);

  return null;
}

function getColor(country: string, idx: number) {
  return COUNTRY_COLORS[country] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

export default function WheatOriginMap({
  origins,
  totalVolume,
  avgCostAll,
  height = 360,
}: WheatOriginMapProps) {
  return (
    <div style={{ height: height + 36, width: "100%", borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        center={[20, 20]}
        zoom={2}
        minZoom={1}
        maxZoom={10}
        scrollWheelZoom={true}
        dragging={true}
        worldCopyJump={true}
        style={{ height: height, width: "100%", borderRadius: 8 }}
        attributionControl={false}
      >
        {/* Colorful OpenStreetMap tiles */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <FitBounds origins={origins} />

        {origins.map((origin, idx) => {
          const coords = COUNTRY_COORDS[origin.country];
          const position: [number, number] = coords ?? [origin.lat ?? 0, origin.lng ?? 0];
          const volPct = totalVolume > 0 ? (origin.volume / totalVolume) * 100 : 10;
          const radius = Math.max(10, 8 + volPct * 0.7);
          const { fill, border } = getColor(origin.country, idx);

          // Cost label
          const costLevel =
            origin.avgCost > avgCostAll * 1.1
              ? "High"
              : origin.avgCost > avgCostAll * 0.95
                ? "Mid"
                : "Low";

          return (
            <CircleMarker
              key={origin.country}
              center={position}
              radius={radius}
              pathOptions={{
                fillColor: fill,
                color: border,
                weight: 2.5,
                fillOpacity: 0.82,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -radius]}
                opacity={0.96}
              >
                <div style={{ minWidth: 130, padding: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: fill }}>
                    {origin.country}
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                    <span style={{ color: "#555" }}>Volume share:</span>{" "}
                    <strong>{volPct.toFixed(1)}%</strong>
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                    <span style={{ color: "#555" }}>Avg cost:</span>{" "}
                    <strong>SAR {origin.avgCost.toFixed(0)}/ton</strong>
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                    <span style={{ color: "#555" }}>Cost level:</span>{" "}
                    <strong
                      style={{
                        color:
                          costLevel === "High"
                            ? "#ef4444"
                            : costLevel === "Mid"
                              ? "#f59e0b"
                              : "#22c55e",
                      }}
                    >
                      {costLevel}
                    </strong>
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground px-1">
        {origins.map((o, idx) => {
          const { fill } = getColor(o.country, idx);
          return (
            <span key={o.country} className="flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: fill }}
              />
              {o.country}
            </span>
          );
        })}
        <span className="ml-auto italic opacity-70">Bubble size = volume share</span>
      </div>
    </div>
  );
}
