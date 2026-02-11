import { useState } from "react";
import { ChevronUp, ChevronDown, Info, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "logic",
    icon: Info,
    title: "SKU → Flour → Recipe → Time Logic",
    content: [
      "1. SKU demand is aggregated by flour type (10kg, 25kg, 50kg, Bulk, Wholesale)",
      "2. Flour demand is split across eligible recipes using the eligibility matrix",
      "3. Each recipe's demand is converted to mill hours using hours-per-run rates",
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
      "• Each mill operates on a fixed weekly hour budget (A: 120h, B: 100h, C: 90h)",
      "• Utilization >95% triggers an overload alert",
      "• Recipe changeovers add 2-4 hours of downtime per swap",
      "• Maintenance windows reduce available hours and are pre-scheduled",
      "• Capacity is never borrowed across mills — redistribution requires explicit action",
    ],
  },
];

export function ExplainabilityFooter() {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <footer className="sticky bottom-0 z-40 border-t-2 border-gray-200 bg-white/95 backdrop-blur shadow-lg supports-[backdrop-filter]:bg-white/90">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-12 w-full items-center justify-between px-6 text-xs text-gray-600 transition-colors duration-200 ease-out hover:text-gray-900 hover:bg-gray-50"
      >
        <div className="flex items-center gap-4">
          <Info className="h-4 w-4 text-primary" />
          <span className="font-semibold text-gray-900">How was this calculated?</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-600">Last refresh: {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            Confidence: 92%
          </span>
        </div>
        {expanded ? <ChevronDown className="h-5 w-5 text-gray-600" /> : <ChevronUp className="h-5 w-5 text-gray-600" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="max-h-[320px] overflow-y-auto border-t-2 border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            {sections.map((section) => (
              <div key={section.id} className="rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                <button
                  onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                  className="flex w-full items-center gap-3 text-left hover:opacity-80 transition-opacity"
                >
                  <section.icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-bold text-gray-900">{section.title}</span>
                  {activeSection === section.id ? (
                    <ChevronUp className="ml-auto h-4 w-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="ml-auto h-4 w-4 text-gray-600" />
                  )}
                </button>

                {activeSection === section.id && (
                  <div className="mt-4 space-y-2">
                    {section.content && section.content.map((line, i) => (
                      <p key={i} className="text-xs text-gray-700 leading-relaxed">{line}</p>
                    ))}
                    {section.rows && (
                      <table className="w-full text-xs mt-3">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            {["Recipe", "Yield", "Time", "Cost"].map((h) => (
                              <th key={h} className="pb-2 text-left font-bold text-gray-700">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              {row.map((cell, j) => (
                                <td key={j} className={cn("py-2", j === 0 ? "font-semibold text-gray-900" : "font-mono text-gray-600")}>{cell}</td>
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
