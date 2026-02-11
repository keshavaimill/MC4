import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { fetchAlerts } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, XCircle, ArrowRight } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";

interface Alert {
  type: string;
  severity: string;
  title: string;
  message: string;
  mill_id: string;
  period: string;
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
    case "high":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "warning":
    case "medium":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    default:
      return <Info className="h-4 w-4 text-primary" />;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === "critical" || severity === "high"
      ? "bg-destructive/10 text-destructive"
      : severity === "warning" || severity === "medium"
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", styles)}>{severity}</span>;
}

export default function Alerts() {
  const { queryParams } = useFilters();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAlerts(queryParams)
      .then((res) => {
        if (!cancelled) setAlerts(res.alerts as unknown as Alert[]);
      })
      .catch((err) => {
        if (!cancelled) console.error("Alerts load error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams.from_date, queryParams.to_date, queryParams.horizon]);

  const criticalCount = alerts.filter((a) => a.severity === "high" || a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning" || a.severity === "medium").length;

  const alertKpis = [
    { label: "Total Alerts", value: alerts.length.toString(), delta: alerts.length > 0 ? -alerts.length : 0, driver: "Active alerts" },
    { label: "Critical", value: criticalCount.toString(), delta: criticalCount > 0 ? -criticalCount : 0, driver: "Needs immediate attention" },
    { label: "Warnings", value: warningCount.toString(), delta: 0, driver: "Monitoring" },
    { label: "Info", value: (alerts.length - criticalCount - warningCount).toString(), delta: 0, driver: "Informational" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message="Loading alerts…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Alerts & Decisions</h1>
        <p className="text-sm text-muted-foreground">Priority alerts from capacity analysis</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {alertKpis.map((kpi) => (
          <KpiTile key={kpi.label} {...kpi} />
        ))}
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Info className="mx-auto mb-3 h-8 w-8 text-success" />
          <h3 className="text-lg font-semibold text-foreground">No Active Alerts</h3>
          <p className="mt-1 text-sm text-muted-foreground">All mills are operating within capacity for the selected period.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
                  alert.severity === "high" || alert.severity === "critical"
                    ? "border-l-4 border-l-destructive"
                    : alert.severity === "warning" || alert.severity === "medium"
                      ? "border-l-4 border-l-warning"
                      : "border-l-4 border-l-primary"
                )}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <SeverityIcon severity={alert.severity} />
                    <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
                  </div>
                  <SeverityBadge severity={alert.severity} />
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{alert.message}</p>
                <div className="mb-3 flex gap-4 text-xs">
                  <span className="text-muted-foreground">
                    Mill: <strong className="font-mono text-foreground">{alert.mill_id}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Period: <strong className="font-mono text-foreground">{alert.period}</strong>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <button className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                    Investigate <ArrowRight className="h-3 w-3" />
                  </button>
                  <span className="text-[10px] text-muted-foreground capitalize">{alert.type?.replace("_", " ")}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Alert Register Table */}
          <ChartContainer title="Alert Register" subtitle="Tabular view of all active alerts">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary">
                    {["Alert", "Type", "Severity", "Mill", "Period", "Message"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert, i) => (
                    <tr key={i} className={cn("border-t border-border", i % 2 === 0 ? "bg-card" : "bg-accent/30")}>
                      <td className="px-3 py-2.5 text-xs font-medium">{alert.title}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{alert.type?.replace("_", " ")}</td>
                      <td className="px-3 py-2.5"><SeverityBadge severity={alert.severity} /></td>
                      <td className="px-3 py-2.5 font-mono text-xs">{alert.mill_id}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{alert.period}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[300px] truncate">{alert.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartContainer>
        </>
      )}
    </DashboardLayout>
  );
}
