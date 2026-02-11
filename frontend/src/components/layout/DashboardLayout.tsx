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
        <div className="flex flex-col h-full w-full overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto w-full overflow-x-hidden">
            <div className="mx-auto w-full p-3 sm:p-4 md:p-6">{children}</div>
          </main>
          <ExplainabilityFooter />
        </div>
      </SidebarInset>
      {/* Floating Text2SQL Bot */}
      <Chatbot />
    </SidebarProvider>
  );
}
