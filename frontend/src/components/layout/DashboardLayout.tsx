import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { ExplainabilityFooter } from "./ExplainabilityFooter";
import { AIAssistant } from "./AIAssistant";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <TopBar onOpenAI={() => setAiOpen(true)} />
          <main className="mx-auto w-full max-w-[1440px] flex-1 p-6">{children}</main>
          <ExplainabilityFooter />
        </div>
      </div>
      <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
    </SidebarProvider>
  );
}
