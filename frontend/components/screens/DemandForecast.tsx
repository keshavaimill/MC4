'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';

// 🎨 UI/UX: Define a robust color palette. 
// Using CSS variables or hex codes that offer good contrast.
const CHART_COLORS = [
  '#B85C38', // Rust
  '#2C3E50', // Dark Blue
  '#16A085', // Teal
  '#8E44AD', // Purple
  '#F39C12', // Orange
  '#7F8C8D', // Gray
];

interface DemandForecastProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

interface ForecastItem {
  period: string;
  flour_type: string;
  sku_name: string;
  forecast_tons: number;
}

interface ChartDataPoint {
  period: string;
  [key: string]: string | number;
}

export default function DemandForecast({ horizon, fromDate, toDate }: DemandForecastProps) {
  const [forecastData, setForecastData] = useState<ForecastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => getPeriodFromDate(fromDate ?? '', horizon), [fromDate, horizon]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // UX: Ensure we are fetching fresh data or handling cache appropriately
      const response = await api.get(`/api/forecast/sku`, {
        params: { horizon, period }
      });
      
      setForecastData(response.data.data || []);
    } catch (err) {
      console.error('Error fetching forecast data:', err);
      setError('Failed to load forecast data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [horizon, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ⚡️ Performance: Memoize expensive data transformation
  // This prevents the reduce/sort logic from running on every re-render
  const { chartData, flourTypes } = useMemo(() => {
    if (!forecastData.length) return { chartData: [], flourTypes: [] };

    const types = new Set<string>();
    
    const reducedData = forecastData.reduce((acc: Record<string, ChartDataPoint>, item) => {
      const key = item.period;
      types.add(item.flour_type);

      if (!acc[key]) {
        acc[key] = { period: key };
      }
      // Type assertion for dynamic keys
      const currentVal = (acc[key][item.flour_type] as number) || 0;
      acc[key][item.flour_type] = currentVal + item.forecast_tons;
      
      return acc;
    }, {});

    const sortedData = Object.values(reducedData).sort((a, b) => 
      a.period.localeCompare(b.period)
    );

    return { chartData: sortedData, flourTypes: Array.from(types) };
  }, [forecastData]);

  // 🎨 UI: Custom Tooltip for better readability
  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-border-soft rounded-xl shadow-lg text-xs">
          <p className="font-semibold text-ink mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-ink-secondary capitalize">
                {entry.name}:
              </span>
              <span className="font-medium text-ink ml-auto">
                {entry.value?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tons
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Loading State
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-surface-subtle rounded-2xl animate-pulse">
         <div className="h-8 w-8 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-ink-secondary">
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 text-primary font-medium hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header Section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="screen-title text-2xl font-bold text-ink">Demand & Forecast</h1>
          <p className="screen-subtitle text-ink-secondary mt-1">
            SKU-level forecasts by flour type
          </p>
        </div>
        {/* UX: Could add export buttons or filters here */}
      </div>

      {/* Chart Section */}
      <div className="apple-card p-6 bg-white rounded-2xl shadow-sm border border-border-soft">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-ink">Forecast Trends</h2>
          {/* Legend helper if needed */}
        </div>
        
        <div className="h-[400px] w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-ink-tertiary">
              No forecast data available for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e7" />
                <XAxis
                  dataKey="period"
                  stroke="#86868b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6e6e73' }}
                  dy={10}
                />
                <YAxis
                  stroke="#86868b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#6e6e73' }}
                  tickFormatter={(value) => `${value}`}
                  label={{
                    value: 'Tons',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#86868b',
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e5e7', strokeWidth: 2 }} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }} 
                  iconType="circle"
                />
                
                {/* Dynamically render lines based on data */}
                {flourTypes.map((type, index) => (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey={type}
                    name={type}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="apple-card overflow-hidden bg-white rounded-2xl shadow-sm border border-border-soft">
        <div className="p-4 border-b border-border-soft flex justify-between items-center bg-surface-subtle/30">
          <h2 className="text-base font-semibold text-ink">SKU Breakdown</h2>
          <span className="text-xs text-ink-tertiary font-medium">Top 20 Items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-soft bg-surface-subtle">
                <th className="px-6 py-3 text-left text-xs font-semibold text-ink-secondary uppercase tracking-wider">SKU Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-ink-secondary uppercase tracking-wider">Flour Type</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-ink-secondary uppercase tracking-wider">Forecast</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {forecastData.slice(0, 20).map((item, idx) => (
                <tr key={`${item.sku_name}-${idx}`} className="group hover:bg-surface-hover/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-ink group-hover:text-primary transition-colors">
                    {item.sku_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-ink-secondary">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-hover text-ink-secondary">
                      {item.flour_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-ink tabular-nums">
                    {item.forecast_tons.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tons
                  </td>
                </tr>
              ))}
              {forecastData.length === 0 && (
                 <tr>
                   <td colSpan={3} className="px-6 py-8 text-center text-sm text-ink-tertiary">
                     No Data Available
                   </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}