import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { useFilters } from "@/context/FilterContext";
import { fetchExecutiveKpis, fetchMillCapacity, type ExecutiveKpis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, RefreshCw } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";

const scenarioLabels: Record<string, string> = {
  base: "Base",
  ramadan: "Ramadan Surge",
  hajj: "Hajj Season",
  eid_fitr: "Eid al-Fitr",
  eid_adha: "Eid al-Adha",
  summer: "Summer Low",
  winter: "Winter",
};

const scenarioOptions = Object.entries(scenarioLabels)
  .filter(([k]) => k !== "base")
  .map(([id, label]) => ({ id, label }));

interface MillCapRow {
  mill_id: string;
  mill_name: string;
  overload_hours: number;
  utilization_pct: number;
  period: string;
}

export default function Scenarios() {
  const { queryParams, kpiQueryParams } = useFilters();

  const [selectedScenario, setSelectedScenario] = useState("ramadan");
  const [baseKpis, setBaseKpis] = useState<ExecutiveKpis | null>(null);
  const [scenarioKpis, setScenarioKpis] = useState<ExecutiveKpis | null>(null);
  const [baseMills, setBaseMills] = useState<MillCapRow[]>([]);
  const [scenarioMills, setScenarioMills] = useState<MillCapRow[]>([]);
  const [allMillNames, setAllMillNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (scenario: string) => {
    setLoading(true);
    try {
      // KPIs use future-only dates; mill capacity data uses full range with date filters
      const baseKpiParams = { ...kpiQueryParams, scenario: "base" };
      const scenKpiParams = { ...kpiQueryParams, scenario };
      const baseDataParams = { ...queryParams, scenario: "base" };
      const scenDataParams = { ...queryParams, scenario };

      const [bKpi, sKpi, bMills, sMills] = await Promise.all([
        fetchExecutiveKpis(baseKpiParams),        // KPIs use future-only dates
        fetchExecutiveKpis(scenKpiParams),         // KPIs use future-only dates
        fetchMillCapacity(baseDataParams),         // Capacity Impact: uses date filters
        fetchMillCapacity(scenDataParams),         // Capacity Impact: uses date filters
      ]);

      setBaseKpis(bKpi);
      setScenarioKpis(sKpi);
      
      // Ensure we have valid data arrays
      const baseMillsData = Array.isArray(bMills.data) ? bMills.data : [];
      const scenarioMillsData = Array.isArray(sMills.data) ? sMills.data : [];
      
      setBaseMills(baseMillsData as unknown as MillCapRow[]);
      setScenarioMills(scenarioMillsData as unknown as MillCapRow[]);
      
      // Debug: Log to help diagnose why base hours might be 0
      if (baseMillsData.length === 0) {
        console.warn("Base mills data is empty. Params:", baseDataParams);
      }
      if (scenarioMillsData.length === 0) {
        console.warn("Scenario mills data is empty. Params:", scenDataParams);
      }
      
      // Extract all unique mill names from the data to ensure all mills are shown
      const millNamesFromData = new Set<string>();
      (bMills.data as unknown as MillCapRow[]).forEach((m) => {
        if (m.mill_name) millNamesFromData.add(m.mill_name);
        else if (m.mill_id) millNamesFromData.add(m.mill_id);
      });
      (sMills.data as unknown as MillCapRow[]).forEach((m) => {
        if (m.mill_name) millNamesFromData.add(m.mill_name);
        else if (m.mill_id) millNamesFromData.add(m.mill_id);
      });
      // Ensure all known mills are included (even if they have no data)
      const knownMills = ["Dammam Mill", "Medina Mill", "Al-Kharj Mill"];
      knownMills.forEach(m => millNamesFromData.add(m));
      setAllMillNames(Array.from(millNamesFromData).sort());
    } catch (err) {
      console.error("Scenario data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedScenario);
  }, [queryParams.from_date, queryParams.to_date, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date, selectedScenario]);

  const scenarioName = scenarioLabels[selectedScenario] || selectedScenario;

  // Comparison rows
  const comparisonRows =
    baseKpis && scenarioKpis
      ? [
          {
            metric: "Total Demand (tons)",
            base: baseKpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 }),
            scenario: scenarioKpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 }),
            delta: +(scenarioKpis.demand.total_tons - baseKpis.demand.total_tons).toFixed(0),
          },
          {
            metric: "Utilization (%)",
            base: baseKpis.capacity.utilization_pct.toFixed(1),
            scenario: scenarioKpis.capacity.utilization_pct.toFixed(1),
            delta: +(scenarioKpis.capacity.utilization_pct - baseKpis.capacity.utilization_pct).toFixed(1),
          },
          {
            metric: "Overload Mills",
            base: baseKpis.capacity.overload_mills.toString(),
            scenario: scenarioKpis.capacity.overload_mills.toString(),
            delta: scenarioKpis.capacity.overload_mills - baseKpis.capacity.overload_mills,
          },
          {
            metric: "Avg Wheat Price (SAR)",
            base: baseKpis.risk.avg_wheat_price.toFixed(0),
            scenario: scenarioKpis.risk.avg_wheat_price.toFixed(0),
            delta: +(scenarioKpis.risk.avg_wheat_price - baseKpis.risk.avg_wheat_price).toFixed(0),
          },
          {
            metric: "Waste Rate (%)",
            base: baseKpis.waste.waste_rate_pct.toFixed(1),
            scenario: scenarioKpis.waste.waste_rate_pct.toFixed(1),
            delta: +(scenarioKpis.waste.waste_rate_pct - baseKpis.waste.waste_rate_pct).toFixed(1),
          },
        ]
      : [];

  // Mill overload chart - aggregate across all periods per mill
  const millOverloadChart = (() => {
    // Aggregate base mills by mill_name/mill_id
    const baseByMill: Record<string, number> = {};
    baseMills.forEach((m) => {
      const millKey = m.mill_name || m.mill_id;
      if (!baseByMill[millKey]) baseByMill[millKey] = 0;
      baseByMill[millKey] += Number(m.overload_hours) || 0;
    });
    
    // Aggregate scenario mills by mill_name/mill_id
    const scenarioByMill: Record<string, number> = {};
    scenarioMills.forEach((m) => {
      const millKey = m.mill_name || m.mill_id;
      if (!scenarioByMill[millKey]) scenarioByMill[millKey] = 0;
      scenarioByMill[millKey] += Number(m.overload_hours) || 0;
    });
    
    // Get all unique mill names from both datasets and ensure all known mills are included
    const millNames = allMillNames.length > 0 
      ? allMillNames 
      : [...new Set([...Object.keys(baseByMill), ...Object.keys(scenarioByMill)])].sort();
    
    return millNames.map((mill) => ({
      mill,
      base: Math.round(baseByMill[mill] || 0),
      scenario: Math.round(scenarioByMill[mill] || 0),
    }));
  })();

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading scenario comparison…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Analysis</p>
          <h1 className="text-2xl font-semibold text-foreground">Scenarios & What-If Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Compare any scenario against baseline using real backend data</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedScenario} onValueChange={setSelectedScenario}>
            <SelectTrigger className="w-48 border border-border bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scenarioOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => loadData(selectedScenario)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {baseKpis && scenarioKpis && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <KpiTile
            label="Demand (Base)"
            value={baseKpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            unit="tons"
            delta={0}
            driver="Baseline demand"
          />
          <KpiTile
            label={`Demand (${scenarioName})`}
            value={scenarioKpis.demand.total_tons.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            unit="tons"
            delta={+((scenarioKpis.demand.total_tons - baseKpis.demand.total_tons) / Math.max(1, baseKpis.demand.total_tons) * 100).toFixed(1)}
            driver="Scenario vs base"
          />
          <KpiTile
            label="Overload (Base)"
            value={baseMills.reduce((s, m) => s + m.overload_hours, 0).toFixed(0)}
            unit="hrs"
            delta={0}
            driver="Sum across mills"
          />
          <KpiTile
            label={`Overload (${scenarioName})`}
            value={scenarioMills.reduce((s, m) => s + m.overload_hours, 0).toFixed(0)}
            unit="hrs"
            delta={
              +(
                ((scenarioMills.reduce((s, m) => s + m.overload_hours, 0) -
                  baseMills.reduce((s, m) => s + m.overload_hours, 0)) /
                  Math.max(1, baseMills.reduce((s, m) => s + m.overload_hours, 0))) *
                100
              ).toFixed(1)
            }
            driver="Scenario vs base"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Comparison Table */}
        <ChartContainer title="Scenario Comparison" subtitle={`Base vs ${scenarioName}`}>
          {comparisonRows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  {["Metric", "Base", scenarioName, "\u0394"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.metric} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{row.metric}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.base}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.scenario}</td>
                    <td
                      className={cn(
                        "px-4 py-3 font-mono text-xs font-bold",
                        row.delta > 0 ? "text-red-600" : row.delta < 0 ? "text-emerald-600" : "text-muted-foreground"
                      )}
                    >
                      {row.delta > 0 ? "+" : ""}
                      {row.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No comparison data.</p>
          )}
        </ChartContainer>

        {/* Capacity Impact Chart */}
        <ChartContainer
          title="Capacity Impact"
          subtitle={`Base vs ${scenarioName} · overload hours by mill`}
        >
          {millOverloadChart.length > 0 ? (
            <div className="w-full" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={millOverloadChart}
                  barCategoryGap="20%"
                  barGap={6}
                  margin={{ top: 16, right: 24, bottom: 24, left: 52 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" vertical={false} />
                  <XAxis
                    dataKey="mill"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, (max: number) => Math.max(max * 1.1, 8)]}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={{ stroke: "hsl(var(--border) / 0.6)" }}
                    label={{
                      value: "Overload (hrs)",
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle", fill: "hsl(var(--muted-foreground))", fontSize: 11 },
                    }}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length || !payload[0].payload) return null;
                      const d = payload[0].payload as { mill: string; base: number; scenario: number };
                      const delta = d.scenario - d.base;
                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-lg">
                          <p className="text-xs font-semibold text-foreground border-b border-border/60 pb-1.5 mb-1.5">
                            {d.mill}
                          </p>
                          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
                            <span className="text-muted-foreground">Base:</span>
                            <span className="font-medium tabular-nums">{d.base} hrs</span>
                            <span className="text-muted-foreground">{scenarioName}:</span>
                            <span className="font-medium tabular-nums">{d.scenario} hrs</span>
                            <span className="text-muted-foreground">Delta:</span>
                            <span className={cn("font-semibold tabular-nums", delta > 0 ? "text-destructive" : delta < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                              {delta > 0 ? "+" : ""}{delta} hrs
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="base" name="Base" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  <Bar dataKey="scenario" name={scenarioName} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 mt-1 border-t border-border/60">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-4 rounded-sm shrink-0 bg-[hsl(var(--chart-3))]" />
                  <span className="text-xs font-semibold text-foreground">Base</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-4 rounded-sm shrink-0 bg-[hsl(var(--chart-1))]" />
                  <span className="text-xs font-semibold text-foreground">{scenarioName}</span>
                </span>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No mill data available.</p>
          )}
        </ChartContainer>
      </div>
    </DashboardLayout>
  );
}
