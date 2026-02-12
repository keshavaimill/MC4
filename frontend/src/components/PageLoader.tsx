import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = "Loading\u2026" }: PageLoaderProps) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3 rounded-xl bg-card border border-border p-8 shadow-card">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}
