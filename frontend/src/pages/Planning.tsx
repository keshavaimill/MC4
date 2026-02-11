import { useState, useMemo, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchRecipePlanningKpis, fetchRecipeEligibility, fetchRecipePlanning, type RecipePlanningKpis } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle, RotateCcw, Loader2 } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EligibilityRow {
  recipe_id: string;
  recipe_name: string;
  flour_type_id: string;
  flour_type: string;
  base_tons_per_hour: number;
  is_eligible?: boolean;
}

interface RecipeRow {
  recipe_id: string;
  recipe_name: string;
  period: string;
  scheduled_hours: number;
  tons_produced: number;
  cost_index: number;
  avg_waste_pct: number;
  cost_per_hour: number;
}

export default function Planning() {
  const { queryParams, kpiQueryParams } = useFilters();

  const [kpis, setKpis] = useState<RecipePlanningKpis | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityRow[]>([]);
  const [recipeData, setRecipeData] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Slider allocations (local state for what-if)
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchRecipePlanningKpis(kpiQueryParams),   // KPIs use future-only dates
      fetchRecipeEligibility(),
      fetchRecipePlanning(queryParams),            // Data uses full range
    ])
      .then(([kpiData, eligData, recData]) => {
        if (cancelled) return;
        setKpis(kpiData);
        setEligibility(eligData.data as unknown as EligibilityRow[]);
        const recipes = recData.data as unknown as RecipeRow[];
        setRecipeData(recipes);

        // Initialize slider allocations from actual recipe hours
        const alloc: Record<string, number> = {};
        for (const r of recipes) {
          alloc[r.recipe_id] = (alloc[r.recipe_id] || 0) + (r.scheduled_hours || 0);
        }
        setAllocations(alloc);
      })
      .catch((err) => {
        if (!cancelled) console.error("Planning data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon, kpiQueryParams.from_date, kpiQueryParams.to_date]);

  const handleSlider = useCallback((id: string, val: number[]) => {
    setIsCalculating(true);
    setAllocations((prev) => ({ ...prev, [id]: val[0] }));
    setTimeout(() => setIsCalculating(false), 300);
  }, []);

  // Calculate total hours from slider allocations (user-adjusted values)
  const totalHours = useMemo(() => Object.values(allocations).reduce((a, b) => a + b, 0), [allocations]);
  // Use backend values for capacity and initial planned hours
  const totalCapacity = kpis?.available_mill_hours || 0;
  const backendPlannedHours = kpis?.planned_recipe_hours || 0;
  // Check if user has adjusted sliders (if totalHours differs from backend, user has made changes)
  const hasUserAdjustments = Math.abs(totalHours - backendPlannedHours) > 0.1;
  // Calculate slack/shortfall: use slider values if adjusted, otherwise use backend value
  const slackShortfall = hasUserAdjustments 
    ? totalCapacity - totalHours 
    : (kpis?.slack_shortfall_hours ?? (totalCapacity - totalHours));
  const overload = Math.max(0, totalHours - totalCapacity);

  // Recipe info for display — uses real cost_per_hour from backend
  const recipeInfo = useMemo(() => {
    const map: Record<string, { name: string; costPerHour: number; wastePct: number; baseHours: number }> = {};
    for (const r of recipeData) {
      if (!map[r.recipe_id]) {
        map[r.recipe_id] = {
          name: r.recipe_name || r.recipe_id,
          costPerHour: r.cost_per_hour || 0,
          wastePct: r.avg_waste_pct || 0,
          baseHours: 0,
        };
      }
      map[r.recipe_id].baseHours += r.scheduled_hours || 0;
    }
    return map;
  }, [recipeData]);

  // Cost delta: compare current slider allocation cost vs original baseline cost
  const costDelta = useMemo(() => {
    const baseTotal = Object.entries(recipeInfo).reduce((s, [, r]) => s + r.baseHours * r.costPerHour, 0);
    const currTotal = Object.entries(allocations).reduce((s, [id, hrs]) => s + hrs * (recipeInfo[id]?.costPerHour || 0), 0);
    return baseTotal > 0 ? (((currTotal - baseTotal) / baseTotal) * 100).toFixed(1) : "0";
  }, [allocations, recipeInfo]);

  // Waste delta: change in weighted-average waste %
  const wasteDelta = useMemo(() => {
    const baseWaste = Object.entries(recipeInfo).reduce((s, [, r]) => s + r.baseHours * r.wastePct, 0);
    const baseTotalHrs = Object.values(recipeInfo).reduce((s, r) => s + r.baseHours, 0);
    const baseAvg = baseTotalHrs > 0 ? baseWaste / baseTotalHrs : 0;
    const currWaste = Object.entries(allocations).reduce((s, [id, hrs]) => s + hrs * (recipeInfo[id]?.wastePct || 0), 0);
    const currAvg = totalHours > 0 ? currWaste / totalHours : 0;
    return (currAvg - baseAvg).toFixed(2);
  }, [allocations, recipeInfo, totalHours]);

  // Risk score: start from backend baseline, adjust for slider deviations
  const baselineRisk = kpis?.risk_score ?? 0;
  const riskScore = useMemo(() => {
    // Backend gives the baseline risk; slider changes add incremental risk
    const sliderRiskDelta =
      (overload / Math.max(1, totalCapacity)) * 80 +       // overload pressure
      Math.abs(Number(costDelta)) * 1.5 +                   // cost deviation
      Math.abs(Number(wasteDelta)) * 8;                      // waste deviation
    // When sliders match the original, riskScore = backend baseline
    const hasSliderChange = Object.entries(allocations).some(
      ([id, hrs]) => Math.abs(hrs - (recipeInfo[id]?.baseHours || 0)) > 1
    );
    return Math.min(100, Math.round(hasSliderChange ? baselineRisk + sliderRiskDelta : baselineRisk));
  }, [baselineRisk, overload, totalCapacity, costDelta, wasteDelta, allocations, recipeInfo]);

  // Build eligibility matrix
  const eligibilityMatrix = useMemo(() => {
    const flourTypes = [...new Set(eligibility.map((e) => e.flour_type))].filter(Boolean);
    const recipes = [...new Set(eligibility.map((e) => e.recipe_name))].filter(Boolean);
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const ft of flourTypes) {
      matrix[ft] = {};
      for (const r of recipes) {
        matrix[ft][r] = eligibility.some((e) => e.flour_type === ft && e.recipe_name === r);
      }
    }
    return { flourTypes, recipes, matrix };
  }, [eligibility]);

  // Effective cost impact: backend baseline + slider adjustment
  const baselineCostImpact = kpis?.cost_impact_pct ?? 0;
  const effectiveCostImpact = useMemo(() => {
    return Number(costDelta) !== 0 ? baselineCostImpact + Number(costDelta) : baselineCostImpact;
  }, [baselineCostImpact, costDelta]);

  const planningKpis = kpis
    ? [
        { label: "Planned Recipe Hours", value: Math.round(totalHours).toLocaleString(), unit: "hrs", driver: `vs capacity of ${totalCapacity.toLocaleString()} hrs` },
        { label: "Available Mill Hours", value: Math.round(totalCapacity).toLocaleString(), unit: "hrs", driver: "Period capacity" },
        { label: "Slack / Shortfall", value: Math.round(slackShortfall).toLocaleString(), unit: "hrs", driver: slackShortfall < 0 ? "Shortfall (overload)" : "Slack within capacity" },
        { label: "Wheat Cost Index", value: kpis.wheat_cost_index.toFixed(0), unit: "SAR", driver: "Weighted avg cost" },
        { label: "Waste Impact", value: kpis.waste_impact_pct.toFixed(1), unit: "%", delta: -kpis.waste_impact_pct, driver: "Period waste rate" },
        { label: "Cost Impact", value: `${effectiveCostImpact > 0 ? "+" : ""}${effectiveCostImpact.toFixed(1)}`, unit: "%", delta: effectiveCostImpact, driver: `Baseline ${(kpis.cost_impact_pct ?? 0).toFixed(1)}% + slider adj` },
      ]
    : [];

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading planning data…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Production Planning</h1>
        <p className="text-sm text-gray-600 mt-1">Adjust recipe time allocation and see real-time impact</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {planningKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr_320px]">
        {/* Eligibility Matrix */}
        <ChartContainer title="Recipe Eligibility" subtitle="Which recipes work for which flour types">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-bold text-gray-700">Flour</th>
                  {eligibilityMatrix.recipes.map((r) => (
                    <th key={r} className="px-2 py-2 text-center text-xs font-bold text-gray-700">{r.split(" ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eligibilityMatrix.flourTypes.map((ft, i) => (
                  <tr key={ft} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-2 py-2 text-xs font-medium text-gray-900">{ft}</td>
                    {eligibilityMatrix.recipes.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        {eligibilityMatrix.matrix[ft]?.[r] ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex items-center justify-center">
                                <Check className="h-4 w-4 text-emerald-600" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center">
                              <p className="text-xs">{ft} is eligible for {r}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="inline-flex items-center justify-center">
                            <X className="h-4 w-4 text-gray-300" />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>

        {/* Sliders */}
        <ChartContainer title="Recipe Time Allocation" subtitle="Adjust hours per recipe to see real-time impact">
          <div className="space-y-6 py-2">
            {Object.entries(allocations).map(([id, hrs]) => {
              const info = recipeInfo[id];
              const base = info?.baseHours || 0;
              // Fixed max/min/step derived from the original baseline — never changes
              const sliderMax = Math.max(1000, Math.round(base * 1.5));
              const sliderMin = 0;
              const sliderStep = base > 10000 ? 100 : base > 1000 ? 50 : 10;
              const pctChange = base > 0 ? ((hrs - base) / base) * 100 : 0;
              const hasChanged = Math.abs(hrs - base) > sliderStep;

              return (
                <div key={id} className="rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{info?.name || id}</span>
                    <div className="flex items-center gap-2">
                      {hasChanged && (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          pctChange > 0 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%
                        </span>
                      )}
                      <span className={cn(
                        "font-mono text-sm font-bold tabular-nums transition-colors",
                        hasChanged ? "text-primary" : "text-foreground"
                      )}>
                        {Math.round(hrs).toLocaleString()} hrs
                      </span>
                      {hasChanged && (
                        <button
                          type="button"
                          onClick={() => setAllocations((prev) => ({ ...prev, [id]: base }))}
                          className="ml-1 rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                          title="Reset to baseline"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mb-1 text-[10px] text-gray-600">
                    Baseline: {Math.round(base).toLocaleString()} hrs
                    {info?.costPerHour ? ` · Cost: SAR ${(info.costPerHour / 1000).toFixed(1)}k/hr` : ""}
                    {info?.wastePct ? ` · Waste: ${info.wastePct.toFixed(1)}%` : ""}
                  </div>
                  <Slider
                    value={[hrs]}
                    onValueChange={(val) => handleSlider(id, val)}
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    className={cn(
                      "[&_[role=slider]]:border-primary [&_[role=slider]]:bg-white [&_[role=slider]]:shadow-md [&_[role=slider]]:h-5 [&_[role=slider]]:w-5",
                      "[&_.relative]:bg-muted [&_[data-orientation=horizontal]>.absolute]:bg-primary",
                      hasChanged && "[&_[data-orientation=horizontal]>.absolute]:bg-amber-500"
                    )}
                  />
                  <div className="mt-1 flex justify-between text-[9px] text-gray-500">
                    <span>{sliderMin.toLocaleString()}</span>
                    <span>{sliderMax.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
            {Object.keys(allocations).length > 0 && Object.entries(allocations).some(([id, hrs]) => Math.abs(hrs - (recipeInfo[id]?.baseHours || 0)) > 1) && (
              <button
                type="button"
                onClick={() => {
                  const reset: Record<string, number> = {};
                  for (const [id] of Object.entries(allocations)) {
                    reset[id] = recipeInfo[id]?.baseHours || 0;
                  }
                  setAllocations(reset);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset all to baseline
              </button>
            )}
          </div>
        </ChartContainer>

        {/* Impact Panel */}
        <div className="sticky top-20 space-y-3 self-start">
          <div className="rounded-xl border-2 border-gray-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Live Impact</h3>
              {isCalculating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
            <div className="space-y-4">
              <ImpactMetric label="Mill Overload" value={`${Math.round(overload)} hrs`} status={overload > 0 ? "danger" : "ok"} />
              <ImpactMetric label="Cost Delta" value={`${Number(costDelta) > 0 ? "+" : ""}${costDelta}%`} status={Math.abs(Number(costDelta)) > 5 ? "warning" : "ok"} />
              <ImpactMetric label="Waste Delta" value={`${Number(wasteDelta) > 0 ? "+" : ""}${wasteDelta}%`} status={Math.abs(Number(wasteDelta)) > 0.3 ? "warning" : "ok"} />
              <ImpactMetric label="Risk Score" value={`${riskScore}/100`} status={riskScore > 60 ? "danger" : riskScore > 30 ? "warning" : "ok"} />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ImpactMetric({ label, value, status }: { label: string; value: string; status: "ok" | "warning" | "danger" }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {status === "danger" && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
        {status === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      <span
        className={cn(
          "font-mono text-sm font-bold",
          status === "danger" ? "text-red-600" : status === "warning" ? "text-amber-600" : "text-emerald-600"
        )}
      >
        {value}
      </span>
    </div>
  );
}
