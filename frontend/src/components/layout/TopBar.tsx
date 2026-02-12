import { Link, useNavigate } from "react-router-dom";
import { Bell, Settings, HelpCircle, LogOut, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useFilters, type Scenario } from "@/context/FilterContext";
import { useAuth } from "@/context/AuthContext";
import { DateRangeFilter } from "@/components/layout/DateRangeFilter";

function useASTTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function TopBar() {
  const { scenario, setScenario } = useFilters();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const astTime = useASTTime();

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 pb-2 sm:px-4 md:px-6 bg-transparent">
      <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 rounded-xl border border-border bg-card/95 backdrop-blur-lg px-3 sm:px-5 shadow-card">
        <SidebarTrigger className="-ml-1 shrink-0" />

        <Link to="/dashboard" className="mr-2 sm:mr-4 flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity shrink-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
            <img
              src="/MC4_Logo.webp"
              alt="MC4 logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 hidden xs:block">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">MC4</p>
            <span className="text-sm sm:text-base font-bold text-foreground block truncate">Command Center</span>
          </div>
          <span className="text-lg font-bold text-foreground xs:hidden">MC4</span>
        </Link>

        {/* Date Range Filter */}
        <DateRangeFilter className="w-auto" />

        {/* Scenario Switcher */}
        <Select value={scenario} onValueChange={(v) => setScenario(v as Scenario)}>
          <SelectTrigger className="h-8 w-36 text-xs border border-border bg-background hover:border-primary/40 transition-colors rounded-lg">
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

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>AST {astTime}</span>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          {user && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px] rounded-lg border border-border bg-background/80 px-2.5 py-1">
              <span className="font-semibold text-foreground truncate max-w-[100px]">{user.email}</span>
              <span className="text-muted-foreground capitalize">{user.role}</span>
            </div>
          )}

          <Link to="/alerts" className="relative rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Alerts">
            <Bell className="h-4 w-4" />
          </Link>
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Help">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
          <button
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
            onClick={() => { logout(); navigate("/", { replace: true }); }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
