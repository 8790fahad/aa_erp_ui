import {
  flattenAccountingReportPermissions,
  getReportPermissionKey,
} from "./accountingReportCatalog";

/** Permission titles stored in membership.functionalities (comma-separated). */
export const PRODUCTION_REPORT_PERMISSIONS = [
  { title: "Production Reports" },
  { title: "Production Report" },
  { title: "FG Inventory Report" },
  { title: "RM Inventory Report" },
  { title: "Sale Report per Product" },
  { title: "Operator Production Report" },
  { title: "Product Production Summary Report" },
  { title: "Production vs Sales Comparison Report" },
];

export { getReportPermissionKey };

export function getUserFunctionalities(user, activeBusiness) {
  const parse = (raw) => {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  };
  // Same as sidebar (nav-main): membership on active business, else user fallback.
  const businessList = parse(activeBusiness?.functionalities);
  if (businessList.length > 0) return businessList;
  return parse(user?.functionalities);
}

/**
 * Same rule as GoodsTransfer tab visibility: functionalities must include the privilege.
 */
export function canViewReport(functionalities, permissionTitle) {
  const key = String(permissionTitle || "").trim();
  if (!key) return true;
  const list = functionalities || [];
  if (!list.length) return false;
  if (list.includes(key)) return true;
  // Parent production permission grants all production report children
  if (key !== "Production Reports" && list.includes("Production Reports")) {
    return true;
  }
  return false;
}

/** @deprecated use getUserFunctionalities */
export function parseFunctionalities(...sources) {
  const out = new Set();
  for (const raw of sources) {
    if (Array.isArray(raw)) {
      raw.filter(Boolean).forEach((v) => out.add(String(v).trim()));
      continue;
    }
    if (typeof raw === "string" && raw.trim()) {
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((v) => out.add(v));
    }
  }
  return [...out];
}

export function canAccessReport(user, activeBusiness, permissionTitle) {
  const functionalities = getUserFunctionalities(user, activeBusiness);
  return canViewReport(functionalities, permissionTitle);
}

export function canAccessAnyProductionReport(user, activeBusiness) {
  return PRODUCTION_REPORT_PERMISSIONS.some((item) =>
    canAccessReport(user, activeBusiness, item.title),
  );
}

/** Staff permissions UI: attach report toggles under Production + Reports. */
export function mergeReportPermissionsIntoSidebar(modules) {
  const accountingPermissions = flattenAccountingReportPermissions();

  return modules.map((module) => {
    if (module.title === "Production") {
      return {
        ...module,
        items: (module.items || []).map((item) =>
          item.title === "Production Reports"
            ? {
                ...item,
                functionality: "Production Reports",
                subFunctionalities: PRODUCTION_REPORT_PERMISSIONS.filter(
                  (p) => p.title !== "Production Reports",
                ),
              }
            : item,
        ),
      };
    }
    if (module.title === "Reports") {
      return {
        ...module,
        items: [
          ...(module.items || []),
          {
            title: "Accounting Reports",
            subFunctionalities: accountingPermissions,
          },
          {
            title: "Production Reports",
            subFunctionalities: PRODUCTION_REPORT_PERMISSIONS,
          },
        ],
      };
    }
    return module;
  });
}
