import NotFound from "@/common/NotFound";
import Login from "../pages/auth/Login";
// import Register from "../pages/auth/Register";
import AppIndex from "./AppIndex";
import { Navigate, Outlet, useRoutes } from "react-router-dom";
import CustomerFeedbackPage from "../pages/feedback/CustomerFeedbackPage";
import Random from "@/Random";
import RecordExpenses from "../pages/account/RecordExpenses";
// import SetupChartOfAccount from "../pages/account/SetupChartOfAccount";
// import GenerateInvoice from "../pages/account/GenerateInvoice";
// import CashMovement from "../pages/account/CashMovement";
// import OpeningBalance from "../pages/account/OpeningBalance";
// import ChientAccountStatement from "../pages/account/ClientAccount";
// import CreateBanks from "../pages/account/CreateBanks";
// import GenerateAccountReport from "../pages/account/GenerateAccountReport";
// import BudgetProposal from "../pages/account/BudgetProposal";
// import AccountReview from "../pages/account/AccountReview";
// import UnitOfMeasure from "../pages/settings/UnitOfMeasurement";
// import SupplierPayment from "../pages/purchase/SupplierPayment";
// import Treatment from "../pages/settings/Treatment";
// import ChartCodeSetup from "../pages/settings/ChartCode";
// import BankReconciliation from "../pages/audit/BankReconciliation";
// import CreateTaxes from "../pages/account/CreateTaxes";
import MemoList from "../pages/account/MemoList";
import Memo from "../pages/account/Memo";
import MemoReviewal from "../pages/account/AdministrativeReview";
import ApprovalByMD from "../pages/account/ApprovalByMD";
import CustomerTable from "../pages/customer/CustomerTable";
import TransactionReport from "../pages/report/ReportInvoice";
import Expenses from "../pages/report/Expenses";
// import CustomerDeposit from "../pages/customer/CustomerDeposit";
import PendingSales from "../pages/sales/pendingSales";
import ReciveForm from "../pages/sales/ReciveForm";
import MakeSale from "../pages/sales/MakeSale";
import ExpensesReport from "../pages/report/ExpensesReport";
import InvoiceForm from "../pages/report/InvoiceForm";
import SignUp from "../Signup";
import RecordProduction from "../pages/production/RecordProduction";
import ProcessProduction from "../pages/production/ProcessProduction";
import ProcessDetails from "../pages/production/ProcessDetails";
import ProductionAutomation from "../pages/production/ProductionAutomation";
import PurchaseOrder from "../pages/purchase/PurchaseOrder";
import GoodsReceive from "../pages/purchase/GoodsRecieve";
import SupplierTable from "../pages/purchase/SupplierTable";
import SupplierForm from "../pages/purchase/SupplierForm";
import SupplierReport from "../pages/purchase/SupplierReport";
import ReturnItem from "../pages/sales/return-goods/ReturnItem";
import Transfer from "../pages/sales/Transfer";
import PurchaseTable from "../pages/purchase/PurchaseTable";
import CreatePurchase from "../pages/purchase/CreatePurchase";
import Invoice from "../pages/account/AccountInvoice";
import AddProposal from "../pages/account/AddProposal";
// import Trailbalance from "../pages/report/Trailbalance";

import MemoPDF from "../pages/account/MemoPDF";
import ListOfMemo from "../pages/account/ListOfMemo";
import AcceptInvite from "../pages/auth/AcceptInvite";
import EditMemo from "../pages/account/EditMemo";
import PaymentVoucherPdf from "../pages/account/PaymentVoucherPDF";
import CashFlows from "../pages/account/PDFs/CashFlows";
import IncomeExpenses from "../pages/account/PDFs/IncomeAndExpenses";
import InventoryList from "../pages/inventory/InventoryList";
import AddInventoryItem from "../pages/inventory/AddInventoryItem";
import InventoryItemView from "../pages/inventory/InventoryItemView";

import PurchaseRequisition from "../pages/purchase/PurchaseRequisition";
import RequisitionApproval from "../pages/purchase/RequisitionApproval";
import PurchaseRequisitionList from "../pages/purchase/PurchaseRequisitionList";
import PurchaseOrderPdf from "../pages/account/PurchaseOrderPdf";
import SupplierPaymentReceiptPdf from "../pages/purchase/SupplierPaymentReceiptPdf";
import Store from "../pages/inventory/Store";
import ProductList from "../pages/inventory/All/product/ProductList";
import AddProduct from "../pages/inventory/All/product/AddProduct";
import ProductServiceForm from "../pages/inventory/All/product/ProductServiceForm";
import GenerateGoodReceiveNote from "../pages/purchase/GenerateGoodReceiveNote";
import PurchaseInventory from "../pages/purchase/PurchaseInventory";

