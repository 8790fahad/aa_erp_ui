import { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import propTypes from "prop-types";
import {
  canAccessDashboard,
  canAccessPrivileges,
  getUserFunctionalities,
  hasFullAccess,
  privilegeKeysForNavItem,
} from "@/lib/access";
import { getMergedSidebarForBusiness } from "@/components/sidebars/sidebarModules";

function collectNavEntries(modules) {
  const entries = [];
  for (const mod of modules || []) {
    if (mod?.url && mod.url !== "#") {
      entries.push({
        path: String(mod.url).split("?")[0],
        keys: privilegeKeysForNavItem(mod),
        title: mod.title,
      });
    }
    for (const item of mod.items || []) {
      if (item?.url && item.url !== "#") {
        entries.push({
          path: String(item.url).split("?")[0],
          keys: privilegeKeysForNavItem(item),
          title: item.title,
        });
      }
    }
  }
  return entries
    .filter((entry) => entry.path && entry.path !== "/app")
    .sort((a, b) => b.path.length - a.path.length);
}

/** Extra privileges that may open a path even if the sidebar item is hidden. */
const RELATED_PAGE_PRIVILEGES = {
  "/app/inventory/inventory-list": ["Goods", "Goods List", "Goods list"],
  "/app/payments/verification-points": ["Receive Payment"],
};

/**
 * Prevents opening a page by URL when the sidebar would hide it.
 * Home is always allowed. Dashboard requires the Dashboard privilege.
 * Unmapped deep links (PDFs, nested forms) stay reachable.
 */
export default function PageAccessGuard({ children }) {
  const location = useLocation();
  const { user, activeBusiness, authenticated, loggedIn } = useSelector(
    (state) => state.auth,
  );

  const entries = useMemo(
    () => collectNavEntries(getMergedSidebarForBusiness(activeBusiness?.business_type)),
    [activeBusiness?.business_type],
  );

  if (!authenticated && !loggedIn) return children;

  const pathname = location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/app/home") return children;

  if (pathname === "/app") {
    return canAccessDashboard(user, activeBusiness) ? (
      children
    ) : (
      <Navigate to="/app/home" replace />
    );
  }

  const funcs = getUserFunctionalities(user, activeBusiness);
  if (hasFullAccess(funcs)) return children;

  const match = entries.find(
    (entry) =>
      pathname === entry.path || pathname.startsWith(`${entry.path}/`),
  );
  if (!match) return children;

  const keys = [
    ...match.keys,
    ...(RELATED_PAGE_PRIVILEGES[match.path] || []),
  ];
  if (canAccessPrivileges(keys, funcs)) return children;

  return <Navigate to="/app/home" replace />;
}

PageAccessGuard.propTypes = {
  children: propTypes.node,
};
