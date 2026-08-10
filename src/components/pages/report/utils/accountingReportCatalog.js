import { ACCOUNTING_REPORTS_BASE as BASE } from "./customReportHub";

/** @typedef {{ title: string; description: string; path?: string; dateMode?: 'range' | 'asOf'; external?: boolean; permission?: string }} AccountingReportItem */

/** @typedef {{ id: string; title: string; subtitle: string; icon: string; items: AccountingReportItem[] }} AccountingReportSection */

/** Catalog for Accounting Reports hub + staff permissions. */
export const ACCOUNTING_REPORT_SECTIONS = [
  {
    id: "core",
    title: "1. Core Financial Reports",
    subtitle: "Mandatory — P&L, position, cash, trial balance",
    icon: "Landmark",
    items: [
      {
        title: "Profit & Loss (Income Statement)",
        description: "Revenue, expenses, and profit over a period",
        path: `${BASE}/inventria-income-statement`,
        dateMode: "range",
      },
      {
        title: "Statement of Financial Position (comparative)",
        description: "SoFP with prior period column",
        path: `${BASE}/inventria-statement-of-financial-position`,
        dateMode: "asOf",
      },
      {
        title: "Trial Balance",
        description: "All accounts with debit and credit balances",
        path: `${BASE}/inventria-trial-balance`,
        dateMode: "asOf",
      },
      {
        title: "General Ledger",
        description: "Transactions per account",
        path: `${BASE}/inventria-general-ledger`,
        dateMode: "range",
      },
    ],
  },
  {
    id: "receivables",
    title: "2. Receivables (Sales) Reports",
    subtitle: "Customers, AR, and sales",
    icon: "Users",
    items: [
      {
        title: "Debtors report (Accounts Receivable)",
        description:
          "Customers and suppliers with debit (DR) balances",
        path: `${BASE}/receivable-ledger`,
        dateMode: "range",
      },
      {
        title: "Receivable ledger (individual)",
        description: "Individual Customer balances",
        path: `${BASE}/receivable-ledger-aging`,
        dateMode: "range",
      },
      {
        title: "Accounts receivable aging",
        description:
          "Outstanding balances by aging bucket: current, 1–30, 31–60, and 61+ days",
        path: `${BASE}/receivable-aging`,
        dateMode: "range",
      },
      {
        title: "Sales invoices",
        description: "Issued invoices list",
        path: `${BASE}/sales-invoices-report`,
        dateMode: "range",
      },
      {
        title: "Sales report by product",
        description:
          "Sales quantity, revenue, COGS and margin by product (Cash / Transfer / Warehouse)",
        path: `${BASE}/sales-by-product`,
        dateMode: "range",
      },
      {
        title: "Sales report by supplier",
        description:
          "Sales aggregated by product supplier source (Cash / Transfer / Warehouse)",
        path: `${BASE}/sales-by-supplier`,
        dateMode: "range",
      },
    ],
  },
  {
    id: "payables",
    title: "3. Payables (Purchases) Reports",
    subtitle: "Suppliers, AP, and purchases",
    icon: "Truck",
    items: [
      {
        title: "Creditors report (Accounts Payable)",
        description:
          "Customers and suppliers with credit (CR) balances",
        path: `${BASE}/creditors-report`,
        dateMode: "range",
      },
      {
        title: "Payable ledger (individual)",
        description: "Individual supplier balances",
        path: `${BASE}/payable-ledger-individual`,
        dateMode: "range",
      },
      {
        title: "Accounts payable aging",
        description:
          "Outstanding balances by aging bucket: current, 1–30, 31–60, and 61+ days",
        path: `${BASE}/payable-aging`,
        dateMode: "range",
      },
      {
        title: "Purchase invoices",
        description: "Issued supplier invoices list",
        path: `${BASE}/purchase-invoices-report`,
        dateMode: "range",
      },
    ],
  },
  {
    id: "bank",
    title: "4. Bank & Cash Reports",
    subtitle: "Liquidity and reconciliation",
    icon: "Building2",
    items: [
      {
        title: "Bank reconciliation",
        description: "Differences between bank and books",
        path: "/app/audit/bank-reconciliation/reports",
        dateMode: "range",
        external: true,
      },
      {
        title: "Bank balances",
        description: "Bank account balances",
        path: `${BASE}/bank-balances`,
        dateMode: "asOf",
        external: true,
      },
    ],
  },
  {
    id: "inventory",
    title: "5. Inventory Reports",
    subtitle: "Stock and valuation",
    icon: "Package",
    items: [
      {
        title: "Inventory Valuation",
        description: "Raw materials and finished goods with FIFO/AVCO/LIFO valuation",
        path: `${BASE}/inventory-valuation`,
        dateMode: "asOf",
      },
    ],
  },
];

export function getReportPermissionKey(item) {
  return item?.permission || item?.title || "";
}

export function flattenAccountingReportPermissions() {
  return ACCOUNTING_REPORT_SECTIONS.flatMap((section) =>
    section.items.flatMap((item) => {
      const parent = { title: getReportPermissionKey(item) };
      const children = (item.children || []).map((child) => ({
        title: getReportPermissionKey(child),
      }));
      return children.length ? [parent, ...children] : [parent];
    }),
  );
}
