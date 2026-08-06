import { useMemo } from "react";
import { NavMain } from "@/components/sidebars/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getSidebarByAppType } from "./sidebarModules";
import { useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import { Home, PanelLeftClose } from "lucide-react";

export function AppSidebar(props) {
  // eslint-disable-next-line react/prop-types -- optional layout class from parent
  const { className: sidebarClassName, ...sidebarProps } = props;
  const { toggleSidebar } = useSidebar();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  // Alh. Ashiru Yanmusa is retail-only — always use retailers modules regardless of business_type
  const sidebarItems = useMemo(() => {
    return getSidebarByAppType("retailers")
      .map((module) => {
        if (!module.items?.length) return module;
        return {
          ...module,
          items: module.items.filter((item) => {
            const flag = item.requiresBusinessFlag;
            if (!flag) return true;
            if (flag === "enable_material_requisition") {
              return activeBusiness?.[flag] !== false;
            }
            return !!activeBusiness?.[flag];
          }),
        };
      })
      .filter((module) => !module.items || module.items.length > 0);
  }, [activeBusiness]);

  return (
    <Sidebar
      {...sidebarProps}
      collapsible="icon"
      variant="sidebar"
      className={cn(
        "border-r border-[hsl(var(--sidebar-border))] text-[hsl(var(--sidebar-foreground))]",
        "[&_[data-sidebar=sidebar]]:!bg-[var(--aa-sidebar-bg)]",
        "[&_[data-sidebar=sidebar]]:text-[hsl(var(--sidebar-foreground))]",
        "[&_[data-sidebar=sidebar]]:shadow-none",
        sidebarClassName,
      )}
    >
      <SidebarHeader className="border-b border-[hsl(var(--sidebar-border))] px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[active=true]:bg-[var(--aa-sidebar-active)] data-[active=true]:text-[var(--aa-accent)]"
            >
              <NavLink
                to="/app/home"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2",
                    isActive && "font-semibold text-[var(--aa-accent)]",
                  )
                }
              >
                <Home className="size-4" />
                <span>Home</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1">
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter className="border-t border-[hsl(var(--sidebar-border))] py-2 mt-auto shrink-0 gap-1 overflow-hidden">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Collapse sidebar"
          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-accent)] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <PanelLeftClose className="size-4 shrink-0" />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Collapse
          </span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
