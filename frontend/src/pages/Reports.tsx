import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { useFilters } from "@/context/FilterContext";
import { downloadReportCsv, emailReport } from "@/lib/api";
import { Download, Send, Loader2, ClipboardList, Gauge, TrendingUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const reportDefinitions = [
  {
    id: "monthly-plan",
    title: "Monthly Recipe Plan",
    type: "automated" as const,
    schedule: "1st of each month",
    description: "Recipe scheduling across all mills",
    icon: ClipboardList,
  },
  {
    id: "capacity-outlook",
    title: "Capacity Outlook",
    type: "automated" as const,
    schedule: "Every Monday 8:00 AM",
    description: "Mill utilization and overload analysis",
    icon: Gauge,
  },
  {
    id: "demand-forecast",
    title: "Demand Forecast",
    type: "on-demand" as const,
    schedule: "Manual",
    description: "SKU forecast breakdown by flour type",
    icon: TrendingUp,
  },
  {
    id: "raw-material",
    title: "Raw Material Report",
    type: "on-demand" as const,
    schedule: "Manual",
    description: "Wheat sourcing, prices, and availability",
    icon: Package,
  },
];

export default function Reports() {
  const { queryParams } = useFilters();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  const handleDownload = async (reportId: string) => {
    setDownloadingId(reportId);
    try {
      await downloadReportCsv(reportId, queryParams);
      toast({ title: "Download started", description: `${reportId} CSV is downloading.` });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEmail = async (reportId: string) => {
    setEmailingId(reportId);
    try {
      const result = await emailReport(reportId, queryParams);
      toast({ title: "Email sent", description: result.message || "Report emailed successfully." });
    } catch (err: any) {
      toast({
        title: "Email not sent",
        description: err.message?.includes("503") ? "Email service not configured on the server." : err.message,
        variant: "destructive",
      });
    } finally {
      setEmailingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Analysis</p>
        <h1 className="text-2xl font-semibold text-foreground">Reports & Emails</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Download CSV reports or email them directly from the backend</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Report List */}
        <ChartContainer title="Available Reports" subtitle="Download or email any report for the current filter period">
          <div className="space-y-3">
            {reportDefinitions.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      report.type === "automated" ? "bg-accent" : "bg-muted"
                    )}
                  >
                    {(() => {
                      const Icon = report.icon;
                      return (
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            report.type === "automated" ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{report.title}</p>
                    <p className="text-[11px] text-muted-foreground">{report.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                    onClick={() => handleEmail(report.id)}
                    disabled={emailingId === report.id}
                    title="Email report"
                  >
                    {emailingId === report.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                    onClick={() => handleDownload(report.id)}
                    disabled={downloadingId === report.id}
                    title="Download CSV"
                  >
                    {downloadingId === report.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ChartContainer>

        {/* Filter Info */}
        <ChartContainer title="Current Filters" subtitle="Reports are generated with these parameters">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">From Date</span>
                <span className="font-mono text-foreground">{queryParams.from_date}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">To Date</span>
                <span className="font-mono text-foreground">{queryParams.to_date}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="font-medium text-muted-foreground">Horizon</span>
                <span className="font-mono text-foreground capitalize">{queryParams.horizon}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">Scenario</span>
                <span className="font-mono text-foreground capitalize">{queryParams.scenario}</span>
              </div>
            </div>

          </div>
        </ChartContainer>
      </div>
    </DashboardLayout>
  );
}
