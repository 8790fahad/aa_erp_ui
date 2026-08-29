import { useCallback, useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { CheckCircle2, History, Plus } from "lucide-react";
import {
  canAccessPrivileges,
  getUserFunctionalities,
  hasFullAccess,
  isBusinessOwner,
} from "@/lib/access";

export const PO_TAB_PRIVILEGES = {
  create: "Create Purchase Order",
  approve: "Approve Purchase Order",
  history: "Purchase Order History",
};

const TABS = [
  {
    id: "create",
    label: "Create",
    privilege: PO_TAB_PRIVILEGES.create,
    icon: Plus,
    to: "/app/purchase/purchase-requisition",
    match: (pathname, search) =>
      pathname.startsWith("/app/purchase/purchase-requisition") &&
      !new URLSearchParams(search).get("tab"),
  },
  {
    id: "approve",
    label: "Approve",
    privilege: PO_TAB_PRIVILEGES.approve,
    icon: CheckCircle2,
    to: "/app/purchase/requisition-approval",
    match: (pathname) =>
      pathname.startsWith("/app/purchase/requisition-approval"),
  },
  {
    id: "history",
    label: "History",
    privilege: PO_TAB_PRIVILEGES.history,
    icon: History,
    to: "/app/purchase/purchase-requisition?tab=history",
    match: (pathname, search) =>
      pathname.startsWith("/app/purchase/purchase-requisition") &&
      new URLSearchParams(search).get("tab") === "history",
  },
];

/** Shared PO tab permission helper (Staff Management checkboxes). */
export function usePurchaseOrderPermissions() {
  const { activeBusiness, user } = useSelector((state) => state.auth);

  const functionalities = useMemo(
    () => getUserFunctionalities(user, activeBusiness),
    [user, activeBusiness],
  );

  const canViewTab = useCallback(
    (privilege) => {
      if (
        isBusinessOwner(user, activeBusiness) ||
        hasFullAccess(functionalities)
      ) {
        return true;
      }
      if (canAccessPrivileges([privilege], functionalities)) return true;
      const hasAnyPoSub = Object.values(PO_TAB_PRIVILEGES).some((key) =>
        functionalities.includes(key),
      );
      // Parent "Purchase Order" with no tab assigned → Create only
      if (
        privilege === PO_TAB_PRIVILEGES.create &&
        !hasAnyPoSub &&
        functionalities.includes("Purchase Order")
      ) {
        return true;
      }
      return false;
    },
    [activeBusiness, functionalities, user],
  );

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => canViewTab(tab.privilege)),
    [canViewTab],
  );

  return {
    canViewTab,
    visibleTabs,
    canCreate: canViewTab(PO_TAB_PRIVILEGES.create),
    canApprove: canViewTab(PO_TAB_PRIVILEGES.approve),
    canHistory: canViewTab(PO_TAB_PRIVILEGES.history),
    functionalities,
  };
}

export default function PurchaseOrderNav() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { visibleTabs, canViewTab } = usePurchaseOrderPermissions();

  useEffect(() => {
    const active = TABS.find((tab) => tab.match(pathname, search));
    if (!active) return;
    if (canViewTab(active.privilege)) return;
    const fallback = visibleTabs[0];
    if (fallback) {
      navigate(fallback.to, { replace: true });
    }
  }, [pathname, search, canViewTab, visibleTabs, navigate]);

  if (!visibleTabs.length) {
    return (
      <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
        You do not have permission to view Purchase Order tabs. Ask an admin to
        enable Create, Approve, or History under Staff permissions.
      </div>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 sm:px-4">
      {visibleTabs.map((tab) => {
        const active = tab.match(pathname, search);
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={tab.id === "create"}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-[var(--aa-navy)] text-[var(--aa-navy)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
