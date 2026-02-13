import { useState, useEffect } from 'react';
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
  Leaf,
  LogOut,
  User,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Chatbot from './Chatbot';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  fromDate: Date;
  setFromDate: (date: Date) => void;
  toDate: Date;
  setToDate: (date: Date) => void;
  scenario: string;
  setScenario: (scenario: string) => void;
  userRole?: string;
  onLogout?: () => void;
}

const navigation = [
  { id: 'executive', label: 'Executive Summary', icon: LayoutDashboard },
  { id: 'demand', label: 'Demand → Recipe', icon: TrendingUp },
  { id: 'recipe', label: 'Recipe & Mill Planning', icon: Settings },
  { id: 'capacity', label: 'Mill Runtime & Sequencing', icon: Factory },
  { id: 'rawmaterials', label: 'Raw Materials & Wheat', icon: Package },
  { id: 'waste', label: 'Waste & Vision 2030', icon: Leaf },
  { id: 'alerts', label: 'Alerts & Decisions', icon: AlertTriangle },
  { id: 'reports', label: 'Reports & Emails', icon: FileText },
];

const roleLabels: Record<string, string> = {
  ceo: 'CEO / COO',
  planning: 'Sales & Planning',
  operations: 'Operations',
};

export default function Layout({
  children,
  activeScreen,
  setActiveScreen,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  scenario,
  setScenario,
  userRole = '',
  onLogout,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setLastRefresh(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'
          } bg-card border-r border-border transition-all duration-300 flex flex-col shadow-card`}
      >
        {/* Logo */}
        <div className="h-16 border-b border-border flex items-center px-4 bg-muted/30">
          {sidebarOpen ? (
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12 flex-shrink-0">
                <img src="/logo/MC4_Logo.jpeg" alt="MC4 Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground">MC4</h1>
                <p className="text-xs text-muted-foreground">Enterprise Planning</p>
              </div>
            </div>
          ) : (
            <div className="relative w-10 h-10 mx-auto flex-shrink-0">
              <img src="/logo/MC4_Logo.jpeg" alt="MC4 Logo" className="w-full h-full object-contain" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ease-out ${isActive
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'text-foreground hover:bg-accent hover:text-primary'
                  }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User / Role Badge & Logout */}
        {sidebarOpen && (
          <div className="p-3 border-t border-border space-y-2">
            <div className="flex items-center space-x-2 px-2">
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{roleLabels[userRole] || 'User'}</p>
                <p className="text-[10px] text-muted-foreground">Active Session</p>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center space-x-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-200 ease-out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        )}

        {/* Wheat Grain at Bottom */}
        <div className="p-3 border-t border-border flex items-center justify-center">
          <img
            src="/Wheat_grain2.svg"
            alt=""
            className={`${sidebarOpen ? 'w-24 h-24' : 'w-14 h-14'} object-contain pointer-events-none opacity-50 transition-all duration-300`}
            style={{ filter: 'sepia(50%) saturate(80%) brightness(0.9)' }}
          />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 shadow-card">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-primary"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center space-x-3">
              {/* From Date Picker */}
              <div className="relative flex items-center space-x-2">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">From:</span>
                <div className="relative">
                  <DatePicker
                    selected={fromDate}
                    onChange={(date: Date | null) => date && setFromDate(date)}
                    selectsStart
                    startDate={fromDate}
                    endDate={toDate}
                    maxDate={toDate}
                    dateFormat="MMM dd, yyyy"
                    className="pl-9 pr-3 py-1.5 border border-input rounded-lg text-sm font-medium text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all w-36 cursor-pointer hover:border-primary/50"
                    calendarClassName="shadow-card border border-border rounded-lg"
                    popperClassName="!z-[9999]"
                  />
                  <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* To Date Picker */}
              <div className="relative flex items-center space-x-2">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">To:</span>
                <div className="relative">
                  <DatePicker
                    selected={toDate}
                    onChange={(date: Date | null) => date && setToDate(date)}
                    selectsEnd
                    startDate={fromDate}
                    endDate={toDate}
                    minDate={fromDate}
                    dateFormat="MMM dd, yyyy"
                    className="pl-9 pr-3 py-1.5 border border-input rounded-lg text-sm font-medium text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all w-36 cursor-pointer hover:border-primary/50"
                    calendarClassName="shadow-card border border-border rounded-lg"
                    popperClassName="!z-[9999]"
                  />
                  <Calendar className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="px-3 py-1.5 border border-input rounded-lg text-sm font-medium text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
              >
                <option value="base">Base Scenario</option>
                <option value="ramadan">Ramadan Peak (+35%)</option>
                <option value="hajj">Hajj Season (+25%)</option>
                <option value="eid_fitr">Eid al-Fitr (+20%)</option>
                <option value="eid_adha">Eid al-Adha (+22%)</option>
                <option value="summer">Summer Peak (+15%)</option>
                <option value="winter">Winter Normal (-5%)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-foreground font-medium">System Online</span>
            </div>
          </div>
        </header>

        {/* Main Canvas */}
        <main className="flex-1 overflow-y-auto bg-background p-6 relative">
          {/* Decorative Wheat Graphics */}
          <div
            className="fixed top-0 right-0 h-screen w-[600px] pointer-events-none z-0 flex items-start justify-start"
            style={{ opacity: 0.25 }}
          >
            <img
              src="/Wheat_grain2.svg"
              alt=""
              className="h-[100%] w-auto object-contain max-w-full"
              style={{ filter: 'sepia(50%) saturate(80%) brightness(0.9)', transform: 'rotate(90deg)' }}
            />
          </div>

          {/* Content Layer */}
          <div className="relative z-10">{children}</div>
        </main>

        {/* Explainability Footer (Global - Section 10) */}
        <footer className="bg-card border-t border-border px-6 py-2 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground">ℹ How was this calculated?</span>
              <span className="text-muted-foreground/60">|</span>
              <span>SKU → Flour → Recipe → Time logic</span>
              <span className="text-muted-foreground/60">•</span>
              <span>Yield: 96–98%</span>
              <span className="text-muted-foreground/60">•</span>
              <span>Capacity: 1 recipe/mill at a time</span>
              <span className="text-muted-foreground/60">•</span>
              <span>Confidence: 82%</span>
            </div>
            <div className="text-[10px] text-muted-foreground/70 whitespace-nowrap ml-4">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </footer>
      </div>

      {/* Floating Chatbot */}
      <Chatbot />
    </div>
  );
}