import ViewBatch from "../pages/inventory/ViewBatch";
import ProcessBatch from "../pages/inventory/ProcessBatch";
import Batch from "../pages/inventory/Batch";
import AddServices from "../pages/inventory/AddServices";
import GenerateMemo from "../pages/purchase/GenerateMemo";
import IndividualLedger from "../pages/report/IndividualLedger";
import SupplierIndividualLedger from "../pages/report/SupplierIndividualLedger";
import Settings from "../pages/admin/Settings";
import MrApproval from "../pages/inventory/MrApproval";

import AddFinishedGoods from "../pages/inventory/AddFinishedGoods";
import ManufacturingRequisition from "../pages/production/Materials/ManufacturingRequisition";
import ManufacturingRequisitionList from "../pages/production/Materials/ManufacturingRequisitionList";
import MaterialReceivedNote from "../pages/production/Materials/MaterialReceivedNote";
import SalesPdf from "../pages/sales/SalesPDF";
import PostSalePage from "../pages/sales/make-sales/PostSalePage";
import Markup from "../pages/sales/Markup";
import InvoicePreview from "../pages/sales/InvoicePreview";
import SalesManagement from "../pages/sales/SalesManagement";
import WarehouseRequests from "../pages/sales/WarehouseRequests";
import InvoiceSeparation from "../pages/sales/InvoiceSeparation";
import CustomerReport from "../pages/customer/CustomerReport";
import InvoiceList from "../pages/invoice/InvoiceList";
import SalesLineReport from "../pages/invoice/SalesLineReport";
import RebateLedger from "../pages/sales/RebateLedger";
import CrmLayout from "../pages/crm/CrmLayout";
import CrmDashboard from "../pages/crm/CrmDashboard";
import CrmCustomers from "../pages/crm/CrmCustomers";
import CrmCustomer360 from "../pages/crm/CrmCustomer360";
import CrmActivities from "../pages/crm/CrmActivities";
import CrmFollowups from "../pages/crm/CrmFollowups";
import CrmSegments from "../pages/crm/CrmSegments";
import CrmBulkSms from "../pages/crm/CrmBulkSms";
import CrmTemplates from "../pages/crm/CrmTemplates";
import CrmSettings from "../pages/crm/CrmSettings";
import CrmFeedback from "../pages/crm/CrmFeedback";
import CreateInvoice from "../pages/invoice/CreateInvoice";
import StatementOfFinancial from "../pages/report/StatementOfFinancial";
import UnitOfMeasurement from "../pages/inventory/UnitOfMeasurement";
import MeasurementForm from "../pages/inventory/MeasurementForm";
import JournalEntryList from "../pages/account/JournalEntryList";
import JournalEntryForm from "../pages/account/JournalEntryForm";
import JournalEntryDetail from "../pages/account/JournalEntryDetail";
// import BankTransactions from "../pages/audit/BankTransactions";
// import BankReconciliationModals from "../pages/account/BankReconcilationModals";
import { appTypeAccess } from "../sidebars/sidebarModules";
import TeamSetup from "../pages/admin/TeamSetup";
import RateSetup from "../pages/admin/RateSetup";
import DiscountSetup from "../pages/admin/DiscountSetup";
import PriceSetup from "../pages/admin/PriceSetup";
import Production from "../pages/production/recycling/Production";
import ProductionList from "../pages/production/recycling/ProductionList";
import RawMaterialList from "../pages/production/recycling/RawMaterialList";
import CollectionList from "../pages/production/CollectionList";
import RawMaterialForm from "../pages/production/recycling/RawMaterialForm";
import EnergyConsumptionList from "../pages/production/EnergyConsumptionList";
import EnergyConsumption from "../pages/production/EnergyConsumption";
import DiscountApproval from "../pages/production/recycling/DiscountApproval";
import CollectionApproval from "../pages/production/recycling/CollectionApproval";
import CollectionInvoice from "../pages/production/recycling/CollectionInvoice";
import CollectionForm from "../pages/production/recycling/collectionForm";
import CustomerDepositReceiptPdf from "../pages/customer/CustomerDepositReceiptPdf";
import CustomerEdit from "../pages/customer/CustomerEdit";

import ProductionInvoice from "../pages/production/recycling/ProductionInvoice";

