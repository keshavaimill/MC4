import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { ExplainabilityFooter } from "./ExplainabilityFooter";
import Chatbot from "@/components/Chatbot";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-col h-full w-full overflow-hidden bg-background">
          <TopBar />
          <main className="flex-1 overflow-y-auto w-full overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
              {children}
            </div>
          </main>
          <ExplainabilityFooter />
        </div>
      </SidebarInset>
      <Chatbot />
    </SidebarProvider>
  );
}
