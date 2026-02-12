import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchDemandRecipeKpis, fetchSkuForecast, fetchRecipePlanning, type DemandRecipeKpis } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn, downloadCsv } from "@/lib/utils";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { useToast } from "@/components/ui/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
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

  // Waterfall: normalize to 0–100 (first = 100%), then deltas. Short labels for X-axis.
  const waterfallData = (() => {
    if (translationFunnel.length < 2) return [];
    const maxVal = Math.max(...translationFunnel.map((s) => s.value), 1);
    const normalized = translationFunnel.map((s) => ({
      name: s.stage,
      rawValue: s.value,
      pct: Math.min(100, (s.value / maxVal) * 100),
    }));
    const labels = { dropBulk: "To Bulk", dropRecipe: "To Recipe", bulk: "Bulk Flour", recipe: "Recipe Hrs" };
    const out: { name: string; value: number; rawValue: number; type: "start" | "drop" | "subtotal" | "end" }[] = [];
    let running = 100;
    for (let i = 0; i < normalized.length; i++) {
      const pct = normalized[i].pct;
      const raw = normalized[i].rawValue;
      if (i === 0) {
        out.push({ name: "SKU Forecast", value: 100, rawValue: raw, type: "start" });
        running = 100;
      } else {
        const drop = running - pct;
        out.push({
          name: i === 1 ? labels.dropBulk : labels.dropRecipe,
          value: -drop,
          rawValue: raw,
          type: "drop",
        });
        running = pct;
        out.push({
          name: i === 1 ? labels.bulk : labels.recipe,
          value: pct,
          rawValue: raw,
          type: i === normalized.length - 1 ? "end" : "subtotal",
        });
      }
    }
    return out;
  })();

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

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Translation Funnel – Waterfall */}
        <ChartContainer title="Translation Funnel" subtitle="Volume flow: SKU → Flour → Recipe (waterfall)">
          {waterfallData.length > 0 ? (
            <div className="w-full" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={waterfallData}
                  margin={{ top: 16, right: 20, left: 12, bottom: 32 }}
                  barCategoryGap="8%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={44}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={{ stroke: "hsl(var(--border))" }}
                    tickFormatter={(v) => `${Math.round(v)}%`}
                    domain={[-90, 110]}
                    ticks={[-80, -60, -40, -20, 0, 20, 40, 60, 80, 100]}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      fontSize: 12,
                      padding: "8px 12px",
                      boxShadow: "0 4px 16px hsl(var(--foreground) / 0.06)",
                    }}
                    formatter={(value: number, _name: string, props: { payload: { rawValue: number; type: string } }) => [
                      props.payload.type === "drop"
                        ? `${Math.abs(Number(value)).toFixed(1)}% step-down`
                        : `${props.payload.rawValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${Number(value).toFixed(1)}%)`,
                      "",
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {waterfallData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.type === "drop"
                            ? "hsl(var(--muted-foreground) / 0.35)"
                            : "hsl(var(--chart-1))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No funnel data</p>
              <p className="text-xs text-muted-foreground mt-1">KPI data is required for the waterfall</p>
            </div>
          )}
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
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
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
