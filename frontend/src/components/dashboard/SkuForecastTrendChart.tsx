import { useEffect, useState, useMemo } from "react";
import { ChartContainer } from "./ChartContainer";
import { fetchSkuForecast, fetchMillCapacity } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilters, getHorizonForCustomRange } from "@/context/FilterContext";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

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

export function SkuForecastTrendChart({ className }: SkuForecastTrendChartProps) {
  const { queryParams, periodFilter, fromDate, toDate } = useFilters();
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState<string>("all");
  const [selectedFlourType, setSelectedFlourType] = useState<string>("all");
  const [selectedMill, setSelectedMill] = useState<string>("all");
  
  interface MillInfo {
    mill_id: string;
    mill_name: string;
  }
  const [mills, setMills] = useState<MillInfo[]>([]);
  
  // Historical data ends at 2026-02-14 (February 14, 2026)
  // Forecasted data starts from 2026-02-15 (February 15, 2026) onwards
  const historicalEndDate = new Date("2026-02-14");
  
  // Period type: custom range uses project-wide rule (short→daily/week, else monthly or yearly)
  const calculatedPeriodType = useMemo((): PeriodType => {
    if (periodFilter === "custom" && fromDate && toDate) {
      const h = getHorizonForCustomRange(fromDate, toDate);
      if (h === "day") return "week";   // short custom → finest (week is closest for this chart)
      if (h === "month") return "month";
      return "year";
    }
    return globalToLocal(periodFilter);
  }, [periodFilter, fromDate, toDate]);
  
  const [periodType, setPeriodType] = useState<PeriodType>(calculatedPeriodType);

  // Sync local period with global filter when it changes
  useEffect(() => {
    setPeriodType(calculatedPeriodType);
  }, [calculatedPeriodType]);
  
  const getDateRange = (type: PeriodType) => {
    let historicalStart: Date;
    let historicalEnd: Date;
    let forecastStart: Date;
    let forecastEnd: Date;
    let isCustom = false;
    
    // Handle custom date range - use the range directly without splitting
    if (periodFilter === "custom" && fromDate && toDate) {
      isCustom = true;
      const from = parseISO(fromDate);
      const to = parseISO(toDate);
      // For custom ranges, use the same range for both (we'll fetch once)
      historicalStart = from;
      historicalEnd = to;
      forecastStart = from;
      forecastEnd = to;
    } else {
      // Use preset ranges with historical/forecast split
      switch (type) {
        case "week":
          // Last 7 days (2026-02-08 to 2026-02-14) + Next 7 days (2026-02-15 to 2026-02-21)
          historicalStart = new Date(historicalEndDate);
          historicalStart.setDate(historicalStart.getDate() - 6); // Last 7 days including end date
          historicalEnd = new Date(historicalEndDate); // Feb 14, 2026
          forecastStart = new Date(historicalEndDate);
          forecastStart.setDate(forecastStart.getDate() + 1); // Feb 15, 2026
          forecastEnd = new Date(forecastStart);
          forecastEnd.setDate(forecastEnd.getDate() + 6); // Next 7 days
          break;
          
        case "month":
          // Last 30 days (Jan 16 - Feb 14, 2026) + Next 30 days (Feb 15 - Mar 16, 2026)
          historicalStart = new Date(historicalEndDate);
          historicalStart.setDate(historicalStart.getDate() - 29); // Last 30 days including end date
          historicalEnd = new Date(historicalEndDate); // Feb 14, 2026
          forecastStart = new Date(historicalEndDate);
          forecastStart.setDate(forecastStart.getDate() + 1); // Feb 15, 2026
          forecastEnd = new Date(forecastStart);
          forecastEnd.setDate(forecastEnd.getDate() + 29); // Next 30 days
          break;
          
        case "quarter":
          // Last 3 months (Nov 2025 - Feb 14, 2026) + Next 3 months (Feb 15, 2026 - May 2026)
          historicalStart = startOfMonth(subMonths(historicalEndDate, 2)); // Nov 2025 start
          historicalEnd = new Date(historicalEndDate); // Feb 14, 2026
          forecastStart = new Date(historicalEndDate);
          forecastStart.setDate(forecastStart.getDate() + 1); // Feb 15, 2026
          forecastEnd = endOfMonth(addMonths(historicalEndDate, 2)); // Apr 2026 end
          break;
          
        case "year":
          // Last 12 months (Feb 2025 - Feb 14, 2026) + Next 12 months (Feb 15, 2026 - Feb 2027)
          historicalStart = startOfMonth(subMonths(historicalEndDate, 11)); // Feb 2025 start
          historicalEnd = new Date(historicalEndDate); // Feb 14, 2026
          forecastStart = new Date(historicalEndDate);
          forecastStart.setDate(forecastStart.getDate() + 1); // Feb 15, 2026
          forecastEnd = endOfMonth(addMonths(historicalEndDate, 11)); // Jan 2027 end
          break;
          
        default:
          // Fallback to month
          historicalStart = new Date(historicalEndDate);
          historicalStart.setDate(historicalStart.getDate() - 29);
          historicalEnd = new Date(historicalEndDate);
          forecastStart = new Date(historicalEndDate);
          forecastStart.setDate(forecastStart.getDate() + 1);
          forecastEnd = new Date(forecastStart);
          forecastEnd.setDate(forecastEnd.getDate() + 29);
      }
    }
    
    return {
      historicalStart: format(historicalStart, "yyyy-MM-dd"),
      historicalEnd: format(historicalEnd, "yyyy-MM-dd"),
      forecastStart: format(forecastStart, "yyyy-MM-dd"),
      forecastEnd: format(forecastEnd, "yyyy-MM-dd"),
      isCustom,
    };
  };

  // Aggregate daily data by period
  // week & month → daily granularity; quarter & year → monthly granularity
  const aggregateByPeriod = (data: DailyData[], type: PeriodType, isCustom: boolean): Record<string, { historical: number; forecasted: number; total?: number }> => {
    const result: Record<string, { historical: number; forecasted: number; total?: number }> = {};
    
    // For custom ranges, combine all data into a single series
    if (isCustom) {
      data.forEach((item) => {
        const itemDate = new Date(item.date);
        let period: string;
        
        // Determine granularity based on period type
        if (type === "week" || type === "month") {
          period = format(itemDate, "yyyy-MM-dd");
        } else {
          period = format(itemDate, "yyyy-MM");
        }
        
        if (!result[period]) {
          result[period] = { historical: 0, forecasted: 0, total: 0 };
        }
        
        // For custom ranges, combine into total
        result[period].total = (result[period].total || 0) + item.forecast_tons;
      });
    } else {
      // For preset ranges, split into historical and forecasted
      const dividerDate = new Date("2026-02-14");
      
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
        
        // Historical: up to and including Feb 14, 2026
        // Forecasted: from Feb 15, 2026 onwards
        const isAfterDivider = itemDate > dividerDate;
        if (isAfterDivider) {
          result[period].forecasted += item.forecast_tons;
        } else {
          result[period].historical += item.forecast_tons;
        }
      });
    }
    
    return result;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    const loadData = async () => {
      try {
        const dateRange = getDateRange(periodType);
        
        let combinedData: DailyData[];
        
        if (dateRange.isCustom) {
          // For custom ranges, fetch once for the entire range
          const params = {
            ...queryParams,
            from_date: dateRange.historicalStart,
            to_date: dateRange.historicalEnd,
            horizon: "day", // Fetch daily data
            sku_id: selectedSku !== "all" ? selectedSku : undefined,
            mill_id: selectedMill !== "all" ? selectedMill : undefined,
            flour_type: selectedFlourType !== "all" ? selectedFlourType : undefined,
          };
          
          const res = await fetchSkuForecast(params);
          combinedData = (res.data || []).map((item) => ({
            date: item.date as string,
            sku_id: item.sku_id as string,
            sku_name: item.sku_name as string,
            flour_type: item.flour_type as string,
            forecast_tons: Number(item.forecast_tons) || 0,
          }));
        } else {
          // For preset ranges, fetch historical and forecasted separately
          const historicalParams = {
            ...queryParams,
            from_date: dateRange.historicalStart,
            to_date: dateRange.historicalEnd,
            horizon: "day", // Fetch daily data
            sku_id: selectedSku !== "all" ? selectedSku : undefined,
            mill_id: selectedMill !== "all" ? selectedMill : undefined,
            flour_type: selectedFlourType !== "all" ? selectedFlourType : undefined,
          };
          
          const forecastParams = {
            ...queryParams,
            from_date: dateRange.forecastStart,
            to_date: dateRange.forecastEnd,
            horizon: "day", // Fetch daily data
            sku_id: selectedSku !== "all" ? selectedSku : undefined,
            mill_id: selectedMill !== "all" ? selectedMill : undefined,
            flour_type: selectedFlourType !== "all" ? selectedFlourType : undefined,
          };
          
          // Fetch both historical and forecasted data
          const [historicalRes, forecastRes] = await Promise.all([
            fetchSkuForecast(historicalParams),
            fetchSkuForecast(forecastParams),
          ]);
          
          // Combine daily data
          combinedData = [
            ...(historicalRes.data || []),
            ...(forecastRes.data || []),
          ].map((item) => ({
            date: item.date as string,
            sku_id: item.sku_id as string,
            sku_name: item.sku_name as string,
            flour_type: item.flour_type as string,
            forecast_tons: Number(item.forecast_tons) || 0,
          }));
        }
        
        if (cancelled) return;
        
        // Flour type filtering is now done in the backend, so no need to filter here
        setDailyData(combinedData);
        
        if (!cancelled) {
          console.log(`📊 Loaded ${combinedData.length} daily records${dateRange.isCustom ? " (custom range)" : " (historical + forecasted)"}`);
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
  }, [periodType, selectedSku, selectedFlourType, selectedMill, queryParams.scenario, periodFilter, fromDate, toDate]);

  // Get unique SKUs and flour types for filters
  const [allSkus, setAllSkus] = useState<string[]>([]);
  const [allFlourTypes, setAllFlourTypes] = useState<string[]>([]);

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
    const dateRange = getDateRange(periodType);
    const isCustom = dateRange.isCustom;
    const aggregated = aggregateByPeriod(dailyData, periodType, isCustom);
    
    // For custom ranges, use total field
    if (isCustom) {
      // For week and month views, ensure all dates in the range are included
      if (periodType === "week" || periodType === "month") {
        const startDate = parseISO(dateRange.historicalStart);
        const endDate = parseISO(dateRange.historicalEnd);
        
        // Generate all dates in the range
        const allDates = eachDayOfInterval({ start: startDate, end: endDate });
        const allPeriods = new Set(allDates.map(d => format(d, "yyyy-MM-dd")));
        
        // Create a map with all periods, filling in missing ones with null values
        const completeData: Record<string, { total: number | null }> = {};
        
        // Initialize all periods with null values
        allPeriods.forEach(period => {
          completeData[period] = { total: null };
        });
        
        // Fill in actual data
        Object.entries(aggregated).forEach(([period, values]) => {
          if (completeData[period]) {
            completeData[period] = {
              total: values.total && values.total > 0 ? values.total : null,
            };
          }
        });
        
        // Convert to array and sort
        return Object.entries(completeData)
          .map(([period, values]) => ({
            period,
            total: values.total,
          }))
          .sort((a, b) => a.period.localeCompare(b.period));
      }
      
      // For quarter and year views with custom range
      return Object.entries(aggregated)
        .map(([period, values]) => ({
          period,
          total: values.total && values.total > 0 ? values.total : null,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    }
    
    // For preset ranges, use historical/forecast split
    // For week and month views, ensure all dates in the range are included
    if (periodType === "week" || periodType === "month") {
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

  // Find the divider period — last historical point (Feb 14, 2026)
  // Only used for preset ranges, not custom ranges
  const dateRange = getDateRange(periodType);
  const isCustom = dateRange.isCustom;
  
  const getDividerPeriod = (): string | null => {
    if (isCustom) return null; // No divider for custom ranges
    
    const dividerDate = new Date("2026-02-14");
    
    switch (periodType) {
      case "week":
      case "month":
        // Daily granularity → divider is the last historical day (Feb 14, 2026)
        return format(dividerDate, "yyyy-MM-dd");
      case "quarter":
      case "year":
        // Monthly granularity → divider is the last historical month (Feb 2026)
        return format(dividerDate, "yyyy-MM");
      default:
        return null;
    }
  };
  
  const dividerPeriod = getDividerPeriod();

  if (loading) {
    return (
      <ChartContainer title="SKU Forecast Trend" subtitle="Historical and forecasted demand trends" className={className}>
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-sm text-muted-foreground">Loading forecast data...</p>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer 
      title="SKU Forecast Trend" 
      subtitle={isCustom ? "Demand forecast for selected date range" : "Historical and forecasted demand trends"} 
      className={cn("p-2 sm:p-3", className)}
    >
      <div className="space-y-2">
        {/* Filters - Compact */}
        <div className="flex flex-wrap items-center gap-2 p-1 bg-muted/20 rounded-md border border-border">
          <Select 
            value={periodType} 
            onValueChange={(v) => setPeriodType(v as PeriodType)}
            disabled={periodFilter === "custom"}
          >
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
        {chartData.length > 0 ? (
          <div className="w-full h-[400px]">
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
                    if (isCustom) {
                      return [
                        `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} tons`,
                        "Forecast"
                      ];
                    }
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
                {!isCustom && (
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
                )}
                
                {/* Visual divider for historical vs forecasted - only for preset ranges */}
                {!isCustom && dividerPeriod && (
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
                
                {/* For custom ranges: single line showing total */}
                {isCustom ? (
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Forecast"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={(periodType === "week" || periodType === "month") ? { r: 2, fill: "hsl(var(--primary))" } : { r: 3, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 5, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                    connectNulls={true}
                  />
                ) : (
                  <>
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
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center h-[400px]">
            <p className="text-sm font-medium text-foreground">No forecast data available</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting filters or date range</p>
          </div>
        )}
      </div>
    </ChartContainer>
  );
}
