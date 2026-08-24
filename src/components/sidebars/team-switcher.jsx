/* eslint-disable no-unused-vars */
import * as React from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "@/redux/actions/auth";
// import { getImageUrl } from "@/redux/actions/api";
import propTypes from "prop-types";
import { Button } from "../ui/button";
import { useNavigate } from "react-router-dom";

const data = {
  user: {
    name: "Phisherman",
    email: "phisherman@test.com",
    avatar: "/avatars/shadcn.jpg",
  },
};

export function TeamSwitcher() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const _logout = () => dispatch(logout(() => navigate("/login")));

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.image} alt={user?.firstname} />
                <AvatarFallback className="rounded-lg text-[var(--aa-navy)]">
                  {user?.firstname?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {user?.firstname}
                </span>
                <span className="truncate text-xs">{user?.role}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user?.image} alt={user?.username} />
                  <AvatarFallback className="rounded-lg text-[var(--aa-navy)]">
                    {user?.firstname?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user?.firstname}
                  </span>
                  <span className="truncate text-xs">{user?.role}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Button
              onClick={_logout}
              className="w-full bg-danger hover:bg-[#45A049]"
            >
              <LogOut />
              Log out  
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

TeamSwitcher.propTypes = {
  teams: propTypes.array,
};
