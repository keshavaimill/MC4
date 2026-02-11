import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Settings,
  Clock,
  Trash2,
  Leaf,
  ArrowUp,
  ArrowDown,
  ChevronRight,
} from 'lucide-react';
import { getKpiFontSize } from '../../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
  Cell,
} from 'recharts';

interface ExecutiveOverviewProps {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

interface KPIs {
  demand: { total_tons: number; growth_pct: number };
  recipe_time: { total_hours: number; utilization_pct: number };
  capacity: { utilization_pct: number; overload_mills: number };
  risk: { avg_wheat_price: number; price_change_pct: number };
  waste: { waste_rate_pct: number; delta_pct: number };
  vision2030: { score: number; delta: number };
}

// Generate heatmap data for mills across weeks
const generateHeatmapData = (capacityData: any[]) => {
  const weeks = ['W1', 'W2', 'W3', 'W4'];
  const mills = capacityData.length > 0
    ? [...new Set(capacityData.map((d) => d.mill_name || `Mill ${d.mill_id}`))]
    : ['Mill A', 'Mill B', 'Mill C', 'Mill D'];

  return mills.map((mill) => {
    const row: any = { mill };
    weeks.forEach((week) => {
      const base = 70 + Math.random() * 30;
      row[week] = Math.round(base);
    });
    return row;
  });
};

const getHeatColor = (value: number) => {
  if (value >= 100) return 'bg-destructive text-destructive-foreground';
  if (value >= 95) return 'bg-destructive/80 text-destructive-foreground';
  if (value >= 90) return 'bg-warning text-warning-foreground';
  if (value >= 80) return 'bg-warning/40 text-warning-foreground';
  return 'bg-success/40 text-success-foreground';
};

export default function ExecutiveOverview({ fromDate, toDate, scenario = 'base' }: ExecutiveOverviewProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipeTimeData, setRecipeTimeData] = useState<any[]>([]);
  const [capacityData, setCapacityData] = useState<any[]>([]);
  const [chartMounted, setChartMounted] = useState(false);
  const [chartWidth, setChartWidth] = useState<number>(800);

  useEffect(() => {
    setChartMounted(true);
  }, []);

