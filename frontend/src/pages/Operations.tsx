import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchMillOperationsKpis, fetchMillSchedule, fetchMillCapacity, type MillOperationsKpis } from "@/lib/api";
import { cn, downloadCsv } from "@/lib/utils";
import { Check, AlertTriangle, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/** Parse period string (YYYY-MM or YYYY-Www) to a Date for comparison */
function periodToDate(period: string): Date | null {
  if (!period) return null;
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const [, y, m] = monthMatch;
    return new Date(Number(y), Number(m) - 1, 1);
  }
  const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
  if (weekMatch) {
    const [, y, w] = weekMatch;
    const jan1 = new Date(Number(y), 0, 1);
    const firstMonday = jan1.getDay() === 0 ? 1 : jan1.getDay() === 1 ? 0 : 8 - jan1.getDay();
    const start = new Date(Number(y), 0, 1 + firstMonday + (Number(w) - 1) * 7);
    return start;
  }
  return null;
}

function isPeriodInRange(period: string, from: Date, to: Date): boolean {
  const d = periodToDate(period);
  if (!d) return true;
  const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return d >= fromStart && d <= toEnd;
}

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
  "Bakery Standard":  "#2563EB",   // vivid blue
  "Patent Blend":     "#F59E0B",   // amber / gold
  "Brown Flour":      "#92400E",   // rich brown
  "Standard Blend":   "#10B981",   // emerald green
  "Premium Patent":   "#8B5CF6",   // violet / purple
  "Whole Wheat":      "#D97706",   // deep orange
  "Pastry Flour":     "#EC4899",   // pink
  "Cake Flour":       "#06B6D4",   // cyan
  // Legacy / alternate names
  "80 Straight":      "#D85B2B",   // burnt orange
  "80/70 Blend":      "#F2A85C",   // peach
  "72/60 Blend":      "#0EA5E9",   // sky blue
  "Special Blend":    "#E11D48",   // rose red
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
  const [ledgerDateRange, setLedgerDateRange] = useState<DateRange | undefined>(undefined);
  const [timelineRowsPerPage, setTimelineRowsPerPage] = useState(14);
  const [timelinePage, setTimelinePage] = useState(0);

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

  // Grid timeline: date (rows) × mill (columns) → primary recipe per cell (most hours that day)
  const timelineGrid = useMemo(() => {
    const millIds = [...new Set(schedule.map((s) => s.mill_id))].sort();
    const mills = millIds.map((id) => ({ millId: id, millName: millNameMap[id] || id }));
    const dates = [...new Set(schedule.map((s) => s.date))].sort();
    if (dates.length === 0 || mills.length === 0) return { dates, mills, getCell: () => null };

    // For each (date, mill_id) pick the recipe with max duration_hours
    const cellMap = new Map<string, { recipe: string; hours: number }>();
    for (const row of schedule) {
      const key = `${row.date}|${row.mill_id}`;
      const hours = row.duration_hours ?? 0;
      const recipe = row.recipe_name || row.recipe_id;
      const existing = cellMap.get(key);
      if (!existing || hours > existing.hours) {
        cellMap.set(key, { recipe, hours });
      }
    }

    const getCell = (date: string, millId: string) => cellMap.get(`${date}|${millId}`) ?? null;
    return { dates, mills, getCell };
  }, [schedule, capacity]);

  const timelineTotalRows = timelineGrid.dates.length;
  const timelineTotalPages = Math.max(1, Math.ceil(timelineTotalRows / timelineRowsPerPage));

  useEffect(() => {
    setTimelinePage((prev) => Math.min(prev, timelineTotalPages - 1));
  }, [timelineTotalPages]);

  const timelineVisibleDates = useMemo(() => {
    const start = timelinePage * timelineRowsPerPage;
    return timelineGrid.dates.slice(start, start + timelineRowsPerPage);
  }, [timelineGrid.dates, timelinePage, timelineRowsPerPage]);

  // Filter capacity by ledger date range when set
  const capacityForLedger = useMemo(() => {
    if (!ledgerDateRange?.from || !ledgerDateRange?.to) return capacity;
    return capacity.filter((row) =>
      isPeriodInRange(row.period || "", ledgerDateRange.from!, ledgerDateRange.to!)
    );
  }, [capacity, ledgerDateRange]);

  // Build ledger from (possibly filtered) capacity data
  const ledger = capacityForLedger.map((row) => {
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

  // Chart view should be mill-level to avoid repeating X-axis labels for each period row.
  const ledgerChartData = useMemo(() => {
    const byMill: Record<string, { mill: string; available: number; planned: number; periods: number }> = {};
    for (const row of ledger) {
      if (!byMill[row.mill]) {
        byMill[row.mill] = { mill: row.mill, available: 0, planned: 0, periods: 0 };
      }
      byMill[row.mill].available += row.available;
      byMill[row.mill].planned += row.planned;
      byMill[row.mill].periods += 1;
    }
    return Object.values(byMill).map((m) => ({
      ...m,
      available: Math.round(m.available),
      planned: Math.round(m.planned),
    }));
  }, [ledger]);

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

  // Ledger date range text (when local filter is applied)
  const ledgerDateRangeText =
    ledgerDateRange?.from && ledgerDateRange?.to
      ? `${ledgerDateRange.from.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} to ${ledgerDateRange.to.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`
      : null;

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
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Core Planning</p>
        <h1 className="text-2xl font-semibold text-foreground">Mill Runtime & Sequencing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gantt timeline and capacity ledger across all mills</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {opsKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Mill Planning — schedule timeline and capacity view */}
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Mill Planning</p>
      <ChartContainer
        title="Mill Schedule Timeline"
        subtitle={`Primary blend per mill per day${dateRangeText ? ` · ${dateRangeText}` : ""}`}
        action={
          timelineTotalRows > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Rows</span>
              <select
                value={timelineRowsPerPage}
                onChange={(e) => {
                  setTimelineRowsPerPage(Number(e.target.value));
                  setTimelinePage(0);
                }}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
              >
                <option value={14}>14</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
              <button
                type="button"
                onClick={() => setTimelinePage((p) => Math.max(0, p - 1))}
                disabled={timelinePage === 0}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setTimelinePage((p) => Math.min(timelineTotalPages - 1, p + 1))}
                disabled={timelinePage >= timelineTotalPages - 1}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null
        }
        className="mb-6"
      >
        {timelineGrid.dates.length > 0 && timelineGrid.mills.length > 0 ? (
          <div className="overflow-auto max-h-[560px]">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky top-0 z-10 w-24 text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-card">
                    Date
                  </th>
                  {timelineGrid.mills.map((m) => (
                    <th key={m.millId} className="sticky top-0 z-10 py-3 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-foreground min-w-[120px] bg-card">
                      {m.millName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {timelineVisibleDates.map((dateStr) => {
                  const dateLabel = (() => {
                    try {
                      const d = new Date(dateStr);
                      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    } catch {
                      return dateStr;
                    }
                  })();
                  return (
                    <tr key={dateStr} className="hover:bg-muted/20 transition-colors">
                      <td className="w-24 py-2.5 px-3 font-medium text-foreground align-middle whitespace-nowrap">
                        {dateLabel}
                      </td>
                      {timelineGrid.mills.map((m) => {
                        const cell = timelineGrid.getCell(dateStr, m.millId);
                        const recipe = cell?.recipe ?? null;
                        const color = recipe ? getRecipeColor(recipe) : undefined;
                        return (
                          <td key={m.millId} className="py-2.5 px-3 align-middle text-center">
                            <div className="flex justify-center items-center min-h-[32px]">
                              {recipe ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm cursor-default hover:opacity-90"
                                      style={{ backgroundColor: color }}
                                    >
                                      {recipe}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={6} align="center" className="max-w-xs">
                                    <p className="font-semibold">{recipe}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {m.millName} · {dateLabel}
                                      {cell?.hours != null && ` · ${Number(cell.hours).toFixed(1)} hrs`}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {timelineTotalRows === 0 ? 0 : timelinePage * timelineRowsPerPage + 1}
              </span>
              {" "}to{" "}
              <span className="font-medium text-foreground">
                {Math.min((timelinePage + 1) * timelineRowsPerPage, timelineTotalRows)}
              </span>
              {" "}of{" "}
              <span className="font-medium text-foreground">{timelineTotalRows}</span>{" "}
              rows
            </div>
            {/* Recipe legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 mt-1 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground">Blends:</span>
              {[...new Set(schedule.map((s) => s.recipe_name || s.recipe_id))].filter(Boolean).sort().map((recipe) => {
                const color = getRecipeColor(recipe);
                return (
                  <span key={recipe} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-foreground">{recipe}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No schedule data available.</p>
        )}
      </ChartContainer>

      {/* Capacity Ledger */}
      <ChartContainer
        title="Capacity Ledger"
        subtitle={
          ledgerDateRangeText
            ? `Filtered: ${ledgerDateRangeText}`
            : dateRangeText
              ? `Available vs Planned hours per mill (${dateRangeText})`
              : "Available vs Planned hours per mill"
        }
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => downloadCsv(ledger as unknown as Record<string, unknown>[], "operations_capacity_ledger")}
            disabled={ledger.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 mb-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Date filter (ledger only)</span>
          <DatePickerWithRange date={ledgerDateRange} setDate={setLedgerDateRange} className="shrink-0" />
          {ledgerDateRange?.from && (
            <button
              type="button"
              onClick={() => setLedgerDateRange(undefined)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="h-[300px] w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={ledgerChartData}
              margin={{ top: 20, right: 24, left: 20, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="mill" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={{ stroke: "hsl(var(--border))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={{ stroke: "hsl(var(--border))" }} width={40} />
              <RechartsTooltip
                cursor={{ fill: "hsl(var(--accent) / 0.3)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", fontSize: 12, padding: "8px 12px", boxShadow: "0 4px 16px hsl(var(--foreground) / 0.06)" }}
                formatter={(value: number, name: string) => [`${Math.round(value)} hrs`, name]}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as { periods?: number } | undefined;
                  return row?.periods ? `${label} (${row.periods} periods)` : String(label);
                }}
              />
              <Legend
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  return (
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-5 pb-1">
                      <div className="inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-lg border border-border/70 bg-muted/30 px-4 py-2.5 shadow-sm">
                        {payload.map((entry) => (
                          <div key={entry.value} className="flex items-center gap-2.5">
                            <span className="h-3 w-5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs font-semibold text-foreground whitespace-nowrap">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="available" name="Available Hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="planned" name="Planned Hours" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {ledger.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {["Mill", "Period", "Available Hours", "Planned Hours", "Variance", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, i) => (
                <tr key={`${row.mill}-${row.period}`} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                  <td className="px-4 py-2.5 font-semibold text-foreground text-xs">{row.mill}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.period || "N/A"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.available}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.planned}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.variance}</td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent"
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
          <p className="py-8 text-center text-sm text-muted-foreground">No capacity data available.</p>
        )}
      </ChartContainer>
    </DashboardLayout>
  );
}