// HR Module Components
import HRModule from "../pages/hr/HRModule";
import OperationDeposit from "../pages/report/OperationDeposit";
import OperationDashboard from "../pages/report/OperationDashboard";
import DetailOperatorData from "../pages/report/DetailOperatorData";
import ProfitLossSummary from "../pages/report/ProfitLossSummary";
import Register2 from "../pages/auth/Register2";
import ViewInvoice from "../pages/report/ViewInvoice";
import CustomDashboard from "../pages/dashboard/CustomDashboard";
import EmailVerification from "../pages/auth/EmailVerification";
import AccountChart from "../pages/account/chart of account/AccountChart";
import AccountLedgerReport from "../pages/account/chart of account/AccountLedgerReport";
import BankReconciliation1 from "../pages/audit/BankReconciliation1";
import AuditTrailPage from "../pages/audit/AuditTrailPage";
import ReportsPage from "../pages/audit/ReportsPage";
import ForgotPasswordForm from "../pages/auth/ForgotPasswordForm";
import SupplierPaymentForm from "../pages/purchase/SupplierPayment";
import ResetPassword from "../pages/auth/ResetPassword";
import TokenVerification from "../pages/auth/TokenVerification";
import UpdateTeamSetup from "../pages/admin/UpdateTeamSetup";
import StaffManagementDashboard from "../StaffMgm";
import BranchMgm from "../BranchMgm";
import AccountSwitch from "../pages/auth/AccountSwitch";
import Home from "../pages/home/Home";
import CustomerEntries from "../pages/customer/CustomerEntries";
import RawMaterialInvoice1 from "../pages/production/recycling/RawMaterialInvoice1";
import TransactionList from "../pages/report/transaction/TransactionList";
import TransactionTypeSelection from "../pages/report/transaction/TransactionTypeSelection";
import TransactionForm from "../pages/report/transaction/TransactionForm";
import AccountingReports from "../pages/report/components/AccountingReports";
import GeneralLedgerPDF from "../pages/report/GeneralLedgerPDF";
import AaErpGeneralLedger from "../pages/report/components/AaErpGeneralLedger";
import AaErpTrialBalance from "../pages/report/components/AaErpTrialBalance";
import AaErpBalanceSheet from "../pages/report/components/AaErpBalanceSheet";
import StatementOfFinancialPositionReport from "../pages/report/components/StatementOfFinancialPositionReport";
import InventoryValuationReport from "../pages/report/components/InventoryValuationReport";
import AaErpIncomeStatement from "../pages/report/components/AaErpIncomeStatement";
import AaErpIncomeStatementNotes from "../pages/report/components/AaErpIncomeStatementNotes";
import PayableLedger from "../pages/report/components/PayableLedger";
import CreditorsReport from "../pages/report/components/CreditorsReport";
import PayableLedgerIndividualReport from "../pages/report/components/PayableLedgerIndividualReport";
import AccountsPayableAgingReport from "../pages/report/components/AccountsPayableAgingReport";
import PurchaseInvoicesReport from "../pages/report/components/PurchaseInvoicesReport";
import ReceivableLedger from "../pages/report/components/ReceivableLedger";
import ReceivableAgingReport from "../pages/report/components/ReceivableAgingReport";
import SalesInvoicesReport from "../pages/report/components/SalesInvoicesReport";
import DebtorsReport from "../pages/report/components/DebtorsReport";
import BankBalancesReport from "../pages/report/components/BankBalancesReport";
import CustomReports from "../pages/report/components/CustomReports";
import Trailbalance from "../pages/report/Trailbalance";
import RecordProductionManufacturing from "../pages/production/manufacturing/RecordProductionManufacturing";
import ManaufacturingProduction from "../pages/production/manufacturing/ManufacturingProduction";
import ProductionReportingHub from "../pages/production/reports/ProductionReportingHub";
import OperatorProductionReport from "../pages/production/reports/OperatorProductionReport";
import ProductProductionSummaryReport from "../pages/production/reports/ProductProductionSummaryReport";
import ProductionVsSalesComparisonReport from "../pages/production/reports/ProductionVsSalesComparisonReport";
import DailyProductionReport from "../pages/production/reports/DailyProductionReport";
import BatchDetailReport from "../pages/production/reports/BatchDetailReport";
import ProductionReport from "../pages/production/reports/ProductionReport";
import FGInventoryReport from "../pages/production/reports/FGInventoryReport";
import RMInventoryReport from "../pages/production/reports/RMInventoryReport";
import SalesPerProductReport from "../pages/production/reports/SalesPerProductReport";
import SalesBySupplierReport from "../pages/production/reports/SalesBySupplierReport";

// Asset Register Components
import AssetRegister from "../pages/assets/AssetRegister";
import WipInventory from "../pages/production/WipInventory";
import CustomerSecurityDepositForm from "../pages/customer/CustomerSecurityDepositForm";
import SupplierPaymentReceipt from "../pages/purchase/SupplierPaymentReceipt";
import ProductionReports from "../pages/report/components/ProductionReports";
import OperatingExpenses from "../pages/expenses/OperatingExpensesBill";
import OperatingExpenseBillPdf from "../pages/expenses/OperatingExpenseBillPdf";
import ImprestReceipt from "../pages/expenses/ImprestReceipt";
import ProductSupplierBillPdf from "../pages/expenses/ProductSupplierBillPdf";
import OperatingCashExpenses from "../pages/expenses/OperatingCashExpense";
import ProductCashExpense from "../pages/expenses/ProductCashExpense";
import ReceivePayment from "../pages/payments/ReceivePayment";
import CollectionReconciliation from "../pages/payments/CollectionReconciliation";
import ReceivedFunds from "../pages/payments/ReceivedFunds";
import RecordPaymentForm from "../pages/payments/RecordPaymentForm";
import RedirectToPayBills from "../pages/payments/RedirectToPayBills";
import PaymentsMade from "../pages/payments/PaymentsMade";
import RecordSupplierPaymentForm from "../pages/payments/RecordSupplierPaymentForm";
import PayBills from "../pages/payments/PayBills";
import CreditNote from "../pages/payments/CreditNote";
import ApplyCustomerAdvance from "../pages/payments/ApplyCustomerAdvance";
import ApplySupplierDeposit from "../pages/payments/ApplySupplierDeposit";
import ProductSupplierBill from "../pages/expenses/ProductSupplierBill";
import CashExpenseSource from "../pages/expenses/CashExpenseSource";
import BillSources from "../pages/expenses/BillSources";
import CashFlowList from "../pages/account/CashFlowList";
import ProjectTable from "../pages/projects/ProjectTable";
import ProjectDashboard from "../pages/projects/ProjectDashboard";

