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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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
  const [loading, setLoading] = useState(true);

  const loadData = async (scenario: string) => {
    setLoading(true);
    try {
      // KPIs use future-only dates; mill capacity data uses full range
      const baseKpiParams = { ...kpiQueryParams, scenario: "base" };
      const scenKpiParams = { ...kpiQueryParams, scenario };
      const baseDataParams = { ...queryParams, scenario: "base" };
      const scenDataParams = { ...queryParams, scenario };

      const [bKpi, sKpi, bMills, sMills] = await Promise.all([
        fetchExecutiveKpis(baseKpiParams),        // KPIs use future-only dates
        fetchExecutiveKpis(scenKpiParams),         // KPIs use future-only dates
        fetchMillCapacity(baseDataParams),         // Data uses full range
        fetchMillCapacity(scenDataParams),         // Data uses full range
      ]);

      setBaseKpis(bKpi);
      setScenarioKpis(sKpi);
      setBaseMills(bMills.data as unknown as MillCapRow[]);
      setScenarioMills(sMills.data as unknown as MillCapRow[]);
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

  // Mill overload chart
  const millOverloadChart = (() => {
    const millNames = [...new Set([...baseMills.map((m) => m.mill_name || m.mill_id), ...scenarioMills.map((m) => m.mill_name || m.mill_id)])].sort();
    return millNames.map((mill) => {
      const bRow = baseMills.find((m) => (m.mill_name || m.mill_id) === mill);
      const sRow = scenarioMills.find((m) => (m.mill_name || m.mill_id) === mill);
      return {
        mill,
        base: bRow ? Math.round(bRow.overload_hours) : 0,
        scenario: sRow ? Math.round(sRow.overload_hours) : 0,
      };
    });
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
          <h1 className="text-3xl font-bold text-gray-900">Scenarios & What-If Studio</h1>
          <p className="text-sm text-gray-600 mt-1">Compare any scenario against baseline using real backend data</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedScenario} onValueChange={setSelectedScenario}>
            <SelectTrigger className="w-48 border-2 border-gray-200 bg-white">
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
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-colors shadow-md"
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
                <tr className="bg-gray-100">
                  {["Metric", "Base", scenarioName, "\u0394"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.metric} className={cn("border-t border-gray-200", i % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                    <td className="px-4 py-3 text-xs font-medium text-gray-900">{row.metric}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{row.base}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{row.scenario}</td>
                    <td
                      className={cn(
                        "px-4 py-3 font-mono text-xs font-bold",
                        row.delta > 0 ? "text-red-600" : row.delta < 0 ? "text-emerald-600" : "text-gray-500"
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
            <p className="py-8 text-center text-sm text-gray-600">No comparison data.</p>
          )}
        </ChartContainer>

        {/* Capacity Impact Chart */}
        <ChartContainer title="Capacity Impact" subtitle="Overload hours by mill">
          {millOverloadChart.length > 0 ? (
            <div className="w-full" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={millOverloadChart} 
                  barCategoryGap="25%"
                  margin={{ top: 10, right: 20, bottom: 60, left: 50 }}
                >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mill" tick={{ fontSize: 12, fill: '#374151' }} />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#374151' }} 
                  label={{ 
                    value: "Overload (hrs)", 
                    angle: -90, 
                    position: "left", 
                    style: { textAnchor: 'middle', fill: '#374151' },
                    fontSize: 11 
                  }} 
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconSize={10}
                  iconType="rect"
                  formatter={(value) => <span style={{ fontSize: '11px', color: '#111827' }}>{value}</span>}
                />
                <Bar dataKey="base" name="Base" fill="#6b7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="scenario" name={scenarioName} fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-600">No mill data available.</p>
          )}
        </ChartContainer>
      </div>
    </DashboardLayout>
  );
}
