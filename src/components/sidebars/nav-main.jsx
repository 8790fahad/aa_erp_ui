import { useState } from "react";
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
import { NavLink } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSelector } from "react-redux";
import { cn } from "@/lib/utils";

const navBtn =
  "text-slate-700 hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-accent)] data-[active=true]:bg-[var(--aa-sidebar-active)] data-[active=true]:text-[var(--aa-accent)] data-[active=true]:font-semibold";

/**
 * AA ERP retail nav: show all retailer modules from props.
 * Sub-items still respect functionalities when that list is present.
 */
export function NavMain({ items }) {
  const [openMenu, setOpenMenu] = useState(null);
  const { activeBusiness, user } = useSelector((state) => state.auth);

  const parseAccessList = (value, fallback = []) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return fallback;
  };

  const functionalities = parseAccessList(
    activeBusiness?.functionalities,
    parseAccessList(user?.functionalities),
  );

  const handleMenuToggle = (title) => {
    setOpenMenu(openMenu === title ? null : title);
  };

  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <SidebarGroup className="h-full py-1">
      <SidebarMenu>
        {(items || []).map((item) => {
          if (item.items?.length) {
            return (
              <Collapsible
                key={item.title}
                asChild
                open={openMenu === item.title}
                onOpenChange={() => handleMenuToggle(item.title)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={cn(navBtn)}
                      tooltip={item.title}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden">
                    <SidebarMenuSub>
                      {item.items.map((subItem) => {
                        const permissionKeys = Array.isArray(
                          subItem.functionality,
                        )
                          ? subItem.functionality
                          : [subItem.functionality ?? subItem.title];
                        const allowed =
                          functionalities.length === 0 ||
                          permissionKeys.some((key) =>
                            functionalities.includes(key),
                          );
                        if (!allowed) return null;
                        return (
                          <SidebarMenuSubItem
                            key={subItem.title || subItem.url}
                          >
                            <SidebarMenuSubButton
                              asChild
                              className="text-slate-600 hover:text-[var(--aa-accent)] hover:bg-[var(--aa-sidebar-active)] data-[active=true]:!bg-[var(--aa-sidebar-active)] data-[active=true]:!text-[var(--aa-accent)]"
                            >
                              <NavLink
                                to={subItem.url}
                                onClick={() => {
                                  if (isMobile) toggleSidebar();
                                }}
                              >
                                <span>{subItem.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          }

          if (!item.url || item.url === "#") return null;

          return (
            <SidebarMenuItem
              key={item.title}
              onClick={() => {
                if (isMobile) toggleSidebar();
              }}
            >
              <SidebarMenuButton asChild className={cn(navBtn)} tooltip={item.title}>
                <NavLink to={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
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
