import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface KpiDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  value: string;
  unit?: string;
  driver?: string;
}

const drilldownData: Record<string, { chartData: { name: string; value: number }[]; description: string }> = {
  "Total Demand": {
    chartData: [
      { name: "Central", value: 2800 },
      { name: "Western", value: 3400 },
      { name: "Eastern", value: 2600 },
      { name: "Southern", value: 1980 },
      { name: "Northern", value: 1700 },
    ],
    description: "Demand breakdown by region. Western region leads with a +12% MoM increase driven by Ramadan preparation.",
  },
  "Recipe Time Util.": {
    chartData: [
      { name: "Mill A", value: 96 },
      { name: "Mill B", value: 87 },
      { name: "Mill C", value: 79 },
    ],
    description: "Utilization across mills. Mill A is at critical capacity. Mill C has headroom due to maintenance scheduling.",
  },
  "Capacity Violations": {
    chartData: [
      { name: "W7", value: 0 },
      { name: "W8", value: 1 },
      { name: "W9", value: 2 },
      { name: "W10", value: 3 },
      { name: "W11", value: 1 },
      { name: "W12", value: 2 },
    ],
    description: "Violations spiked in W9-W10 due to seasonal demand surge. Most violations at Mill C.",
  },
  "Avg Cost/Ton": {
    chartData: [
      { name: "80 Straight", value: 320 },
      { name: "80/70", value: 295 },
      { name: "72/60", value: 340 },
      { name: "Special", value: 380 },
    ],
    description: "Cost per ton by recipe. Special Blend commands the highest cost due to premium wheat requirements.",
  },
  "Waste Rate": {
    chartData: [
      { name: "80 Straight", value: 3.2 },
      { name: "80/70", value: 2.8 },
      { name: "72/60", value: 4.1 },
      { name: "Special", value: 2.2 },
    ],
    description: "Waste percentage by recipe. 72/60 is the worst performer and is being optimized.",
  },
  "Vision 2030 Score": {
    chartData: [
      { name: "Q1", value: 68 },
      { name: "Q2", value: 72 },
      { name: "Q3", value: 75 },
      { name: "Q4", value: 78 },
    ],
    description: "Quarterly sustainability progress. On track to reach 85/100 by end of 2026.",
  },
};

export function KpiDrilldownModal({ open, onOpenChange, label, value, unit, driver }: KpiDrilldownModalProps) {
  const data = drilldownData[label] || { chartData: [], description: "Detailed data for this metric." };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            {label}
            <span className="font-mono text-2xl text-primary">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </DialogTitle>
          <DialogDescription>{driver}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{data.description}</p>

        {data.chartData.length > 0 && (
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
