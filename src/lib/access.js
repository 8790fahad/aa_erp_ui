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
  "Card Payment",
  "Credit Payment",
  "Apply Deposit Payment",
  "Cash Collection",
  "Transfer Collection",
  "POS Collection",
  "Card Collection",
  "Credit Collection",
  "Discount Collection",
  "Make Deposit",
  "Apply Deposit",
  "Collection Reconciliation",
  "Hand-in",
  "History",
  "Cash",
  "POS",
  "Card",
  "Transfer",
  "Imprest",
  "Pay Bill",
  "Edit Invoice",
  "Create Bill",
  "Inventory Bill",
  "Expense Bill",
  "Filter Bills",
  "All",
  "Inventory",
  "Expenses",
  "View Expenses Memos",
  "All Memos",
  "Approved Memos",
  "Pending Memos",
  "See All Pay Bills",
  "Inventory Vendors",
  "Expense Vendors",
];

export const CREATE_BILL_PRIVILEGE = "Create Bill";
export const FILTER_BILLS_PRIVILEGE = "Filter Bills";
export const FILTER_ALL_BILLS_PRIVILEGE = "All";
export const FILTER_INVENTORY_BILLS_PRIVILEGE = "Inventory";
export const FILTER_EXPENSE_BILLS_PRIVILEGE = "Expenses";
export const INVENTORY_BILL_PRIVILEGE = "Inventory Bill";
export const EXPENSE_BILL_PRIVILEGE = "Expense Bill";
export const VIEW_EXPENSES_MEMOS_PRIVILEGE = "View Expenses Memos";
export const MEMO_FILTER_ALL_PRIVILEGE = "All Memos";
export const MEMO_FILTER_APPROVED_PRIVILEGE = "Approved Memos";
export const MEMO_FILTER_PENDING_PRIVILEGE = "Pending Memos";
export const SEE_ALL_PAY_BILLS_PRIVILEGE = "See All Pay Bills";
export const ALL_VENDORS_PRIVILEGE = "All Vendors";
export const INVENTORY_VENDORS_PRIVILEGE = "Inventory Vendors";
export const EXPENSE_VENDORS_PRIVILEGE = "Expense Vendors";
export const COLLECTION_RECONCILIATION_PRIVILEGE = "Collection Reconciliation";
export const DISCOUNT_COLLECTION_PRIVILEGE = "Discount Collection";
export const HAND_IN_PRIVILEGE = "Hand-in";
export const RECONCILIATION_HISTORY_PRIVILEGE = "History";
export const RECONCILE_CASH_PRIVILEGE = "Cash";
export const RECONCILE_CARD_PRIVILEGE = "POS";
export const RECONCILE_CARD_PRIVILEGE_LEGACY = "Card";
export const RECONCILE_TRANSFER_PRIVILEGE = "Transfer";

const ALL_RECONCILIATION_MODES = ["cash", "card", "transfer"];

const RECONCILIATION_MODE_PRIVILEGES = {
  cash: [RECONCILE_CASH_PRIVILEGE],
  card: [RECONCILE_CARD_PRIVILEGE, RECONCILE_CARD_PRIVILEGE_LEGACY],
  transfer: [RECONCILE_TRANSFER_PRIVILEGE],
};

/**
 * Collection Reconciliation page tabs.
 * Hand-in / History / Discount Collection are each granted on their own.
 * Collection Reconciliation parent (no tab children) still opens Hand-in and
 * History so existing supervisors are not locked out. Discount is never
 * auto-enabled from the parent.
 */
export function allowedCollectionReconciliationTabs(functionalities) {
  if (hasFullAccess(functionalities)) return ["handin", "history", "discount"];
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  const hasParent = funcs.includes(COLLECTION_RECONCILIATION_PRIVILEGE);
  const tabs = [];
  if (funcs.includes(HAND_IN_PRIVILEGE) || hasParent) tabs.push("handin");
  if (funcs.includes(RECONCILIATION_HISTORY_PRIVILEGE) || hasParent) {
    tabs.push("history");
  }
  if (funcs.includes(DISCOUNT_COLLECTION_PRIVILEGE)) tabs.push("discount");
  return tabs;
}

/**
 * Payment modes shown on Collection Reconciliation.
 * Check Cash / POS / Transfer under Collection Reconciliation.
 * Parent with no child grants keeps every mode (existing supervisors).
 */
