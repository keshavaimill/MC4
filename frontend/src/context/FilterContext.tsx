import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isValid } from "date-fns";
import { DateRange } from "react-day-picker";

export type Horizon = "week" | "month" | "year";
export type PeriodFilter = "7days" | "30days" | "quarter" | "year" | "custom";
export type Scenario =
  | "base"
  | "ramadan"
  | "hajj"
  | "eid_fitr"
  | "eid_adha"
  | "summer"
  | "winter";

interface FilterContextValue {
  periodFilter: PeriodFilter;
  setPeriodFilter: (p: PeriodFilter) => void;
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  fromDate: string; // ISO date string (YYYY-MM-DD) - computed from periodFilter (full range: historical + future)
  toDate: string; // ISO date string (YYYY-MM-DD) - computed from periodFilter (full range: historical + future)
  customDateRange: DateRange | undefined;
  setCustomDateRange: (range: DateRange | undefined) => void;
  selectedMills: string[]; // Array of mill IDs
  setSelectedMills: (mills: string[]) => void;
  /** Convenience: full-range query params for trend charts and data tables (historical + future) */
  queryParams: Record<string, string>;
  /** KPI-only query params: future-only date range for KPI tiles */
  kpiQueryParams: Record<string, string>;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

// Historical data ends at 2026-02-10
const HISTORICAL_END_DATE = new Date("2026-02-10");

/**
 * Full date range for trend charts and data tables (historical + future).
 * Shows past + future data around the HISTORICAL_END_DATE boundary.
 */
function calculateDateRange(period: PeriodFilter, customRange?: DateRange): { fromDate: string; toDate: string } {
  let fromDate: Date;
  let toDate: Date;

  if (period === "custom" && customRange?.from && customRange?.to) {
    return {
      fromDate: format(customRange.from, "yyyy-MM-dd"),
      toDate: format(customRange.to, "yyyy-MM-dd"),
    };
  }

  switch (period) {
    case "7days":
      // Last 7 days + Next 7 days from 2026-02-10
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 6); // Last 7 days including end date
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 7); // Next 7 days
      break;
    case "30days":
      // Last 30 days + Next 30 days from 2026-02-10
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 29); // Last 30 days including end date
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 30); // Next 30 days
      break;
    case "quarter":
      // Last 3 months + Next 3 months from February 2026
      fromDate = startOfMonth(subMonths(HISTORICAL_END_DATE, 2)); // Nov 2025 start
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 2)); // Apr 2026 end
      break;
    case "year":
      // Last 12 months + Next 12 months from February 2026
      fromDate = startOfMonth(subMonths(HISTORICAL_END_DATE, 11)); // Feb 2025 start
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 11)); // Jan 2027 end
      break;
    default:
      // Fallback if custom is selected but no range provided, default to 30days logic
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 29);
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 30);
  }

  return {
    fromDate: format(fromDate, "yyyy-MM-dd"),
    toDate: format(toDate, "yyyy-MM-dd"),
  };
}

/**
 * Future-only date range for KPI tiles.
 * KPIs should reflect only the upcoming/future period, not historical data.
 */
function calculateKpiDateRange(period: PeriodFilter, customRange?: DateRange): { fromDate: string; toDate: string } {
  // KPI range always starts from the day after historical data ends
  const kpiStart = new Date(HISTORICAL_END_DATE);
  kpiStart.setDate(kpiStart.getDate() + 1); // Feb 11, 2026

  if (period === "custom" && customRange?.from && customRange?.to) {
    // For custom, if the custom range starts after historical end, use it.
    // If it starts before, clamp it to kpiStart? 
    // Usually custom range implies user wants specific data.
    // However, KPIs are defined as future-only in this app context.
    // Let's assume for custom range, we just respect the user's selection for "future" context 
    // but maybe clamp the start if it's purely historical?
    // User instruction says "KPIs use future-only dates".
    // If user selects purely historical range, KPIs might be empty.
    // Let's just pass the custom range as is, but maybe ensure fromDate >= kpiStart?
    // Or just let it be. Let's respect the custom range fully for KPIs if "custom" is selected.
    // Actually, to be safe and consistent with "future-only" KPI logic:
    // If custom range includes future dates, use the future part.
    // If it's all historical, return full custom range (user knows what they validly selected).
    return {
      fromDate: format(customRange.from > kpiStart ? customRange.from : kpiStart, "yyyy-MM-dd"),
      toDate: format(customRange.to, "yyyy-MM-dd"),
    };
  }

  let toDate: Date;

  switch (period) {
    case "7days":
      // Next 7 days from Feb 10, 2026 → Feb 11 to Feb 17
      toDate = new Date(kpiStart);
      toDate.setDate(toDate.getDate() + 6);
      break;
    case "30days":
      // Next 30 days from Feb 10, 2026 → Feb 11 to Mar 12
      toDate = new Date(kpiStart);
      toDate.setDate(toDate.getDate() + 29);
      break;
    case "quarter":
      // Next 3 months from February 2026 → Feb 2026 to Apr 2026
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 2)); // Apr 2026 end
      break;
    case "year":
      // Next 12 months from February 2026 → Feb 2026 to Jan 2027
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 11)); // Jan 2027 end
      break;
    default:
      toDate = new Date(kpiStart);
      toDate.setDate(toDate.getDate() + 29);
  }

  return {
    fromDate: format(kpiStart, "yyyy-MM-dd"),
    toDate: format(toDate, "yyyy-MM-dd"),
  };
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30days");
  const [horizon, setHorizon] = useState<Horizon>("month");
  const [scenario, setScenario] = useState<Scenario>("base");
  const [selectedMills, setSelectedMills] = useState<string[]>(["M1", "M2", "M3"]); // All mills selected by default
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  // Calculate full date range for trend charts & data (historical + future)
  const { fromDate, toDate } = useMemo(() => calculateDateRange(periodFilter, customDateRange), [periodFilter, customDateRange]);
  // Calculate future-only date range for KPI tiles
  const { fromDate: kpiFromDate, toDate: kpiToDate } = useMemo(() => calculateKpiDateRange(periodFilter, customDateRange), [periodFilter, customDateRange]);

  const queryParams: Record<string, string> = {
    from_date: fromDate,
    to_date: toDate,
    horizon,
    scenario,
  };

  // Only add mill_id if not all mills are selected
  if (selectedMills.length < 3) {
    queryParams.mill_id = selectedMills.join(",");
  }

  // KPI-only params: future-only date range for KPI tile values
  const kpiQueryParams: Record<string, string> = {
    from_date: kpiFromDate,
    to_date: kpiToDate,
    horizon,
    scenario,
  };

  if (selectedMills.length < 3) {
    kpiQueryParams.mill_id = selectedMills.join(",");
  }

  return (
    <FilterContext.Provider
      value={{
        periodFilter,
        setPeriodFilter,
        horizon,
        setHorizon,
        scenario,
        setScenario,
        fromDate,
        toDate,
        customDateRange,
        setCustomDateRange,
        selectedMills,
        setSelectedMills,
        queryParams,
        kpiQueryParams,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within a FilterProvider");
  return ctx;
}
