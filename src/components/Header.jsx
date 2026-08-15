import { useMemo, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  ChevronsUpDown,
  FileText,
  LogOut,
  Plus,
  Settings,
  UserRound,
  Users,
  Wallet,
  Receipt,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "@/redux/actions/auth";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import logo from "@/assets/aa_erp_icon.png";
import GlobalSearchBar from "@/components/GlobalSearchBar";

function parseAccess(accessStr) {
  if (!accessStr || typeof accessStr !== "string") return [];
  return accessStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasDashboardAccess(team) {
  const access = parseAccess(team?.access_to);
  return access.some(
    (a) => a.toLowerCase() === "dashboard" || a.toLowerCase() === "admin",
  );
}

const QUICK_CREATE = [
  {
    label: "Create Invoice",
    href: "/app/sales/sale?view=lines",
    icon: FileText,
  },
  { label: "Customers", href: "/app/customers", icon: Users },
  {
    label: "Purchase invoice",
    href: "/app/purchase/purchase-invoice",
    icon: Receipt,
  },
  { label: "Bill", href: "/app/expenses/billing", icon: Wallet },
  {
    label: "Collection Points",
    href: "/app/payments/collection-points",
    icon: Wallet,
  },
];

/** Navy Zoho-style top bar (full width). */
export function AppTopBar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, activeBusiness, businessesList = [], businessCount = 0 } =
    useSelector((state) => state.auth);
  const [isSwitching, setIsSwitching] = useState(false);

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

  const displayName =
    (user?.firstname && user?.lastname
      ? `${user.firstname} ${user.lastname}`
      : null) ||
    user?.name ||
    user?.email ||
    "User";
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const businessInitials =
    activeBusiness?.business_name
      ?.split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "BS";

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

  return (
    <header
      className="sticky top-0 z-40 flex h-[var(--aa-topbar-height)] w-full shrink-0 items-center gap-3 px-3 text-white shadow-sm"
      style={{ backgroundColor: "var(--aa-navy)" }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <SidebarTrigger className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" />
        <Link
          to="/app/home"
          className="flex items-center gap-2 font-semibold tracking-tight text-white hover:text-white"
        >
            <img
              src={logo}
              alt={activeBusiness?.business_name || "YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES"}
              className="h-8 w-8 rounded-lg object-contain ring-1 ring-white/25"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="hidden lg:inline text-[13px] whitespace-nowrap max-w-[220px] truncate" title={activeBusiness?.business_name || "YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES"}>
              {activeBusiness?.business_name || "YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES"}
            </span>
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-2">
        <GlobalSearchBar />
      </div>

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex max-w-[160px] items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-white hover:bg-white/10"
            >
              <span className="flex size-6 items-center justify-center overflow-hidden rounded bg-white/15 text-[10px] font-bold">
                {activeBusiness?.business_logo ? (
                  <img
                    src={activeBusiness.business_logo}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  businessInitials
                )}
              </span>
              <span className="hidden md:inline truncate max-w-[90px]">
                {activeBusiness?.business_name ?? "Business"}
              </span>
              <ChevronsUpDown className="size-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
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
              return (
                <DropdownMenuItem
                  key={team?.id ?? index}
                  disabled={isSwitching}
                  onClick={() => handleSwitchBusiness(team)}
                  className={isActive ? "bg-blue-50 text-blue-900" : ""}
                >
                  {team?.business_name ?? "Business"}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full text-white shadow-sm"
              style={{ backgroundColor: "var(--aa-accent)" }}
              aria-label="Quick create"
            >
              <Plus className="size-4" strokeWidth={2.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel>Quick create</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {QUICK_CREATE.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="gap-2"
                >
                  <Icon className="size-4 text-[var(--aa-accent)]" />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={() => navigate("/app/admin/settings")}
          className="inline-flex size-8 items-center justify-center rounded-md text-white/90 hover:bg-white/10"
          aria-label="Settings"
        >
          <Settings className="size-4" />
        </button>

        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-white/90 hover:bg-white/10"
          aria-label="Notifications"
          onClick={() => toast.message("No new notifications")}
        >
          <Bell className="size-4" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md p-1 hover:bg-white/10"
            >
              <Avatar className="size-8 border border-white/20">
                <AvatarFallback className="bg-white/15 text-xs text-white">
                  {initials || <UserRound className="size-4" />}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {user?.role || "User"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/admin/settings")}>
              <Settings className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={_logout}
              className="text-red-600 focus:text-red-700"
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/** Breadcrumbs + sales view controls (main pane only). */
export function PageContextBar() {
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);

  const isSalesRoute = location.pathname.split("/").includes("sales");
  const isInvoicesListPage = location.pathname.includes("/sales/invoices");
  const isMarkupPage = location.pathname.includes("/sales/markup");
  const isPriceSetupPage = location.pathname.includes("/sales/price-setup");
  const isSalesInvoicesReportPage = location.pathname.includes(
    "/reports/accounting-reports/sales-invoices-report",
  );
  const isSalesLineReportPage = location.pathname.includes(
    "/sales/sales-line-report",
  );
  const showViewSwitch =
    isSalesRoute &&
    !isInvoicesListPage &&
    !isMarkupPage &&
    !isPriceSetupPage &&
    !isSalesInvoicesReportPage &&
    !isSalesLineReportPage;
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-white px-4">
      <Breadcrumb>
        <BreadcrumbList className="mb-0 pl-0">
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink href="#">{pathParts[0] || "app"}</BreadcrumbLink>
          </BreadcrumbItem>
          {pathParts[1] ? (
            <>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pathParts[1]}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
          {pathParts[2] ? (
            <>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pathParts[2]}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>

      {showViewSwitch && (
        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/app/sales/invoices"
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Close
          </Link>
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer AppTopBar + PageContextBar */
export default function Header() {
  return <AppTopBar />;
}
