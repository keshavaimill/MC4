'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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
        <div className="h-8 w-8 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
      </div>
    );
  }

  const flourTypes = Array.from(new Set(eligibility.map((e) => e.flour_type)));
  const recipes = Array.from(new Set(eligibility.map((e) => e.recipe_name)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="screen-title">Recipe Planning</h1>
        <p className="screen-subtitle">Eligibility matrix and time allocation</p>
      </div>

      <div className="apple-card p-6">
        <h2 className="text-base font-semibold text-ink mb-4">Recipe Eligibility</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-soft">
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-tertiary uppercase tracking-wider">Flour Type</th>
                {recipes.map((r) => (
                  <th key={r} className="px-4 py-3 text-center text-xs font-medium text-ink-tertiary uppercase tracking-wider">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {flourTypes.map((flour) => (
                <tr key={flour} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-ink">{flour}</td>
                  {recipes.map((recipe) => {
                    const eligible = eligibility.find((e) => e.flour_type === flour && e.recipe_name === recipe);
                    return (
                      <td key={recipe} className="px-4 py-3 text-center">
                        {eligible ? (
                          <CheckCircle className="w-5 h-5 text-ink mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-border mx-auto" />
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

      <div className="apple-card p-6">
        <h2 className="text-base font-semibold text-ink mb-4">Scheduled Hours by Recipe</h2>
        {recipeData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-ink-tertiary text-sm">No recipe data</div>
        ) : (
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={recipeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
                <XAxis dataKey="recipe_name" stroke="#86868b" fontSize={12} />
                <YAxis stroke="#86868b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e5e7' }} />
                <Legend />
                <Bar dataKey="scheduled_hours" fill="#B85C38" name="Scheduled Hours" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="apple-card p-6">
        <h2 className="text-base font-semibold text-ink mb-4">Recipe Mix — Superior Flour</h2>
        <div className="space-y-4">
          {eligibility
            .filter((e) => e.flour_type === 'Superior')
            .map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{item.recipe_name}</span>
                  <span className="text-ink-secondary">{(item.allocation_pct * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-border-soft rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-300"
                    style={{ width: `${item.allocation_pct * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
