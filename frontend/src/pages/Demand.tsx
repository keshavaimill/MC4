import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters, getHorizonForCustomRange } from "@/context/FilterContext";
import { fetchDemandRecipeKpis, fetchSkuForecast, fetchRecipePlanning, type DemandRecipeKpis } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn, downloadCsv } from "@/lib/utils";
import { Search, Download, Check, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { useToast } from "@/components/ui/use-toast";
import { parseISO, format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { SkuForecastTrendChart } from "@/components/dashboard/SkuForecastTrendChart";
import { fetchMillCapacity } from "@/lib/api";

interface SkuRow {
  sku_id: string;
  sku_name: string;
  flour_type: string;
  period: string;
  forecast_tons: number;
  demand_units?: number;
}

interface SkuLedgerRow {
  sku_id: string;
  period: string;
  available_units: number;
  demand_units: number;
  variance: number;
  status: "ok" | "warning" | "danger";
}

// Helper: horizon for Recipe Demand chart (presets only; custom uses getHorizonForCustomRange)
function recipeDemandHorizonForPreset(periodFilter: string): "day" | "week" | "month" | "year" {
  switch (periodFilter) {
    case "7days":
    case "15days":
    case "30days":
      return "day";
    case "quarter":
    case "year":
      return "month";
    default:
      return "month";
  }
}

export default function Demand() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { queryParams, kpiQueryParams, periodFilter } = useFilters();

  const [kpis, setKpis] = useState<DemandRecipeKpis | null>(null);
  const [skuData, setSkuData] = useState<SkuRow[]>([]);
  const [recipeChart, setRecipeChart] = useState<Record<string, unknown>[]>([]);
  const [capacityData, setCapacityData] = useState<Record<string, unknown>[]>([]);
  const [skuDailyData, setSkuDailyData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  // Recipe Demand chart params: use full date range; custom range → day/month/year by span (project-wide rule)
  const recipeDemandParams = useMemo(
    () => ({
      ...queryParams,
      horizon:
        periodFilter === "custom"
          ? getHorizonForCustomRange(queryParams.from_date, queryParams.to_date)
          : recipeDemandHorizonForPreset(periodFilter),
    }),
    [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, periodFilter]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    // Fetch daily SKU data for ledger calculation (needed for demand_units and historical patterns)
    const dailySkuParams = {
      ...queryParams,
      horizon: "day", // Fetch daily data to get demand_units
    };
    
    Promise.all([
      fetchDemandRecipeKpis(kpiQueryParams),    // KPIs use future-only dates
      fetchSkuForecast(queryParams),             // SKU table uses full range (for display)
      fetchSkuForecast(dailySkuParams),          // Daily SKU data for ledger calculation
      fetchRecipePlanning(recipeDemandParams),  // Recipe Demand chart: uses day horizon for 7/15/30 days
      fetchMillCapacity(kpiQueryParams),         // Capacity data for available units calculation
    ])
      .then(([kpiData, skuRes, skuDailyRes, recipeRes, capacityRes]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setSkuData(skuRes.data as unknown as SkuRow[]);
        setSkuDailyData(skuDailyRes.data);
        setRecipeChart(recipeRes.data);
        setCapacityData(capacityRes.data);
      })
      .catch((err) => {
        if (!cancelled) console.error("Demand data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date, periodFilter]);

  const demandKpis = kpis
    ? [
      {
        label: "Total SKU Forecast",
        value: kpis.total_sku_forecast_units.toLocaleString(),
        unit: "units",
        delta: 3.1,
        driver: "Forecast demand in units",
      },
      {
        label: "Bulk Flour Required",
        value: kpis.bulk_flour_required_tons.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        unit: "tons",
        delta: 5.2,
        driver: "Converted from SKU demand",
      },
      {
        label: "Total Recipe Hours",
        value: kpis.total_recipe_hours.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        unit: "hrs",
        delta: -1.4,
        driver: "Required milling time",
      },
      {
        label: "Forecast Confidence",
        value: kpis.forecast_confidence_pct.toFixed(1),
        unit: "%",
        delta: 2.0,
        driver: "Average model confidence",
      },
      {
        label: "Seasonality Index",
        value: kpis.seasonality_index.toFixed(2),
        delta: kpis.seasonality_index > 1 ? kpis.seasonality_index - 1 : 0,
        driver: kpis.seasonality_index > 1.1 ? "Above-normal season" : "Normal season",
      },
    ]
    : [];

  const filtered = useMemo(() => {
    let result = skuData.filter(
      (s) =>
        s.sku_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.sku_id?.toLowerCase().includes(search.toLowerCase())
    );

    // For preset filters, exclude periods before February 2026
    // For custom date range, show all data in the selected range
    if (periodFilter !== "custom") {
      const minPeriod = "2026-02";
      result = result.filter((s) => {
        try {
          // Parse period (format: YYYY-MM or YYYY-MM-DD)
          if (!s.period) return true;
          const periodStr = s.period;
          
          // Extract YYYY-MM from period
          let yearMonth: string;
          if (periodStr.includes("-")) {
            const parts = periodStr.split("-");
            yearMonth = `${parts[0]}-${parts[1]}`;
          } else {
            return true; // Unknown format, include it
          }
          
          return yearMonth >= minPeriod;
        } catch {
          return true; // If parsing fails, include it
        }
      });
    }

    return result;
  }, [search, skuData, periodFilter]);

  // Build recipe demand chart: group by period, each recipe as a line
  const chartData = (() => {
    const byPeriod: Record<string, Record<string, number>> = {};
    for (const row of recipeChart) {
      const period = (row.period as string) || "Unknown";
      const recipeName = (row.recipe_name as string) || "Unknown";
      const hours = Number(row.scheduled_hours) || 0;
      if (!byPeriod[period]) byPeriod[period] = {};
      byPeriod[period][recipeName] = (byPeriod[period][recipeName] || 0) + hours;
    }
    return Object.entries(byPeriod)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, recipes]) => ({ period, ...recipes }));
  })();

  // Derive all recipe names for chart lines
  const recipeNames = [...new Set(recipeChart.map((r) => (r.recipe_name as string)).filter(Boolean))].sort();
  const lineColors = [
    "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
    "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))", "hsl(var(--chart-7))", "#64748b",
  ];

  const hasChartData = chartData.length > 0 && recipeNames.length > 0;

  // Calculate SKU Ledger table data
  // Available units = deterministic calculation (similar to capacity ledger)
  // For all periods: Available Units = Base Demand × Deterministic Multipliers (seasonal, event, weekend, trend)
  // NO random noise component - fully deterministic like mill capacity
  const skuLedger = useMemo((): SkuLedgerRow[] => {
    if (!skuData.length || !skuDailyData.length) return [];

    const HISTORICAL_END_DATE = "2026-02-14";
    const TONS_TO_UNITS = 1000; // 1000 units per ton (assuming 1kg pack size)
    
    // Base demand in TONS per day per SKU (from data_generator.py)
    const BASE_DEMAND_TONS: Record<string, number> = {
      "SKU001": 280,   // FOOM Patent 45kg — wholesale bulk
      "SKU002": 120,   // FOOM Patent 10kg — retail
      "SKU003": 30,    // FOOM Patent 1kg  — small retail
      "SKU004": 210,   // FOOM Bakery 45kg — wholesale
      "SKU005": 90,    // FOOM Bakery 10kg — retail
      "SKU006": 120,   // FOOM Artisan 45kg — specialty wholesale
      "SKU007": 80,    // FOOM Artisan 10kg — specialty retail
      "SKU008": 150,   // FOOM Brown 45kg — wholesale
      "SKU009": 80,    // FOOM Brown 10kg — retail
      "SKU010": 140,   // FOOM Superior Brown 45kg — wholesale
      "SKU011": 240,   // Miller Patent 45kg — wholesale
      "SKU012": 120,   // Miller Patent 10kg — retail
      "SKU013": 200,   // Miller Bakery 45kg — wholesale
      "SKU014": 90,    // Miller Bakery 10kg — retail
    };
    const DEFAULT_BASE_DEMAND = 100; // Fallback for unknown SKUs
    
    // Pack size in kg per SKU (from data_generator.py)
    const PACK_SIZE_KG: Record<string, number> = {
      "SKU001": 45,   // FOOM Patent 45kg
      "SKU002": 10,   // FOOM Patent 10kg
      "SKU003": 1,    // FOOM Patent 1kg
      "SKU004": 45,   // FOOM Bakery 45kg
      "SKU005": 10,   // FOOM Bakery 10kg
      "SKU006": 45,   // FOOM Artisan 45kg
      "SKU007": 10,   // FOOM Artisan 10kg
      "SKU008": 45,   // FOOM Brown 45kg
      "SKU009": 10,   // FOOM Brown 10kg
      "SKU010": 45,   // FOOM Superior Brown 45kg
      "SKU011": 45,   // Miller Patent 45kg
      "SKU012": 10,   // Miller Patent 10kg
      "SKU013": 45,   // Miller Bakery 45kg
      "SKU014": 10,   // Miller Bakery 10kg
    };
    const DEFAULT_PACK_SIZE = 10; // Fallback for unknown SKUs
    
    // Helper to get period from date based on horizon
    const getPeriodFromDate = (dateStr: string): string => {
      try {
        const date = parseISO(dateStr);
        const horizon = queryParams.horizon || "month";
        
        if (horizon === "day") return format(date, "yyyy-MM-dd");
        if (horizon === "month") return format(date, "yyyy-MM");
        if (horizon === "year") return format(date, "yyyy");
        return format(date, "yyyy-MM");
      } catch {
        return "";
      }
    };

    // Helper to calculate deterministic available units for a given date
    // Formula: base × (1 + seasonal) × event_mult × weekend_mult × trend
    // NO noise component (deterministic like capacity)
    const calculateDeterministicAvailableUnits = (skuId: string, dateStr: string): number => {
      try {
        const date = parseISO(dateStr);
        const baseTons = BASE_DEMAND_TONS[skuId] || DEFAULT_BASE_DEMAND;
        
        // Seasonal: ±8% seasonal swing (deterministic sine wave)
        // Calculate day of year (1-365/366)
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const seasonal = 0.08 * Math.sin(2 * Math.PI * dayOfYear / 365);
        
        // Event multipliers: Ramadan (1.35×), Hajj (1.25×)
        // Simplified: Ramadan is typically March-April, Hajj is typically June-July
        // For deterministic calculation, we'll use month-based approximation
        const month = date.getMonth() + 1; // 1-12
        const isRamadan = month === 3 || month === 4; // Approximate Ramadan months
        const isHajj = month === 6 || month === 7; // Approximate Hajj months
        const eventMult = isRamadan ? 1.35 : (isHajj ? 1.25 : 1.0);
        
        // Weekend multiplier: 0.92 for weekends, 1.0 for weekdays
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const weekendMult = isWeekend ? 0.92 : 1.0;
        
        // Trend: 2.5% annual growth from 2020-01-01
        const baseDate = new Date("2020-01-01");
        const daysSinceBase = Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        const trend = 1.0 + 0.025 * (daysSinceBase / 365.0);
        
        // Calculate deterministic demand (tons) - NO noise
        const demandTons = baseTons * (1 + seasonal) * eventMult * weekendMult * trend;
        
        // Convert to units using pack_size_kg from SKU dimension data
        const packSizeKg = PACK_SIZE_KG[skuId] || DEFAULT_PACK_SIZE;
        const unitsPerTon = 1000 / packSizeKg; // Convert tons to units: 1000 kg per ton / pack_size_kg
        
        return Math.round(demandTons * unitsPerTon);
      } catch {
        // Fallback: use base demand converted to units
        const baseTons = BASE_DEMAND_TONS[skuId] || DEFAULT_BASE_DEMAND;
        const packSizeKg = PACK_SIZE_KG[skuId] || DEFAULT_PACK_SIZE;
        const unitsPerTon = 1000 / packSizeKg;
        return Math.round(baseTons * unitsPerTon);
      }
    };

    // Step 1: Aggregate forecasted demand units from daily data by SKU and period
    const demandUnitsBySkuPeriod: Record<string, number> = {}; // "sku_id|period" -> total forecasted units
    
    for (const daily of skuDailyData) {
      const date = (daily.date as string) || "";
      const skuId = (daily.sku_id as string) || "";
      const period = getPeriodFromDate(date);
      if (!period) continue;
      
      const forecastTons = Number(daily.forecast_tons) || 0;
      // Convert tons to units using pack_size_kg
      const packSizeKg = PACK_SIZE_KG[skuId] || DEFAULT_PACK_SIZE;
      const unitsPerTon = 1000 / packSizeKg;
      const forecastedUnits = Math.round(forecastTons * unitsPerTon);
      
      const key = `${skuId}|${period}`;
      demandUnitsBySkuPeriod[key] = (demandUnitsBySkuPeriod[key] || 0) + forecastedUnits;
    }

    // Step 2: Calculate deterministic available units for each period
    const availableUnitsBySkuPeriod: Record<string, number> = {}; // "sku_id|period" -> total available units
    
    // Get all unique SKU-period combinations
    const skuPeriodSet = new Set<string>();
    for (const daily of skuDailyData) {
      const date = (daily.date as string) || "";
      const skuId = (daily.sku_id as string) || "";
      const period = getPeriodFromDate(date);
      if (!period) continue;
      skuPeriodSet.add(`${skuId}|${period}`);
    }
    
    // Calculate available units for each date in each period
    for (const skuPeriod of skuPeriodSet) {
      const [skuId, period] = skuPeriod.split("|");
      
      // Get all dates in this period for this SKU
      const periodDates = skuDailyData
        .filter(d => {
          const dPeriod = getPeriodFromDate((d.date as string) || "");
          return (d.sku_id as string) === skuId && dPeriod === period;
        })
        .map(d => (d.date as string) || "");
      
      // Calculate deterministic available units for each date and sum
      let totalAvailable = 0;
      for (const dateStr of periodDates) {
        totalAvailable += calculateDeterministicAvailableUnits(skuId, dateStr);
      }
      
      availableUnitsBySkuPeriod[skuPeriod] = totalAvailable;
    }

    // Step 3: Build ledger from aggregated SKU data
    const ledgerMap = new Map<string, SkuLedgerRow>();

    for (const sku of skuData) {
      const key = `${sku.sku_id}-${sku.period}`;
      const period = sku.period;
      
      // Demand Units = Forecasted Units (sum of forecasted demand_units for this period)
      const lookupKey = `${sku.sku_id}|${period}`;
      // If not found in daily data, calculate from aggregated forecast_tons
      let demandUnits = demandUnitsBySkuPeriod[lookupKey];
      if (!demandUnits) {
        const packSizeKg = PACK_SIZE_KG[sku.sku_id] || DEFAULT_PACK_SIZE;
        const unitsPerTon = 1000 / packSizeKg;
        demandUnits = Math.round((sku.forecast_tons || 0) * unitsPerTon);
      }
      
      // Available Units = Deterministic calculation (sum of deterministic available units for this period)
      let availableUnits = availableUnitsBySkuPeriod[lookupKey];
      
      // If not found in pre-calculated map, calculate directly for this period
      if (availableUnits === undefined) {
        // Get all dates in this period for this SKU from daily data
        const periodDates = skuDailyData
          .filter(d => {
            const dPeriod = getPeriodFromDate((d.date as string) || "");
            return (d.sku_id as string) === sku.sku_id && dPeriod === period;
          })
          .map(d => (d.date as string) || "");
        
        // Calculate deterministic available units for each date and sum
        availableUnits = 0;
        for (const dateStr of periodDates) {
          availableUnits += calculateDeterministicAvailableUnits(sku.sku_id, dateStr);
        }
        
        // If still 0 and we have forecast_tons, estimate from base demand
        if (availableUnits === 0 && sku.forecast_tons) {
          // Estimate days in period based on horizon
          const horizon = queryParams.horizon || "month";
          let daysInPeriod = 30; // Default for month
          if (horizon === "day") daysInPeriod = 1;
          else if (horizon === "week") daysInPeriod = 7;
          else if (horizon === "year") daysInPeriod = 365;
          
          const baseTons = BASE_DEMAND_TONS[sku.sku_id] || DEFAULT_BASE_DEMAND;
          const packSizeKg = PACK_SIZE_KG[sku.sku_id] || DEFAULT_PACK_SIZE;
          const unitsPerTon = 1000 / packSizeKg;
          // Use average multipliers (approximate)
          const avgMultiplier = 1.05; // Average seasonal/event/trend multiplier
          availableUnits = Math.round(baseTons * daysInPeriod * avgMultiplier * unitsPerTon);
        }
      }

      const existing = ledgerMap.get(key);
      if (existing) {
        existing.demand_units += demandUnits;
        existing.available_units += availableUnits;
      } else {
        ledgerMap.set(key, {
          sku_id: sku.sku_id,
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
          // Parse period (format: YYYY-MM or YYYY-MM-DD or YYYY)
          if (!row.period) return true;
          const periodStr = row.period;
          
          // Extract YYYY-MM from period
          let yearMonth: string;
          if (periodStr.includes("-")) {
            const parts = periodStr.split("-");
            if (parts.length >= 2) {
              yearMonth = `${parts[0]}-${parts[1]}`;
            } else {
              return true; // Unknown format, include it
            }
          } else if (/^\d{4}$/.test(periodStr)) {
            // YYYY format - compare as year
            return parseInt(periodStr, 10) >= 2026;
          } else {
            return true; // Unknown format, include it
          }
          
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
      return a.sku_id.localeCompare(b.sku_id);
    });
  }, [skuData, skuDailyData, queryParams.horizon, periodFilter]);

  const handleLedgerClick = (skuId: string, status: string) => {
    toast({
      title: status === "ok" ? "Status: OK" : status === "warning" ? "Status: Warning" : "Status: Critical",
      description: `SKU ${skuId} has ${status === "ok" ? "sufficient" : status === "warning" ? "moderate" : "critical"} capacity variance.`,
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading demand data…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Planning</p>
        <h1 className="text-2xl font-semibold text-foreground">Demand Forecasting</h1>
        <p className="text-sm text-muted-foreground mt-0.5">SKU forecasts, bulk flour, and recipe demand</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {demandKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* SKU Forecast Trend Chart */}
      <div className="mb-6">
        <SkuForecastTrendChart />
      </div>

      {/* SKU Demand Ledger Table */}
      <ChartContainer
        title="SKU Demand Ledger"
        subtitle="Available and forecasted demand trends with capacity analysis"
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const rows = skuLedger.map((r) => ({
                sku_id: r.sku_id,
                period: r.period,
                available_sku_units: r.available_units,
                demand_sku_units: r.demand_units,
                variance: r.variance,
                status: r.status,
              }));
              downloadCsv(rows as unknown as Record<string, unknown>[], "demand_sku_ledger");
            }}
            disabled={skuLedger.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        }
        className="mb-6"
      >
        {skuLedger.length > 0 ? (
          <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                <tr>
                  {["SKU ID", "PERIOD", "AVAILABLE SKU UNITS", "DEMAND SKU UNITS", "VARIANCE", "STATUS"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skuLedger.map((row, i) => (
                  <tr key={`${row.sku_id}-${row.period}`} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">{row.sku_id}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.period || "N/A"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.available_units.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.demand_units.toLocaleString()}</td>
                    <td className={cn(
                      "px-4 py-2.5 font-mono text-xs",
                      row.variance < 0 ? "text-red-600" : row.variance > 0 ? "text-emerald-600" : "text-foreground"
                    )}>
                      {row.variance >= 0 ? "+" : ""}{row.variance.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent"
                        onClick={() => handleLedgerClick(row.sku_id, row.status)}
                      >
                        {row.status === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
                        {row.status === "warning" && <AlertTriangle className="h-4 w-4 text-red-600" />}
                        {row.status === "danger" && <X className="h-4 w-4 text-red-600" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No SKU ledger data available.</p>
        )}
      </ChartContainer>

      {/* SKU Table - Full Width */}
      <ChartContainer
        title="SKU Forecast Table"
        subtitle="Forecast by SKU from backend"
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const rows = filtered.map((r) => ({
                sku_id: r.sku_id,
                sku_name: r.sku_name,
                flour_type: r.flour_type,
                period: r.period,
                forecast_tons: r.forecast_tons,
              }));
              downloadCsv(rows as unknown as Record<string, unknown>[], "demand_sku_forecast");
            }}
            disabled={filtered.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        }
        className="mb-6"
      >
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border border-border bg-background" />
        </div>
        <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
              <tr>
                {["SKU ID", "SKU Name", "Flour Type", "Period", "Forecast (tons)"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((sku, i) => (
                <tr key={`${sku.sku_id}-${sku.period}`} className={cn("border-t border-border transition-colors hover:bg-accent/40", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                  <td className="px-3 py-2 font-mono text-xs font-medium text-foreground">{sku.sku_id}</td>
                  <td className="px-3 py-2 text-xs text-foreground">{sku.sku_name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{sku.flour_type}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{sku.period}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-foreground">{sku.forecast_tons?.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">No SKU data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartContainer>

      <div className="space-y-6">
        {/* Recipe Demand Chart */}
        <ChartContainer title="Recipe Demand by Period" subtitle="Scheduled hours per recipe">
          {hasChartData ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value: string) => {
                    // Format daily data (YYYY-MM-DD) for 7/15/30 days filters
                    if (recipeDemandParams.horizon === "day" && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      try {
                        const date = parseISO(value);
                        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                      } catch {
                        return value;
                      }
                    }
                    // Format weekly data (YYYY-WW)
                    if (value.includes("W")) {
                      const parts = value.split("-W");
                      if (parts.length === 2) {
                        return `W${parseInt(parts[1])}`;
                      }
                    }
                    // Format monthly data (YYYY-MM)
                    if (value.match(/^\d{4}-\d{2}$/)) {
                      try {
                        const [year, month] = value.split("-");
                        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                        return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                      } catch {
                        return value;
                      }
                    }
                    return value;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  width={50}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--card))',
                    fontSize: 12,
                    padding: '8px 12px',
                    boxShadow: '0 4px 16px hsl(var(--foreground) / 0.06)',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)} hrs`]}
                />
                <Legend
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    return (
                      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-5 pb-1">
                        <div className="inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-lg border border-border/70 bg-muted/30 px-4 py-2.5 shadow-sm">
                          {payload.map((entry) => (
                            <div key={entry.value} className="flex items-center gap-2.5">
                              <svg width="26" height="12" viewBox="0 0 26 12" fill="none" className="shrink-0" aria-hidden>
                                <line
                                  x1="0"
                                  y1="6"
                                  x2="26"
                                  y2="6"
                                  stroke={entry.color}
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                />
                                <circle cx="13" cy="6" r="3" fill="white" stroke={entry.color} strokeWidth={2} />
                              </svg>
                              <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                                {entry.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                {recipeNames.map((recipe, i) => (
                  <Line
                    key={recipe}
                    type="monotone"
                    dataKey={recipe}
                    name={recipe}
                    stroke={lineColors[i % lineColors.length]}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No recipe demand data</p>
              <p className="text-xs text-muted-foreground mt-1">Select a date range or scenario with planning data</p>
            </div>
          )}
        </ChartContainer>
      </div>
    </DashboardLayout>
  );
}
