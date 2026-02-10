'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import { CheckCircle, XCircle, Activity, TrendingUp, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface RecipePlanningProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

export default function RecipePlanning({ horizon, fromDate, toDate }: RecipePlanningProps) {
  const [recipeData, setRecipeData] = useState<any[]>([]);
  const [eligibility, setEligibility] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => getPeriodFromDate(fromDate ?? '', horizon), [fromDate, horizon]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [recipeRes, eligibilityRes] = await Promise.all([
        api.get(`/api/planning/recipe?horizon=${horizon}&period=${encodeURIComponent(period)}`),
        api.get('/api/planning/recipe-eligibility'),
      ]);
      setRecipeData(recipeRes.data.data || []);
      setEligibility(eligibilityRes.data.data || []);
    } catch (error) {
      console.error('Error fetching recipe data:', error);
    } finally {
      setLoading(false);
    }
  }, [horizon, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-border border-t-brand animate-spin" />
          <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-brand animate-pulse" />
        </div>
      </div>
    );
  }

  const flourTypes = Array.from(new Set(eligibility.map((e) => e.flour_type)));
  const recipes = Array.from(new Set(eligibility.map((e) => e.recipe_name)));

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div>
        <h1 className="screen-title">Recipe Planning</h1>
        <p className="screen-subtitle">Eligibility matrix and time allocation across recipes</p>
      </div>

      {/* Recipe Eligibility Matrix */}
      <div className="apple-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Recipe Eligibility</h2>
              <p className="text-sm text-ink-secondary">Flour type compatibility matrix</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border-soft">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-soft bg-surface-hover/60">
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-tertiary uppercase tracking-wider sticky left-0 bg-surface-hover/60">
                  Flour Type
                </th>
                {recipes.map((r) => (
                  <th
                    key={r}
                    className="px-4 py-3 text-center text-xs font-medium text-ink-tertiary uppercase tracking-wider"
                  >
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {flourTypes.map((flour) => (
                <tr key={flour} className="hover:bg-surface-hover/60 transition-colors group">
                  <td className="px-4 py-3 text-sm font-medium text-ink sticky left-0 bg-surface group-hover:bg-surface-hover/80">
                    {flour}
                  </td>
                  {recipes.map((recipe) => {
                    const eligible = eligibility.find(
                      (e) => e.flour_type === flour && e.recipe_name === recipe
                    );
                    return (
                      <td key={recipe} className="px-4 py-3 text-center">
                        {eligible ? (
                          <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-muted">
                            <CheckCircle className="w-4 h-4 text-brand" />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border-soft">
                            <XCircle className="w-4 h-4 text-border" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scheduled Hours Chart */}
      <div className="apple-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center">
              <Clock className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Scheduled Hours by Recipe</h2>
              <p className="text-sm text-ink-secondary">Time allocation across production recipes</p>
            </div>
          </div>
        </div>

        {recipeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[280px] rounded-xl bg-surface-hover/80 border-2 border-dashed border-border p-6 text-center">
            <p className="text-ink font-medium">No recipe scheduling data</p>
            <p className="text-sm text-ink-secondary mt-2 max-w-md">
              Schedule data is not available for the selected period. Try adjusting your date range.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <BarChart
              data={recipeData}
              width={700}
              height={400}
              margin={{ top: 16, right: 24, left: 16, bottom: 80 }}
              barCategoryGap="16%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
              <XAxis
                dataKey="recipe_name"
                angle={-30}
                textAnchor="end"
                height={80}
                stroke="#6e6e73"
                fontSize={11}
                tick={{ fill: '#6e6e73' }}
              />
              <YAxis
                stroke="#6e6e73"
                fontSize={12}
                tick={{ fill: '#6e6e73' }}
                label={{
                  value: 'Hours',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#6e6e73',
                  style: { fontSize: 11 },
                }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e5e5e7',
                  background: '#ffffff',
                }}
                cursor={{ fill: 'rgba(184, 92, 56, 0.08)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#6e6e73' }} />
              <Bar
                dataKey="scheduled_hours"
                fill="#B85C38"
                name="Scheduled Hours"
                radius={[8, 8, 0, 0]}
                maxBarSize={72}
              />
            </BarChart>
          </div>
        )}
      </div>

      {/* Recipe Mix - Superior Flour */}
      <div className="apple-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Recipe Mix — Superior Flour</h2>
              <p className="text-sm text-ink-secondary">Allocation percentage by recipe</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {eligibility
            .filter((e) => e.flour_type === 'Superior')
            .map((item, idx) => (
              <div key={idx} className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-ink">{item.recipe_name}</span>
                  <span className="text-sm font-semibold text-brand">
                    {(item.allocation_pct * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-border-soft rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-300 group-hover:bg-brand-dark"
                    style={{ width: `${item.allocation_pct * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </div>

        {eligibility.filter((e) => e.flour_type === 'Superior').length === 0 && (
          <div className="flex items-center justify-center py-8 text-ink-tertiary">
            <p className="text-sm">No Superior flour recipes available</p>
          </div>
        )}
      </div>
    </div>
  );
}