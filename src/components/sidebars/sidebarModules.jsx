import {
  CreditCard,
  FileTextIcon,
  HandHelping,
  LayoutDashboard,
  NotebookPen,
  PackageOpen,
  UserRoundPen,
  Building2,
  Landmark,
  NotebookText,
  Folder,
} from "lucide-react";
import { SETTINGS_TABS } from "@/components/pages/admin/settingsTabs";

export const modules = [
  {
    title: "Dashboard",
    url: "/app",
    icon: LayoutDashboard,
    functionality: ["Dashboard"],
    access: [
      "services",
      "retailers",
      "recycling",
      "manufacturing",
      "contractors",
    ],
  },
  // Customers moved under Sales
  // {
  //   title: "Customers",
  //   url: "#",
  //   icon: UsersRound,
  //   items: [
  //     {
  //       title: "Customers",
  //       url: "/app/customers",
  //       access: [
  //         "services",
  //         "retailers",
  //         "recycling",
  //         "manufacturing",
  //         "contractors",
  //       ],
  //     },
  //   ],
  // },
  // Suppliers moved under Purchase
  // {
  //   title: "Suppliers",
  //   url: "#",
  //   icon: Package,
  //   items: [
  //     {
  //       title: "Suppliers",
  //       url: "/app/suppliers",
  //       access: [
  //         "services",
  //         "retailers",
  //         "recycling",
  //         "manufacturing",
  //         "contractors",
  //       ],
  //     },
  //   ],
  // },
  {
    title: "Inventory",
    url: "#",
    icon: PackageOpen,
    isActive: true,
    items: [
      {
        title: "Goods",
        url: "/app/purchase/inventory?tab=goods-transfer",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
        functionality: [
          "Goods",
          "Goods List",
          "New Goods Transfer",
          "Transfer History",
          "Pending Approvals",
        ],
        subFunctionalities: [
          { title: "Goods" },
          { title: "New Goods Transfer" },
          { title: "Transfer History" },
          { title: "Pending Approvals" },
          { title: "Write-off (Scrap/Loss)" },
        ],
      },
      {
        title: "Products & Services",
        url: "/app/inventory/product-list",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Goods list",
        url: "/app/inventory/inventory-list",
        access: ["retailers", "recycling", "manufacturing", "contractors"],
      },
      // {
      //   title: "Store",
      //   url: "/app/inventory/store",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
    ],
  },
  //Purchase
  {
    title: "Purchase",
    url: "#",
    icon: CreditCard,
    isActive: true,
    items: [
      {
        title: "Vendors",
        url: "/app/suppliers",
        functionality: ["Suppliers", "Supplier Register"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      // {
      //   title: "Purchase list",
      //   url: "/app/purchase/purchase-list",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Suppliers",
      //   url: "/app/purchase/suppliers",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },

      {
        title: "Purchase Order",
        url: "/app/purchase/purchase-requisition",
        functionality: [
          "Purchase Order",
          "Create Purchase Order",
          "Approve Purchase Order",
          "Purchase Order History",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
        subFunctionalities: [
          { title: "Create Purchase Order" },
          { title: "Approve Purchase Order" },
          { title: "Purchase Order History" },
        ],
      },
      // {
      //   title: "PO Approval",
      //   url: "/app/purchase/requisition-approval",
      // },
      // {
      //   title: "Purchase Order",
      //   url: "/app/purchase/purchase-order",
      //   access: [
      //     "services",
      //     "retailers",
      //     "recycling",
      //     "manufacturing",
      //     "contractors",
      //   ],
      // },
      {
        title: "Bill",
        url: "/app/expenses/billing",
        functionality: ["Bill", "Billing Expense"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Pay Bills",
        url: "/app/payments/pay-bills",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Vendor Credits",
        url: "/app/payments/credit-note?party=vendor",
        functionality: ["Credit & Debit Note", "Credit Note"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },

      // {
      //   title: "Goods receive note",
      //   url: "/app/purchase/goods-receive-note",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Purchase Order",
      //   url: "/app/purchase/purchase-order",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Generated Memo",
      //   url: "/app/purchase/payment",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
    ],
  },
  // Expenses moved under Purchase (Bill + Expenses)
  // {
  //   title: "Expenses",
  //   url: "/app/purchase/purchase-invoice",
  //   icon: Banknote,
  //   items: [
  //     {
  //       title: "Billing Expense",
  //       url: "/app/expenses/billing",
  //       access: [
  //         "services",
  //         "retailers",
  //         "recycling",
  //         "manufacturing",
  //         "contractors",
  //       ],
  //     },
  //   ],
  // },
  {
    title: "Projects",
    url: "/app/projects",
    icon: Folder,
    items: [
      {
        title: "Projects",
        url: "/app/projects/project-list",
        access: ["contractors"],
      },
    ],
  },

  //Sales — process flow order:
  // Customer → Create Invoice → Collection Point → Invoice Separation
  // → Warehouse Collection → Rebate Ledger → CRM
  {
    title: "Sales",
    url: "#",
    icon: HandHelping,
    items: [
      {
        title: "Customers",
        url: "/app/customers",
        functionality: ["Customers", "Customer Register"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Create Invoice",
        url: "/app/sales/sale?view=lines",
        functionality: [
          "Create Invoice",
          "Make sales",
          "Invoices",
          "Make Sales",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Verification Points",
        url: "/app/payments/verification-points",
        functionality: [
          "Verification Points",
          "Collection Points",
          "Cash Collection",
          "Transfer Collection",
          "Switch Payment Mode",
          "Approve Payment Mode Switch",
          "Collection Reconciliation",
          "Receive Payment",
          "Payments",
          "Cashier",
        ],
        subFunctionalities: [
          { title: "Cash Collection" },
          { title: "Transfer Collection" },
          { title: "Apply Deposit" },
          { title: "Switch Payment Mode" },
          { title: "Approve Payment Mode Switch" },
          { title: "Collection Reconciliation" },
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Credit Approval",
        url: "/app/payments/credit-approval",
        functionality: [
          "Credit Collection",
          "Verification Points",
          "Collection Points",
          "Receive Payment",
          "Payments",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Apply Deposit",
        url: "/app/payments/verification-points?tab=deposit",
        functionality: [
          "Receive Payment",
          "Payments",
          "Customer Deposit",
          "Credit & Debit Note",
          "Verification Points",
          "Collection Points",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Deposit History",
        url: "/app/payments/receive-payment",
        functionality: ["Receive Payment", "Payments", "Customer Deposit"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Invoice Separation",
        url: "/app/sales/separation",
        functionality: [
          "Invoice Separation",
          "Separation",
          "Make sales",
          "Invoices",
          "Sales",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Warehouse Collection",
        url: "/app/sales/warehouse-requests",
        functionality: [
          "Warehouse Collection",
          "Warehouse Requests",
          "Make sales",
          "Invoices",
          "Sales",
          "Inventory",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Rebate Ledger",
        url: "/app/sales/rebate",
        functionality: ["Rebate Ledger", "Make sales", "Invoices", "Sales"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "CRM",
        url: "/app/crm",
        functionality: ["CRM", "CRM Dashboard", "Customers", "Make sales"],
        access: ["retailers"],
      },
      {
        title: "Invoice List",
        url: "/app/sales/invoices",
        functionality: ["Invoice List", "Make sales", "Invoices"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "VAT Report",
        url: "/app/sales/vat-report",
        functionality: [
          "VAT Report",
          "Sales Report",
          "Invoice List",
          "Make sales",
          "Invoices",
          "Sales",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Sales Process",
        url: "/app/sales/process",
        functionality: ["Sales Process", "Make sales", "Invoices", "Sales"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Price Setup",
        url: "/app/sales/price-setup",
        functionality: ["Make sales", "Invoices", "Products", "Inventory"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Credit Notes",
        url: "/app/payments/credit-note?party=customer",
        functionality: ["Credit & Debit Note", "Credit Note"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      // {
      //   title: "Transfer form",
      //   url: "/app/sales/transfer-form",
      //   access: ["services", "retailers", "recycling", "manufacturing","contractors"],
      // },
      // {
      //   title: "Return items",
      //   url: "/app/sales/return-items",
      //   access: ["services", "retailers", "recycling", "manufacturing","contractors"],
      // },
      // {
      //   title: "Receive form",
      //   url: "/app/sales/receive-form",
      //   access: ["services", "retailers", "recycling", "manufacturing","contractors"],
      // },
      // {
      //   title: "Pending sales",
      //   url: "/app/sales/pending-sales",
      //   access: ["services", "retailers", "recycling", "manufacturing","contractors"],
      // },
    ],
  },

  // Asset Register

  {
    title: "Reports",
    url: "/app/reports/accounting-reports",
    icon: NotebookPen,
    functionality: [
      "Reports",
      "Accounting Reports",
      "Production Reports",
      "Report",
    ],
    access: [
      "services",
      "retailers",
      "recycling",
      "manufacturing",
      "contractors",
    ],
  },
  // {
  //   title: "Transactions",
  //   url: "/app/reports/transaction",
  //   icon: HandCoins,
  //   access: ["services", "retailers", "recycling", "manufacturing"],
  // },
  //Audit

  //Account

  {
    title: "Account",
    url: "#",
    icon: Landmark,
    items: [
      {
        title: "Chart of Account",
        url: "/app/account/chart-of-account",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Journal Entries",
        url: "/app/account/journal-entries",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Funds Tranfer",
        url: "/app/account/cash-flow",
        functionality: ["Cash Flow Entries", "Funds Tranfer"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },

      {
        title: "Bank Reconciliation",
        url: "/app/audit/bank-reconciliation",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      // {
      //   title: "Create Bank Account",
      //   url: "/app/account/bank-account",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },

      // {
      //   title: "Cash movement",
      //   url: "/app/account/cash-movement",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Generate account Report",
      //   url: "/app/account/generate-account-report",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Opening balance",
      //   url: "/app/account/opening-balance",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Client account statement",
      //   url: "/app/account/client-account-statement",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Budget proposal",
      //   url: "/app/account/budget-proposal",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Account review",
      //   url: "/app/account/account-review",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },

      // {
      //   title: "Manage staff",
      //   url: "/app/account/manage-staff",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      {
        title: "Initiate Memo",
        url: "/app/account/initiate-memo",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      // Approval + history live under Initiate Memo tabs (Create | Approve | History)
      // {
      //   title: "Internal Audit",
      //   url: "/app/account/administrative-review",
      //   access: [
      //     "services",
      //     "retailers",
      //     "recycling",
      //     "manufacturing",
      //     "contractors",
      //   ],
      // },
      // {
      //   title: "Administrative Review",
      //   url: "/app/account/approval",
      //   access: [
      //     "services",
      //     "retailers",
      //     "recycling",
      //     "manufacturing",
      //     "contractors",
      //   ],
      // },
      // {
      //   title: "Payment Voucher",
      //   url: "/app/account/list-of-memos",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      // {
      //   title: "Accounts Verification",
      //   url: "/app/account/accounts-verification",
      // },
      // {
      //   title: "Payment Voucher Issuance",
      //   url: "/app/account/payment-voucher",
      // },
      // {
      //   title: "Create Taxes",
      //   url: "/app/account/create-taxes",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
    ],
  },

  {
    title: "Asset Register",
    url: "/app/assets",
    icon: Building2,
    functionality: [
      "Asset Register",
      "Assets",
      "Fixed Assets",
      "Asset Management",
      // Privilege names used on Manage Staff / membership for this module
      "Asset List",
      "Add Asset",
      "Asset Disposal",
      "Asset Dashboard",
    ],
    access: [
      "services",
      "retailers",
      "recycling",
      "manufacturing",
      "contractors",
    ],
  },
  {
    title: "Payroll",
    url: "#",
    icon: CreditCard,
    items: [
      {
        title: "Employees",
        url: "/app/admin/hr/employees",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Bonus",
        url: "/app/admin/hr/bonus",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Loans",
        url: "/app/admin/hr/loans",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Leave Management",
        url: "/app/admin/hr/leaves",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Payroll Processing",
        url: "/app/admin/hr/payroll",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
        subFunctionalities: [
          { title: "Run Payroll" },
          { title: "Payroll History" },
          { title: "Payroll Payment" },
        ],
      },
      {
        title: "Attendance",
        url: "/app/admin/hr/attendance",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
    ],
  },

  {
    title: "Admin",
    url: "#",
    icon: UserRoundPen,
    items: [
      // {
      //   title: "Manage users",
      //   url: "/app/admin/manage-user",
      //   access: ["services", "retailers", "recycling", "manufacturing"],
      // },
      {
        title: "Manage Users",
        url: "/app/admin/manage-staff",
        // Legacy privilege spellings still present in membership.functionalities
        functionality: [
          "Manage Users",
          "Manage users",
          "Manage staff",
          "Manage Staffs",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
      {
        title: "Manage Warehouses",
        url: "/app/admin/manage-branches",
        functionality: [
          "Manage Warehouses",
          "Manage Branches",
          "Manage stores",
          "Settings Manage Branches",
        ],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },

      {
        title: "Settings",
        url: "/app/admin/settings",
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
        subFunctionalities: SETTINGS_TABS.map((tab) => ({
          title: tab.privilege,
        })),
      },
      {
        // Lives under the CRM tabs, but linked here too: the CRM sidebar entry
        // is retailer-only, and every business type needs to reach feedback.
        title: "Customer Feedback",
        url: "/app/crm/feedback",
        functionality: ["Customer Feedback", "Admin", "Settings"],
        access: [
          "services",
          "retailers",
          "recycling",
          "manufacturing",
          "contractors",
        ],
      },
    ],
  },
  //to be clearified later
  // {
  //   title: "Settings",
  //   url: "#",
  //   icon: Settings,
  //   items: [
  //     {
  //       title: "Unit of measurement",
  //       url: "/app/settings/unit",
  //       access: ["services", "retailers", "recycling", "manufacturing"],
  //     },
  //     {
  //       title: "Treatment",
  //       url: "/app/settings/treatment",
  //       access: ["services", "retailers", "recycling", "manufacturing"],
  //     },
  //     {
  //       title: "Chart code setup",
  //       url: "/app/settings/chart-code-setup",
  //       access: ["services", "retailers", "recycling", "manufacturing"],
  //     },
  //   ],
  // },
];

export const appTypeAccess = {
  contractors: [
    "Dashboard",
    "Customers",
    "Suppliers",
    "Purchase",
    "Inventory",
    "Expenses",
    "Projects",
    "Payments",
    "Sales",
    "Reports",
    "Account",
    "Asset Register",
    "Payroll",
    "Admin",
  ],
  services: [
    "Dashboard",
    "Attendance",
    "Suppliers",
    "Purchase",
    "Customers",
    "Account",
    "Audit",
    "Expenses",
    "Asset Register",
    "Reports",
    "Invoices",
    "Sales",
    "Settings",
    "Inventory",
    "Admin",
    "Payments",
    "Payroll",
  ],
  recycling: [
    "Dashboard",
    "Attendance",
    // "Sales",
    "Customers",
    "Suppliers",
    "Audit",
    "Account",
    "Expenses",
    "Asset Register",
    "Reports",
    "Invoices",
    "Settings",
    "Admin",
    "Payroll",
    "Payments",
  ],
  retailers: [
    "Dashboard",
    "Attendance",
    "Inventory",
    "Sales",
    "Purchase",
    "Expenses",
    "Account",
    "Audit",
    "Asset Register",
    "Reports",
    "Invoices",
    "Settings",
    "Admin",
    "HR Management",
    "Payroll",
    "Payments",
  ],
  manufacturing: [
    "Dashboard",
    "Attendance",
    "Inventory",
    "Purchase",
    "Customers",
    "Suppliers",
    "Sales",
    "Account",
    "Audit",
    "Expenses",
    "Asset Register",
    "Reports",
    "Invoices",
    "Settings",
    "Admin",
    "HR Management",
    "Payroll",
    "Payments",
  ],
};

export const appType = [
  "services",
  "retailers",
  "recycling",
  "manufacturing",
  "contractors",
];

export function getSidebarByAppType(appType) {
  const allowedTitles = appTypeAccess[appType] || [];

  return modules
    .filter((module) => allowedTitles.includes(module.title)) // only allowed parent modules
    .map((module) => {
      if (!module.items) return module;

      const filteredItems = module.items.filter(
        (item) => !item.access || item.access.includes(appType),
      );

      return {
        ...module,
        items: filteredItems,
      };
    })
    .filter((module) => {
      // Keep module if it has items or no items needed
      return !module.items || module.items.length > 0;
    });
}
