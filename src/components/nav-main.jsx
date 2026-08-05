import { MailIcon, PlusCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items
}) {
  return (
    (<SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              tooltip="Quick Create"
              className="min-w-8 bg-slate-900 text-slate-50 duration-200 ease-linear hover:bg-slate-900/90 hover:text-slate-50 active:bg-slate-900/90 active:text-slate-50 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90 dark:hover:text-slate-900 dark:active:bg-slate-50/90 dark:active:text-slate-900">
              <PlusCircleIcon />
              <span>Quick Create</span>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 group-data-[collapsible=icon]:opacity-0"
              variant="outline">
              <MailIcon />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>)
  );
}
