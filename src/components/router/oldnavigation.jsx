// export function AppNavigation1() {
//   let pages = useRoutes([
//     {
//       path: "/",
//       element: <Navigate to="/login" />,
//     },
//     //admin
//     {
//       path: "app",
//       element: <AppIndex />,
//       children: [
//         {
//           path: "",
//           element: <Dashboard />,
//         },
//         {
//           path: "inventory",
//           element: <Outlet />,
//           children: [
//             {
//               path: "inventory-list",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <InventoryList />,
//                 },
//                 {
//                   path: "new",
//                   element: <AddInventoryItem />,
//                 },
//               ],
//             },
//             {
//               path: "store",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <Store />,
//                 },
//                 {
//                   path: "send-item",
//                   element: <AddInventoryItem />,
//                 },
//                 {
//                   path: "batch",
//                   element: <Outlet />,
//                   children: [
//                     {
//                       path: "",
//                       element: <Batch />,
//                     },
//                     {
//                       path: "view/:grn",
//                       element: <ViewBatch />,
//                     },
//                     {
//                       path: "process/:grn",
//                       element: <ProcessBatch />,
//                     },
//                   ],
//                 },
//               ],
//             },
//             {
//               path: "mr-approval",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <MrApproval />,
//                 },
//                 {
//                   path: "send-item",
//                   element: <AddInventoryItem />,
//                 },
//                 {
//                   path: "batch",
//                   element: <Outlet />,
//                   children: [
//                     {
//                       path: "",
//                       element: <Batch />,
//                     },
//                     {
//                       path: "view/:grn",
//                       element: <ViewBatch />,
//                     },
//                     {
//                       path: "process/:grn",
//                       element: <ProcessBatch />,
//                     },
//                   ],
//                 },
//               ],
//             },
//             {
//               path: "unit-of-measurement",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <UnitOfMeasurement />,
//                 },
//                 {
//                   path: "add-unit-of-measurement",
//                   element: <MeasurementForm />,
//                 },
//                 {
//                   path: "batch",
//                   element: <Outlet />,
//                   children: [
//                     {
//                       path: "",
//                       element: <Batch />,
//                     },
//                     {
//                       path: "view/:grn",
//                       element: <ViewBatch />,
//                     },
//                     {
//                       path: "process/:grn",
//                       element: <ProcessBatch />,
//                     },
//                   ],
//                 },
//               ],
//             },
//             {
//               path: "product-list",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <ProductList />,
//                 },
//                 {
//                   path: "new-product",
//                   element: <AddProduct />,
//                 },
//                 {
//                   path: "new-finished-goods",
//                   element: <AddFinishedGoods />,
//                 },
//                 {
//                   path: "new-services",
//                   element: <AddServices />,
//                 },
//               ],
//             },
//           ],
//         },

//         //setup account
//         {
//           path: "purchase",
//           element: <Outlet />,
//           children: [
//             {
//               path: "purchase-list",

//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <PurchaseTable />,
//                 },
//                 {
//                   path: "new",
//                   element: <CreatePurchase />,
//                 },
//               ],
//             },
//             {
//               path: "suppliers",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <SupplierTable />,
//                 },
//                 {
//                   path: "report",
//                   element: <SupplierReport />,
//                 },
//                 {
//                   path: "edit",
//                   element: <SupplierForm />,
//                 },
//                 {
//                   path: "payment",
//                   element: <SupplierPayment />,
//                 },
//               ],
//             },
//             {
//               path: "purchase-requisition",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <PurchaseRequisitionList />,
//                 },
//                 {
//                   path: "new",
//                   element: <PurchaseRequisition />,
//                 },
//               ],
//             },
//             {
//               path: "requisition-approval",
//               element: <RequisitionApproval />,
//             },
//             {
//               path: "purchase-order",
//               element: <PurchaseOrder />,
//             },
//             {
//               path: "purchase-order-pdf",
//               element: <PurchaseOrderPdf />,
//             },
//             {
//               path: "goods-receive-note",
//               element: <GoodsReceive />,
//             },
//             {
//               path: "generate-good-receive-note",
//               element: <GenerateGoodReceiveNote />,
//             },
//             {
//               path: "payment",
//               element: <GenerateMemo />,
//             },
//           ],
//         },