export function allowedReconciliationModes(functionalities) {
  if (hasFullAccess(functionalities)) return [...ALL_RECONCILIATION_MODES];
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  if (!funcs.includes(COLLECTION_RECONCILIATION_PRIVILEGE)) {
    return [...ALL_RECONCILIATION_MODES];
  }
  const granted = ALL_RECONCILIATION_MODES.filter((id) =>
    (RECONCILIATION_MODE_PRIVILEGES[id] || []).some((key) =>
      funcs.includes(key),
    ),
  );
  return granted.length ? granted : [...ALL_RECONCILIATION_MODES];
}

/**
 * Vendor types the user may fetch.
 * All Vendors (default) → every type. Inventory / Expense Vendors restrict
 * the list. Type "all" vendors stay visible with any grant. No child grants
 * keeps full fetch for existing staff.
 */
export function allowedVendorFetchTypes(functionalities) {
  if (hasFullAccess(functionalities)) return ["all", "inventory", "expense"];
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  if (funcs.includes(ALL_VENDORS_PRIVILEGE)) {
    return ["all", "inventory", "expense"];
  }
  const granted = [];
  if (funcs.includes(INVENTORY_VENDORS_PRIVILEGE)) granted.push("inventory");
  if (funcs.includes(EXPENSE_VENDORS_PRIVILEGE)) granted.push("expense");
  if (granted.length) {
    granted.push("all");
    return granted;
  }
  return ["all", "inventory", "expense"];
}

export function canFetchAllVendorTypes(functionalities) {
  const allowed = allowedVendorFetchTypes(functionalities);
  return (
    allowed.includes("all") &&
    allowed.includes("inventory") &&
    allowed.includes("expense")
  );
}

/** Pay Bills list: own payments unless this privilege (or admin) is granted. */
export function canSeeAllPayBills(user, activeBusiness) {
  if (isBusinessOwner(user, activeBusiness)) return true;
  const funcs = getUserFunctionalities(user, activeBusiness);
  if (hasFullAccess(funcs)) return true;
  return funcs.includes(SEE_ALL_PAY_BILLS_PRIVILEGE);
}

/**
 * Bill types the user may create (Create Bill modal).
 * Nested Inventory Bill / Expense Bill grants win, including for Admin.
 * Parent Create Bill (or full access) with no child grants keeps both types.
 */
export function allowedBillCreateTypes(functionalities) {
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  const granted = [];
  if (funcs.includes(INVENTORY_BILL_PRIVILEGE)) granted.push("inventory");
  if (funcs.includes(EXPENSE_BILL_PRIVILEGE)) granted.push("expense");
  if (granted.length) return granted;
  if (hasFullAccess(functionalities) || funcs.includes(CREATE_BILL_PRIVILEGE)) {
    return ["inventory", "expense"];
  }
  return [];
}

/**
 * Bill types the user may see in the list.
 * Same nested Inventory Bill / Expense Bill grants as create.
 * Parent "Bill" with no child grants yet keeps both types (existing staff).
 */
export function allowedBillTypes(functionalities) {
  const createTypes = allowedBillCreateTypes(functionalities);
  if (createTypes.length) return createTypes;
  return ["inventory", "expense"];
}

/** Filter dropdown options granted under Filter Bills: All / Inventory / Expenses. */
export function allowedBillFilterOptions(functionalities) {
  const viewTypes = allowedBillTypes(functionalities);
  if (viewTypes.length === 1) return [...viewTypes];
  if (hasFullAccess(functionalities)) return ["all", "inventory", "expense"];
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  // Require the Filter Bills parent. "All" / "Inventory" / "Expenses" collide
  // with other module names and must not unlock the bill type filter alone.
  if (!funcs.includes(FILTER_BILLS_PRIVILEGE)) return [];
  const granted = [];
  if (funcs.includes(FILTER_ALL_BILLS_PRIVILEGE)) granted.push("all");
  if (
    funcs.includes(FILTER_INVENTORY_BILLS_PRIVILEGE) &&
    viewTypes.includes("inventory")
  ) {
    granted.push("inventory");
  }
  if (
    funcs.includes(FILTER_EXPENSE_BILLS_PRIVILEGE) &&
    viewTypes.includes("expense")
  ) {
    granted.push("expense");
  }
  if (granted.length) return granted;
  return ["all", ...viewTypes];
}

/**
 * Bill type sent to GET /api/supplier/bills.
 * A single Inventory Bill / Expense Bill grant always wins (no All fetch).
 */
