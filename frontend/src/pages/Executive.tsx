import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchExecutiveKpis, fetchRecipePlanning, fetchMillCapacity, type ExecutiveKpis } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { Lightbulb, AlertTriangle, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function UtilCell({ value }: { value: number }) {
  const bg =
    value > 95
      ? "bg-destructive/80 text-destructive-foreground"
      : value > 80
        ? "bg-warning/70 text-warning-foreground"
        : "bg-success/60 text-success-foreground";
  return (
    <div className={cn("px-2 py-1.5 text-center text-xs font-mono font-semibold rounded-sm", bg)}>
      {value}%
    </div>
  );
}

export default function Executive() {
  const { toast } = useToast();
  const { queryParams } = useFilters();

  const [kpis, setKpis] = useState<ExecutiveKpis | null>(null);
  const [recipeChart, setRecipeChart] = useState<Record<string, unknown>[]>([]);
  const [capacityData, setCapacityData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchExecutiveKpis(queryParams),
      fetchRecipePlanning(queryParams),
      fetchMillCapacity(queryParams),
    ])
      .then(([kpiData, recipeData, capData]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setRecipeChart(recipeData.data);
        setCapacityData(capData.data);
      })
      .catch((err) => {
        if (!cancelled) console.error("Executive data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon]);

  const executiveKpis = kpis
    ? [
        {
          label: "Total Demand",
          value: kpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          unit: "tons",
          delta: kpis.demand.growth_pct,
          driver: "Period-over-period change",
        },
        {
          label: "Recipe Time Util.",
          value: kpis.recipe_time.utilization_pct.toFixed(1),
          unit: "%",
          delta: kpis.recipe_time.utilization_pct > 90 ? -2 : 2,
          driver: `${kpis.recipe_time.total_hours.toLocaleString(undefined, { maximumFractionDigits: 0 })} total hrs`,
        },
        {
          label: "Capacity Violations",
          value: kpis.capacity.overload_mills.toString(),
          unit: "mills",
          delta: kpis.capacity.overload_mills > 0 ? -kpis.capacity.overload_mills : 0,
          driver: `Utilization at ${kpis.capacity.utilization_pct.toFixed(1)}%`,
        },
        {
          label: "Avg Wheat Price",
          value: `SAR ${kpis.risk.avg_wheat_price.toFixed(0)}`,
          unit: "",
          delta: kpis.risk.price_change_pct,
          driver: "Per-ton wheat cost",
        },
        {
          label: "Waste Rate",
          value: kpis.waste.waste_rate_pct.toFixed(1),
          unit: "%",
          delta: kpis.waste.delta_pct,
          driver: "vs previous period",
        },
        {
          label: "Vision 2030 Score",
          value: kpis.vision2030.score.toString(),
          unit: "/100",
          delta: kpis.vision2030.delta,
          driver: "Sustainability composite",
        },
      ]
    : [];

  // Build recipe chart data: group by recipe, stack by mill
  const chartData = (() => {
    const byRecipe: Record<string, Record<string, number>> = {};
    for (const row of recipeChart) {
      const recipeName = (row.recipe_name as string) || "Unknown";
      const millId = (row.mill_id as string) || "?";
      const hours = Number(row.scheduled_hours) || 0;
      if (!byRecipe[recipeName]) byRecipe[recipeName] = {};
      byRecipe[recipeName][millId] = (byRecipe[recipeName][millId] || 0) + hours;
    }
    return Object.entries(byRecipe).map(([recipe, mills]) => ({ recipe, ...mills }));
  })();

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

  // Derive mill IDs for chart legend
  const millIds = [...new Set(recipeChart.map((r) => r.mill_id as string))].filter(Boolean).sort();
  const millColors = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))", "#8B4513", "#6366f1"];

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
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading executive data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Executive Summary</h1>
        <p className="text-sm text-muted-foreground">Real-time overview of MC4 mill operations</p>
      </div>

      {/* KPI Strip */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {executiveKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Hero Chart + AI Brief */}
      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <ChartContainer title="Recipe Time Demand vs Capacity" subtitle="Hours required per recipe across all mills">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="recipe" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
              <Legend />
              {millIds.map((mill, i) => (
                <Bar
                  key={mill}
                  dataKey={mill}
                  name={mill}
                  stackId="a"
                  fill={millColors[i % millColors.length]}
                  radius={i === millIds.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* AI Executive Brief */}
        <div className="rounded-xl border-t-4 border-t-primary border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">AI Executive Brief</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Key Driver
              </div>
              <p className="text-muted-foreground">
                {kpis
                  ? `Total demand at ${kpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 })} tons (${kpis.demand.growth_pct > 0 ? "+" : ""}${kpis.demand.growth_pct.toFixed(1)}% change). Utilization at ${kpis.capacity.utilization_pct.toFixed(1)}%.`
                  : "Loading..."}
              </p>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Risk Factors
              </div>
              <p className="text-muted-foreground">
                {kpis
                  ? `${kpis.capacity.overload_mills} mill(s) overloaded. Wheat price ${kpis.risk.price_change_pct > 0 ? "up" : "down"} ${Math.abs(kpis.risk.price_change_pct).toFixed(1)}%. Waste at ${kpis.waste.waste_rate_pct.toFixed(1)}%.`
                  : "Loading..."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {kpis && kpis.capacity.overload_mills > 0 && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                  {kpis.capacity.overload_mills} overloaded
                </span>
              )}
              <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                SAR {kpis?.risk.avg_wheat_price.toFixed(0)}/ton
              </span>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                V2030: {kpis?.vision2030.score}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Capacity Heatmap */}
      <ChartContainer title="Mill Capacity Heatmap" subtitle="Utilization across mills and periods">
        <div className="overflow-x-auto">
          {heatmapData.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">Mill</th>
                  {heatmapData[0].periods.map((p) => (
                    <th key={p.period} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                      {p.period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row) => (
                  <tr key={row.mill}>
                    <td className="px-3 py-1.5 font-semibold text-foreground">{row.mill}</td>
                    {row.periods.map((p) => (
                      <td key={p.period} className="p-0">
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
            <p className="py-8 text-center text-sm text-muted-foreground">No capacity data available for this period.</p>
          )}
        </div>
      </ChartContainer>
    </DashboardLayout>
  );
}