const routeModules = {
  Dashboard: {
    path: "",
    element: <CustomDashboard />,
  },

  CRM: {
    path: "crm",
    element: <CrmLayout />,
    children: [
      { path: "", element: <CrmDashboard /> },
      { path: "customers", element: <CrmCustomers /> },
      { path: "customers/:customerNo", element: <CrmCustomer360 /> },
      { path: "activities", element: <CrmActivities /> },
      { path: "followups", element: <CrmFollowups /> },
      { path: "feedback", element: <CrmFeedback /> },
      { path: "segments", element: <CrmSegments /> },
      { path: "sms", element: <CrmBulkSms /> },
      { path: "templates", element: <CrmTemplates /> },
      { path: "settings", element: <CrmSettings /> },
    ],
  },

  Inventory: {
    path: "inventory",
    element: <Outlet />,
    children: [
      {
        path: "inventory-list",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <InventoryList />,
          },
          {
            path: "new",
            element: <AddInventoryItem />,
          },
          {
            path: "view/:id",
            element: <InventoryItemView />,
          },
        ],
      },
      {
        path: "store",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <Store />,
          },
          {
            path: "send-item",
            element: <AddInventoryItem />,
          },
          {
            path: "batch",
            element: <Outlet />,
            children: [
              {
                path: "",
                element: <Batch />,
              },
              {
                path: "view/:grn",
                element: <ViewBatch />,
              },
              {
                path: "process/:grn",
                element: <ProcessBatch />,
              },
            ],
          },
        ],
      },
      {
        path: "product-list",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <ProductList />,
          },
          {
            path: "new",
            element: <ProductServiceForm />,
          },
          {
            path: "edit/:id",
            element: <ProductServiceForm />,
          },
          {
            path: "view/:id",
            element: <ProductServiceForm />,
          },
          {
            path: "new-product",
            element: <AddProduct />,
          },
          {
            path: "new-finished-goods",
            element: <AddFinishedGoods />,
          },
          {
            path: "new-services",
            element: <AddServices />,
          },
          {
            path: "product-service-form",
            element: <ProductServiceForm />,
          },
        ],
      },
      {
        path: "mr-approval",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <MrApproval />,
          },
          {
            path: "send-item",
            element: <AddInventoryItem />,
          },
          {
            path: "batch",
            element: <Outlet />,
            children: [
              {
                path: "",
                element: <Batch />,
              },
              {
                path: "view/:grn",
                element: <ViewBatch />,
              },
              {
                path: "process/:grn",
                element: <ProcessBatch />,
              },
            ],
          },
        ],
      },
      {
        path: "unit-of-measurement",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <UnitOfMeasurement />,
          },
          {
            path: "add-unit-of-measurement",
            element: <MeasurementForm />,
          },
          {
            path: "batch",
            element: <Outlet />,
            children: [
              {
                path: "",
                element: <Batch />,
              },
              {
                path: "view/:grn",
                element: <ViewBatch />,
              },
              {
                path: "process/:grn",
                element: <ProcessBatch />,
              },
            ],
          },
        ],
      },
    ],
  },

  Purchase: {
    path: "purchase",
    element: <Outlet />,
    children: [
      {
        path: "purchase-list",

        element: <Outlet />,
        children: [
          {
            path: "",
            element: <PurchaseTable />,
          },
          {
            path: "new",
            element: <CreatePurchase />,
          },
        ],
      },
      {
        path: "purchase-requisition",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <PurchaseRequisitionList />,
          },
          {
            path: "new",
            element: <PurchaseRequisition />,
          },
        ],
      },
      {
        path: "requisition-approval",
        element: <RequisitionApproval />,
      },
      {
        path: "purchase-order",
        element: <PurchaseOrder />,
      },
      {
        path: "purchase-order-pdf",
        element: <PurchaseOrderPdf />,
      },
      {
        path: "supplier-payment-receipt",
        element: <SupplierPaymentReceiptPdf />,
      },
      {
        path: "goods-receive-note",
        element: <GoodsReceive />,
      },
      {
        path: "generate-good-receive-note",
        element: <GenerateGoodReceiveNote />,
      },
      {
        path: "inventory",
        element: <PurchaseInventory />,
      },
      {
        path: "payment",
        element: <GenerateMemo />,
      },
    ],
  },

  Expenses: {
    path: "expenses",
    element: <Outlet />,
    children: [
      {
        path: "billing",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <BillSources />,
          },
          {
            path: "product-supplier-bill",
            element: <ProductSupplierBill />,
          },
          {
            path: "product-supplier-bill-pdf",
            element: <ProductSupplierBillPdf />,
          },
          {
            path: "operating-expense-bill",
            element: <OperatingExpenses />,
          },
          {
            path: "operating-expense-bill-pdf",
            element: <OperatingExpenseBillPdf />,
          },
          {
            path: "imprest-receipt",
            element: <ImprestReceipt />,
          },
        ],
      },

      {
        path: "cash-expenses",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <CashExpenseSource />,
          },
          {
            path: "operating-cash-expense",
            // element: <ProductCashExpense />,
            element: <OperatingCashExpenses />,
          },
          {
            path: "product-cash-expense",
            element: <ProductCashExpense />,
          },
        ],
      },
    ],
  },

  Payments: {
    path: "payments",
    element: <Outlet />,
    children: [
      {
        path: "collection-points",
        element: <ReceivePayment />,
      },
      {
        path: "cashier-point",
        element: <ReceivePayment />,
      },
      {
        path: "collection-reconciliation",
        element: <CollectionReconciliation />,
      },
      {
        path: "receive-payment",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <ReceivedFunds />,
          },
          {
            path: "new",
            element: <RecordPaymentForm />,
          },
          {
            path: "pay",
            element: <RecordPaymentForm />,
          },
        ],
      },
      {
        path: "credit-note",
        element: <CreditNote />,
      },
      {
        path: "apply-advance",
        element: <ApplyCustomerAdvance />,
      },
      {
        path: "apply-deposit",
        element: <ApplySupplierDeposit />,
      },
      {
        path: "pay-bills",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <PaymentsMade />,
          },
          {
            path: "new",
            element: <RecordSupplierPaymentForm />,
          },
          {
            path: "unpaid",
            element: <PayBills />,
          },
          {
            path: "pay",
            element: <SupplierPaymentForm />,
          },
        ],
      },
    ],
  },

  Production: {
    path: "production",
    element: <Outlet />,
    children: [
      {
        path: "requisition",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <ManufacturingRequisitionList />,
          },
          {
            path: "new",
            element: <ManufacturingRequisition />,
          },
        ],
      },
      {
        path: "wip-inventory",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <WipInventory />,
          },
        ],
      },
      {
        path: "discount",
        element: <DiscountApproval />,
      },
      {
        path: "raw-material-collected",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <RawMaterialList />,
          },
          {
            path: "new",
            element: <RawMaterialForm />,
          },
          {
            path: "collection-pdf",
            element: <RawMaterialInvoice1 />,
          },
        ],
      },
      {
        path: "produce-list",
        element: <ProductionList />,
      },
      {
        path: "produce",
        element: <Production />,
      },
      {
        path: "production-invoice",
        element: <ProductionInvoice />,
      },
      {
        path: "collection",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <CollectionList />,
          },
          {
            path: "form",
            element: <CollectionForm />,
          },
          {
            path: "collection-invoice",
            element: <CollectionInvoice />,
          },
        ],
      },
      {
        path: "collection-approval",
        element: <CollectionApproval />,
      },
      {
        path: "energy-consumption",

        element: <Outlet />,
        children: [
          {
            path: "",
            element: <EnergyConsumptionList />,
          },
          {
            path: "record",
            element: <EnergyConsumption />,
          },
        ],
      },
      {
        path: "received-note",
        element: <MaterialReceivedNote />,
      },

      {
        path: "record",
        element: <RecordProduction />,
      },
      {
        path: "record-production",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <ManaufacturingProduction />,
          },
          {
            path: "new",
            element: <RecordProductionManufacturing />,
          },
        ],
      },
      {
        path: "automation",
        element: <ProductionAutomation />,
      },
      {
        path: "production-reports",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <ProductionReportingHub />,
          },
          {
            path: "production-report",
            element: <ProductionReport />,
          },
          {
            path: "fg-inventory",
            element: <FGInventoryReport />,
          },
          {
            path: "fg-inventory-by-location",
            element: <FGInventoryReport />,
          },
          {
            path: "rm-inventory",
            element: <RMInventoryReport />,
          },
          {
            path: "sales-per-product",
            element: <SalesPerProductReport />,
          },
          {
            path: "operator-production",
            element: <OperatorProductionReport />,
          },
          {
            path: "product-summary",
            element: <ProductProductionSummaryReport />,
          },
          {
            path: "production-vs-sales",
            element: <ProductionVsSalesComparisonReport />,
          },
          {
            path: "daily-batch-log",
            element: <DailyProductionReport />,
          },
          {
            path: "daily-batch-log/:batchId",
            element: <BatchDetailReport />,
          },
        ],
      },
      {
        path: "process",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <ProcessProduction />,
          },
          {
            path: "details",
            element: <ProcessDetails />,
          },
        ],
      },
    ],
  },

  Sales: {
    path: "sales",
    element: <Outlet />,
    children: [
      {
        path: "sale",
        element: <MakeSale />,
      },
      {
        path: "invoices",
        element: <InvoiceList />,
      },
      {
        path: "process",
        element: <SalesManagement />,
      },
      {
        path: "separation",
        element: <InvoiceSeparation />,
      },
      {
        path: "warehouse-requests",
        element: <WarehouseRequests />,
      },
      {
        path: "sales-line-report",
        element: <SalesLineReport />,
      },
      {
        path: "vat-report",
        element: <SalesLineReport variant="vat" />,
      },
      {
        path: "rebate",
        element: <RebateLedger />,
      },
      {
        path: "invoice-preview",
        element: <InvoicePreview />,
      },
      {
        path: "markup",
        element: <Markup />,
      },
      {
        path: "price-setup",
        element: <PriceSetup />,
      },
      {
        path: "markup/costing/:recordId",
        element: <Markup />,
      },
      {
        path: "transfer-form",
        element: <ReturnItem />,
      },
      {
        path: "return-items",
        element: <Transfer />,
      },
      {
        path: "receive-form",
        element: <ReciveForm />,
      },
      {
        path: "pending-sales",
        element: <PendingSales />,
      },
      {
        path: "post-sale",
        element: <PostSalePage />,
      },
      {
        path: "sales-pdf",
        element: <SalesPdf />,
      },
    ],
  },

  Customers: {
    path: "customers",
    element: <Outlet />,
    children: [
      {
        path: "",
        element: <CustomerTable />,
      },
      {
        path: "registration",
        element: <Navigate to="/app/customers" replace />,
      },
      {
        path: "edit",
        element: <CustomerEdit />,
      },
      {
        path: "view",
        element: <CustomerReport />,
      },
      {
        path: "view-entries",
        element: <CustomerEntries />,
      },
      {
        path: "view-receipt",
        element: <Outlet />,
        children: [
          {
            path: "print",
            element: <CustomerDepositReceiptPdf />,
          },
        ],
      },
      {
        path: "customer-deposit",
        element: <RecordPaymentForm />,
      },
      {
        path: "customer-security-deposit",
        element: <CustomerSecurityDepositForm />,
      },
    ],
  },

  Suppliers: {
    path: "suppliers",
    element: <Outlet />,
    children: [
      {
        path: "",
        element: <SupplierTable />,
      },
      {
        path: "report",
        element: <SupplierReport />,
      },
      {
        path: "edit",
        element: <SupplierForm />,
      },
      {
        path: "payment",
        element: <RedirectToPayBills action="" />,
      },
      {
        path: "new",
        element: <SupplierForm />,
      },
      {
        path: "supplier-deposit",
        element: <RedirectToPayBills action="deposit" />,
      },
      {
        path: "print",
        element: <SupplierPaymentReceipt />,
      },
    ],
  },

  Invoices: {
    path: "invoices",
    element: <Outlet />,
    children: [
      {
        path: "list",
        element: <InvoiceList />,
      },
      {
        path: "create",
        element: <CreateInvoice />,
      },
    ],
  },

  Projects: {
    path: "projects",
    element: <Outlet />,
    children: [
      {
        path: "project-list",
        element: <ProjectTable />,
      },
      {
        path: "create",
        element: <CreateInvoice />,
      },
      {
        path: "dashboard/:id",
        element: <ProjectDashboard />,
      },
    ],
  },

  Reports: {
    path: "reports",
    element: <Outlet />,
    children: [
      {
        path: "invoice-list",
        element: <TransactionReport />,
      },
      {
        path: "view-invoice",
        element: <ViewInvoice />,
      },
      {
        path: "expenses-report-form",
        element: <Expenses />,
      },

      {
        path: "expenses-report",
        element: <ExpensesReport />,
      },
      {
        path: "transaction",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <TransactionList />,
          },
          {
            path: "new",
            element: <TransactionTypeSelection />,
          },
          {
            path: "create/:typeId",
            element: <TransactionForm />,
          },
        ],
      },
      {
        path: "invoice-report-new",
        element: <InvoiceForm />,
      },
      {
        path: "trail-balance",
        element: <Trailbalance />,
      },
      {
        path: "accounting-reports",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <AccountingReports />,
          },
          {
            path: "general-ledger-pdf",
            element: <GeneralLedgerPDF />,
          },
          {
            path: "aa_erp-general-ledger",
            element: <AaErpGeneralLedger />,
          },
          {
            path: "aa_erp-trial-balance",
            element: <AaErpTrialBalance />,
          },
          {
            path: "aa_erp-balance-sheet",
            element: <AaErpBalanceSheet />,
          },
          {
            path: "aa_erp-statement-of-financial-position",
            element: <StatementOfFinancialPositionReport />,
          },
          {
            path: "aa_erp-income-statement",
            element: <AaErpIncomeStatement />,
          },
          {
            path: "aa_erp-income-statement-notes",
            element: <AaErpIncomeStatementNotes />,
          },
          {
            path: "payable-ledger",
            element: <PayableLedger />,
          },
          {
            path: "creditors-report",
            element: <CreditorsReport />,
          },
          {
            path: "payable-ledger-individual",
            element: <PayableLedgerIndividualReport />,
          },
          {
            path: "payable-aging",
            element: <AccountsPayableAgingReport />,
          },
          {
            path: "purchase-invoices-report",
            element: <PurchaseInvoicesReport />,
          },
          {
            path: "receivable-ledger",
            element: <DebtorsReport />,
          },
          {
            path: "receivable-ledger-aging",
            element: <ReceivableLedger />,
          },
          {
            path: "receivable-aging",
            element: <ReceivableAgingReport />,
          },
          {
            path: "sales-invoices-report",
            element: <SalesInvoicesReport />,
          },
          {
            path: "sales-by-product",
            element: <SalesPerProductReport />,
          },
          {
            path: "sales-by-supplier",
            element: <SalesBySupplierReport />,
          },
          {
            path: "bank-balances",
            element: <BankBalancesReport />,
          },
          {
            path: "custom-reports",
            element: <CustomReports />,
          },
          {
            path: "inventory-valuation",
            element: <InventoryValuationReport />,
          },
        ],
      },
      {
        path: "account-ledger-report",
        element: <AccountLedgerReport />,
      },
      {
        path: "production-reports",
        element: <ProductionReports />,
      },
      {
        path: "cash-flow",
        element: <CashFlows />,
      },
      {
        path: "income-expenses-statement",
        element: <IncomeExpenses />,
      },
      {
        path: "individual_ledger",
        element: <IndividualLedger />,
      },
      {
        path: "supplier_individual_ledger",
        element: <SupplierIndividualLedger />,
      },
      {
        path: "statement-of-financial",
        element: <StatementOfFinancial />,
      },
      {
        path: "operation-dashboard",
        element: <OperationDashboard />,
      },
      {
        path: "operation-deposit",
        element: <OperationDeposit />,
      },
      {
        path: "profit-loss-summary",
        element: <ProfitLossSummary />,
      },
      {
        path: "detail-operator-data",
        element: <DetailOperatorData />,
      },
    ],
  },

  Audit: {
    path: "audit",
    element: <Outlet />,
    children: [
      {
        path: "bank-reconciliation",
        element: <BankReconciliation1 />,
      },
      {
        path: "bank-reconciliation/audit-trail",
        element: <AuditTrailPage />,
      },
      {
        path: "bank-reconciliation/reports",
        element: <ReportsPage />,
      },
      // {
      //   path: "bank-transaction",
      //   element: <BankTransactions />,
      // },
    ],
  },

  Account: {
    path: "account",
    element: <Outlet />,
    children: [
      {
        path: "journal-entries",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <JournalEntryList />,
          },
          {
            path: "new",
            element: <JournalEntryForm />,
          },
          {
            path: ":transaction_ref",
            element: <JournalEntryDetail />,
          },
          {
            path: ":transaction_ref/edit",
            element: <JournalEntryForm />,
          },
        ],
      },
      {
        path: "cash-flow",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <CashFlowList />,
          },
        ],
      },
      {
        path: "record-expenses",
        element: <Outlet />,
        children: [
          {
            path: "",
            element: <RecordExpenses />,
          },
          {
            path: "pv-pdf",
            element: <PaymentVoucherPdf />,
          },
          {
            path: "pv-direct-pdf",
            element: <PaymentVoucherPdf />,
          },
          {
            path: "memo-pdf",
            element: <MemoPDF />,
          },
        ],
      },
      {
        path: "list-of-memos",
        element: <ListOfMemo />,
        // element: <Random name={"Purchase Page"}/>
      },
      // {
      //   path: "bank-account",
      //   element: <CreateBanks />,
      // },
      // {
      //   path: "generate-invoices",
      //   element: <GenerateInvoice />,
      // },
      // {
      //   path: "cash-movement",
      //   element: <CashMovement />,
      // },
      // {
      //   path: "generate-account-report",
      //   element: <GenerateAccountReport />,
      // },
      // {
      //   path: "opening-balance",
      //   element: <OpeningBalance />,
      // },
      // {
      //   path: "client-account-statement",
      //   element: <ChientAccountStatement />,
      // },
      // {
      //   path: "budget-proposal",
      //   element: <BudgetProposal />,
      // },
      // {
      //   path: "account-review",
      //   element: <AccountReview />,
      // },
      {
        path: "chart-of-account",
        element: <AccountChart />,
      },

      {
        path: "add-proposal",
        element: <AddProposal />,
      },
      {
        path: "manage-staff",
        element: <Random name={"Way"} />,
      },
      {
        path: "initiate-memo",
        element: <MemoList />,
      },
      {
        path: "memo",
        element: <Memo />,
      },
      {
        path: "edit-memo",
        element: <EditMemo />,
      },
      {
        path: "administrative-review",
        element: <MemoReviewal />,
      },
      // {
      //   path: "accounts-verification",
      //   element: <MemoAccountVerification />,
      // },
      {
        path: "approval",
        element: <ApprovalByMD />,
      },
      // {
      //   path: "create-taxes",
      //   element: <CreateTaxes />,
      // },
      // {
      //   path: "payment-voucher",
      //   element: <Outlet />,
      //   children: [
      //     {
      //       path: "pv-pdf",
      //       element: <PaymentVoucher />,
      //     },
      //     {
      //       path: "memo-pdf/:id",
      //       element: <MemoPDF />,
      //     },
      //   ],
      // },
      {
        path: "invoice",
        element: <Invoice />,
      },
      // {
      //   path: "bank-reconciliation",
      //   element: <BankReconciliationModals />,
      // },
    ],
  },

  Admin: {
    path: "admin",
    element: <Outlet />,
    children: [
      // {
      //   path: "manage-user",
      //   element: <Users />,
      // },
      {
        path: "manage-staff",
        element: <StaffManagementDashboard />,
      },
      {
        path: "manage-departments",
        element: (
          <Navigate to="/app/admin/settings#manage-departments" replace />
        ),
      },
      {
        path: "manage-branches",
        element: <BranchMgm />,
      },
      {
        path: "manage-users/new-user",
        element: <SignUp />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      {
        path: "customer-feedback",
        element: <Navigate to="/app/crm/feedback" replace />,
      },
      {
        path: "team-table",
        element: <Navigate to="/app/admin/settings#team-setup" replace />,
      },
      {
        path: "team-setup",
        element: <TeamSetup />,
      },
      {
        path: "update-team-setup/:teamId",
        element: <UpdateTeamSetup />,
      },
      {
        path: "rate-table",
        element: <Navigate to="/app/admin/settings#rate-setup" replace />,
      },
      {
        path: "rate-setup",
        element: <RateSetup />,
      },
      {
        path: "discount-setup",
        element: <DiscountSetup />,
      },
      {
        path: "discount-table",
        element: <Navigate to="/app/admin/settings#discount-setup" replace />,
      },
      {
        path: "price-setup",
        element: <PriceSetup />,
      },
      {
        path: "hr/*",
        element: <HRModule />,
      },
      {
        path: "bank",
        element: <Navigate to="/app/admin/settings#bank-setup" replace />,
      },
      {
        path: "tax",
        element: <Navigate to="/app/admin/settings#tax-setup" replace />,
      },
    ],
  },

  "Asset Register": {
    path: "assets/*",
    element: <AssetRegister />,
  },
};

