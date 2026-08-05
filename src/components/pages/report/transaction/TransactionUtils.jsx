// utils/transactionUtils.js
import { DollarSign, Receipt } from "lucide-react";

export const methods_of_payment = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank", label: "Bank" },
];

export const transactionTypes = [
  // {
  //   id: "log_work_hours",
  //   label: "Log Work Hours",
  //   icon: Calendar,
  //   description: "Record employee work hours and labor costs",
  //   accountType: "labor",
  //   debitAccount: "expense",
  //   creditAccount: "payable",
  //   showCustomer: false,
  //   showVendor: false,
  //   showEmployee: true,
  //   defaultAccounts: ["7101001", "6105000", "21012"],
  //   documentPrefix: "WH",
  // },
  {
    id: "supplier_deposit",
    label: "Supplier Payment",
    icon: Receipt,
    description: "Record payments to suppliers",
    accountType: "expense",
    debitAccount: "expense",
    creditAccount: "payable",
    showCustomer: false,
    showVendor: true,
    defaultAccounts: ["7101001", "7101002", "7202001", "6101000"],
    documentPrefix: "SD",
  },
  // {
  //   id: "quick_expense",
  //   label: "Quick Expense",
  //   icon: DollarSign,
  //   description: "Add business expenses quickly",
  //   accountType: "expense",
  //   debitAccount: "expense",
  //   creditAccount: "cash",
  //   showCustomer: false,
  //   showVendor: false,
  //   defaultAccounts: ["7101004", "7101008", "7202004", "21051"],
  //   documentPrefix: "QE",
  // },
  // {
  //   id: "bank_cheque",
  //   label: "Bank Cheque Payment",
  //   icon: Banknote,
  //   description: "Process cheque payments",
  //   accountType: "payment",
  //   debitAccount: "payable",
  //   creditAccount: "bank",
  //   showCustomer: false,
  //   showVendor: true,
  //   defaultAccounts: ["2101000"],
  //   documentPrefix: "BP",
  // },
  // {
  //   id: "new_purchase_request",
  //   label: "New Purchase Request",
  //   icon: FileText,
  //   description: "Create purchase requests for approval",
  //   accountType: "request",
  //   debitAccount: "expense",
  //   creditAccount: "payable",
  //   showCustomer: false,
  //   showVendor: true,
  //   showApprover: true,
  //   defaultAccounts: ["7101004", "6101000", "1104000", "1106000"],
  //   documentPrefix: "PR",
  // },
  // {
  //   id: "vendor_refund",
  //   label: "Vendor Refund",
  //   icon: RefreshCw,
  //   description: "Record refunds from vendors",
  //   accountType: "refund",
  //   debitAccount: "cash",
  //   creditAccount: "expense",
  //   showCustomer: false,
  //   showVendor: true,
  //   defaultAccounts: ["1201000", "1203000"],
  //   documentPrefix: "VR",
  // },
  // {
  //   id: "card_refund",
  //   label: "Card Refund",
  //   icon: CreditCard,
  //   description: "Process card refunds",
  //   accountType: "refund",
  //   debitAccount: "cash",
  //   creditAccount: "revenue",
  //   showCustomer: true,
  //   showVendor: false,
  //   defaultAccounts: ["1201000", "1203000"],
  //   documentPrefix: "CR",
  // },
  // {
  //   id: "settle_card",
  //   label: "Settle Card Balance",
  //   icon: CheckCircle,
  //   description: "Settle outstanding card balances",
  //   accountType: "settlement",
  //   debitAccount: "payable",
  //   creditAccount: "bank",
  //   showCustomer: false,
  //   showVendor: false,
  //   defaultAccounts: ["2101000"],
  //   documentPrefix: "CS",
  // },
  // {
  //   id: "bulk_bill_upload",
  //   label: "Bulk Bill Upload",
  //   icon: Building,
  //   description: "Upload multiple bills in bulk",
  //   accountType: "bulk",
  //   debitAccount: "expense",
  //   creditAccount: "payable",
  //   showCustomer: false,
  //   showVendor: false,
  //   isBulk: true,
  //   defaultAccounts: ["7101001", "7101002", "7101004", "6101000"],
  //   documentPrefix: "BB",
  // },
  {
    id: "customer_deposit",
    label: "Customer Deposit",
    icon: Receipt,
    description: "Record customer deposits",
    accountType: "deposit",
    debitAccount: "cash",
    creditAccount: "revenue",
    showCustomer: true,
    showVendor: false,
    defaultAccounts: ["1201000", "4101000", "4102000"],
    documentPrefix: "CD",
  },
  {
    id: "customer_security_deposit",
    label: "Customer Security Deposit",
    icon: DollarSign,
    description: "Record customer security deposits (refundable)",
    accountType: "security_deposit",
    debitAccount: "cash",
    creditAccount: "liability",
    showCustomer: true,
    showVendor: false,
    defaultAccounts: ["1201000", "2101000", "2102000"],
    documentPrefix: "CSD",
  },
];

export const getTransactionTypeById = (id) => {
  return transactionTypes.find((type) => type.id === id);
};

export const createInitialInvoiceState = (transactionType) => {
  const docNum = `${transactionType.documentPrefix}-${Date.now()
    .toString()
    .slice(-6)}`;

  return {
    invoiceNumber: docNum,
    transactionType: transactionType.id,
    customerId: "",
    customerName: "",
    vendorId: "",
    vendorName: "",
    employeeId: "",
    employeeName: "",
    approverId: "",
    approverName: "",
    workHours: 0,
    hourlyRate: 0,
    mode_of_payment: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    description: "",
    items: [
      {
        id: 1,
        description: "",
        accountCode: "",
        accountDescription: "",
        accountSubhead: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      },
    ],
    subtotal: 0,
    tax: 0,
    total: 0,
    status: "draft",
  };
};

import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

export const useTransactionData = () => {
  const { activeBusiness = {} } = useSelector((state) => state.auth);
  const [stores, setStores] = useState([]);
  const [banks, setBanks] = useState([]);

  useEffect(() => {
    // Load administrative expenses
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setStores(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );

    // Load banks data
    _postApi(
      `/inventory/product-list?query_type=banks_details`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setBanks(
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
            }))
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      }
    );
  }, [activeBusiness.id]);

  return { stores, banks };
};
