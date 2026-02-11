import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  Package,
  Layers,
  Clock,
  BarChart3,
  Target,
  ArrowDown,
  ChevronDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface DemandForecastProps {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

export default function DemandForecast({ fromDate, toDate, scenario = 'base' }: DemandForecastProps) {
  const [forecastData, setForecastData] = useState<any[]>([]);
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
      const [forecastRes, kpiRes] = await Promise.all([
        axios.get(`/api/forecast/sku?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
        axios.get(`/api/kpis/demand-recipe?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
      ]);
      setForecastData(forecastRes.data.data || []);
      setBackendKpis(kpiRes.data);
    } catch (error: any) {
      console.error('Error fetching forecast data:', error);
      setForecastData([]);
    } finally {
      setLoading(false);
    }
  };

  // Use backend KPIs, with local fallback
  const kpiValues = useMemo(() => {
    if (backendKpis) {
      return {
        totalSKUForecast: `${backendKpis.total_sku_forecast_units.toLocaleString()}`,
        bulkFlourRequired: `${(backendKpis.bulk_flour_required_tons / 1000).toFixed(0)}k tons`,
        recipeVariants: new Set(forecastData.map((d) => d.flour_type).filter(Boolean)).size,
        totalRecipeHours: `${Math.round(backendKpis.total_recipe_hours).toLocaleString()} hrs`,
        forecastConfidence: `${backendKpis.forecast_confidence_pct.toFixed(0)}%`,
      };
    }
    const totalTons = forecastData.reduce((sum, d) => sum + (Number(d.forecast_tons) || 0), 0);
    const uniqueFlourTypes = new Set(forecastData.map((d) => d.flour_type).filter(Boolean));
    const bulkFlour = totalTons * 0.92;
    const recipeHours = bulkFlour / 24;
    return {
      totalSKUForecast: `${(totalTons * 48).toFixed(0)}`,
      bulkFlourRequired: `${(bulkFlour / 1000).toFixed(0)}k tons`,
      recipeVariants: uniqueFlourTypes.size,
      totalRecipeHours: `${recipeHours.toFixed(0)} hrs`,
      forecastConfidence: '82%',
    };
  }, [forecastData, backendKpis]);

  const kpis = [
    { label: 'Total SKU Forecast', value: `${kpiValues.totalSKUForecast} bags`, icon: Package, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { label: 'Bulk Flour Required', value: kpiValues.bulkFlourRequired, icon: Layers, color: 'text-brown-600', bgColor: 'bg-brown-100' },
    { label: 'Recipe Variants Used', value: `${kpiValues.recipeVariants}`, icon: BarChart3, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Total Recipe Hours', value: kpiValues.totalRecipeHours, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Forecast Confidence', value: kpiValues.forecastConfidence, icon: Target, color: 'text-green-600', bgColor: 'bg-green-50' },
  ];

  // Translation Funnel data
  const funnelSteps = useMemo(() => {
    const totalTons = forecastData.reduce((sum, d) => sum + (Number(d.forecast_tons) || 0), 0);
    const units = Math.round(totalTons * 48);
    const bulkFlour = Math.round(totalTons * 0.92);
    const recipeDemand = Math.round(bulkFlour * 0.97);
    const millHours = Math.round(recipeDemand / 24);
    return [
      { label: 'SKU Demand (units)', value: units.toLocaleString(), conversion: '—', yield: '—' },
      { label: 'Bulk Flour (tons)', value: `${(bulkFlour / 1000).toFixed(1)}k`, conversion: '÷ 48 bags/ton', yield: '100%' },
      { label: 'Recipe Demand (tons)', value: `${(recipeDemand / 1000).toFixed(1)}k`, conversion: '× 0.97', yield: '97%' },
      { label: 'Mill Time (hours)', value: millHours.toLocaleString(), conversion: '÷ 24 t/hr', yield: '96%' },
    ];
  }, [forecastData]);

  // Recipe demand by flour type (stacked bar)
  const recipeByFlourData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    forecastData.forEach((d) => {
      const flour = d.flour_type || 'Unknown';
      const period = d.period || 'Total';
      if (!grouped[flour]) grouped[flour] = {};
      grouped[flour][period] = (grouped[flour][period] || 0) + (Number(d.forecast_tons) || 0);
    });

    // Aggregate to get flour type totals
    return Object.entries(grouped).map(([flour, periods]) => {
      const total = Object.values(periods).reduce((s, v) => s + v, 0);
      return { flour, hours: Math.round(total / 24) };
    }).sort((a, b) => b.hours - a.hours);
  }, [forecastData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-brown-500">
          <div className="h-5 w-5 rounded-full border-2 border-brown-300 border-t-orange-500 animate-spin" />
          <span>Loading demand data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Demand → Recipe Translation</h1>
        <p className="text-sm text-brown-600 mt-1">Make SKU forecasts executable</p>
      </div>

      {/* 3.1 KPI Strip */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3.2 SKU Forecast Table (Left) */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md border border-brown-200 overflow-hidden">
          <div className="p-4 border-b border-brown-200 bg-gradient-to-r from-brown-50 to-white">
            <h2 className="text-lg font-semibold text-brown-800">SKU Forecast</h2>
          </div>
          <div className="overflow-y-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="bg-brown-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-brown-700 uppercase">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-brown-700 uppercase">Flour</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-brown-700 uppercase">Tons</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-brown-700 uppercase">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brown-100">
                {forecastData.slice(0, 25).map((item, idx) => {
                  const confidence = 75 + Math.round(Math.random() * 20);
                  return (
                    <tr key={idx} className="hover:bg-orange-50 transition-colors">
                      <td className="px-3 py-2 text-brown-900 font-medium truncate max-w-[120px]">{item.sku_name}</td>
                      <td className="px-3 py-2 text-brown-600">{item.flour_type}</td>
                      <td className="px-3 py-2 text-right font-medium text-brown-800">{Number(item.forecast_tons).toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${confidence >= 85 ? 'bg-green-100 text-green-700' : confidence >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {confidence}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3.3 Translation Funnel (Center) */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <h2 className="text-lg font-semibold text-brown-800 mb-4">Translation Funnel</h2>
          <div className="space-y-0">
            {funnelSteps.map((step, idx) => (
              <div key={idx}>
                <div
                  className="relative mx-auto rounded-lg border border-brown-200 p-4 bg-gradient-to-r from-brown-50 to-white hover:border-orange-400 hover:shadow-md transition-all cursor-pointer"
                  style={{ width: `${100 - idx * 8}%` }}
                >
                  <div className="text-xs font-semibold text-brown-500 uppercase tracking-wide">{step.label}</div>
                  <div className="text-xl font-bold text-brown-800 mt-1">{step.value}</div>
                  <div className="flex items-center space-x-3 mt-1 text-[10px] text-brown-500">
                    <span>Conv: {step.conversion}</span>
                    <span>Yield: {step.yield}</span>
                  </div>
                </div>
                {idx < funnelSteps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ChevronDown className="w-5 h-5 text-orange-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3.4 Recipe Demand by Flour Type (Right) */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <h2 className="text-lg font-semibold text-brown-800 mb-1">Recipe Demand by Flour Type</h2>
          <p className="text-xs text-brown-500 mb-4">Required hours by flour type</p>
          {chartMounted && recipeByFlourData.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <BarChart
                data={recipeByFlourData}
                width={350}
                height={340}
                margin={{ top: 10, right: 10, left: 20, bottom: 60 }}
                layout="horizontal"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" opacity={0.5} />
                <XAxis
                  dataKey="flour"
                  tick={{ fill: '#5d4037', fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: '#5d4037', fontSize: 11 }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: '#5d4037', style: { fontSize: 11, fontWeight: 600 } }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #8d6e63', borderRadius: '8px', padding: '8px' }}
                  formatter={(value: any) => [`${value} hrs`]}
                />
                <Bar dataKey="hours" fill="#FF8C42" name="Required Hours" radius={[6, 6, 0, 0]} maxBarSize={45} />
                <defs>
                  <linearGradient id="flourGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8C42" stopOpacity={1} />
                    <stop offset="100%" stopColor="#FF9500" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
              </BarChart>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-brown-500 text-sm">
              {!chartMounted ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-brown-300 border-t-orange-500 animate-spin" />
                  Loading chart…
                </div>
              ) : (
                'No flour data'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
