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
          "group relative flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-4 sm:p-5 text-left cursor-pointer w-full min-w-0 overflow-hidden box-border shadow-card hover:shadow-elevated transition-shadow duration-200"
        )}
      >
        {/* Label row */}
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate w-full block">
          {label}
        </span>

        {/* Value + unit */}
        <div className="flex items-baseline gap-1.5 min-w-0 w-full">
          <span className={cn("font-semibold tracking-tight text-foreground truncate", getKpiFontSize(value))}>
            {value}
          </span>
          {unit && <span className="text-xs text-muted-foreground flex-shrink-0 font-medium">{unit}</span>}
        </div>

        {/* Delta badge */}
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600",
            )}
          >
            {isPositive ? "\u2191" : "\u2193"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}

        {driver && <span className="text-[11px] text-muted-foreground truncate w-full leading-snug mt-0.5">{driver}</span>}
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
