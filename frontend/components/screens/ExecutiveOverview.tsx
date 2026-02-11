'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Settings, Activity, BarChart3, Sparkles } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface ExecutiveOverviewProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

interface KPIs {
  demand: { total_tons: number; growth_pct: number };
  recipe_time: { total_hours: number; utilization_pct: number };
  capacity: { utilization_pct: number; overload_mills: number };
  risk: { avg_wheat_price: number; price_change_pct: number };
}

interface RecipeTimeItem {
  recipe_name?: string;
  recipe_id?: string | number;
  scheduled_hours?: number;
  duration_hours?: number;
}

interface CapacityItem {
  available_hours: number;
}

interface ChartDataItem {
  recipe: string;
  hours: number;
}

export default function ExecutiveOverview({ horizon, fromDate, toDate }: ExecutiveOverviewProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipeTimeData, setRecipeTimeData] = useState<RecipeTimeItem[]>([]);
  const [capacityData, setCapacityData] = useState<CapacityItem[]>([]);
  const [chartMounted, setChartMounted] = useState(false);
  
  useEffect(() => {
    setChartMounted(true);
  }, []);

  const period = useMemo(() => {
    return getPeriodFromDate(fromDate ?? '', horizon);
  }, [fromDate, horizon]);

  const chartData = useMemo<ChartDataItem[]>(() => {
    if (!recipeTimeData || recipeTimeData.length === 0) return [];
    
    const aggregated = recipeTimeData
      .filter((item) => item && (item.recipe_name != null || item.recipe_id != null))
      .reduce((acc: ChartDataItem[], item) => {
        const recipeName = String(item.recipe_name ?? item.recipe_id ?? 'Unknown').trim();
        const rawHours = Number(item.scheduled_hours ?? item.duration_hours ?? 0);
        const hours = Number.isFinite(rawHours) && rawHours >= 0 ? rawHours : 0;
        
        const existing = acc.find((x) => x.recipe === recipeName);
        if (existing) {
          existing.hours += hours;
        } else {
          acc.push({ recipe: recipeName, hours });
        }
        return acc;
      }, [])
      .filter((x) => x.recipe && Number.isFinite(x.hours) && x.hours >= 0)
      .sort((a, b) => b.hours - a.hours);
    
    return aggregated;
  }, [recipeTimeData]);

  const totalCapacity = useMemo(() => {
    const sum = capacityData.reduce((total, item) => {
      const value = Number(item.available_hours);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
    return Number.isFinite(sum) ? sum : 0;
  }, [capacityData]);

  const referenceLineY = useMemo(() => {
    if (chartData.length === 0 || totalCapacity <= 0) return null;
    const y = totalCapacity / chartData.length;
    return Number.isFinite(y) ? y : null;
  }, [totalCapacity, chartData.length]);

  const yAxisDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) return [0, 1];
    const maxHours = Math.max(...chartData.map((d) => (Number.isFinite(d.hours) ? d.hours : 0)));
    const top = Number.isFinite(maxHours) && maxHours >= 0 ? Math.max(1, maxHours) : 1;
    return [0, top];
  }, [chartData]);

  const safeChartData = useMemo(
    () =>
      chartData.map((d) => ({
        recipe: d.recipe,
        hours: Number.isFinite(d.hours) ? d.hours : 0,
      })),
    [chartData]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [kpisRes, recipeRes, capacityRes] = await Promise.all([
        api.get(`/api/kpis/executive?horizon=${horizon}&period=${encodeURIComponent(period)}`),
        api.get(`/api/planning/recipe?horizon=${horizon}&period=${encodeURIComponent(period)}`),
        api.get(`/api/capacity/mill?horizon=${horizon}&period=${encodeURIComponent(period)}`),
      ]);
      
      setKpis(kpisRes.data);
      setRecipeTimeData(Array.isArray(recipeRes.data?.data) ? recipeRes.data.data : []);
      setCapacityData(Array.isArray(capacityRes.data?.data) ? capacityRes.data.data : []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
      setRecipeTimeData([]);
      setCapacityData([]);
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

  if (error || !kpis) {
    return (
      <div className="flex items-center justify-center h-64 apple-card p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-ink-tertiary mx-auto mb-3" />
          <p className="text-ink font-medium">Unable to load data</p>
          <p className="text-sm text-ink-secondary mt-1">{error || 'Please try again'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header Section */}
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="screen-title">Executive Overview</h1>
            <p className="screen-subtitle text-ink-secondary">
              Demand, capacity, and operational health at a glance
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-hover border border-border-soft">
            <Sparkles className="w-4 h-4 text-brand" />
            <span className="text-xs font-semibold text-ink-tertiary uppercase tracking-wider">
              Live Dashboard
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Demand Card */}
        <div className="apple-card group relative overflow-hidden p-6 transition-all duration-250">
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">
                Demand
              </span>
              <div className="p-2 rounded-lg bg-brand-muted">
                {kpis.demand.growth_pct >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-brand" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
            
            <div className="text-3xl font-bold text-ink tracking-tight mb-2">
              {kpis.demand.total_tons.toLocaleString()}
              <span className="text-base text-ink-secondary ml-1 font-normal">tons</span>
            </div>
            
            <div className="flex items-center gap-1.5 mb-4">
              <span className={`text-sm font-medium ${kpis.demand.growth_pct >= 0 ? 'text-brand' : 'text-red-500'}`}>
                {kpis.demand.growth_pct >= 0 ? '↑' : '↓'} {Math.abs(kpis.demand.growth_pct).toFixed(1)}%
              </span>
              <span className="text-sm text-ink-tertiary">prior period</span>
            </div>

            <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, Math.abs(kpis.demand.growth_pct) * 10)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recipe Time Card */}
        <div className="apple-card group relative overflow-hidden p-6 transition-all duration-250">
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">
                Recipe Time
              </span>
              <div className="p-2 rounded-lg bg-brand-muted">
                <Settings className="w-5 h-5 text-brand" />
              </div>
            </div>
            
            <div className="text-3xl font-bold text-ink tracking-tight mb-2">
              {kpis.recipe_time.utilization_pct.toFixed(0)}%
              <span className="text-base text-ink-secondary ml-1 font-normal">used</span>
            </div>
            
            <p className="text-sm text-ink-secondary mb-4">
              {kpis.recipe_time.total_hours.toFixed(0)} hours scheduled
            </p>

            <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, kpis.recipe_time.utilization_pct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Capacity Card */}
        <div className="apple-card group relative overflow-hidden p-6 transition-all duration-250">
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">
                Capacity
              </span>
              <div className={`p-2 rounded-lg ${kpis.capacity.overload_mills > 0 ? 'bg-red-100' : 'bg-emerald-50'}`}>
                {kpis.capacity.overload_mills > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                ) : (
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                )}
              </div>
            </div>
            
            <div className="text-3xl font-bold text-ink tracking-tight mb-2">
              {kpis.capacity.utilization_pct.toFixed(0)}%
              <span className="text-base text-ink-secondary ml-1 font-normal">capacity</span>
            </div>
            
            <p className="text-sm text-ink-secondary mb-4">
              {kpis.capacity.overload_mills > 0
                ? `${kpis.capacity.overload_mills} mill(s) overloaded`
                : 'All mills operational'}
            </p>

            <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  kpis.capacity.overload_mills > 0 
                    ? 'bg-red-500' 
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, kpis.capacity.utilization_pct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Wheat Price Card */}
        <div className="apple-card group relative overflow-hidden p-6 transition-all duration-250">
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">
                Wheat Price
              </span>
              <div className="p-2 rounded-lg bg-brand-muted">
                <DollarSign className="w-5 h-5 text-brand" />
              </div>
            </div>
            
            <div className="text-3xl font-bold text-ink tracking-tight mb-2">
              {kpis.risk.avg_wheat_price.toFixed(0)}
              <span className="text-base text-ink-secondary ml-1 font-normal">SAR</span>
            </div>
            
            <p className="text-sm text-ink-secondary mb-4">
              per ton average
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-surface-hover rounded-full" />
              <span className="text-xs text-ink-tertiary font-medium">Market Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="apple-card relative overflow-hidden p-8 transition-all duration-250">
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-ink mb-1">
                Recipe Time vs Capacity
              </h2>
              <p className="text-sm text-ink-secondary">
                Scheduled hours by recipe compared to average capacity
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-hover border border-border-soft">
              <div className="w-2 h-2 rounded-full bg-brand" />
              <span className="text-xs text-ink-secondary font-medium">Live Data</span>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[320px] rounded-xl bg-surface-hover/80 border-2 border-dashed border-border p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-muted flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-brand" />
              </div>
              <p className="text-ink font-semibold text-lg mb-2">No recipe time data available</p>
              <p className="text-sm text-ink-secondary max-w-md mb-4">
                Schedule data is available for <strong className="text-ink">2020</strong>. Set the navbar <strong className="text-ink">From</strong> date to{' '}
                <code className="bg-white border border-border px-2 py-1 rounded text-brand">2020-01-01</code>{' '}
                to view the chart.
              </p>
              <p className="text-xs text-ink-tertiary max-w-lg">
                Ensure the backend is running on port 8000 and that{' '}
                <code className="bg-white/80 px-1.5 py-0.5 rounded border border-border-soft text-ink-secondary">mill_recipe_schedule.csv</code>{' '}
                exists in{' '}
                <code className="bg-white/80 px-1.5 py-0.5 rounded border border-border-soft text-ink-secondary">backend/datasets</code>
              </p>
            </div>
          ) : (
            <>
              <div className="w-full rounded-xl bg-surface-hover/50 p-4 border border-border-soft">
                {chartMounted && safeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={safeChartData}
                      margin={{ top: 16, right: 24, left: 16, bottom: 80 }}
                      barCategoryGap="14%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
                      <XAxis 
                        dataKey="recipe" 
                        angle={-40} 
                        textAnchor="end" 
                        height={80} 
                        interval={0} 
                        stroke="#6e6e73" 
                        fontSize={11} 
                        tick={{ fill: '#6e6e73' }} 
                      />
                      <YAxis 
                        stroke="#6e6e73" 
                        fontSize={12} 
                        tick={{ fill: '#6e6e73' }} 
                        width={44} 
                        domain={yAxisDomain} 
                        label={{ 
                          value: 'Hours', 
                          angle: -90, 
                          position: 'insideLeft', 
                          fill: '#6e6e73', 
                          style: { fontSize: 11 } 
                        }} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: 12, 
                          border: '1px solid var(--color-border)', 
                          background: 'var(--color-surface)',
                          color: 'var(--color-text)',
                          boxShadow: 'var(--shadow-card)'
                        }} 
                        cursor={{ fill: 'rgba(184, 92, 56, 0.08)' }} 
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#6e6e73' }} />
                      <Bar 
                        dataKey="hours" 
                        fill="#B85C38" 
                        name="Scheduled Hours" 
                        radius={[8, 8, 0, 0]} 
                        maxBarSize={72} 
                        isAnimationActive={true} 
                      />
                      {referenceLineY != null && (
                        <ReferenceLine
                          y={referenceLineY}
                          stroke="#6e6e73"
                          strokeDasharray="5 5"
                          strokeWidth={2}
                          label={{ 
                            value: 'Avg capacity', 
                            position: 'right', 
                            fill: '#6e6e73', 
                            fontSize: 11,
                            fontWeight: 600
                          }}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-ink-secondary text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-border border-t-brand animate-spin" />
                      Loading chart…
                    </div>
                  </div>
                )}
              </div>

              {/* Recipe breakdown */}
              <div className="mt-6 pt-6 border-t border-border-soft">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-tertiary">
                    Recipe Breakdown (Hours)
                  </p>
                  <span className="text-xs text-ink-tertiary font-medium">
                    {chartData.length} recipes
                  </span>
                </div>
                <div className="flex flex-wrap gap-4">
                  {chartData.map((row, i) => (
                    <div 
                      key={`${row.recipe}-${i}`}
                      className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-hover border border-border-soft hover:border-brand/30 hover:bg-brand-muted/50 transition-all duration-200"
                    >
                      <div className="w-2 h-2 rounded-full bg-brand" />
                      <span className="text-sm font-semibold text-ink">
                        {row.recipe}
                      </span>
                      <span className="text-sm text-ink-secondary group-hover:text-ink transition-colors">
                        {Number(row.hours).toFixed(0)}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Insight Card */}
      <div className="apple-card relative overflow-hidden p-6 bg-brand text-white border-0 shadow-card">
        <div className="relative flex items-start gap-4">
          <div className="flex-shrink-0 text-3xl" role="img" aria-label="brain">🧠</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Insight</h3>
            <p className="text-sm text-white/95 leading-relaxed">
              {kpis.demand.growth_pct > 0
                ? `Demand is trending upward by ${kpis.demand.growth_pct.toFixed(1)}% this ${horizon}. Current utilization stands at ${kpis.recipe_time.utilization_pct.toFixed(0)}%. ${
                    kpis.capacity.overload_mills > 0
                      ? `⚠️ ${kpis.capacity.overload_mills} mill(s) are currently overloaded — consider optimizing schedule allocation.`
                      : '✅ All mills are operating within optimal capacity ranges.'
                  }`
                : `Demand levels remain stable. Recipe time allocation is within expected parameters. All systems operating normally.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}