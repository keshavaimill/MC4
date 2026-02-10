import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Settings, User, HelpCircle, LogOut, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useFilters, type Scenario } from "@/context/FilterContext";
import { useAuth } from "@/context/AuthContext";
import { format, parseISO } from "date-fns";

interface TopBarProps {
  onOpenAI?: () => void;
}

export function TopBar({ onOpenAI }: TopBarProps) {
  const { fromDate, toDate, setFromDate, setToDate, scenario, setScenario } = useFilters();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const parsedFrom = parseISO(fromDate);
  const parsedTo = parseISO(toDate);

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

        {/* Date From Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs text-muted-foreground hover:bg-accent">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>From: {format(parsedFrom, "dd MMM yyyy")}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedFrom}
              onSelect={(date) => date && setFromDate(format(date, "yyyy-MM-dd"))}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs text-muted-foreground hover:bg-accent">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>To: {format(parsedTo, "dd MMM yyyy")}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parsedTo}
              onSelect={(date) => date && setToDate(format(date, "yyyy-MM-dd"))}
              initialFocus
            />
          </PopoverContent>
        </Popover>

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

        {/* AI Search */}
        <button
          onClick={onOpenAI}
          className="ml-auto flex h-8 w-64 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-accent"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Ask AI anything...</span>
        </button>

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
