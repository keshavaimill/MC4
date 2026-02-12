import { useEffect, useState, useMemo } from "react";
import { ChartContainer } from "./ChartContainer";
import { fetchMillCapacity, fetchRecipePlanning } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useFilters } from "@/context/FilterContext";
import { parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductionPlanningTrendChartProps {
  className?: string;
}

interface CapacityDataPoint {
  period: string;
  plannedRecipeHours: number | null;
  availableMillHours: number | null;
}

// Historical data ends at 2026-02-14 (February 14, 2026)
// Forecasted data starts from 2026-02-15 (February 15, 2026) onwards
const HISTORICAL_END_DATE = new Date("2026-02-14");

function capacityHorizonForFilter(periodFilter: string): "day" | "week" | "month" | "year" {
  switch (periodFilter) {
    case "7days":
    case "15days":
    case "30days":
      return "day"; // Daily data for short-term filters
    case "quarter":
    case "year":
      return "month"; // Month-wise data for quarter and year filters
    default:
      return "month";
  }
}

interface MillInfo {
  mill_id: string;
  mill_name: string;
}

export function ProductionPlanningTrendChart({ className }: ProductionPlanningTrendChartProps) {
  const { queryParams, periodFilter } = useFilters();
  const [capacityData, setCapacityData] = useState<Record<string, unknown>[]>([]);
  const [recipeData, setRecipeData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMill, setSelectedMill] = useState<string>("all");
  const [mills, setMills] = useState<MillInfo[]>([]);

  // Fetch mill names on mount
  useEffect(() => {
    const loadMills = async () => {
      try {
        const res = await fetchMillCapacity({ from_date: "2020-01-01", to_date: "2027-12-31", horizon: "month" });
        const millData = res.data || [];
        const uniqueMills = Array.from(
          new Map(
            millData
              .filter((item) => item.mill_id && item.mill_name)
              .map((item) => [item.mill_id as string, { mill_id: item.mill_id as string, mill_name: item.mill_name as string }])
          ).values()
        ).sort((a, b) => a.mill_id.localeCompare(b.mill_id));
        setMills(uniqueMills);
      } catch (err) {
        console.error("Error loading mills:", err);
      }
    };
    loadMills();
  }, []);

  const capacityParams = useMemo(
    () => {
      const params: Record<string, string | undefined> = {
        ...queryParams,
        horizon: capacityHorizonForFilter(periodFilter),
      };
      // Override with local mill filter if selected
      if (selectedMill !== "all") {
        params.mill_id = selectedMill;
      }
      return params;
    },
    [queryParams.from_date, queryParams.to_date, queryParams.scenario, periodFilter, selectedMill]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    Promise.all([
      fetchMillCapacity(capacityParams),
      fetchRecipePlanning(capacityParams),
    ])
      .then(([capacityResponse, recipeResponse]) => {
        if (cancelled) return;
        setCapacityData(Array.isArray(capacityResponse.data) ? capacityResponse.data : []);
        setRecipeData(Array.isArray(recipeResponse.data) ? recipeResponse.data : []);
      })
      .catch((err) => {
        if (!cancelled) console.error("Production Planning data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [
    capacityParams.from_date,
    capacityParams.to_date,
    capacityParams.scenario,
    capacityParams.horizon,
    capacityParams.mill_id,
    selectedMill,
  ]);

  // Determine if a period is historical or forecasted based on the period string
  const isHistoricalPeriod = (period: string): boolean => {
    try {
      // Try to parse period as date
      // Period format could be "2026-02-14" (daily), "2026-W07" (weekly), "2026-02" (monthly), etc.
      if (period.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date format: "2026-02-14" (daily data)
        const periodDate = parseISO(period);
        return periodDate <= HISTORICAL_END_DATE;
      } else if (period.includes("W")) {
        // Week format: "2026-W07"
        const [year, week] = period.split("-W");
        const yearNum = parseInt(year);
        if (yearNum < 2026) return true;
        if (yearNum > 2026) return false;
        const weekNum = parseInt(week);
        // Week 7 is around mid-February, so week 7 and earlier are historical
        // Week 8 starts around Feb 15, so week 8+ are forecasted
        return weekNum <= 7;
      } else if (period.match(/^\d{4}-\d{2}$/)) {
        // Month format: "2026-02"
        const [year, month] = period.split("-");
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        if (yearNum < 2026) return true;
        if (yearNum > 2026) return false;
        // January 2026 and earlier are historical
        // February 2026: period "2026-02" contains both historical (up to 14th) and forecasted (15th+)
        // For monthly aggregation, we'll mark February as forecasted since most of it is forecasted
        // But we need to ensure continuity - February should appear in both series for smooth transition
        return monthNum < 2;
      } else if (period.match(/^\d{4}$/)) {
        // Year format: "2026"
        return parseInt(period) < 2026;
      }
      // Default: try to compare as string
      return period <= "2026-02-14";
    } catch {
      // If parsing fails, default to historical for safety
      return true;
    }
  };

  // Aggregate data by period: Planned Recipe Hours and Available Mill Hours
  // Separate into historical and forecasted for proper styling
  const chartData = useMemo(() => {
    const byPeriod: Record<string, { 
      plannedRecipeHours: number;
      availableMillHours: number;
    }> = {};
    
    // Aggregate planned recipe hours from recipe data
    for (const row of recipeData) {
      const period = (row.period as string) || "";
      const scheduledHours = Number(row.scheduled_hours) || 0;
      
      if (!byPeriod[period]) {
        byPeriod[period] = { 
          plannedRecipeHours: 0,
          availableMillHours: 0,
        };
      }
      byPeriod[period].plannedRecipeHours += scheduledHours;
    }
    
    // Aggregate available mill hours from capacity data
    for (const row of capacityData) {
      const period = (row.period as string) || "";
      const availableHours = Number(row.available_hours) || 0;
      
      if (!byPeriod[period]) {
        byPeriod[period] = { 
          plannedRecipeHours: 0,
          availableMillHours: 0,
        };
      }
      byPeriod[period].availableMillHours += availableHours;
    }
    
    // Find the divider period (first forecasted period)
    const sortedPeriods = Object.keys(byPeriod).sort((a, b) => a.localeCompare(b));
    // For daily data, the divider should be "2026-02-15"
    // For monthly data (quarter/year filters), the divider should be "2026-02" (February)
    // For other periods, find the first forecasted period
    let dividerPeriod: string | null = null;
    if (capacityParams.horizon === "day") {
      dividerPeriod = "2026-02-15";
    } else if (capacityParams.horizon === "month") {
      // For monthly data, February 2026 is the first forecasted month
      dividerPeriod = sortedPeriods.find(p => p === "2026-02" || (p.match(/^\d{4}-\d{2}$/) && !isHistoricalPeriod(p))) || "2026-02";
    } else {
      dividerPeriod = sortedPeriods.find(p => !isHistoricalPeriod(p)) || null;
    }
    
    // Create data points with separate historical and forecasted values
    // For monthly data, ensure February appears in both series for smooth transition
    const dataPoints = Object.entries(byPeriod)
      .map(([period, values]) => {
        const isHistorical = isHistoricalPeriod(period);
        const isFebruary2026 = period === "2026-02";
        const plannedHours = values.plannedRecipeHours > 0 ? Math.round(values.plannedRecipeHours) : null;
        const availableHours = values.availableMillHours > 0 ? Math.round(values.availableMillHours) : null;
        
        // For February 2026 (monthly aggregation), include it in both historical and forecasted
        // to create a smooth visual transition
        if (isFebruary2026 && capacityParams.horizon === "month") {
          return {
            period,
            plannedRecipeHours: plannedHours,
            availableMillHours: availableHours,
            // February appears in both series for continuity
            historicalPlanned: plannedHours,
            historicalAvailable: availableHours,
            forecastedPlanned: plannedHours,
            forecastedAvailable: availableHours,
          };
        }
        
        // For other periods, use normal historical/forecasted split
        return {
          period,
          plannedRecipeHours: plannedHours,
          availableMillHours: availableHours,
          // For styling: null out values for the opposite period type
          historicalPlanned: isHistorical ? plannedHours : null,
          historicalAvailable: isHistorical ? availableHours : null,
          forecastedPlanned: !isHistorical ? plannedHours : null,
          forecastedAvailable: !isHistorical ? availableHours : null,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
    
    return {
      data: dataPoints,
      dividerPeriod,
    };
  }, [capacityData, recipeData]);

  if (loading) {
    return (
      <ChartContainer
        title="Production Planning"
        subtitle="Planned vs available capacity (hours)"
        className={className}
      >
        <div className="flex items-center justify-center h-[260px]">
          <p className="text-sm text-muted-foreground">Loading capacity data...</p>
        </div>
      </ChartContainer>
    );
  }

  if (chartData.data.length === 0) {
    return (
      <ChartContainer
        title="Production Planning"
        subtitle="Planned vs available capacity (hours)"
        className={className}
      >
        <div className="flex flex-col items-center justify-center h-[260px] text-center rounded-lg border border-border bg-muted/20">
          <p className="text-sm font-medium text-muted-foreground">No capacity data available</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Try adjusting your filters or date range.</p>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title="Production Planning"
      subtitle="Planned vs available capacity (hours)"
      className={className}
    >
      <div className="space-y-3">
        {/* Mill Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Mill:</label>
          <Select value={selectedMill} onValueChange={setSelectedMill}>
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue placeholder="All Mills" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mills</SelectItem>
              {mills.map((mill) => (
                <SelectItem key={mill.mill_id} value={mill.mill_id}>
                  {mill.mill_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chart */}
        <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData.data}
            margin={{ top: 20, right: 24, left: 16, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(value: string) => {
                // For daily data, format as "Feb 15" style
                if (capacityParams.horizon === "day" && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  try {
                    const date = parseISO(value);
                    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  } catch {
                    return value;
                  }
                }
                // For weekly data, format week labels nicely
                if (value.includes("W")) {
                  // Week format: "2026-W07" -> "W7"
                  const parts = value.split("-W");
                  if (parts.length === 2) {
                    return `W${parseInt(parts[1])}`;
                  }
                }
                // For monthly data, format as "Feb 2026"
                if (value.match(/^\d{4}-\d{2}$/)) {
                  try {
                    const [year, month] = value.split("-");
                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                  } catch {
                    return value;
                  }
                }
                // For other periods, return as is
                return value;
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--card))",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => {
                if (value === null || value === undefined || isNaN(value)) return null;
                const labels: Record<string, string> = {
                  historicalPlanned: "Planned Recipe Hours",
                  forecastedPlanned: "Planned Recipe Hours",
                  historicalAvailable: "Available Mill Hours",
                  forecastedAvailable: "Available Mill Hours",
                };
                return [`${value.toLocaleString()} hrs`, labels[name] || name];
              }}
              labelFormatter={(label) => `Period: ${label}`}
            />
            <Legend
              content={({ payload }) => {
                if (!payload?.length) return null;
                
                // Check if we have data points to determine if we should show historical/forecasted
                const hasHistorical = chartData.data.some(d => d.period && isHistoricalPeriod(d.period));
                const hasForecasted = chartData.data.some(d => d.period && !isHistoricalPeriod(d.period));
                
                if (!hasHistorical && !hasForecasted) return null;
                
                return (
                  <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-5 pb-1">
                    <div className="inline-flex items-center gap-4 rounded-lg border border-border/70 bg-muted/30 px-4 py-2 shadow-sm">
                      {hasHistorical && (
                        <div className="flex items-center gap-2.5">
                          <svg width="26" height="12" viewBox="0 0 26 12" fill="none" className="shrink-0" aria-hidden>
                            <line
                              x1="0"
                              y1="6"
                              x2="26"
                              y2="6"
                              stroke="#8B4513"
                              strokeWidth={2}
                              strokeLinecap="round"
                            />
                            <circle cx="13" cy="6" r="3" fill="white" stroke="#8B4513" strokeWidth={2} />
                          </svg>
                          <span className="text-xs font-semibold text-foreground">
                            Historical
                          </span>
                        </div>
                      )}
                      {hasForecasted && (
                        <div className="flex items-center gap-2.5">
                          <svg width="26" height="12" viewBox="0 0 26 12" fill="none" className="shrink-0" aria-hidden>
                            <line
                              x1="0"
                              y1="6"
                              x2="26"
                              y2="6"
                              stroke="#FCD34D"
                              strokeWidth={2}
                              strokeLinecap="round"
                            />
                            <circle cx="13" cy="6" r="3" fill="white" stroke="#FCD34D" strokeWidth={2} />
                          </svg>
                          <span className="text-xs font-semibold text-foreground">
                            Forecasted
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            
            {/* Visual divider for historical vs forecasted */}
            {chartData.dividerPeriod && (
              <ReferenceLine
                x={chartData.dividerPeriod}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={{ 
                  value: "Forecast →", 
                  position: "top", 
                  fill: "hsl(var(--foreground))",
                  fontSize: 11,
                  fontWeight: 600,
                  offset: 10
                }}
              />
            )}
            
            {/* Planned Recipe Hours - Historical (brown) */}
            <Line
              type="monotone"
              dataKey="historicalPlanned"
              name="Planned Recipe Hours"
              stroke="#8B4513"
              strokeWidth={2}
              dot={{ r: 3, fill: "#8B4513" }}
              activeDot={{ r: 5, stroke: "#8B4513", strokeWidth: 2 }}
              connectNulls={true}
            />
            
            {/* Planned Recipe Hours - Forecasted (yellow) */}
            <Line
              type="monotone"
              dataKey="forecastedPlanned"
              name="Planned Recipe Hours"
              stroke="#FCD34D"
              strokeWidth={2}
              dot={{ r: 3, fill: "#FCD34D" }}
              activeDot={{ r: 5, stroke: "#FCD34D", strokeWidth: 2 }}
              connectNulls={true}
            />
            
            {/* Available Mill Hours - Historical (brown, dashed) */}
            <Line
              type="monotone"
              dataKey="historicalAvailable"
              name="Available Mill Hours"
              stroke="#8B4513"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "#8B4513" }}
              activeDot={{ r: 5, stroke: "#8B4513", strokeWidth: 2 }}
              connectNulls={true}
            />
            
            {/* Available Mill Hours - Forecasted (yellow, dashed) */}
            <Line
              type="monotone"
              dataKey="forecastedAvailable"
              name="Available Mill Hours"
              stroke="#FCD34D"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "#FCD34D" }}
              activeDot={{ r: 5, stroke: "#FCD34D", strokeWidth: 2 }}
              connectNulls={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      </div>
    </ChartContainer>
  );
}
