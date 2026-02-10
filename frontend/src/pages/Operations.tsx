import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchMillOperationsKpis, fetchMillSchedule, fetchMillCapacity, type MillOperationsKpis } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
  "80 Straight": "#D85B2B",
  "80/70 Blend": "#F2A85C",
  "72/60 Blend": "#8B9B7E",
  "Special Blend": "#8B4513",
};

function getRecipeColor(name: string): string {
  for (const [key, color] of Object.entries(RECIPE_COLORS)) {
    if (name.includes(key)) return color;
  }
  // Hash-based fallback
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 60%, 50%)`;
}

export default function Operations() {
  const { toast } = useToast();
  const { queryParams } = useFilters();

  const [kpis, setKpis] = useState<MillOperationsKpis | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [capacity, setCapacity] = useState<CapacityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchMillOperationsKpis(queryParams),
      fetchMillSchedule({ ...queryParams, horizon: "week" }),
      fetchMillCapacity(queryParams),
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
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon]);

  const opsKpis = kpis
    ? [
        { label: "Mill Utilization", value: kpis.mill_utilization_pct.toFixed(1), unit: "%", delta: kpis.mill_utilization_pct > 90 ? -1.3 : 1.3, driver: "Across all mills" },
        { label: "Overload Hours", value: kpis.overload_hours.toFixed(0), unit: "hrs", delta: kpis.overload_hours > 0 ? -kpis.overload_hours : 0, driver: "Total overload" },
        { label: "Recipe Switches", value: kpis.recipe_switch_count.toString(), delta: 0, driver: "Total changeovers" },
        { label: "Avg Run Length", value: kpis.avg_run_length_days.toString(), unit: "days", delta: 0.2, driver: "Average consecutive days" },
        { label: "Downtime Risk", value: kpis.downtime_risk_score.toFixed(0), unit: "/100", delta: kpis.downtime_risk_score > 50 ? -5 : 0, driver: kpis.downtime_risk_score > 50 ? "Elevated risk" : "Acceptable" },
      ]
    : [];

  // Build Gantt-like data grouped by mill
  const ganttData = (() => {
    const millIds = [...new Set(schedule.map((s) => s.mill_id))].sort();
    const allDates = [...new Set(schedule.map((s) => s.date))].sort();
    if (allDates.length === 0) return { mills: millIds, dates: allDates, blocks: [] };

    const minDate = new Date(allDates[0]);
    const maxDate = new Date(allDates[allDates.length - 1]);
    const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);

    // Group consecutive recipe runs per mill
    const blocks: { mill: string; recipe: string; startDay: number; endDay: number; color: string }[] = [];
    for (const mill of millIds) {
      const millSched = schedule.filter((s) => s.mill_id === mill).sort((a, b) => a.date.localeCompare(b.date));
      let current: { recipe: string; start: number; end: number } | null = null;
      for (const row of millSched) {
        const day = Math.ceil((new Date(row.date).getTime() - minDate.getTime()) / 86400000) + 1;
        const recipe = row.recipe_name || row.recipe_id;
        if (current && current.recipe === recipe && day <= current.end + 2) {
          current.end = day;
        } else {
          if (current) {
            blocks.push({ mill, recipe: current.recipe, startDay: current.start, endDay: current.end, color: getRecipeColor(current.recipe) });
          }
          current = { recipe, start: day, end: day };
        }
      }
      if (current) {
        blocks.push({ mill, recipe: current.recipe, startDay: current.start, endDay: current.end, color: getRecipeColor(current.recipe) });
      }
    }

    return { mills: millIds, dates: allDates, totalDays, blocks };
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
    };
  });

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
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading operations data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mill Runtime & Sequencing</h1>
        <p className="text-sm text-muted-foreground">Gantt timeline and capacity ledger across all mills</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {opsKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Gantt Chart */}
      <ChartContainer title="Mill Schedule Timeline" subtitle={`Recipe runs (${ganttData.dates.length} days)`} className="mb-6">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {ganttData.mills.map((mill) => (
              <div key={mill} className="mb-2 flex items-center">
                <div className="w-20 text-sm font-semibold text-foreground truncate">{mill}</div>
                <div className="relative flex-1 h-10 rounded-md bg-accent/30">
                  {ganttData.blocks
                    .filter((b) => b.mill === mill)
                    .map((block, i) => {
                      const total = ganttData.totalDays || 14;
                      return (
                        <div
                          key={i}
                          className="absolute top-1 bottom-1 flex items-center justify-center rounded-md text-[10px] font-semibold text-white shadow-sm overflow-hidden"
                          style={{
                            left: `${((block.startDay - 1) / total) * 100}%`,
                            width: `${Math.max(2, ((block.endDay - block.startDay + 1) / total) * 100)}%`,
                            backgroundColor: block.color,
                          }}
                          title={`${block.recipe} (Day ${block.startDay}-${block.endDay})`}
                        >
                          {block.recipe.split(" ")[0]}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
            {ganttData.mills.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No schedule data available.</p>
            )}
          </div>
        </div>
      </ChartContainer>

      {/* Capacity Ledger */}
      <ChartContainer title="Capacity Ledger" subtitle="Available vs Planned hours per mill">
        {ledger.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                {["Mill", "Available Hours", "Planned Hours", "Variance", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, i) => (
                <tr key={row.mill} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-accent/20")}>
                  <td className="px-4 py-3 font-semibold">{row.mill}</td>
                  <td className="px-4 py-3 font-mono">{row.available}</td>
                  <td className="px-4 py-3 font-mono">{row.planned}</td>
                  <td className="px-4 py-3 font-mono">{row.variance}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent/60"
                      onClick={() => handleLedgerClick(row.mill, row.status)}
                    >
                      {row.status === "ok" && <Check className="h-4 w-4 text-success" />}
                      {row.status === "warning" && <AlertTriangle className="h-4 w-4 text-warning" />}
                      {row.status === "danger" && <X className="h-4 w-4 text-destructive" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No capacity data available.</p>
        )}
      </ChartContainer>
    </DashboardLayout>
  );
}
