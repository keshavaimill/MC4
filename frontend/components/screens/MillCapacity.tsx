'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });

interface MillCapacityProps {
  horizon: 'week' | 'month' | 'year';
}

export default function MillCapacity({ horizon }: MillCapacityProps) {
  const [capacityData, setCapacityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [horizon]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/capacity/mill?horizon=${horizon}`);
      setCapacityData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mill Capacity</h1>
        <p className="text-sm text-gray-500 mt-1">Mill utilization and capacity planning</p>
      </div>

      {/* Capacity Ledger */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Capacity Ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mill</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available (hrs)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned (hrs)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Utilization</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {capacityData.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.mill_name}</td>
                  <td className="px-4 py-3 text-sm text-right">{item.available_hours.toFixed(0)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{item.required_hours.toFixed(0)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${
                    item.overload_hours > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {item.overload_hours > 0 ? `-${item.overload_hours.toFixed(0)}` : `+${(item.available_hours - item.required_hours).toFixed(0)}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`font-medium ${
                      item.utilization_pct > 100 ? 'text-red-600' : 
                      item.utilization_pct > 90 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {item.utilization_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.overload_hours > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-red-500 mx-auto" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Utilization Chart */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Mill Utilization</h2>
        {capacityData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p className="text-sm">No capacity data available</p>
          </div>
        ) : (
          <div className="w-full" style={{ height: '400px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={capacityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mill_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="available_hours" fill="#cbd5e1" name="Available Hours" />
                <Bar dataKey="required_hours" fill="#0ea5e9" name="Required Hours" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
