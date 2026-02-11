import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchRawMaterialsKpis, fetchRawMaterial, type RawMaterialsKpis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import WheatOriginMap from "@/components/WheatOriginMap";

interface RawMaterialRow {
  period: string;
  country: string;
  wheat_price_sar_per_ton: number;
  availability_tons: number;
}

// Approximate lat/lng for known wheat-exporting countries
const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  Canada: { lat: 56, lng: -106 },
  Australia: { lat: -25, lng: 134 },
  USA: { lat: 38, lng: -97 },
  Argentina: { lat: -34, lng: -64 },
  France: { lat: 46, lng: 2 },
  Ukraine: { lat: 49, lng: 32 },
  Russia: { lat: 56, lng: 38 },
  India: { lat: 21, lng: 78 },
  Germany: { lat: 51, lng: 10 },
  Kazakhstan: { lat: 48, lng: 67 },
};

function LevelBadge({ level }: { level: string }) {
  const styles =
    level === "High"
      ? "bg-destructive/10 text-destructive"
      : level === "Medium"
        ? "bg-warning/10 text-warning"
        : "bg-success/10 text-success";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", styles)}>{level}</span>;
}

export default function Materials() {
  const { queryParams, kpiQueryParams } = useFilters();

  const [kpis, setKpis] = useState<RawMaterialsKpis | null>(null);
  const [rawData, setRawData] = useState<RawMaterialRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchRawMaterialsKpis(kpiQueryParams),     // KPIs use future-only dates
      fetchRawMaterial(queryParams),              // Data tables use full range
    ])
      .then(([kpiData, rmData]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setRawData(rmData.data as unknown as RawMaterialRow[]);
      })
      .catch((err) => {
        if (!cancelled) console.error("Materials data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date]);

  const matKpis = kpis
    ? [
        {
          label: "Total Wheat Req.",
          value: kpis.total_wheat_requirement_tons.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          unit: "tons",
          delta: 6.2,
          driver: "Demand-linked requirement",
        },
        {
          label: "Avg Wheat Cost",
          value: kpis.avg_wheat_cost_sar.toFixed(0),
          unit: "SAR/ton",
          delta: 0,
          driver: "Average import cost",
        },
        {
          label: "Import Dependency",
          value: kpis.import_dependency_pct.toFixed(1),
          unit: "%",
          delta: 0.5,
          driver: "Reliance on imports",
        },
        {
          label: "High-Risk Share",
          value: kpis.high_risk_supply_pct.toFixed(1),
          unit: "%",
          delta: -1.0,
          driver: "Geopolitical risk exposure",
        },
        {
          label: "Yield Variability",
          value: kpis.yield_variability_index.toFixed(3),
          delta: 0,
          driver: "Origin yield variance",
        },
      ]
    : [];

  // Aggregate raw material data by country
  const byCountry = (() => {
    const agg: Record<string, { totalAvail: number; avgPrice: number; count: number }> = {};
    for (const row of rawData) {
      if (!agg[row.country]) agg[row.country] = { totalAvail: 0, avgPrice: 0, count: 0 };
      agg[row.country].totalAvail += row.availability_tons;
      agg[row.country].avgPrice += row.wheat_price_sar_per_ton;
      agg[row.country].count += 1;
    }
    return Object.entries(agg).map(([country, d]) => ({
      country,
      volume: d.totalAvail,
      avgCost: d.count > 0 ? d.avgPrice / d.count : 0,
      ...(COUNTRY_COORDS[country] || { lat: 0, lng: 0 }),
    }));
  })();

  const totalVolume = byCountry.reduce((s, c) => s + c.volume, 0);
  const avgCostAll = byCountry.length > 0 ? byCountry.reduce((s, c) => s + c.avgCost, 0) / byCountry.length : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading materials data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Raw Materials & Wheat Origins</h1>
        <p className="text-sm text-muted-foreground">Global wheat sourcing and price analysis</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {matKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Interactive Wheat Origin Map */}
        <ChartContainer title="Wheat Origin Map" subtitle="Global sourcing by volume and cost">
          <WheatOriginMap
            origins={byCountry}
            totalVolume={totalVolume}
            avgCostAll={avgCostAll}
            height={360}
          />
        </ChartContainer>

        {/* Country Price Table */}
        <ChartContainer title="Wheat by Country" subtitle="Average price and availability">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                {["Country", "Avg Price (SAR/ton)", "Total Availability (tons)", "Cost Level"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byCountry
                .sort((a, b) => b.volume - a.volume)
                .map((row, i) => {
                  const level =
                    row.avgCost > avgCostAll * 1.1 ? "High" : row.avgCost > avgCostAll * 0.95 ? "Medium" : "Low";
                  return (
                    <tr key={row.country} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-accent/20")}>
                      <td className="px-3 py-2.5 text-xs font-medium">{row.country}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{row.avgCost.toFixed(0)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{row.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-3 py-2.5">
                        <LevelBadge level={level} />
                      </td>
                    </tr>
                  );
                })}
              {byCountry.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-xs text-muted-foreground">No raw material data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </ChartContainer>
      </div>
    </DashboardLayout>
  );
}
