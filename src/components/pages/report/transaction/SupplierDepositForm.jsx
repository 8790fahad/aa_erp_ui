import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelector, useDispatch } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { formatNumber } from "@/utilities";
import moment from "moment";
// import SearchCustomerInput from "../../customer/components/SearchCustomerInput";
import SearchSupplierInput from "../../purchase/SearchSuppliers";
import { formatNumber1 } from "@/components/router/utilities";
import CustomTable1 from "@/common/Custom/CustomTable1";
import useQuery from "@/hooks/useQuery";
import { getSuppliers } from "@/redux/actions/suppliers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Memoized Payment Input Component to prevent re-renders
const PaymentInput = memo(({ invoiceId, maxAmount, currentPayment, onPaymentChange }) => {
  const [localValue, setLocalValue] = useState(currentPayment || "");
  const inputRef = useRef(null);

  // Sync with parent when currentPayment changes externally (but only if different)
  useEffect(() => {
    if (currentPayment !== localValue) {
      setLocalValue(currentPayment || "");
    }
  }, [currentPayment]);

  const handleChange = (e) => {
    const value = e.target.value;

    // Allow empty string or numeric input
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setLocalValue(value);

      // Debounce the parent callback to prevent excessive re-renders
      const numValue = parseFloat(value) || 0;
      if (value === "" || (numValue >= 0 && numValue <= maxAmount)) {
        // Use setTimeout to debounce and prevent focus loss
        setTimeout(() => {
          onPaymentChange(invoiceId, value);
        }, 0);
      }
    }
  };

  const handleBlur = (e) => {
    const value = e.target.value;
    const numValue = parseFloat(value) || 0;

    // If value exceeds max, set to max
    if (numValue > maxAmount) {
      const maxValue = maxAmount.toString();
      setLocalValue(maxValue);
      onPaymentChange(invoiceId, maxValue);
    } else if (value !== "") {
      // Ensure value is set even if empty
      onPaymentChange(invoiceId, value);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={localValue}
      placeholder="0.00"
      onChange={handleChange}
      onBlur={handleBlur}
      className="w-full px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      style={{ maxWidth: "150px" }}
    />
  );
});

PaymentInput.displayName = "PaymentInput";

// Custom comparison function for memo to prevent unnecessary re-renders
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.invoiceId === nextProps.invoiceId &&
    prevProps.maxAmount === nextProps.maxAmount &&
    prevProps.currentPayment === nextProps.currentPayment &&
    prevProps.onPaymentChange === nextProps.onPaymentChange
  );
};

const MemoizedPaymentInput = memo(PaymentInput, areEqual);

// Constants
const DOCUMENT_PREFIX = "CD";
const FORM_VALIDATION_RULES = {
  supplier_name: { required: true, message: "Please select a supplier" },
  supplier_number: { required: true, message: "Please select a supplier" },
  mod_account_code: { required: true, message: "Please select a account head" },
  amount_paid: {
    required: true,
    min: 0.01,
    message: "Amount must be greater than 0",
  },
  mode_of_payment: {
    required: true,
    message: "Please select a payment method",
  },
  bank_account_id: { required: true, message: "Please select a bank account" },
  date: { required: true, message: "Date is required" },
};

const methods_of_payment = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank", label: "Bank Transfer" },
];

