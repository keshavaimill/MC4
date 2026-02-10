'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import { AlertTriangle, CheckCircle } from 'lucide-react';
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
        <div className="h-8 w-8 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
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
        <div className="p-4 border-b border-border-soft">
          <h2 className="text-base font-semibold text-ink">Capacity Ledger</h2>
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
        <h2 className="text-base font-semibold text-ink mb-4">Mill Utilization</h2>
        {capacityData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-ink-tertiary text-sm">No capacity data</div>
        ) : (
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={capacityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e7" />
                <XAxis dataKey="mill_name" stroke="#86868b" fontSize={12} />
                <YAxis stroke="#86868b" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e5e7' }} />
                <Legend />
                <Bar dataKey="available_hours" fill="#e5e5e7" name="Available" radius={[4, 4, 0, 0]} />
                <Bar dataKey="scheduled_hours" fill="#B85C38" name="Planned" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
