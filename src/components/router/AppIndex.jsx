import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Outlet, useLocation } from "react-router-dom";
import { AppTopBar, PageContextBar } from "@/components/Header";
import AuthWrapper from "./AuthWrapper";
import { AppSidebar } from "../sidebars/AppSidebar";
import SessionLockGuard from "@/components/session/SessionLockGuard";
import { cn } from "@/lib/utils";

export default function AppIndex() {
  const location = useLocation();
  const isProductionCostingDetail = /\/sales\/markup\/costing\//.test(
    location.pathname,
  );
  const isHomePage =
    /\/app\/home\/?$/.test(location.pathname);

  return (
    <AuthWrapper>
      <SidebarProvider
        defaultOpen={true}
        className="aa-shell flex-col !min-h-svh"
      >
        {!isProductionCostingDetail && <AppTopBar />}
        <div className="flex min-h-0 w-full flex-1">
          <AppSidebar />
          <SidebarInset className="min-h-0 flex-1 overflow-hidden bg-[var(--dash-paper,#F1F2ED)]">
            {!isProductionCostingDetail && <PageContextBar />}
            <div
              className={cn(
                "flex w-full min-w-0 flex-1 flex-col overflow-auto",
                isProductionCostingDetail || isHomePage
                  ? "min-h-0 p-0"
                  : "min-h-0 p-3",
              )}
            >
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
      <SessionLockGuard />
    </AuthWrapper>
  );
}
