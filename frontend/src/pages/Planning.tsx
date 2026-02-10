import { useState, useMemo, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchRecipePlanningKpis, fetchRecipeEligibility, fetchRecipePlanning, type RecipePlanningKpis } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle, Loader2 } from "lucide-react";
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
}

export default function Planning() {
  const { queryParams } = useFilters();

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
      fetchRecipePlanningKpis(queryParams),
      fetchRecipeEligibility(),
      fetchRecipePlanning(queryParams),
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
  }, [queryParams.from_date, queryParams.to_date, queryParams.scenario, queryParams.horizon]);

  const handleSlider = useCallback((id: string, val: number[]) => {
    setIsCalculating(true);
    setAllocations((prev) => ({ ...prev, [id]: val[0] }));
    setTimeout(() => setIsCalculating(false), 300);
  }, []);

  const totalHours = useMemo(() => Object.values(allocations).reduce((a, b) => a + b, 0), [allocations]);
  const totalCapacity = kpis?.available_mill_hours || 0;
  const overload = Math.max(0, totalHours - totalCapacity);

  // Recipe info for display
  const recipeInfo = useMemo(() => {
    const map: Record<string, { name: string; costIndex: number; wastePct: number; baseHours: number }> = {};
    for (const r of recipeData) {
      if (!map[r.recipe_id]) {
        map[r.recipe_id] = {
          name: r.recipe_name || r.recipe_id,
          costIndex: r.cost_index || 0,
          wastePct: r.avg_waste_pct || 0,
          baseHours: 0,
        };
      }
      map[r.recipe_id].baseHours += r.scheduled_hours || 0;
    }
    return map;
  }, [recipeData]);

  const costDelta = useMemo(() => {
    const baseTotal = Object.entries(recipeInfo).reduce((s, [id, r]) => s + r.baseHours * r.costIndex, 0);
    const currTotal = Object.entries(allocations).reduce((s, [id, hrs]) => s + hrs * (recipeInfo[id]?.costIndex || 0), 0);
    return baseTotal > 0 ? (((currTotal - baseTotal) / baseTotal) * 100).toFixed(1) : "0";
  }, [allocations, recipeInfo]);

  const wasteDelta = useMemo(() => {
    const baseWaste = Object.entries(recipeInfo).reduce((s, [, r]) => s + r.baseHours * r.wastePct, 0);
    const baseTotalHrs = Object.values(recipeInfo).reduce((s, r) => s + r.baseHours, 0);
    const baseAvg = baseTotalHrs > 0 ? baseWaste / baseTotalHrs : 0;
    const currWaste = Object.entries(allocations).reduce((s, [id, hrs]) => s + hrs * (recipeInfo[id]?.wastePct || 0), 0);
    const currAvg = totalHours > 0 ? currWaste / totalHours : 0;
    return (currAvg - baseAvg).toFixed(2);
  }, [allocations, recipeInfo, totalHours]);

  const riskScore = Math.min(100, Math.round(overload / 10 + Math.abs(Number(costDelta)) * 2 + Math.abs(Number(wasteDelta)) * 10));

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

  const planningKpis = kpis
    ? [
        { label: "Planned Recipe Hours", value: Math.round(totalHours).toLocaleString(), unit: "hrs", delta: totalHours > totalCapacity ? -3 : 2, driver: `vs capacity of ${totalCapacity.toLocaleString()} hrs` },
        { label: "Available Mill Hours", value: Math.round(totalCapacity).toLocaleString(), unit: "hrs", delta: 0, driver: "Period capacity" },
        { label: "Slack / Shortfall", value: Math.round(totalCapacity - totalHours).toLocaleString(), unit: "hrs", delta: totalCapacity - totalHours, driver: totalHours > totalCapacity ? "Shortfall (overload)" : "Slack within capacity" },
        { label: "Changeovers", value: kpis.avg_changeovers.toString(), delta: 0, driver: "Recipe switches" },
        { label: "Wheat Cost Index", value: kpis.wheat_cost_index.toFixed(0), unit: "SAR", delta: 0, driver: "Weighted avg cost" },
        { label: "Waste Impact", value: kpis.waste_impact_pct.toFixed(1), unit: "%", delta: -kpis.waste_impact_pct, driver: "Period waste rate" },
        { label: "Cost Impact", value: `${Number(costDelta) > 0 ? "+" : ""}${costDelta}`, unit: "%", delta: Number(costDelta), driver: "vs baseline" },
        { label: "Risk Score", value: riskScore.toString(), unit: "/100", delta: -riskScore, driver: riskScore > 50 ? "High risk" : "Acceptable" },
      ]
    : [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">Loading planning data...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Recipe & Mill Planning</h1>
        <p className="text-sm text-muted-foreground">Adjust recipe time allocation and see real-time impact</p>
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
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Flour</th>
                  {eligibilityMatrix.recipes.map((r) => (
                    <th key={r} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{r.split(" ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eligibilityMatrix.flourTypes.map((ft, i) => (
                  <tr key={ft} className={i % 2 === 0 ? "bg-card" : "bg-accent/30"}>
                    <td className="px-2 py-2 text-xs font-medium">{ft}</td>
                    {eligibilityMatrix.recipes.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        {eligibilityMatrix.matrix[ft]?.[r] ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="inline-flex items-center justify-center">
                                <Check className="h-4 w-4 text-success" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center">
                              <p className="text-xs">{ft} is eligible for {r}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="inline-flex items-center justify-center">
                            <X className="h-4 w-4 text-muted-foreground/40" />
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
              return (
                <div key={id}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{info?.name || id}</span>
                    <span className={cn("font-mono text-sm font-bold", hrs !== (info?.baseHours || 0) && "animate-pulse-amber rounded px-1")}>
                      {Math.round(hrs).toLocaleString()} hrs
                    </span>
                  </div>
                  <Slider
                    value={[hrs]}
                    onValueChange={(val) => handleSlider(id, val)}
                    min={0}
                    max={Math.max(800, Math.round(hrs * 2))}
                    step={10}
                    className="[&_[role=slider]]:border-primary [&_[role=slider]]:bg-card [&_.relative]:bg-secondary [&_[data-orientation=horizontal]>.absolute]:bg-primary"
                  />
                </div>
              );
            })}
          </div>
        </ChartContainer>

        {/* Impact Panel */}
        <div className="sticky top-20 space-y-3 self-start">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Live Impact</h3>
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
    <div className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {status === "danger" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
        {status === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "font-mono text-sm font-bold",
          status === "danger" ? "text-destructive" : status === "warning" ? "text-warning" : "text-success"
        )}
      >
        {value}
      </span>
    </div>
  );
}