export default function AppNavigation() {
  // YAMMUSA GLOBAL FARMS & AGRO ALLIED SERVICES is retail-only — never merge manufacturing/recycling (would pull Production)
  // Customers / Suppliers live under Sales / Purchase in the sidebar but keep their own routes
  // Expenses (Bill + cash expenses) is linked from Purchase but registered as its own module
  const allRouteKeys = new Set([
    ...(appTypeAccess["retailers"] || []),
    "Customers",
    "Suppliers",
    "Expenses",
    // CRM lives under Sales in the sidebar but keeps its own /app/crm routes
    "CRM",
  ]);

  // Map route keys to actual route modules, avoiding duplicates
  const dynamicRoutes = Array.from(allRouteKeys)
    .map((key) => routeModules[key])
    .filter(Boolean); // remove undefined in case of mismatch

  const pages = useRoutes([
    {
      path: "/",
      element: <Navigate to="/login" />,
    },
    {
      path: "forgot-password",
      element: <ForgotPasswordForm />,
    },
    {
      path: "app",
      element: <AppIndex />,
      children: [
        { path: "home", element: <Home /> },
        ...dynamicRoutes,
        // Explicit sales warehouse route (avoids 404 if Sales children HMR lags)
        {
          path: "sales/warehouse-requests",
          element: <WarehouseRequests />,
        },
        {
          path: "sales/separation",
          element: <InvoiceSeparation />,
        },
        { path: "production/*", element: <Navigate to="/app/home" replace /> },
        { path: "*", element: <NotFound /> },
      ],
    },
    {
      path: "",
      element: <Outlet />,
      children: [
        { path: "login", element: <Login /> },
        { path: "login/:businessSlug", element: <Login /> },
        {
          path: "account-switch",
          element: <AccountSwitch />,
        },
        { path: "signup", element: <Register2 /> },
        { path: "email-verification", element: <EmailVerification /> },
        { path: "token-verify", element: <TokenVerification /> },
        { path: "reset-password", element: <ResetPassword /> },
        {
          path: "accept-invite",
          element: <AcceptInvite />,
        },
        { path: "feedback", element: <CustomerFeedbackPage /> },
      ],
    },
    { path: "*", element: <NotFound /> },
  ]);

  return <>{pages}</>;
}
