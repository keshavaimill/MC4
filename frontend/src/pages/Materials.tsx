import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchRawMaterialsKpis, fetchRawMaterial, fetchWheatRequirement, type RawMaterialsKpis } from "@/lib/api";
import { cn, downloadCsv } from "@/lib/utils";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Download, Check, AlertTriangle, X } from "lucide-react";
import WheatOriginMap from "@/components/WheatOriginMap";
import { parseISO, format } from "date-fns";

interface RawMaterialRow {
  period: string;
  country: string;
  wheat_price_sar_per_ton: number;
  availability_tons: number;
}

interface WheatRequirementRow {
  wheat_type_id: string;
  wheat_name?: string;
  period: string;
  required_tons: number;
  avg_cost: number;
  scenario_id: string;
}

interface RawMaterialLedgerRow {
  material_id: string;
  material_name: string;
  period: string;
  available_units: number; // in tonnes
  demand_units: number; // in tonnes (required_tons)
  variance: number;
  status: "ok" | "warning" | "danger";
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
      ? "bg-red-100 text-red-700"
      : level === "Medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", styles)}>{level}</span>;
}

export default function Materials() {
  const { queryParams, kpiQueryParams, periodFilter } = useFilters();

  const [kpis, setKpis] = useState<RawMaterialsKpis | null>(null);
  const [rawData, setRawData] = useState<RawMaterialRow[]>([]);
  const [wheatRequirementData, setWheatRequirementData] = useState<WheatRequirementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchRawMaterialsKpis(kpiQueryParams),     // KPIs use future-only dates
      fetchRawMaterial(queryParams),              // Data tables use full range
      fetchWheatRequirement(queryParams),         // Wheat requirement data for ledger
    ])
      .then(([kpiData, rmData, wheatData]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setRawData(rmData.data as unknown as RawMaterialRow[]);
        setWheatRequirementData(wheatData.data as unknown as WheatRequirementRow[]);
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

  // Calculate Raw Material Ledger
  // Available Units = deterministic calculation (similar to SKU ledger)
  // Formula: base requirement × (1 + seasonal) × event_mult × trend
  const rawMaterialLedger = useMemo((): RawMaterialLedgerRow[] => {
    if (!wheatRequirementData.length) return [];

    // Base requirement in tonnes per month per wheat type (from historical average)
    // These are approximate base values derived from the data
    const BASE_REQUIREMENT_TONS: Record<string, number> = {
      "WT001": 25000,  // Hard Red Winter (HRW)
      "WT002": 19000,  // Australian Standard White (ASW)
      "WT003": 1300,   // Canadian Western Red Spring (CWRS)
      "WT004": 7000,   // Argentine Trigo Pan
      "WT005": 12000,  // Black Sea Milling Wheat
    };
    const DEFAULT_BASE_REQUIREMENT = 10000; // Fallback

    // Helper to calculate deterministic available units for a given period
    const calculateDeterministicAvailableUnits = (wheatTypeId: string, periodStr: string): number => {
      try {
        // Parse period (format: YYYY-MM or YYYY-MM-DD)
        let date: Date;
        if (periodStr.includes("-") && periodStr.length === 7) {
          // YYYY-MM format - use first day of month
          const [year, month] = periodStr.split("-").map(Number);
          date = new Date(year, month - 1, 1);
        } else if (periodStr.includes("-") && periodStr.length === 10) {
          // YYYY-MM-DD format
          date = parseISO(periodStr);
        } else {
          // Try to parse as-is
          date = parseISO(periodStr);
        }

        const baseTons = BASE_REQUIREMENT_TONS[wheatTypeId] || DEFAULT_BASE_REQUIREMENT;

        // Seasonal: ±8% seasonal swing (deterministic sine wave)
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const seasonal = 0.08 * Math.sin(2 * Math.PI * dayOfYear / 365);

        // Event multipliers: Ramadan (1.15×), Hajj (1.10×)
        const month = date.getMonth() + 1; // 1-12
        const isRamadan = month === 3 || month === 4; // Approximate Ramadan months
        const isHajj = month === 6 || month === 7; // Approximate Hajj months
        const eventMult = isRamadan ? 1.15 : (isHajj ? 1.10 : 1.0);

        // Trend: 2.5% annual growth from 2020-01-01
        const baseDate = new Date("2020-01-01");
        const daysSinceBase = Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        const trend = 1.0 + 0.025 * (daysSinceBase / 365.0);

        // Calculate deterministic available units (tons) - NO noise
        const availableTons = baseTons * (1 + seasonal) * eventMult * trend;

        return Math.round(availableTons);
      } catch {
        // Fallback: use base requirement
        const baseTons = BASE_REQUIREMENT_TONS[wheatTypeId] || DEFAULT_BASE_REQUIREMENT;
        return Math.round(baseTons);
      }
    };

    // Helper to normalize period to YYYY-MM format
    const normalizePeriod = (periodStr: string): string => {
      if (!periodStr) return periodStr;
      // If it's already in YYYY-MM format, return as-is
      if (/^\d{4}-\d{2}$/.test(periodStr)) {
        return periodStr;
      }
      // If it's a datetime string, extract YYYY-MM
      if (periodStr.includes(" ") || periodStr.length > 7) {
        try {
          const date = parseISO(periodStr);
          return format(date, "yyyy-MM");
        } catch {
          // If parsing fails, try to extract YYYY-MM from the string
          const match = periodStr.match(/(\d{4})-(\d{2})/);
          if (match) {
            return `${match[1]}-${match[2]}`;
          }
        }
      }
      return periodStr;
    };

    // Build ledger from wheat requirement data
    const ledgerMap = new Map<string, RawMaterialLedgerRow>();

    for (const row of wheatRequirementData) {
      const normalizedPeriod = normalizePeriod(row.period);
      const key = `${row.wheat_type_id}-${normalizedPeriod}`;
      const materialId = row.wheat_type_id;
      const materialName = row.wheat_name || materialId;
      const period = normalizedPeriod;
      const demandUnits = Number(row.required_tons) || 0;

      // Calculate available units deterministically
      const availableUnits = calculateDeterministicAvailableUnits(materialId, period);

      const existing = ledgerMap.get(key);
      if (existing) {
        existing.demand_units += demandUnits;
        existing.available_units += availableUnits;
      } else {
        ledgerMap.set(key, {
          material_id: materialId,
          material_name: materialName,
          period: period,
          available_units: availableUnits,
          demand_units: demandUnits,
          variance: 0, // Will calculate below
          status: "ok",
        });
      }
    }

    // Calculate variance and status
    let ledger = Array.from(ledgerMap.values()).map((row) => {
      const variance = row.available_units - row.demand_units;
      const variancePct = row.demand_units > 0 ? (variance / row.demand_units) * 100 : 0;

      let status: "ok" | "warning" | "danger" = "ok";
      if (variance < 0) {
        status = variancePct < -20 ? "danger" : "warning";
      } else if (variancePct > 50) {
        status = "warning";
      }

      return {
        ...row,
        variance,
        status,
      };
    });

    // For preset filters, exclude periods before February 2026
    // For custom date range, show all data in the selected range
    if (periodFilter !== "custom") {
      const minPeriod = "2026-02";
      ledger = ledger.filter((row) => {
        try {
          // Parse period (format: YYYY-MM)
          if (!row.period || !row.period.includes("-")) {
            // Unknown format, include it
            return true;
          }
          
          const [year, month] = row.period.split("-").map(Number);
          const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
          
          return yearMonth >= minPeriod;
        } catch {
          // If parsing fails, include it
          return true;
        }
      });
    }

    return ledger.sort((a, b) => {
      const periodCompare = a.period.localeCompare(b.period);
      if (periodCompare !== 0) return periodCompare;
      return a.material_id.localeCompare(b.material_id);
    });
  }, [wheatRequirementData, periodFilter]);

  function StatusBadge({ status }: { status: "ok" | "warning" | "danger" }) {
    return (
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent"
        onClick={() => {
          // Optional: Add toast notification if needed
        }}
      >
        {status === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
        {status === "warning" && <AlertTriangle className="h-4 w-4 text-red-600" />}
        {status === "danger" && <X className="h-4 w-4 text-red-600" />}
      </button>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading materials data…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Supply</p>
        <h1 className="text-2xl font-semibold text-foreground">Raw Materials & Wheat Origins</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Global wheat sourcing and price analysis</p>
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
        <ChartContainer
          title="Wheat by Country"
          subtitle="Average price and availability"
          action={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const rows = byCountry
                  .sort((a, b) => b.volume - a.volume)
                  .map((r) => ({
                    country: r.country,
                    avg_price_sar_per_ton: Math.round(r.avgCost),
                    total_availability_tons: r.volume,
                  }));
                downloadCsv(rows as unknown as Record<string, unknown>[], "materials_wheat_by_country");
              }}
              disabled={byCountry.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          }
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {["Country", "Avg Price (SAR/ton)", "Total Availability (tons)", "Cost Level"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{h}</th>
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
                    <tr key={row.country} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                      <td className="px-3 py-2.5 text-xs font-medium text-foreground">{row.country}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-foreground">{row.avgCost.toFixed(0)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-foreground">{row.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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

      {/* Raw Material Ledger Table */}
      <div className="mt-6">
        <ChartContainer
          title="Raw Material Ledger"
          subtitle="Available and demand units by wheat type and period"
          action={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const rows = rawMaterialLedger.map((r) => ({
                  material_id: r.material_id,
                  material_name: r.material_name,
                  period: r.period,
                  available_units_tonnes: r.available_units,
                  demand_units_tonnes: r.demand_units,
                  variance_tonnes: r.variance,
                  status: r.status,
                }));
                downloadCsv(rows as unknown as Record<string, unknown>[], "raw_material_ledger");
              }}
              disabled={rawMaterialLedger.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {["Material ID/Name", "Period", "Available Units (Tonnes)", "Demand Units (Tonnes)", "Variance", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawMaterialLedger.map((row, i) => (
                  <tr key={`${row.material_id}-${row.period}`} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                    <td className="px-3 py-2.5">
                      <div className="text-xs font-medium text-foreground">{row.material_id}</div>
                      <div className="text-xs text-muted-foreground">{row.material_name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground">{row.period}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-foreground">{row.available_units.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-foreground">{row.demand_units.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className={cn(
                      "px-3 py-2.5 font-mono text-xs",
                      row.variance < 0 ? "text-red-600" : row.variance > 0 ? "text-emerald-600" : "text-foreground"
                    )}>
                      {row.variance >= 0 ? "+" : ""}{row.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
                {rawMaterialLedger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">No raw material ledger data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartContainer>
      </div>
    </DashboardLayout>
  );
}
