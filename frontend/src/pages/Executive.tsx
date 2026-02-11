import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { SkuForecastTrendChart } from "@/components/dashboard/SkuForecastTrendChart";
import { useFilters } from "@/context/FilterContext";
import { fetchExecutiveKpis, fetchMillCapacity, type ExecutiveKpis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Lightbulb, AlertTriangle, TrendingUp } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { useToast } from "@/components/ui/use-toast";

function UtilCell({ value }: { value: number }) {
  const bg =
    value > 95
      ? "bg-red-500 text-white shadow-sm"
      : value > 80
        ? "bg-amber-500 text-white shadow-sm"
        : "bg-emerald-500 text-white shadow-sm";
  return (
    <div className={cn("px-3 py-2 text-center text-xs font-mono font-bold rounded-md transition-all hover:scale-105", bg)}>
      {value}%
    </div>
  );
}

export default function Executive() {
  const { toast } = useToast();
  const { queryParams, kpiQueryParams } = useFilters();

  const [kpis, setKpis] = useState<ExecutiveKpis | null>(null);
  const [capacityData, setCapacityData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchExecutiveKpis(kpiQueryParams),       // KPIs use future-only dates
      fetchMillCapacity(queryParams),            // Data tables use full range (historical + future)
    ])
      .then(([kpiData, capData]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setCapacityData(capData.data);
      })
      .catch((err) => {
        if (!cancelled) console.error("Executive data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date]);

  const executiveKpis = kpis
    ? [
        {
          label: "Total Demand",
          value: kpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          unit: "tons",
          delta: undefined,
          driver: "Period-over-period change",
        },
        {
          label: "Recipe Time Util.",
          value: kpis.recipe_time.utilization_pct.toFixed(1),
          unit: "%",
          delta: undefined,
          driver: `${kpis.recipe_time.total_hours.toLocaleString(undefined, { maximumFractionDigits: 0 })} total hrs`,
        },
        {
          label: "Capacity Violations",
          value: kpis.capacity.overload_mills.toString(),
          unit: "mills",
          delta: undefined,
          driver: `Utilization at ${kpis.capacity.utilization_pct.toFixed(1)}%`,
        },
        {
          label: "Avg Wheat Price",
          value: `SAR ${kpis.risk.avg_wheat_price.toFixed(0)}`,
          unit: "",
          delta: undefined,
          driver: "Per-ton wheat cost",
        },
        {
          label: "Waste Rate",
          value: kpis.waste.waste_rate_pct.toFixed(1),
          unit: "%",
          delta: undefined,
          driver: "vs previous period",
        },
        {
          label: "Vision 2030 Score",
          value: kpis.vision2030.score.toString(),
          unit: "/100",
          delta: undefined,
          driver: "Sustainability composite",
        },
      ]
    : [];

  // Build capacity heatmap from mill capacity data
  const heatmapData = (() => {
    const byMill: Record<string, { period: string; utilization: number }[]> = {};
    for (const row of capacityData) {
      const millName = (row.mill_name as string) || (row.mill_id as string) || "?";
      const period = (row.period as string) || "";
      const util = Number(row.utilization_pct) || 0;
      if (!byMill[millName]) byMill[millName] = [];
      byMill[millName].push({ period, utilization: Math.round(util) });
    }
    return Object.entries(byMill).map(([mill, periods]) => ({
      mill,
      periods: periods.sort((a, b) => a.period.localeCompare(b.period)),
    }));
  })();

  const handleHeatmapClick = (mill: string, period: string, utilization: number) => {
    if (utilization < 95) return;
    toast({
      title: `${mill} ${period} overload risk`,
      description: `Utilization at ${utilization}% exceeds the safe band. Consider redistributing hours.`,
      variant: utilization >= 100 ? "destructive" : "default",
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading executive data…" />
      </DashboardLayout>
    );
  }

  // StatsBar-style pulse metrics (derived from KPIs)
  const pulseStats = kpis
    ? [
        { label: "Demand (tons)", value: kpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 }), sublabel: "Total period", progress: Math.min(100, (kpis.demand.total_tons / 50000) * 100), color: "primary" as const },
        { label: "Utilization", value: `${kpis.recipe_time.utilization_pct.toFixed(1)}%`, sublabel: "Recipe time", progress: kpis.recipe_time.utilization_pct, color: (kpis.recipe_time.utilization_pct > 95 ? "destructive" : kpis.recipe_time.utilization_pct > 80 ? "warning" : "success") as const },
        { label: "Overload mills", value: kpis.capacity.overload_mills.toString(), sublabel: "Capacity risk", progress: kpis.capacity.overload_mills > 0 ? 80 : 10, color: (kpis.capacity.overload_mills > 0 ? "destructive" : "success") as const },
        { label: "Vision 2030", value: `${kpis.vision2030.score}/100`, sublabel: "Sustainability", progress: kpis.vision2030.score, color: "success" as const },
      ]
    : [];

  return (
    <DashboardLayout>
      {/* Page Header – Arabian Mills style */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="pill text-muted-foreground">
          <span className="text-primary font-semibold">Vision 2030</span>
          <span>Operations OS</span>
        </span>
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">Executive</p>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight text-foreground">Dashboard</h1>
        </div>
      </div>

      {/* StatsBar-style pulse strip */}
      {pulseStats.length > 0 && (
        <div className="section-shell p-4 sm:p-5 lg:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-muted-foreground mb-1">Pulse</p>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">Today&apos;s watch-floor</h2>
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground">Live telemetry</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {pulseStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border/70 bg-white/80 p-4 sm:p-5 hover-lift transition-all duration-200"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span className="rounded-full border border-border/70 px-2 py-0.5 uppercase tracking-[0.2em] text-[10px]">{stat.label}</span>
                </div>
                <p className="mb-1 text-2xl sm:text-3xl font-semibold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mb-3">{stat.sublabel}</p>
                <div className="h-1 rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      stat.color === "destructive" && "bg-red-500",
                      stat.color === "warning" && "bg-amber-500",
                      stat.color === "success" && "bg-green-500",
                      stat.color === "primary" && "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, stat.progress)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {executiveKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* SKU Forecast Trend Chart */}
      <SkuForecastTrendChart className="mb-6" />

      {/* AI Executive Brief - Enhanced Design */}
      <div className="mb-6 rounded-xl border-l-4 border-l-primary bg-gradient-to-br from-accent to-white p-6 shadow-lg">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary shadow-md">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">AI Executive Brief</h3>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-100">
            <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span>Key Driver</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">
              {kpis
                ? `Total demand at ${kpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 })} tons (${kpis.demand.growth_pct > 0 ? "+" : ""}${kpis.demand.growth_pct.toFixed(1)}% change). Utilization at ${kpis.capacity.utilization_pct.toFixed(1)}%.`
                : "Loading..."}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-100">
            <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Risk Factors</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">
              {kpis
                ? `${kpis.capacity.overload_mills} mill(s) overloaded. Wheat price ${kpis.risk.price_change_pct > 0 ? "up" : "down"} ${Math.abs(kpis.risk.price_change_pct).toFixed(1)}%. Waste at ${kpis.waste.waste_rate_pct.toFixed(1)}%.`
                : "Loading..."}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-100">
            <div className="mb-3 font-semibold text-gray-900">Quick Stats</div>
            <div className="flex flex-wrap gap-2">
              {kpis && kpis.capacity.overload_mills > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
                  {kpis.capacity.overload_mills} overloaded
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                SAR {kpis?.risk.avg_wheat_price.toFixed(0)}/ton
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
                V2030: {kpis?.vision2030.score}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Capacity Heatmap - Enhanced Design */}
      <ChartContainer title="Mill Capacity Heatmap" subtitle="Real-time utilization tracking across all mills">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          {heatmapData.length > 0 ? (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="sticky left-0 bg-gray-100 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 border-b-2 border-gray-300">
                    Mill
                  </th>
                  {heatmapData[0].periods.map((p) => (
                    <th key={p.period} className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700 border-b-2 border-gray-300">
                      {p.period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {heatmapData.map((row, idx) => (
                  <tr key={row.mill} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="sticky left-0 bg-inherit px-4 py-3 font-bold text-gray-900 border-r border-gray-200">
                      {row.mill}
                    </td>
                    {row.periods.map((p) => (
                      <td key={p.period} className="p-2">
                        <button
                          type="button"
                          className="block w-full"
                          onClick={() => handleHeatmapClick(row.mill, p.period, p.utilization)}
                        >
                          <UtilCell value={p.utilization} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-gray-500">No capacity data available for this period.</p>
              <p className="mt-1 text-xs text-gray-400">Try adjusting your filters or date range.</p>
            </div>
          )}
        </div>
      </ChartContainer>
    </DashboardLayout>
  );
}
