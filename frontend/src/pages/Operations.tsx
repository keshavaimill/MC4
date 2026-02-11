import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchMillOperationsKpis, fetchMillSchedule, fetchMillCapacity, type MillOperationsKpis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { useToast } from "@/components/ui/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ScheduleRow {
  mill_id: string;
  recipe_id: string;
  recipe_name: string;
  date: string;
  duration_hours: number;
  period: string;
}

interface CapacityRow {
  mill_id: string;
  mill_name: string;
  scheduled_hours: number;
  available_hours: number;
  overload_hours: number;
  utilization_pct: number;
  period: string;
}

const RECIPE_COLORS: Record<string, string> = {
  // Actual recipe names from data
  "Bakery Standard": "#2563EB",   // vivid blue
  "Patent Blend": "#F59E0B",   // amber / gold
  "Brown Flour": "#92400E",   // rich brown
  "Standard Blend": "#10B981",   // emerald green
  "Premium Patent": "#8B5CF6",   // violet / purple
  "Whole Wheat": "#D97706",   // deep orange
  "Pastry Flour": "#EC4899",   // pink
  "Cake Flour": "#06B6D4",   // cyan
  // Legacy / alternate names
  "80 Straight": "#D85B2B",   // burnt orange
  "80/70 Blend": "#F2A85C",   // peach
  "72/60 Blend": "#0EA5E9",   // sky blue
  "Special Blend": "#E11D48",   // rose red
};

// Distinct palette for any recipe not in the map
const FALLBACK_PALETTE = [
  "#E11D48", "#7C3AED", "#0891B2", "#059669", "#CA8A04",
  "#DC2626", "#4F46E5", "#0D9488", "#65A30D", "#EA580C",
  "#9333EA", "#0284C7", "#16A34A", "#D97706", "#DB2777",
];
const _assignedFallback: Record<string, string> = {};
let _fallbackIdx = 0;

function getRecipeColor(name: string): string {
  // Direct match
  if (RECIPE_COLORS[name]) return RECIPE_COLORS[name];
  // Partial match
  for (const [key, color] of Object.entries(RECIPE_COLORS)) {
    if (name.includes(key) || key.includes(name)) return color;
  }
  // Deterministic fallback – assign a distinct palette color per unique recipe
  if (!_assignedFallback[name]) {
    _assignedFallback[name] = FALLBACK_PALETTE[_fallbackIdx % FALLBACK_PALETTE.length];
    _fallbackIdx++;
  }
  return _assignedFallback[name];
}

