'use client';

import { useState } from 'react';

interface ScenariosProps {
  horizon: 'week' | 'month' | 'year';
}

export default function Scenarios({ horizon }: ScenariosProps) {
  const [scenario, setScenario] = useState({
    name: '',
    skuIncrease: 0,
    wheatPriceIncrease: 0,
    millMaintenance: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scenarios & What-If</h1>
        <p className="text-sm text-gray-500 mt-1">Build and compare planning scenarios</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario Builder */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Scenario Builder</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scenario Name
              </label>
              <input
                type="text"
                value={scenario.name}
                onChange={(e) => setScenario({ ...scenario, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mc4-blue"
                placeholder="e.g., Ramadan Peak"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                10kg Pack Demand Increase (%)
              </label>
              <input
                type="number"
                value={scenario.skuIncrease}
                onChange={(e) => setScenario({ ...scenario, skuIncrease: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mc4-blue"
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wheat Price Increase (%)
              </label>
              <input
                type="number"
                value={scenario.wheatPriceIncrease}
                onChange={(e) => setScenario({ ...scenario, wheatPriceIncrease: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-mc4-blue"
                placeholder="8"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={scenario.millMaintenance}
                onChange={(e) => setScenario({ ...scenario, millMaintenance: e.target.checked })}
                className="w-4 h-4 text-mc4-blue border-gray-300 rounded focus:ring-mc4-blue"
              />
              <label className="ml-2 text-sm text-gray-700">
                Mill B Maintenance (-1 week)
              </label>
            </div>
            <button className="w-full px-4 py-2 bg-mc4-blue text-white rounded-lg hover:bg-mc4-dark transition-colors font-medium">
              Run Scenario
            </button>
          </div>
        </div>

        {/* Scenario Comparison */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Scenario Comparison</h2>
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Base vs Ramadan Peak</span>
                <span className="text-sm text-gray-500">2026-03</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Capacity Overload:</span>
                  <span className="font-medium text-red-600">+14 hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Recipe Shift:</span>
                  <span className="font-medium">80/70 ↑</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cost Impact:</span>
                  <span className="font-medium text-yellow-600">+2.4%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
