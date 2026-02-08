'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RawMaterialsProps {
  horizon: 'week' | 'month' | 'year';
}

export default function RawMaterials({ horizon }: RawMaterialsProps) {
  const [rawMaterialData, setRawMaterialData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Group by country for chart (must be before useEffect)
  const chartData = React.useMemo(() => {
    if (!rawMaterialData || rawMaterialData.length === 0) {
      return [];
    }
    
    const grouped = rawMaterialData.reduce((acc: any, item: any) => {
      const key = item.period;
      if (!acc[key]) {
        acc[key] = { period: key };
      }
      acc[key][item.country] = item.wheat_price_sar_per_ton;
      return acc;
    }, {});

    const chartArray = Object.values(grouped).sort((a: any, b: any) => 
      a.period.localeCompare(b.period)
    );
    
    console.log('Chart data processed:', chartArray);
    return chartArray;
  }, [rawMaterialData]);

  const countries = React.useMemo(() => {
    return [...new Set(rawMaterialData.map((item) => item.country))].filter(Boolean);
  }, [rawMaterialData]);

  useEffect(() => {
    fetchData();
  }, [horizon]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/raw-material?horizon=${horizon}`);
      const data = response.data.data || [];
      setRawMaterialData(data);
      console.log('Raw material data received:', data);
    } catch (error) {
      console.error('Error fetching raw material data:', error);
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
        <h1 className="text-2xl font-bold text-gray-900">Raw Materials</h1>
        <p className="text-sm text-gray-500 mt-1">Wheat prices and availability by country</p>
      </div>

      {/* Price Chart */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Wheat Price by Country</h2>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <p className="text-sm font-medium mb-2">No raw material data available</p>
              <p className="text-xs">Data received: {rawMaterialData.length} items</p>
              <details className="mt-4 text-left max-w-md mx-auto">
                <summary className="cursor-pointer text-xs text-blue-600">Debug: View raw data</summary>
                <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
                  {JSON.stringify(rawMaterialData.slice(0, 5), null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ) : (
          <div className="w-full" style={{ height: '400px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                {countries.length > 0 ? (
                  countries.map((country, idx) => {
                    const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
                    return (
                      <Line
                        key={country}
                        type="monotone"
                        dataKey={country}
                        stroke={colors[idx % colors.length]}
                        strokeWidth={2}
                        name={country}
                      />
                    );
                  })
                ) : (
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    name="Price"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Price Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Current Prices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price (SAR/ton)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Availability (tons)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rawMaterialData
                .filter((item, idx, arr) => 
                  arr.findIndex((x) => x.country === item.country) === idx
                )
                .map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.country}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {item.wheat_price_sar_per_ton.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {item.availability_tons.toLocaleString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
