import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn, getKpiFontSize } from "@/lib/utils";
import { KpiDrilldownModal } from "./KpiDrilldownModal";

interface KpiTileProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  driver?: string;
  onClick?: () => void;
}

export function KpiTile({ label, value, unit, delta, driver, onClick }: KpiTileProps) {
  const [drillOpen, setDrillOpen] = useState(false);
  const isPositive = delta !== undefined && delta >= 0;

  return (
    <>
      <button
        onClick={onClick || (() => setDrillOpen(true))}
        className={cn(
          "flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 lg:p-4 text-left shadow-sm transition-all hover:shadow-md cursor-pointer w-full min-w-0 overflow-hidden box-border"
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate w-full">{label}</span>
        <div className="flex items-baseline gap-1.5 min-w-0 w-full">
          <span className={cn("font-mono font-bold text-foreground truncate", getKpiFontSize(value))}>{value}</span>
          {unit && <span className="text-xs lg:text-sm text-muted-foreground flex-shrink-0">{unit}</span>}
        </div>
        {delta !== undefined && (
          <div className={cn("flex items-center gap-1 text-xs lg:text-sm font-medium whitespace-nowrap", isPositive ? "text-success" : "text-destructive")}>
            {isPositive ? <ArrowUp className="h-3 w-3 lg:h-3.5 lg:w-3.5 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 lg:h-3.5 lg:w-3.5 flex-shrink-0" />}
            <span>{Math.abs(delta).toFixed(2)}%</span>
          </div>
        )}
        {driver && <span className="text-xs italic text-muted-foreground truncate w-full">{driver}</span>}
      </button>
      <KpiDrilldownModal
        open={drillOpen}
        onOpenChange={setDrillOpen}
        label={label}
        value={value}
        unit={unit}
        driver={driver}
      />
    </>
  );
}