  useEffect(() => {
    const calculateChartWidth = () => {
      const viewportWidth = window.innerWidth;
      const sidebarWidth = 64;
      const mainPadding = 48;
      const tilePadding = 32;
      const chartPadding = 24;
      const availableWidth = viewportWidth - sidebarWidth - mainPadding - tilePadding - chartPadding;
      const calculatedWidth = Math.max(400, Math.round(availableWidth));
      if (Number.isFinite(calculatedWidth) && calculatedWidth > 0) {
        setChartWidth(calculatedWidth);
      }
    };
    calculateChartWidth();
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculateChartWidth, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [chartMounted]);

  const canRenderChart = chartMounted && chartWidth > 0;

  // Prepare chart data - Stacked bar + line (Hero chart)
  const heroChartData = useMemo(() => {
    if (!recipeTimeData || recipeTimeData.length === 0) return [];
    const aggregated = recipeTimeData
      .filter((item: any) => item && (item.recipe_name != null || item.recipe_id != null))
      .reduce((acc: any[], item: any) => {
        const recipeName = String(item.recipe_name ?? item.recipe_id ?? 'Unknown').trim();
        const rawHours = Number(item.scheduled_hours ?? item.duration_hours ?? item.required_hours ?? 0);
        const hours = Number.isFinite(rawHours) && rawHours >= 0 ? rawHours : 0;
        const existing = acc.find((x: any) => x.recipe === recipeName);
        if (existing) {
          existing.hours += hours;
        } else {
          acc.push({ recipe: recipeName, hours });
        }
        return acc;
      }, [])
      .filter((x: any) => x.recipe && Number.isFinite(x.hours) && x.hours > 0)
      .sort((a: any, b: any) => b.hours - a.hours);

    // Add capacity line (available hours distributed)
    const totalAvailable = capacityData.reduce((sum, d) => sum + (Number(d.available_hours) || 0), 0);
    const avgPerRecipe = aggregated.length > 0 ? totalAvailable / aggregated.length : 0;

    return aggregated.map((d: any) => ({
      ...d,
      hours: Math.round(d.hours),
      capacity: Math.round(avgPerRecipe),
    }));
  }, [recipeTimeData, capacityData]);

  // Heatmap data
  const heatmapData = useMemo(() => generateHeatmapData(capacityData), [capacityData]);
  const heatmapWeeks = ['W1', 'W2', 'W3', 'W4'];

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');
      const scenarioParam = scenario || 'base';

      const [kpisRes, recipeRes, capacityRes] = await Promise.all([
        axios.get(`/api/kpis/executive?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
        axios.get(`/api/planning/recipe?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
        axios.get(`/api/capacity/mill?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
      ]);

      setKpis(kpisRes.data);
      setRecipeTimeData(recipeRes.data.data || []);
      setCapacityData(capacityRes.data.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, scenario]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
          <span>Loading executive summary…</span>
        </div>
      </div>
    );
  }

  if (!kpis) {
    return <div className="text-destructive">Error loading data</div>;
  }

  // KPI values from API (waste + vision2030 are now real)
  const wasteRate = kpis.waste?.waste_rate_pct ?? 4.2;
  const wasteDelta = kpis.waste?.delta_pct ?? 0;
  const vision2030 = kpis.vision2030?.score ?? 78;
  const vision2030Delta = kpis.vision2030?.delta ?? 0;

  // 6 KPI tiles per wireframe
  const kpiTiles = [
    {
      label: 'Total Demand',
      value: `${(kpis.demand.total_tons / 1000).toFixed(0)}k tons`,
      delta: `${kpis.demand.growth_pct >= 0 ? '+' : ''}${Number(kpis.demand.growth_pct).toFixed(3)}% MoM`,
      driver: 'Driven by 10kg',
      isPositive: kpis.demand.growth_pct >= 0,
      icon: TrendingUp,
      color: kpis.demand.growth_pct >= 0 ? 'text-success' : 'text-destructive',
      bgColor: kpis.demand.growth_pct >= 0 ? 'bg-success/10' : 'bg-destructive/10',
    },
    {
      label: 'Recipe Time Utilization',
      value: `${kpis.recipe_time.utilization_pct.toFixed(0)}%`,
      delta: `+${Number(kpis.recipe_time.utilization_pct - 88).toFixed(3)}%`,
      driver: 'Time is constraint',
      isPositive: kpis.recipe_time.utilization_pct < 95,
      icon: Clock,
      color: kpis.recipe_time.utilization_pct > 95 ? 'text-destructive' : kpis.recipe_time.utilization_pct > 90 ? 'text-warning' : 'text-success',
      bgColor: kpis.recipe_time.utilization_pct > 95 ? 'bg-destructive/10' : kpis.recipe_time.utilization_pct > 90 ? 'bg-warning/10' : 'bg-success/10',
    },
    {
      label: 'Capacity Violations',
      value: `${kpis.capacity.overload_mills} Mill`,
      delta: kpis.capacity.overload_mills > 0 ? '↑' : '—',
      driver: kpis.capacity.overload_mills > 0 ? 'Mill overload' : 'All OK',
      isPositive: kpis.capacity.overload_mills === 0,
      icon: AlertTriangle,
      color: kpis.capacity.overload_mills > 0 ? 'text-destructive' : 'text-success',
      bgColor: kpis.capacity.overload_mills > 0 ? 'bg-destructive/10' : 'bg-success/10',
    },
    {
      label: 'Avg Cost / Ton',
      value: `${(kpis.risk.avg_wheat_price / 1000).toFixed(2)}k SAR`,
      delta: `${kpis.risk.price_change_pct >= 0 ? '+' : ''}${Number(kpis.risk.price_change_pct).toFixed(3)}%`,
      driver: 'Wheat price',
      isPositive: kpis.risk.price_change_pct <= 0,
      icon: DollarSign,
      color: kpis.risk.price_change_pct > 0 ? 'text-warning' : 'text-success',
      bgColor: kpis.risk.price_change_pct > 0 ? 'bg-warning/10' : 'bg-success/10',
    },
    {
      label: 'Waste Rate',
      value: `${wasteRate.toFixed(1)}%`,
      delta: `${wasteDelta <= 0 ? '' : '+'}${Number(wasteDelta).toFixed(3)}%`,
      driver: wasteDelta <= 0 ? 'Improving' : 'Worsening',
      isPositive: wasteDelta <= 0,
      icon: Trash2,
      color: wasteDelta <= 0 ? 'text-success' : 'text-destructive',
      bgColor: wasteDelta <= 0 ? 'bg-success/10' : 'bg-destructive/10',
    },
    {
      label: 'Vision 2030 Score',
      value: `${vision2030} / 100`,
      delta: `${vision2030Delta >= 0 ? '+' : ''}${Number(vision2030Delta).toFixed(3)}`,
      driver: 'Waste & energy',
      isPositive: vision2030Delta >= 0,
      icon: Leaf,
      color: vision2030 >= 75 ? 'text-success' : 'text-warning',
      bgColor: vision2030 >= 75 ? 'bg-success/10' : 'bg-warning/10',
    },
  ];

  // AI Executive Brief structured data
  const aiBrief = {
    keyDriver: kpis.demand.growth_pct > 5
      ? 'Demand surge in 10kg flour segment'
      : 'Stable demand with seasonal adjustment',
    rootCause: kpis.capacity.overload_mills > 0
      ? `Mill overload caused by recipe mix allocation exceeding ${kpis.capacity.utilization_pct.toFixed(0)}% capacity`
      : 'Recipe mix is within normal distribution across mills',
    impact: {
      time: `${kpis.recipe_time.total_hours.toFixed(0)} hrs scheduled`,
      cost: `+2.2% wheat cost increase`,
      risk: kpis.capacity.overload_mills > 0 ? 'High - immediate action needed' : 'Low - within tolerance',
    },
    actions: [
      { label: 'Rebalance recipe mix for Mill B', screen: 'recipe' },
      { label: 'Review wheat sourcing alternatives', screen: 'rawmaterials' },
      { label: 'Adjust 10kg SKU production schedule', screen: 'demand' },
    ],
  };

  const formatYAxisTick = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Executive Summary</h1>
        <p className="text-sm text-muted-foreground mt-1">
          30-second situational awareness + immediate actions
        </p>
      </div>

      {/* 2.1 KPI Strip (6 KPIs - full width) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiTiles.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-card rounded-lg shadow-card p-4 border border-border transition-shadow duration-200 ease-out cursor-pointer hover:shadow-card"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</h3>
                <div className={`w-7 h-7 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <div className={`${getKpiFontSize(kpi.value)} font-bold text-foreground`}>{kpi.value}</div>
              <div className="flex items-center space-x-1 mt-1">
                {kpi.isPositive ? (
                  <ArrowUp className="w-3 h-3 text-success" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-destructive" />
                )}
                <span className={`text-xs font-medium ${kpi.isPositive ? 'text-success' : 'text-destructive'}`}>
                  {kpi.delta}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.driver}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2.2 Hero Chart: Recipe Time Demand vs Capacity (Stacked bar + line) */}
        <div className="lg:col-span-2 bg-card rounded-lg shadow-card p-4 border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Recipe Time Demand vs Capacity
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Mill hours (not tons) — Shaded region = Risk zone (&gt;90%)</p>
          {!canRenderChart || heroChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                {!canRenderChart ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-border border-t-primary animate-spin" />
                    <span className="text-sm">Loading chart…</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium">No recipe time data available</p>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <ComposedChart
                data={heroChartData}
                width={Math.min(chartWidth * 0.65, 750)}
                height={340}
                margin={{ top: 10, right: 20, left: 50, bottom: heroChartData.length > 8 ? 80 : 40 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                <XAxis
                  dataKey="recipe"
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  angle={heroChartData.length > 6 ? -35 : 0}
                  textAnchor={heroChartData.length > 6 ? 'end' : 'middle'}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, 'auto']}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={formatYAxisTick}
                  width={55}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: -5, fill: 'hsl(var(--muted-foreground))', style: { fontSize: 12, fontWeight: 600, textAnchor: 'middle' } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '8px' }}
                  formatter={(value: any, name: string) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: '4px' }} iconType="rect" iconSize={10} />
                <Bar dataKey="hours" fill="#FF8C42" name="Required Hours" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {heroChartData.map((entry: any, idx: number) => {
                    const ratio = entry.capacity > 0 ? entry.hours / entry.capacity : 0;
                    const color = ratio > 1 ? '#ef4444' : ratio > 0.9 ? '#f59e0b' : '#FF8C42';
                    return <Cell key={idx} fill={color} />;
                  })}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="capacity"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name="Available Mill Hours"
                />
              </ComposedChart>
            </div>
          )}
        </div>

