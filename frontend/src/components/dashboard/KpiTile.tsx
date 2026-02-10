import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
          "flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md cursor-pointer"
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-bold text-foreground">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {delta !== undefined && (
          <div className={cn("flex items-center gap-1 text-sm font-medium", isPositive ? "text-success" : "text-destructive")}>
            {isPositive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            <span>{Math.abs(delta)}%</span>
          </div>
        )}
        {driver && <span className="text-xs italic text-muted-foreground">{driver}</span>}
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
