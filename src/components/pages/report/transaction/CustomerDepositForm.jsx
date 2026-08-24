import { useState, useEffect, useCallback, memo, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save, AlertCircle, X } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import moment from "moment";
import SearchCustomerInput from "../../customer/components/SearchCustomerInput";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import CustomTable1 from "@/common/Custom/CustomTable1";
import useQuery from "@/hooks/useQuery";
import { getCustomers } from "@/redux/actions/customer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Typeahead } from "react-bootstrap-typeahead";

// Format number with commas (for display)
const formatNumberWithCommas = (value) => {
  if (!value || value === "") return "";

  // Remove all non-numeric characters except decimal point
  const numericValue = value.replace(/[^0-9.]/g, "");

  // Check if the value ends with a decimal point (user is typing decimal)
  const endsWithDot = numericValue.endsWith(".");

  // Split into integer and decimal parts
  const parts = numericValue.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts[1] || "";

  // Add commas to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Combine with decimal part if exists, or preserve trailing dot
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  } else if (endsWithDot && integerPart) {
    // Preserve the decimal point if user just typed it
    return `${formattedInteger}.`;
  } else {
    return formattedInteger;
  }
};

// Parse formatted number (remove commas for calculations)
const parseNumberFromFormatted = (value) => {
  if (!value || value === "") return "";
  // Remove commas and keep only numbers and decimal point
  return value.replace(/,/g, "");
};

// Memoized Payment Input Component
const PaymentInput = memo(
  ({ invoiceId, maxAmount, currentPayment, onPaymentChange }) => {
    const [localValue, setLocalValue] = useState(currentPayment || "");
    const inputRef = useRef(null);

    useEffect(() => {
      if (currentPayment !== localValue) {
        setLocalValue(currentPayment || "");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPayment]);

    const handleChange = (e) => {
      const value = e.target.value;
      // Format the value with commas
      const formattedValue = formatNumberWithCommas(value);
      setLocalValue(formattedValue);

      // Parse the formatted value to get numeric amount
      const parsedValue = parseNumberFromFormatted(formattedValue);
      const numValue = parseFloat(parsedValue) || 0;

      // Validate against maxAmount (individual invoice balance)
      if (formattedValue === "" || (numValue >= 0 && numValue <= maxAmount)) {
        setTimeout(() => {
          onPaymentChange(invoiceId, formattedValue, maxAmount);
        }, 0);
      } else if (numValue > maxAmount) {
        // Cap at maxAmount immediately
        const cappedFormatted = formatNumberWithCommas(String(maxAmount));
        setLocalValue(cappedFormatted);
        setTimeout(() => {
          onPaymentChange(invoiceId, cappedFormatted, maxAmount);
        }, 0);
      }
    };

    const handleBlur = (e) => {
      const value = e.target.value;
      const parsedValue = parseNumberFromFormatted(value);
      const numValue = parseFloat(parsedValue) || 0;

      if (numValue > maxAmount) {
        const maxFormatted = formatNumberWithCommas(String(maxAmount));
        setLocalValue(maxFormatted);
        onPaymentChange(invoiceId, maxFormatted, maxAmount);
      } else if (value !== "" && numValue < 0) {
        setLocalValue("0");
        onPaymentChange(invoiceId, "0", maxAmount);
      } else if (value !== "") {
        // Ensure value is formatted
        const formatted = formatNumberWithCommas(parsedValue);
        setLocalValue(formatted);
        onPaymentChange(invoiceId, formatted, maxAmount);
      }
    };

    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        size="sm"
        value={localValue}
        placeholder="0.00"
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-full px-3 py-2 text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none transition-all"
      />
    );
  }
);

PaymentInput.displayName = "PaymentInput";

// Constants
const DOCUMENT_PREFIX = "CD";
const FORM_VALIDATION_RULES = {
  customer: { required: true, message: "Please select a customer" },
  amount_paid: {
    required: true,
    min: 0.01,
    message: "Amount must be greater than 0",
  },
  mod_account_code: { required: true, message: "Please select a account head" },
  mode_of_payment: {
    required: true,
    message: "Please select a payment method",
  },
  date: { required: true, message: "Date is required" },
  narration: { required: true, message: "Narration/Remark/Notes is required" },
};

const methods_of_payment = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank", label: "Bank Transfer" },
];

