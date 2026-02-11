import { Link, useNavigate } from "react-router-dom";
import { Bell, Settings, HelpCircle, LogOut, CalendarIcon, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useFilters, type Scenario, type PeriodFilter } from "@/context/FilterContext";
import { useAuth } from "@/context/AuthContext";

function useASTTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function TopBar() {
  const { periodFilter, setPeriodFilter, scenario, setScenario } = useFilters();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const astTime = useASTTime();

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 pb-2 sm:px-4 md:px-6 bg-transparent">
      <div className="section-shell flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2">
        <SidebarTrigger className="-ml-1 shrink-0" />

        <Link to="/dashboard" className="mr-2 sm:mr-4 flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity shrink-0">
          <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl border border-border/70 bg-white/80 flex items-center justify-center shadow-card overflow-hidden shrink-0">
            <img
              src="/MC4_Logo.webp"
              alt="MC4 logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 hidden xs:block">
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground truncate">MC4</p>
            <span className="text-base sm:text-xl font-bold text-primary block truncate">Command Center</span>
          </div>
          <span className="text-xl sm:text-2xl font-bold text-primary xs:hidden">MC4</span>
        </Link>

        {/* Period Filter */}
        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
          <SelectTrigger className="h-9 w-44 text-sm border-2 border-gray-200 bg-white hover:border-primary/50 transition-colors">
            <CalendarIcon className="h-4 w-4 mr-2 text-gray-600" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Next 7 Days</SelectItem>
            <SelectItem value="30days">Next 30 Days</SelectItem>
            <SelectItem value="quarter">Next Quarter</SelectItem>
            <SelectItem value="year">Next Year</SelectItem>
          </SelectContent>
        </Select>

        {/* Scenario Switcher */}
        <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
          <SelectTrigger className="h-9 w-40 text-sm border-2 border-gray-200 bg-white hover:border-primary/50 transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="base">Scenario: Base</SelectItem>
            <SelectItem value="ramadan">Ramadan Surge</SelectItem>
            <SelectItem value="hajj">Hajj Season</SelectItem>
            <SelectItem value="eid_fitr">Eid al-Fitr</SelectItem>
            <SelectItem value="eid_adha">Eid al-Adha</SelectItem>
            <SelectItem value="summer">Summer Low</SelectItem>
            <SelectItem value="winter">Winter</SelectItem>
          </SelectContent>
        </Select>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span>AST {astTime}</span>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2" />

        {user && (
          <div className="hidden md:flex items-center gap-2 text-xs rounded-full border border-border/70 bg-white/70 px-3 py-1.5">
            <span className="font-semibold text-foreground truncate max-w-[100px]">{user.email}</span>
            <span className="text-muted-foreground capitalize">{user.role}</span>
          </div>
        )}

        <Link to="/alerts" className="relative rounded-full p-2 text-muted-foreground hover:bg-white/70 hover:text-foreground transition-colors" title="Alerts">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
        </Link>

        <button className="rounded-full p-2 text-muted-foreground hover:bg-white/70 hover:text-foreground transition-colors" title="Help">
          <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button className="rounded-full p-2 text-muted-foreground hover:bg-white/70 hover:text-foreground transition-colors" title="Settings">
          <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-card"
          onClick={() => {
            logout();
            navigate("/", { replace: true });
          }}
        >
          <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
