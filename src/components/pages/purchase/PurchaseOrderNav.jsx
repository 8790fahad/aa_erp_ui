import { useCallback, useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

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
    to: "/app/purchase/purchase-requisition",
    match: (pathname, search) =>
      pathname.startsWith("/app/purchase/purchase-requisition") &&
      !new URLSearchParams(search).get("tab"),
  },
  {
    id: "approve",
    label: "Approve",
    privilege: PO_TAB_PRIVILEGES.approve,
    to: "/app/purchase/requisition-approval",
    match: (pathname) =>
      pathname.startsWith("/app/purchase/requisition-approval"),
  },
  {
    id: "history",
    label: "History",
    privilege: PO_TAB_PRIVILEGES.history,
    to: "/app/purchase/purchase-requisition?tab=history",
    match: (pathname, search) =>
      pathname.startsWith("/app/purchase/purchase-requisition") &&
      new URLSearchParams(search).get("tab") === "history",
  },
];

function parseFunctionalities(...sources) {
  const out = [];
  for (const raw of sources) {
    if (Array.isArray(raw)) {
      out.push(...raw);
    } else if (typeof raw === "string") {
      out.push(
        ...raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return [...new Set(out)];
}

/** Shared PO tab permission helper (Staff Management checkboxes). */
export function usePurchaseOrderPermissions() {
  const { activeBusiness, user } = useSelector((state) => state.auth);

  const functionalities = useMemo(
    () =>
      parseFunctionalities(
        activeBusiness?.functionalities,
        user?.functionalities,
      ),
    [activeBusiness?.functionalities, user?.functionalities],
  );

  const isAdmin = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    return role.includes("admin") || functionalities.includes("admin");
  }, [user?.role, functionalities]);

  const hasAnyPoSub = useMemo(
    () =>
      Object.values(PO_TAB_PRIVILEGES).some((p) =>
        functionalities.includes(p),
      ),
    [functionalities],
  );

  const canViewTab = useCallback(
    (privilege) => {
      if (isAdmin) return true;
      // Legacy / full access when no privileges configured
      if (functionalities.length === 0) return true;
      // Parent "Purchase Order" alone still unlocks all tabs until subs are assigned
      if (!hasAnyPoSub && functionalities.includes("Purchase Order")) {
        return true;
      }
      return functionalities.includes(privilege);
    },
    [functionalities, hasAnyPoSub, isAdmin],
  );

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => canViewTab(tab.privilege)),
    [canViewTab],
  );

  const canCreate = canViewTab(PO_TAB_PRIVILEGES.create);
  const canApprove = canViewTab(PO_TAB_PRIVILEGES.approve);
  const canHistory = canViewTab(PO_TAB_PRIVILEGES.history);

  return {
    canViewTab,
    visibleTabs,
    canCreate,
    canApprove,
    canHistory,
    functionalities,
    isAdmin,
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
      <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">
        You do not have permission to view Purchase Order tabs. Ask an admin to
        enable Create, Approve, or History under Staff permissions.
      </div>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-4">
      {visibleTabs.map((tab) => {
        const active = tab.match(pathname, search);
        return (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={tab.id === "create"}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-[var(--aa-accent)] text-[var(--aa-accent)]"
                : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
