'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import { AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface MillCapacityProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

export default function MillCapacity({ horizon, fromDate, toDate }: MillCapacityProps) {
  const [capacityData, setCapacityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => getPeriodFromDate(fromDate ?? '', horizon), [fromDate, horizon]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/capacity/mill?horizon=${horizon}&period=${encodeURIComponent(period)}`);
      setCapacityData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching capacity data:', error);
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="screen-title">Mill Capacity</h1>
        <p className="screen-subtitle">Utilization and capacity planning</p>
      </div>

      <div className="apple-card overflow-hidden">
        <div className="p-4 border-b border-border-soft flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Capacity Ledger</h2>
              <p className="text-xs text-ink-tertiary">Available vs planned hours per mill</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-soft bg-surface-hover/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-tertiary uppercase tracking-wider">Mill</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-tertiary uppercase tracking-wider">Available (hrs)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-tertiary uppercase tracking-wider">Planned (hrs)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-tertiary uppercase tracking-wider">Variance</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-tertiary uppercase tracking-wider">Utilization</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-tertiary uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {capacityData.map((item, idx) => {
                const availableHours = item.available_hours ?? 0;
                const scheduledHours = item.scheduled_hours ?? 0;
                const overloadHours = item.overload_hours ?? 0;
                const utilizationPct = item.utilization_pct ?? 0;
                return (
                  <tr key={idx} className="transition-colors hover:bg-surface-hover/50">
                    <td className="px-4 py-3 text-sm font-medium text-ink">{item.mill_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-right text-ink-secondary">{availableHours.toFixed(0)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-ink">{scheduledHours.toFixed(0)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${overloadHours > 0 ? 'text-ink' : 'text-ink-secondary'}`}>
                      {overloadHours > 0 ? `−${overloadHours.toFixed(0)}` : `+${(availableHours - scheduledHours).toFixed(0)}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-ink">{utilizationPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      {overloadHours > 0 ? (
                        <AlertTriangle className="w-5 h-5 text-ink mx-auto" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-ink mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="apple-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-muted flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Mill Utilization</h2>
              <p className="text-sm text-ink-secondary">Compare planned hours against available capacity</p>
            </div>
          </div>
        </div>
        {capacityData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-ink-tertiary text-sm">No capacity data</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <BarChart
              data={capacityData}
              width={700}
              height={400}
              margin={{ top: 16, right: 24, left: 16, bottom: 40 }}
              barCategoryGap="16%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
              <XAxis
                dataKey="mill_name"
                stroke="#6e6e73"
                fontSize={12}
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
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="available_hours"
                fill="#e5e5e7"
                name="Available"
                radius={[4, 4, 0, 0]}
                maxBarSize={72}
              />
              <Bar
                dataKey="scheduled_hours"
                fill="#B85C38"
                name="Planned"
                radius={[4, 4, 0, 0]}
                maxBarSize={72}
              />
            </BarChart>
          </div>
        )}
      </div>
    </div>
  );
}
