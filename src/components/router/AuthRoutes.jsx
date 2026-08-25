/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import {
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  LayoutDashboard,
  ArrowLeft,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import inventria from "../../assets/aa_erp.png";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Button } from "../ui/button";
import { logout } from "@/redux/actions/auth";
import { useDispatch, useSelector } from "react-redux";
import { accessData } from "./MainRoutes";
import { hasAccess, hasSubAccess } from "@/utilities";

// Sample data for user info
const data = {
  user: {
    name: "Phisherman",
    email: "phisherman@test.com",
    avatar: "/avatars/shadcn.jpg",
  },
};

export default function AuthRoutes() {
  const [openMenu, setOpenMenu] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isSalePage = location.pathname.split("/").includes("sales");
  const isInvoicesListPage = location.pathname.includes("/sales/invoices");
  const isMarkupPage = location.pathname.includes("/sales/markup");
  const isSalesInvoicesReportPage = location.pathname.includes(
    "/reports/accounting-reports/sales-invoices-report",
  );
  const isSalesLineReportPage = location.pathname.includes(
    "/sales/sales-line-report",
  );
  const isVatReportPage = location.pathname.includes("/sales/vat-report");
  const showViewSwitch =
    isSalePage &&
    !isInvoicesListPage &&
    !isMarkupPage &&
    !isSalesInvoicesReportPage &&
    !isSalesLineReportPage &&
    !isVatReportPage;

  const dispatch = useDispatch();
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const _logout = () => dispatch(logout(() => navigate("/login")));

  const handleMenuToggle = (menuTitle) => {
    setOpenMenu((prevOpenMenu) =>
      prevOpenMenu === menuTitle ? null : menuTitle,
    );
  };

  const dash = user?.accessTo && hasAccess(user, ["Dashboard"]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader>
          <SidebarMenu className="mb-0 pl-2 mt-2">
            <SidebarMenuItem>
              <Link to="/app">
                <img
                  src={activeBusiness?.business_logo || inventria}
                  alt={
                    activeBusiness?.business_logo
                      ? activeBusiness?.business_name || "Business logo"
                      : "ALH ALI MUHAMMAD YAMMUSA logo"
                  }
                  className="logo"
                  style={{ height: "55px", objectFit: "contain" }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = inventria;
                  }}
                />
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-white">
              Platform
            </SidebarGroupLabel>
            <SidebarMenu>
              {dash ? (
                <Button className="flex w-full items-center justify-start gap-2 overflow-hidden p-2 transition-[width,height,padding] ring-sidebar-ring outline-none text-sm text-left leading-none rounded-md h-8 bg-[var(--aa-navy)] hover:bg-white hover:text-[var(--aa-navy)] shadow-none [&>svg]:size-4 [&>svg]:shrink-0">
                  <LayoutDashboard />
                  <span className="leading-snug">Dashboard</span>
                </Button>
              ) : null}

              {/* Dynamically rendering access data */}
              {accessData.map((item) => {
                if (user.accessTo && hasAccess(user, [item.name])) {
                  return (
                    <Collapsible
                      key={item.name}
                      open={openMenu === item.name}
                      onOpenChange={() => handleMenuToggle(item.name)}
                      className="group/collapsible"
                    >
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.name}>
                          {item.icon && item.icon}
                          <span>{item.name}</span>
                          <ChevronRight className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      {item.children && item.children.length > 0 && (
                        <CollapsibleContent className="transition-all duration-300 ease-in-out">
                          <SidebarMenuSub>
                            {item.children.map((subItem) =>
                              user.functionalities &&
                              hasSubAccess(user, [subItem.name]) ? (
                                <SidebarMenuSubItem key={subItem.name}>
                                  <SidebarMenuSubButton
                                    className="text-white hover:text-black"
                                    asChild
                                  >
                                    <NavLink to={subItem.path}>
                                      <span>{subItem.name}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ) : null,
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      )}
                    </Collapsible>
                  );
                }
                return null;
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={data.user.avatar} alt={user.fullname} />
                      <AvatarFallback className="rounded-lg text-[var(--aa-navy)]">
                        PM
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user.fullname}
                      </span>
                      <span className="truncate text-xs">{user.role}</span>
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
                        <AvatarImage
                          src={data.user.avatar}
                          alt={user.fullname}
                        />
                        <AvatarFallback className="rounded-lg text-[var(--aa-navy)]">
                          PM
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user.fullname}
                        </span>
                        <span className="truncate text-xs">{user.role}</span>
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
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="w-full">
        <header className="flex h-16 sticky top-0 bg-white border-b mb-3 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex flex-1 items-center gap-2 px-4 min-w-0 w-full">
            <SidebarTrigger className="-ml-1 shrink-0" />
            <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />
            <Breadcrumb className="min-w-0 shrink">
              <BreadcrumbList className="pl-0 mb-0 flex-wrap">
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    {location.pathname.split("/")[1]}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {location.pathname.split("/")[2] ? (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {location.pathname.split("/")[2]}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : null}
                {location.pathname.split("/")[3] ? (
                  <>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {location.pathname.split("/")[3]}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : null}
              </BreadcrumbList>
            </Breadcrumb>

            {showViewSwitch && (
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <Link
                  to="/app/sales/invoices"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Close
                </Link>
              </div>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-3 pt-0 w-full">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