export function resolveBillFetchType(functionalities, requestedType = "all") {
  const viewTypes = allowedBillTypes(functionalities);
  if (viewTypes.length === 1) return viewTypes[0];

  const req = String(requestedType || "all").toLowerCase();
  const filters = allowedBillFilterOptions(functionalities);
  const canAll = filters.includes("all");

  if (req === "inventory" && viewTypes.includes("inventory")) {
    if (filters.includes("inventory") || canAll) return "inventory";
  }
  if (req === "expense" && viewTypes.includes("expense")) {
    if (filters.includes("expense") || canAll) return "expense";
  }

  if (canAll) return "all";
  return "all";
}

/** Show the type filter on the Bill list when any filter option is granted. */
export function canUseBillTypeFilter(functionalities) {
  return allowedBillFilterOptions(functionalities).length > 0;
}

/** Memo drawer filter: All / Approved / Pending. */
export function allowedMemoFilterOptions(functionalities) {
  if (hasFullAccess(functionalities)) return ["all", "approved", "pending"];
  const funcs = Array.isArray(functionalities) ? functionalities : [];
  const granted = [];
  if (funcs.includes(MEMO_FILTER_ALL_PRIVILEGE)) granted.push("all");
  if (funcs.includes(MEMO_FILTER_APPROVED_PRIVILEGE)) granted.push("approved");
  if (funcs.includes(MEMO_FILTER_PENDING_PRIVILEGE)) granted.push("pending");
  if (granted.length) return granted;
  if (funcs.includes(VIEW_EXPENSES_MEMOS_PRIVILEGE)) {
    return ["all", "approved", "pending"];
  }
  return ["all", "approved", "pending"];
}

export const INVOICE_PAYMENT_MODE_PRIVILEGES = {
  cash: "Cash Payment",
  transfer: "Transfer Payment",
  card: "Card Payment",
  credit: "Credit Payment",
  deposit: "Apply Deposit Payment",
};

const ALL_INVOICE_PAYMENT_MODE_IDS = [
  "cash",
  "transfer",
  "card",
  "credit",
  "deposit",
];

/**
 * Payment modes the user may select on Create Invoice.
 * If none of the five privileges are assigned yet, all modes stay available
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

export function collectSubFunctionalityTitles(item) {
  const titles = [];
  const walk = (nodes) => {
    (nodes || []).forEach((node) => {
      const title = String(node?.title || "").trim();
      if (title) titles.push(title);
      (node?.aliases || []).forEach((alias) => {
        const a = String(alias || "").trim();
        if (a) titles.push(a);
      });
      if (node?.subFunctionalities?.length) walk(node.subFunctionalities);
    });
  };
  walk(item?.subFunctionalities);
  return titles;
}

export function privilegeKeysForItem(item) {
  if (!item) return [];
  const keys = [];
  if (item.title) keys.push(item.title);
  if (Array.isArray(item.functionality) && item.functionality.length) {
    keys.push(...item.functionality);
  } else if (item.functionality) {
    keys.push(item.functionality);
  }
  if (Array.isArray(item.privileges) && item.privileges.length) {
    keys.push(...item.privileges);
  } else if (item.privileges) {
    keys.push(item.privileges);
  }
  if (Array.isArray(item.aliases) && item.aliases.length) {
    keys.push(...item.aliases);
  }
  return [
    ...new Set(
      keys
        .map((key) => String(key).trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Keys that may open a sidebar/page item. Includes child switches so a
 * cashier with only Cash Collection can still open Verification Points.
 * Do not use this for the Manage Users parent toggle — that must stay
 * independent of explicit-only children.
 */
export function privilegeKeysForNavItem(item) {
  const keys = privilegeKeysForItem(item);
  const subs = collectSubFunctionalityTitles(item);
  return [...new Set([...keys, ...subs])];
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
          privilegeKeysForNavItem(item),
          funcs,
        );
        return allowedByModule || allowedByFn ? item : null;
      }

      const parentGranted =
        !moduleAccess.length ||
        moduleAccess.includes(item.title) ||
        moduleFunctionalityKeys(item).some((key) => funcs.includes(key));

      const children = item.items.filter((subItem) =>
        canAccessPrivileges(privilegeKeysForNavItem(subItem), funcs),
      );

      if (!parentGranted && !children.length) return null;
      if (!children.length) return null;
      return { ...item, items: children };
    })
    .filter(Boolean);
}
