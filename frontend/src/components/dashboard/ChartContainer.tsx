import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartContainer({ title, subtitle, children, className, action }: ChartContainerProps) {
  const hasOverflowVisible = className?.includes("overflow-visible");
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card w-full max-w-full min-w-0 box-border",
        hasOverflowVisible ? "overflow-visible" : "overflow-hidden",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("w-full max-w-full min-w-0 box-border", hasOverflowVisible ? "overflow-visible" : "overflow-hidden")}>
        {children}
      </div>
    </div>
  );
}
