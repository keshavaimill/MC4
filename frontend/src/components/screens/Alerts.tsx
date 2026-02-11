import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  Bell,
  ShieldAlert,
  Clock,
  ThumbsUp,
  Play,
  Info,
} from 'lucide-react';

interface AlertsProps {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

export default function Alerts({ fromDate, toDate, scenario = 'base' }: AlertsProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');
      const response = await axios.get(`/api/alerts?from_date=${fromDateStr}&to_date=${toDateStr}`);
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // KPI values
  const kpiValues = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === 'high').length;
    return {
      openAlerts: alerts.length,
      critical,
      avgResolutionTime: '1.4 days',
      acceptedRisks: Math.max(0, Math.floor(alerts.length * 0.15)),
    };
  }, [alerts]);

  const kpis = [
    { label: 'Open Alerts', value: `${kpiValues.openAlerts}`, icon: Bell, color: kpiValues.openAlerts > 5 ? 'text-red-600' : 'text-amber-600', bgColor: kpiValues.openAlerts > 5 ? 'bg-red-50' : 'bg-amber-50' },
    { label: 'Critical', value: `${kpiValues.critical}`, icon: ShieldAlert, color: kpiValues.critical > 0 ? 'text-red-600' : 'text-green-600', bgColor: kpiValues.critical > 0 ? 'bg-red-50' : 'bg-green-50' },
    { label: 'Avg Resolution Time', value: kpiValues.avgResolutionTime, icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Accepted Risks', value: `${kpiValues.acceptedRisks}`, icon: ThumbsUp, color: 'text-green-600', bgColor: 'bg-green-50' },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-amber-500 bg-amber-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const getConfidence = (severity: string) => {
    switch (severity) {
      case 'high': return 'High';
      case 'medium': return 'Medium';
      default: return 'Low';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-brown-500">
          <div className="h-5 w-5 rounded-full border-2 border-brown-300 border-t-orange-500 animate-spin" />
          <span>Loading alerts…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Alerts & Decisions</h1>
        <p className="text-sm text-brown-600 mt-1">Turn insights into actions</p>
      </div>

      {/* 9.1 KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-white rounded-lg shadow-md p-4 border border-brown-200 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-medium text-brown-600 uppercase tracking-wide">{kpi.label}</h3>
                <div className={`w-7 h-7 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-brown-800">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* 9.2 Alert Register Table */}
      {alerts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-brown-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-brown-800 mb-2">All Clear</h3>
          <p className="text-sm text-brown-600">No alerts at this time</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md border border-brown-200 overflow-hidden">
          <div className="p-4 border-b border-brown-200 bg-gradient-to-r from-brown-50 to-white">
            <h2 className="text-lg font-semibold text-brown-800">Alert Register</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brown-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-brown-600 uppercase">Alert</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-brown-600 uppercase">Cause</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-brown-600 uppercase">Impact (hrs)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brown-100">
                {alerts.map((alert, idx) => {
                  // Parse overload hours from message
                  const hoursMatch = alert.message?.match(/([\d.]+)\s*hours/);
                  const impactHours = hoursMatch ? hoursMatch[1] : '—';
                  return (
                    <tr key={idx} className={`hover:bg-brown-50 ${alert.severity === 'high' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {alert.severity === 'high' ? (
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-brown-800">{alert.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-brown-600">Recipe mix</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-red-600">−{impactHours}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          alert.severity === 'high' ? 'bg-red-100 text-red-700' :
                          alert.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {getConfidence(alert.severity)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="inline-flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg text-xs font-medium hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm">
                          <Play className="w-3 h-3" />
                          <span>Resolve</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alert Detail Cards (for richer context) */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-brown-800">Alert Details</h2>
          {alerts.slice(0, 5).map((alert, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-lg shadow-sm border-l-4 p-5 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start space-x-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${alert.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-brown-800 mb-1">{alert.title}</h3>
                  <p className="text-sm text-brown-600 mb-2">{alert.message}</p>
                  <div className="flex items-center space-x-4 text-xs text-brown-500">
                    <span>Type: {alert.type}</span>
                    <span>•</span>
                    <span>Period: {alert.period}</span>
                    <span>•</span>
                    <span>Severity: <span className={`font-medium ${alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`}>{alert.severity}</span></span>
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
