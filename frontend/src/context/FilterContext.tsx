import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Horizon = "week" | "month" | "year";
export type Scenario =
  | "base"
  | "ramadan"
  | "hajj"
  | "eid_fitr"
  | "eid_adha"
  | "summer"
  | "winter";

interface FilterContextValue {
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  fromDate: string; // ISO date string (YYYY-MM-DD)
  toDate: string;
  setFromDate: (d: string) => void;
  setToDate: (d: string) => void;
  /** Convenience: query string params for API calls */
  queryParams: Record<string, string>;
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [horizon, setHorizon] = useState<Horizon>("month");
  const [scenario, setScenario] = useState<Scenario>("base");
  const [fromDate, setFromDate] = useState("2020-01-01");
  const [toDate, setToDate] = useState("2020-12-31");

  // Load available date range from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/meta/date-range");
        if (!res.ok) return;
        const json = await res.json();
        if (json?.min_date) setFromDate(json.min_date);
        if (json?.max_date) setToDate(json.max_date);
      } catch {
        // backend not reachable — keep defaults
      }
    })();
  }, []);

  const queryParams: Record<string, string> = {
    from_date: fromDate,
    to_date: toDate,
    horizon,
    scenario,
  };

  return (
    <FilterContext.Provider
      value={{
        horizon,
        setHorizon,
        scenario,
        setScenario,
        fromDate,
        toDate,
        setFromDate,
        setToDate,
        queryParams,
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
