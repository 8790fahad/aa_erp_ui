import { useMemo, useState } from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
import { logout } from "@/redux/actions/auth";
import { Button } from "../ui/button";
import { toast } from "sonner";

function parseAccess(accessStr) {
  if (!accessStr || typeof accessStr !== "string") return [];
  return accessStr.split(",").map((s) => s.trim()).filter(Boolean);
}

function hasDashboardAccess(team) {
  const access = parseAccess(team?.access_to);
  return access.some(
    (a) => a.toLowerCase() === "dashboard" || a.toLowerCase() === "admin"
  );
}

export function BusinessSwitcher() {
  const { isMobile } = useSidebar();
  const { activeBusiness, businessesList = [], businessCount = 0 } = useSelector(
    (state) => state.auth
  );
  const [isSwitching, setIsSwitching] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const sortedBusinesses = useMemo(() => {
    if (!businessesList?.length) return [];
    const list = [...businessesList];
    list.sort((a, b) => {
      const aHas = hasDashboardAccess(a) ? 1 : 0;
      const bHas = hasDashboardAccess(b) ? 1 : 0;
      return bHas - aHas;
    });
    return list;
  }, [businessesList]);

  const _logout = () => dispatch(logout(() => navigate("/login")));

  const handleSwitchBusiness = (team) => {
    if (team?.status === "Pending") {
      toast.error("This account is not yet approved");
      return;
    }
    if (team?.id === activeBusiness?.id) return;
    setIsSwitching(true);
    toast.loading(`Switching to ${team?.business_name ?? "business"}...`, {
      id: "switch-business",
    });
    dispatch({ type: "UPDATE_USER", payload: team });
    setTimeout(() => {
      navigate("/app/home", { replace: true });
      toast.success(`Switched to ${team?.business_name ?? "business"}`, {
        id: "switch-business",
      });
      setIsSwitching(false);
    }, 320);
  };

  const triggerInitials =
    activeBusiness?.business_name
      ?.split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "BS";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-opacity duration-200"
            >
              <div className="flex size-8 items-center justify-center rounded-md border bg-muted overflow-hidden shrink-0">
                {activeBusiness?.business_logo ? (
                  <img
                    src={activeBusiness.business_logo}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    {triggerInitials}
                  </span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-semibold">
                  {activeBusiness?.business_name ?? "Business"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {businessCount > 1
                    ? `${businessCount} businesses`
                    : activeBusiness?.business_type
                      ? activeBusiness.business_type
                          .split(",")
                          .map((t) => t.trim())
                          .join(", ")
                      : "Business"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg pb-3 mb-1"
            align="start"
            side={isMobile ? "bottom" : "top"}
            sideOffset={4}
          >
            {businessCount > 1 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch business ({businessCount})
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            {sortedBusinesses.map((team, index) => {
              const isActive = team?.id === activeBusiness?.id;
              const teamInitials = (team?.business_name ?? "?")
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <DropdownMenuItem
                  key={team?.id ?? index}
                  onClick={() => handleSwitchBusiness(team)}
                  disabled={isSwitching}
                  className={`gap-2 p-2 transition-colors ${isActive ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100" : ""}`}
                >
                  <div className="flex size-8 items-center justify-center rounded-md border bg-muted overflow-hidden shrink-0">
                    {team?.business_logo ? (
                      <img
                        src={team.business_logo}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {teamInitials}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="truncate block font-medium">
                      {team?.business_name ?? "Business"}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <Button
              onClick={_logout}
              className="w-full justify-center bg-red-600 hover:bg-red-700 text-white border-0"
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
