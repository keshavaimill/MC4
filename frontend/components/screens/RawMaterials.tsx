'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import { Globe2, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const CHART_COLORS = ['#B85C38', '#6e6e73', '#86868b', '#aeaeae', '#d1d1d6'];

interface RawMaterialsProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

export default function RawMaterials({ horizon, fromDate, toDate }: RawMaterialsProps) {
  const [rawMaterialData, setRawMaterialData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMounted, setChartMounted] = useState(false);

  useEffect(() => {
    setChartMounted(true);
  }, []);

  const chartData = React.useMemo(() => {
    if (!rawMaterialData?.length) return [];
    const grouped = rawMaterialData.reduce((acc: any, item: any) => {
      const key = item.period;
      if (!acc[key]) acc[key] = { period: key };
      const price = Number(item.wheat_price_sar_per_ton);
      acc[key][item.country] = Number.isFinite(price) ? price : 0;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => String(a.period).localeCompare(String(b.period)));
  }, [rawMaterialData]);

  const countries = React.useMemo(() => {
    return Array.from(new Set(rawMaterialData.map((item) => item.country))).filter(Boolean);
  }, [rawMaterialData]);

  const barDataByCountry = React.useMemo(() => {
    if (!rawMaterialData?.length) return [];
    const byCountry = rawMaterialData.reduce((acc: Record<string, number>, item: any) => {
      const c = item.country;
      const p = Number(item.wheat_price_sar_per_ton);
      if (c) acc[c] = Number.isFinite(p) ? p : 0;
      return acc;
    }, {});
    return Object.entries(byCountry).map(([country, price]) => ({ country, price }));
  }, [rawMaterialData]);

  const period = useMemo(() => getPeriodFromDate(fromDate ?? '', horizon), [fromDate, horizon]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/raw-material?horizon=${horizon}&period=${encodeURIComponent(period)}`);
      setRawMaterialData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching raw material data:', error);
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="screen-title">Raw Materials</h1>
        <p className="screen-subtitle">Wheat prices and availability by country</p>
      </div>

      <div className="apple-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center">
              <Globe2 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Wheat Price by Country</h2>
              <p className="text-sm text-ink-secondary">Benchmark prices per country for the selected period</p>
            </div>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[280px] rounded-xl bg-surface-hover/80 border-2 border-dashed border-border p-6 text-center">
            <p className="text-ink font-medium">No wheat price data for this period</p>
            <p className="text-sm text-ink-secondary mt-2 max-w-md">
              Data is available for <strong>2020</strong>. Set the navbar <strong>From</strong> date to <code className="bg-white border border-border px-1.5 py-0.5 rounded text-brand">2020-01-01</code> (or any date in 2020) to see the chart.
            </p>
          </div>
        ) : !chartMounted ? (
          <div className="flex items-center justify-center h-[400px] text-ink-secondary text-sm">Loading chart…</div>
        ) : chartData.length >= 2 ? (
          <div className="w-full overflow-x-auto">
            <LineChart
              data={chartData}
              width={700}
              height={400}
              margin={{ top: 16, right: 24, left: 16, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
              <XAxis dataKey="period" stroke="#6e6e73" fontSize={12} tick={{ fill: '#6e6e73' }} />
              <YAxis
                stroke="#6e6e73"
                fontSize={12}
                tick={{ fill: '#6e6e73' }}
                label={{
                  value: 'Price (SAR/ton)',
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
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#6e6e73' }} />
              {countries.map((country, idx) => (
                <Line
                  key={country}
                  type="monotone"
                  dataKey={country}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS[idx % CHART_COLORS.length] }}
                  name={country}
                />
              ))}
            </LineChart>
          </div>
        ) : barDataByCountry.length > 0 ? (
          <div className="w-full overflow-x-auto">
            <BarChart
              data={barDataByCountry}
              width={700}
              height={400}
              margin={{ top: 16, right: 24, left: 16, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
              <XAxis
                dataKey="country"
                angle={-25}
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
                  value: 'Price (SAR/ton)',
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
              />
              <Bar
                dataKey="price"
                fill="#B85C38"
                name="Wheat price (SAR/ton)"
                radius={[4, 4, 0, 0]}
                maxBarSize={72}
              />
            </BarChart>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-ink-secondary text-sm">Loading chart…</div>
        )}
      </div>

      <div className="apple-card overflow-hidden">
        <div className="p-4 border-b border-border-soft flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Current Prices</h2>
            <p className="text-xs text-ink-tertiary mt-0.5">
              Latest wheat prices and availability by country
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-soft bg-surface-hover/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-tertiary uppercase tracking-wider">Country</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-tertiary uppercase tracking-wider">Price (SAR/ton)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-tertiary uppercase tracking-wider">Availability (tons)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {rawMaterialData
                .filter((item, idx, arr) => arr.findIndex((x) => x.country === item.country) === idx)
                .map((item, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-surface-hover/50">
                    <td className="px-4 py-3 text-sm font-medium text-ink">{item.country}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-ink">{item.wheat_price_sar_per_ton.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-ink-secondary">{item.availability_tons?.toLocaleString() ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
