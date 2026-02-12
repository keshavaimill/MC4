import { useMemo } from "react";
import { ChartContainer } from "./ChartContainer";
import { fetchRecipePlanning } from "@/lib/api";
import { useFilters } from "@/context/FilterContext";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/utils";

interface RecipePlanningChartProps {
  className?: string;
}

interface RecipeRow {
  recipe_id: string;
  recipe_name: string;
  period: string;
  scheduled_hours: number;
}

export function RecipePlanningChart({ className }: RecipePlanningChartProps) {
  const { kpiQueryParams } = useFilters();
  const [recipeData, setRecipeData] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    fetchRecipePlanning(kpiQueryParams)
      .then((response) => {
        if (cancelled) return;
        const recipes = (response.data as unknown as RecipeRow[]) || [];
        setRecipeData(recipes);
      })
      .catch((err) => {
        if (!cancelled) console.error("Recipe Planning data load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [kpiQueryParams.from_date, kpiQueryParams.to_date, kpiQueryParams.scenario, kpiQueryParams.horizon]);

  // Aggregate recipe hours by recipe name
  const chartData = useMemo(() => {
    const byRecipe: Record<string, number> = {};
    
    for (const r of recipeData) {
      const recipeName = r.recipe_name || r.recipe_id;
      byRecipe[recipeName] = (byRecipe[recipeName] || 0) + (r.scheduled_hours || 0);
    }
    
    return Object.entries(byRecipe)
      .map(([recipe, hours]) => ({ recipe, hours: Math.round(hours) }))
      .sort((a, b) => b.hours - a.hours);
  }, [recipeData]);

  if (loading) {
    return (
      <ChartContainer
        title="Recipe Planning"
        subtitle="Scheduled hours by recipe (current allocation)"
        className={className}
      >
        <div className="flex items-center justify-center h-[260px]">
          <p className="text-sm text-muted-foreground">Loading recipe data...</p>
        </div>
      </ChartContainer>
    );
  }

  if (chartData.length === 0) {
    return (
      <ChartContainer
        title="Recipe Planning"
        subtitle="Scheduled hours by recipe (current allocation)"
        className={className}
      >
        <div className="flex flex-col items-center justify-center h-[260px] text-center rounded-lg border border-border bg-muted/20">
          <p className="text-sm font-medium text-muted-foreground">No recipe scheduling data</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Try adjusting your filters or date range.</p>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title="Recipe Planning"
      subtitle="Scheduled hours by recipe (current allocation)"
      action={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            downloadCsv(chartData as unknown as Record<string, unknown>[], "recipe_planning_allocation");
          }}
          disabled={chartData.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </Button>
      }
      className={className}
    >
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              type="category"
              dataKey="recipe"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={120}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--card))",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value.toLocaleString()} hrs`, "Hours"]}
            />
            <Bar dataKey="hours" name="Hours" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
