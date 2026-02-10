import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchDemandRecipeKpis, fetchSkuForecast, fetchRecipePlanning, type DemandRecipeKpis } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface SkuRow {
  sku_id: string;
  sku_name: string;
  flour_type: string;
  period: string;
  forecast_tons: number;
}

export default function Demand() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { queryParams } = useFilters();

  const [kpis, setKpis] = useState<DemandRecipeKpis | null>(null);
  const [skuData, setSkuData] = useState<SkuRow[]>([]);
  const [recipeChart, setRecipeChart] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchDemandRecipeKpis(queryParams),
      fetchSkuForecast(queryParams),
      fetchRecipePlanning(queryParams),
    ])
      .then(([kpiData, skuRes, recipeRes]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setSkuData(skuRes.data as unknown as SkuRow[]);
        setRecipeChart(recipeRes.data);
      })
      .catch((err) => {
        if (!cancelled) console.error("Demand data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon]);

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

  const filtered = useMemo(
    () =>
      skuData.filter(
        (s) =>
          s.sku_name?.toLowerCase().includes(search.toLowerCase()) ||
          s.sku_id?.toLowerCase().includes(search.toLowerCase())
      ),
    [search, skuData]
  );

  // Build translation funnel from kpis
  const translationFunnel = kpis
    ? [
        { stage: "SKU Forecast", value: kpis.total_sku_forecast_units, conversionPct: 100 },
        { stage: "Bulk Flour", value: kpis.bulk_flour_required_tons, conversionPct: Math.round((kpis.bulk_flour_required_tons / Math.max(1, kpis.total_sku_forecast_units)) * 10000) / 100 || 90 },
        { stage: "Recipe Hours", value: kpis.total_recipe_hours, conversionPct: Math.round((kpis.total_recipe_hours / Math.max(1, kpis.bulk_flour_required_tons)) * 10000) / 100 || 80 },
      ]
    : [];

  // Build recipe demand chart: group by recipe, stack by mill
  const chartData = (() => {
    const byRecipe: Record<string, Record<string, number>> = {};
    for (const row of recipeChart) {
      const recipeName = (row.recipe_name as string) || "Unknown";
      const period = (row.period as string) || "?";
      const hours = Number(row.scheduled_hours) || 0;
      if (!byRecipe[recipeName]) byRecipe[recipeName] = {};
      byRecipe[recipeName][period] = (byRecipe[recipeName][period] || 0) + hours;
    }
    return Object.entries(byRecipe).map(([recipe, periods]) => ({ recipe, ...periods }));
  })();

  const periodKeys = [...new Set(recipeChart.map((r) => r.period as string))].filter(Boolean).sort();
  const barColors = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))", "#8B4513"];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading demand data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Demand &rarr; Recipe Translation</h1>
        <p className="text-sm text-muted-foreground">SKU forecasts translated to recipe requirements</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {demandKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* SKU Table */}
        <ChartContainer title="SKU Forecast Table" subtitle="Forecast by SKU from backend" className="lg:col-span-1">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary">
                <tr>
                  {["SKU ID", "SKU Name", "Flour Type", "Period", "Forecast (tons)"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((sku, i) => (
                  <tr key={`${sku.sku_id}-${sku.period}`} className={cn("border-t border-border transition-colors hover:bg-primary/5", i % 2 === 0 ? "bg-card" : "bg-accent/30")}>
                    <td className="px-3 py-2 font-mono text-xs font-medium">{sku.sku_id}</td>
                    <td className="px-3 py-2 text-xs">{sku.sku_name}</td>
                    <td className="px-3 py-2 text-xs">{sku.flour_type}</td>
                    <td className="px-3 py-2 text-xs">{sku.period}</td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold">{sku.forecast_tons?.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
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

        <div className="flex flex-col gap-6">
          {/* Translation Funnel */}
          <ChartContainer title="Translation Funnel" subtitle="Volume flow: SKU &rarr; Flour &rarr; Recipe">
            <div className="space-y-3 py-4">
              {translationFunnel.map((stage) => (
                <button
                  key={stage.stage}
                  type="button"
                  onClick={() => {
                    toast({ title: stage.stage, description: `Value: ${stage.value.toLocaleString()}` });
                  }}
                  className="flex w-full items-center gap-4 text-left"
                >
                  <div className="w-28 text-right text-xs font-medium text-muted-foreground">{stage.stage}</div>
                  <div className="relative flex-1 h-9 overflow-hidden rounded-md bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-md bg-primary/80 transition-all"
                      style={{ width: `${Math.min(100, stage.conversionPct)}%` }}
                    />
                    <div className="relative z-10 flex h-full items-center justify-between px-3">
                      <span className="font-mono text-xs font-bold text-primary-foreground">
                        {stage.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="font-mono text-xs font-semibold text-primary-foreground">{stage.conversionPct}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ChartContainer>

          {/* Recipe Demand Chart */}
          <ChartContainer title="Recipe Demand by Period" subtitle="Scheduled hours per recipe">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="recipe" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {periodKeys.slice(0, 4).map((p, i) => (
                  <Bar key={p} dataKey={p} name={p} stackId="a" fill={barColors[i % barColors.length]} radius={i === Math.min(3, periodKeys.length - 1) ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}
