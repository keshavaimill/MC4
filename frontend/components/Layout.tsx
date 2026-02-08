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
  X
} from 'lucide-react';
import Chatbot from './Chatbot';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  horizon: 'week' | 'month' | 'year';
  setHorizon: (horizon: 'week' | 'month' | 'year') => void;
  scenario: string;
  setScenario: (scenario: string) => void;
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
  horizon,
  setHorizon,
  scenario,
  setScenario,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 border-b border-gray-200 flex items-center px-4">
          {sidebarOpen ? (
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  src="/logo/MC4_Logo.jpeg"
                  alt="MC4 Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900">MC4</h1>
                <p className="text-xs text-gray-500">AI Command Center</p>
              </div>
            </div>
          ) : (
            <div className="relative w-10 h-10 mx-auto flex-shrink-0">
              <Image
                src="/logo/MC4_Logo.jpeg"
                alt="MC4 Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-mc4-blue text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center space-x-2">
              <select
                value={horizon}
                onChange={(e) => setHorizon(e.target.value as 'week' | 'month' | 'year')}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-mc4-blue"
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
              
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-mc4-blue"
              >
                <option value="base">Base Scenario</option>
                <option value="ramadan">Ramadan Peak</option>
                <option value="optimistic">Optimistic</option>
                <option value="pessimistic">Pessimistic</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setChatbotOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-mc4-blue text-white rounded-lg hover:bg-mc4-dark transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Ask AI</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">System Online</span>
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>

        {/* Explainability Footer */}
        <footer className="h-12 bg-white border-t border-gray-200 flex items-center px-6">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span className="font-medium">ℹ How was this calculated?</span>
            <span>•</span>
            <span>SKU demand aggregated to flour</span>
            <span>•</span>
            <span>Flour split across eligible recipes</span>
            <span>•</span>
            <span>Recipe converted to mill time</span>
            <span>•</span>
            <span>Compared against available capacity</span>
          </div>
        </footer>
      </div>

      {/* Chatbot */}
      {chatbotOpen && (
        <Chatbot onClose={() => setChatbotOpen(false)} />
      )}
    </div>
  );
}