export default function Operations() {
  const { toast } = useToast();
  const { queryParams, kpiQueryParams } = useFilters();

  const [kpis, setKpis] = useState<MillOperationsKpis | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [capacity, setCapacity] = useState<CapacityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchMillOperationsKpis(kpiQueryParams),           // KPIs use future-only dates
      fetchMillSchedule({ ...queryParams, horizon: "week" }),  // Data uses full range
      fetchMillCapacity(queryParams),                     // Data uses full range
    ])
      .then(([kpiData, schedData, capData]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setSchedule(schedData.data as unknown as ScheduleRow[]);
        setCapacity(capData.data as unknown as CapacityRow[]);
      })
      .catch((err) => {
        if (!cancelled) console.error("Operations data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date]);

  const opsKpis = kpis
    ? [
      { label: "Mill Utilization", value: kpis.mill_utilization_pct.toFixed(1), unit: "%", delta: kpis.mill_utilization_pct > 90 ? -1.3 : 1.3, driver: "Across all mills" },
      { label: "Overload Hours", value: kpis.overload_hours.toFixed(0), unit: "hrs", delta: kpis.overload_hours > 0 ? -kpis.overload_hours : 0, driver: "Total overload" },
      { label: "Recipe Switches", value: kpis.recipe_switch_count.toString(), delta: 0, driver: "Total changeovers" },
      { label: "Avg Run Length", value: kpis.avg_run_length_days.toString(), unit: "days", delta: 0.2, driver: "Average consecutive days" },
      { label: "Downtime Risk", value: kpis.downtime_risk_score.toFixed(0), unit: "/100", delta: kpis.downtime_risk_score > 50 ? -5 : 0, driver: kpis.downtime_risk_score > 50 ? "Elevated risk" : "Acceptable" },
    ]
    : [];

  // Create mill_id to mill_name mapping from capacity data
  const millNameMap = (() => {
    const map: Record<string, string> = {};
    for (const row of capacity) {
      if (row.mill_id && row.mill_name) {
        map[row.mill_id] = row.mill_name;
      }
    }
    return map;
  })();

  // Build Gantt-like data grouped by mill
  const ganttData = (() => {
    const millIds = [...new Set(schedule.map((s) => s.mill_id))].sort();
    // Map mill IDs to mill names, fallback to mill_id if name not available
    const mills = millIds.map(id => millNameMap[id] || id);
    const allDates = [...new Set(schedule.map((s) => s.date))].sort();
    if (allDates.length === 0) return { mills, millIds, dates: allDates, blocks: [] };

    const minDate = new Date(allDates[0]);
    const maxDate = new Date(allDates[allDates.length - 1]);
    const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);

    // Group consecutive recipe runs per mill
    const blocks: { mill: string; millId: string; recipe: string; startDay: number; endDay: number; color: string }[] = [];
    for (const millId of millIds) {
      const millName = millNameMap[millId] || millId;
      const millSched = schedule.filter((s) => s.mill_id === millId).sort((a, b) => a.date.localeCompare(b.date));
      let current: { recipe: string; start: number; end: number } | null = null;
      for (const row of millSched) {
        const day = Math.ceil((new Date(row.date).getTime() - minDate.getTime()) / 86400000) + 1;
        const recipe = row.recipe_name || row.recipe_id;
        if (current && current.recipe === recipe && day <= current.end + 2) {
          current.end = day;
        } else {
          if (current) {
            blocks.push({ mill: millName, millId, recipe: current.recipe, startDay: current.start, endDay: current.end, color: getRecipeColor(current.recipe) });
          }
          current = { recipe, start: day, end: day };
        }
      }
      if (current) {
        blocks.push({ mill: millName, millId, recipe: current.recipe, startDay: current.start, endDay: current.end, color: getRecipeColor(current.recipe) });
      }
    }

    return { mills, millIds, dates: allDates, totalDays, blocks };
  })();

  // Build ledger from capacity data
  const ledger = capacity.map((row) => {
    const variance = row.available_hours - row.scheduled_hours;
    const status: "ok" | "warning" | "danger" =
      variance <= 0 ? "danger" : variance < row.available_hours * 0.1 ? "warning" : "ok";
    return {
      mill: row.mill_name || row.mill_id,
      available: Math.round(row.available_hours),
      planned: Math.round(row.scheduled_hours),
      variance: Math.round(variance),
      status,
      period: row.period || "",
    };
  });

  // Format date range for display
  const formatDateRange = () => {
    if (!queryParams.from_date || !queryParams.to_date) return "";
    try {
      const from = new Date(queryParams.from_date);
      const to = new Date(queryParams.to_date);
      const fromStr = from.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
      const toStr = to.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
      return `${fromStr} to ${toStr}`;
    } catch {
      return `${queryParams.from_date} to ${queryParams.to_date}`;
    }
  };

  const dateRangeText = formatDateRange();

  const handleLedgerClick = (mill: string, status: "ok" | "warning" | "danger") => {
    if (status === "ok") return;
    const suggestion =
      status === "warning"
        ? "Consider shifting load or extending shifts on a low-utilization mill."
        : "Mill is at or beyond capacity. Defer non-critical recipes or re-route volume.";
    toast({
      title: `Capacity resolution for ${mill}`,
      description: suggestion,
      variant: status === "danger" ? "destructive" : "default",
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading operations data…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Mill Runtime & Sequencing</h1>
        <p className="text-sm text-gray-600 mt-1">Gantt timeline and capacity ledger across all mills</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {opsKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Gantt Chart */}
      <ChartContainer title="Mill Schedule Timeline" subtitle={`Recipe runs across ${ganttData.dates.length} days${dateRangeText ? ` (${dateRangeText})` : ""}`} className="mb-6">
        {ganttData.mills.length > 0 ? (() => {
          const total = ganttData.totalDays || 14;
          // Build date labels from the actual date range
          const dateLabels: { label: string; dayNum: number }[] = [];
          if (ganttData.dates.length > 0) {
            const minDate = new Date(ganttData.dates[0]);
            for (let d = 0; d < total; d++) {
              const dt = new Date(minDate.getTime() + d * 86400000);
              dateLabels.push({
                label: dt.toLocaleDateString("en-US", { day: "numeric", month: "short" }),
                dayNum: d + 1,
              });
            }
          }
          // Collect unique recipes for legend
          const uniqueRecipes = [...new Set(ganttData.blocks.map((b) => b.recipe))];

          return (
            <div className="space-y-4">
              {/* Scrollable Gantt area */}
              <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: Math.max(700, total * 48) }}>
                  {/* Date header row */}
                  <div className="flex items-end mb-1" style={{ paddingLeft: 140 }}>
                    {dateLabels.map((dl, i) => {
                      // Show every label if ≤ 14 days, else show every Nth
                      const step = total <= 14 ? 1 : total <= 30 ? 2 : 4;
                      return (
                        <div
                          key={i}
                          className="text-center border-l border-gray-300"
                          style={{ width: `${100 / total}%` }}
                        >
                          {i % step === 0 ? (
                            <span className="text-[10px] font-medium text-gray-600 leading-tight">
                              {dl.label}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mill rows */}
                  {ganttData.mills.map((mill, idx) => {
                    const millId = ganttData.millIds[idx];
                    const millBlocks = ganttData.blocks.filter((b) => b.millId === millId);
                    return (
                      <div key={millId} className="flex items-center group">
                        {/* Mill name */}
                        <div
                          className="flex-shrink-0 pr-3 text-sm font-semibold text-gray-900 truncate"
                          style={{ width: 140 }}
                          title={mill}
                        >
                          {mill}
                        </div>

                        {/* Timeline bar */}
                        <div
                          className="relative flex-1 border-b border-gray-200 group-hover:bg-gray-50 transition-colors"
                          style={{ height: 44 }}
                        >
                          {/* Vertical gridlines */}
                          {dateLabels.map((_, gi) => (
                            <div
                              key={gi}
                              className="absolute top-0 bottom-0 border-l border-gray-200"
                              style={{ left: `${(gi / total) * 100}%` }}
                            />
                          ))}

                          {/* Recipe blocks */}
                          {millBlocks.map((block, i) => {
                            const leftPct = ((block.startDay - 1) / total) * 100;
                            const widthPct = Math.max(
                              100 / total * 0.6,
                              ((block.endDay - block.startDay + 1) / total) * 100
                            );
                            const durationDays = block.endDay - block.startDay + 1;
                            return (
                              <div
                                key={i}
                                className="absolute top-[5px] bottom-[5px] flex items-center rounded-md shadow-sm cursor-pointer transition-all hover:brightness-110 hover:shadow-md hover:scale-y-110 origin-center z-10 overflow-hidden"
                                style={{
                                  left: `${leftPct}%`,
                                  width: `${widthPct}%`,
                                  backgroundColor: block.color,
                                }}
                                title={`${block.recipe}\nDays ${block.startDay}–${block.endDay} (${durationDays} day${durationDays > 1 ? "s" : ""})`}
                              >
                                <span className="text-[11px] font-semibold text-white truncate px-2 drop-shadow-sm w-full text-center">
                                  {durationDays >= 3 ? block.recipe : block.recipe.split(" ")[0]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recipe legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-gray-200">
                <span className="text-xs font-medium text-gray-600 mr-1">Recipes:</span>
                {uniqueRecipes.map((recipe) => {
                  const color = getRecipeColor(recipe);
                  return (
                    <div key={recipe} className="flex items-center gap-1.5">
                      <div className="flex items-center">
                        {/* Left bar */}
                        <div
                          className="w-1.5 h-1 rounded-l"
                          style={{ backgroundColor: color }}
                        />
                        {/* Circle with white center */}
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: color }}
                        >
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                        {/* Right bar */}
                        <div
                          className="w-1.5 h-1 rounded-r"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                      <span className="text-xs text-gray-700">{recipe}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })() : (
          <p className="py-8 text-center text-sm text-gray-600">No schedule data available.</p>
        )}
      </ChartContainer>

      {/* Capacity Ledger */}
      <ChartContainer
        title="Capacity Ledger"
        subtitle={dateRangeText ? `Available vs Planned hours per mill (${dateRangeText})` : "Available vs Planned hours per mill"}
      >
        <div className="h-[300px] w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={ledger}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mill" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip cursor={{ fill: "transparent" }} />
              <Legend />
              <Bar dataKey="available" name="Available Hours" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="planned" name="Planned Hours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {ledger.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                {["Mill", "Period", "Available Hours", "Planned Hours", "Variance", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, i) => (
                <tr key={`${row.mill}-${row.period}`} className={cn("border-t border-gray-200", i % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.mill}</td>
                  <td className="px-4 py-3 text-gray-600">{row.period || "N/A"}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{row.available}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{row.planned}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{row.variance}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md p-1 hover:bg-gray-200"
                      onClick={() => handleLedgerClick(row.mill, row.status)}
                    >
                      {row.status === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
                      {row.status === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                      {row.status === "danger" && <X className="h-4 w-4 text-red-600" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-sm text-gray-600">No capacity data available.</p>
        )}
      </ChartContainer>
    </DashboardLayout>
  );
}
