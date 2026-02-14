import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { AlertTriangle, Check, Factory, Clock, Settings, ArrowUpDown, Shield } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

interface MillCapacityProps {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

// Gantt recipe colors
const RECIPE_COLORS: Record<string, string> = {
  '80 Straight': 'hsl(var(--primary))',
  '80/70 Blend': 'hsl(var(--logo-brown))',
  '72 Extraction': '#0ea5e9',
  '55 Pastry': '#10b981',
  '90 Whole Wheat': '#f59e0b',
  'Default': '#8d6e63',
};

const getRecipeColor = (name: string) => {
  for (const [key, color] of Object.entries(RECIPE_COLORS)) {
    if (name.includes(key) || name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return RECIPE_COLORS['Default'];
};

export default function MillCapacity({ fromDate, toDate, scenario = 'base' }: MillCapacityProps) {
  const [capacityData, setCapacityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMounted, setChartMounted] = useState(false);
  const [showResolution, setShowResolution] = useState<string | null>(null);

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
      const [capRes, kpiRes] = await Promise.all([
        axios.get(`/api/capacity/mill?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
        axios.get(`/api/kpis/mill-operations?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
      ]);
      setCapacityData(capRes.data.data || []);
      setBackendKpis(kpiRes.data);
    } catch (error) {
      console.error('Error fetching capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  // KPIs — prefer backend, fallback to local computation
  const kpiValues = useMemo(() => {
    if (backendKpis) {
      return {
        utilization: backendKpis.mill_utilization_pct,
        totalOverload: backendKpis.overload_hours,
        recipeSwitches: backendKpis.recipe_switch_count,
        avgRunDays: String(backendKpis.avg_run_length_days),
        downtimeRisk: backendKpis.downtime_risk_score,
      };
    }
    const totalScheduled = capacityData.reduce((s, d) => s + (Number(d.scheduled_hours) || 0), 0);
    const totalAvailable = capacityData.reduce((s, d) => s + (Number(d.available_hours) || 0), 0);
    const totalOverload = capacityData.reduce((s, d) => s + (Number(d.overload_hours) || 0), 0);
    const utilization = totalAvailable > 0 ? (totalScheduled / totalAvailable * 100) : 0;
    const uniqueMills = new Set(capacityData.map((d) => d.mill_id)).size;
    const recipeSwitches = uniqueMills * 2 + 1;
    const avgRunDays = totalScheduled > 0 ? (totalScheduled / 24 / recipeSwitches).toFixed(1) : '0';
    return { utilization, totalOverload, recipeSwitches, avgRunDays, downtimeRisk: totalOverload > 10 ? 80 : totalOverload > 0 ? 40 : 10 };
  }, [capacityData, backendKpis]);

  const kpis = [
    { label: 'Mill Utilization', value: `${kpiValues.utilization.toFixed(0)}%`, icon: Factory, color: kpiValues.utilization > 95 ? 'text-red-600' : kpiValues.utilization > 90 ? 'text-amber-600' : 'text-green-600', bgColor: kpiValues.utilization > 95 ? 'bg-red-50' : kpiValues.utilization > 90 ? 'bg-amber-50' : 'bg-green-50' },
    { label: 'Overload Hours', value: `${kpiValues.totalOverload.toFixed(0)} hrs`, icon: AlertTriangle, color: kpiValues.totalOverload > 0 ? 'text-red-600' : 'text-green-600', bgColor: kpiValues.totalOverload > 0 ? 'bg-red-50' : 'bg-green-50' },
    { label: 'Recipe Switches', value: `${kpiValues.recipeSwitches}`, icon: ArrowUpDown, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Avg Run Length', value: `${kpiValues.avgRunDays} days`, icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Downtime Risk', value: (kpiValues.downtimeRisk ?? 0) > 60 ? 'High' : (kpiValues.downtimeRisk ?? 0) > 30 ? 'Medium' : 'Low', icon: Shield, color: (kpiValues.downtimeRisk ?? 0) > 60 ? 'text-red-600' : (kpiValues.downtimeRisk ?? 0) > 30 ? 'text-amber-600' : 'text-green-600', bgColor: (kpiValues.downtimeRisk ?? 0) > 60 ? 'bg-red-50' : (kpiValues.downtimeRisk ?? 0) > 30 ? 'bg-amber-50' : 'bg-green-50' },
  ];

  // Gantt data (simulated from capacity data)
  const ganttData = useMemo(() => {
    const mills = [...new Set(capacityData.map((d) => d.mill_name || `Mill ${d.mill_id}`))];
    const recipeNames = ['80 Straight', '80/70 Blend', '72 Extraction', '55 Pastry', '90 Whole Wheat'];
    return mills.map((mill) => {
      const blocks: any[] = [];
      let dayOffset = 0;
      const numRecipes = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numRecipes && dayOffset < 30; i++) {
        const duration = 3 + Math.floor(Math.random() * 8);
        const recipe = recipeNames[i % recipeNames.length];
        blocks.push({
          recipe,
          startDay: dayOffset,
          duration: Math.min(duration, 30 - dayOffset),
          tons: Math.round(duration * 24 * 25),
          wheat: ['Hard', 'Soft', 'Durum'][i % 3],
        });
        dayOffset += duration + 0.5; // changeover
      }
      return { mill, blocks };
    });
  }, [capacityData]);

  // Capacity Ledger (aggregated to days)
  const ledgerData = useMemo(() => {
    const grouped: Record<string, any> = {};
    capacityData.forEach((d) => {
      const mill = d.mill_name || `Mill ${d.mill_id}`;
      if (!grouped[mill]) {
        grouped[mill] = { mill, available: 0, planned: 0, overload: 0 };
      }
      grouped[mill].available += Number(d.available_hours) || 0;
      grouped[mill].planned += Number(d.scheduled_hours) || 0;
      grouped[mill].overload += Number(d.overload_hours) || 0;
    });
    return Object.values(grouped).map((d: any) => ({
      ...d,
      availableDays: Math.round(d.available / 24),
      plannedDays: Math.round(d.planned / 24),
      variance: Math.round((d.available - d.planned) / 24),
      status: d.overload > 0 ? 'overload' : 'ok',
    }));
  }, [capacityData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-brown-500">
          <div className="h-5 w-5 rounded-full border-2 border-brown-300 border-t-primary animate-spin" />
          <span>Loading mill capacity…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Mill Runtime & Sequencing</h1>
        <p className="text-sm text-brown-600 mt-1">Ensure feasibility under "one recipe at a time" constraint</p>
      </div>

      {/* 5.1 KPI Strip */}
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

      {/* 5.2 Mill Timeline (Gantt) */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
        <h2 className="text-lg font-semibold text-brown-800 mb-1">Mill Timeline (Gantt)</h2>
        <p className="text-xs text-brown-500 mb-4">Blocks = Recipes per mill across the month</p>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day header */}
            <div className="flex items-center mb-2 ml-24">
              {Array.from({ length: 30 }, (_, i) => (
                <div key={i} className="flex-1 text-center text-[9px] text-brown-400 font-medium">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Mill rows */}
            {ganttData.map((row) => (
              <div key={row.mill} className="flex items-center mb-2">
                <div className="w-24 text-sm font-medium text-brown-800 flex-shrink-0 pr-2">{row.mill}</div>
                <div className="flex-1 relative h-8 bg-brown-50 rounded border border-brown-200">
                  {row.blocks.map((block: any, idx: number) => {
                    const left = (block.startDay / 30) * 100;
                    const width = (block.duration / 30) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute top-0.5 bottom-0.5 rounded-md flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: getRecipeColor(block.recipe),
                        }}
                        title={`${block.recipe}\n${block.tons} tons planned\nWheat: ${block.wheat}`}
                      >
                        <span className="text-[9px] font-bold text-white truncate px-1">
                          {block.recipe.length > 12 ? block.recipe.substring(0, 10) + '…' : block.recipe}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mt-3 ml-24">
              {Object.entries(RECIPE_COLORS).filter(([k]) => k !== 'Default').map(([name, color]) => (
                <div key={name} className="flex items-center space-x-1">
                  <div className="flex items-center">
                    {/* Left bar */}
                    <div
                      className="w-1.5 h-1 rounded-l"
                      style={{ backgroundColor: color }}
                    />
                    {/* Circle with white center */}
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    {/* Right bar */}
                    <div
                      className="w-1.5 h-1 rounded-r"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <span className="text-[10px] text-brown-600">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5.3 Capacity Ledger */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 overflow-hidden">
        <div className="p-4 border-b border-brown-200 bg-gradient-to-r from-brown-50 to-white">
          <h2 className="text-lg font-semibold text-brown-800">Capacity Ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brown-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-brown-600 uppercase">Mill</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-brown-600 uppercase">Available Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-brown-600 uppercase">Planned Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-brown-600 uppercase">Variance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-100">
              {ledgerData.map((item: any, idx: number) => (
                <React.Fragment key={idx}>
                  <tr className="hover:bg-brown-50">
                    <td className="px-4 py-3 text-sm font-medium text-brown-800">{item.mill}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.availableDays}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{item.plannedDays}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.variance >= 0 ? `+${item.variance}` : item.variance}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.status === 'overload' ? (
                        <button
                          onClick={() => setShowResolution(showResolution === item.mill ? null : item.mill)}
                          className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent"
                          title="Click for resolution suggestions"
                        >
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md p-1 hover:bg-accent"
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {showResolution === item.mill && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 bg-red-50 border-l-4 border-red-400">
                        <div className="text-sm">
                          <p className="font-semibold text-red-800 mb-2">Resolution Suggestions for {item.mill}:</p>
                          <ul className="list-disc ml-5 space-y-1 text-red-700 text-xs">
                            <li>Shift 80/70 Blend to Mill with spare capacity ({Math.abs(item.variance)} days needed)</li>
                            <li>Extend operating window by adding weekend shift</li>
                            <li>Reduce changeover time by batching similar recipes</li>
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mill Utilization Chart */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
        <h2 className="text-lg font-semibold mb-4 text-brown-800">Mill Utilization</h2>
        {chartMounted && capacityData.length > 0 ? (() => {
          const processedData = capacityData
            .reduce((acc: any, item: any) => {
              const key = item.mill_name || 'Unknown';
              if (!acc[key]) acc[key] = { mill_name: key, available_hours: 0, scheduled_hours: 0 };
              acc[key].available_hours += Number(item.available_hours) || 0;
              acc[key].scheduled_hours += Number(item.scheduled_hours) || 0;
              return acc;
            }, {} as Record<string, any>);

          const sortedData = Object.values(processedData).sort((a: any, b: any) => {
            const utilA = a.available_hours > 0 ? a.scheduled_hours / a.available_hours : 0;
            const utilB = b.available_hours > 0 ? b.scheduled_hours / b.available_hours : 0;
            return utilB - utilA;
          });

          const chartWidth = Math.max(600, Math.min(sortedData.length * 120, window.innerWidth * 0.7));

          return (
            <div className="w-full overflow-x-auto">
              <BarChart data={sortedData} width={chartWidth} height={350} margin={{ top: 20, right: 30, left: 60, bottom: 40 }} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" opacity={0.5} />
                <XAxis dataKey="mill_name" tick={{ fill: 'hsl(var(--logo-brown))', fontSize: 11 }} tickLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tick={{ fill: 'hsl(var(--logo-brown))', fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: 'hsl(var(--logo-brown))', style: { fontSize: 12, fontWeight: 600 } }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #8d6e63', borderRadius: '8px', padding: '8px' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: '12px' }} />
                <Bar dataKey="available_hours" fill="#cbd5e1" name="Available" radius={[6, 6, 0, 0]} maxBarSize={60} />
                <Bar dataKey="scheduled_hours" name="Planned" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {(sortedData as any[]).map((entry: any, idx: number) => {
                    const util = entry.available_hours > 0 ? entry.scheduled_hours / entry.available_hours : 0;
                    const color = util > 1 ? '#ef4444' : util > 0.9 ? '#f59e0b' : 'hsl(var(--primary))';
                    return <Cell key={idx} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </div>
          );
        })() : (
          <div className="flex items-center justify-center h-[300px] text-brown-500 text-sm">
            No capacity data available
          </div>
        )}
      </div>
    </div>
  );
}