//         {
//           path: "production",
//           element: <Outlet />,
//           children: [
//             {
//               path: "requisition",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <ManufacturingRequisitionList />,
//                 },
//                 {
//                   path: "new",
//                   element: <ManufacturingRequisition />,
//                 },
//               ],
//             },
//             {
//               path: "received-note",
//               element: <MaterialReceivedNote />,
//             },
//             {
//               path: "produce",
//               element: <Production />,
//             },

//             {
//               path: "record",
//               element: <RecordProduction />,
//             },
//             {
//               path: "process",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <ProcessProduction />,
//                 },
//                 {
//                   path: "details",
//                   element: <ProcessDetails />,
//                 },
//               ],
//             },
//           ],
//         },
//         {
//           path: "customers",
//           element: <Outlet />,
//           children: [
//             {
//               path: "",
//               element: <CustomerTable />,
//             },
//             {
//               path: "edit",
//               element: <CustomerEdit />,
//             },
//             {
//               path: "view",
//               element: <CustomerReport />,
//             },
//             {
//               path: "customer-deposit",
//               element: <CustomerDeposit />,
//             },
//           ],
//         },
//         {
//           path: "sales",
//           element: <Outlet />,
//           children: [
//             {
//               path: "sale",
//               element: <MakeSale />,
//             },
//             {
//               path: "markup",
//               element: <Markup />,
//             },
//             {
//               path: "transfer-form",
//               element: <ReturnItem />,
//             },
//             {
//               path: "return-items",
//               element: <Transfer />,
//             },
//             {
//               path: "receive-form",
//               element: <ReciveForm />,
//             },
//             {
//               path: "pending-sales",
//               element: <PendingSales />,
//             },
//             {
//               path: "post-sale",
//               element: <PostSalePage />,
//             },
//             {
//               path: "sales-pdf",
//               element: <SalesPdf />,
//             },
//           ],
//         },
//         {
//           path: "settings",
//           element: <Outlet />,
//           children: [
//             {
//               path: "unit",
//               element: <UnitOfMeasure />,
//             },
//             {
//               path: "treatment",
//               element: <Treatment />,
//             },
//             {
//               path: "chart-code-setup",
//               element: <ChartCodeSetup />,
//             },
//           ],
//         },
//         {
//           path: "reports",
//           element: <Outlet />,
//           children: [
//             {
//               path: "invoice-list",
//               element: <TransactionReport />,
//             },
//             {
//               path: "view-invoice",
//               element: <ViewInvoice />,
//             },
//             {
//               path: "expenses-report-form",
//               element: <Expenses />,
//             },
//             {
//               path: "expenses-report",
//               element: <ExpensesReport />,
//             },
//             {
//               path: "invoice-report-new",
//               element: <InvoiceForm />,
//             },
//             {
//               path: "trail-balance",
//               element: <Trailbalance />,
//             },
//             {
//               path: "cash-flow",
//               element: <CashFlows />,
//             },
//             {
//               path: "income-expenses-statement",
//               element: <IncomeExpenses />,
//             },

//             {
//               path: "individual_ledger",
//               element: <IndividualLedger />,
//             },
//             {
//               path: "supplier_individual_ledger",
//               element: <SupplierIndividualLedger />,
//             },
//             {
//               path: "statement-of-financial",
//               element: <StatementOfFinancial />,
//             },
//           ],
//         },
//         {
//           path: "audit",
//           element: <Outlet />,
//           children: [
//             {
//               path: "bank-reconciliation",
//               element: <BankReconciliation />,
//             },
//             {
//               path: "bank-transaction",
//               element: <BankTransactions />,
//             },
//           ],
//         },

