import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { SkuForecastTrendChart } from "@/components/dashboard/SkuForecastTrendChart";
import { ProductionPlanningTrendChart } from "@/components/dashboard/ProductionPlanningTrendChart";
import { RecipePlanningChart } from "@/components/dashboard/RecipePlanningChart";
import { useFilters, getHorizonForCustomRange } from "@/context/FilterContext";
import { fetchExecutiveKpis, fetchMillCapacity, type ExecutiveKpis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/PageLoader";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function UtilCell({
  value,
  mill,
  period,
  onClick,
}: {
  value: number;
  mill: string;
  period: string;
  onClick: () => void;
}) {
  const { bg, label } =
    value >= 100
      ? { bg: "bg-destructive text-destructive-foreground", label: "Overload" }
      : value >= 95
        ? { bg: "bg-destructive/90 text-destructive-foreground", label: "Critical" }
        : value >= 90
          ? { bg: "bg-amber-500/90 text-amber-950", label: "High" }
          : value >= 80
            ? { bg: "bg-amber-400/70 text-amber-950", label: "Elevated" }
            : { bg: "bg-emerald-500/80 text-emerald-950", label: "OK" };

  const cell = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full min-w-[52px] px-2.5 py-2 text-center text-[11px] font-mono font-semibold rounded-lg transition-all hover:ring-2 hover:ring-offset-1 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/50",
        bg
      )}
    >
      {value}%
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-semibold text-foreground">{mill} · {period}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Utilization {value}% {label !== "OK" && `(${label})`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Horizon for capacity heatmap (API accepts week|month|year only). Custom uses shared rule; day → week. */
function capacityHorizonForFilter(
  periodFilter: string,
  fromDate?: string,
  toDate?: string
): "week" | "month" | "year" {
  if (periodFilter === "custom" && fromDate && toDate) {
    const h = getHorizonForCustomRange(fromDate, toDate);
    return h === "day" ? "week" : h;
  }
  switch (periodFilter) {
    case "7days":
    case "15days":
      return "week";
    case "30days":
    case "quarter":
      return "month";
    case "year":
      return "year";
    default:
      return "month";
  }
}

export default function Executive() {
  const { toast } = useToast();
  const { queryParams, kpiQueryParams, periodFilter } = useFilters();

  const [kpis, setKpis] = useState<ExecutiveKpis | null>(null);
  const [capacityData, setCapacityData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  // Capacity/heatmap params: use future-only date range; custom range → day/month/year by span (day→week for API)
  const capacityParams = useMemo(
    () => ({
      ...kpiQueryParams,
      horizon: capacityHorizonForFilter(
        periodFilter,
        kpiQueryParams.from_date,
        kpiQueryParams.to_date
      ),
    }),
    [kpiQueryParams.from_date, kpiQueryParams.to_date, kpiQueryParams.scenario, kpiQueryParams.mill_id, periodFilter]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchExecutiveKpis(kpiQueryParams),
      fetchMillCapacity(capacityParams),
    ])
      .then(([kpiData, capData]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setCapacityData(Array.isArray(capData.data) ? capData.data : []);
      })
      .catch((err) => {
        if (!cancelled) console.error("Executive data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    kpiQueryParams.from_date,
    kpiQueryParams.to_date,
    kpiQueryParams.scenario,
    capacityParams.horizon,
    kpiQueryParams.mill_id,
  ]);

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
      {
        label: "Capacity Violations",
        value: kpis.capacity.overload_mills.toString(),
        unit: "mills",
        delta: undefined,
        driver: `Utilization at ${kpis.capacity.utilization_pct.toFixed(1)}%`,
      },
    ]
    : [];

  // Build capacity heatmap from mill capacity data; use short period labels for weekly view
  const heatmapData = (() => {
    const byMill: Record<string, { period: string; utilization: number; rawPeriod: string }[]> = {};
    const isWeekly = capacityParams.horizon === "week";
    for (const row of capacityData) {
      const millName = (row.mill_name as string) || (row.mill_id as string) || "?";
      const rawPeriod = (row.period as string) || "";
      const period = isWeekly && rawPeriod.match(/^\d{4}-W(\d{2})$/)
        ? `W${rawPeriod.slice(-2)}`
        : rawPeriod;
      const util = Number(row.utilization_pct) || 0;
      if (!byMill[millName]) byMill[millName] = [];
      byMill[millName].push({ period, utilization: Math.round(util), rawPeriod });
    }
    return Object.entries(byMill).map(([mill, periods]) => ({
      mill,
      periods: periods.sort((a, b) => a.rawPeriod.localeCompare(b.rawPeriod)),
    }));
  })();

  const heatmapDateRangeText = useMemo(() => {
    if (!kpiQueryParams.from_date || !kpiQueryParams.to_date) return "";
    try {
      const from = format(parseISO(kpiQueryParams.from_date), "MMM d, yyyy");
      const to = format(parseISO(kpiQueryParams.to_date), "MMM d, yyyy");
      return `${from} – ${to}`;
    } catch {
      return `${kpiQueryParams.from_date} – ${kpiQueryParams.to_date}`;
    }
  }, [kpiQueryParams.from_date, kpiQueryParams.to_date]);

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

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Executive</p>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      </div>

      {/* KPI Grid – single set, no duplication */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {executiveKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* SKU Forecast Trend Chart */}
      <SkuForecastTrendChart className="mb-6" />

      {/* Production Planning Chart - Full Width */}
      <ProductionPlanningTrendChart className="mb-6" title="Production Variance" />

      {/* Recipe Planning Chart */}
      <RecipePlanningChart className="mb-6" />

      {/* Capacity Heatmap */}
      <ChartContainer
        title="Mill Capacity Heatmap"
        subtitle={
          heatmapDateRangeText
            ? `Utilization % by mill and period · ${heatmapDateRangeText}`
            : "Utilization % by mill and period — click high-utilization cells for guidance"
        }
      >
        {heatmapData.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm border-collapse min-w-[320px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground border-r border-border/60">
                      Mill
                    </th>
                    {heatmapData[0].periods.map((p) => (
                      <th
                        key={p.rawPeriod}
                        className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {p.period}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {heatmapData.map((row, idx) => (
                    <tr
                      key={row.mill}
                      className={cn(
                        "transition-colors",
                        idx % 2 === 0 ? "bg-card" : "bg-muted/10 hover:bg-muted/20"
                      )}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 font-semibold text-foreground text-xs border-r border-border/60">
                        {row.mill}
                      </td>
                      {row.periods.map((p) => (
                        <td key={p.rawPeriod} className="p-2">
                          <UtilCell
                            value={p.utilization}
                            mill={row.mill}
                            period={p.period}
                            onClick={() => handleHeatmapClick(row.mill, p.period, p.utilization)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 mt-2 border-t border-border/60 text-[11px]">
              <span className="font-medium text-muted-foreground">Scale:</span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-md bg-emerald-500/80" />
                <span className="text-foreground">&lt;80% OK</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-md bg-amber-400/70" />
                <span className="text-foreground">80–90% Elevated</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-md bg-amber-500/90" />
                <span className="text-foreground">90–95% High</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-md bg-destructive/90" />
                <span className="text-foreground">≥95% Critical</span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-border bg-muted/20">
            <p className="text-sm font-medium text-muted-foreground">No capacity data available for this period.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Try adjusting your filters or date range.</p>
          </div>
        )}
      </ChartContainer>
    </DashboardLayout>
  );
}
