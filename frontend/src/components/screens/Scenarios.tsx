import React, { useState, useMemo } from 'react';
import { Clock, AlertTriangle, DollarSign, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
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

interface ScenariosProps {
  fromDate: Date;
  toDate: Date;
  scenario?: string;
}

const scenarioPresets: Record<string, { name: string; skuIncrease: number; wheatPriceIncrease: number; millMaintenance: boolean }> = {
  ramadan: { name: 'Ramadan Peak', skuIncrease: 35, wheatPriceIncrease: 8, millMaintenance: false },
  hajj: { name: 'Hajj Season', skuIncrease: 25, wheatPriceIncrease: 5, millMaintenance: false },
  summer: { name: 'Summer Peak', skuIncrease: 15, wheatPriceIncrease: 3, millMaintenance: true },
};

export default function Scenarios({ fromDate, toDate, scenario: globalScenario = 'base' }: ScenariosProps) {
  const [scenario, setScenario] = useState({
    name: 'Ramadan Peak',
    skuIncrease: 35,
    wheatPriceIncrease: 8,
    millMaintenance: false,
  });
  const [chartMounted] = useState(true);

  // Base metrics
  const baseMetrics = {
    recipeHours: 4860,
    overload: 18,
    cost: 2.1,
    waste: -1.2,
  };

  // Scenario metrics (computed from inputs)
  const scenarioMetrics = useMemo(() => {
    const demandMultiplier = 1 + scenario.skuIncrease / 100;
    const hours = Math.round(baseMetrics.recipeHours * demandMultiplier);
    const overload = Math.round(baseMetrics.overload * demandMultiplier + (scenario.millMaintenance ? 24 : 0));
    const cost = (baseMetrics.cost * (1 + scenario.wheatPriceIncrease / 20)).toFixed(1);
    const waste = (baseMetrics.waste + (demandMultiplier - 1) * 3).toFixed(1);
    return { recipeHours: hours, overload, cost, waste };
  }, [scenario]);

  // KPI Comparison table
  const comparisonKPIs = [
    { metric: 'Recipe Hours', base: `${baseMetrics.recipeHours.toLocaleString()}`, scenario: `${scenarioMetrics.recipeHours.toLocaleString()}`, worse: scenarioMetrics.recipeHours > baseMetrics.recipeHours },
    { metric: 'Overload', base: `${baseMetrics.overload} hrs`, scenario: `${scenarioMetrics.overload} hrs`, worse: scenarioMetrics.overload > baseMetrics.overload },
    { metric: 'Cost', base: `+${baseMetrics.cost}%`, scenario: `+${scenarioMetrics.cost}%`, worse: Number(scenarioMetrics.cost) > baseMetrics.cost },
    { metric: 'Waste', base: `${baseMetrics.waste}%`, scenario: `${Number(scenarioMetrics.waste) > 0 ? '+' : ''}${scenarioMetrics.waste}%`, worse: Number(scenarioMetrics.waste) > baseMetrics.waste },
  ];

  // Capacity Impact chart data (per mill)
  const capacityImpactData = useMemo(() => {
    const mills = ['Mill A', 'Mill B', 'Mill C', 'Mill D'];
    return mills.map((mill) => {
      const baseOverload = Math.round(Math.random() * 15);
      const scenarioOverload = Math.round(baseOverload * (1 + scenario.skuIncrease / 100) + (scenario.millMaintenance && mill === 'Mill B' ? 18 : 0));
      return { mill, base: baseOverload, scenario: scenarioOverload };
    });
  }, [scenario]);

  const loadPreset = (key: string) => {
    const preset = scenarioPresets[key];
    if (preset) setScenario(preset);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Scenarios & Seasonality</h1>
        <p className="text-sm text-brown-600 mt-1">Stress-test recipe-time decisions</p>
      </div>

      {/* 8.1 KPI Strip (Scenario Comparison) */}
      <div className="bg-white rounded-lg shadow-md border border-brown-200 overflow-hidden">
        <div className="p-4 border-b border-brown-200 bg-gradient-to-r from-brown-50 to-white">
          <h2 className="text-lg font-semibold text-brown-800">Scenario Comparison: Base vs {scenario.name}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brown-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-brown-600 uppercase">Metric</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-brown-600 uppercase">Base</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-brown-600 uppercase">Scenario</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-brown-600 uppercase">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-100">
              {comparisonKPIs.map((kpi, idx) => (
                <tr key={idx} className="hover:bg-brown-50">
                  <td className="px-6 py-3 text-sm font-semibold text-brown-800">{kpi.metric}</td>
                  <td className="px-6 py-3 text-center text-sm text-brown-700">{kpi.base}</td>
                  <td className={`px-6 py-3 text-center text-sm font-bold ${kpi.worse ? 'text-red-600' : 'text-green-600'}`}>
                    {kpi.scenario}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {kpi.worse ? (
                      <ArrowUp className="w-4 h-4 text-red-500 mx-auto" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-green-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Builder */}
        <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-brown-800">Scenario Builder</h2>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(scenarioPresets).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => loadPreset(key)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brown-200 hover:border-orange-400 hover:bg-orange-50 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brown-700 mb-2">Scenario Name</label>
              <input
                type="text"
                value={scenario.name}
                onChange={(e) => setScenario({ ...scenario, name: e.target.value })}
                className="w-full px-3 py-2 border border-brown-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                placeholder="e.g., Ramadan Peak"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brown-700 mb-2">
                10kg Pack Demand Increase: <span className="text-orange-600 font-bold">{scenario.skuIncrease}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={scenario.skuIncrease}
                onChange={(e) => setScenario({ ...scenario, skuIncrease: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brown-700 mb-2">
                Wheat Price Increase: <span className="text-orange-600 font-bold">{scenario.wheatPriceIncrease}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={30}
                value={scenario.wheatPriceIncrease}
                onChange={(e) => setScenario({ ...scenario, wheatPriceIncrease: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={scenario.millMaintenance}
                onChange={(e) => setScenario({ ...scenario, millMaintenance: e.target.checked })}
                className="w-4 h-4 text-orange-500 border-brown-300 rounded focus:ring-orange-500"
              />
              <label className="ml-2 text-sm text-brown-700">Mill B Maintenance (−1 week)</label>
            </div>
          </div>
        </div>

        {/* 8.2 Capacity Impact by Scenario (Side-by-side bar) */}
        <div className="bg-white rounded-lg shadow-md border border-brown-200 p-6">
          <h2 className="text-lg font-semibold mb-1 text-brown-800">Capacity Impact by Scenario</h2>
          <p className="text-xs text-brown-500 mb-4">Overload hours per mill: Base vs Scenario</p>
          {chartMounted ? (
            <div className="w-full overflow-x-auto">
              <BarChart
                data={capacityImpactData}
                width={450}
                height={350}
                margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
                barCategoryGap="25%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" opacity={0.5} />
                <XAxis dataKey="mill" tick={{ fill: '#5d4037', fontSize: 11 }} />
                <YAxis tick={{ fill: '#5d4037', fontSize: 11 }} label={{ value: 'Overload Hrs', angle: -90, position: 'insideLeft', fill: '#5d4037', style: { fontSize: 11, fontWeight: 600 } }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #8d6e63', borderRadius: '8px', padding: '8px' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: '8px' }} />
                <Bar dataKey="base" fill="#cbd5e1" name="Base" radius={[4, 4, 0, 0]} maxBarSize={35} />
                <Bar dataKey="scenario" fill="#ef4444" name="Scenario" radius={[4, 4, 0, 0]} maxBarSize={35} />
              </BarChart>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-brown-500 text-sm">Loading chart…</div>
          )}
        </div>
      </div>
    </div>
  );
}
