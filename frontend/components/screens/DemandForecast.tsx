'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#B85C38', '#6e6e73', '#86868b', '#aeaeae'];

interface DemandForecastProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

export default function DemandForecast({ horizon, fromDate, toDate }: DemandForecastProps) {
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => getPeriodFromDate(fromDate ?? '', horizon), [fromDate, horizon]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/forecast/sku?horizon=${horizon}&period=${encodeURIComponent(period)}`);
      setForecastData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching forecast data:', error);
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

  const chartData = forecastData.reduce((acc: any, item: any) => {
    const key = item.period;
    if (!acc[key]) acc[key] = { period: key };
    acc[key][item.flour_type] = (acc[key][item.flour_type] || 0) + item.forecast_tons;
    return acc;
  }, {});
  const chartArray = Object.values(chartData).sort((a: any, b: any) => a.period.localeCompare(b.period));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="screen-title">Demand & Forecast</h1>
        <p className="screen-subtitle">SKU-level forecasts by flour type</p>
      </div>

      <div className="apple-card overflow-hidden">
        <div className="p-4 border-b border-border-soft">
          <h2 className="text-base font-semibold text-ink">SKU Forecast</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-soft bg-surface-hover/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-tertiary uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-tertiary uppercase tracking-wider">Flour Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-tertiary uppercase tracking-wider">Forecast (tons)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {forecastData.slice(0, 20).map((item, idx) => (
                <tr key={idx} className="transition-colors hover:bg-surface-hover/50">
                  <td className="px-4 py-3 text-sm text-ink">{item.sku_name}</td>
                  <td className="px-4 py-3 text-sm text-ink-secondary">{item.flour_type}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-ink">{item.forecast_tons.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="apple-card p-6">
        <h2 className="text-base font-semibold text-ink mb-4">Forecast by Flour Type</h2>
        {chartArray.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-ink-tertiary text-sm">No forecast data</div>
        ) : (
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartArray}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
                <XAxis dataKey="period" stroke="#86868b" fontSize={12} />
                <YAxis stroke="#86868b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e5e7' }} />
                <Legend />
                <Line type="monotone" dataKey="Superior" stroke="#B85C38" strokeWidth={2} dot={{ fill: '#B85C38' }} />
                <Line type="monotone" dataKey="Bakery" stroke={CHART_COLORS[1]} strokeWidth={2} dot={{ fill: CHART_COLORS[1] }} />
                <Line type="monotone" dataKey="Patent" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ fill: CHART_COLORS[2] }} />
                <Line type="monotone" dataKey="Brown" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ fill: CHART_COLORS[3] }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
