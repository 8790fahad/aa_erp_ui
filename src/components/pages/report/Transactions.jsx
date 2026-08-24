/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  FileText,
  DollarSign,
  Calendar,
  Building,
  Save,
  Printer,
  Eye,
  Edit,
  Trash2,
  Receipt,
  CreditCard,
  RefreshCw,
  Banknote,
  CheckCircle,
  ArrowLeft,
  FileUp,
  FileImage,
} from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Loader, Typeahead } from "react-bootstrap-typeahead";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { formatNumber1, formatNaira } from "@/components/router/utilities";

const methods_of_payment = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank", label: "Bank" },
];
const Transaction = () => {
  const [activeTab, setActiveTab] = useState("list");
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [selectedTransactionType, setSelectedTransactionType] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [currentInvoice, setCurrentInvoice] = useState({
    invoiceNumber: "",
    account: "",
    cheque: "",
    transactionType: "",
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
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      },
    ],
    subtotal: 0,
    tax: 0,
    total: 0,
    status: "draft",
  });
  const { activeBusiness = {} } = useSelector((state) => state.auth);
  const [stores, setStores] = useState([]);
  const [banks, setBanks] = useState([]);
  // Transaction types with their configurations
  const transactionTypes = [
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
    // {
    //   id: "vendor_invoice",
    //   label: "Vendor Invoice",
    //   icon: Receipt,
    //   description: "Record purchases from vendors",
    //   accountType: "expense",
    //   debitAccount: "expense",
    //   creditAccount: "payable",
    //   showCustomer: false,
    //   showVendor: true,
    //   defaultAccounts: ["7101001", "7101002", "7202001", "6101000"],
    //   documentPrefix: "VI",
    // },
    {
      id: "quick_expense",
      label: "Quick Expense",
      icon: DollarSign,
      description: "Add business expenses quickly",
      accountType: "expense",
      debitAccount: "expense",
      creditAccount: "cash",
      showCustomer: false,
      showVendor: false,
      defaultAccounts: ["7101004", "7101008", "7202004", "21051"],
      documentPrefix: "QE",
    },
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
    // {
    //   id: "customer_deposit",
    //   label: "Customer Deposit",
    //   icon: Banknote,
    //   description: "Customer Deposit",
    //   accountType: "bulk",
    //   debitAccount: "expense",
    //   creditAccount: "payable",
    //   showCustomer: false,
    //   showVendor: false,
    //   isBulk: true,
    //   defaultAccounts: ["7101001", "7101002", "7101004", "6101000"],
    //   documentPrefix: "CD",
    // },
  ];

  const [isDragActive, setIsDragActive] = useState(false);
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const MAX_FILES = 5;

  useEffect(() => {
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

  // Mock data based on your database schema
  useEffect(() => {
    const mockAccounts = [
      // Revenue Accounts
      {
        head: "4101000",
        description: "Revenue from Sale of Recycled Plastic",
        account_type: "Revenue",
        category: "revenue",
      },
      {
        head: "4102000",
        description: "Revenue from Sale of By-products",
        account_type: "Revenue",
        category: "revenue",
      },
      {
        head: "4103000",
        description: "Revenue from recycling services",
        account_type: "Revenue",
        category: "revenue",
      },

      // Asset Accounts
      {
        head: "1205100",
        description: "Trade Receivable",
        account_type: "Assets",
        category: "receivable",
      },
      {
        head: "1201000",
        description: "Cash on Hand",
        account_type: "Assets",
        category: "cash",
      },
      {
        head: "1203000",
        description: "Bank Account ‚Operating",
        account_type: "Assets",
        category: "bank",
      },

      // Liability Accounts
      {
        head: "2105000",
        description: "VAT Payable",
        account_type: "Liability",
        category: "tax",
      },
      {
        head: "2101000",
        description: "Accounts Payable",
        account_type: "Liability",
        category: "payable",
      },

      // Expense Accounts
      {
        head: "7101001",
        description: "Office Salaries & Wages",
        account_type: "Expenses",
        category: "expense",
      },
      {
        head: "7101002",
        description: "Office Rent",
        account_type: "Expenses",
        category: "expense",
      },
      {
        head: "7101004",
        description: "Office Supplies",
        account_type: "Expenses",
        category: "expense",
      },
      {
        head: "7101008",
        description: "Telephone & Internet",
        account_type: "Expenses",
        category: "expense",
      },
      {
        head: "7202001",
        description: "Sales Salaries & Commissions",
        account_type: "Expenses",
        category: "expense",
      },
      {
        head: "7202004",
        description: "Travel & Entertainment",
        account_type: "Expenses",
        category: "expense",
      },
      {
        head: "6101000",
        description: "Cost of Raw Plastic Material",
        account_type: "COGS",
        category: "expense",
      },
      {
        head: "21051",
        description: "Office Supplies and Stationery",
        account_type: "Expenses",
        category: "expense",
      },
    ];

    const mockCustomers = [
      { id: "1205103", name: "Ibrahim Tsiko" },
      { id: "1205104", name: "Lamarafa" },
      { id: "1205106", name: "Idi" },
      { id: "1205101", name: "Umar Musa" },
    ];

    const mockVendors = [
      { id: "V001", name: "Kano Plastic Suppliers" },
      { id: "V002", name: "Northern Equipment Ltd" },
      { id: "V003", name: "Utility Company KEDCO" },
      { id: "V004", name: "Office Mart Nigeria" },
    ];

    const mockEmployees = [
      {
        id: "E001",
        name: "Ahmad Abdullahi",
        department: "Production",
        hourlyRate: 2500,
      },
      {
        id: "E002",
        name: "Fatima Mohammed",
        department: "Administration",
        hourlyRate: 3000,
      },
      {
        id: "E003",
        name: "Musa Ibrahim",
        department: "Sales",
        hourlyRate: 2800,
      },
      {
        id: "E004",
        name: "Aisha Usman",
        department: "Accounts",
        hourlyRate: 3500,
      },
    ];

    const mockApprovers = [
      { id: "A001", name: "Alhaji Sani Bello", title: "General Manager" },
      { id: "A002", name: "Mrs. Khadija Ahmed", title: "Finance Manager" },
      { id: "A003", name: "Eng. Aliyu Hassan", title: "Operations Manager" },
    ];

    setChartOfAccounts(mockAccounts);
    setCustomers(mockCustomers);
    setVendors(mockVendors);
    setEmployees(mockEmployees);
    setApprovers(mockApprovers);
  }, []);

  const handleCreateNewTransaction = () => {
    setShowTypeSelection(true);
    setSelectedTransactionType(null);
  };

  const handleTransactionTypeSelect = (transactionType) => {
    setSelectedTransactionType(transactionType);
    setShowTypeSelection(false);

    const docNum = `${transactionType.documentPrefix}-${Date.now()
      .toString()
      .slice(-6)}`;

    setCurrentInvoice({
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
    });

    setActiveTab("create");
  };

  const getFilteredAccounts = () => {
    if (!selectedTransactionType) return chartOfAccounts;

    const type = selectedTransactionType;

    switch (type.id) {
      case "log_work_hours":
        return chartOfAccounts.filter(
          (acc) =>
            acc.category === "expense" &&
            (acc.head.includes("7101001") ||
              acc.head.includes("6105000") ||
              acc.head.includes("21012"))
        );
      case "vendor_invoice":
      case "quick_expense":
        return chartOfAccounts.filter((acc) => acc.category === "expense");
      case "new_purchase_request":
        return chartOfAccounts.filter(
          (acc) =>
            acc.category === "expense" ||
            acc.head.includes("1104000") ||
            acc.head.includes("1106000")
        );
      case "vendor_refund":
      case "card_refund":
        return chartOfAccounts.filter(
          (acc) => acc.category === "cash" || acc.category === "bank"
        );
      case "bank_cheque":
      case "settle_card":
        return chartOfAccounts.filter((acc) => acc.category === "payable");
      case "bulk_bill_upload":
        return chartOfAccounts.filter((acc) => acc.category === "expense");
      default:
        return chartOfAccounts;
    }
  };

  const addInvoiceItem = () => {
    const newItem = {
      id: Date.now(),
      description: "",
      accountCode: "",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
    };
    setCurrentInvoice((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const updateInvoiceItem = (itemId, field, value) => {
    setCurrentInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice") {
            updatedItem.amount = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      }),
    }));
  };

  const removeInvoiceItem = (itemId) => {
    setCurrentInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const calculateTotals = () => {
    const subtotal = currentInvoice.items.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const tax =
      selectedTransactionType?.id === "vendor_invoice" ? subtotal * 0.075 : 0;
    const total = subtotal + tax;

    setCurrentInvoice((prev) => ({
      ...prev,
      subtotal,
      tax,
      total,
    }));
  };

  useEffect(() => {
    calculateTotals();
  }, [currentInvoice.items, selectedTransactionType]);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);

    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);

      // Validate files
      if (attachments.length + files.length > MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      const oversizedFiles = files.filter(
        (file) => file.size > 5 * 1024 * 1024
      ); // 5MB
      if (oversizedFiles.length > 0) {
        setFileError("Some files exceed 5MB limit");
        return;
      }

      setFileError("");
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const onFilesSelected = (files) => {
    if (!files) return;

    const fileArray = Array.from(files);

    // Validate files
    if (attachments.length + fileArray.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const oversizedFiles = fileArray.filter(
      (file) => file.size > 5 * 1024 * 1024
    ); // 5MB
    if (oversizedFiles.length > 0) {
      setFileError("Some files exceed 5MB limit");
      return;
    }

    setFileError("");
    setAttachments((prev) => [...prev, ...fileArray]);
  };

  const removeAttachment = (i) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
    setFileError(""); // Clear any errors when removing files
  };

  const fields = [
    {
      value: "description",
      title: "Description",
      custom: true,
      component: (item) => (
        <input
          type="text"
          value={item.description}
          onChange={(e) =>
            updateInvoiceItem(item.id, "description", e.target.value)
          }
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
          placeholder="Item description"
          disabled={selectedTransactionType?.id === "log_work_hours"}
        />
      ),
    },
    {
      value: "accountCode",
      title: "Account",
      custom: true,
      component: (item) => (
        <div style={{ position: "relative", width: "100%" }}>
          <Typeahead
            id={`account-typeahead-${item.id}`}
            size="sm"
            className="col-md-12 pl-0 pr-0"
            options={stores}
            placeholder="Select account..."
            onChange={(selectedItems) => {
              // Handle the selection - selectedItems is an array
              const selectedAccount = selectedItems[0];
              if (selectedAccount) {
                updateInvoiceItem(item.id, "accountCode", selectedAccount.code);
                updateInvoiceItem(
                  item.id,
                  "accountDescription",
                  selectedAccount.name
                );
                updateInvoiceItem(
                  item.id,
                  "accountSubhead",
                  selectedAccount.chart_code
                );
              } else {
                updateInvoiceItem(item.id, "accountCode", "");
                updateInvoiceItem(item.id, "accountDescription", "");
                updateInvoiceItem(item.id, "accountSubhead", "");
              }
            }}
            selected={
              // Find the selected account based on the current accountCode
              item.accountCode
                ? stores.filter((store) => store.code === item.accountCode)
                : []
            }
            labelKey="name" // Display the account name (description)
            positionFixed={true}
            style={{
              borderRadius: "7px",
            }}
          />
        </div>
      ),
    },
    {
      value: "quantity",
      title: "Qty",
      custom: true,
      component: (item) => (
        <input
          type="number"
          value={item.quantity}
          onChange={(e) =>
            updateInvoiceItem(
              item.id,
              "quantity",
              parseFloat(e.target.value) || 0
            )
          }
          className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
          min="1"
          disabled={selectedTransactionType?.id === "log_work_hours"}
        />
      ),
    },
    {
      value: "unitPrice",
      title: "Unit Price",
      custom: true,
      component: (item) => (
        <input
          type="number"
          value={item.unitPrice}
          onChange={(e) =>
            updateInvoiceItem(
              item.id,
              "unitPrice",
              parseFloat(e.target.value) || 0
            )
          }
          className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
          min="0"
          step="0.01"
          disabled={selectedTransactionType?.id === "log_work_hours"}
        />
      ),
    },
    {
      value: "amount",
      title: "Amount",
      custom: true,
      component: (item) => (
        <div className="font-semibold">₦{item.amount.toLocaleString()}</div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      component: (item) => {
        const isFirst = currentInvoice.items[0]?.id === item.id;

        if (selectedTransactionType?.id === "log_work_hours") return null;

        return (
          <div className="flex gap-2 justify-center">
            {isFirst ? (
              <button
                onClick={addInvoiceItem}
                className="text-[#5C7FC1] hover:text-green-700 p-1"
              >
                <Plus className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => removeInvoiceItem(item.id)}
                className="text-red-500 hover:text-red-700 p-1"
                disabled={currentInvoice.items.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const rows = currentInvoice.items;

  const totalAmount = rows.reduce((total, row) => total + row.amount, 0);

  const handleSubmit = () => {
    if (!selectedTransactionType) {
      toast.error("Please select a transaction type");
      return;
    }

    // Prepare the payload
    const dataEntry = {
      invoice_number: currentInvoice.invoiceNumber,
      transaction_type: selectedTransactionType.id,
      customer_id: currentInvoice.customerId,
      customer_name: currentInvoice.customerName,
      vendor_id: currentInvoice.vendorId,
      vendor_name: currentInvoice.vendorName,
      employee_id: currentInvoice.employeeId,
      employee_name: currentInvoice.employeeName,
      approver_id: currentInvoice.approverId,
      approver_name: currentInvoice.approverName,
      work_hours: currentInvoice.workHours,
      hourly_rate: currentInvoice.hourlyRate,
      invoice_date: currentInvoice.invoiceDate,
      due_date: currentInvoice.dueDate,
      description: currentInvoice.description,
      subtotal: currentInvoice.subtotal,
      tax: currentInvoice.tax,
      total: currentInvoice.total,
      status: "posted", // or "draft"
      items: currentInvoice.items.map((item) => ({
        description: item.description,
        account_code: item.accountCode,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.amount,
      })),
      attachments: attachments.map((file) => ({
        document_name: file.name,
        file_path: file.path || file.name, // depends how you save files
        original_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })),
    };

    const createEntry = (
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type,
      cheque,
      type,
      mode_of_payment,
      bank_account_id
    ) => ({
      amount,
      account_description,
      account_head,
      account_subhead,
      query_type,
      cheque,
      type,
      mode_of_payment,
      bank_account_id,
    });

    const supplierEntryData = currentInvoice.items.map((item) =>
      createEntry(
        item.amount,
        item.accountDescription,
        item.accountCode,
        item.accountSubhead,
        "tax",
        currentInvoice.cheque,
        "expenses",
        currentInvoice.mode_of_payment,
        currentInvoice.bankAccountCode
      )
    );

    const expenditureEntryData = createEntry(
      totalAmount,
      currentInvoice.bankAccountDescription,
      currentInvoice.bankAccountCode,
      currentInvoice.bankAccountSubhead,
      "net",
      currentInvoice.cheque,
      "expenses",
      currentInvoice.mode_of_payment,
      currentInvoice.bankAccountCode
    );

    const data = {
      supplierEntryData,
      expenditureEntryData,
    };

    setLoading(true);

    _postApi(
      `/insert-new-transaction`,
      dataEntry,
      (res) => {
        if (res.success) {
          toast.success("Transaction saved successfully!");
          console.log("Transaction saved:", res);
          setCurrentInvoice({
            invoiceNumber: "",
            transactionType: "",
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
            invoiceDate: new Date().toISOString().split("T")[0],
            dueDate: "",
            description: "",
            items: [
              {
                id: 1,
                description: "",
                accountCode: "",
                quantity: 1,
                unitPrice: 0,
                amount: 0,
              },
            ],
            subtotal: 0,
            tax: 0,
            total: 0,
            status: "draft",
          });
          setAttachments([]);
          setActiveTab("list");
          fetchTransactions();
          _postApi(
            `/v1/materials/insertCollectionProductionLedger`,
            data,
            (ledgerRes) => {
              if (ledgerRes.success) {
                console.log("Ledger entry successful", ledgerRes);
              }
              setLoading(false);
            },
            (ledgerErr) => {
              toast.error("Error in ledger entry");
              console.error(ledgerErr);
              setLoading(false);
            }
          );
        } else {
          toast.error("Failed to save transaction");
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error saving transaction");
        console.error("Transaction error:", err);
        setLoading(false);
      }
    );
  };

  const fetchTransactions = () => {
    _fetchApi(
      "/get-all-transactions",
      (res) => {
        if (res.success) {
          setTransactions(res.results);
        } else {
          toast.error("Failed to load transactions");
        }
      },
      (err) => {
        console.error(err);
        toast.error("Error fetching transactions");
      }
    );
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleItemChange = (index, field, value) => {
    setCurrentInvoice((prev) => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...prev, items: updatedItems };
    });
  };

  const TransactionTypeSelection = () => (
    <div className="bg-white p-2">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setShowTypeSelection(false)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Select Transaction Type 
          </h2>
          <p className="text-gray-600">
            Choose the type of transaction you want to create
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {transactionTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => handleTransactionTypeSelect(type)}
              className="p-6 border border-gray-200 rounded-xl hover:border-[#AAC7EF] hover:bg-[#C4DFFF] transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#AAC7EF] rounded-lg flex items-center justify-center group-hover:bg-[#AAC7EF] transition-colors">
                  <IconComponent className="w-6 h-6 text-[var(--aa-navy)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    {type.label}
                  </h3>
                  {/* <p className="text-sm text-gray-600 mb-3">
                    {type.description}
                  </p> */}
                  <div className="text-xs text-[var(--aa-navy)] font-medium">
                    Document: {type.documentPrefix}-XXXXXX
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const TransactionForm = () => (
    <div className="">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => {
            setActiveTab("list");
            setSelectedTransactionType(null);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#AAC7EF] rounded-lg flex items-center justify-center">
            {selectedTransactionType &&
              React.createElement(selectedTransactionType.icon, {
                className: "w-5 h-5 text-[var(--aa-navy)]",
              })}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedTransactionType?.label || "Create Transaction"}
            </h2>
            <p className="text-gray-600">
              {selectedTransactionType?.description}
            </p>
          </div>
        </div>
      </div>
      {/* {JSON.stringify({ currentInvoice, totalAmount, accountCode: currentInvoice.accountCode }, null, 2)} */}
      {/* {JSON.stringify(currentInvoice, null, 2)} */}

      {/* Transaction Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Number
          </label>
          <input
            type="text"
            value={currentInvoice.invoiceNumber}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            readOnly
          />
        </div>

        {selectedTransactionType?.showCustomer && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer *
            </label>
            <select
              value={currentInvoice.customerId}
              onChange={(e) => {
                const customer = customers.find((c) => c.id === e.target.value);
                setCurrentInvoice((prev) => ({
                  ...prev,
                  customerId: e.target.value,
                  customerName: customer?.name || "",
                }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedTransactionType?.showVendor && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor *
            </label>
            <select
              value={currentInvoice.vendorId}
              onChange={(e) => {
                const vendor = vendors.find((v) => v.id === e.target.value);
                setCurrentInvoice((prev) => ({
                  ...prev,
                  vendorId: e.target.value,
                  vendorName: vendor?.name || "",
                }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select Vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedTransactionType?.showEmployee && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employee *
            </label>
            <select
              value={currentInvoice.employeeId}
              onChange={(e) => {
                const employee = employees.find(
                  (emp) => emp.id === e.target.value
                );
                setCurrentInvoice((prev) => ({
                  ...prev,
                  employeeId: e.target.value,
                  employeeName: employee?.name || "",
                  hourlyRate: employee?.hourlyRate || 0,
                }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select Employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.department}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedTransactionType?.showApprover && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approver *
            </label>
            <select
              value={currentInvoice.approverId}
              onChange={(e) => {
                const approver = approvers.find(
                  (app) => app.id === e.target.value
                );
                setCurrentInvoice((prev) => ({
                  ...prev,
                  approverId: e.target.value,
                  approverName: approver?.name || "",
                }));
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select Approver</option>
              {approvers.map((approver) => (
                <option key={approver.id} value={approver.id}>
                  {approver.name} - {approver.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedTransactionType?.id === "log_work_hours" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Hours *
              </label>
              <input
                type="number"
                value={currentInvoice.workHours}
                onChange={(e) => {
                  const hours = parseFloat(e.target.value) || 0;
                  setCurrentInvoice((prev) => ({
                    ...prev,
                    workHours: hours,
                    items: [
                      {
                        ...prev.items[0],
                        quantity: hours,
                        unitPrice: prev.hourlyRate,
                        amount: hours * prev.hourlyRate,
                        description: `Labor - ${prev.employeeName} - ${hours} hours`,
                      },
                    ],
                  }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min="0"
                step="0.5"
                placeholder="8.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hourly Rate (₦)
              </label>
              <input
                type="number"
                value={currentInvoice.hourlyRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0;
                  setCurrentInvoice((prev) => ({
                    ...prev,
                    hourlyRate: rate,
                    items: [
                      {
                        ...prev.items[0],
                        quantity: prev.workHours,
                        unitPrice: rate,
                        amount: prev.workHours * rate,
                        description: `Labor - ${prev.employeeName} - ${prev.workHours} hours`,
                      },
                    ],
                  }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                min="0"
                step="100"
                placeholder="2500"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date
          </label>
          <input
            type="date"
            value={currentInvoice.invoiceDate}
            onChange={(e) =>
              setCurrentInvoice((prev) => ({
                ...prev,
                invoiceDate: e.target.value,
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Due Date
          </label>
          <input
            type="date"
            value={currentInvoice.dueDate}
            onChange={(e) =>
              setCurrentInvoice((prev) => ({
                ...prev,
                dueDate: e.target.value,
              }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mode of Payment
          </label>
          <Select
            value={currentInvoice.mode_of_payment}
            onValueChange={(value) =>
              setCurrentInvoice({ ...currentInvoice, mode_of_payment: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Bank Accounts</SelectLabel>
                {methods_of_payment.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {currentInvoice.mode_of_payment === "bank" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Account
              </label>
              <Typeahead
                id={`account-typeahead-${currentInvoice.id}`}
                size="sm"
                className="col-md-12 pl-0 pr-0"
                options={banks}
                placeholder="Select account..."
                onChange={(selectedItems) => {
                  // Handle the selection - selectedItems is an array
                  const selectedAccount = selectedItems[0];
                  if (selectedAccount) {
                    setCurrentInvoice({
                      ...currentInvoice,
                      bankAccountCode: selectedAccount.code,
                      bankAccountDescription: selectedAccount.name,
                      bankAccountSubhead: selectedAccount.chart_code,
                    });
                  } else {
                    setCurrentInvoice({
                      ...currentInvoice,
                      bankAccountCode: "",
                      bankAccountDescription: "",
                      bankAccountSubhead: "",
                    });
                  }
                }}
                selected={
                  // Find the selected account based on the current accountCode
                  currentInvoice.bankAccountCode
                    ? banks.filter(
                        (bank) => bank.code === currentInvoice.bankAccountCode
                      )
                    : []
                }
                labelKey="name" // Display the account name (description)
                positionFixed={true}
                style={{
                  borderRadius: "7px",
                }}
              />
            </div>
          </>
        )}
        {currentInvoice.mode_of_payment === "cheque" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bank Account
              </label>
              <Typeahead
                id={`account-typeahead-${currentInvoice.id}`}
                size="sm"
                className="col-md-12 pl-0 pr-0"
                options={banks}
                placeholder="Select account..."
                onChange={(selectedItems) => {
                  // Handle the selection - selectedItems is an array
                  const selectedAccount = selectedItems[0];
                  if (selectedAccount) {
                    setCurrentInvoice({
                      ...currentInvoice,
                      bankAccountCode: selectedAccount.code,
                      bankAccountDescription: selectedAccount.name,
                      bankAccountSubhead: selectedAccount.chart_code,
                    });
                  } else {
                    setCurrentInvoice({
                      ...currentInvoice,
                      bankAccountCode: "",
                      bankAccountDescription: "",
                      bankAccountSubhead: "",
                    });
                  }
                }}
                selected={
                  // Find the selected account based on the current accountCode
                  currentInvoice.bankAccountCode
                    ? banks.filter(
                        (bank) => bank.code === currentInvoice.bankAccountCode
                      )
                    : []
                }
                labelKey="name" // Display the account name (description)
                positionFixed={true}
                style={{
                  borderRadius: "7px",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cheque
              </label>
              <input
                type="number"
                value={currentInvoice.cheque}
                onChange={(e) =>
                  setCurrentInvoice((prev) => ({
                    ...prev,
                    cheque: e.target.value,
                  }))
                }
                className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </>
        )}
      </div>

      {/* Transaction Items */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Transaction Items
          </h3>
        </div>

        <div className="overflow-x-auto">
          <CustomTable1 data={rows} fields={fields} />
        </div>
        <section aria-labelledby="attach-heading" className="mb-8">
          <div className="my-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach Documents{" "}
              <span className="text-xs text-gray-500">
                (Optional, Max {MAX_FILES} files, 5MB each)
              </span>
            </label>
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                isDragActive
                  ? "border-[var(--aa-accent)] bg-blue-50"
                  : "border-gray-300 bg-gray-50"
              }`}
              style={{ minHeight: "120px" }}
            >
              <Input
                type="file"
                multiple
                onChange={(e) => onFilesSelected(e.target.files)}
                className="hidden"
                id="file-upload"
                accept="image/*,.pdf,.doc,.docx"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer w-full h-full flex flex-col items-center justify-center"
              >
                <FileImage size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 mb-1">
                  {isDragActive
                    ? "Drop files here..."
                    : "Drag & drop files here, or click to select"}
                </p>
                <p className="text-xs text-gray-500">
                  Supported: Images, PDF, Word documents
                </p>
              </label>
            </div>

            {fileError && (
              <p className="text-red-500 mt-2 text-sm">{fileError}</p>
            )}

            {attachments.length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {attachments.map((file, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    {/* File name (clickable preview for images) */}
                    {file.type && file.type.startsWith("image/") ? (
                      <div
                        className="truncate text-sm cursor-pointer text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)]"
                        title={file.name}
                        onClick={() => {
                          // Create a preview URL and open in new tab
                          const url = URL.createObjectURL(file);
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        {file.name}
                      </div>
                    ) : (
                      <div
                        className="truncate text-sm cursor-pointer text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)]"
                        title={file.name}
                        onClick={() => {
                          // Open file in new tab
                          const url = URL.createObjectURL(file);
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        {file.name}
                      </div>
                    )}

                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      className="text-white bg-red-500 hover:bg-red-600 shadow-none h-8 px-3"
                      size="sm"
                      onClick={() => removeAttachment(i)}
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Transaction Totals */}
      {/* <div className="bg-transparent rounded-lg p-6 mb-6">
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">
                ₦{currentInvoice.subtotal.toLocaleString()}
              </span>
            </div>
            {currentInvoice.tax > 0 && (
              <div className="flex justify-between py-2">
                <span className="text-gray-600">VAT (7.5%):</span>
                <span className="font-semibold">
                  ₦{currentInvoice.tax.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t border-gray-300 font-bold text-lg">
              <span>Total:</span>
              <span>₦{currentInvoice.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div> */}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={() =>
            setCurrentInvoice((prev) => ({ ...prev, status: "draft" }))
          }
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Save as Draft
        </button>
        <button
          onClick={handleSubmit}
          className="bg-[var(--aa-navy-hover)] hover:bg-[var(--aa-navy)] text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          {loading ? (
            <Loader className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save & Post
        </button>
      </div>
    </div>
  );

  const InvoiceList = () => (
    <div className="p-2 h-full">
      <div className="flex justify-between items-center mb-6">
        {/* {JSON.stringify(transactions)} */}
        <h2 className="text-2xl font-bold text-gray-800">Transaction List</h2>
        <button
          onClick={handleCreateNewTransaction}
          className="bg-[var(--aa-navy-hover)] hover:bg-[var(--aa-navy)] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Transaction
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No transactions created yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Document #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Party
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.first_document}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.transactionTypeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.customerName ||
                      invoice.vendorName ||
                      invoice.employeeName ||
                      "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(invoice.invoice_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ₦{formatNumber1(invoice.total.toLocaleString())}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invoice.status === "posted"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        {/* <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-8 rounded-t-xl">
            <h1 className="text-3xl font-bold mb-2">Transaction Management</h1>
            <p className="text-green-100">
              Create and manage financial transactions
            </p>
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8">
              <button
                onClick={() => setActiveTab("list")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "list"
                    ? "border-green-500 text-green-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Transaction List
              </button>
              {selectedTransactionType && (
                <button
                  onClick={() => setActiveTab("create")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === "create"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Create {selectedTransactionType.label}
                </button>
              )}
            </nav>
          </div>
        </div> */}

        {/* Content */}
        <div className="space-y-8">
          {showTypeSelection && <TransactionTypeSelection />}
          {activeTab === "list" && !showTypeSelection && <InvoiceList />}
          {activeTab === "create" && selectedTransactionType && (
            <TransactionForm />
          )}
        </div>
      </div>
    </div>
  );
};

export default Transaction;
