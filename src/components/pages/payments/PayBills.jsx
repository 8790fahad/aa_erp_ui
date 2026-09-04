import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import moment from "moment";
import {
  ChevronDown,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Typeahead } from "react-bootstrap-typeahead";
import { formatNumber1 } from "@/components/router/utilities";
import { formatExpensePaymentMode } from "@/utils/expensePaymentMode";
import {
  POSTING_DATE_MIN,
  getPostingDateMax,
  validatePostingDateClient,
} from "@/utilities";
import { useNavigate, useSearchParams } from "react-router-dom";

// Date preset options for dropdown; value is used in URL
const DATE_PRESETS = [
  { value: "", label: "All dates" },
  { value: "this_month", label: "This month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom" },
];

function getDateRangeFromPreset(preset, customFrom, customTo) {
  if (!preset) return null;
  if (preset === "custom" && customFrom && customTo) {
    return {
      from: moment(customFrom).format("YYYY-MM-DD"),
      to: moment(customTo).format("YYYY-MM-DD"),
      preset: "custom",
    };
  }
  const today = moment();
  let from, to;
  switch (preset) {
    case "this_month":
      from = today.clone().startOf("month").format("YYYY-MM-DD");
      to = today.format("YYYY-MM-DD");
      break;
    case "last_3_months":
      from = today.clone().subtract(3, "months").format("YYYY-MM-DD");
      to = today.format("YYYY-MM-DD");
      break;
    case "last_6_months":
      from = today.clone().subtract(6, "months").format("YYYY-MM-DD");
      to = today.format("YYYY-MM-DD");
      break;
    case "last_12_months":
      from = today.clone().subtract(12, "months").format("YYYY-MM-DD");
      to = today.format("YYYY-MM-DD");
      break;
    case "last_year":
      from = today.clone().subtract(1, "year").startOf("year").format("YYYY-MM-DD");
      to = today.clone().subtract(1, "year").endOf("year").format("YYYY-MM-DD");
      break;
    default:
      return null;
  }
  return { from, to, preset };
}

