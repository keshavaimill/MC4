'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });
const ReferenceLine = dynamic(() => import('recharts').then((mod) => mod.ReferenceLine), { ssr: false });

interface ExecutiveOverviewProps {
  horizon: 'week' | 'month' | 'year';
}

interface KPIs {
  demand: { total_tons: number; growth_pct: number };
  recipe_time: { total_hours: number; utilization_pct: number };
  capacity: { utilization_pct: number; overload_mills: number };
  risk: { avg_wheat_price: number; price_change_pct: number };
}

export default function ExecutiveOverview({ horizon }: ExecutiveOverviewProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipeTimeData, setRecipeTimeData] = useState<any[]>([]);
  const [capacityData, setCapacityData] = useState<any[]>([]);

  // Prepare chart data - aggregate recipe time by recipe (must be before conditional returns)
  const chartData = React.useMemo(() => {
    if (!recipeTimeData || recipeTimeData.length === 0) {
      return [];
    }
    
    console.log('Processing recipe time data:', recipeTimeData.slice(0, 3));
    
    const aggregated = recipeTimeData
      .filter((item: any) => item && (item.recipe_name || item.recipe_id))
      .reduce((acc: any, item: any) => {
        const recipeName = item.recipe_name || item.recipe_id || 'Unknown';
        const hours = parseFloat(item.required_hours) || 0;
        const existing = acc.find((x: any) => x.recipe === recipeName);
        if (existing) {
          existing.hours += hours;
        } else {
          acc.push({
            recipe: recipeName,
            hours: hours,
          });
        }
        return acc;
      }, [])
      .sort((a: any, b: any) => b.hours - a.hours);
    
    console.log('Chart data after aggregation:', aggregated);
    return aggregated;
  }, [recipeTimeData]);

  // Calculate total available capacity
  const totalCapacity = React.useMemo(() => {
    return capacityData.reduce((sum: number, item: any) => {
      return sum + (item.available_hours || 0);
    }, 0);
  }, [capacityData]);

  useEffect(() => {
    fetchData();
  }, [horizon]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [kpisRes, recipeRes, capacityRes] = await Promise.all([
        axios.get(`/api/kpis/executive?horizon=${horizon}`),
        axios.get(`/api/planning/recipe?horizon=${horizon}`),
        axios.get(`/api/capacity/mill?horizon=${horizon}`),
      ]);

      setKpis(kpisRes.data);
      const recipeData = recipeRes.data.data || [];
      const capData = capacityRes.data.data || [];
      
      setRecipeTimeData(recipeData);
      setCapacityData(capData);
      
      console.log('Recipe time data:', recipeData);
      console.log('Capacity data:', capData);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!kpis) {
    return <div className="text-red-500">Error loading data</div>;
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Real-time view of demand, capacity, and operational health
        </p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Demand KPI */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Demand</h3>
            {kpis.demand.growth_pct >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {kpis.demand.total_tons.toLocaleString()} tons
          </div>
          <div className="text-sm mt-1">
            <span
              className={
                kpis.demand.growth_pct >= 0 ? 'text-green-600' : 'text-red-600'
              }
            >
              {kpis.demand.growth_pct >= 0 ? '↑' : '↓'}{Math.abs(kpis.demand.growth_pct).toFixed(1)}% MoM
            </span>
          </div>
        </div>

        {/* Recipe Time KPI */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Recipe Time</h3>
            <Settings className="w-5 h-5 text-mc4-blue" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {kpis.recipe_time.utilization_pct.toFixed(0)}%
          </div>
          <div className="text-sm mt-1 text-gray-600">
            {kpis.recipe_time.total_hours.toFixed(0)} hours used
          </div>
        </div>

        {/* Capacity KPI */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Capacity</h3>
            {kpis.capacity.overload_mills > 0 ? (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-green-500" />
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {kpis.capacity.utilization_pct.toFixed(0)}%
          </div>
          <div className="text-sm mt-1">
            {kpis.capacity.overload_mills > 0 ? (
              <span className="text-red-600">
                {kpis.capacity.overload_mills} mill(s) overloaded
              </span>
            ) : (
              <span className="text-green-600">All mills operational</span>
            )}
          </div>
        </div>

        {/* Risk KPI */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Wheat Price</h3>
            <DollarSign className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {kpis.risk.avg_wheat_price.toFixed(0)} SAR
          </div>
          <div className="text-sm mt-1 text-gray-600">per ton</div>
        </div>
      </div>

      {/* Recipe Time Chart */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recipe Time Demand vs Capacity
        </h2>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <p className="text-sm font-medium mb-2">No recipe time data available</p>
              <p className="text-xs">Recipe data received: {recipeTimeData.length} items</p>
              <p className="text-xs">Chart data processed: {chartData.length} items</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full" style={{ height: '400px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="recipe" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hours" fill="#0ea5e9" name="Required Hours" />
                  {totalCapacity > 0 && chartData.length > 0 && (
                    <ReferenceLine 
                      y={totalCapacity / chartData.length} 
                      stroke="#ef4444" 
                      strokeDasharray="5 5"
                      label={{ value: 'Avg Capacity', position: 'right' }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Debug table - remove in production */}
            <details className="mt-4">
              <summary className="text-xs text-gray-500 cursor-pointer">Debug: View chart data</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2">Recipe</th>
                      <th className="border p-2">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="border p-2">{item.recipe}</td>
                        <td className="border p-2">{item.hours.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>

      {/* AI Insight Panel */}
      <div className="bg-gradient-to-r from-mc4-blue to-mc4-dark rounded-lg shadow p-6 text-white">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🧠</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">AI Insight</h3>
            <p className="text-sm opacity-90">
              {kpis.demand.growth_pct > 0
                ? `Demand is up ${kpis.demand.growth_pct.toFixed(1)}% this ${horizon}. Recipe time utilization is at ${kpis.recipe_time.utilization_pct.toFixed(0)}%. ${
                    kpis.capacity.overload_mills > 0
                      ? `⚠️ ${kpis.capacity.overload_mills} mill(s) are overloaded and may need schedule adjustments.`
                      : 'All mills are operating within capacity.'
                  }`
                : `Demand trends are stable. Current recipe time allocation is optimal.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
