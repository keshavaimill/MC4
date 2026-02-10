'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  TrendingUp,
  Settings,
  Factory,
  Package,
  AlertTriangle,
  FileText,
  Sparkles,
  Menu,
  X,
  Calendar,
} from 'lucide-react';
import Chatbot from './Chatbot';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  scenario: string;
  setScenario: (scenario: string) => void;
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
}

const navigation = [
  { id: 'executive', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'demand', label: 'Demand & Forecast', icon: TrendingUp },
  { id: 'recipe', label: 'Recipe Planning', icon: Settings },
  { id: 'capacity', label: 'Mill Capacity', icon: Factory },
  { id: 'rawmaterials', label: 'Raw Materials', icon: Package },
  { id: 'scenarios', label: 'Scenarios & What-If', icon: Sparkles },
  { id: 'alerts', label: 'Alerts & Actions', icon: AlertTriangle },
  { id: 'reports', label: 'Reports & Emails', icon: FileText },
];

export default function Layout({
  children,
  activeScreen,
  setActiveScreen,
  scenario,
  setScenario,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-[#fafafa]">
      {/* Sidebar - white, minimal */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-border-soft transition-all duration-300 ease-smooth flex flex-col shrink-0`}
      >
        <div className="h-16 border-b border-border-soft flex items-center px-4 transition-all duration-300">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-brand-muted ring-1 ring-brand/20">
                <Image
                  src="/logo/MC4_Logo.jpeg"
                  alt="MC4"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-ink">MC4</h1>
                <p className="text-xs text-ink-tertiary">Command Center</p>
              </div>
            </div>
          ) : (
            <div className="relative w-9 h-9 mx-auto shrink-0 rounded-xl overflow-hidden bg-brand-muted ring-1 ring-brand/20">
              <Image src="/logo/MC4_Logo.jpeg" alt="MC4" fill className="object-contain" priority />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={`apple-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left ${
                  isActive
                    ? 'bg-brand-muted text-brand-dark font-medium border-l-2 border-brand -ml-0.5 pl-3.5'
                    : 'text-ink-secondary hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0 opacity-80" />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header - white, minimal */}
        <header className="h-14 bg-white border-b border-border-soft flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="apple-btn p-2 rounded-xl text-ink-secondary hover:bg-surface-hover hover:text-ink"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-white pl-2.5 pr-1 py-1 focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand/40">
                <Calendar className="w-4 h-4 text-ink-tertiary shrink-0" aria-hidden />
                <label className="sr-only" htmlFor="from-date">From</label>
                <input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate}
                  className="apple-btn w-[7.25rem] border-0 bg-transparent text-sm text-ink focus:outline-none focus:ring-0 py-1.5 [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <span className="text-ink-tertiary text-sm font-medium">→</span>
                <label className="sr-only" htmlFor="to-date">To</label>
                <input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  className="apple-btn w-[7.25rem] border-0 bg-transparent text-sm text-ink focus:outline-none focus:ring-0 py-1.5 [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="apple-btn px-3 py-2 rounded-full border border-border bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                aria-label="Scenario"
              >
                <option value="base">Base</option>
                <option value="ramadan">Ramadan Peak</option>
                <option value="optimistic">Optimistic</option>
                <option value="pessimistic">Pessimistic</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 text-ink-tertiary text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System online
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#fafafa] p-6 md:p-8">
          <div className="animate-in max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        <footer className="h-11 bg-white border-t border-border-soft flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2 text-xs text-ink-tertiary">
            <span className="font-medium text-ink-secondary">How this is calculated</span>
            <span>·</span>
            <span>SKU demand → flour</span>
            <span>·</span>
            <span>Flour → recipes</span>
            <span>·</span>
            <span>Recipe → mill time</span>
            <span>·</span>
            <span>vs capacity</span>
          </div>
        </footer>
      </div>

      <Chatbot />
    </div>
  );
}
