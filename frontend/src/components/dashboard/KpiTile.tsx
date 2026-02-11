import { useState } from "react";
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
          "section-shell hover-lift group relative flex flex-col items-start gap-2 rounded-2xl sm:rounded-[1.25rem] border border-border/60 bg-white/90 p-4 sm:p-5 lg:p-6 text-left cursor-pointer w-full min-w-0 overflow-hidden box-border"
        )}
      >
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">KPI</span>
          {delta !== undefined && (
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold whitespace-nowrap",
              isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            )}>
              {isPositive ? "↑" : "↓"} {Math.abs(delta).toFixed(2)}%
            </span>
          )}
        </div>
        <span className="text-xs sm:text-sm uppercase tracking-[0.2em] text-muted-foreground/90 truncate w-full block">{label}</span>
        <div className="flex items-baseline gap-2 min-w-0 w-full mt-2">
          <span className={cn("font-semibold tracking-tight text-foreground truncate", getKpiFontSize(value))}>{value}</span>
          {unit && <span className="text-sm lg:text-base text-muted-foreground flex-shrink-0 font-medium">{unit}</span>}
        </div>
        {driver && <span className="text-xs text-muted-foreground truncate w-full mt-2 leading-snug">{driver}</span>}
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
