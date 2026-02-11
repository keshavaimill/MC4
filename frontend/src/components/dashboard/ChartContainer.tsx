import { cn } from "@/lib/utils";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({ title, subtitle, children, className }: ChartContainerProps) {
  const hasOverflowVisible = className?.includes("overflow-visible");
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 lg:p-4 shadow-sm w-full max-w-full min-w-0 box-border", hasOverflowVisible ? "overflow-visible" : "overflow-hidden", className)}>
      <div className="mb-3 lg:mb-4">
        <h3 className="text-base lg:text-lg font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs lg:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className={cn("w-full max-w-full min-w-0 box-border", hasOverflowVisible ? "overflow-visible" : "overflow-hidden")}>
        {children}
      </div>
    </div>
  );
}
