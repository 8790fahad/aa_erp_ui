/** Default landing when a section root (e.g. /app/purchase) has no index page. */
export const BREADCRUMB_SECTION_HOME = {
  app: "/app/home",
  purchase: "/app/purchase/inventory",
  sales: "/app/sales/sale",
  payments: "/app/payments/verification-points",
  expenses: "/app/expenses/billing",
  account: "/app/account/chart-of-account",
  admin: "/app/admin/settings",
  assets: "/app/assets",
  inventory: "/app/inventory/product-list",
  reports: "/app/reports/accounting-reports",
  customers: "/app/customers",
  suppliers: "/app/suppliers",
  crm: "/app/crm",
  projects: "/app/projects/project-list",
  audit: "/app/audit/bank-reconciliation",
  dashboard: "/app/dashboard",
  home: "/app/home",
};

/** Build href for breadcrumb segment at `index` within `pathParts`. */
export function breadcrumbHrefForIndex(pathParts, index) {
  if (index <= 0) return BREADCRUMB_SECTION_HOME.app || "/app/home";
  const segment = String(pathParts[index] || "").toLowerCase();
  if (index === 1 && BREADCRUMB_SECTION_HOME[segment]) {
    return BREADCRUMB_SECTION_HOME[segment];
  }
  return `/${pathParts.slice(0, index + 1).join("/")}`;
}
