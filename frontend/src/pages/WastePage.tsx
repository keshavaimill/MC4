import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchSustainabilityKpis, fetchWasteMetrics, type SustainabilityKpis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/PageLoader";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart, ReferenceLine,
} from "recharts";

interface WasteRow {
  mill_id: string;
  mill_name: string;
  recipe_id: string;
  recipe_name: string;
  period: string;
  waste_pct: number;
  energy_per_ton: number;
  water_per_ton: number;
}

export default function WastePage() {
  const { queryParams, kpiQueryParams } = useFilters();

  const [kpis, setKpis] = useState<SustainabilityKpis | null>(null);
  const [wasteData, setWasteData] = useState<WasteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSustainabilityKpis(kpiQueryParams),   // KPIs use future-only dates
      fetchWasteMetrics(queryParams),             // Trend chart uses full range
    ])
      .then(([kpiData, wasteRes]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setWasteData(wasteRes.data as unknown as WasteRow[]);
      })
      .catch((err) => {
        if (!cancelled) console.error("Waste data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date]);

  const wasteKpis = kpis
    ? [
      { label: "Waste Rate", value: kpis.waste_rate_pct.toFixed(1), unit: "%", delta: -kpis.waste_gap, driver: `vs ${kpis.waste_target_pct}% target` },
      { label: "Target Waste", value: kpis.waste_target_pct.toFixed(1), unit: "%", delta: 0, driver: "Vision 2030 target" },
      { label: "Energy / Ton", value: kpis.energy_per_ton.toFixed(1), unit: "kWh", delta: -6, driver: "Energy efficiency" },
      { label: "Water / Ton", value: kpis.water_per_ton.toFixed(2), unit: "m\u00B3", delta: -4, driver: "Water efficiency" },
      { label: "Vision 2030 Index", value: kpis.vision_2030_score.toFixed(0), unit: "/100", delta: 4, driver: "Composite sustainability" },
    ]
    : [];

  // Build waste heatmap: mills x recipes
  const heatmapData = (() => {
    const mills = [...new Set(wasteData.map((w) => w.mill_name || w.mill_id))].sort();
    const recipes = [...new Set(wasteData.map((w) => w.recipe_name || w.recipe_id))].sort();

    const matrix: Record<string, Record<string, number>> = {};
    const counts: Record<string, Record<string, number>> = {};

    for (const row of wasteData) {
      const mill = row.mill_name || row.mill_id;
      const recipe = row.recipe_name || row.recipe_id;
      if (!matrix[mill]) matrix[mill] = {};
      if (!counts[mill]) counts[mill] = {};
      matrix[mill][recipe] = (matrix[mill][recipe] || 0) + row.waste_pct;
      counts[mill][recipe] = (counts[mill][recipe] || 0) + 1;
    }

    // Average
    for (const mill of mills) {
      for (const recipe of recipes) {
        if (matrix[mill]?.[recipe] && counts[mill]?.[recipe]) {
          matrix[mill][recipe] = matrix[mill][recipe] / counts[mill][recipe];
        }
      }
    }

    return { mills, recipes, matrix };
  })();

  // Build waste trend: group by period
  const trendData = (() => {
    const byPeriod: Record<string, { total: number; count: number }> = {};
    for (const row of wasteData) {
      if (!byPeriod[row.period]) byPeriod[row.period] = { total: 0, count: 0 };
      byPeriod[row.period].total += row.waste_pct;
      byPeriod[row.period].count += 1;
    }
    return Object.entries(byPeriod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, d]) => ({
        period,
        actual: +(d.total / d.count).toFixed(2),
        target: kpis?.waste_target_pct || 3.9,
      }));
  })();

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading sustainability data…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Sustainability</p>
        <h1 className="text-2xl font-semibold text-foreground">Waste & Vision 2030</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Waste tracking by recipe and mill, sustainability targets</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {wasteKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Waste Heatmap */}
        <ChartContainer title="Waste by Recipe & Mill" subtitle="Color intensity = waste % (darker = higher)">
          {heatmapData.mills.length > 0 ? (
            <div className="w-full" style={{ height: '400px', overflowY: 'auto' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground">Mill</th>
                    {heatmapData.recipes.map((r) => (
                      <th key={r} className="px-3 py-2 text-center text-xs font-bold text-muted-foreground">{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.mills.map((mill) => (
                    <tr key={mill}>
                      <td className="px-3 py-2 font-semibold text-foreground">{mill}</td>
                      {heatmapData.recipes.map((recipe) => {
                        const val = heatmapData.matrix[mill]?.[recipe] || 0;

                        if (val < 2.5) {
                          return (
                            <td key={recipe} className="px-3 py-2 text-center">
                              <div className="mx-auto flex h-10 w-16 items-center justify-center rounded-md font-mono text-xs font-bold bg-emerald-500 text-white">
                                {val.toFixed(1)}%
                              </div>
                            </td>
                          );
                        }

                        const maxWaste = Math.max(6, ...Object.values(heatmapData.matrix).flatMap(m => Object.values(m)));
                        const intensity = Math.min(1, val / maxWaste);
                        const opacity = 0.3 + (intensity * 0.7);
                        return (
                          <td key={recipe} className="px-3 py-2 text-center">
                            <div
                              className="mx-auto flex h-10 w-16 items-center justify-center rounded-md font-mono text-xs font-bold"
                              style={{
                                backgroundColor: `rgba(220, 38, 38, ${opacity})`,
                                color: intensity > 0.4 ? "white" : "hsl(var(--foreground))",
                              }}
                            >
                              {val.toFixed(1)}%
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No waste data available.</p>
          )}
        </ChartContainer>

        {/* Waste Trend */}
        <ChartContainer title="Waste Trend vs Target" subtitle="Actual (primary) vs Target (green dashed)">
          {trendData.length > 0 ? (
            <div className="w-full" style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      fontSize: 12,
                      padding: "8px 12px",
                      boxShadow: "0 4px 16px hsl(var(--foreground) / 0.06)",
                    }}
                  />
                  <Legend
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const isDashed = (v: string) => v === "Target";
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
                                    strokeDasharray={isDashed(entry.value as string) ? "6 4" : undefined}
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
                  <Area
                    dataKey="actual"
                    name="Actual"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1) / 0.12)"
                    strokeWidth={2}
                  />
                  <Line
                    dataKey="target"
                    name="Target"
                    stroke="hsl(var(--chart-2))"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                    dot={false}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No trend data available.</p>
          )}
        </ChartContainer>
      </div>
    </DashboardLayout>
  );
}
