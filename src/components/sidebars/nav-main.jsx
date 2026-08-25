import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import propTypes from "prop-types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSelector } from "react-redux";
import { cn } from "@/lib/utils";
import {
  canAccessPrivileges,
  getUserFunctionalities,
  privilegeKeysForItem,
} from "@/lib/access";

const MODULE_ACCENT = {
  Inventory: "var(--cat-inventory-b)",
  Purchase: "var(--cat-purchase-b)",
  Sales: "var(--cat-sales-b)",
  Account: "var(--cat-accounts-b)",
  Payroll: "var(--cat-payroll-b)",
  Admin: "var(--cat-admin-b)",
  Reports: "var(--cat-reports-b)",
};

const NAV_SECTION_LABEL = {
  Inventory: "Workspace",
  Account: "Finance",
  Payroll: "People",
};

const parentBtn =
  "h-auto rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-[#B4BACB] hover:bg-[#182642] hover:text-[#F1F2ED] data-[state=open]:text-[#F1F2ED]";
const leafBtn =
  "h-auto rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-[#B4BACB] hover:bg-[#182642] hover:text-[#F1F2ED] data-[active=true]:bg-[var(--dash-primary,#1b7a5b)] data-[active=true]:text-white data-[active=true]:font-semibold";

/**
 * Dark ink sidebar nav matching dashboard-redesign.html.
 * Sub-items respect functionalities when that list is present.
 */
export function NavMain({ items }) {
  const [openMenu, setOpenMenu] = useState(null);
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const location = useLocation();

  const functionalities = getUserFunctionalities(user, activeBusiness);

  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  const visibleItems = useMemo(() => {
    return (items || [])
      .map((item) => {
        if (!item.items?.length) return item;
        const children = item.items.filter((subItem) =>
          canAccessPrivileges(privilegeKeysForItem(subItem), functionalities),
        );
        return { ...item, items: children };
      })
      .filter((item) => {
        if (item.items) return item.items.length > 0;
        if (!item.url || item.url === "#") return false;
        return canAccessPrivileges(privilegeKeysForItem(item), functionalities);
      });
  }, [items, functionalities]);

  return (
    <SidebarGroup className="h-full py-1">
      <SidebarMenu className="gap-0.5">
        {visibleItems.map((item) => {
          const sectionLabel = NAV_SECTION_LABEL[item.title];
          const accent = MODULE_ACCENT[item.title];

          if (item.items?.length) {
            const childActive = item.items.some((sub) => {
              if (!sub.url) return false;
              const base = String(sub.url).split("?")[0];
              return (
                location.pathname === base ||
                location.pathname.startsWith(`${base}/`)
              );
            });
            const isOpen =
              openMenu === item.title ||
              (openMenu === null && childActive);

            return (
              <div key={item.title}>
                {sectionLabel ? (
                  <div className="px-3 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5C6478]">
                    {sectionLabel}
                  </div>
                ) : null}
                <Collapsible
                  asChild
                  open={isOpen}
                  onOpenChange={(next) => {
                    setOpenMenu(next ? item.title : false);
                  }}
                  className="group/collapsible"
                  style={accent ? { ["--accent"]: accent } : undefined}
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className={cn(parentBtn)}
                        tooltip={item.title}
                      >
                        {item.icon ? (
                          <item.icon
                            className={cn(
                              "size-4 shrink-0 opacity-85",
                              isOpen && "text-[var(--accent,#F1F2ED)] opacity-100",
                            )}
                          />
                        ) : null}
                        <span className="truncate">{item.title}</span>
                        <ChevronRight className="ml-auto size-3.5 shrink-0 opacity-55 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[state=open]/collapsible:opacity-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden">
                      <SidebarMenuSub className="ml-5 mt-0.5 border-l border-white/10 py-0.5 pl-0">
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem
                            key={subItem.title || subItem.url}
                          >
                            <SidebarMenuSubButton
                              asChild
                              className="h-auto rounded-[7px] px-2.5 py-1.5 text-[13px] font-normal text-[#9AA2B6] hover:bg-[#182642] hover:text-[#F1F2ED] data-[active=true]:bg-[#182642] data-[active=true]:text-white [&[data-active=true]_span.nav-dot]:bg-[var(--accent,var(--dash-primary))] [&[data-active=true]_span.nav-dot]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent,var(--dash-primary))_25%,transparent)]"
                            >
                              <NavLink
                                to={subItem.url}
                                onClick={() => {
                                  if (isMobile) toggleSidebar();
                                }}
                              >
                                <span
                                  className="nav-dot size-1.5 shrink-0 rounded-full bg-[#3D4763]"
                                  aria-hidden
                                />
                                <span className="truncate">{subItem.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </div>
            );
          }

          return (
            <SidebarMenuItem
              key={item.title}
              onClick={() => {
                if (isMobile) toggleSidebar();
              }}
            >
              <SidebarMenuButton
                asChild
                className={cn(leafBtn)}
                tooltip={item.title}
              >
                <NavLink to={item.url}>
                  {item.icon ? (
                    <item.icon className="size-4 shrink-0 opacity-85" />
                  ) : null}
                  <span className="truncate">{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

NavMain.propTypes = {
  items: propTypes.array,
};
