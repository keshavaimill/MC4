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
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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
  const { queryParams, kpiQueryParams } = useFilters();

  const [kpis, setKpis] = useState<DemandRecipeKpis | null>(null);
  const [skuData, setSkuData] = useState<SkuRow[]>([]);
  const [recipeChart, setRecipeChart] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchDemandRecipeKpis(kpiQueryParams),    // KPIs use future-only dates
      fetchSkuForecast(queryParams),             // Data tables use full range
      fetchRecipePlanning(queryParams),           // Charts use full range
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
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date]);

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
  // Note: SKU forecast units need to be converted to tons for proper comparison
  // Average pack size is ~22kg (mix of 45kg, 10kg, 1kg), so ~45 units per ton
  // Bulk flour is aggregated from SKU forecast_tons (not units)
  // Recipe hours = bulk_flour_tons / milling_rate_tph (avg ~24 TPH)
  const translationFunnel = kpis
    ? (() => {
        // Convert SKU units to approximate tons (using average ~45 units per ton)
        // This is approximate since pack sizes vary, but gives reasonable conversion %
        const avgUnitsPerTon = 45; // Approximate: mix of 45kg, 10kg, 1kg bags
        const skuForecastTons = kpis.total_sku_forecast_units / avgUnitsPerTon;
        
        // SKU Forecast → Bulk Flour: What % of SKU forecast tons becomes bulk flour tons
        // Bulk flour is aggregated from forecast_tons, so should be close to 100% (with minor losses)
        const bulkFlourConversion = skuForecastTons > 0 
          ? Math.round((kpis.bulk_flour_required_tons / skuForecastTons) * 10000) / 100 
          : 100;
        
        // Bulk Flour → Recipe Hours: What % of bulk flour tons translates to recipe hours
        // Recipe hours = tons / milling_rate_tph. Average milling rate ~24 TPH
        // So: hours * 24 = tons. Conversion % = (hours * 24) / tons * 100
        const avgMillingRateTPH = 24; // Average milling rate tons per hour
        const recipeHoursConversion = kpis.bulk_flour_required_tons > 0
          ? Math.round((kpis.total_recipe_hours * avgMillingRateTPH / kpis.bulk_flour_required_tons) * 10000) / 100
          : 100;
        
        return [
          { stage: "SKU Forecast", value: kpis.total_sku_forecast_units, conversionPct: 100 },
          { stage: "Bulk Flour", value: kpis.bulk_flour_required_tons, conversionPct: Math.min(100, Math.max(0, bulkFlourConversion)) },
          { stage: "Recipe Hours", value: kpis.total_recipe_hours, conversionPct: Math.min(100, Math.max(0, recipeHoursConversion)) },
        ];
      })()
    : [];

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
    "hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))", 
    "#8B4513", "#6366f1", "#ec4899", "#14b8a6", "#f59e0b"
  ];

  const hasChartData = chartData.length > 0 && recipeNames.length > 0;

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
        <h1 className="text-2xl font-bold text-foreground">Demand Forecasting</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {demandKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* SKU Table - Full Width */}
      <ChartContainer title="SKU Forecast Table" subtitle="Forecast by SKU from backend" className="mb-6">
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
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
            {hasChartData ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 11 }} 
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    width={50}
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: 6, 
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: 'hsl(var(--card))',
                      fontSize: 11,
                      padding: '6px 10px',
                    }} 
                    formatter={(value: number) => [`${value.toFixed(1)} hrs`]}
                  />
                  <Legend 
                    iconSize={10}
                    iconType="line"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '4px', lineHeight: '20px' }}
                    formatter={(value: string) => (
                      <span style={{ fontSize: '11px', color: 'hsl(var(--foreground))' }}>{value}</span>
                    )}
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
