'use client';

import { useState } from 'react';

interface ScenariosProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

export default function Scenarios({ horizon, fromDate, toDate }: ScenariosProps) {
  const [scenario, setScenario] = useState({
    name: '',
    skuIncrease: 0,
    wheatPriceIncrease: 0,
    millMaintenance: false,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="screen-title">Scenarios & What-If</h1>
        <p className="screen-subtitle">Build and compare planning scenarios</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="apple-card p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Scenario Builder</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Scenario name</label>
              <input
                type="text"
                value={scenario.name}
                onChange={(e) => setScenario({ ...scenario, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/20 transition-all"
                placeholder="e.g. Ramadan Peak"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">10kg pack demand increase (%)</label>
              <input
                type="number"
                value={scenario.skuIncrease || ''}
                onChange={(e) => setScenario({ ...scenario, skuIncrease: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/20 transition-all"
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Wheat price increase (%)</label>
              <input
                type="number"
                value={scenario.wheatPriceIncrease || ''}
                onChange={(e) => setScenario({ ...scenario, wheatPriceIncrease: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/20 transition-all"
                placeholder="8"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="maintenance"
                checked={scenario.millMaintenance}
                onChange={(e) => setScenario({ ...scenario, millMaintenance: e.target.checked })}
                className="w-4 h-4 rounded border-border text-ink focus:ring-ink/20"
              />
              <label htmlFor="maintenance" className="text-sm text-ink-secondary">Mill B maintenance (−1 week)</label>
            </div>
            <button
              type="button"
              className="w-full px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors"
            >
              Run scenario
            </button>
          </div>
        </div>

        <div className="apple-card p-6">
          <h2 className="text-base font-semibold text-ink mb-4">Comparison</h2>
          <div className="space-y-3">
            <div className="rounded-xl border border-border-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink">Base vs Ramadan Peak</span>
                <span className="text-sm text-ink-tertiary">2026-03</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-ink-secondary">
                  <span>Capacity overload</span>
                  <span className="font-medium text-ink">+14 hrs</span>
                </div>
                <div className="flex justify-between text-ink-secondary">
                  <span>Recipe shift</span>
                  <span className="font-medium text-ink">80/70 ↑</span>
                </div>
                <div className="flex justify-between text-ink-secondary">
                  <span>Cost impact</span>
                  <span className="font-medium text-ink">+2.4%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
