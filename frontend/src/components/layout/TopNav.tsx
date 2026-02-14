import { Link, useLocation } from "react-router-dom";
import { Settings, HelpCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Executive", path: "/dashboard" },
  { label: "Demand", path: "/demand" },
  { label: "Planning", path: "/planning" },
  { label: "Materials", path: "/materials" },
  { label: "Waste", path: "/waste" },
  { label: "Alerts", path: "/alerts" },
];

export function TopNav() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center px-6">
        <Link to="/dashboard" className="mr-8 flex items-center gap-2">
          <img
            src="/MC4_Logo.webp"
            alt="MC4 logo"
            className="h-7 w-7 rounded-sm object-contain"
          />
          <span className="text-xl font-bold text-foreground">MC4</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Settings className="h-4 w-4" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    </header>
  );
}

