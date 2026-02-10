'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getPeriodFromDate } from '@/lib/period';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AlertsProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

export default function Alerts({ horizon, fromDate, toDate }: AlertsProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => getPeriodFromDate(fromDate ?? '', horizon), [fromDate, horizon]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/alerts?horizon=${horizon}&period=${encodeURIComponent(period)}`);
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
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

  const getIcon = (type: string) => {
    switch (type) {
      case 'capacity_overload':
        return <AlertTriangle className="w-5 h-5 text-ink shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-ink-secondary shrink-0" />;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="screen-title">Alerts & Actions</h1>
        <p className="screen-subtitle">Capacity and planning alerts</p>
      </div>

      {alerts.length === 0 ? (
        <div className="apple-card p-12 text-center">
          <CheckCircle className="w-12 h-12 text-brand mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink mb-2">All clear</h3>
          <p className="text-sm text-ink-secondary">No alerts for this period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className="apple-card p-6 border-l-4 border-l-brand"
            >
              <div className="flex items-start gap-4">
                {getIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ink mb-1">{alert.title}</h3>
                  <p className="text-sm text-ink-secondary mb-3">{alert.message}</p>
                  <div className="flex items-center gap-3 text-xs text-ink-tertiary">
                    <span>{alert.type}</span>
                    <span>·</span>
                    <span>{alert.period}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
