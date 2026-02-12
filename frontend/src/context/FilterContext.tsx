import { createContext, useContext, useState, useMemo, useEffect } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";

export type Horizon = "week" | "month" | "year";
export type PeriodFilter = "7days" | "15days" | "30days" | "quarter" | "year" | "custom";
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
  fromDate: string;
  toDate: string;
  customDateRange: DateRange | undefined;
  setCustomDateRange: (range: DateRange | undefined) => void;
  selectedMills: string[];
  setSelectedMills: (mills: string[]) => void;
  queryParams: Record<string, string>;
  kpiQueryParams: Record<string, string>;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

const HISTORICAL_END_DATE = new Date("2026-02-14");

// LocalStorage keys
const STORAGE_KEY_PERIOD_FILTER = "mc4_period_filter";
const STORAGE_KEY_CUSTOM_DATE_RANGE = "mc4_custom_date_range";

// Helper functions for localStorage persistence
function loadPeriodFilter(): PeriodFilter {
  if (typeof window === "undefined") return "30days";
  const stored = localStorage.getItem(STORAGE_KEY_PERIOD_FILTER);
  if (stored && ["7days", "15days", "30days", "quarter", "year", "custom"].includes(stored)) {
    return stored as PeriodFilter;
  }
  return "30days";
}

function loadCustomDateRange(): DateRange | undefined {
  if (typeof window === "undefined") return undefined;
  const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_DATE_RANGE);
  if (!stored) return undefined;
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.from && parsed?.to) {
      return {
        from: parseISO(parsed.from),
        to: parseISO(parsed.to),
      };
    }
  } catch {
    // Invalid JSON, return undefined
  }
  return undefined;
}

function saveCustomDateRange(range: DateRange | undefined) {
  if (typeof window === "undefined") return;
  if (range?.from && range?.to) {
    localStorage.setItem(
      STORAGE_KEY_CUSTOM_DATE_RANGE,
      JSON.stringify({
        from: format(range.from, "yyyy-MM-dd"),
        to: format(range.to, "yyyy-MM-dd"),
      })
    );
  } else {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_DATE_RANGE);
  }
}

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
      // 7 days historical (including end date) + 7 days forecasted
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 6); // 7 days total: Feb 8-14
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 7); // 7 days forecast: Feb 15-21
      break;
    case "15days":
      // 15 days historical (including end date) + 15 days forecasted
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 14); // 15 days total: Jan 31 - Feb 14
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 15); // 15 days forecast: Feb 15 - Mar 1
      break;
    case "30days":
      // 30 days historical (including end date) + 30 days forecasted
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 29); // 30 days total: Jan 16 - Feb 14
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 30); // 30 days forecast: Feb 15 - Mar 16
      break;
    case "quarter":
      fromDate = startOfMonth(subMonths(HISTORICAL_END_DATE, 2));
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 2));
      break;
    case "year":
      fromDate = startOfMonth(subMonths(HISTORICAL_END_DATE, 11));
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 11));
      break;
    default:
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

function calculateKpiDateRange(period: PeriodFilter, customRange?: DateRange): { fromDate: string; toDate: string } {
  const kpiStart = new Date(HISTORICAL_END_DATE);
  kpiStart.setDate(kpiStart.getDate() + 1);

  if (period === "custom" && customRange?.from && customRange?.to) {
    return {
      fromDate: format(customRange.from > kpiStart ? customRange.from : kpiStart, "yyyy-MM-dd"),
      toDate: format(customRange.to, "yyyy-MM-dd"),
    };
  }

  let toDate: Date;

  switch (period) {
    case "7days":
      toDate = new Date(kpiStart);
      toDate.setDate(toDate.getDate() + 6);
      break;
    case "15days":
      toDate = new Date(kpiStart);
      toDate.setDate(toDate.getDate() + 14);
      break;
    case "30days":
      toDate = new Date(kpiStart);
      toDate.setDate(toDate.getDate() + 29);
      break;
    case "quarter":
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 2));
      break;
    case "year":
      toDate = endOfMonth(addMonths(HISTORICAL_END_DATE, 11));
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
  // Load initial state from localStorage
  const [periodFilter, setPeriodFilterState] = useState<PeriodFilter>(loadPeriodFilter);
  const [horizon, setHorizon] = useState<Horizon>("month");
  const [scenario, setScenario] = useState<Scenario>("base");
  const [selectedMills, setSelectedMills] = useState<string[]>(["M1", "M2", "M3"]);
  const [customDateRange, setCustomDateRangeState] = useState<DateRange | undefined>(loadCustomDateRange);

  // Wrapper for setPeriodFilter that also persists to localStorage
  const setPeriodFilter = (filter: PeriodFilter) => {
    setPeriodFilterState(filter);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_PERIOD_FILTER, filter);
    }
  };

  // Wrapper for setCustomDateRange that also persists to localStorage
  const setCustomDateRange = (range: DateRange | undefined) => {
    setCustomDateRangeState(range);
    saveCustomDateRange(range);
  };

  // Sync state from localStorage on mount (in case of multiple tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_PERIOD_FILTER && e.newValue) {
        const newFilter = e.newValue as PeriodFilter;
        if (["7days", "15days", "30days", "quarter", "year", "custom"].includes(newFilter)) {
          setPeriodFilterState(newFilter);
        }
      }
      if (e.key === STORAGE_KEY_CUSTOM_DATE_RANGE) {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed?.from && parsed?.to) {
              setCustomDateRangeState({
                from: parseISO(parsed.from),
                to: parseISO(parsed.to),
              });
            } else {
              setCustomDateRangeState(undefined);
            }
          } catch {
            setCustomDateRangeState(undefined);
          }
        } else {
          setCustomDateRangeState(undefined);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const { fromDate, toDate } = useMemo(() => calculateDateRange(periodFilter, customDateRange), [periodFilter, customDateRange]);
  const { fromDate: kpiFromDate, toDate: kpiToDate } = useMemo(() => calculateKpiDateRange(periodFilter, customDateRange), [periodFilter, customDateRange]);

  const queryParams: Record<string, string> = {
    from_date: fromDate,
    to_date: toDate,
    horizon,
    scenario,
  };

  if (selectedMills.length < 3) {
    queryParams.mill_id = selectedMills.join(",");
  }

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
