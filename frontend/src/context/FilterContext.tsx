import { createContext, useContext, useState, useMemo } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
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

const HISTORICAL_END_DATE = new Date("2026-02-10");

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
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 6);
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 7);
      break;
    case "15days":
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 14);
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 15);
      break;
    case "30days":
      fromDate = new Date(HISTORICAL_END_DATE);
      fromDate.setDate(fromDate.getDate() - 29);
      toDate = new Date(HISTORICAL_END_DATE);
      toDate.setDate(toDate.getDate() + 30);
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
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("30days");
  const [horizon, setHorizon] = useState<Horizon>("month");
  const [scenario, setScenario] = useState<Scenario>("base");
  const [selectedMills, setSelectedMills] = useState<string[]>(["M1", "M2", "M3"]);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

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
