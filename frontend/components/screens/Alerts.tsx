'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AlertsProps {
  horizon: 'week' | 'month' | 'year';
}

export default function Alerts({ horizon }: AlertsProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [horizon]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/alerts?horizon=${horizon}`);
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'capacity_overload':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-500 bg-red-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alerts & Actions</h1>
        <p className="text-sm text-gray-500 mt-1">Capacity and planning alerts</p>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear</h3>
          <p className="text-sm text-gray-500">No alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`bg-white rounded-lg shadow border-l-4 p-6 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start space-x-4">
                {getIcon(alert.type)}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{alert.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{alert.message}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Type: {alert.type}</span>
                    <span>•</span>
                    <span>Period: {alert.period}</span>
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
