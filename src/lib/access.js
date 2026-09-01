/** Shared privilege checks for sidebar, Home, Quick create, and route guards. */

const SUPERUSER_KEYS = ["Administrator", "Super Administrator", "Admin"];

export function parseAccessList(value, fallback = []) {
  if (Array.isArray(value)) {
    const list = value
      .map((item) => String(item).trim())
      .filter(Boolean);
    return list.length ? list : fallback;
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
}

export function getUserFunctionalities(user, activeBusiness) {
  return parseAccessList(
    activeBusiness?.functionalities,
    parseAccessList(user?.functionalities),
  );
}

export function getUserModuleAccess(user, activeBusiness) {
  return parseAccessList(
    activeBusiness?.access_to,
    parseAccessList(user?.accessTo ?? user?.access_to),
  );
}

export function hasFullAccess(functionalities) {
  if (!functionalities?.length) return false;
  return SUPERUSER_KEYS.some((key) => functionalities.includes(key));
}

/**
 * Privilege gate for permission-based UI.
 * - "Admin" / "Administrator" in functionalities → full access
 * - No privileges assigned → no access
 * - Item with no privilege keys → no access
 */
export function canAccessPrivileges(privileges, functionalities) {
  if (!functionalities?.length) return false;
  if (hasFullAccess(functionalities)) return true;
  const keys = Array.isArray(privileges)
    ? privileges.filter(Boolean)
    : privileges
      ? [privileges]
      : [];
  if (!keys.length) return false;
  return keys.some((key) => functionalities.includes(key));
}

export function isBusinessOwner(user, activeBusiness) {
  if (user?.id == null || activeBusiness?.business_admin == null) return false;
  return String(activeBusiness.business_admin) === String(user.id);
}

export function canAccessDashboard(user, activeBusiness) {
  if (isBusinessOwner(user, activeBusiness)) return true;
  const funcs = getUserFunctionalities(user, activeBusiness);
  if (hasFullAccess(funcs)) return true;
  return canAccessPrivileges(["Dashboard"], funcs);
}

/**
 * Child privileges that are never auto-enabled when a parent menu
 * item is turned on in Manage Users. Each must be granted on its own.
 */
export const EXPLICIT_ONLY_PRIVILEGES = [
  "Switch Payment Mode",
  "Approve Payment Mode Switch",
  "Write-off (Scrap/Loss)",
  "New Goods Transfer",
  "Transfer History",
  "Pending Approvals",
  "Create Purchase Order",
  "Approve Purchase Order",
  "Purchase Order History",
  "Cash Payment",
  "Transfer Payment",
  "Credit Payment",
  "Apply Deposit Payment",
];

/** Create Invoice → Mode of Payment checkboxes. */
export const INVOICE_PAYMENT_MODE_PRIVILEGES = {
  cash: "Cash Payment",
  transfer: "Transfer Payment",
  credit: "Credit Payment",
  deposit: "Apply Deposit Payment",
};

const ALL_INVOICE_PAYMENT_MODE_IDS = ["cash", "transfer", "credit", "deposit"];

/**
 * Payment modes the user may select on Create Invoice.
 * If none of the four privileges are assigned yet, all modes stay available
 * so existing Create Invoice users are not locked out.
 */
export function allowedInvoicePaymentModeIds(functionalities) {
  if (hasFullAccess(functionalities)) return [...ALL_INVOICE_PAYMENT_MODE_IDS];
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  const granted = ALL_INVOICE_PAYMENT_MODE_IDS.filter((id) =>
    funcs.includes(INVOICE_PAYMENT_MODE_PRIVILEGES[id]),
  );
  return granted.length ? granted : [...ALL_INVOICE_PAYMENT_MODE_IDS];
}

/** Manage Users → Sales → CRM child switches (also used to hide CRM tabs). */
export const CRM_TAB_PRIVILEGES = [
  "CRM Dashboard",
  "CRM Customers",
  "CRM Activities",
  "CRM Follow-ups",
  "CRM Feedback",
  "CRM Segments",
  "CRM Outreach",
  "CRM Templates",
  "CRM Settings",
];

/**
 * CRM module + tab access.
 * Parent "CRM" opens the module. Tab privileges hide individual CRM tabs.
 * Users with only "CRM" (no tab grants yet) keep every tab so existing
 * staff are not locked out.
 */
export function allowedCrmTabPrivileges(functionalities) {
  if (hasFullAccess(functionalities)) return [...CRM_TAB_PRIVILEGES];
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  if (!funcs.includes("CRM") && !funcs.includes("Customer Feedback")) {
    return [];
  }
  const granted = CRM_TAB_PRIVILEGES.filter((title) => funcs.includes(title));
  if (granted.length) return granted;
  if (funcs.includes("CRM")) return [...CRM_TAB_PRIVILEGES];
  if (funcs.includes("Customer Feedback")) return ["CRM Feedback"];
  return [];
}

export function privilegeKeysForItem(item) {
  if (!item) return [];
  if (Array.isArray(item.functionality) && item.functionality.length) {
    return item.functionality;
  }
  if (item.functionality) return [item.functionality];
  if (Array.isArray(item.privileges) && item.privileges.length) {
    return item.privileges;
  }
  if (item.privileges) return [item.privileges];
  // Fallback to title only when explicitly allowed by caller
  return item.title ? [item.title] : [];
}

function moduleFunctionalityKeys(module) {
  if (!module) return [];
  const fromField = Array.isArray(module.functionality)
    ? module.functionality
    : module.functionality
      ? [module.functionality]
      : [];
  return [...fromField, module.title].filter(Boolean);
}

/**
 * Hide sidebar groups the user is not allowed to open.
 * Child items are still filtered again in NavMain.
 */
export function filterSidebarModulesForUser(modules, user, activeBusiness) {
  const funcs = getUserFunctionalities(user, activeBusiness);
  const moduleAccess = getUserModuleAccess(user, activeBusiness);
  const full = hasFullAccess(funcs);

  return (modules || [])
    .map((item) => {
      if (!item) return null;
      if (item.title === "Dashboard") {
        return canAccessDashboard(user, activeBusiness) ? item : null;
      }
      if (full) return item;

      if (!item.items?.length) {
        const allowedByModule =
          !moduleAccess.length || moduleAccess.includes(item.title);
        const allowedByFn = canAccessPrivileges(
          privilegeKeysForItem(item),
          funcs,
        );
        return allowedByModule || allowedByFn ? item : null;
      }

      const parentGranted =
        !moduleAccess.length ||
        moduleAccess.includes(item.title) ||
        moduleFunctionalityKeys(item).some((key) => funcs.includes(key));

      const children = item.items.filter((subItem) =>
        canAccessPrivileges(privilegeKeysForItem(subItem), funcs),
      );

      if (!parentGranted && !children.length) return null;
      if (!children.length) return null;
      return { ...item, items: children };
    })
    .filter(Boolean);
}
