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
        <div className="flex flex-col h-full w-full overflow-hidden bg-gradient-to-b from-white to-gray-50/80">
          <TopBar />
          <main className="flex-1 overflow-y-auto w-full overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1700px] p-4 sm:p-6 lg:px-8 xl:px-10 py-6 sm:py-8 lg:py-10">{children}</div>
          </main>
          <ExplainabilityFooter />
        </div>
      </SidebarInset>
      {/* Floating Text2SQL Bot */}
      <Chatbot />
    </SidebarProvider>
  );
}
