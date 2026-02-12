import { useState } from "react";
import { ChevronUp, ChevronDown, Info, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "logic",
    icon: Info,
    title: "SKU \u2192 Flour \u2192 Recipe \u2192 Time Logic",
    content: [
      "1. SKU demand is aggregated by flour type (10kg, 25kg, 50kg, Bulk, Wholesale)",
      "2. Flour demand is split across eligible recipes using the eligibility matrix",
      "3. Each recipe\u2019s demand is converted to mill hours using hours-per-run rates",
      "4. Mill hours are compared against available weekly capacity across 12-week horizon",
      "5. Overloads trigger redistribution recommendations via the AI engine",
    ],
  },
  {
    id: "yield",
    icon: Clock,
    title: "Yield Assumptions",
    rows: [
      ["80 Straight", "96.8%", "480 hrs/run", "SAR 320/ton"],
      ["80/70 Blend", "97.2%", "360 hrs/run", "SAR 295/ton"],
      ["72/60 Blend", "95.9%", "300 hrs/run", "SAR 340/ton"],
      ["Special Blend", "97.8%", "240 hrs/run", "SAR 380/ton"],
    ],
  },
  {
    id: "capacity",
    icon: Shield,
    title: "Capacity Rules",
    content: [
      "\u2022 Each mill operates on a fixed weekly hour budget (A: 120h, B: 100h, C: 90h)",
      "\u2022 Utilization >95% triggers an overload alert",
      "\u2022 Recipe changeovers add 2\u20134 hours of downtime per swap",
      "\u2022 Maintenance windows reduce available hours and are pre-scheduled",
      "\u2022 Capacity is never borrowed across mills \u2014 redistribution requires explicit action",
    ],
  },
];

export function ExplainabilityFooter() {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <footer className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-10 w-full items-center justify-between px-5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/40"
      >
        <div className="flex items-center gap-3">
          <Info className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">How was this calculated?</span>
          <span className="text-border">|</span>
          <span>Last refresh: {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Confidence 92%
          </span>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="max-h-[300px] overflow-y-auto border-t border-border bg-background px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            {sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-border bg-card p-3.5 shadow-card">
                <button
                  onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                  className="flex w-full items-center gap-2.5 text-left hover:opacity-80 transition-opacity"
                >
                  <section.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground">{section.title}</span>
                  {activeSection === section.id ? (
                    <ChevronUp className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>

                {activeSection === section.id && (
                  <div className="mt-3 space-y-1.5">
                    {section.content && section.content.map((line, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{line}</p>
                    ))}
                    {section.rows && (
                      <table className="w-full text-[11px] mt-2">
                        <thead>
                          <tr className="border-b border-border">
                            {["Recipe", "Yield", "Time", "Cost"].map((h) => (
                              <th key={h} className="pb-1.5 text-left font-semibold text-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row, i) => (
                            <tr key={i} className="border-b border-border/50">
                              {row.map((cell, j) => (
                                <td key={j} className={cn("py-1.5", j === 0 ? "font-medium text-foreground" : "font-mono text-muted-foreground")}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </footer>
  );
}
