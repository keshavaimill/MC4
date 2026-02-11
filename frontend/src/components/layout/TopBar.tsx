import { Link, useNavigate } from "react-router-dom";
import { Bell, Settings, HelpCircle, LogOut, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useFilters, type Scenario, type PeriodFilter } from "@/context/FilterContext";
import { useAuth } from "@/context/AuthContext";

export function TopBar() {
  const { periodFilter, setPeriodFilter, scenario, setScenario } = useFilters();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center gap-3 px-4">
        <SidebarTrigger className="-ml-1" />

        <Link to="/dashboard" className="mr-4 flex items-center gap-2">
          <img
            src="/MC4_Logo.webp"
            alt="MC4 logo"
            className="h-12 w-12 rounded-md object-contain"
          />
          <span className="text-2xl font-bold text-foreground">MC4</span>
        </Link>

        {/* Period Filter */}
        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <CalendarIcon className="h-3.5 w-3.5 mr-2" />
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
          <SelectTrigger className="h-8 w-36 text-xs">
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

        <div className="ml-auto" />

        {/* Alerts Badge */}
        <Link to="/alerts" className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Bell className="h-4 w-4" />
        </Link>

        <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Settings className="h-4 w-4" />
        </button>
        <button
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            logout();
            navigate("/", { replace: true });
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>
    </header>
  );
}