export const SupplierDepositForm = () => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const query = useQuery();
  const dispatch = useDispatch();

  // Redux state
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const supplierList = useSelector((state) => state.suppliers.supplierList) || [];

  // Get transaction type data from navigation state
  const transactionType = location.state?.transactionType || {};
  const lineOfBusiness = transactionType.line_of_business || false;

  // Local state
  const [selectedSupplier, setSelectedSupplier] = useState([]);
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    supplier_name: "",
    supplier_number: "",
    supplier_subhead: "",
    amount_paid: "",
    narration: "",
    _mod_account_code: "",
    documentNumber: `${DOCUMENT_PREFIX}-${Date.now().toString().slice(-6)}`,
    mode_of_payment: "",
    mod_account_code: "",
    bank_account_id: "",
    bank_name: "",
    bank_code: "",
    bank_chart_code: "",
    cheque_number: "",
    balance: null,
    line_of_business: lineOfBusiness, // Add line of business field
  });

  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedInvoiceRef, setSelectedInvoiceRef] = useState(null);
  const [supplierEntries, setSupplierEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState({}); // Track payment amounts for each invoice
  const hasAutoSelectedSupplier = useRef(false); // Track if supplier has been auto-selected from query

  const validateForm = useCallback(() => {
    const newErrors = {};

    // Validate customer selection
    if (!selectedSupplier) {
      newErrors.customer = FORM_VALIDATION_RULES.supplier_name.message;
    }
    if (!form.mod_account_code) {
      newErrors.mod_account_code =
        FORM_VALIDATION_RULES.mod_account_code.message;
    }

    // Validate amount
    const amount = parseFloat(form.amount_paid);
    if (!form.amount_paid || amount <= 0) {
      newErrors.amount_paid = FORM_VALIDATION_RULES.amount_paid.message;
    }

    // Validate payment method selection
    if (!form.mode_of_payment) {
      newErrors.mode_of_payment = FORM_VALIDATION_RULES.mode_of_payment.message;
    }

    // Validate date
    if (!form.date) {
      newErrors.date = FORM_VALIDATION_RULES.date.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedSupplier, form]);

  // Event handlers
  const handleFormChange = ({ target: { name, value } }) => {
    if (form.mode_of_payment === "cash") {
      const selected = accountList.find(
        (account) => Number(account.head) === Number(value)
      );
      setForm((prev) => ({
        ...prev,
        [name]: value,
        _mod_account_code: selected.head,
        bank_account_id: selected.id,
      }));
    } else if (
      form.mode_of_payment === "cheque" ||
      form.mode_of_payment === "bank"
    ) {
      const selected = accountList.find(
        (account) => Number(account.id) === Number(value)
      );
      if (selected) {
        setForm((prev) => ({
          ...prev,
          [name]: selected.head,
          bank_account_id: value,
          mod_account_code: selected.id,
          _mod_account_code: selected.head,
        }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };
  const handleAmountChange = ({ target: { name, value } }) => {
    let remainingBalance = calculateRemainingBalance(form.balance, value);
    console.log(form.balance, "KDDDDDDDK");
    setForm((prev) => ({
      ...prev,
      [name]: value,
      remainingBalance: remainingBalance,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };
  function calculateRemainingBalance(balance, amountPaid) {
    const current = parseFloat(balance) || 0;
    const paid = parseFloat(amountPaid) || 0;
    return current + paid;
  }

  const handleSupplierChange = async (supplier) => {
    // Handle case when supplier is cleared/undefined
    if (!supplier) {
      setSelectedSupplier({});
      setSupplierInvoices([]);
      setForm((prev) => ({
        ...prev,
        supplier_name: "",
        supplier_number: "",
        supplier_subhead: "",
        balance: null,
      }));
      return;
    }
    await getSupplierBalance(supplier);
  };

  // Add account list fetching based on payment mode
  const fetchAccountList = useCallback(async () => {
    if (!activeBusiness?.id || !form.mode_of_payment) return;

    try {
      const response = await new Promise((resolve, reject) => {
        _postApi(
          `/inventory/product-list?query_type=${form.mode_of_payment}`,
          { facilityId: activeBusiness.id },
          resolve,
          reject
        );
      });

      if (response.success) {
        setAccountList(response.results);
      } else {
        toast.error("Failed to load account list");
      }
    } catch (error) {
      console.error("Account list API Error:", error);
      toast.error("Error loading account list");
    }
  }, [activeBusiness?.id, form.mode_of_payment]);
  const getReferenceNum = useCallback(() => {
    _fetchApi(
      `/get-and-update/sup_dep/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          const randomNum = `${resp.results}`.padStart(5, "0");
          const refNumber = `Ref-${randomNum}`;
          setForm((prev) => ({ ...prev, documentNumber: refNumber }));
        }
      },
      (err) => {
        toast.error(`Error generating SKU:${err}`);
      }
    );
  }, [activeBusiness.id]);
  const getSupplierBalance = async (supplier) => {
    console.log(supplier, "KDDDDDDDK");
    _fetchApi(
      `/api/supplier/balance/${supplier?.supplier_number}/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setSelectedSupplier({ ...supplier, balance: resp.balance });
          setForm((prev) => ({
            ...prev,
            supplier_name: supplier.supplier_name,
            supplier_number: supplier.supplier_number,
            supplier_subhead: supplier.supplier_subhead,
            balance: resp.balance,
          }));
          // Reset invoice payments when supplier changes
          setInvoicePayments({});
          // Fetch supplier invoices when supplier is selected
          fetchSupplierInvoices(supplier?.supplier_number);
        }
      }
    );
  };

  // Fetch supplier invoices
  const fetchSupplierInvoices = useCallback(async (supplierNumber) => {
    if (!supplierNumber || !activeBusiness?.id) {
      setSupplierInvoices([]);
      return;
    }

    setLoadingInvoices(true);
    try {
      // Fetch invoices directly filtered by supplierNo and type=purchase
      _fetchApi(
        `/get-all-transactions?facilityId=${activeBusiness.id}&supplierNo=${supplierNumber}&type=purchase`,
        (response) => {
          if (response && response.success && response.results) {
            const invoices = Array.isArray(response.results)
              ? response.results
              : Array.isArray(response.data)
              ? response.data
              : [];

            // Sort by date (newest first)
            invoices.sort((a, b) => {
              const dateA = new Date(a.transaction_date || a.created_at || a.invoice_date || 0);
              const dateB = new Date(b.transaction_date || b.created_at || b.invoice_date || 0);
              return dateB - dateA;
            });

            setSupplierInvoices(invoices);
          } else {
            setSupplierInvoices([]);
          }
          setLoadingInvoices(false);
        },
        (error) => {
          console.error("Error fetching supplier invoices:", error);
          setSupplierInvoices([]);
          setLoadingInvoices(false);
        }
      );
    } catch (error) {
      console.error("Error fetching supplier invoices:", error);
      setSupplierInvoices([]);
      setLoadingInvoices(false);
    }
  }, [activeBusiness?.id]);

  // Fetch supplier entries by receiptNo
  const fetchSupplierEntries = useCallback(async (receiptNo) => {
    if (!receiptNo || !activeBusiness?.id) {
      setSupplierEntries([]);
      return;
    }

    setLoadingEntries(true);
    try {
      _fetchApi(
        `/inventory/supplier-entries-by-receipt?facilityId=${activeBusiness.id}&receiptNo=${receiptNo}`,
        (response) => {
          if (response && response.success && response.results) {
            const entries = Array.isArray(response.results)
              ? response.results
              : Array.isArray(response.data)
              ? response.data
              : [];

            // Sort by date (newest first)
            entries.sort((a, b) => {
              const dateA = new Date(a.created_at || 0);
              const dateB = new Date(b.created_at || 0);
              return dateB - dateA;
            });

            setSupplierEntries(entries);
          } else {
            setSupplierEntries([]);
          }
          setLoadingEntries(false);
        },
        (error) => {
          console.error("Error fetching supplier entries:", error);
          setSupplierEntries([]);
          setLoadingEntries(false);
        }
      );
    } catch (error) {
      console.error("Error fetching supplier entries:", error);
      setSupplierEntries([]);
      setLoadingEntries(false);
    }
  }, [activeBusiness?.id]);

  // Handle invoice ref click
  const handleInvoiceRefClick = (invoiceRef) => {
    setSelectedInvoiceRef(invoiceRef);
    setShowEntryModal(true);
    fetchSupplierEntries(invoiceRef);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowEntryModal(false);
    setSelectedInvoiceRef(null);
    setSupplierEntries([]);
  };

  // Handle payment change for individual invoices
  const handleInvoicePaymentChange = useCallback((invoiceId, value) => {
    setInvoicePayments((prev) => {
      const updatedPayments = {
        ...prev,
        [invoiceId]: value === "" ? "" : value,
      };

      // Calculate and update total amount paid
      const totalPayments = Object.values(updatedPayments).reduce(
        (sum, val) => sum + (parseFloat(val) || 0),
        0
      );

      // Update the main form amount_paid field with total
      setForm((prevForm) => ({
        ...prevForm,
        amount_paid: totalPayments > 0 ? totalPayments.toString() : "",
      }));

      return updatedPayments;
    });
  }, []);

  useEffect(() => {
    getReferenceNum();
  }, [getReferenceNum]);

  // Fetch suppliers list on mount
  useEffect(() => {
    dispatch(getSuppliers());
  }, [dispatch]);

  // Auto-select supplier from query parameter
  useEffect(() => {
    const supplierCode = query.get("supplier_code");
    if (
      supplierCode &&
      supplierList.length > 0 &&
      !selectedSupplier.supplier_number &&
      !hasAutoSelectedSupplier.current
    ) {
      const supplier = supplierList.find(
        (sup) => sup.supplier_number === supplierCode
      );
      if (supplier) {
        hasAutoSelectedSupplier.current = true;
        handleSupplierChange(supplier);
      }
    }
  }, [supplierList, query, selectedSupplier]);

  const handleDeposit = async () => {
    if (!validateForm()) {
      setIsValidating(false);
      toast.error("Please fix the form errors before submitting");
      return;
    }
    if (
      activeBusiness?.payable_accural_code === "" ||
      activeBusiness?.payable_accural_code === null
    ) {
      toast.error("Payable Accrual Code is not set");
      return;
    }
    if (
      activeBusiness?.payable_code === "" ||
      activeBusiness?.payable_code === null
    ) {
      toast.error("Payable Code is not set");
      return;
    }

    setLoading(true);

    const depositData = {
      transaction_date: form.date,
      due_date: form.date,
      amount_paid: form.amount_paid,
      documentNumber: form.documentNumber,
      supplier_number: form.supplier_number,
      mode_of_payment: form.mode_of_payment,
      mod_account_code: form._mod_account_code,
      cheque_number: form.cheque_number,
      facilityId: activeBusiness.id,
      userId: user.id,
      narration: form.narration,
      payable_accural_code: activeBusiness?.payable_accural_code,
      payable_code: activeBusiness?.payable_code,
      bank_account_id: form.bank_account_id,
      line_of_business: form.line_of_business, // Add line of business field
    };

    console.log("Supplier Deposit Data:", depositData);
    console.log("Line of Business:", form.line_of_business);

    if (
      activeBusiness?.payable_accural_code === "" ||
      activeBusiness?.payable_accural_code === null
    ) {
      toast.error("Payable Accrual Code is not set");
      return;
    }
    if (
      activeBusiness?.payable_code === "" ||
      activeBusiness?.payable_code === null
    ) {
      toast.error("Payable Code is not set");
      return;
    }
    _postApi(
      `/api/supplier/create-supplier-payment`,
      depositData,
      (res) => {
        if (res.success) {
          toast.success(
            `Payment deposited successfully - ${res.results?.reference_number}`
          );
          console.log(res);

          // Navigate to PDF receipt
          const refNumber =
            res.results?.reference_number || res.data?.reference_number;
          setTimeout(() => {
            navigate(
              `/app/purchase/supplier-payment-receipt?ref_number=${refNumber}`
            );
          }, 1000);
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        const errorMessage =
          error.message || error.error || "Error processing payment deposit";
        toast.error(errorMessage);
        console.error("Deposit error:", error);

        // Show specific database error
        if (
          errorMessage.includes("Data truncated") ||
          errorMessage.includes("type")
        ) {
          toast.error("Database error. Please contact administrator.");
        }
      }
    );
  };

  // Effects
  useEffect(() => {
    if (form.mode_of_payment) {
      fetchAccountList();
    }
  }, [form.mode_of_payment, fetchAccountList]);

  // Render helpers
  const renderFormField = (label, children, errorKey) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {FORM_VALIDATION_RULES[errorKey]?.required && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>
      {children}
      {errors[errorKey] && (
        <div className="flex items-center gap-1 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          {errors[errorKey]}
        </div>
      )}
    </div>
  );

  const renderReadOnlyField = (label, value, formatter = (val) => val) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
        {formatter(value)}
      </div>
    </div>
  );

  return (
    <div className=" p-2">
      {/* Header */}
      {/* {JSON.stringify(activeBusiness?.payable_accural_code)} */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={loading}
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {"Supplier Payment"}
            </h1>
            <p className="text-gray-600">
              {"Record supplier payment and update accounts"}
            </p>
          </div>
        </div>
      </div>

      {/* Line of Business Indicator */}
      {/* {transactionType && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                lineOfBusiness ? "bg-green-500" : "bg-gray-400"
              }`}
            ></div>
            <span className="text-sm font-medium text-gray-700">
              Transaction Type: {transactionType.label}
            </span>
            <span className="text-sm text-gray-500">
              • Main Line of Business: {lineOfBusiness ? "Yes" : "No"}
            </span>
          </div>
        </div>
      )} */}

      {/* Form */}
      <div className="p-2">
        <div className="space-y-6 mb-8">
          {/* First row - Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Document Number */}
            {renderFormField(
              "Ref. Number",
              <input
                type="text"
                value={form.documentNumber}
                className="w-full px-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                readOnly
              />,
              "documentNumber"
            )}

            {/* Date */}
            {renderFormField(
              "Transaction Date",
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                required
                disabled={loading}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />,
              "date"
            )}
            {renderFormField(
              "Select Supplier",
              <SearchSupplierInput
                onChange={(s) => handleSupplierChange(s)}
                disabled={loading}
                edge="false"
                selected={selectedSupplier.supplier_number ? [selectedSupplier] : []}
              />,
              "supplier"
            )}

            {/* Total Liability */}
            {renderReadOnlyField(
              "Total Liability",
              selectedSupplier?.balance || 0,
              (value) => `₦ ${formatNumber1(value)}`
            )}

            {/* Amount Paid */}
            {renderFormField(
              "Amount Paid",
              <div className="space-y-1">
                <input
                  type="number"
                  name="amount_paid"
                  value={form.amount_paid}
                  onChange={handleAmountChange}
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {form.amount_paid && (
                  <div className="text-sm text-gray-500">
                    Formatted: ₦ {formatNumber1(form.amount_paid)}
                  </div>
                )}
              </div>,
              "amount_paid"
            )}

            {/* Balance */}
            {renderReadOnlyField(
              "Remaining Balance",
              form.remainingBalance,
              (value) => `₦ ${formatNumber1(value)}`
            )}
          </div>

          {/* Second row - Payment details */}
          {/* {JSON.stringify(form.mod_account_code,"=====")} */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Mode of Payment */}
            {renderFormField(
              "Mode of Payment",
              <select
                name="mode_of_payment"
                value={form.mode_of_payment}
                onChange={({ target: { value } }) =>
                  setForm((prev) => ({
                    ...prev,
                    mode_of_payment: value,
                    mod_account_code: "",
                    bank_account_id: "",
                  }))
                }
                disabled={loading}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Mode of Payment</option>
                {methods_of_payment.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>,
              "mode_of_payment"
            )}
            {/* {JSON.stringify(accountList,"=====")} */}
            {/* Bank Account Selection - Show for bank and cheque payments */}
            {(form.mode_of_payment === "bank" ||
              form.mode_of_payment === "cheque") &&
              form.amount_paid > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {form.mode_of_payment === "bank"
                      ? "Bank Account"
                      : form.mode_of_payment === "cheque"
                      ? "Bank Account"
                      : "Account Head"}
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <select
                    name="mod_account_code"
                    value={form.mod_account_code}
                    onChange={handleFormChange}
                    disabled={loading}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select account...</option>
                    {accountList.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.description} ({account.account_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            {/* {JSON.stringify(accountList)} */}
            {form.mode_of_payment === "cash" && form.amount_paid > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {"Account Head"}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  name="mod_account_code"
                  value={form.mod_account_code}
                  onChange={handleFormChange}
                  disabled={loading}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select account...</option>
                  {accountList.map((account) => (
                    <option key={account.head} value={account.mod_account_code}>
                      {account.description} ({account.head})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Cheque Number - Show only for cheque payments */}
            {form.mode_of_payment === "cheque" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Cheque Number
                </label>
                <input
                  type="text"
                  name="cheque_number"
                  value={form.cheque_number}
                  onChange={({ target: { value } }) =>
                    setForm((prev) => ({ ...prev, cheque_number: value }))
                  }
                  disabled={loading}
                  placeholder="Enter cheque number"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Third row - Additional details */}
          <div className="grid grid-cols-1 gap-6">
            {/* Remark/Notes */}
            {renderFormField(
              "Narration/Remark/Notes",
              <textarea
                name="narration"
                value={form.narration}
                onChange={({ target: { value } }) => {
                  setForm((prev) => ({ ...prev, narration: value }));
                }}
                disabled={loading}
                placeholder="Optional notes about this deposit"
                rows={3}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />,
              "narration"
            )}
          </div>
        </div>
{/* {JSON.stringify(selectedSupplier,"=====")} */}
        {/* Previous Invoices Table */}
        {Object.keys(selectedSupplier).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-2 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">
              Previous Invoices
            </h3> 
            {loadingInvoices ? (
              <div className="text-center py-8 text-gray-500">
                <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="mt-2">Loading invoices...</p>
              </div>
            ) : supplierInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left font-semibold">Invoice No.</TableHead>
                      <TableHead className="text-left font-semibold">Due Date</TableHead>
                      <TableHead className="text-right font-semibold"> Amount</TableHead>
                      <TableHead className="text-right font-semibold">Unpaid</TableHead>
                      <TableHead className="text-right font-semibold">Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierInvoices.map((item, idx) => {
                      const invoiceId = item.id || item.invoice_id || item.invoice_ref;
                      const maxAmount = parseFloat(item.balance_due || item.amount || 0);
                      const currentPayment = invoicePayments[invoiceId] || "";
                      const originalAmount = parseFloat(item.amount || item.total_amount || item.total || 0);
                      const unpaidAmount = parseFloat(item.balance_due || item.amount || 0);

                      return (
                        <TableRow key={idx} className="hover:bg-gray-50">
                          <TableCell className="text-left">
                            <div className="flex flex-col">
                              <button
                                onClick={() => handleInvoiceRefClick(item.invoice_ref)}
                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer text-left"
                              >
                                {item.invoice_ref || "N/A"}
                              </button>
                              {item.transaction_date && (
                                <small className="text-gray-500 text-xs mt-1">
                                  {moment(item.transaction_date).format("DD-MM-yyyy")}
                                </small>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-left">
                            {item.due_date ? moment(item.due_date).format("MMM DD, YYYY") : "N/A"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₦ {formatNumber1(originalAmount)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ₦ {formatNumber1(unpaidAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <MemoizedPaymentInput
                              key={invoiceId}
                              invoiceId={invoiceId}
                              maxAmount={maxAmount}
                              currentPayment={currentPayment}
                              onPaymentChange={handleInvoicePaymentChange}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No previous invoices found for this supplier</p>
              </div>
            )}
          </div>
        )}

        {/* Summary Card */}
        {Object.keys(selectedSupplier).length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">
              Deposit Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Supplier:</span>
                <span className="ml-2 font-medium">
                  {selectedSupplier.supplier_name}
                </span>
              </div>
              <div>
                <span className="text-blue-600">Current Balance:</span>
                <span className="ml-2 font-medium">
                  ₦ {formatNumber1(selectedSupplier.balance)}
                </span>
              </div>
              <div>
                <span className="text-blue-600">Amount Depositing:</span>
                <span className="ml-2 font-medium">
                  ₦ {formatNumber1(form.amount_paid || 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => navigate("/app/reports/transaction")}
            disabled={loading}
            className="px-6 py-2 shadow-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            disabled={loading}
            className="bg-[#5C7FC1] shadow-none hover:bg-[#4267B2] text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Payment
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Supplier Entries Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    Supplier Entries - {selectedInvoiceRef}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    View all entries for invoice reference: {selectedInvoiceRef}
                  </p>
                </div>
                <button
                  onClick={handleModalClose}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingEntries ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="mt-2 text-gray-600">Loading entries...</p>
                </div>
              ) : supplierEntries.length > 0 ? (
                <CustomTable1
                  data={supplierEntries}
                  fields={[
                    {
                      title: "Description",
                      value: "description",
                      className: "text-left",
                    },
                    {
                      title: "Qty In",
                      value: "qty_in",
                      className: "text-right",
                      custom: true,
                      component: (item) => formatNumber1(item.qty_in || 0),
                    },
                    {
                      title: "Qty Out",
                      value: "qty_out",
                      className: "text-right",
                      custom: true,
                      component: (item) => formatNumber1(item.qty_out || 0),
                    },
                    {
                      title: "Cost",
                      value: "cost",
                      className: "text-right",
                      custom: true,
                      component: (item) => `₦ ${formatNumber1(item.cost || 0)}`,
                    },
                    {
                      title: "Total",
                      value: "total",
                      className: "text-right",
                      custom: true,
                      component: (item) => {
                        const qty = (item.qty_in || 0) - (item.qty_out || 0);
                        const total = qty * (item.cost || 0);
                        return `₦ ${formatNumber1(total)}`;
                      },
                    },
                    {
                      title: "Payment Method",
                      value: "mode_of_payment",
                      className: "text-left",
                      custom: true,
                      component: (item) => item.mode_of_payment || "N/A",
                    },
                    {
                      title: "Date",
                      value: "created_at",
                      className: "text-left",
                      custom: true,
                      component: (item) => {
                        const date = item.created_at;
                        return date ? moment(date).format("MMM DD, YYYY HH:mm") : "N/A";
                      },
                    },
                  ]}
                  pageSize={10}
                  message="No entries found for this invoice"
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No entries found for invoice reference: {selectedInvoiceRef}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t bg-gray-50 p-4 flex justify-end">
              <button
                onClick={handleModalClose}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierDepositForm;
