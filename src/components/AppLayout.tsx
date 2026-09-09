import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import AvisosPopup from "@/components/AvisosPopup";
import InatividadeMonitor from "@/components/InatividadeMonitor";
import { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border bg-card sticky top-0 z-10">
            <SidebarTrigger className="ml-3" />
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <AvisosPopup />
      <InatividadeMonitor />
    </SidebarProvider>
  );
};

export default AppLayout;
