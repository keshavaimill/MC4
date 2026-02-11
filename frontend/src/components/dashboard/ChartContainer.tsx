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
    <div className={cn("section-shell hover-lift rounded-2xl sm:rounded-[1.25rem] border border-border/60 bg-white/90 p-4 sm:p-5 lg:p-6 w-full max-w-full min-w-0 box-border", hasOverflowVisible ? "overflow-visible" : "overflow-hidden", className)}>
      <div className="mb-4 lg:mb-5 pb-3 border-b border-border/60">
        <h3 className="text-lg sm:text-xl font-semibold leading-tight text-foreground">{title}</h3>
        {subtitle && <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className={cn("w-full max-w-full min-w-0 box-border", hasOverflowVisible ? "overflow-visible" : "overflow-hidden")}>
        {children}
      </div>
    </div>
  );
}
