'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';

const LineChart = dynamic(() => import('recharts').then((mod) => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((mod) => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });

interface DemandForecastProps {
  horizon: 'week' | 'month' | 'year';
}

export default function DemandForecast({ horizon }: DemandForecastProps) {
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [horizon]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/forecast/sku?horizon=${horizon}`);
      setForecastData(response.data.data || []);
    } catch (error) {
      console.error('Error fetching forecast data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  // Group by flour type for chart
  const chartData = forecastData.reduce((acc: any, item: any) => {
    const key = item.period;
    if (!acc[key]) {
      acc[key] = { period: key };
    }
    acc[key][item.flour_type] = (acc[key][item.flour_type] || 0) + item.forecast_tons;
    return acc;
  }, {});

  const chartArray = Object.values(chartData).sort((a: any, b: any) => 
    a.period.localeCompare(b.period)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Demand & Forecast</h1>
        <p className="text-sm text-gray-500 mt-1">SKU-level forecasts aggregated by flour type</p>
      </div>

      {/* SKU Forecast Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">SKU Forecast</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flour Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Forecast (tons)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {forecastData.slice(0, 20).map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{item.sku_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.flour_type}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{item.forecast_tons.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Forecast Trend by Flour Type</h2>
        {chartArray.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p className="text-sm">No forecast data available</p>
          </div>
        ) : (
          <div className="w-full" style={{ height: '400px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Superior" stroke="#0ea5e9" strokeWidth={2} />
                <Line type="monotone" dataKey="Bakery" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="Patent" stroke="#f59e0b" strokeWidth={2} />
                <Line type="monotone" dataKey="Brown" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