const CustomerDepositForm = () => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const query = useQuery();
  const dispatch = useDispatch();

  // Redux state
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const customerList =
    useSelector((state) => state.customer.customerList) || [];

  // Get transaction type data from navigation state
  const transactionType = location.state?.transactionType || {};
  const lineOfBusiness = transactionType.line_of_business || false;

  // Local state
  const [selectedCustomer, setSelectedCustomer] = useState([]);
  const [form, setForm] = useState({
    date: "",
    customer_name: "",
    amount_paid: "",
    narration: "",
    documentNumber: `${DOCUMENT_PREFIX}-${Date.now().toString().slice(-6)}`,
    customer_no: "",
    customerSubhead: "",
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

  // Branch selection
  const [branches, setBranches] = useState([]);

  /** Branch ids assigned to the logged-in staff (multi). */
  const userBranchIds = useMemo(() => {
    if (Array.isArray(user?.branchIds) && user.branchIds.length > 0) {
      return user.branchIds.map(Number).filter(Boolean);
    }
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((b) => Number(b.id || b.branch_id))
        .filter(Boolean);
    }
    if (user?.branchId) return [Number(user.branchId)];
    return [];
  }, [user?.branchIds, user?.branches, user?.branchId]);

  const hasAssignedBranches = userBranchIds.length > 0;
  const [selectedBranch, setSelectedBranch] = useState(() => {
    const fromQuery = query.get("branch_id");
    if (fromQuery) return String(fromQuery);
    if (userBranchIds.length > 0) return String(userBranchIds[0]);
    return "all";
  });

  const [accountList, setAccountList] = useState([]);
  const [headList, setHeadList] = useState([]);
  const [bankAccount, setBankAccount] = useState(null);
  const [accountHead, setAccountHead] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedInvoiceRef, setSelectedInvoiceRef] = useState(null);
  const [customerEntries, setCustomerEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [invoicePayments, setInvoicePayments] = useState({}); // Track payment amounts for each invoice
  const hasAutoSelectedCustomer = useRef(false); // Track if customer has been auto-selected from query
  const cashAccountTypeaheadRef = useRef();
  // Guard flag to prevent duplicate deposit submissions
  const isSubmittingRef = useRef(false);

  const validateForm = useCallback(() => {
    const newErrors = {};

    // Validate customer selection
    if (!selectedCustomer[0]) {
      newErrors.customer = FORM_VALIDATION_RULES.customer.message;
    }
    if (!form.mod_account_code) {
      newErrors.mod_account_code =
        FORM_VALIDATION_RULES.mod_account_code.message;
    }
    // Validate amount (parse formatted value)
    const parsedAmount = parseNumberFromFormatted(form.amount_paid);
    const amount = parseFloat(parsedAmount);
    if (!form.amount_paid || amount <= 0) {
      newErrors.amount_paid = FORM_VALIDATION_RULES.amount_paid.message;
    }

    // Validate payment method selection
    if (!form.mode_of_payment) {
      newErrors.mode_of_payment = FORM_VALIDATION_RULES.mode_of_payment.message;
    }

    // Validate payment source based on mode
    if (form.mode_of_payment === "cash") {
      if (!accountHead?.head && !form.mod_account_code) {
        newErrors.mod_account_code =
          "Account Head is required for cash payments";
      }
    } else if (["bank", "cheque"].includes(form.mode_of_payment)) {
      if (!bankAccount?.id && !form.mod_account_code) {
        newErrors.mod_account_code =
          "Bank Account is required for bank/cheque payments";
      }
    }

    // Validate date
    if (!form.date) {
      newErrors.date = FORM_VALIDATION_RULES.date.message;
    }

    // Validate narration
    if (!form.narration || form.narration.trim() === "") {
      newErrors.narration = FORM_VALIDATION_RULES.narration.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedCustomer, form, accountHead?.head, bankAccount?.id]);

  // Event handlers
  const handleFormChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Calculate total outstanding balance from invoices
  const totalOutstandingBalance = useMemo(() => {
    return customerInvoices.reduce(
      (sum, invoice) =>
        sum + parseFloat(invoice.amount_due || invoice.balance_due || 0),
      0
    );
  }, [customerInvoices]);

  // Handle Amount Paid change - distribute sequentially across invoices
  const handleAmountPaidChange = useCallback(
    ({ target: { value } }) => {
      // Format the value with commas
      const formattedValue = formatNumberWithCommas(value);

      // No cap on Amount Paid - can be more than total outstanding
      setForm((prev) => ({ ...prev, amount_paid: formattedValue }));

      // Clear error when user starts typing
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (newErrors.amount_paid) {
          delete newErrors.amount_paid;
        }
        return newErrors;
      });

      // Distribute the amount sequentially across invoices (first to last)
      if (customerInvoices.length > 0 && formattedValue !== "") {
        // Parse the formatted value to get numeric amount
        const parsedValue = parseNumberFromFormatted(formattedValue);
        const amountToDistribute = parseFloat(parsedValue) || 0;
        const newInvoicePayments = {};
        let remainingAmount = amountToDistribute;

        // Distribute sequentially: settle first invoice first, then second, etc.
        for (const invoice of customerInvoices) {
          if (remainingAmount <= 0) break;

          const invoiceId =
            invoice.id || invoice.invoice_id || invoice.invoice_ref;
          const balanceDue = parseFloat(
            invoice.amount_due || invoice.balance_due || 0
          );

          if (balanceDue > 0) {
            // Pay as much as possible for this invoice (up to balance due)
            const paymentAmount = Math.min(balanceDue, remainingAmount);

            if (paymentAmount > 0) {
              // Store formatted value for display
              newInvoicePayments[invoiceId] = formatNumberWithCommas(
                paymentAmount.toFixed(2)
              );
              remainingAmount -= paymentAmount;
            }
          }
        }

        // Update invoice payments
        setInvoicePayments(newInvoicePayments);
      } else if (formattedValue === "") {
        // Clear all invoice payments if amount is cleared
        setInvoicePayments({});
      }
    },
    [customerInvoices]
  );

  const handleCustomerChange = async (customer) => {
    // Handle case when customer is cleared/undefined
    if (!customer || (Array.isArray(customer) && customer.length === 0)) {
      setSelectedCustomer([]);
      setCustomerInvoices([]);
      setForm((prev) => ({
        ...prev,
        customer_name: "",
        customer_no: "",
        customerSubhead: "",
        balance: null,
      }));
      return;
    }

    // Normalize customer to array format if it's a single object
    const customerArray = Array.isArray(customer) ? customer : [customer];

    // Validate customer has required fields
    if (!customerArray[0] || !customerArray[0].customerNo) {
      console.warn("Invalid customer data:", customer);
      return;
    }

    await getCustomerBalance(customerArray);
  };

  // Payment method logic (from PayBills.jsx pattern)
  useEffect(() => {
    // Clear bank account and account head when payment mode changes
    setBankAccount(null);
    setAccountHead({});
    setAccountList([]);
    setHeadList([]);

    if (form.mode_of_payment === "cash") {
      _postApi(
        `/inventory/product-list?query_type=${form.mode_of_payment}`,
        { facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) {
            setHeadList(resp?.results);
          } else {
            toast.error("Failed to load list of items.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Something went wrong while fetching data.");
        }
      );
    } else if (
      form.mode_of_payment === "cheque" ||
      form.mode_of_payment === "bank"
    ) {
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
        (data) => {
          if (data.success) {
            setAccountList(data.results || []);
          } else {
            toast.error("Failed to load bank accounts");
          }
        },
        (err) => {
          console.error(err);
          toast.error("Failed to load bank accounts");
        }
      );
    }
  }, [form.mode_of_payment, activeBusiness?.id]);
  const getReferenceNum = useCallback(() => {
    _fetchApi(
      `/get-and-update/cus_dep/${activeBusiness.id}`,
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
  const getCustomerBalance = async (customer) => {
    // Validate customer input
    if (!customer || !Array.isArray(customer) || customer.length === 0) {
      console.warn("Invalid customer data in getCustomerBalance:", customer);
      return;
    }

    const customerNo = customer[0]?.customerNo;
    if (!customerNo) {
      console.warn("Customer number is missing:", customer);
      return;
    }

    _fetchApi(
      `/api/v1/get-customer-balance/${customerNo}/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          let cus = [];
          customer.forEach((item) => {
            cus.push({ ...item, balance: resp.balance });
          });
          setSelectedCustomer(cus);
          setForm((prev) => ({
            ...prev,
            customer_name: customer[0]?.fullname || "",
            customer_no: customerNo,
            customerSubhead:
              customer[0]?.account_head || customer[0]?.subhead || "",
            balance: resp.balance,
          }));
          // Reset invoice payments when customer changes
          setInvoicePayments({});
          // Fetch customer invoices when customer is selected
          fetchCustomerInvoices(customerNo);
        }
      },
      (error) => {
        console.error("Error fetching customer balance:", error);
        toast.error("Failed to fetch customer balance");
      }
    );
  };

  // Fetch customer invoices using the new outstanding invoices endpoint
  const fetchCustomerInvoices = useCallback(
    async (customerNo) => {
      if (!customerNo || !activeBusiness?.id) {
        setCustomerInvoices([]);
        return;
      }

      setLoadingInvoices(true);
      try {
        // Fetch outstanding invoices using the new endpoint
        _fetchApi(
          `/api/v1/get-outstanding-invoices?customerNo=${customerNo}&facilityId=${
            activeBusiness.id
          }&userId=${user?.id || ""}`,
          (response) => {
            if (response && response.success && response.results) {
              const invoices = Array.isArray(response.results)
                ? response.results
                : Array.isArray(response.data)
                ? response.data
                : [];

              // Sort by date (newest first)
              invoices.sort((a, b) => {
                const dateA = new Date(
                  a.transaction_date || a.created_at || a.invoice_date || 0
                );
                const dateB = new Date(
                  b.transaction_date || b.created_at || b.invoice_date || 0
                );
                return dateB - dateA;
              });

              setCustomerInvoices(invoices);
            } else {
              setCustomerInvoices([]);
            }
            setLoadingInvoices(false);
          },
          (error) => {
            console.error("Error fetching customer invoices:", error);
            setCustomerInvoices([]);
            setLoadingInvoices(false);
          }
        );
      } catch (error) {
        console.error("Error fetching customer invoices:", error);
        setCustomerInvoices([]);
        setLoadingInvoices(false);
      }
    },
    [activeBusiness?.id, user?.id]
  );

  // Fetch customer entries by receiptNo
  const fetchCustomerEntries = useCallback(
    async (receiptNo) => {
      if (!receiptNo || !activeBusiness?.id) {
        setCustomerEntries([]);
        return;
      }

      setLoadingEntries(true);
      try {
        _fetchApi(
          `/api/v1/get-customer-entries-by-receipt?facilityId=${activeBusiness.id}&receiptNo=${receiptNo}`,
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

              setCustomerEntries(entries);
            } else {
              setCustomerEntries([]);
            }
            setLoadingEntries(false);
          },
          (error) => {
            console.error("Error fetching customer entries:", error);
            setCustomerEntries([]);
            setLoadingEntries(false);
          }
        );
      } catch (error) {
        console.error("Error fetching customer entries:", error);
        setCustomerEntries([]);
        setLoadingEntries(false);
      }
    },
    [activeBusiness?.id]
  );

  // Handle invoice ref click
  const handleInvoiceRefClick = (invoiceRef) => {
    setSelectedInvoiceRef(invoiceRef);
    setShowEntryModal(true);
    fetchCustomerEntries(invoiceRef);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowEntryModal(false);
    setSelectedInvoiceRef(null);
    setCustomerEntries([]);
  };

  // Handle payment change for individual invoices
  const handleInvoicePaymentChange = useCallback(
    (invoiceId, value, maxAmount) => {
      setInvoicePayments((prev) => {
        // Parse the formatted value to get numeric amount
        const parsedValue = parseNumberFromFormatted(value);
        const numValue = parseFloat(parsedValue) || 0;

        // Validate: individual invoice payment cannot exceed its balance due
        let finalValue = value;
        if (numValue > maxAmount) {
          finalValue = formatNumberWithCommas(String(maxAmount));
        } else if (value !== "") {
          // Ensure value is properly formatted
          finalValue = formatNumberWithCommas(parsedValue);
        }

        const updatedPayments = {
          ...prev,
          [invoiceId]: finalValue === "" ? "" : finalValue,
        };

        return updatedPayments;
      });
    },
    []
  );

  // Calculate total payment amount
  const totalPaymentAmount = useMemo(() => {
    return Object.values(invoicePayments).reduce((sum, val) => {
      // Parse formatted values before summing
      const parsed = parseNumberFromFormatted(String(val));
      return sum + (parseFloat(parsed) || 0);
    }, 0);
  }, [invoicePayments]);

  const amountToDepositDisplay = useMemo(() => {
    if (totalPaymentAmount > 0) return totalPaymentAmount;
    const parsedAmount = parseNumberFromFormatted(String(form.amount_paid || ""));
    const amount = parseFloat(parsedAmount);
    return Number.isFinite(amount) ? amount : 0;
  }, [form.amount_paid, totalPaymentAmount]);

  useEffect(() => {
    getReferenceNum();
  }, [getReferenceNum]);

  // Fetch customers list on mount
  useEffect(() => {
    dispatch(getCustomers());
  }, [dispatch]);

  // Fetch branches for the facility
  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp?.success) setBranches(resp.results || []);
      },
      () => setBranches([])
    );
  }, [activeBusiness?.id]);

  // Safety mechanism: Reset loading state if it's been true for too long (prevents UI freeze)
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn(
          "Loading state has been active for 30 seconds, resetting to prevent UI freeze"
        );
        setLoading(false);
        toast.error("Request timed out. Please try again.");
      }, 30000); // 30 seconds timeout

      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // Auto-select customer from query parameter
  useEffect(() => {
    const customerId = query.get("customer_id");
    if (
      customerId &&
      customerList.length > 0 &&
      !selectedCustomer[0] &&
      !hasAutoSelectedCustomer.current
    ) {
      const customer = customerList.find(
        (cust) => cust.customerNo === customerId
      );
      if (customer) {
        hasAutoSelectedCustomer.current = true;
        handleCustomerChange(customer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerList, query, selectedCustomer]);

  const handleDeposit = async () => {
    // Hard guard: if a deposit is already being processed, ignore further clicks
    if (isSubmittingRef.current || loading) {
      return;
    }

    try {
      if (!validateForm()) {
        toast.error("Please fix the form errors before submitting");
        return;
      }
      if (
        activeBusiness?.receivable_accural_code === "" ||
        activeBusiness?.receivable_accural_code === null
      ) {
        toast.error("Receivable Accrual Code is not set");
        return;
      }
      if (
        activeBusiness?.receivable_code === "" ||
        activeBusiness?.receivable_code === null
      ) {
        toast.error("Receivable Code is not set");
        return;
      }

      const parsedAmountPaid = parseNumberFromFormatted(form.amount_paid);
      const amountPaidNum = parseFloat(parsedAmountPaid) || 0;
      if (totalPaymentAmount > amountPaidNum + 0.01) {
        toast.error(
          `Invoice payments (₦${formatNumber1(totalPaymentAmount)}) cannot exceed total amount paid (₦${formatNumber1(amountPaidNum)}). Reduce per-invoice amounts or increase the total.`
        );
        return;
      }

      // At this point validation passed; mark submission in progress
      isSubmittingRef.current = true;
      setLoading(true);
      // Map invoices with their payment amounts from invoicePayments state
      const invoicesWithPayments = customerInvoices
        .map((invoice) => {
          const invoiceId =
            invoice.id || invoice.invoice_id || invoice.invoice_ref;
          // Parse formatted payment value
          const paymentValue = invoicePayments[invoiceId] || "";
          const parsedPayment = parseNumberFromFormatted(String(paymentValue));
          const paymentAmount = parseFloat(parsedPayment) || 0;

          // Only include invoices that have a payment amount > 0
          if (paymentAmount > 0) {
            return {
              invoice_id: invoice.id || invoice.invoice_id,
              invoice_ref: invoice.invoice_ref,
              amount_paid: paymentAmount,
              balance_due: parseFloat(
                invoice.amount_due || invoice.balance_due || 0
              ),
            };
          }
          return null;
        })
        .filter(Boolean); // Remove null entries

      // Parse formatted amount_paid before sending to API
      const depositData = {
        transaction_date: form.date,
        amount_paid: amountPaidNum,
        customer_no: selectedCustomer[0].customerNo,
        mode_of_payment: form.mode_of_payment,
        cheque_number: form.cheque_number,
        facilityId: activeBusiness.id,
        userId: user.id,
        narration: form.narration,
        accountHead: accountHead,
        bankAccount: bankAccount,
        receivable_deposit_code: activeBusiness?.receivable_accural_code,
        receivable_code: activeBusiness?.receivable_code,
        invoices: invoicesWithPayments,
        branchId:
          selectedBranch && selectedBranch !== "all"
            ? parseInt(selectedBranch, 10) || null
            : null,
      };

      // Debug: Log the deposit data to see what's being sent
      console.log("[create-customer-deposit] payload", depositData);
      console.log("[create-customer-deposit] invoices", invoicesWithPayments);
      _postApi(
        `/api/v1/create-customer-deposit`,
        depositData,
        (res) => {
          try {
            setLoading(false);
            isSubmittingRef.current = false;
            if (res && res.success) {
              // The API returns data in res.data.reference_number
              const referenceNumber =
                res.data?.reference_number ||
                res.data?.transaction_ref ||
                res.results?.reference_number ||
                res.reference_number ||
                "";

              toast.success(`Fund Deposited Successfully ${referenceNumber}`);

              // Use customer_no from form state (we know this exists since form was validated)
              const customerNo =
                form.customer_no || selectedCustomer[0]?.customerNo;

              // Use reference_number from response data
              const invoiceRef = referenceNumber;

              console.log("Navigation data:", {
                invoiceRef,
                customerNo,
                formCustomerNo: form.customer_no,
                selectedCustomerNo: selectedCustomer[0]?.customerNo,
                responseData: res.data,
                fullResponse: res,
              });

              if (invoiceRef && customerNo) {
                navigate(
                  `/app/customers/view-receipt/print?invoice_ref=${invoiceRef}&customer_no=${customerNo}`,
                  { replace: true }
                );
              } else {
                console.error(
                  "Missing invoice_ref or customer_no for navigation:",
                  {
                    invoiceRef,
                    customerNo,
                    formCustomerNo: form.customer_no,
                    selectedCustomerNo: selectedCustomer[0]?.customerNo,
                    responseData: res.data,
                    fullResponse: res,
                  }
                );
                toast.error(
                  `Receipt created but could not navigate to print page. Reference: ${
                    referenceNumber || "N/A"
                  }. Please view receipt manually.`
                );
              }
            } else {
              // Handle case where API returns but success is false
              const errorMessage =
                res?.error ||
                res?.message ||
                "Failed to process deposit. Please try again.";
              toast.error(errorMessage);
              console.error("Deposit failed:", res);
            }
          } catch (callbackError) {
            setLoading(false);
            console.error("Error in success callback:", callbackError);
            toast.error("An error occurred while processing the response");
          }
        },
        (error) => {
          setLoading(false);
          isSubmittingRef.current = false;
          const errorMessage =
            error?.error ||
            error?.message ||
            error?.toString() ||
            "Failed to process deposit. Please try again.";
          toast.error(errorMessage);
          console.error("Deposit error:", error);
        }
      );
    } catch (error) {
      // Catch any synchronous errors that occur before API call
      setLoading(false);
      isSubmittingRef.current = false;
      const errorMessage =
        error?.message ||
        error?.toString() ||
        "An unexpected error occurred. Please try again.";
      toast.error(errorMessage);
      console.error("Error in handleDeposit:", error);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 ">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={loading}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Customer Deposit
            </h1>
            <p className="text-sm text-gray-600">
              Record customer deposit and update accounts
            </p>
          </div>
        </div>
        {/* Main Form Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-2">
          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={
                  loading || (hasAssignedBranches && userBranchIds.length === 1)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none transition-all bg-white"
              >
                {!hasAssignedBranches && (
                  <option value="all">All Warehouses</option>
                )}
                {branches
                  .filter(
                    (b) =>
                      !hasAssignedBranches ||
                      userBranchIds.includes(Number(b.id))
                  )
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Transaction Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none transition-all"
              />
              {errors.date && (
                <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.date}
                </div>
              )}
            </div>

            {/* Select Customer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer <span className="text-red-500">*</span>
              </label>
              <SearchCustomerInput
                label="Select Customer"
                onChange={handleCustomerChange}
                disabled={loading}
                selected={selectedCustomer}
              />
              {errors.customer && (
                <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.customer}
                </div>
              )}
            </div>

            {/* Amount Paid - Editable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount Paid{" "}
                {form.amount_paid ? formatNumber1(form.amount_paid) : null}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                name="amount_paid"
                value={form.amount_paid || ""}
                onChange={handleAmountPaidChange}
                disabled={loading}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none transition-all text-right font-semibold"
              />
              {errors.amount_paid && (
                <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.amount_paid}
                </div>
              )}
            </div>

            {/* Mode of Payment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode of Payment <span className="text-red-500">*</span>
              </label>
              <select
                value={form.mode_of_payment}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mode_of_payment: e.target.value,
                    mod_account_code: "",
                    bank_account_id: "",
                  }))
                }
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none transition-all bg-white"
              >
                <option value="">Select Mode of Payment</option>
                {methods_of_payment.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              {errors.mode_of_payment && (
                <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.mode_of_payment}
                </div>
              )}
            </div>
            {/* {JSON.stringify(accountList[0])} */}
            {/* Account Head / Bank Account */}
            {(form.mode_of_payment === "bank" ||
              form.mode_of_payment === "cash" ||
              form.mode_of_payment === "cheque") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {["bank", "cheque"].includes(form.mode_of_payment)
                    ? "Bank Account"
                    : "Account Head"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                {["bank", "cheque"].includes(form.mode_of_payment) ? (
                  <Select
                    value={bankAccount?.id?.toString() || ""}
                    onValueChange={(value) => {
                      const account = accountList.find(
                        (acc) => acc.id === Number(value)
                      );
                      if (account) {
                        setBankAccount(account);
                        // mod_account_code should be the account code/head (not id)
                        // bank_account_id should be the account id
                        setForm((prev) => ({
                          ...prev,
                          mod_account_code:
                            account.head || account.code || account.id,
                          bank_account_id: account.id,
                        }));
                        // Clear any errors when selection is made
                        if (errors.mod_account_code) {
                          setErrors((prev) => ({
                            ...prev,
                            mod_account_code: "",
                          }));
                        }
                      } else {
                        setBankAccount(null);
                        setForm((prev) => ({
                          ...prev,
                          mod_account_code: "",
                          bank_account_id: "",
                        }));
                      }
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full h-10 bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-2 focus:ring-[var(--aa-accent)]">
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {/* {JSON.stringify(accountList)} */}
                      {accountList.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.id.toString()}
                        >
                          {account.head} {account.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    <Typeahead
                      ref={cashAccountTypeaheadRef}
                      id="cash-account-typeahead"
                      labelKey={(option) =>
                        `${option.head} ${option.description}`
                      }
                      options={headList}
                      placeholder="Select cash on hand item..."
                      onChange={(selectedItems) => {
                        if (selectedItems && selectedItems.length > 0) {
                          const cash = selectedItems[0];
                          setAccountHead({
                            head: cash.head || "",
                            description: cash.description || "",
                          });
                          // For cash payments, mod_account_code should be the head/code
                          // bank_account_id might be needed for some systems, use id if available
                          setForm((prev) => ({
                            ...prev,
                            mod_account_code: cash.head || cash.code || "",
                            bank_account_id: cash.id || "",
                          }));
                          // Clear any errors when selection is made
                          if (errors.mod_account_code) {
                            setErrors((prev) => ({
                              ...prev,
                              mod_account_code: "",
                            }));
                          }
                        } else {
                          setAccountHead({});
                          setForm((prev) => ({
                            ...prev,
                            mod_account_code: "",
                            bank_account_id: "",
                          }));
                        }
                      }}
                      selected={
                        accountHead?.head
                          ? headList.filter(
                              (cash) => cash.head === accountHead.head
                            )
                          : []
                      }
                      clearButton
                      allowNew={false}
                      renderMenuItemChildren={(option) => (
                        <div className="py-1">
                          <div className="font-semibold text-slate-800">
                            {option.head} {option.description}
                          </div>
                          {option.account_type && (
                            <small className="text-slate-600 text-xs">
                              Type: {option.account_type}
                            </small>
                          )}
                        </div>
                      )}
                      inputProps={{
                        style: {
                          width: "100%",
                          height: "2.5rem",
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.875rem",
                          lineHeight: "1.25rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "0.375rem",
                          backgroundColor: "white",
                          transition: "all 0.15s ease-in-out",
                        },
                      }}
                      positionFixed={true}
                    />
                    {accountHead?.head && (
                      <button
                        onClick={() => {
                          setAccountHead({});
                          setForm((prev) => ({
                            ...prev,
                            mod_account_code: "",
                            bank_account_id: "",
                          }));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                {errors.mod_account_code && (
                  <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.mod_account_code}
                  </div>
                )}
              </div>
            )}

            {/* Cheque Number */}
            {form.mode_of_payment === "cheque" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cheque Number
                </label>
                <input
                  type="text"
                  name="cheque_number"
                  value={form.cheque_number}
                  onChange={handleFormChange}
                  disabled={loading}
                  placeholder="Enter cheque number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none transition-all"
                />
              </div>
            )}
          </div>

          {/* Narration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Narration/Remark/Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              name="narration"
              value={form.narration}
              onChange={handleFormChange}
              disabled={loading}
              placeholder="Enter narration/remark/notes about this deposit"
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] outline-none transition-all resize-none ${
                errors.narration ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.narration && (
              <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                <AlertCircle className="w-4 h-4" />
                {errors.narration}
              </div>
            )}
          </div>
        </div>
        {/* {JSON.stringify(customerInvoices)} */}
        {/* Previous Invoices */}
        {selectedCustomer[0] && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Previous Invoices
            </h3>

            {loadingInvoices ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Invoice No.
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Due Date
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Amount
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Balance Due
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 min-w-[150px]">
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-3 w-16" />
                        </td>
                        <td className="py-3 px-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Skeleton className="h-4 w-20 ml-auto" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Skeleton className="h-4 w-20 ml-auto" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Skeleton className="h-10 w-32 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : customerInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Invoice No.
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Due Date
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Amount
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Balance Due
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 min-w-[150px]">
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInvoices.map((item, idx) => {
                      const invoiceId =
                        item.id || item.invoice_id || item.invoice_ref;
                      const outstandingBalance = parseFloat(
                        item.amount_due || item.balance_due || 0
                      );
                      const maxAmount = outstandingBalance;
                      const currentPayment = invoicePayments[invoiceId] || "";
                      const originalAmount = parseFloat(
                        item.amount || item.total_amount || item.total || 0
                      );
                      const totalPaid = parseFloat(item.total_paid || 0);
                      // Parse formatted payment value
                      const parsedPayment = parseNumberFromFormatted(
                        String(currentPayment)
                      );
                      const paymentAmount = parseFloat(parsedPayment) || 0;
                      const remainingAfterPayment =
                        outstandingBalance - paymentAmount;

                      return (
                        <tr
                          key={idx}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">
                            <button
                              onClick={() =>
                                handleInvoiceRefClick(item.invoice_ref)
                              }
                              className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:underline font-medium"
                            >
                              {item.invoice_ref || "N/A"}
                            </button>
                            {item.transaction_date && (
                              <div className="text-xs text-gray-500 mt-1">
                                {moment(item.transaction_date).format(
                                  "DD-MM-yyyy"
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {item.due_date
                              ? moment(item.due_date).format("MMM DD, YYYY")
                              : "N/A"}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">
                            ₦ {formatNumber(originalAmount)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="font-semibold text-red-600">
                              ₦ {formatNumber(outstandingBalance)}
                            </div>
                            {totalPaid > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Paid: ₦ {formatNumber(totalPaid)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-end gap-1">
                              <PaymentInput
                                invoiceId={invoiceId}
                                maxAmount={maxAmount}
                                currentPayment={currentPayment}
                                onPaymentChange={(id, val) =>
                                  handleInvoicePaymentChange(id, val, maxAmount)
                                }
                              />
                              {paymentAmount > 0 && (
                                <div className="text-xs text-gray-500">
                                  Remaining: ₦{" "}
                                  {formatNumber(remainingAfterPayment)}
                                </div>
                              )}
                              {totalPaymentAmount >= totalOutstandingBalance &&
                                totalPaymentAmount > 0 && (
                                  <div className="text-xs text-red-600 font-semibold">
                                    Max reached
                                  </div>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals Row */}
                    <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                      <td
                        colSpan={3}
                        className="py-3 px-4 text-right text-gray-700"
                      >
                        Total Outstanding:
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 font-bold">
                        ₦ {formatNumber(totalOutstandingBalance)}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-600 font-bold">
                        ₦ {formatNumber(totalPaymentAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No previous invoices found for this customer</p>
              </div>
            )}
          </div>
        )}

        {/* Deposit Summary */}
        {selectedCustomer[0] && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">
              Deposit Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-blue-700 mb-1">Customer:</div>
                <div className="font-semibold text-gray-900">
                  {selectedCustomer[0].fullname}
                </div>
              </div>
              <div>
                <div className="text-sm text-blue-700 mb-1">
                  Current Balance:
                </div>
                <div className="font-semibold text-gray-900">
                  ₦ {formatNumber(selectedCustomer[0].balance || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-blue-700 mb-1">
                  Total Outstanding:
                </div>
                <div className="font-semibold text-red-600">
                  ₦ {formatNumber(totalOutstandingBalance)}
                </div>
              </div>
              <div>
                <div className="text-sm text-blue-700 mb-1">
                  Amount to Deposit:
                </div>
                <div className="text-2xl font-bold text-blue-700">
                  ₦ {formatNumber(amountToDepositDisplay)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            onClick={() => navigate("/app/reports/transaction")}
            disabled={loading}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={loading}
            className="px-6 py-2.5 bg-[var(--aa-navy)] text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed relative"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Deposit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Customer Entries Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[var(--aa-navy)] text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    Customer Entries - {selectedInvoiceRef}
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
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 border-b border-gray-200 pb-4"
                    >
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex gap-4">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : customerEntries.length > 0 ? (
                <CustomTable1
                  data={customerEntries}
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
                        return date
                          ? moment(date).format("MMM DD, YYYY HH:mm")
                          : "N/A";
                      },
                    },
                  ]}
                  pageSize={10}
                  message="No entries found for this invoice"
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>
                    No entries found for invoice reference: {selectedInvoiceRef}
                  </p>
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

export default CustomerDepositForm;