export default function PayBills() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [searchParams, setSearchParams] = useSearchParams();

  const [filteredBills, setFilteredBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState({}); // { billId: { payment: 0 } }
  const [paidInvoices, setPaidInvoices] = useState(new Set()); // Track invoices that have been paid
  const [pageIndex, setPageIndex] = useState(0); // zero-based for UI
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFilter, setDateFilter] = useState(null); // { from, to, preset? }
  const [datePresetValue, setDatePresetValue] = useState(""); // for dropdown: "", this_month, last_12_months, custom, etc.
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" = all (Unpaid + Partially Paid), "Unpaid", "Partially Paid"
  const [searchInvoiceRef, setSearchInvoiceRef] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [narration, setNarration] = useState("");

  // Payment method states (from OperatingCashExpense.jsx pattern)
  const [modeOfPayment, setModeOfPayment] = useState("");
  const [bankAccount, setBankAccount] = useState(null);
  const [accountHead, setAccountHead] = useState({});
  const [accountList, setAccountList] = useState([]);
  const [headList, setHeadList] = useState([]);
  const [paymentDate, setPaymentDate] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const cashAccountTypeaheadRef = useRef();
  // Guard flag to prevent duplicate payment submissions
  const isProcessingRef = useRef(false);

  // Advance application state
  const [applyingAdvance, setApplyingAdvance] = useState(null); // invoice_ref being processed

  // Fetch unpaid bills/invoices (server-side search, pagination, date & status filter)
  const fetchBills = useCallback(
    ({ search = "", page = 1, limit = 10, fromDate, toDate, status } = {}) => {
      if (!activeBusiness?.id) return;
      setLoading(true);

      const params = new URLSearchParams({
        facilityId: activeBusiness.id,
        page: String(page),
        limit: String(limit),
        onlyUnpaid: "1", // pay-bills page: backend returns only Unpaid/Partially Paid
      });

      if (search && search.trim()) {
        params.append("search", search.trim());
      }
      if (fromDate) {
        params.append("fromDate", fromDate);
      }
      if (toDate) {
        params.append("toDate", toDate);
      }
      if (status && (status === "Unpaid" || status === "Partially Paid")) {
        params.append("status", status);
      }

      const url = `/api/supplier/bills?${params.toString()}`;

      _fetchApi(
        url,
        (data) => {
          setLoading(false);
          if (data.success && data.data) {
            const billsWithBalance = data.data.map((bill) => ({
              ...bill,
              balance_due:
                parseFloat(bill.amount_due || 0) ||
                parseFloat(bill.amount || 0) - parseFloat(bill.total_paid || 0),
            }));

            // Advances are applied only via explicit user action (Apply Deposit)
            setFilteredBills(billsWithBalance);

            if (data.pagination) {
              const backendPage = Number(data.pagination.page) || 1;
              const backendTotalPages = Number(data.pagination.totalPages) || 1;
              const backendLimit = Number(data.pagination.limit) || limit;

              setPageIndex(backendPage - 1);
              setPageSize(backendLimit);
              setTotalPages(Math.max(1, backendTotalPages));
            } else {
              const total = billsWithBalance.length;
              setTotalPages(Math.max(1, Math.ceil(total / limit)));
            }
          } else {
            setFilteredBills([]);
            setTotalPages(1);
          }
        },
        (err) => {
          setLoading(false);
          console.error("Error fetching bills:", err);
          toast.error("Failed to fetch bills");
        }
      );
    },
    [activeBusiness?.id]
  );

  // Payment method logic (from OperatingCashExpense.jsx)
  useEffect(() => {
    // Clear bank account and account head when payment mode changes
    setBankAccount(null);
    setAccountHead({});
    setAccountList([]);
    setHeadList([]);

    if (modeOfPayment === "cash") {
      _postApi(
        `/inventory/product-list?query_type=${modeOfPayment}`,
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
    } else if (modeOfPayment === "cheque" || modeOfPayment === "bank") {
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
  }, [modeOfPayment, activeBusiness?.id]);

  // Load state from URL on mount (all state comes from URL query params)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!activeBusiness?.id) return; // wait for auth/business so fetchBills can run
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const urlSearch = searchParams.get("search") ?? "";
    const urlDatePreset = searchParams.get("datePreset") ?? "";
    const urlFrom = searchParams.get("fromDate") ?? "";
    const urlTo = searchParams.get("toDate") ?? "";
    const urlStatus = searchParams.get("status") ?? "";
    const urlPage = searchParams.get("page");
    const urlLimit = searchParams.get("limit");
    const urlMode = searchParams.get("mode") ?? "";
    const urlPaymentDate = searchParams.get("paymentDate") ?? "";
    const urlChequeNumber = searchParams.get("chequeNumber") ?? "";
    const urlNarration = searchParams.get("narration") ?? "";
    const urlAccountHead = searchParams.get("accountHead") ?? "";

    // Load search/filter/pagination from URL
    if (urlSearch !== "") setSearchInvoiceRef(urlSearch);
    if (urlStatus && ["Unpaid", "Partially Paid"].includes(urlStatus))
      setStatusFilter(urlStatus);
    if (urlDatePreset !== "") {
      setDatePresetValue(urlDatePreset);
      if (urlDatePreset === "custom" && urlFrom && urlTo) {
        setCustomFromDate(urlFrom);
        setCustomToDate(urlTo);
        setDateFilter({ from: urlFrom, to: urlTo, preset: "custom" });
      } else {
        const range = getDateRangeFromPreset(urlDatePreset, null, null);
        if (range) setDateFilter(range);
      }
    }
    const pageNum = Math.max(1, parseInt(urlPage, 10) || 1);
    const limitNum = Math.max(1, parseInt(urlLimit, 10) || 10);
    setPageIndex(pageNum - 1);
    setPageSize(limitNum);

    // Load form fields from URL
    if (urlMode) setModeOfPayment(urlMode);
    if (urlPaymentDate) setPaymentDate(urlPaymentDate);
    if (urlChequeNumber) setChequeNumber(urlChequeNumber);
    if (urlNarration) setNarration(urlNarration);
    if (urlAccountHead) setAccountHead({ head: urlAccountHead });
    // bankAccountId will be resolved after accountList loads (see effect below)

    fetchBills({
      search: urlSearch,
      page: pageNum,
      limit: limitNum,
      status: ["Unpaid", "Partially Paid"].includes(urlStatus) ? urlStatus : undefined,
      fromDate:
        urlDatePreset === "custom"
          ? urlFrom
          : getDateRangeFromPreset(urlDatePreset)?.from,
      toDate:
        urlDatePreset === "custom"
          ? urlTo
          : getDateRangeFromPreset(urlDatePreset)?.to,
    });
  }, [activeBusiness?.id, fetchBills, pageSize, searchParams]);

  // Resolve bankAccount from URL bankAccountId once accountList is loaded
  const urlBankAccountId = searchParams.get("bankAccountId") ?? "";
  useEffect(() => {
    if (
      !urlBankAccountId ||
      !["bank", "cheque"].includes(modeOfPayment) ||
      !accountList?.length
    )
      return;
    const id = parseInt(urlBankAccountId, 10) || urlBankAccountId;
    const acc = accountList.find((a) => a.id === id || a.id === parseInt(id, 10));
    if (acc) setBankAccount(acc);
  }, [modeOfPayment, accountList, urlBankAccountId]);

  // Resolve accountHead.description from URL accountHead once headList is loaded (cash mode)
  const urlAccountHead = searchParams.get("accountHead") ?? "";
  useEffect(() => {
    if (!urlAccountHead || modeOfPayment !== "cash" || !headList?.length) return;
    const head = headList.find(
      (h) => h.head === urlAccountHead || h.code === urlAccountHead
    );
    if (head) setAccountHead({ head: head.head, description: head.description });
  }, [modeOfPayment, headList, urlAccountHead]);

  // Sync search, date filter, status filter, pagination, and form state to URL so link can be shared/refreshed
  const updateUrlFromState = useCallback(
    (overrides = {}) => {
      const search = overrides.search !== undefined ? overrides.search : searchInvoiceRef.trim();
      const preset = overrides.datePresetValue !== undefined ? overrides.datePresetValue : datePresetValue;
      const from = overrides.customFromDate !== undefined ? overrides.customFromDate : customFromDate;
      const to = overrides.customToDate !== undefined ? overrides.customToDate : customToDate;
      const status = overrides.statusFilter !== undefined ? overrides.statusFilter : statusFilter;
      const page = overrides.pageIndex !== undefined ? overrides.pageIndex + 1 : pageIndex + 1;
      const limit = overrides.pageSize !== undefined ? overrides.pageSize : pageSize;
      const mode = overrides.modeOfPayment !== undefined ? overrides.modeOfPayment : modeOfPayment;
      const paymentDateVal = overrides.paymentDate !== undefined ? overrides.paymentDate : paymentDate;
      const chequeNum = overrides.chequeNumber !== undefined ? overrides.chequeNumber : chequeNumber;
      const narr = overrides.narration !== undefined ? overrides.narration : narration;
      const bankAcc = overrides.bankAccount !== undefined ? overrides.bankAccount : bankAccount;
      const accHead = overrides.accountHead !== undefined ? overrides.accountHead : accountHead;

      const params = {};
      if (search) params.search = search;
      if (preset) params.datePreset = preset;
      if (preset === "custom" && from) params.fromDate = from;
      if (preset === "custom" && to) params.toDate = to;
      if (status) params.status = status;
      params.page = String(page);
      params.limit = String(limit);
      if (mode) params.mode = mode;
      if (paymentDateVal) params.paymentDate = paymentDateVal;
      if (chequeNum) params.chequeNumber = chequeNum;
      if (narr) params.narration = narr;
      if (bankAcc?.id) params.bankAccountId = String(bankAcc.id);
      if (accHead?.head) params.accountHead = accHead.head;
      setSearchParams(params, { replace: true });
    },
    [
      searchInvoiceRef,
      datePresetValue,
      customFromDate,
      customToDate,
      statusFilter,
      pageIndex,
      pageSize,
      modeOfPayment,
      paymentDate,
      chequeNumber,
      narration,
      bankAccount,
      accountHead,
      setSearchParams,
    ]
  );

  // Sync state to URL whenever it changes (replaces localStorage persistence)
  useEffect(() => {
    if (!initialLoadDone.current) return; // avoid overwriting URL before initial load completes
    updateUrlFromState();
  }, [
    searchInvoiceRef,
    dateFilter,
    datePresetValue,
    customFromDate,
    customToDate,
    statusFilter,
    pageIndex,
    pageSize,
    modeOfPayment,
    bankAccount,
    accountHead,
    paymentDate,
    chequeNumber,
    narration,
    updateUrlFromState,
  ]);

  // Handle search button click
  const handleSearch = () => {
    const search = searchInvoiceRef.trim();
    const newPageIndex = 0;
    setPageIndex(newPageIndex);
    updateUrlFromState({ search, pageIndex: newPageIndex });
    fetchBills({
      search,
      page: newPageIndex + 1,
      limit: pageSize,
      status: statusFilter || undefined,
      fromDate: dateFilter?.from,
      toDate: dateFilter?.to,
    });
  };

  // Handle Enter key in search input
  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Use filteredBills directly since filtering is done server-side
  const filteredData = useMemo(() => {
    return filteredBills;
  }, [filteredBills]);

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

  // Calculate totals
  const totalPayment = useMemo(() => {
    return Object.values(payments).reduce((sum, payment) => {
      const parsedValue = payment.payment
        ? parseFloat(parseNumberFromFormatted(String(payment.payment))) || 0
        : 0;
      return sum + parsedValue;
    }, 0);
  }, [payments]);

  const totalOpenBalance = useMemo(() => {
    return filteredData.reduce((sum, bill) => {
      return sum + parseFloat(bill.balance_due || bill.amount || 0);
    }, 0);
  }, [filteredData]);

  // Handle payment input changes with validation
  const handlePaymentChange = (
    billId,
    invoiceRef,
    field,
    value,
    balanceDue
  ) => {
    // Prevent payment if invoice has already been paid
    if (paidInvoices.has(invoiceRef)) {
      toast.error("This invoice has already been paid");
      return;
    }

    // Format the value with commas for display
    const formattedValue = formatNumberWithCommas(value);

    // Parse the formatted value to get the numeric amount
    const parsedValue = parseNumberFromFormatted(formattedValue);
    const paymentAmount = parseFloat(parsedValue) || 0;
    const maxAllowed = balanceDue || 0;

    // If payment exceeds remaining balance, set it to the remaining balance (max allowed)
    let finalAmount = paymentAmount;
    let finalFormattedValue = formattedValue;

    if (paymentAmount > maxAllowed) {
      finalAmount = maxAllowed;
      finalFormattedValue = formatNumberWithCommas(String(maxAllowed));
    }

    // If user starts entering an amount, clear all other invoices
    if (finalAmount > 0) {
      setPayments({
        [billId]: {
          [field]: finalFormattedValue, // Store formatted value for display
          selected: true,
        },
      });
    } else {
      // If amount is cleared, just update this invoice
      setPayments((prev) => ({
        ...prev,
        [billId]: {
          ...prev[billId],
          [field]: finalFormattedValue, // Store formatted value for display
          selected: false,
        },
      }));
    }
  };

  // Handle checkbox toggle
  const handleCheckboxChange = (billId, invoiceRef, checked) => {
    // Prevent checking if invoice has already been paid
    if (checked && paidInvoices.has(invoiceRef)) {
      toast.error("This invoice has already been paid");
      return;
    }

    // If checking a checkbox, clear all other invoices and only select this one
    if (checked) {
      setPayments({
        [billId]: {
          selected: true,
          payment: 0,
        },
      });
    } else {
      // If unchecking, just clear this invoice
      setPayments((prev) => ({
        ...prev,
        [billId]: {
          ...prev[billId],
          selected: false,
          payment: 0,
        },
      }));
    }
  };

  // Get selected bills with payments
  const getSelectedBillsWithPayments = useMemo(() => {
    return filteredBills
      .filter((bill) => {
        const payment = payments[bill.invoice_id];
        if (!payment || !payment.selected) return false;
        // Parse the formatted payment value to check if > 0
        const parsedPayment = payment.payment
          ? parseFloat(parseNumberFromFormatted(String(payment.payment))) || 0
          : 0;
        return parsedPayment > 0;
      })
      .map((bill) => {
        const payment = payments[bill.invoice_id];
        // Parse the formatted payment value for calculations
        const parsedPayment = payment?.payment
          ? parseFloat(parseNumberFromFormatted(String(payment.payment))) || 0
          : 0;
        return {
          ...bill,
          paymentAmount: parsedPayment, // Store parsed value for API
          remaining: (bill.balance_due || bill.amount || 0) - parsedPayment,
        };
      });
  }, [filteredBills, payments]);

  // Handle payment preview
  const handlePreviewPayment = () => {
    // if (!narration || !narration.trim()) {
    //   toast.error("Please enter a payment narration/description");
    //   return;
    // }
    if (getSelectedBillsWithPayments.length === 0) {
      toast.error("Please enter payment amounts for at least one bill");
      return;
    }
    if (!modeOfPayment) {
      toast.error("Please select a mode of payment");
      return;
    }
    if (!paymentDate || !paymentDate.trim()) {
      toast.error("Please select a payment date");
      return;
    }
    if (["bank", "cheque"].includes(modeOfPayment) && !bankAccount?.id) {
      toast.error("Please select a bank account");
      return;
    }
    if (modeOfPayment === "cash" && !accountHead?.head) {
      toast.error("Please select an account head for cash payment");
      return;
    }
    if (modeOfPayment === "cheque" && !chequeNumber) {
      toast.error("Please enter a cheque number");
      return;
    }
    // Require narration before preview

    setShowPreview(true);
  };

  // Handle final payment submission
  const handleSubmitPayment = () => {
    // Hard guard: if a payment is already being processed, ignore further clicks
    if (isProcessingRef.current || processingPayment) {
      return;
    }

    if (!narration || !narration.trim()) {
      toast.error("Please enter a payment narration/description");
      return;
    }
    if (!activeBusiness?.id) {
      toast.error("Business ID is required");
      return;
    }

    // Validate payment date is required
    if (!paymentDate || !paymentDate.trim()) {
      toast.error("Payment date is required");
      return;
    }

    const paymentDateErr = validatePostingDateClient(paymentDate, {
      field: "Payment date",
    });
    if (paymentDateErr) {
      toast.error(paymentDateErr);
      return;
    }

    // Validate payment source based on mode
    if (modeOfPayment === "cash") {
      if (!accountHead?.head) {
        toast.error("Account Head is required for cash payments");
        return;
      }
    } else if (["bank", "cheque"].includes(modeOfPayment)) {
      if (!bankAccount?.id) {
        toast.error("Bank Account is required for bank/cheque payments");
        return;
      }
    }

    // Validate cheque number for cheque payments
    if (modeOfPayment === "cheque" && !chequeNumber) {
      toast.error("Cheque Number is required for cheque payments");
      return;
    }

    // Mark as processing immediately so repeated clicks are ignored
    isProcessingRef.current = true;
    setProcessingPayment(true);

    // Prepare bills array for API
    const billsToPay = getSelectedBillsWithPayments.map((bill) => ({
      invoice_ref: bill.invoice_ref || bill.ref_number,
      amount_to_pay: bill.paymentAmount,
    }));

    // Prepare payload
    const payload = {
      facilityId: activeBusiness.id,
      payment_date: paymentDate,
      mode_of_payment: modeOfPayment,
      remark: narration.trim(),
      narration: narration.trim(),
      bills: billsToPay,
      user_id: user?.id,
    };

    // Add payment source based on mode
    if (["bank", "cheque"].includes(modeOfPayment) && bankAccount?.id) {
      payload.bankAccount = { id: bankAccount.id };
    }

    if (modeOfPayment === "cash" && accountHead?.head) {
      payload.accountHead = { head: accountHead.head };
    }

    if (modeOfPayment === "cheque") {
      payload.cheque_number = chequeNumber;
    }

    _postApi(
      `/api/supplier/pay-bills`,
      payload,
      (response) => {
        setProcessingPayment(false);
        isProcessingRef.current = false;
        if (response.success) {
          toast.success(
            `Payment processed successfully. Ref: ${response.data?.payment_ref}`
          );
          setShowPreview(false);

          // Reset form
          setModeOfPayment("");
          setBankAccount(null);
          setAccountHead({});
          setPaymentDate("");
          setChequeNumber("");
          setNarration("");
          setPayments({});
          // Clear form params from URL
          updateUrlFromState({
            modeOfPayment: "",
            paymentDate: "",
            chequeNumber: "",
            narration: "",
            bankAccount: null,
            accountHead: {},
          });

          // Mark paid invoices as paid
          const paidInvoiceRefs = getSelectedBillsWithPayments.map(
            (bill) => bill.invoice_ref || bill.ref_number
          );
          setPaidInvoices((prev) => {
            const newSet = new Set(prev);
            paidInvoiceRefs.forEach((ref) => newSet.add(ref));
            return newSet;
          });

          // Refresh bills
          fetchBills({
            search: searchInvoiceRef.trim(),
            page: 1,
            limit: pageSize,
            status: statusFilter || undefined,
            fromDate: dateFilter?.from,
            toDate: dateFilter?.to,
          });

          // Navigate to receipt page
          const paymentRef = response.data?.bills;
          console.log(response.data)
          if (paymentRef) {
            navigate(
              `/app/purchase/supplier-payment-receipt?ref_number=${paymentRef[0].invoice_ref}&pv_code=${response.data.pv_code}`
            );
          }
        } else {
          toast.error(
            response.error || response.message || "Failed to process payment",
          );
        }
      },
      (error) => {
        setProcessingPayment(false);
        isProcessingRef.current = false;
        console.error("Payment error:", error);
        toast.error(
          error?.error ||
            error?.message ||
            "An error occurred while processing payment",
        );
      }
    );
  };

  // Since pagination is handled on the server, use the data as-is
  const paginatedData = filteredData;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getStatusBadge = (dueDate) => {
    if (!dueDate) return null;
    const due = moment(dueDate);
    const today = moment();
    const diffDays = due.diff(today, "days");

    if (diffDays === 0) {
      return (
        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          Due today
        </Badge>
      );
    } else if (diffDays < 0) {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Overdue
        </Badge>
      );
    } else if (diffDays <= 7) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Due soon
        </Badge>
      );
    }
    return null;
  };

  const getPaymentStatusBadge = (status) => {
    if (!status) return null;

    // Normalize status: handle both "Partially Paid" and "partially_paid" formats
    const statusNormalized = status.toLowerCase().replace(/\s+/g, "_");

    if (statusNormalized === "paid") {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Paid
        </Badge>
      );
    } else if (
      statusNormalized === "partially_paid" ||
      statusNormalized === "partiallypaid"
    ) {
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Partially Paid
        </Badge>
      );
    } else if (statusNormalized === "unpaid") {
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          Unpaid
        </Badge>
      );
    }

    return (
      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
        {status}
      </Badge>
    );
  };
  const navigate = useNavigate();
  const handleApplyAdvance = (invoiceRef) => {
    if (applyingAdvance) return;
    setApplyingAdvance(invoiceRef);
    _postApi(
      "/account/apply-advance-to-bill",
      { invoice_ref: invoiceRef, facilityId: activeBusiness.id },
      (res) => {
        setApplyingAdvance(null);
        if (res.success) {
          toast.success(res.message || `Advance applied to ${invoiceRef}`);
          // Refresh the bills list
          fetchBills({ page: pageIndex + 1, limit: pageSize });
        } else {
          toast.error(res.message || "Failed to apply advance");
        }
      },
      (err) => {
        setApplyingAdvance(null);
        console.error(err);
        toast.error("Error applying advance to bill");
      }
    );
  };

  // Table fields (arranged as: TRANSACTION DATE, REF NO., PAYEE, STATUS, INVOICE AMOUNT, AMOUNT PAID, BALANCE DUE)
  const fields = [
    {
      title: "",
      custom: true,
      className: "w-12",
      component: (item) => {
        const isSelected = payments[item.invoice_id]?.selected || false;
        const invoiceRef = item.invoice_ref || item.ref_number;
        const isPaid = paidInvoices.has(invoiceRef);
        const statusNormalized = (item.status || "")
          .toLowerCase()
          .replace(/\s+/g, "_");
        const isDisabled = isPaid || statusNormalized === "paid";

        return (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (!isDisabled) {
                  handleCheckboxChange(
                    item.invoice_id,
                    invoiceRef,
                    !isSelected
                  );
                }
              }}
              disabled={isDisabled}
              className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                isDisabled
                  ? "bg-gray-200 border-gray-300 cursor-not-allowed opacity-50"
                  : isSelected
                  ? "bg-[var(--aa-navy)] border-[var(--aa-navy)]"
                  : "border-gray-300 hover:border-blue-400"
              }`}
              title={isDisabled ? "This invoice has already been paid" : ""}
            >
              {isSelected && !isDisabled && (
                <Check className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        );
      },
    },
    {
      title: "TRANSACTION DATE",
      custom: true,
      component: (item) => (
        <span>
          {item.transaction_date
            ? moment(item.transaction_date).format("DD/MM/YYYY")
            : "N/A"}
        </span>
      ),
    },
    {
      title: "REF NO.",
      custom: true,
      component: (item) => (
        <div
          className="text-blue-600 font-medium text-center"
          style={{ cursor: "pointer" }}
          onClick={() =>
            navigate(
              `/app/expenses/billing/operating-expense-bill-pdf?invoice_ref=${
                item.invoice_ref || item.ref_number
              }`
            )
          }
        >
          {item.invoice_ref || item.ref_number || "-"}
        </div>
      ),
    },
    {
      title: "PAYEE",
      custom: true,
      component: (item) => (
        <span className="font-medium whitespace-normal">
          {item.supplier_name && item.supplier_name !== "Unknown Supplier"
            ? item.supplier_name
            : item.ref_number
            ? `Unknown Supplier (${item.ref_number})`
            : "Unknown Supplier"}
        </span>
      ),
    },
    {
      title: "MODE OF PAYMENT",
      custom: true,
      component: (item) => (
        <span className="whitespace-nowrap">
          {formatExpensePaymentMode(item.mode_of_payment)}
        </span>
      ),
    },
    {
      title: "STATUS",
      custom: true,
      component: (item) => {
        const paymentStatus = getPaymentStatusBadge(item.status);
        const dueDateStatus = getStatusBadge(item.due_date);

        return (
          <div className="flex flex-col gap-1">
            {paymentStatus}
            {dueDateStatus}
          </div>
        );
      },
    },
    {
      title: "INVOICE AMOUNT",
      custom: true,
      component: (item) => (
        <span className="font-semibold text-right">
          ₦{formatNumber1(item.amount || 0)}
        </span>
      ),
    },
    {
      title: "AMOUNT PAID",
      custom: true,
      component: (item) => {
        const payment = payments[item.invoice_id] || { payment: "" };
        const balanceDue = parseFloat(item.balance_due || item.amount || 0);
        const invoiceRef = item.invoice_ref || item.ref_number;
        const isPaid = paidInvoices.has(invoiceRef);
        const statusNormalized = (item.status || "")
          .toLowerCase()
          .replace(/\s+/g, "_");
        const isDisabled = isPaid || statusNormalized === "paid";

        return (
          <Input
            type="text"
            inputMode="decimal"
            value={payment.payment || ""}
            onChange={(e) =>
              handlePaymentChange(
                item.invoice_id,
                invoiceRef,
                "payment",
                e.target.value,
                balanceDue
              )
            }
            disabled={isDisabled}
            className={`w-full text-right text-base font-medium ${
              isDisabled ? "bg-gray-100 cursor-not-allowed opacity-50" : ""
            }`}
            placeholder="0.00"
            title={isDisabled ? "This invoice has already been paid" : ""}
          />
        );
      },
    },
    {
      title: "BALANCE DUE",
      custom: true,
      component: (item) => {
        const payment = payments[item.invoice_id] || { payment: "" };
        const parsedPayment = payment.payment
          ? parseFloat(parseNumberFromFormatted(String(payment.payment))) || 0
          : 0;
        const balanceDue = parseFloat(item.balance_due || item.amount || 0);
        const remaining = balanceDue - parsedPayment;
        const invoiceRef = item.invoice_ref || item.ref_number;
        const isApplying = applyingAdvance === invoiceRef;
        const hasAdvance = parseFloat(item.available_advance || 0) > 0;
        return (
          <div className="flex flex-col items-end gap-1">
            <span className="font-semibold">₦{formatNumber1(remaining)}</span>
            {remaining > 0 && hasAdvance && (
              <button
                type="button"
                onClick={() => handleApplyAdvance(invoiceRef)}
                disabled={!!applyingAdvance}
                className="text-xs px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title={`Supplier has ₦${formatNumber1(item.available_advance)} advance — click to apply`}
              >
                {isApplying ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
                ) : (
                  "Apply Advance"
                )}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-2">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Unpaid Bills</h1>
          <p className="text-muted-foreground">
            Manage and pay your outstanding bills
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/app/payments/pay-bills")}
          >
            Back to Pay Bills
          </Button>
          <Button
            size="sm"
            className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]"
            onClick={() => navigate("/app/payments/pay-bills/new")}
          >
            New Payment
          </Button>
        </div>
      </div>

      {/* Payment Details Panel */}
      <div className="bg-gray-100 rounded-lg p-2 mb-2">
        {/* Payment Fields Row */}
        <div
          className={`grid grid-cols-1 gap-4 mb-2 ${
            modeOfPayment === "cheque"
              ? "md:grid-cols-4"
              : modeOfPayment === "bank" || modeOfPayment === "cash"
              ? "md:grid-cols-3"
              : "md:grid-cols-3"
          }`}
        >
          {/* Mode of Payment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mode of Payment
            </label>
            <Select value={modeOfPayment} onValueChange={setModeOfPayment}>
              <SelectTrigger className="w-full h-10 bg-gray-200 border-0 text-gray-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400">
                <SelectValue placeholder="Mode of Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bank Account or Account Head */}
          {(modeOfPayment === "bank" ||
            modeOfPayment === "cash" ||
            modeOfPayment === "cheque") && (
            <div>
              {["bank", "cheque"].includes(modeOfPayment) ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Bank Account
                  </label>
                  <Select
                    value={bankAccount?.id?.toString() || ""}
                    onValueChange={(value) => {
                      const account = accountList.find(
                        (acc) => acc.id === Number(value)
                      );
                      if (account) {
                        setBankAccount(account);
                      } else {
                        setBankAccount(null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-10 bg-gray-200 border-0 text-gray-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400">
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accountList.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.id.toString()}
                        >
                          {account.account_name} ({account.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Account Head
                  </label>
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
                      } else {
                        setAccountHead({});
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
                        border: "none",
                        borderRadius: "0.375rem",
                        backgroundColor: "rgb(229 231 235)",
                        transition: "all 0.15s ease-in-out",
                      },
                    }}
                    positionFixed={true}
                  />
                </>
              )}
            </div>
          )}

          {/* Cheque Number (only shown when cheque is selected) */}
          {modeOfPayment === "cheque" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cheque Number
              </label>
              <Input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Enter cheque number..."
                className="w-full h-10 bg-gray-200 border-0 text-gray-900 focus:ring-2 focus:ring-gray-400"
              />
            </div>
          )}

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={paymentDate}
              min={POSTING_DATE_MIN}
              max={getPostingDateMax()}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className={`w-full h-10 bg-gray-200 text-gray-900 focus:ring-2 focus:ring-gray-400 ${
                !paymentDate || !paymentDate.trim()
                  ? "border-2 border-red-400 focus:border-red-500 focus:ring-red-500"
                  : "border-0"
              }`}
            />
          </div>
        </div>

        {/* Total Payment Amount and Payment Button */}
        <div className="flex justify-end items-center gap-6 pt-2 border-t border-gray-300">
          <div className="text-right">
            <div className="text-xs font-semibold text-amber-800 bg-amber-100 px-4 py-2 rounded mb-1 inline-block">
              TOTAL AMOUNT PAID
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(totalPayment)}
            </div>
          </div>
          <Button
            onClick={handlePreviewPayment}
            disabled={totalPayment === 0}
            className="h-12 px-8 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
            style={{
              backgroundColor: activeBusiness?.primary_color || "#1a2d5e",
            }}
          >
            Process Payment
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-3">
        <div className="flex justify-between items-center gap-4">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Search by supplier name or ref no."
              value={searchInvoiceRef}
              onChange={(e) => setSearchInvoiceRef(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="px-6"
              style={{
                backgroundColor: activeBusiness?.primary_color || "#1a2d5e",
                color: "white",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
            {searchInvoiceRef && (
              <Button
                onClick={() => {
                  setSearchInvoiceRef("");
                  setPageIndex(0);
                  updateUrlFromState({ search: "", pageIndex: 0 });
                  fetchBills({
                    page: 1,
                    limit: pageSize,
                    status: statusFilter || undefined,
                    fromDate: dateFilter?.from,
                    toDate: dateFilter?.to,
                  });
                }}
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="outline" size="sm">
              <ChevronDown className="w-4 h-4 mr-2" />
              Filters
            </Button>
            {/* Status filter: Unpaid, Partially Paid */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Status:</Label>
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) => {
                  const status = value === "all" ? "" : value;
                  setStatusFilter(status);
                  setPageIndex(0);
                  updateUrlFromState({ statusFilter: status, pageIndex: 0 });
                  fetchBills({
                    search: searchInvoiceRef.trim(),
                    page: 1,
                    limit: pageSize,
                    status: status || undefined,
                    fromDate: dateFilter?.from,
                    toDate: dateFilter?.to,
                  });
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                  <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Date filter dropdown: This month, Last 3/6/12 months, Last year, Custom */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Date:</Label>
              <Select
                value={datePresetValue || "all"}
                onValueChange={(value) => {
                  const preset = value === "all" ? "" : value;
                  setDatePresetValue(preset);
                  setPageIndex(0);
                  if (!preset) {
                    setDateFilter(null);
                    setCustomFromDate("");
                    setCustomToDate("");
                    updateUrlFromState({
                      datePresetValue: "",
                      customFromDate: "",
                      customToDate: "",
                      pageIndex: 0,
                    });
                    fetchBills({
                      search: searchInvoiceRef.trim(),
                      page: 1,
                      limit: pageSize,
                      status: statusFilter || undefined,
                    });
                  } else if (preset === "custom") {
                    updateUrlFromState({
                      datePresetValue: "custom",
                      pageIndex: 0,
                    });
                    if (customFromDate && customToDate) {
                      const range = getDateRangeFromPreset(
                        "custom",
                        customFromDate,
                        customToDate
                      );
                      if (range) {
                        setDateFilter(range);
                        fetchBills({
                          search: searchInvoiceRef.trim(),
                          page: 1,
                          limit: pageSize,
                          status: statusFilter || undefined,
                          fromDate: range.from,
                          toDate: range.to,
                        });
                      }
                    }
                  } else {
                    const range = getDateRangeFromPreset(preset, null, null);
                    if (range) {
                      setDateFilter(range);
                      updateUrlFromState({
                        datePresetValue: preset,
                        pageIndex: 0,
                      });
                      fetchBills({
                        search: searchInvoiceRef.trim(),
                        page: 1,
                        limit: pageSize,
                        status: statusFilter || undefined,
                        fromDate: range.from,
                        toDate: range.to,
                      });
                    }
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((opt) => (
                    <SelectItem
                      key={opt.value || "all"}
                      value={opt.value || "all"}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {datePresetValue === "custom" && (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-[140px] h-9"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-[140px] h-9"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (customFromDate && customToDate) {
                      const range = getDateRangeFromPreset(
                        "custom",
                        customFromDate,
                        customToDate
                      );
                      if (range) {
                        setDateFilter(range);
                        setPageIndex(0);
                        updateUrlFromState({
                          customFromDate,
                          customToDate,
                          pageIndex: 0,
                        });
                        fetchBills({
                          search: searchInvoiceRef.trim(),
                          page: 1,
                          limit: pageSize,
                          status: statusFilter || undefined,
                          fromDate: range.from,
                          toDate: range.to,
                        });
                      }
                    }
                  }}
                  style={{
                    backgroundColor: activeBusiness?.primary_color || "#1a2d5e",
                    color: "white",
                  }}
                >
                  Apply
                </Button>
              </div>
            )}
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bills Table (using BillSources.jsx table structure) */}
      <div className="mt-3">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {fields.map((field, idx) => {
                  const isRightAligned =
                    field.title === "INVOICE AMOUNT" ||
                    field.title === "AMOUNT PAID" ||
                    field.title === "BALANCE DUE";
                  const isCheckbox = field.title === "";
                  return (
                    <th
                      key={idx}
                      className={`px-4 py-3 ${
                        isRightAligned
                          ? "text-right"
                          : isCheckbox
                          ? "text-center"
                          : "text-left"
                      } ${isCheckbox ? "hidden" : ""} ${
                        field.className || ""
                      } text-xs font-bold text-gray-700 uppercase tracking-wider`}
                    >
                      {field.title}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-gray-50">
              {loading ? (
                // Skeleton loading rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {fields.map((_, fieldIdx) => (
                      <td key={fieldIdx} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={fields.length} className="px-4 py-8 text-center">
                    <p className="text-gray-500 text-lg">No bills found</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => {
                  const invoiceRef = item.invoice_ref || item.ref_number;
                  const statusNormalized = (item.status || "")
                    .toLowerCase()
                    .replace(/\s+/g, "_");
                  const isPaid =
                    paidInvoices.has(invoiceRef) || statusNormalized === "paid";

                  return (
                    <tr
                      key={item.invoice_id}
                      className={`border-b border-gray-200 ${
                        isPaid
                          ? "bg-gray-100 opacity-60 cursor-not-allowed"
                          : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      {fields.map((field, idx) => {
                        const isRightAligned =
                          field.title === "INVOICE AMOUNT" ||
                          field.title === "AMOUNT PAID" ||
                          field.title === "BALANCE DUE";
                        const isCheckbox = field.title === "";
                        return (
                          <td
                            key={idx}
                            className={`px-4 py-3 text-sm text-gray-900 ${
                              isRightAligned ? "text-right" : "text-left"
                            } ${isCheckbox ? "hidden" : ""}`}
                          >
                            {field.component
                              ? field.component(item)
                              : item[field.value]}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}

              {/* Total Payment Summary Row */}
              {!loading && filteredData.length > 0 && (
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-sm text-gray-900 text-center hidden"></td>
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-sm text-gray-900 text-right"
                  >
                    Total payment
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    ₦
                    {formatNumber1(
                      filteredData.reduce(
                        (sum, bill) => sum + parseFloat(bill.amount || 0),
                        0
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    ₦{formatNumber1(totalPayment)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    ₦{formatNumber1(totalOpenBalance - totalPayment)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination (using BillSources.jsx pagination style) */}
          {!loading && filteredData.length > 0 && (
            <div className="mt-3 flex items-center justify-end px-4 pb-4">
              <div className="flex w-full items-center gap-8 lg:w-fit">
                <div className="hidden items-center gap-2 lg:flex">
                  <Label
                    htmlFor="rows-per-page"
                    className="text-sm font-medium"
                  >
                    Rows per page
                  </Label>
                  <Select
                    value={`${pageSize}`}
                    onValueChange={(value) => {
                      const newSize = Number(value);
                      const newPageIndex = 0;
                      setPageSize(newSize);
                      setPageIndex(newPageIndex);
                      updateUrlFromState({ pageSize: newSize, pageIndex: newPageIndex });
                      fetchBills({
                        search: searchInvoiceRef.trim(),
                        page: newPageIndex + 1,
                        limit: newSize,
                        status: statusFilter || undefined,
                        fromDate: dateFilter?.from,
                        toDate: dateFilter?.to,
                      });
                    }}
                  >
                    <SelectTrigger className="w-20" id="rows-per-page">
                      <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 30, 40, 50, 100].map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                  Page {pageIndex + 1} of {totalPages || 1}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => {
                      const newPageIndex = 0;
                      setPageIndex(newPageIndex);
                      updateUrlFromState({ pageIndex: newPageIndex });
                      fetchBills({
                        search: searchInvoiceRef.trim(),
                        page: newPageIndex + 1,
                        limit: pageSize,
                        status: statusFilter || undefined,
                        fromDate: dateFilter?.from,
                        toDate: dateFilter?.to,
                      });
                    }}
                    disabled={pageIndex === 0}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      const newPageIndex = Math.max(0, pageIndex - 1);
                      setPageIndex(newPageIndex);
                      updateUrlFromState({ pageIndex: newPageIndex });
                      fetchBills({
                        search: searchInvoiceRef.trim(),
                        page: newPageIndex + 1,
                        limit: pageSize,
                        status: statusFilter || undefined,
                        fromDate: dateFilter?.from,
                        toDate: dateFilter?.to,
                      });
                    }}
                    disabled={pageIndex === 0}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      const newPageIndex = Math.min(
                        totalPages - 1,
                        pageIndex + 1
                      );
                      setPageIndex(newPageIndex);
                      updateUrlFromState({ pageIndex: newPageIndex });
                      fetchBills({
                        search: searchInvoiceRef.trim(),
                        page: newPageIndex + 1,
                        limit: pageSize,
                        status: statusFilter || undefined,
                        fromDate: dateFilter?.from,
                        toDate: dateFilter?.to,
                      });
                    }}
                    disabled={pageIndex >= totalPages - 1}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => {
                      const newPageIndex = Math.max(totalPages - 1, 0);
                      setPageIndex(newPageIndex);
                      updateUrlFromState({ pageIndex: newPageIndex });
                      fetchBills({
                        search: searchInvoiceRef.trim(),
                        page: newPageIndex + 1,
                        limit: pageSize,
                        status: statusFilter || undefined,
                        fromDate: dateFilter?.from,
                        toDate: dateFilter?.to,
                      });
                    }}
                    disabled={pageIndex >= totalPages - 1}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div
              className="text-white p-4"
              style={{
                background: `linear-gradient(135deg, ${
                  activeBusiness?.primary_color || "#1a2d5e"
                } 0%, ${activeBusiness?.primary_color || "#1a2d5e"}dd 100%)`,
              }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Payment Preview</h3>
                  <p className="text-white/90 text-sm mt-1">
                    Review the payment details before submitting
                  </p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                  disabled={processingPayment}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 flex-1 overflow-y-auto">
                <div className="space-y-6">
                  {/* Payment Details Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3">
                      Payment Details
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {getSelectedBillsWithPayments.length > 0 && (
                        <>
                          <div>
                            <span className="text-gray-600">Ref No.:</span>
                            <span className="ml-2 font-medium">
                              {getSelectedBillsWithPayments.length === 1
                                ? getSelectedBillsWithPayments[0].invoice_ref ||
                                  getSelectedBillsWithPayments[0].ref_number ||
                                  "-"
                                : getSelectedBillsWithPayments
                                    .map(
                                      (b) => b.invoice_ref || b.ref_number || "-"
                                    )
                                    .join(", ")}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Invoice Date:</span>
                            <span className="ml-2 font-medium">
                              {getSelectedBillsWithPayments.length === 1
                                ? getSelectedBillsWithPayments[0]
                                    .transaction_date
                                  ? moment(
                                      getSelectedBillsWithPayments[0]
                                        .transaction_date
                                    ).format("DD/MM/YYYY")
                                  : "-"
                                : (() => {
                                    const moments = getSelectedBillsWithPayments
                                      .filter((b) => b.transaction_date)
                                      .map((b) => moment(b.transaction_date));
                                    if (!moments.length) return "-";
                                    const sorted = [...moments].sort(
                                      (a, b) => a - b
                                    );
                                    const first = sorted[0].format(
                                      "MM/DD/YYYY"
                                    );
                                    const last = sorted[
                                      sorted.length - 1
                                    ].format("DD/MM/YYYY");
                                    return first === last ? first : `${first} - ${last}`;
                                  })()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Due Date:</span>
                            <span className="ml-2 font-medium">
                              {getSelectedBillsWithPayments.length === 1
                                ? getSelectedBillsWithPayments[0].due_date
                                  ? moment(
                                      getSelectedBillsWithPayments[0].due_date
                                    ).format("DD/MM/YYYY")
                                  : "-"
                                : (() => {
                                    const moments = getSelectedBillsWithPayments
                                      .filter((b) => b.due_date)
                                      .map((b) => moment(b.due_date));
                                    if (!moments.length) return "-";
                                    const sorted = [...moments].sort(
                                      (a, b) => a - b
                                    );
                                    const first = sorted[0].format(
                                      "MM/DD/YYYY"
                                    );
                                    const last = sorted[
                                      sorted.length - 1
                                    ].format("DD/MM/YYYY");
                                    return first === last ? first : `${first} - ${last}`;
                                  })()}
                            </span>
                          </div>
                        </>
                      )}
                      <div>
                        <span className="text-gray-600">Mode of Payment:</span>
                        <span className="ml-2 font-medium capitalize">
                          {modeOfPayment}
                        </span>
                      </div>
                      {/* {JSON.stringify(bankAccount)} */}
                      {["bank", "cheque"].includes(modeOfPayment) &&
                        bankAccount && (
                          <div>
                            <span className="text-gray-600">Bank Account:</span>
                            <span className="ml-2 font-medium">
                              {bankAccount.account_name} (
                              {bankAccount.account_code || ""})
                            </span>
                          </div>
                        )}
                      {modeOfPayment === "cash" && accountHead?.head && (
                        <div>
                          <span className="text-gray-600">Account Head:</span>
                          <span className="ml-2 font-medium">
                            {accountHead.head} {accountHead.description}
                          </span>
                        </div>
                      )}
                      {modeOfPayment === "cheque" && chequeNumber && (
                        <div>
                          <span className="text-gray-600">Cheque Number:</span>
                          <span className="ml-2 font-medium">
                            {chequeNumber}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600">Payment Date:</span>
                        <span className="ml-2 font-medium">
                          {moment(paymentDate).format("DD/MM/YYYY")}
                        </span>
                      </div>
                      <div className="ml-auto bg-amber-100 px-4 py-2 rounded">
                        <span className="text-gray-600">
                          Total Amount Paid:
                        </span>
                        <span
                          className="ml-2 font-bold text-xl"
                          style={{
                            color: activeBusiness?.primary_color || "#1a2d5e",
                          }}
                        >
                          {formatCurrency(totalPayment)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Narration/Description Field */}
                  <div className="bg-gray-50 rounded-lg p-1">
                    <h3 className="font-semibold text-lg mb-3">
                      Payment Narration
                    </h3>
                    <div>
                      <Label
                        htmlFor="narration"
                        className="text-sm font-medium text-gray-700 mb-2 block"
                      >
                        Description / Narration{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <textarea
                        id="narration"
                        name="narration"
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        placeholder="Enter payment description/narration..."
                        rows={3}
                        required
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent resize-none ${
                          !narration || !narration.trim()
                            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This description will be recorded in the transaction
                        ledger
                      </p>
                    </div>
                  </div>

                  {/* Bills to be Paid */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">
                      Bills to be Paid
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold">
                              Payee
                            </th>
                            <th className="px-4 py-2 text-left font-semibold">
                              Ref No.
                            </th>
                            <th className="px-4 py-2 text-left font-semibold">
                              Mode of payment
                            </th>
                            <th className="px-4 py-2 text-right font-semibold">
                              Invoice Amount
                            </th>
                            <th className="px-4 py-2 text-right font-semibold">
                              Amount Paid
                            </th>
                            <th className="px-4 py-2 text-right font-semibold">
                              Balance Due
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {getSelectedBillsWithPayments.map((bill) => (
                            <tr
                              key={bill.invoice_id}
                              className="hover:bg-gray-50"
                            >
                              <td className="px-4 py-3">
                                {bill.supplier_name &&
                                bill.supplier_name !== "Unknown Supplier"
                                  ? bill.supplier_name
                                  : bill.ref_number
                                  ? `Unknown Supplier (${bill.ref_number})`
                                  : "Unknown Supplier"}
                              </td>
                              <td className="px-4 py-3">
                                {bill.invoice_ref || bill.ref_number || "-"}
                              </td>
                              <td className="px-4 py-3">
                                {formatExpensePaymentMode(bill.mode_of_payment)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(bill.amount || 0)}
                              </td>
                              <td
                                className="px-4 py-3 text-right font-semibold"
                                style={{
                                  color:
                                    activeBusiness?.primary_color || "#1a2d5e",
                                }}
                              >
                                {formatCurrency(bill.paymentAmount)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(bill.remaining)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-semibold">
                          <tr>
                            <td colSpan="4" className="px-4 py-3 text-right">
                              Total:
                            </td>
                            <td
                              className="px-4 py-3 text-right"
                              style={{
                                color:
                                  activeBusiness?.primary_color || "#1a2d5e",
                              }}
                            >
                              {formatCurrency(totalPayment)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(
                                getSelectedBillsWithPayments.reduce(
                                  (sum, bill) => sum + bill.remaining,
                                  0
                                )
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                  disabled={processingPayment}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitPayment}
                  disabled={processingPayment}
                  className="px-4 py-2 text-sm text-white rounded hover:opacity-90 transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: activeBusiness?.primary_color || "#1a2d5e",
                  }}
                >
                  {processingPayment && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {processingPayment ? "Processing..." : "Confirm Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
