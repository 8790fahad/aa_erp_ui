/**
 * Business-type helpers for AA ERP (retailers, services, ngo, …).
 * Handles comma-separated `business.business_type` values from the API.
 */

const TYPE_MAP = {
  retailer: "retailers",
  retailers: "retailers",
  retail: "retailers",
  service: "services",
  services: "services",
  recycling: "recycling",
  manufacturing: "manufacturing",
  manufacturer: "manufacturing",
  manufacturers: "manufacturing",
  contractor: "contractors",
  contractors: "contractors",
  ngo: "ngo",
  nonprofit: "ngo",
  "non-profit": "ngo",
};

export const VALID_BUSINESS_TYPES = [
  "retailers",
  "services",
  "recycling",
  "manufacturing",
  "contractors",
  "ngo",
];

export function normalizeBusinessTypeKey(raw) {
  const lower = String(raw || "")
    .trim()
    .toLowerCase();
  if (!lower) return null;
  if (TYPE_MAP[lower]) return TYPE_MAP[lower];
  if (VALID_BUSINESS_TYPES.includes(lower)) return lower;
  return null;
}

/** Parse `business_type` string/array into normalized keys. */
export function parseBusinessTypes(businessType) {
  if (!businessType) return [];

  if (Array.isArray(businessType)) {
    return businessType
      .map(normalizeBusinessTypeKey)
      .filter(Boolean);
  }

  if (typeof businessType !== "string") return [];

  return businessType
    .split(",")
    .map(normalizeBusinessTypeKey)
    .filter(Boolean);
}

export function hasBusinessType(businessType, typeKey) {
  return parseBusinessTypes(businessType).includes(typeKey);
}

export function isNgoBusiness(businessType) {
  return hasBusinessType(businessType, "ngo");
}

/** Soft UI labels for NGO vs default contractor/services wording. */
export function getBusinessLabels(businessType) {
  if (isNgoBusiness(businessType)) {
    return {
      customers: "Donors / Funders",
      customer: "Funder / Donor",
      customersSingular: "Donor",
      projects: "Grants & Programs",
      project: "Grant / Program",
      projectName: "Grant / Program name",
      profit: "Surplus / Net",
      income: "Funding received",
      costs: "Program costs",
      // Home dashboard cards
      dashboardInvoices: "Funding invoices",
      dashboardUnpaid: "Outstanding",
      dashboardOverdue: "Overdue",
      dashboardNotDue: "Not due yet",
      dashboardPaid: "Cash received",
      dashboardInvoiced30: "Invoiced",
      dashboardReceived30: "Payments received",
      dashboardReceivable: "Funder receivables",
      dashboardPayable: "Vendor payables",
      dashboardSales: "Funding",
      dashboardExpenses: "Program costs",
      dashboardCashFlow: "Cash position",
      dashboardBankAccounts: "Bank accounts",
    };
  }

  return {
    customers: "Customers",
    customer: "Customer",
    customersSingular: "Customer",
    projects: "Projects",
    project: "Project",
    projectName: "Project name",
    profit: "Profit",
    income: "Income",
    costs: "Costs",
    dashboardInvoices: "Invoices",
    dashboardUnpaid: "Unpaid",
    dashboardOverdue: "Overdue",
    dashboardNotDue: "Not due yet",
    dashboardPaid: "Paid",
    dashboardInvoiced30: "Invoiced",
    dashboardReceived30: "Payments received",
    dashboardReceivable: "Accounts Receivable",
    dashboardPayable: "Accounts Payable",
    dashboardSales: "Sales",
    dashboardExpenses: "Expenses",
    dashboardCashFlow: "Cash Flow",
    dashboardBankAccounts: "Bank Accounts",
  };
}
