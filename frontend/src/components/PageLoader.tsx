import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = "Loading…" }: PageLoaderProps) {
  return (
    <div className="flex h-64 items-center justify-center page-loader-enter">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-lg border-2 border-gray-200">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20"></div>
          <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-primary" />
        </div>
        <span className="text-sm font-medium text-gray-700">{message}</span>
      </div>
    </div>
  );
}
