import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, Settings, AlertTriangle, DollarSign, Trash2, TrendingDown } from 'lucide-react';
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

interface RecipePlanningProps {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

export default function RecipePlanning({ fromDate, toDate, scenario = 'base' }: RecipePlanningProps) {
  const [recipeData, setRecipeData] = useState<any[]>([]);
  const [eligibility, setEligibility] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMounted, setChartMounted] = useState(false);
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});

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
      const [recipeRes, eligibilityRes, kpiRes] = await Promise.all([
        axios.get(`/api/planning/recipe?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
        axios.get('/api/planning/recipe-eligibility'),
        axios.get(`/api/kpis/recipe-planning?from_date=${fromDateStr}&to_date=${toDateStr}&scenario=${scenarioParam}`),
      ]);
      const rData = recipeRes.data.data || [];
      setRecipeData(rData);
      setEligibility(eligibilityRes.data.data || []);
      setBackendKpis(kpiRes.data);

      // Initialize slider values from data
      const initial: Record<string, number> = {};
      const aggregated = rData.reduce((acc: any, item: any) => {
        const key = item.recipe_name || 'Unknown';
        if (!acc[key]) acc[key] = 0;
        acc[key] += Number(item.scheduled_hours) || 0;
        return acc;
      }, {});
      Object.entries(aggregated).forEach(([name, hours]: any) => {
        initial[name] = Math.round(hours);
      });
      setSliderValues(initial);
    } catch (error) {
      console.error('Error fetching recipe data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Compute KPIs from backend or local fallback
  const kpiValues = useMemo(() => {
    const totalPlanned = Object.values(sliderValues).reduce((s, v) => s + v, 0);
    const totalAvailable = backendKpis?.available_mill_hours || 5120;
    const slack = totalAvailable - totalPlanned;
    const changeovers = backendKpis?.avg_changeovers ?? Object.keys(sliderValues).length;
    const wheatCost = backendKpis?.wheat_cost_index
      ? (backendKpis.wheat_cost_index / 1500).toFixed(2)
      : '1.09';
    const wasteImpact = backendKpis?.waste_impact_pct
      ? `${backendKpis.waste_impact_pct.toFixed(1)}%`
      : '−1.2%';
    return {
      plannedHours: `${totalPlanned.toLocaleString()} hrs`,
      availableHours: `${Math.round(totalAvailable).toLocaleString()} hrs`,
      slack: slack >= 0 ? `+${Math.round(slack)} hrs` : `${Math.round(slack)} hrs`,
      slackPositive: slack >= 0,
      changeovers: `${changeovers} / month`,
      wheatCostIndex: wheatCost,
      wasteImpact: wasteImpact,
    };
  }, [sliderValues, backendKpis]);

  // Recipe-level cost data from backend for impact calculation
  const recipeCostInfo = useMemo(() => {
    const map: Record<string, { costPerHour: number; wastePct: number; baseHours: number }> = {};
    recipeData.forEach((d: any) => {
      const name = d.recipe_name || 'Unknown';
      if (!map[name]) {
        map[name] = {
          costPerHour: Number(d.cost_per_hour) || 0,
          wastePct: Number(d.avg_waste_pct) || 0,
          baseHours: 0,
        };
      }
      map[name].baseHours += Number(d.scheduled_hours) || 0;
    });
    return map;
  }, [recipeData]);

  // Impact panel — uses real backend data (auto-recalculates on slider change)
  const impactMetrics = useMemo(() => {
    const totalPlanned = Object.values(sliderValues).reduce((s, v) => s + v, 0);
    const totalAvailable = backendKpis?.available_mill_hours || 5120;
    const overload = Math.max(0, totalPlanned - totalAvailable);

    // Cost delta: compare slider cost vs baseline cost using real cost_per_hour
    const baseCost = Object.entries(recipeCostInfo).reduce(
      (s, [, r]) => s + r.baseHours * r.costPerHour, 0
    );
    const currCost = Object.entries(sliderValues).reduce(
      (s, [name, hrs]) => s + hrs * (recipeCostInfo[name]?.costPerHour || 0), 0
    );
    const costDeltaFromSlider = baseCost > 0 ? ((currCost - baseCost) / baseCost * 100) : 0;
    // Add backend baseline cost impact
    const backendCostBaseline = backendKpis?.cost_impact_pct ?? 0;
    const costDelta = (backendCostBaseline + costDeltaFromSlider).toFixed(1);

    // Waste delta: weighted average change
    const baseTotalHrs = Object.values(recipeCostInfo).reduce((s, r) => s + r.baseHours, 0);
    const baseWasteAvg = baseTotalHrs > 0
      ? Object.entries(recipeCostInfo).reduce((s, [, r]) => s + r.baseHours * r.wastePct, 0) / baseTotalHrs
      : 0;
    const currWasteAvg = totalPlanned > 0
      ? Object.entries(sliderValues).reduce((s, [name, hrs]) => s + hrs * (recipeCostInfo[name]?.wastePct || 0), 0) / totalPlanned
      : 0;
    const wasteDelta = (currWasteAvg - baseWasteAvg).toFixed(1);

    // Risk score from backend, adjusted for slider changes
    const backendRisk = backendKpis?.risk_score ?? 0;
    const hasSliderChange = Object.entries(sliderValues).some(
      ([name, hrs]) => Math.abs(hrs - (recipeCostInfo[name]?.baseHours || 0)) > 1
    );
    const sliderRiskDelta = hasSliderChange
      ? (overload / Math.max(1, totalAvailable)) * 80 +
        Math.abs(costDeltaFromSlider) * 1.5 +
        Math.abs(Number(wasteDelta)) * 8
      : 0;
    const riskScoreNum = Math.min(100, Math.round(backendRisk + sliderRiskDelta));
    const riskScore = riskScoreNum > 60 ? 'High' : riskScoreNum > 30 ? 'Medium' : 'Low';

    return { overload, costDelta, wasteDelta, riskScore, riskScoreNum };
  }, [sliderValues, recipeCostInfo, backendKpis]);

  const kpis = [
    { label: 'Planned Recipe Hours', value: kpiValues.plannedHours, icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { label: 'Available Mill Hours', value: kpiValues.availableHours, icon: Settings, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Slack / Shortfall', value: kpiValues.slack, icon: kpiValues.slackPositive ? CheckCircle : AlertTriangle, color: kpiValues.slackPositive ? 'text-green-600' : 'text-red-600', bgColor: kpiValues.slackPositive ? 'bg-green-50' : 'bg-red-50' },
    { label: 'Wheat Cost Index', value: kpiValues.wheatCostIndex, icon: DollarSign, color: 'text-brown-600', bgColor: 'bg-brown-100' },
    { label: 'Waste Impact', value: kpiValues.wasteImpact, icon: Trash2, color: 'text-green-600', bgColor: 'bg-green-50' },
  ];

  const flourTypes = useMemo(() => [...new Set(eligibility.map((e) => e.flour_type))], [eligibility]);
  const recipes = useMemo(() => [...new Set(eligibility.map((e) => e.recipe_name))], [eligibility]);

  // Horizontal bar data for sliders
  const sliderData = useMemo(() => {
    return Object.entries(sliderValues)
      .map(([name, hours]) => ({
        recipe_name: name,
        hours,
        days: (hours / 24).toFixed(1),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [sliderValues]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-brown-500">
          <div className="h-5 w-5 rounded-full border-2 border-brown-300 border-t-orange-500 animate-spin" />
          <span>Loading recipe planning…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Recipe & Mill Planning</h1>
        <p className="text-sm text-brown-600 mt-1">Decide which recipe runs, and for how long</p>
      </div>

      {/* 4.1 KPI Strip */}
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

      {/* 4.2 Recipe Eligibility Matrix */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
        <h2 className="text-lg font-semibold mb-1 text-brown-800">Recipe Eligibility Matrix</h2>
        <p className="text-xs text-brown-500 mb-4">Hover for quality reason & yield impact</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-brown-600 uppercase">Flour Type</th>
                {recipes.map((recipe) => (
                  <th key={recipe} className="px-4 py-3 text-center text-xs font-medium text-brown-600 uppercase">
                    {recipe}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-100">
              {flourTypes.map((flour) => (
                <tr key={flour} className="hover:bg-brown-50">
                  <td className="px-4 py-3 text-sm font-medium text-brown-800">{flour}</td>
                  {recipes.map((recipe) => {
                    const eligible = eligibility.find(
                      (e) => e.flour_type === flour && e.recipe_name === recipe
                    );
                    return (
                      <td key={recipe} className="px-4 py-3 text-center" title={eligible ? `Yield: ${((eligible.base_tons_per_hour || 25) * 0.96).toFixed(1)} t/hr | Quality: OK` : 'Not eligible'}>
                        {eligible ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-brown-300 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 4.3 Recipe Time Allocation (Horizontal bar with sliders) */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <h2 className="text-lg font-semibold mb-1 text-brown-800">Recipe Time Allocation</h2>
          <p className="text-xs text-brown-500 mb-4">Adjust hours — triggers live recalculation</p>
          <div className="space-y-3">
            {sliderData.map((item) => {
              const maxHours = 3000;
              const pct = Math.min(100, (item.hours / maxHours) * 100);
              const isOverloaded = item.hours > 2000;
              return (
                <div key={item.recipe_name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-brown-800 w-40 truncate">{item.recipe_name}</span>
                    <span className="text-xs text-brown-600 w-40 text-right">
                      {item.hours.toLocaleString()} hrs ({item.days} days)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-brown-100 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isOverloaded ? 'bg-red-500' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={maxHours}
                      value={item.hours}
                      onChange={(e) => {
                        setSliderValues((prev) => ({
                          ...prev,
                          [item.recipe_name]: Number(e.target.value),
                        }));
                      }}
                      className="w-24 accent-orange-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4.4 Impact Panel (Auto-Refresh) */}
        <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-semibold text-brown-800">Impact Panel</h2>
            <span className="text-[10px] text-brown-500">(Live)</span>
          </div>
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-brown-200 bg-brown-50">
              <div className="text-xs text-brown-500 uppercase tracking-wide">Mill Overload</div>
              <div className={`text-2xl font-bold mt-1 ${impactMetrics.overload > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {impactMetrics.overload > 0 ? `+${impactMetrics.overload} hrs` : '0 hrs'}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-brown-200 bg-brown-50">
              <div className="text-xs text-brown-500 uppercase tracking-wide">Cost Delta</div>
              <div className={`text-2xl font-bold mt-1 ${Number(impactMetrics.costDelta) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {Number(impactMetrics.costDelta) > 0 ? '+' : ''}{impactMetrics.costDelta}%
              </div>
            </div>
            <div className="p-3 rounded-lg border border-brown-200 bg-brown-50">
              <div className="text-xs text-brown-500 uppercase tracking-wide">Waste Delta</div>
              <div className={`text-2xl font-bold mt-1 ${Number(impactMetrics.wasteDelta) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {impactMetrics.wasteDelta}%
              </div>
            </div>
            <div className="p-3 rounded-lg border border-brown-200 bg-brown-50">
              <div className="text-xs text-brown-500 uppercase tracking-wide">Risk Score</div>
              <div className={`text-2xl font-bold mt-1 ${
                impactMetrics.riskScore === 'High' ? 'text-red-600' :
                impactMetrics.riskScore === 'Medium' ? 'text-amber-600' : 'text-green-600'
              }`}>
                {impactMetrics.riskScoreNum}/100 <span className="text-sm font-medium">({impactMetrics.riskScore})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
