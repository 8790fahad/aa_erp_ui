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
  const { toggleSidebar, state } = useSidebar();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const collapsed = state === "collapsed";

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
        "dash-sidebar border-r-0 text-[#C7CCDA]",
        "[&_[data-sidebar=sidebar]]:!bg-[var(--aa-navy,#1a2d5e)]",
        "[&_[data-sidebar=sidebar]]:text-[#C7CCDA]",
        "[&_[data-sidebar=sidebar]]:shadow-none",
        sidebarClassName,
      )}
    >
      <SidebarHeader className="border-b border-white/10 px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-auto rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-[#B4BACB] hover:bg-[#182642] hover:text-[#F1F2ED] data-[active=true]:bg-[var(--dash-primary,#1b7a5b)] data-[active=true]:font-semibold data-[active=true]:text-white"
            >
              <NavLink to="/app/home">
                <Home className="size-4 shrink-0 opacity-85" />
                <span>Home</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2">
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter className="mt-auto shrink-0 gap-1 overflow-hidden border-t border-white/10 py-3">
        <button
          type="button"
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-2 overflow-hidden rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-[#8B93A8] hover:bg-[#182642] hover:text-[#F1F2ED] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          <PanelLeftClose
            className={cn(
              "size-4 shrink-0 transition-transform",
              collapsed && "rotate-180",
            )}
          />
          <span className="truncate group-data-[collapsible=icon]:hidden">
            {collapsed ? "Expand" : "Collapse"}
          </span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