        {/* 2.4 AI Executive Brief (Right Panel) */}
        <div className="bg-card rounded-lg shadow-card border border-border p-5">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground text-sm">🧠</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">AI Executive Brief</h2>
          </div>

          <div className="space-y-4">
            {/* Key Driver */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Key Driver</h4>
              <p className="text-sm text-foreground font-medium">{aiBrief.keyDriver}</p>
            </div>

            {/* Root Cause */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Root Cause</h4>
              <p className="text-sm text-muted-foreground">{aiBrief.rootCause}</p>
            </div>

            {/* Impact */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Impact</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium text-foreground">{aiBrief.impact.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="font-medium text-warning">{aiBrief.impact.cost}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Risk:</span>
                  <span className={`font-medium ${kpis.capacity.overload_mills > 0 ? 'text-destructive' : 'text-success'}`}>
                    {aiBrief.impact.risk}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommended Actions */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recommended Actions</h4>
              <div className="space-y-1.5">
                {aiBrief.actions.map((action, idx) => (
                  <button
                    key={idx}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-accent transition-colors duration-200 ease-out text-left group"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-foreground flex-1">{action.label}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2.3 Mill Capacity Heatmap */}
      <div className="bg-card rounded-lg shadow-card border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">Mill Capacity Heatmap</h2>
        <p className="text-xs text-muted-foreground mb-4">Utilization % — Red cells are actionable</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Mill</th>
                {heatmapWeeks.map((week) => (
                  <th key={week} className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                    {week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {heatmapData.map((row: any) => (
                <tr key={row.mill}>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{row.mill}</td>
                  {heatmapWeeks.map((week) => {
                    const val = row[week];
                    return (
                      <td key={week} className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-3 py-1.5 rounded-md text-xs font-bold min-w-[52px] cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all duration-200 ease-out ${getHeatColor(val)}`}
                        >
                          {val}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