//         {
//           path: "account",
//           element: <Outlet />,
//           children: [
//             {
//               path: "record-expenses",
//               element: <Outlet />,
//               children: [
//                 {
//                   path: "",
//                   element: <RecordExpenses />,
//                 },
//                 {
//                   path: "pv-pdf",
//                   element: <PaymentVoucherPdf />,
//                 },
//                 {
//                   path: "pv-direct-pdf",
//                   element: <PaymentVoucherDirectExpenses />,
//                 },
//                 {
//                   path: "memo-pdf",
//                   element: <MemoPDF />,
//                 },
//               ],
//             },
//             {
//               path: "list-of-memos",
//               element: <ListOfMemo />,
//             },
//             // {
//             //   path: "bank-account",
//             //   element: <CreateBanks />,

//             // },
//             // {
//             //   path: "generate-invoices",
//             //   element: <GenerateInvoice />,

//             // },
//             // {
//             //   path: "cash-movement",
//             //   element: <CashMovement />,
//             // },
//             // {
//             //   path: "generate-account-report",
//             //   element: <GenerateAccountReport />,
//             // },
//             // {
//             //   path: "opening-balance",
//             //   element: <OpeningBalance />,
//             // },
//             // {
//             //   path: "client-account-statement",
//             //   element: <ChientAccountStatement />,
//             // },
//             {
//               path: "chart-of-account",
//               element: <SetupChartOfAccount />,
//             },
//             // {
//             //   path: "budget-proposal",
//             //   element: <BudgetProposal />,
//             // },
//             {
//               path: "add-proposal",
//               element: <AddProposal />,
//             },
//             {
//               path: "account-review",
//               element: <AccountReview />,
//             },
//             {
//               path: "manage-staff",
//               element: <Random name={"Way"} />,
//             },
//             {
//               path: "initiate-memo",
//               element: <MemoList />,
//             },
//             {
//               path: "memo",
//               element: <Memo />,
//             },
//             {
//               path: "edit-memo",
//               element: <EditMemo />,
//             },
//             {
//               path: "administrative-review",
//               element: <MemoReviewal />,
//             },
//             // {
//             //   path: "accounts-verification",
//             //   element: <MemoAccountVerification />,
//             // },
//             {
//               path: "approval",
//               element: <ApprovalByMD />,
//             },
//             {
//               path: "create-taxes",
//               element: <CreateTaxes />,
//             },
//             // {
//             //   path: "payment-voucher",
//             //   element: <Outlet />,
//             //   children: [
//             //     {
//             //       path: "pv-pdf",
//             //       element: <PaymentVoucher />,
//             //     },
//             //     {
//             //       path: "memo-pdf/:id",
//             //       element: <MemoPDF />,
//             //     },
//             //   ],
//             // },
//             {
//               path: "invoice",
//               element: <Invoice />,
//             },
//           ],
//         },
//         {
//           path: "admin",
//           element: <Outlet />,
//           children: [
//             {
//               path: "manage-user",
//               element: <Users />,
//             },
//             {
//               path: "manage-store",
//               element: <ManageStores />,
//             },
//             {
//               path: "manage-users/new-user",
//               element: <SignUp />,
//             },
//             {
//               path: "settings",
//               element: <Settings />,
//             },
//           ],
//         },
//         {
//           path: "*",
//           element: <NotFound />,
//         },
//       ],
//     },

//     //auth
//     {
//       path: "",
//       element: <Outlet />,
//       children: [
//         {
//           path: "login",
//           element: <Login />,
//         },
//         {
//           path: "signup",
//           element: <Register2 />,
//         },
//       ],
//     },

//     {
//       path: "*",
//       element: <NotFound />,
//     },
//   ]);

//   return <>{pages}</>;
// }
