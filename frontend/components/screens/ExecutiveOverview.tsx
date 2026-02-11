'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  DollarSign, 
  Settings, 
  Activity, 
  BarChart3, 
  Sparkles,
  Clock,
  Factory
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  TooltipProps
} from 'recharts';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';

// --- Types ---

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

// --- Components ---

/**
 * Reusable KPI Card Component for consistent design
 */
const KPICard = ({ 
  title, 
  value, 
  unit, 
  trend, 
  trendLabel, 
  icon: Icon, 
  colorClass = "text-brand",
  progressValue,
  alert = false
}: {
  title: string;
  value: string | number;
  unit?: string;
  trend?: { value: number; positiveIsGood: boolean };
  trendLabel?: string;
  icon: any;
  colorClass?: string;
  progressValue?: number;
  alert?: boolean;
}) => (
  <div className={`apple-card p-5 flex flex-col justify-between h-full transition-all hover:shadow-md ${alert ? 'bg-red-50/50 border-red-100' : 'bg-white'}`}>
    <div className="flex justify-between items-start mb-2">
      <div className="p-2 rounded-lg bg-surface-subtle border border-border-soft">
        <Icon className={`w-5 h-5 ${alert ? 'text-red-500' : colorClass}`} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
          (trend.value >= 0) === trend.positiveIsGood 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend.value).toFixed(1)}%
        </div>
      )}
    </div>
    
    <div>
      <h3 className="text-sm font-medium text-ink-secondary mb-1">{title}</h3>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-bold text-ink tracking-tight">{value}</span>
        {unit && <span className="text-sm text-ink-tertiary font-medium">{unit}</span>}
      </div>
      {trendLabel && <p className="text-xs text-ink-tertiary mb-3">{trendLabel}</p>}
      
      {progressValue !== undefined && (
        <div className="w-full h-1.5 bg-surface-hover rounded-full overflow-hidden mt-2">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${alert ? 'bg-red-500' : 'bg-brand'}`} 
            style={{ width: `${Math.min(100, progressValue)}%` }} 
          />
        </div>
      )}
    </div>
  </div>
);

// --- Main Component ---

export default function ExecutiveOverview({ horizon, fromDate, toDate }: ExecutiveOverviewProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipeTimeData, setRecipeTimeData] = useState<RecipeTimeItem[]>([]);
  const [capacityData, setCapacityData] = useState<CapacityItem[]>([]);

  const period = useMemo(() => getPeriodFromDate(fromDate ?? '', horizon), [fromDate, horizon]);

  // Data Fetching
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [kpisRes, recipeRes, capacityRes] = await Promise.all([
        api.get(`/api/kpis/executive`, { params: { horizon, period } }),
        api.get(`/api/planning/recipe`, { params: { horizon, period } }),
        api.get(`/api/capacity/mill`, { params: { horizon, period } }),
      ]);
      
      setKpis(kpisRes.data);
      setRecipeTimeData(Array.isArray(recipeRes.data?.data) ? recipeRes.data.data : []);
      setCapacityData(Array.isArray(capacityRes.data?.data) ? capacityRes.data.data : []);
    } catch (err: any) {
      console.error('Error fetching executive data:', err);
      setError('Unable to retrieve dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, [horizon, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Data Transformation
  const chartData = useMemo<ChartDataItem[]>(() => {
    if (!recipeTimeData.length) return [];
    
    // Aggregation logic
    const map = new Map<string, number>();
    
    recipeTimeData.forEach(item => {
      const name = item.recipe_name || String(item.recipe_id || 'Unknown');
      const hours = Number(item.scheduled_hours ?? item.duration_hours ?? 0);
      if (hours > 0) {
        map.set(name, (map.get(name) || 0) + hours);
      }
    });

    return Array.from(map.entries())
      .map(([recipe, hours]) => ({ recipe, hours }))
      .sort((a, b) => b.hours - a.hours) // Sort desc for Pareto effect
      .slice(0, 10); // UX: Limit to top 10 for readability
  }, [recipeTimeData]);

  const avgCapacity = useMemo(() => {
    if (!capacityData.length) return 0;
    const total = capacityData.reduce((sum, item) => sum + (Number(item.available_hours) || 0), 0);
    return total / (capacityData.length || 1); // Avoid division by zero
  }, [capacityData]);

  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-border-soft rounded-xl shadow-lg text-xs z-50">
          <p className="font-semibold text-ink mb-1">{label}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand" />
            <span className="text-ink-secondary">Scheduled:</span>
            <span className="font-medium text-ink">{payload[0].value?.toFixed(1)} hrs</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 animate-pulse">
        <div className="h-10 w-10 border-2 border-brand/20 border-t-brand rounded-full animate-spin mb-4" />
        <p className="text-ink-tertiary text-sm font-medium">Gathering intelligence...</p>
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div className="apple-card p-8 flex flex-col items-center justify-center text-center h-96">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-ink font-semibold mb-2">Data Unavailable</h3>
        <p className="text-ink-secondary text-sm max-w-xs mb-4">{error}</p>
        <button onClick={fetchData} className="text-brand text-sm font-medium hover:underline">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="screen-title text-2xl font-bold text-ink">Executive Overview</h1>
          <p className="screen-subtitle text-ink-secondary mt-1">
            Operational health and capacity analysis
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-border-soft rounded-full shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">
            Live System
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Total Demand"
          value={kpis.demand.total_tons.toLocaleString()}
          unit="tons"
          trend={{ value: kpis.demand.growth_pct, positiveIsGood: true }}
          icon={Activity}
          progressValue={Math.min(100, Math.abs(kpis.demand.growth_pct) * 5)} // visual scaling
        />
        
        <KPICard 
          title="Recipe Utilization"
          value={kpis.recipe_time.utilization_pct.toFixed(0)}
          unit="%"
          icon={Clock}
          colorClass="text-blue-600"
          progressValue={kpis.recipe_time.utilization_pct}
          trendLabel={`${kpis.recipe_time.total_hours.toLocaleString()} hrs scheduled`}
        />

        <KPICard 
          title="Mill Capacity"
          value={kpis.capacity.utilization_pct.toFixed(0)}
          unit="%"
          icon={Factory}
          colorClass={kpis.capacity.overload_mills > 0 ? "text-red-500" : "text-emerald-600"}
          progressValue={kpis.capacity.utilization_pct}
          alert={kpis.capacity.overload_mills > 0}
          trendLabel={kpis.capacity.overload_mills > 0 
            ? `${kpis.capacity.overload_mills} Mills Overloaded` 
            : "Optimal Load"}
        />

        <KPICard 
          title="Avg. Wheat Price"
          value={kpis.risk.avg_wheat_price.toLocaleString()}
          unit="SAR"
          icon={DollarSign}
          colorClass="text-amber-600"
          trend={{ value: kpis.risk.price_change_pct, positiveIsGood: false }} // Higher price is bad
        />
      </div>

      {/* Charts & Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 apple-card p-6 bg-white flex flex-col">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-ink">Recipe Schedule vs. Capacity</h2>
            <p className="text-sm text-ink-secondary">Top 10 recipes by scheduled duration</p>
          </div>

          <div className="flex-1 min-h-[350px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e7" />
                  <XAxis 
                    dataKey="recipe" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6e6e73', fontSize: 11 }}
                    dy={10}
                    interval={0}
                    // Truncate long labels
                    tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6e6e73', fontSize: 11 }}
                    label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: '#6e6e73', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f5f5f7' }} />
                  
                  {avgCapacity > 0 && (
                    <ReferenceLine 
                      y={avgCapacity} 
                      stroke="#F59E0B" 
                      strokeDasharray="4 4"
                      label={{ 
                        value: 'Avg Capacity', 
                        position: 'insideTopRight', 
                        fill: '#F59E0B', 
                        fontSize: 11 
                      }} 
                    />
                  )}
                  
                  <Bar 
                    dataKey="hours" 
                    fill="#B85C38" 
                    radius={[6, 6, 0, 0]}
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-ink-tertiary bg-surface-subtle/30 rounded-xl border border-dashed border-border-soft">
                <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                <p>No scheduling data available for {horizon}</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="apple-card p-6 bg-surface-subtle border border-border-soft flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-brand" />
            <h2 className="text-lg font-semibold text-ink">System Intelligence</h2>
          </div>
          
          <div className="space-y-4 flex-1">
            <div className="bg-white p-4 rounded-xl border border-border-soft shadow-sm">
              <h4 className="text-xs font-bold text-ink-tertiary uppercase tracking-wider mb-2">Observations</h4>
              <p className="text-sm text-ink leading-relaxed">
                {kpis.demand.growth_pct > 0 
                  ? "Demand is trending upward. Ensure raw material inventory is sufficient for the coming weeks." 
                  : "Demand is stabilizing. Good opportunity to perform maintenance on high-utilization mills."}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-border-soft shadow-sm">
               <h4 className="text-xs font-bold text-ink-tertiary uppercase tracking-wider mb-2">Anomalies</h4>
               {kpis.capacity.overload_mills > 0 ? (
                 <div className="flex gap-3 items-start">
                   <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                   <div>
                     <p className="text-sm font-medium text-red-700">Capacity Strain Detected</p>
                     <p className="text-xs text-ink-secondary mt-1">
                       {kpis.capacity.overload_mills} mill(s) are operating above recommended thresholds.
                     </p>
                   </div>
                 </div>
               ) : (
                 <div className="flex gap-3 items-start">
                   <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                   </div>
                   <div>
                     <p className="text-sm font-medium text-emerald-800">All Systems Nominal</p>
                     <p className="text-xs text-ink-secondary mt-1">
                       Load balancing is effective across all active recipes.
                     </p>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}