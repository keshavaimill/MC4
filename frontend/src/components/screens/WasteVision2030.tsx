import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import { TrendingDown, Target, Zap, Droplets, Leaf, ArrowDown, ArrowUp } from 'lucide-react';

interface WasteVision2030Props {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

export default function WasteVision2030({ fromDate, toDate, scenario = 'base' }: WasteVision2030Props) {
  const [chartMounted, setChartMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [wasteData, setWasteData] = useState<any[]>([]);

  useEffect(() => {
    setChartMounted(true);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate, scenario]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');

      const [kpiRes, wasteRes] = await Promise.all([
        axios.get(`/api/kpis/sustainability?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenario || 'base'}`),
        axios.get(`/api/waste-metrics?from_date=${fromDateStr}&to_date=${toDateStr}`),
      ]);

      setKpiData(kpiRes.data);
      setWasteData(wasteRes.data.data || []);
    } catch (error) {
      console.error('Error fetching waste data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Compute heatmap from API data
  const recipes = useMemo(() => [...new Set(wasteData.map((d: any) => d.recipe_name || d.recipe_id).filter(Boolean))], [wasteData]);
  const mills = useMemo(() => [...new Set(wasteData.map((d: any) => d.mill_name || d.mill_id).filter(Boolean))], [wasteData]);

  const wasteHeatmapData = useMemo(() => {
    // Average waste per recipe × mill
    const lookup: Record<string, { total: number; count: number }> = {};
    wasteData.forEach((d: any) => {
      const key = `${d.recipe_name || d.recipe_id}|${d.mill_name || d.mill_id}`;
      if (!lookup[key]) lookup[key] = { total: 0, count: 0 };
      lookup[key].total += Number(d.waste_pct) || 0;
      lookup[key].count += 1;
    });
    return lookup;
  }, [wasteData]);

  // Trend data (monthly average waste)
  const trendData = useMemo(() => {
    const monthly: Record<string, { total: number; count: number }> = {};
    wasteData.forEach((d: any) => {
      const p = d.period || 'Unknown';
      if (!monthly[p]) monthly[p] = { total: 0, count: 0 };
      monthly[p].total += Number(d.waste_pct) || 0;
      monthly[p].count += 1;
    });
    return Object.entries(monthly)
      .map(([period, data]) => ({
        month: period,
        waste_pct: Math.round((data.total / data.count) * 100) / 100,
        target: kpiData?.waste_target_pct || 3.9,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [wasteData, kpiData]);

  // Recipe-level waste for bar chart
  const recipeWaste = useMemo(() => {
    const grouped: Record<string, { total: number; count: number }> = {};
    wasteData.forEach((d: any) => {
      const recipe = d.recipe_name || d.recipe_id || 'Unknown';
      if (!grouped[recipe]) grouped[recipe] = { total: 0, count: 0 };
      grouped[recipe].total += Number(d.waste_pct) || 0;
      grouped[recipe].count += 1;
    });
    return Object.entries(grouped)
      .map(([recipe, g]) => ({ recipe, waste_pct: Math.round((g.total / g.count) * 100) / 100 }))
      .sort((a, b) => b.waste_pct - a.waste_pct);
  }, [wasteData]);

  const avgWaste = kpiData?.waste_rate_pct ?? (wasteData.length > 0
    ? (wasteData.reduce((s: number, d: any) => s + (Number(d.waste_pct) || 0), 0) / wasteData.length).toFixed(1)
    : '4.2');

  const wasteTarget = kpiData?.waste_target_pct ?? 3.9;
  const energyPerTon = kpiData?.energy_per_ton ?? 55;
  const waterPerTon = kpiData?.water_per_ton ?? 0.7;
  const v2030Score = kpiData?.vision_2030_score ?? 78;

  const getHeatColor = (value: number) => {
    if (value <= 3.0) return 'bg-green-100 text-green-800';
    if (value <= 4.0) return 'bg-green-200 text-green-900';
    if (value <= 5.0) return 'bg-amber-100 text-amber-800';
    if (value <= 6.0) return 'bg-amber-200 text-amber-900';
    return 'bg-red-200 text-red-900';
  };

  // KPIs
  const kpis = [
    { label: 'Waste Rate', value: `${Number(avgWaste).toFixed(1)}%`, delta: `${Number(avgWaste) <= wasteTarget ? '−' : '+'}${Math.abs(Number(avgWaste) - wasteTarget).toFixed(3)}%`, driver: Number(avgWaste) <= wasteTarget ? 'On target' : 'Above target', icon: TrendingDown, color: Number(avgWaste) <= wasteTarget ? 'text-green-600' : 'text-red-600', bgColor: Number(avgWaste) <= wasteTarget ? 'bg-green-50' : 'bg-red-50' },
    { label: 'Target', value: `${wasteTarget}%`, delta: '', driver: 'Vision 2030', icon: Target, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { label: 'Energy / Ton', value: `${energyPerTon.toFixed(1)} kWh`, delta: '', driver: 'Efficiency', icon: Zap, color: energyPerTon < 50 ? 'text-green-600' : 'text-amber-600', bgColor: energyPerTon < 50 ? 'bg-green-50' : 'bg-amber-50' },
    { label: 'Water / Ton', value: `${waterPerTon.toFixed(2)} m³`, delta: '', driver: 'Conservation', icon: Droplets, color: waterPerTon < 0.6 ? 'text-green-600' : 'text-blue-600', bgColor: waterPerTon < 0.6 ? 'bg-green-50' : 'bg-blue-50' },
    { label: 'Vision 2030 Index', value: `${v2030Score}`, delta: '', driver: 'Waste & Energy', icon: Leaf, color: v2030Score >= 75 ? 'text-green-600' : 'text-amber-600', bgColor: v2030Score >= 75 ? 'bg-green-50' : 'bg-amber-50' },
  ];

  const chartWidth = Math.max(600, Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.65 : 900, 900));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-brown-500">
          <div className="h-5 w-5 rounded-full border-2 border-brown-300 border-t-orange-500 animate-spin" />
          <span>Loading waste & sustainability data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Waste & Vision 2030</h1>
        <p className="text-sm text-brown-600 mt-1">Track sustainability at recipe & mill level</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-lg shadow-md p-4 border border-brown-200 hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-brown-600 uppercase tracking-wide">{kpi.label}</h3>
                <div className={`w-7 h-7 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-brown-800">{kpi.value}</div>
              {kpi.delta && (
                <div className="flex items-center space-x-1 mt-1">
                  {kpi.delta.startsWith('−') || kpi.delta.startsWith('-') ? (
                    <ArrowDown className="w-3 h-3 text-green-500" />
                  ) : (
                    <ArrowUp className="w-3 h-3 text-green-500" />
                  )}
                  <span className="text-xs font-medium text-green-600">{kpi.delta}</span>
                  <span className="text-xs text-brown-500">• {kpi.driver}</span>
                </div>
              )}
              {!kpi.delta && kpi.driver && (
                <div className="text-xs text-brown-500 mt-1">{kpi.driver}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Waste by Recipe & Mill - Heatmap Table */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
        <h2 className="text-lg font-semibold text-brown-800 mb-4">Waste by Recipe & Mill (Heatmap)</h2>
        {recipes.length > 0 && mills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-brown-600 uppercase">Recipe</th>
                  {mills.map((mill) => (
                    <th key={mill} className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">
                      {mill}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brown-100">
                {recipes.map((recipe) => (
                  <tr key={recipe}>
                    <td className="px-4 py-3 text-sm font-medium text-brown-800">{recipe}</td>
                    {mills.map((mill) => {
                      const key = `${recipe}|${mill}`;
                      const data = wasteHeatmapData[key];
                      const val = data ? data.total / data.count : 0;
                      return (
                        <td key={mill} className="px-4 py-3 text-center">
                          <span className={`inline-block px-3 py-1 rounded-md text-xs font-bold ${getHeatColor(val)}`}>
                            {val.toFixed(1)}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-brown-500 text-sm">
            No waste data available for this period
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waste Trend vs Target - Line Chart */}
        <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <h2 className="text-lg font-semibold text-brown-800 mb-4">Waste Trend vs Target</h2>
          {chartMounted && trendData.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <LineChart
                data={trendData}
                width={Math.min(chartWidth, 550)}
                height={350}
                margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" opacity={0.5} />
                <XAxis dataKey="month" tick={{ fill: '#5d4037', fontSize: 11 }} tickLine={{ stroke: '#8d6e63' }} />
                <YAxis
                  tick={{ fill: '#5d4037', fontSize: 11 }}
                  tickLine={{ stroke: '#8d6e63' }}
                  domain={[0, 'auto']}
                  label={{ value: 'Waste %', angle: -90, position: 'insideLeft', fill: '#5d4037', style: { fontSize: 12, fontWeight: 600 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #8d6e63', borderRadius: '8px', padding: '8px' }}
                  formatter={(value: any) => [`${value}%`]}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: '8px' }} />
                <ReferenceLine y={wasteTarget} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Target ${wasteTarget}%`, fill: '#ef4444', fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="waste_pct"
                  stroke="#FF8C42"
                  strokeWidth={3}
                  dot={{ fill: '#FF8C42', r: 4 }}
                  name="Actual Waste %"
                />
              </LineChart>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-brown-500 text-sm">
              {!chartMounted ? 'Loading chart…' : 'No trend data available'}
            </div>
          )}
        </div>

        {/* Waste by Recipe - Bar Chart */}
        <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <h2 className="text-lg font-semibold text-brown-800 mb-4">Avg Waste by Recipe</h2>
          {chartMounted && recipeWaste.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <BarChart
                data={recipeWaste}
                width={Math.min(chartWidth, 550)}
                height={350}
                margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                layout="horizontal"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" opacity={0.5} />
                <XAxis
                  dataKey="recipe"
                  tick={{ fill: '#5d4037', fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: '#5d4037', fontSize: 11 }}
                  label={{ value: 'Waste %', angle: -90, position: 'insideLeft', fill: '#5d4037', style: { fontSize: 12, fontWeight: 600 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #8d6e63', borderRadius: '8px', padding: '8px' }}
                  formatter={(value: any) => [`${value}%`]}
                />
                <ReferenceLine y={wasteTarget} stroke="#ef4444" strokeDasharray="5 5" />
                <Bar dataKey="waste_pct" name="Waste %" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {recipeWaste.map((entry: any, idx: number) => (
                    <Cell
                      key={idx}
                      fill={entry.waste_pct > 5.0 ? '#ef4444' : entry.waste_pct > wasteTarget ? '#f59e0b' : '#22c55e'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-brown-500 text-sm">
              {!chartMounted ? 'Loading chart…' : 'No recipe waste data'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
