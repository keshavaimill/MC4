import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { Package, DollarSign, Globe, AlertTriangle, BarChart3 } from 'lucide-react';
import WheatOriginMap from '@/components/WheatOriginMap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface RawMaterialsProps {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

export default function RawMaterials({ fromDate, toDate, scenario = 'base' }: RawMaterialsProps) {
  const [rawMaterialData, setRawMaterialData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMounted, setChartMounted] = useState(false);

  useEffect(() => {
    setChartMounted(true);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate, scenario]);

  const [backendKpis, setBackendKpis] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');
      const scenarioParam = scenario || 'base';
      const [rmRes, kpiRes] = await Promise.all([
        axios.get(`/api/raw-material?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
        axios.get(`/api/kpis/raw-materials?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
      ]);
      setRawMaterialData(rmRes.data.data || []);
      setBackendKpis(kpiRes.data);
    } catch (error) {
      console.error('Error fetching raw material data:', error);
    } finally {
      setLoading(false);
    }
  };

  // KPIs — prefer backend values
  const kpiValues = useMemo(() => {
    if (backendKpis) {
      return {
        totalReq: `${(backendKpis.total_wheat_requirement_tons / 1000).toFixed(0)}k tons`,
        avgCost: `${(backendKpis.avg_wheat_cost_sar / 1000).toFixed(2)}k SAR`,
        importDependency: `${backendKpis.import_dependency_pct}%`,
        highRisk: `${backendKpis.high_risk_supply_pct}%`,
        yieldVariability: backendKpis.yield_variability_index > 0.12 ? 'High' : backendKpis.yield_variability_index > 0.08 ? 'Medium' : 'Low',
      };
    }
    const totalAvail = rawMaterialData.reduce((s, d) => s + (Number(d.availability_tons) || 0), 0);
    const countries = [...new Set(rawMaterialData.map((d) => d.country))];
    // Saudi Arabia imports 100% of wheat (domestic farming phased out by 2016)
    const importCountries = countries;
    const importPct = countries.length > 0 ? Math.round((importCountries.length / countries.length) * 100) : 0;
    return {
      totalReq: `${(totalAvail / 1000).toFixed(0)}k tons`,
      avgCost: '+6.2%',
      importDependency: `${importPct}%`,
      highRisk: '18%',
      yieldVariability: 'Medium',
    };
  }, [rawMaterialData, backendKpis]);

  const kpis = [
    { label: 'Total Wheat Req.', value: kpiValues.totalReq, icon: Package, color: 'text-primary', bgColor: 'bg-accent' },
    { label: 'Avg Wheat Cost', value: kpiValues.avgCost, icon: DollarSign, color: 'text-red-600', bgColor: 'bg-red-50' },
    { label: 'Import Dependency', value: kpiValues.importDependency, icon: Globe, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'High-Risk Share', value: kpiValues.highRisk, icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Yield Variability', value: kpiValues.yieldVariability, icon: BarChart3, color: 'text-brown-600', bgColor: 'bg-brown-100' },
  ];

  // Chart data
  const chartData = useMemo(() => {
    const grouped = rawMaterialData.reduce((acc: any, item: any) => {
      const key = item.period;
      if (!key) return acc;
      if (!acc[key]) acc[key] = { period: key };
      const country = item.country || 'Unknown';
      acc[key][country] = Number(item.wheat_price_sar_per_ton) || 0;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => {
      const dA = new Date(a.period), dB = new Date(b.period);
      return (!isNaN(dA.getTime()) && !isNaN(dB.getTime())) ? dA.getTime() - dB.getTime() : (a.period || '').localeCompare(b.period || '');
    });
  }, [rawMaterialData]);

  const countries = useMemo(() => {
    return [...new Set(rawMaterialData.map((d) => d.country).filter(Boolean))].sort();
  }, [rawMaterialData]);

  // Wheat → Recipe Sensitivity table
  const sensitivityData = [
    { wheat: 'Hard Red', recipes: '80 Straight', yield: 'High', cost: 'High', waste: 'Low' },
    { wheat: 'Soft White', recipes: '55 Pastry', yield: 'Medium', cost: 'Medium', waste: 'Medium' },
    { wheat: 'Durum', recipes: '72 Extraction', yield: 'High', cost: 'High', waste: 'Low' },
    { wheat: 'Hard White', recipes: '80/70 Blend', yield: 'Medium', cost: 'Medium', waste: 'Low' },
    { wheat: 'Soft Red', recipes: '90 Whole Wheat', yield: 'Low', cost: 'Low', waste: 'High' },
  ];

  // Wheat Origin Map data (for real Leaflet map)
  const { mapOrigins, mapTotalVolume, mapAvgCostAll } = useMemo(() => {
    const countryAgg: Record<string, { volume: number; totalPrice: number; count: number }> = {};
    rawMaterialData.forEach((d) => {
      const c = d.country || 'Unknown';
      if (!countryAgg[c]) countryAgg[c] = { volume: 0, totalPrice: 0, count: 0 };
      countryAgg[c].volume += Number(d.availability_tons) || 0;
      countryAgg[c].totalPrice += Number(d.wheat_price_sar_per_ton) || 0;
      countryAgg[c].count += 1;
    });
    const origins = Object.entries(countryAgg).map(([country, data]) => ({
      country,
      volume: data.volume,
      avgCost: data.count > 0 ? data.totalPrice / data.count : 0,
    }));
    const total = origins.reduce((s, o) => s + o.volume, 0);
    const avg = origins.length > 0 ? origins.reduce((s, o) => s + o.avgCost, 0) / origins.length : 0;
    return { mapOrigins: origins, mapTotalVolume: total, mapAvgCostAll: avg };
  }, [rawMaterialData]);

  const colorPalette = ['hsl(var(--primary))', 'hsl(var(--logo-gold))', 'hsl(var(--logo-brown))', '#8d6e63', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-brown-500">
          <div className="h-5 w-5 rounded-full border-2 border-brown-300 border-t-primary animate-spin" />
          <span>Loading raw materials…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Raw Materials & Wheat Origins</h1>
        <p className="text-sm text-brown-600 mt-1">Understand upstream impact of recipe decisions</p>
      </div>

      {/* 6.1 KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
              <div className="text-lg font-bold text-brown-800">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* 6.2 Wheat Origin Map (interactive real map) */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
        <h2 className="text-lg font-semibold text-brown-800 mb-4">Wheat Origin Map</h2>
        <p className="text-sm text-brown-600 mb-3">Global sourcing by volume and cost</p>
        <WheatOriginMap
          origins={mapOrigins}
          totalVolume={mapTotalVolume}
          avgCostAll={mapAvgCostAll}
          height={400}
        />
      </div>

      {/* Price Chart */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
        <h2 className="text-lg font-semibold mb-4 text-brown-800">Wheat Price by Country</h2>
        {chartMounted && chartData.length > 0 && countries.length > 0 ? (() => {
          const dataLength = chartData.length;
          const chartWidth = Math.max(700, Math.min(dataLength * 80, window.innerWidth * 0.8));
          return (
            <div className="w-full overflow-x-auto">
              <LineChart data={chartData} width={chartWidth} height={400} margin={{ top: 20, right: 30, left: 60, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" opacity={0.5} />
                <XAxis dataKey="period" tick={{ fill: 'hsl(var(--logo-brown))', fontSize: 10 }} angle={dataLength > 12 ? -45 : 0} textAnchor={dataLength > 12 ? 'end' : 'middle'} />
                <YAxis tick={{ fill: 'hsl(var(--logo-brown))', fontSize: 11 }} tickFormatter={(v) => `${v.toLocaleString()} SAR`} label={{ value: 'Price (SAR/ton)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--logo-brown))', style: { fontSize: 12, fontWeight: 600 } }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #8d6e63', borderRadius: '8px', padding: '8px' }} formatter={(value: any) => [`${typeof value === 'number' ? value.toFixed(2) : value} SAR`]} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: '12px' }} />
                {countries.map((country, idx) => (
                  <Line key={country} type="monotone" dataKey={country} stroke={colorPalette[idx % colorPalette.length]} strokeWidth={2.5} dot={{ fill: colorPalette[idx % colorPalette.length], r: 3 }} name={country} connectNulls={false} />
                ))}
              </LineChart>
            </div>
          );
        })() : (
          <div className="flex items-center justify-center h-[300px] text-brown-500 text-sm">No price data available</div>
        )}
      </div>

      {/* 6.3 Wheat → Recipe Sensitivity */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 overflow-hidden">
        <div className="p-4 border-b border-brown-200 bg-gradient-to-r from-brown-50 to-white">
          <h2 className="text-lg font-semibold text-brown-800">Wheat → Recipe Sensitivity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brown-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-brown-600 uppercase">Wheat Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-brown-600 uppercase">Recipes</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">Yield</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">Cost</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">Waste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-100">
              {sensitivityData.map((row, idx) => (
                <tr key={idx} className="hover:bg-brown-50">
                  <td className="px-4 py-3 text-sm font-medium text-brown-800">{row.wheat}</td>
                  <td className="px-4 py-3 text-sm text-brown-700">{row.recipes}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      row.yield === 'High' ? 'bg-green-100 text-green-700' :
                      row.yield === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{row.yield}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      row.cost === 'High' ? 'bg-red-100 text-red-700' :
                      row.cost === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>{row.cost}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      row.waste === 'High' ? 'bg-red-100 text-red-700' :
                      row.waste === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>{row.waste}</span>
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
