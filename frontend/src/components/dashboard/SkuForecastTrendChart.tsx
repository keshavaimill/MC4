import { useEffect, useState } from "react";
import { ChartContainer } from "./ChartContainer";
import { fetchSkuForecast } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilters } from "@/context/FilterContext";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";

type PeriodType = "week" | "month" | "quarter" | "year";

interface SkuForecastTrendChartProps {
  className?: string;
}

interface DailyData {
  date: string;
  sku_id: string;
  sku_name: string;
  flour_type: string;
  forecast_tons: number;
}

// Map global PeriodFilter → local PeriodType
function globalToLocal(gf: string): PeriodType {
  switch (gf) {
    case "7days":   return "week";
    case "15days":  return "month"; // 15-day range uses month-style display
    case "30days":  return "month";
    case "quarter": return "quarter";
    case "year":    return "year";
    default:        return "month";
  }
}

const MILL_OPTIONS = ["M1", "M2", "M3"];

export function SkuForecastTrendChart({ className }: SkuForecastTrendChartProps) {
  const { queryParams, periodFilter } = useFilters();
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState<string>("all");
  const [selectedFlourType, setSelectedFlourType] = useState<string>("all");
  const [selectedMill, setSelectedMill] = useState<string>("all");
  const [periodType, setPeriodType] = useState<PeriodType>(() => globalToLocal(periodFilter));

  // Sync local period with global filter when it changes
  useEffect(() => {
    setPeriodType(globalToLocal(periodFilter));
  }, [periodFilter]);
  
  // Historical data ends at 2026-02-10
  const historicalEndDate = new Date("2026-02-10");
  
  const getDateRange = (type: PeriodType) => {
    let historicalStart: Date;
    let historicalEnd: Date;
    let forecastStart: Date;
    let forecastEnd: Date;
    
    switch (type) {
      case "week":
        // Last 7 days (2026-02-04 to 2026-02-10) + Next 7 days (2026-02-11 to 2026-02-17)
        historicalStart = new Date(historicalEndDate);
        historicalStart.setDate(historicalStart.getDate() - 6); // Last 7 days including end date
        historicalEnd = new Date(historicalEndDate); // Feb 10, 2026
        forecastStart = new Date(historicalEndDate);
        forecastStart.setDate(forecastStart.getDate() + 1); // Feb 11, 2026
        forecastEnd = new Date(forecastStart);
        forecastEnd.setDate(forecastEnd.getDate() + 6); // Next 7 days
        break;
        
      case "month":
        // Last 30 days (Jan 12 - Feb 10, 2026) + Next 30 days (Feb 11 - Mar 12, 2026)
        historicalStart = new Date(historicalEndDate);
        historicalStart.setDate(historicalStart.getDate() - 29); // Last 30 days including end date
        historicalEnd = new Date(historicalEndDate); // Feb 10, 2026
        forecastStart = new Date(historicalEndDate);
        forecastStart.setDate(forecastStart.getDate() + 1); // Feb 11, 2026
        forecastEnd = new Date(forecastStart);
        forecastEnd.setDate(forecastEnd.getDate() + 29); // Next 30 days
        break;
        
      case "quarter":
        // Last 3 months (Nov 2025 - Jan 2026) + Next 3 months (Feb 2026 - Apr 2026)
        historicalStart = startOfMonth(subMonths(historicalEndDate, 2)); // Nov 2025 start
        historicalEnd = new Date(historicalEndDate); // Feb 10, 2026
        forecastStart = startOfMonth(historicalEndDate); // Feb 2026 start
        forecastEnd = endOfMonth(addMonths(historicalEndDate, 2)); // Apr 2026 end
        break;
        
      case "year":
        // Last 12 months (Feb 2025 - Jan 2026) + Next 12 months (Feb 2026 - Jan 2027)
        historicalStart = startOfMonth(subMonths(historicalEndDate, 11)); // Feb 2025 start
        historicalEnd = new Date(historicalEndDate); // Feb 10, 2026
        forecastStart = startOfMonth(historicalEndDate); // Feb 2026 start
        forecastEnd = endOfMonth(addMonths(historicalEndDate, 11)); // Jan 2027 end
        break;
    }
    
    return {
      historicalStart: format(historicalStart, "yyyy-MM-dd"),
      historicalEnd: format(historicalEnd, "yyyy-MM-dd"),
      forecastStart: format(forecastStart, "yyyy-MM-dd"),
      forecastEnd: format(forecastEnd, "yyyy-MM-dd"),
    };
  };

  // Aggregate daily data by period
  // week & month → daily granularity; quarter & year → monthly granularity
  const aggregateByPeriod = (data: DailyData[], type: PeriodType): Record<string, { historical: number; forecasted: number }> => {
    const result: Record<string, { historical: number; forecasted: number }> = {};
    const dividerDate = new Date("2026-02-10");
    
    data.forEach((item) => {
      const itemDate = new Date(item.date);
      let period: string;
      
      switch (type) {
        case "week":
        case "month":
          // Daily granularity for week and month views
          period = format(itemDate, "yyyy-MM-dd");
          break;
        case "quarter":
        case "year":
          // Monthly granularity for quarter and year views
          period = format(itemDate, "yyyy-MM");
          break;
        default:
          period = format(itemDate, "yyyy-MM-dd");
      }
      
      if (!result[period]) {
        result[period] = { historical: 0, forecasted: 0 };
      }
      
      const isAfterDivider = itemDate > dividerDate;
      if (isAfterDivider) {
        result[period].forecasted += item.forecast_tons;
      } else {
        result[period].historical += item.forecast_tons;
      }
    });
    
    return result;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    const loadData = async () => {
      try {
        const dateRange = getDateRange(periodType);
        
        // Load historical data (daily)
        const historicalParams = {
          ...queryParams,
          from_date: dateRange.historicalStart,
          to_date: dateRange.historicalEnd,
          horizon: "day", // Fetch daily data
          sku_id: selectedSku !== "all" ? selectedSku : undefined,
          mill_id: selectedMill !== "all" ? selectedMill : undefined,
        };
        
        // Load forecasted data (daily)
        const forecastParams = {
          ...queryParams,
          from_date: dateRange.forecastStart,
          to_date: dateRange.forecastEnd,
          horizon: "day", // Fetch daily data
          sku_id: selectedSku !== "all" ? selectedSku : undefined,
          mill_id: selectedMill !== "all" ? selectedMill : undefined,
        };
        
        // Fetch both historical and forecasted data
        const [historicalRes, forecastRes] = await Promise.all([
          fetchSkuForecast(historicalParams),
          fetchSkuForecast(forecastParams),
        ]);
        
        // Combine daily data
        const combinedData: DailyData[] = [
          ...(historicalRes.data || []),
          ...(forecastRes.data || []),
        ].map((item) => ({
          date: item.date as string,
          sku_id: item.sku_id as string,
          sku_name: item.sku_name as string,
          flour_type: item.flour_type as string,
          forecast_tons: Number(item.forecast_tons) || 0,
        }));
        
        if (cancelled) return;
        
        // Filter by flour type if selected
        let filteredData = combinedData;
        if (selectedFlourType !== "all") {
          filteredData = filteredData.filter(
            (item) => item.flour_type === selectedFlourType
          );
        }
        
        setDailyData(filteredData);
        
        if (!cancelled) {
          console.log(`📊 Loaded ${filteredData.length} daily records (historical + forecasted)`);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading SKU forecast:", err);
          setDailyData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    loadData();
    return () => { cancelled = true; };
  }, [periodType, selectedSku, selectedFlourType, selectedMill, queryParams.scenario]);

  // Get unique SKUs and flour types for filters
  const [allSkus, setAllSkus] = useState<string[]>([]);
  const [allFlourTypes, setAllFlourTypes] = useState<string[]>([]);

  // Load unique values on mount
  useEffect(() => {
    const loadUniqueValues = async () => {
      try {
        const params = {
          ...queryParams,
          from_date: "2020-01-01",
          to_date: "2027-12-31",
          horizon: "month",
        };
        const res = await fetchSkuForecast(params);
        const data = res.data || [];
        const skus = Array.from(new Set(data.map((item) => item.sku_id as string))).sort();
        const flourTypes = Array.from(new Set(data.map((item) => item.flour_type as string))).filter(Boolean).sort();
        setAllSkus(skus);
        setAllFlourTypes(flourTypes);
      } catch (err) {
        console.error("Error loading unique values:", err);
      }
    };
    loadUniqueValues();
  }, []);

  const uniqueSkus = allSkus.length > 0 ? allSkus : Array.from(new Set(dailyData.map((item) => item.sku_id))).sort();
  const uniqueFlourTypes = allFlourTypes.length > 0 ? allFlourTypes : Array.from(new Set(dailyData.map((item) => item.flour_type))).filter(Boolean).sort();

  // Transform data for chart - aggregate daily data by period
  const chartData = (() => {
    const aggregated = aggregateByPeriod(dailyData, periodType);
    
    // For week and month views, ensure all dates in the range are included
    if (periodType === "week" || periodType === "month") {
      const dateRange = getDateRange(periodType);
      const startDate = parseISO(dateRange.historicalStart);
      const endDate = parseISO(dateRange.forecastEnd);
      
      // Generate all dates in the range
      const allDates = eachDayOfInterval({ start: startDate, end: endDate });
      const allPeriods = new Set(allDates.map(d => format(d, "yyyy-MM-dd")));
      
      // Create a map with all periods, filling in missing ones with null values
      const completeData: Record<string, { historical: number | null; forecasted: number | null }> = {};
      
      // Initialize all periods with null values
      allPeriods.forEach(period => {
        completeData[period] = { historical: null, forecasted: null };
      });
      
      // Fill in actual data
      Object.entries(aggregated).forEach(([period, values]) => {
        if (completeData[period]) {
          completeData[period] = {
            historical: values.historical > 0 ? values.historical : null,
            forecasted: values.forecasted > 0 ? values.forecasted : null,
          };
        }
      });
      
      // Convert to array and sort
      return Object.entries(completeData)
        .map(([period, values]) => ({
          period,
          historical: values.historical,
          forecasted: values.forecasted,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    }
    
    // For quarter and year views, use existing logic
    return Object.entries(aggregated)
      .map(([period, values]) => ({
        period,
        historical: values.historical > 0 ? values.historical : null,
        forecasted: values.forecasted > 0 ? values.forecasted : null,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  })();

  // Find the divider period — last historical point
  const getDividerPeriod = (): string => {
    const dividerDate = new Date("2026-02-10");
    
    switch (periodType) {
      case "week":
      case "month":
        // Daily granularity → divider is the last historical day
        return format(dividerDate, "yyyy-MM-dd");
      case "quarter":
      case "year":
        // Monthly granularity → divider is the last historical month
        return format(dividerDate, "yyyy-MM");
      default:
        return "";
    }
  };
  
  const dividerPeriod = getDividerPeriod();

  if (loading) {
    return (
      <ChartContainer title="SKU Forecast Trend" subtitle="Historical and forecasted demand trends" className={className}>
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-muted-foreground">Loading forecast data...</p>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer 
      title="SKU Forecast Trend" 
      subtitle="Historical and forecasted demand trends" 
      className={className}
    >
      <div className="space-y-3">
        {/* Filters - Compact */}
        <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/20 rounded-md border border-border">
          <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Next 7 Days</SelectItem>
              <SelectItem value="month">Next 30 Days</SelectItem>
              <SelectItem value="quarter">Next Quarter</SelectItem>
              <SelectItem value="year">Next Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedSku} onValueChange={setSelectedSku}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="All SKUs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SKUs</SelectItem>
              {uniqueSkus.map((sku) => (
                <SelectItem key={sku} value={sku}>
                  {sku}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedFlourType} onValueChange={setSelectedFlourType}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="All Flour" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flour Types</SelectItem>
              {uniqueFlourTypes.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {ft}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMill} onValueChange={setSelectedMill}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder="Mill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mills</SelectItem>
              {MILL_OPTIONS.map((mill) => (
                <SelectItem key={mill} value={mill}>
                  {mill}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="w-full" style={{ height: "360px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartData} 
                margin={{ top: 5, right: 20, left: 10, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  interval={0}
                  tickFormatter={(value: string) => {
                    // For daily views (week/month) format as "Feb 10" style
                    if (periodType === "week" || periodType === "month") {
                      const d = new Date(value + "T00:00:00");
                      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }
                    // For monthly views (quarter/year) format as "Feb 2026"
                    const parts = value.split("-");
                    if (parts.length === 2) {
                      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
                      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                    }
                    return value;
                  }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={{ stroke: "hsl(var(--border))" }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 6,
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    boxShadow: "0 2px 8px -2px rgb(0 0 0 / 0.1)",
                    padding: "8px 12px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (value === null || value === undefined || isNaN(value) || value === 0) return null;
                    const labels: Record<string, string> = {
                      historical: "Historical",
                      forecasted: "Forecasted",
                    };
                    return [
                      `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} tons`,
                      labels[name] || name
                    ];
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4, fontSize: 11 }}
                  labelFormatter={(label: string) => {
                    if (periodType === "week" || periodType === "month") {
                      const d = new Date(label + "T00:00:00");
                      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
                    }
                    const parts = label.split("-");
                    if (parts.length === 2) {
                      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
                      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    }
                    return label;
                  }}
                />
                <Legend
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const labels: Record<string, string> = {
                      historical: "Historical",
                      forecasted: "Forecasted",
                    };
                    return (
                      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-5 pb-1">
                        <div className="inline-flex items-center gap-4 rounded-lg border border-border/70 bg-muted/30 px-4 py-2 shadow-sm">
                          {payload.map((entry) => (
                            <div
                              key={entry.value}
                              className="flex items-center gap-2.5"
                            >
                              <svg width="26" height="12" viewBox="0 0 26 12" fill="none" className="shrink-0" aria-hidden>
                                <line
                                  x1="0"
                                  y1="6"
                                  x2="26"
                                  y2="6"
                                  stroke={entry.color}
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeDasharray={entry.value === "forecasted" ? "5 4" : undefined}
                                />
                                <circle cx="13" cy="6" r="3" fill="white" stroke={entry.color} strokeWidth={2} />
                              </svg>
                              <span className="text-xs font-semibold text-foreground">
                                {labels[entry.value as string] || entry.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                
                {/* Visual divider for historical vs forecasted */}
                {dividerPeriod && (
                  <ReferenceLine
                    x={dividerPeriod}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={{ 
                      value: "Forecast →", 
                      position: "top", 
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 9,
                      fontWeight: 500,
                      offset: 5
                    }}
                  />
                )}
                
                {/* Historical line - solid, continuous up to divider */}
                <Line
                  type="monotone"
                  dataKey="historical"
                  name="Historical"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={(periodType === "week" || periodType === "month") ? { r: 2, fill: "hsl(var(--primary))" } : { r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                  connectNulls={true}
                />
                
                {/* Forecasted line - dashed, continuous from divider onwards */}
                <Line
                  type="monotone"
                  dataKey="forecasted"
                  name="Forecasted"
                  stroke="hsl(45, 93%, 47%)"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={(periodType === "week" || periodType === "month") ? { r: 2, fill: "hsl(45, 93%, 47%)" } : { r: 3, fill: "hsl(45, 93%, 47%)" }}
                  activeDot={{ r: 5, stroke: "hsl(45, 93%, 47%)", strokeWidth: 2 }}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center" style={{ height: "360px" }}>
            <p className="text-sm font-medium text-foreground">No forecast data available</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting filters or date range</p>
          </div>
        )}
      </div>
    </ChartContainer>
  );
}
