import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Geographic centers / capitals for wheat-exporting countries (lat, lng) — clear placement on map
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Canada: [56.13, -106.35],       // geographic center
  Australia: [-25.27, 133.77],    // geographic center
  USA: [39.83, -98.58],           // geographic center (lower 48)
  Argentina: [-34.6, -58.45],     // Buenos Aires
  France: [46.23, 2.21],          // central France
  Ukraine: [50.45, 30.52],        // Kyiv
  Russia: [55.75, 37.62],         // Moscow
  India: [20.59, 78.96],          // central India
  Germany: [51.17, 10.45],        // central Germany
  Kazakhstan: [48.02, 66.92],     // central Kazakhstan
};

// Theme-aligned palette (chart CSS vars + distinct hex for map contrast)
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(30 52% 42%)",   // darker primary
  "hsl(152 69% 25%)",  // darker emerald
  "hsl(210 75% 45%)",  // blue
];
// Darker border = same hue, lower lightness
function toBorder(fill: string): string {
  if (fill.startsWith("hsl(")) {
    const match = fill.match(/hsl\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(/\s/);
      const h = parts[0];
      const s = parts[1]?.replace("%", "") ?? "50";
      const l = Math.max(0, Math.min(100, Number(parts[2]?.replace("%", "") ?? 50) - 12));
      return `hsl(${h} ${s}% ${l}%)`;
    }
  }
  return "hsl(var(--foreground) / 0.4)";
}

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
    const points = origins
      .map((o) => {
        const coords = COUNTRY_COORDS[o.country];
        const lat = coords?.[0] ?? o.lat ?? 0;
        const lng = coords?.[1] ?? o.lng ?? 0;
        return [lat, lng] as [number, number];
      })
      .filter(([lat, lng]) => lat !== 0 || lng !== 0);

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 5 });
      fitted.current = true;
    }
  }, [map, origins]);

  return null;
}

function getColorForIndex(idx: number): { fill: string; border: string } {
  const fill = CHART_COLORS[idx % CHART_COLORS.length];
  return { fill, border: toBorder(fill) };
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
          const invalid = position[0] === 0 && position[1] === 0;
          const volPct = totalVolume > 0 ? (origin.volume / totalVolume) * 100 : 10;
          const radius = Math.max(12, Math.min(28, 10 + volPct * 0.35));
          const { fill, border } = getColorForIndex(idx);

          // Cost label
          const costLevel =
            origin.avgCost > avgCostAll * 1.1
              ? "High"
              : origin.avgCost > avgCostAll * 0.95
                ? "Mid"
                : "Low";

          if (invalid) return null;

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
        {origins.map((o, idx) => {
          const { fill, border } = getColorForIndex(idx);
          return (
            <span key={o.country} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full border-2 shrink-0"
                style={{ backgroundColor: fill, borderColor: border }}
              />
              <span className="font-medium text-foreground">{o.country}</span>
            </span>
          );
        })}
        <span className="ml-auto italic text-muted-foreground">Size = volume share</span>
      </div>
    </div>
  );
}
