import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Split,
  Wallet,
} from "lucide-react";
import moment from "moment";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdvancePaymentAccounts, isCashInHandHead } from "@/components/common/useAdvancePaymentAccounts";
import { WorkflowStatusBadge } from "@/lib/saleWorkflowStatus.js";
import useScanDetection from "@/hooks/useScanDetection";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";

const cashPayThroughLabel = (option) =>
  `${option?.description || option?.head || ""} (${option?.head || ""})`.trim();

const bankPayThroughLabel = (option) => {
  const name = option?.account_name || option?.bank_name || option?.head || "";
  const num = option?.account_number || option?.head || "";
  return num ? `${name} (${num})` : String(name);
};

/** Select menu must sit above Sheet (z-50) */
const payThroughSelectContentClass = "z-[220] max-h-64";
const payThroughSelectTriggerClass =
  "h-10 w-full border-slate-300 bg-white text-sm focus:ring-[var(--aa-accent)]";

const METHOD_TABS = [
  { id: "cash", label: "Cash", icon: Banknote, privilege: "Cash Collection" },
  {
    id: "transfer",
    label: "Transfer",
    icon: Building2,
    privilege: "Transfer Collection",
  },
  {
    id: "discount",
    label: "Discount",
    icon: Percent,
    privilege: "Cash Collection",
  },
  {
    id: "credit",
    label: "Credit",
    icon: CreditCard,
    privilege: "Credit Collection",
  },
];

const COLLECTION_TAB_PRIVILEGES = METHOD_TABS.map((t) => t.privilege);

const LEGACY_COLLECTION_PRIVILEGES = [
  "Collection Points",
  "Receive Payment",
  "Payments",
  "Cashier",
];

function parseFunctionalities(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function isSplitPaymentType(type) {
  const t = String(type || "")
    .toLowerCase()
    .trim();
  return (
    t === "split" ||
    t === "both" ||
    t === "cash+transfer" ||
    t === "cash_transfer" ||
    t === "cash + transfer"
  );
}

function paymentTypeLabel(type) {
  const t = String(type || "").toLowerCase();
  if (isSplitPaymentType(t)) return "Cash + Transfer";
  if (t === "transfer" || t === "bank") return "Transfer";
  if (t === "cash") return "Cash";
  if (t === "credit") return "Credit";
  if (t === "customer_advance") return "Deposit";
  return type || "—";
}

function paymentTypeBadgeClass(type) {
  const t = String(type || "").toLowerCase();
  if (isSplitPaymentType(t))
    return "bg-violet-50 text-violet-700 ring-violet-200";
  if (t === "transfer" || t === "bank")
    return "bg-sky-50 text-sky-700 ring-sky-200";
  if (t === "credit") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

/** Cash + Transfer invoices appear on both Cash and Transfer tabs. */
function matchesMethod(paymentType, method) {
  const pt = String(paymentType || "").toLowerCase();
  if (method === "cash") return pt === "cash" || isSplitPaymentType(pt);
  if (method === "transfer")
    return pt === "transfer" || pt === "bank" || isSplitPaymentType(pt);
  if (method === "credit") return pt === "credit";
  return true;
}

/** Cash + Transfer: show on a tab while any balance remains to collect. */
function needsCollectionSide(row, method) {
  if (!isSplitPaymentType(row?.payment_type)) return true;
  const due = Number(row?.amount) || 0;
  const collected = Number(row?.split_progress?.collected_total) || 0;
  const remaining = Number((due - collected).toFixed(2));
  if (remaining <= 0.05) return false;
  // Both Cash and Transfer tabs show until the invoice is fully collected
  return method === "cash" || method === "transfer";
}

export default function ReceivePayment() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);

  const functionalities = useMemo(() => {
    return [
      ...new Set([
        ...parseFunctionalities(activeBusiness?.functionalities),
        ...parseFunctionalities(user?.functionalities),
      ]),
    ];
  }, [activeBusiness?.functionalities, user?.functionalities]);

  const cashierType = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    const isCashier =
      role.includes("cashier") || role.includes("casheir");
    const ct = String(user?.cashier_type || "").toLowerCase();
    if (isCashier && (ct === "cash" || ct === "transfer")) return ct;
    return "";
  }, [user?.role, user?.cashier_type]);

  const canViewCollectionTab = useCallback(
    (privilege) => {
      // Role-based cashier lock still wins
      if (cashierType === "cash") return privilege === "Cash Collection";
      if (cashierType === "transfer")
        return privilege === "Transfer Collection";

      // No privilege list configured → full access (admin / legacy)
      if (!functionalities.length) return true;

      if (functionalities.includes(privilege)) return true;

      const hasAnyTabPriv = COLLECTION_TAB_PRIVILEGES.some((p) =>
        functionalities.includes(p),
      );
      // Parent / legacy keys only (no Cash/Transfer/Credit yet) → all tabs
      if (!hasAnyTabPriv) {
        return LEGACY_COLLECTION_PRIVILEGES.some((p) =>
          functionalities.includes(p),
        );
      }
      return false;
    },
    [cashierType, functionalities],
  );

  const visibleMethodTabs = useMemo(
    () => METHOD_TABS.filter((t) => canViewCollectionTab(t.privilege)),
    [canViewCollectionTab],
  );

  const [methodTab, setMethodTab] = useState("cash");
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState([]);
  const [creditPending, setCreditPending] = useState([]);
  const [discountPending, setDiscountPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    pending_cash: 0,
    pending_transfer: 0,
    pending_split: 0,
    pending_credit: 0,
    pending_count: 0,
    pending_total: 0,
    collected_cash_today: 0,
    collected_transfer_today: 0,
    collected_today: 0,
  });
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);

  const [collectOpen, setCollectOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceCustomer, setAdvanceCustomer] = useState(null);
  const [advanceMode, setAdvanceMode] = useState("cash"); // cash | transfer | split
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceCashAmount, setAdvanceCashAmount] = useState("");
  const [advanceTransferAmount, setAdvanceTransferAmount] = useState("");
  const [advanceNarration, setAdvanceNarration] = useState("");
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);

  const amountDue = Number(selected?.amount) || 0;
  const paymentType = String(selected?.payment_type || "").toLowerCase();
  const isSplit = isSplitPaymentType(paymentType);
  // Split invoices: show only the active tab’s side (cash person vs transfer person)
  const collectionSide = isSplit
    ? methodTab === "transfer"
      ? "transfer"
      : "cash"
    : methodTab === "transfer"
      ? "transfer"
      : methodTab === "cash"
        ? "cash"
        : "";
  const showCashFields =
    paymentType === "cash" || (isSplit && collectionSide === "cash");
  const showTransferFields =
    paymentType === "transfer" ||
    paymentType === "bank" ||
    (isSplit && collectionSide === "transfer");
  const isCashOnly = paymentType === "cash" || (isSplit && collectionSide === "cash");
  const isTransferOnly =
    paymentType === "transfer" ||
    paymentType === "bank" ||
    (isSplit && collectionSide === "transfer");
  const splitProgress = selected?.split_progress || null;
  const remainingDue = isSplit
    ? Number(
        (
          amountDue -
          (Number(splitProgress?.collected_total) || 0)
        ).toFixed(2),
      )
    : amountDue;

  const cashAccounts = useAdvancePaymentAccounts(
    (collectOpen && showCashFields) ||
      (advanceOpen && (advanceMode === "cash" || advanceMode === "split")),
    activeBusiness?.id,
    "cash",
  );
  const bankAccounts = useAdvancePaymentAccounts(
    (collectOpen && showTransferFields) ||
      (advanceOpen &&
        (advanceMode === "transfer" || advanceMode === "split")),
    activeBusiness?.id,
    "bank",
  );

  useEffect(() => {
    const allowed = visibleMethodTabs.map((t) => t.id);
    if (!allowed.includes(methodTab)) {
      setMethodTab(allowed[0] || "cash");
    }
  }, [visibleMethodTabs, methodTab]);

  const fetchDashboard = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
    });
    // Fetch all methods so tab counts/lists are complete; UI filters by method tab
    _fetchApi(
      `/api/v1/sale-workflows/cashier-dashboard?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res?.success) {
          setPending(res.results?.pending || []);
          setCreditPending(res.results?.credit_pending || []);
          setDiscountPending(res.results?.discount_pending || []);
          setHistory(res.results?.history || []);
          setSummary(
            res.results?.summary || {
              pending_cash: 0,
              pending_transfer: 0,
              pending_split: 0,
              pending_credit: 0,
              pending_discount: 0,
              pending_count: 0,
              pending_total: 0,
              collected_cash_today: 0,
              collected_transfer_today: 0,
              collected_today: 0,
            },
          );
        } else {
          toast.error(res?.message || "Failed to load collection queue");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to load collection queue");
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Cash + Transfer: always start amounts at empty when opening collect
  useEffect(() => {
    if (!collectOpen || !selected) return;
    if (!isSplitPaymentType(selected.payment_type)) return;
    setCashAmount("");
    setTransferAmount("");
  }, [collectOpen, selected?.sale_code, selected?.payment_type]);

  useEffect(() => {
    if (!collectOpen && !advanceOpen) return;
    if (
      (showCashFields ||
        (advanceOpen &&
          (advanceMode === "cash" || advanceMode === "split"))) &&
      !cashAccounts.accountHead?.head &&
      cashAccounts.headList?.length
    ) {
      const preferred =
        cashAccounts.headList.find((h) => isCashInHandHead(h)) ||
        cashAccounts.headList[0];
      cashAccounts.setAccountHead(preferred);
    }
  }, [
    collectOpen,
    advanceOpen,
    advanceMode,
    showCashFields,
    cashAccounts.accountHead?.head,
    cashAccounts.headList,
    cashAccounts.setAccountHead,
  ]);

  useEffect(() => {
    if (!collectOpen && !advanceOpen) return;
    if (
      (showTransferFields ||
        (advanceOpen &&
          (advanceMode === "transfer" || advanceMode === "split"))) &&
      !bankAccounts.bankAccount?.id &&
      bankAccounts.accountList?.length
    ) {
      bankAccounts.setBankAccount(bankAccounts.accountList[0]);
    }
  }, [
    collectOpen,
    advanceOpen,
    advanceMode,
    showTransferFields,
    bankAccounts.bankAccount?.id,
    bankAccounts.accountList,
    bankAccounts.setBankAccount,
  ]);

  const viewSummary = useMemo(() => {
    const sumAmounts = (list) =>
      list.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const cashQueue = pending.filter(
      (r) =>
        matchesMethod(r.payment_type, "cash") && needsCollectionSide(r, "cash"),
    );
    const transferQueue = pending.filter(
      (r) =>
        matchesMethod(r.payment_type, "transfer") &&
        needsCollectionSide(r, "transfer"),
    );

    if (methodTab === "cash") {
      return {
        showCash: true,
        showTransfer: false,
        showSplit: false,
        showCredit: false,
        showDiscount: false,
        pending_cash: sumAmounts(cashQueue),
        pending_transfer: 0,
        pending_split: 0,
        pending_credit: 0,
        pending_discount: 0,
        collected_cash_today: summary.collected_cash_today,
        collected_transfer_today: 0,
        pending_count: cashQueue.length,
      };
    }
    if (methodTab === "transfer") {
      return {
        showCash: false,
        showTransfer: true,
        showSplit: false,
        showCredit: false,
        showDiscount: false,
        pending_cash: 0,
        pending_transfer: sumAmounts(transferQueue),
        pending_split: 0,
        pending_credit: 0,
        pending_discount: 0,
        collected_cash_today: 0,
        collected_transfer_today: summary.collected_transfer_today,
        pending_count: transferQueue.length,
      };
    }
    if (methodTab === "credit") {
      return {
        showCash: false,
        showTransfer: false,
        showSplit: false,
        showCredit: true,
        showDiscount: false,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: 0,
        pending_credit:
          Number(summary.pending_credit) || sumAmounts(creditPending),
        pending_discount: 0,
        collected_cash_today: 0,
        collected_transfer_today: 0,
        pending_count: creditPending.length,
      };
    }
    if (methodTab === "discount") {
      return {
        showCash: false,
        showTransfer: false,
        showSplit: false,
        showCredit: false,
        showDiscount: true,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: 0,
        pending_credit: 0,
        pending_discount:
          Number(summary.pending_discount) || sumAmounts(discountPending),
        collected_cash_today: 0,
        collected_transfer_today: 0,
        pending_count: discountPending.length,
      };
    }
    return {
      showCash: true,
      showTransfer: true,
      showSplit: false,
      showCredit: false,
      showDiscount: false,
      pending_cash: summary.pending_cash,
      pending_transfer: summary.pending_transfer,
      pending_split: summary.pending_split,
      pending_credit: summary.pending_credit || 0,
      pending_discount: summary.pending_discount || 0,
      collected_cash_today: summary.collected_cash_today,
      collected_transfer_today: summary.collected_transfer_today,
      pending_count: summary.pending_count,
    };
  }, [methodTab, pending, creditPending, discountPending, summary]);

  const methodPendingCounts = useMemo(() => {
    const counts = {
      cash: 0,
      transfer: 0,
      credit: creditPending.length,
      discount: discountPending.length,
    };
    for (const r of pending) {
      if (matchesMethod(r.payment_type, "cash") && needsCollectionSide(r, "cash")) {
        counts.cash += 1;
      }
      if (
        matchesMethod(r.payment_type, "transfer") &&
        needsCollectionSide(r, "transfer")
      ) {
        counts.transfer += 1;
      }
    }
    return counts;
  }, [pending, creditPending, discountPending]);

  const filteredPending = useMemo(() => {
    let list =
      methodTab === "credit"
        ? creditPending
        : methodTab === "discount"
          ? discountPending
          : pending.filter(
              (r) =>
                matchesMethod(r.payment_type, methodTab) &&
                needsCollectionSide(r, methodTab),
            );
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.sale_code, r.customer_no, r.customer_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [pending, creditPending, discountPending, methodTab, search]);

  const filteredHistory = useMemo(() => {
    let list = history.filter((r) => {
      if (methodTab === "credit") {
        return String(r.payment_type || "").toLowerCase() === "credit";
      }
      return matchesMethod(r.payment_type, methodTab);
    });
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [
        r.sale_code,
        r.customer_no,
        r.customer_name,
        r.status,
        r.status_label,
        r.description,
        r.kind,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [history, methodTab, search]);

  const openAdvanceSheet = useCallback((prefillCustomer = null) => {
    const defaultMode =
      methodTab === "transfer"
        ? "transfer"
        : methodTab === "cash"
          ? "cash"
          : "cash";
    setAdvanceMode(defaultMode);
    setAdvanceCustomer(prefillCustomer || null);
    setAdvanceAmount("");
    setAdvanceCashAmount("");
    setAdvanceTransferAmount("");
    setAdvanceNarration("Collection Points customer deposit");
    setAdvanceOpen(true);
  }, [methodTab]);

  // Deep-link: /collection-points?action=deposit&customerNo=CUS-…
  useEffect(() => {
    const action = String(searchParams.get("action") || "").toLowerCase();
    if (action !== "deposit" && action !== "make-deposit") return;
    if (methodTab === "credit") setMethodTab("cash");
    const customerNo = searchParams.get("customerNo") || "";
    const customerName = searchParams.get("customerName") || "";
    const prefill =
      customerNo
        ? {
            customerNo,
            fullname: customerName || customerNo,
            name: customerName || customerNo,
          }
        : null;
    openAdvanceSheet(prefill);
    // Clear query so refresh doesn't reopen
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    next.delete("customerNo");
    next.delete("customerName");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openAdvanceSheet, methodTab]);

  const closeAdvanceSheet = () => {
    setAdvanceOpen(false);
    setAdvanceCustomer(null);
    setAdvanceAmount("");
    setAdvanceCashAmount("");
    setAdvanceTransferAmount("");
    setAdvanceNarration("");
  };

  const submitCustomerAdvance = () => {
    if (!activeBusiness?.id || !user?.id) {
      toast.error("Session required");
      return;
    }
    if (!advanceCustomer?.customerNo) {
      toast.error("Select a customer");
      return;
    }

    const cashAmt =
      parseFloat(String(advanceCashAmount || advanceAmount).replace(/,/g, "")) ||
      0;
    const transferAmt =
      parseFloat(String(advanceTransferAmount).replace(/,/g, "")) || 0;
    const singleAmt =
      parseFloat(String(advanceAmount).replace(/,/g, "")) || 0;

    if (advanceMode === "split") {
      if (cashAmt <= 0 || transferAmt <= 0) {
        toast.error("Enter both cash and transfer amounts");
        return;
      }
      if (!cashAccounts.accountHead?.head) {
        toast.error("Select cash Pay Through");
        return;
      }
      if (!bankAccounts.bankAccount?.id) {
        toast.error("Select transfer Pay Through");
        return;
      }
    } else if (advanceMode === "cash") {
      if (singleAmt <= 0) {
        toast.error("Enter advance amount");
        return;
      }
      if (!cashAccounts.accountHead?.head) {
        toast.error("Select cash Pay Through");
        return;
      }
    } else {
      if (singleAmt <= 0) {
        toast.error("Enter advance amount");
        return;
      }
      if (!bankAccounts.bankAccount?.id) {
        toast.error("Select transfer Pay Through");
        return;
      }
    }

    const base = {
      transaction_date: moment().format("YYYY-MM-DD"),
      customer_no: advanceCustomer.customerNo,
      facilityId: activeBusiness.id,
      userId: user.id,
      narration:
        advanceNarration.trim() ||
        "Collection Points customer deposit",
      receivable_deposit_code: activeBusiness.receivable_accural_code,
      receivable_code: activeBusiness.receivable_code,
      pure_advance: true,
      source: "collection_points",
      invoices: [],
    };

    let payload;
    if (advanceMode === "split") {
      payload = {
        ...base,
        amount_paid: cashAmt + transferAmt,
        mode_of_payment: "cash+transfer",
        payment_splits: [
          {
            mode: "cash",
            amount: cashAmt,
            accountHead: {
              head: cashAccounts.accountHead.head,
              description: cashAccounts.accountHead.description,
            },
          },
          {
            mode: "bank",
            amount: transferAmt,
            bankAccount: { id: bankAccounts.bankAccount.id },
          },
        ],
      };
    } else if (advanceMode === "cash") {
      payload = {
        ...base,
        amount_paid: singleAmt,
        mode_of_payment: "cash",
        accountHead: {
          head: cashAccounts.accountHead.head,
          description: cashAccounts.accountHead.description,
        },
      };
    } else {
      payload = {
        ...base,
        amount_paid: singleAmt,
        mode_of_payment: "bank transfer",
        bankAccount: { id: bankAccounts.bankAccount.id },
      };
    }

    setAdvanceSubmitting(true);
    _postApi(
      "/api/v1/customer-advance-payment",
      payload,
      (resp) => {
        setAdvanceSubmitting(false);
        if (resp?.error) {
          toast.error(String(resp.error));
          return;
        }
        if (resp?.success) {
          const ref =
            resp.data?.reference_number ||
            resp.data?.transaction_ref ||
            "";
          toast.success(
            ref
              ? `Customer deposit recorded (${ref})`
              : "Customer deposit recorded",
          );
          closeAdvanceSheet();
          fetchDashboard();
          setActiveTab("history");
        } else {
          toast.error(resp?.message || "Could not record advance");
        }
      },
      (err) => {
        setAdvanceSubmitting(false);
        toast.error(err?.message || "Could not record advance");
      },
    );
  };

  const openCollect = (row) => {
    const pt = String(row?.payment_type || "").toLowerCase();
    if (pt === "credit") {
      toast.info(
        "Credit invoices are approved on the Credit tab — not collected as cash/transfer",
      );
      return;
    }
    setSelected(row);
    const due = Number(row.amount) || 0;
    if (pt === "cash") {
      setCashAmount(String(due));
      setTransferAmount("");
    } else if (pt === "transfer" || pt === "bank") {
      setCashAmount("");
      setTransferAmount(String(due));
    } else {
      // Cash + Transfer (and unknown): leave amounts empty for the cashier to enter
      setCashAmount("");
      setTransferAmount("");
    }
    setCollectOpen(true);
  };

  const applySearchOrScan = useCallback(
    (raw, { fromScan = false } = {}) => {
      const code = String(raw || "").trim();
      if (!code) return;

      setSearch(code);
      setActiveTab("pending");

      const needle = code.toLowerCase();
      const pendingMatch =
        pending.find(
          (r) => String(r.sale_code || "").toLowerCase() === needle,
        ) ||
        creditPending.find(
          (r) => String(r.sale_code || "").toLowerCase() === needle,
        );
      if (pendingMatch) {
        const pt = String(pendingMatch.payment_type || "").toLowerCase();
        if (pt === "credit" || creditPending.includes(pendingMatch)) {
          setMethodTab("credit");
        } else if (pt === "transfer" || pt === "bank") {
          if (cashierType !== "cash") setMethodTab("transfer");
        } else if (pt === "cash") {
          if (cashierType !== "transfer") setMethodTab("cash");
        } else if (isSplitPaymentType(pt)) {
          // Prefer the side this cashier can collect; else keep current cash/transfer tab
          if (cashierType === "transfer") setMethodTab("transfer");
          else if (cashierType === "cash") setMethodTab("cash");
          else if (methodTab !== "cash" && methodTab !== "transfer") {
            setMethodTab("cash");
          }
        }
        if (pt === "credit" || creditPending.some((r) => r === pendingMatch || r.sale_code === pendingMatch.sale_code)) {
          if (fromScan) toast.success(`Scanned ${pendingMatch.sale_code}`);
          return;
        }
        openCollect(pendingMatch);
        if (fromScan) toast.success(`Scanned ${pendingMatch.sale_code}`);
        return;
      }

      const historyMatch = history.find(
        (r) => String(r.sale_code || "").toLowerCase() === needle,
      );
      if (historyMatch) {
        setActiveTab("history");
        if (fromScan) toast.info(`${historyMatch.sale_code} already collected`);
        return;
      }

      if (fromScan) {
        toast.error(`No collection invoice found for ${code}`);
      }
    },
    // openCollect only uses setters + row data; safe across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, pending, creditPending, cashierType],
  );

  const handleBarcodeScan = useCallback(
    (code) => {
      if (collectOpen) return;
      const tag = String(document.activeElement?.tagName || "").toLowerCase();
      if (tag === "textarea") return;
      applySearchOrScan(code, { fromScan: true });
    },
    [applySearchOrScan, collectOpen],
  );

  useScanDetection({
    onComplete: handleBarcodeScan,
    minLength: 3,
  });

  const closeCollect = () => {
    setCollectOpen(false);
    setSelected(null);
    setCashAmount("");
    setTransferAmount("");
  };

  const approveCredit = (row) => {
    if (!row || !activeBusiness?.id) return;
    setSubmitting(true);
    _postApi(
      "/api/v1/sale-workflows/advance",
      {
        facilityId: activeBusiness.id,
        saleCode: row.sale_code,
        action: "advance",
        updated_by: user?.id,
        note: "Credit approved",
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          toast.success(res.message || "Credit approved");
          fetchDashboard();
        } else {
          toast.error(res?.message || "Could not approve credit");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not approve credit");
      },
    );
  };

  const approveDiscount = (row) => {
    if (!row || !activeBusiness?.id) return;
    setSubmitting(true);
    _postApi(
      "/api/v1/sale-workflows/advance",
      {
        facilityId: activeBusiness.id,
        saleCode: row.sale_code,
        action: "advance",
        updated_by: user?.id,
        note: "Discount approved",
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          toast.success(
            res.message || "Discount approved — invoice released to collection",
          );
          fetchDashboard();
        } else {
          toast.error(res?.message || "Could not approve discount");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not approve discount");
      },
    );
  };

  const confirmPayment = () => {
    if (!selected || !activeBusiness?.id) return;
    const cashAmt = parseFloat(String(cashAmount).replace(/,/g, "")) || 0;
    const transferAmt =
      parseFloat(String(transferAmount).replace(/,/g, "")) || 0;
    const splits = [];

    if (showCashFields && cashAmt > 0) {
      if (!cashAccounts.accountHead?.head) {
        toast.error("Select a cash account (Pay Through)");
        return;
      }
      splits.push({
        mode: "cash",
        amount: cashAmt,
        accountHead: cashAccounts.accountHead,
      });
    }
    if (showTransferFields && transferAmt > 0) {
      if (!bankAccounts.bankAccount?.id) {
        toast.error("Select a bank account (Pay Through)");
        return;
      }
      splits.push({
        mode: "bank",
        amount: transferAmt,
        bankAccount: bankAccounts.bankAccount,
      });
    }

    if (!splits.length) {
      toast.error(
        isSplit
          ? collectionSide === "transfer"
            ? "Enter the transfer amount"
            : "Enter the cash amount"
          : "Enter cash and/or transfer amount",
      );
      return;
    }

    const total = splits.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (isSplit) {
      if (total <= 0) {
        toast.error("Enter your portion amount");
        return;
      }
      if (remainingDue <= 0.05) {
        toast.error("This invoice is already fully collected");
        return;
      }
      if (total - remainingDue > 0.05) {
        toast.error(
          `Amount cannot exceed remaining ₦${formatNumber1(remainingDue)}`,
        );
        return;
      }
    } else if (Math.abs(total - amountDue) > 0.05) {
      toast.error(
        `Payment must equal ₦${formatNumber1(amountDue)} (entered ₦${formatNumber1(total)})`,
      );
      return;
    }

    setSubmitting(true);
    _postApi(
      "/api/v1/sale-workflows/cashier-confirm",
      {
        facilityId: activeBusiness.id,
        saleCode: selected.sale_code,
        updated_by: user?.id,
        collector_name:
          [user?.firstname, user?.lastname].filter(Boolean).join(" ").trim() ||
          user?.name ||
          user?.username ||
          undefined,
        cashier_type: cashierType || undefined,
        collection_side:
          methodTab === "transfer"
            ? "transfer"
            : methodTab === "cash"
              ? "cash"
              : isSplit
                ? collectionSide
                : undefined,
        payment_splits: splits,
        note: isSplit
          ? `${collectionSide === "transfer" ? "Transfer" : "Cash"} portion at Collection Points`
          : "Collected at Collection Points",
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          const saleCode = selected.sale_code;
          const status = String(res.results?.status || "").toLowerCase();
          const fullyPaid =
            ["invoice_separation", "payment_confirmed", "final_invoice"].includes(
              status,
            ) ||
            (!isSplit && Math.abs(total - amountDue) <= 0.05) ||
            (isSplit && total + 0.05 >= remainingDue);

          toast.success(res.message || "Payment confirmed");
          closeCollect();
          fetchDashboard();

          if (fullyPaid && saleCode) {
            navigate(
              `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                saleCode,
              )}&doc=invoice`,
            );
          }
        } else {
          toast.error(res?.message || "Could not confirm payment");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not confirm payment");
      },
    );
  };

  const splitHintTotal =
    (parseFloat(String(cashAmount).replace(/,/g, "")) || 0) +
    (parseFloat(String(transferAmount).replace(/,/g, "")) || 0);

  const summaryGridCols =
    methodTab === "credit" || methodTab === "discount"
      ? "xl:grid-cols-1 sm:grid-cols-1"
      : "xl:grid-cols-2";

  if (!visibleMethodTabs.length) {
    return (
      <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Collection Points
          </h1>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              You do not have permission to collect payments. Ask an admin to
              grant Cash Collection, Transfer Collection, or Credit Collection
              under Sales → Collection Points.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Collection Points
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Customer collection hub: Collect Payment on pending invoices, Make
              Deposit for prepaid funds, and Apply Deposit to open invoices.
              Supplier payments are handled under Purchase → Pay Bills.
              {cashierType ? (
                <span className="ml-1 font-medium text-[var(--aa-navy)]">
                  You are a {cashierType === "transfer" ? "Transfer" : "Cash"}{" "}
                  cashier.
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {methodTab !== "credit" && methodTab !== "discount" ? (
              <button
                type="button"
                onClick={() => openAdvanceSheet()}
                className="inline-flex items-center gap-2 rounded-md border border-[var(--aa-navy)] bg-white px-3 py-2 text-sm font-medium text-[var(--aa-navy)] shadow-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Make Deposit
              </button>
            ) : null}
            <Link
              to="/app/payments/apply-advance"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Apply Deposit
            </Link>
            <button
              type="button"
              onClick={fetchDashboard}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Method sub-tabs */}
        <div className="flex flex-wrap gap-2">
          {visibleMethodTabs.map((tab) => {
            const Icon = tab.icon;
            const active = methodTab === tab.id;
            const count = methodPendingCounts[tab.id] || 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMethodTab(tab.id);
                  setActiveTab("pending");
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Summary cards — follow active method tab */}
        <div className={`grid gap-3 sm:grid-cols-2 ${summaryGridCols}`}>
          {viewSummary.showCash ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Banknote className="h-4 w-4 text-emerald-600" />
                Cash to collect
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_cash)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Awaiting cash payment (includes Cash + Transfer)
              </p>
            </div>
          ) : null}

          {viewSummary.showTransfer ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Building2 className="h-4 w-4 text-sky-600" />
                Transfer to collect
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_transfer)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Awaiting bank transfer (includes Cash + Transfer)
              </p>
            </div>
          ) : null}

          {viewSummary.showCredit ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <CreditCard className="h-4 w-4 text-amber-600" />
                Credit awaiting approval
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_credit)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewSummary.pending_count} credit invoice
                {viewSummary.pending_count === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

          {viewSummary.showDiscount ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Percent className="h-4 w-4 text-orange-600" />
                Discount awaiting approval
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_discount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewSummary.pending_count} discounted invoice
                {viewSummary.pending_count === 1 ? "" : "s"} — approve before
                collection
              </p>
            </div>
          ) : null}

          {viewSummary.showCash ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Wallet className="h-4 w-4 text-emerald-600" />
                Cash collected today
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
                ₦{formatNumber1(viewSummary.collected_cash_today)}
              </p>
            </div>
          ) : null}

          {viewSummary.showTransfer ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Building2 className="h-4 w-4 text-sky-600" />
                Transfer collected today
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-sky-700">
                ₦{formatNumber1(viewSummary.collected_transfer_today)}
              </p>
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                  activeTab === "pending"
                    ? "bg-white text-[var(--aa-navy)] shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <Wallet className="h-4 w-4" />
                Pending ({filteredPending.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                  activeTab === "history"
                    ? "bg-white text-[var(--aa-navy)] shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <History className="h-4 w-4" />
                History
              </button>
            </div>

            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applySearchOrScan(search);
                  }
                }}
                placeholder="Search or scan invoice, customer…"
                autoComplete="off"
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-10 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
              <button
                type="button"
                title="Scan barcode / focus for USB scanner"
                aria-label="Scan barcode"
                onClick={() => {
                  searchInputRef.current?.focus();
                  toast.message("Ready to scan", {
                    description: "Scan an invoice barcode with your scanner",
                  });
                }}
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--aa-accent)] hover:bg-slate-100"
              >
                <ScanLine className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading collection queue…
            </div>
          ) : activeTab === "pending" ? (
            filteredPending.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-slate-500">
                No invoices awaiting{" "}
                {methodTab === "credit"
                  ? "credit approval"
                  : methodTab === "discount"
                    ? "discount approval"
                    : methodTab === "transfer"
                      ? "transfer payment"
                      : "cash payment"}
                .
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3 text-right">Amount due</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPending.map((row) => (
                      <tr key={row.id || row.sale_code} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          <Link
                            to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                              row.sale_code,
                            )}&doc=invoice`}
                            className="text-[var(--aa-accent)] hover:underline"
                            title="Open Sales Invoice"
                          >
                            {row.sale_code}
                          </Link>
                          <div className="mt-1.5">
                            <WorkflowStatusBadge
                              status={row.status}
                              paymentType={row.payment_type || (methodTab === "credit" ? "credit" : undefined)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {row.customer_name || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.customer_no}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                              row.payment_type || (methodTab === "credit" ? "credit" : ""),
                            )}`}
                          >
                            {isSplitPaymentType(row.payment_type) ? (
                              <Split className="h-3 w-3" />
                            ) : methodTab === "credit" ||
                              String(row.payment_type || "").toLowerCase() ===
                                "credit" ? (
                              <CreditCard className="h-3 w-3" />
                            ) : null}
                            {paymentTypeLabel(
                              row.payment_type ||
                                (methodTab === "credit" ? "credit" : ""),
                            )}
                          </span>
                          {isSplitPaymentType(row.payment_type) ? (
                            <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                              <div>
                                Cash:{" "}
                                {Number(row.split_progress?.cash) > 0 ? (
                                  <span className="font-medium text-emerald-600">
                                    ₦{formatNumber1(row.split_progress.cash)}
                                    {row.split_progress?.cash_by_name ? (
                                      <span className="ml-1 font-normal text-slate-500">
                                        · signed by{" "}
                                        {row.split_progress.cash_by_name}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="font-medium text-amber-600">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div>
                                Transfer:{" "}
                                {Number(row.split_progress?.transfer) > 0 ? (
                                  <span className="font-medium text-emerald-600">
                                    ₦
                                    {formatNumber1(row.split_progress.transfer)}
                                    {row.split_progress?.transfer_by_name ? (
                                      <span className="ml-1 font-normal text-slate-500">
                                        · signed by{" "}
                                        {row.split_progress.transfer_by_name}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : (
                                  <span className="font-medium text-amber-600">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div>
                                Remaining:{" "}
                                <span className="font-medium text-slate-700">
                                  ₦
                                  {formatNumber1(
                                    Math.max(
                                      0,
                                      Number(
                                        (
                                          (Number(row.amount) || 0) -
                                          (Number(
                                            row.split_progress?.collected_total,
                                          ) || 0)
                                        ).toFixed(2),
                                      ),
                                    ),
                                  )}
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          ₦{formatNumber1(row.amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {row.createdAt
                            ? moment(row.createdAt).format("DD MMM, HH:mm")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {methodTab === "credit" ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => approveCredit(row)}
                              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              Approve Credit
                            </button>
                          ) : methodTab === "discount" ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => approveDiscount(row)}
                              className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                            >
                              Approve Discount
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openCollect(row)}
                              className="rounded-md bg-[var(--aa-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--aa-accent-hover)]"
                            >
                              Collect Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredHistory.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-500">
              No confirmed {methodTab === "credit" ? "credit approvals" : "payments"} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((row) => {
                    const isAdvance = row.kind === "customer_advance";
                    const updated =
                      row.updatedAt || row.updated_at || row.createdAt;
                    return (
                    <tr key={row.id || row.sale_code} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        {isAdvance ? (
                          <span className="text-slate-800">{row.sale_code}</span>
                        ) : (
                          <Link
                            to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                              row.sale_code,
                            )}&doc=invoice`}
                            className="text-[var(--aa-accent)] hover:underline"
                            title="Open Sales Invoice"
                          >
                            {row.sale_code}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {row.customer_name || "—"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.customer_no}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                            row.payment_type,
                          )}`}
                        >
                          {isAdvance
                            ? `Deposit · ${paymentTypeLabel(row.payment_type)}`
                            : paymentTypeLabel(row.payment_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ₦{formatNumber1(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {row.status_label || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {updated
                          ? moment(updated).format("DD MMM, HH:mm")
                          : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={collectOpen}
        onOpenChange={(open) => {
          if (!open) closeCollect();
        }}
      >
        <SheetContent
          side="right"
          className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 sm:!max-w-md [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:bg-white/15"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-white/10 bg-[var(--aa-navy)] px-5 py-4 text-left">
            <SheetTitle className="pr-8 text-lg font-semibold text-white">
              Collect Payment
            </SheetTitle>
            <SheetDescription className="text-sm text-white/70">
              {selected?.sale_code} · {selected?.customer_name || "Customer"}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Amount due</span>
                <span className="text-lg font-semibold tabular-nums text-slate-900">
                  ₦{formatNumber1(amountDue)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">Mode of payment</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                    paymentType,
                  )}`}
                >
                  {paymentTypeLabel(paymentType)}
                </span>
              </div>
              {isSplit ? (
                <div className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                  <p>
                    Collecting{" "}
                    <span className="font-semibold text-slate-800">
                      {collectionSide === "transfer" ? "Transfer" : "Cash"}
                    </span>{" "}
                    part payment — both points can collect until the invoice is
                    fully paid.
                  </p>
                  <p>
                    Cash collected: ₦{formatNumber1(splitProgress?.cash || 0)}
                    {splitProgress?.cash_by_name
                      ? ` · signed by ${splitProgress.cash_by_name}`
                      : ""}
                  </p>
                  <p>
                    Transfer collected: ₦
                    {formatNumber1(splitProgress?.transfer || 0)}
                    {splitProgress?.transfer_by_name
                      ? ` · signed by ${splitProgress.transfer_by_name}`
                      : ""}
                  </p>
                  <p>
                    Remaining:{" "}
                    <span className="font-semibold tabular-nums text-slate-900">
                      ₦{formatNumber1(remainingDue)}
                    </span>
                  </p>
                  {(user?.firstname || user?.name || user?.username) && (
                    <p className="text-slate-500">
                      This collection will be signed by{" "}
                      <span className="font-medium text-slate-700">
                        {[user?.firstname, user?.lastname]
                          .filter(Boolean)
                          .join(" ")
                          .trim() ||
                          user?.name ||
                          user?.username}
                      </span>
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {showCashFields ? (
              <div className="space-y-2">
                {isSplit || !isCashOnly ? (
                  <>
                    <label className="text-sm font-medium text-slate-700">
                      Cash amount
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cashAmount}
                      onChange={(e) =>
                        setCashAmount(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                      placeholder="0.00"
                    />
                  </>
                ) : null}
                <label className="text-sm font-medium text-slate-700">
                  {isCashOnly || isSplit ? "Pay Through" : "Cash account"}
                </label>
                <Select
                  value={
                    cashAccounts.accountHead?.head
                      ? String(cashAccounts.accountHead.head)
                      : undefined
                  }
                  onValueChange={(val) => {
                    const found = (cashAccounts.headList || []).find(
                      (h) => String(h.head) === String(val),
                    );
                    cashAccounts.setAccountHead(found || {});
                  }}
                >
                  <SelectTrigger className={payThroughSelectTriggerClass}>
                    <SelectValue placeholder="Select cash / COA account…" />
                  </SelectTrigger>
                  <SelectContent className={payThroughSelectContentClass}>
                    {(cashAccounts.headList || []).map((h) => (
                      <SelectItem key={String(h.head)} value={String(h.head)}>
                        {cashPayThroughLabel(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Select the cash Chart of Accounts head for this collection.
                </p>
              </div>
            ) : null}

            {showTransferFields ? (
              <div className="space-y-2">
                {isSplit || !isTransferOnly ? (
                  <>
                    <label className="text-sm font-medium text-slate-700">
                      Transfer amount
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={transferAmount}
                      onChange={(e) =>
                        setTransferAmount(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                      placeholder="0.00"
                    />
                  </>
                ) : null}
                <label className="text-sm font-medium text-slate-700">
                  {isTransferOnly || isSplit ? "Pay Through" : "Bank account"}
                </label>
                <Select
                  value={
                    bankAccounts.bankAccount?.id != null
                      ? String(bankAccounts.bankAccount.id)
                      : undefined
                  }
                  onValueChange={(val) => {
                    const found = (bankAccounts.accountList || []).find(
                      (b) => String(b.id) === String(val),
                    );
                    bankAccounts.setBankAccount(found || null);
                  }}
                >
                  <SelectTrigger className={payThroughSelectTriggerClass}>
                    <SelectValue placeholder="Select bank account…" />
                  </SelectTrigger>
                  <SelectContent className={payThroughSelectContentClass}>
                    {(bankAccounts.accountList || []).map((b) => (
                      <SelectItem key={String(b.id)} value={String(b.id)}>
                        {bankPayThroughLabel(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Select the bank / COA account for this transfer.
                </p>
              </div>
            ) : null}

            {isSplit ? (
              <p className="text-xs text-slate-500">
                Entered: ₦{formatNumber1(splitHintTotal)} · Remaining after this: ₦
                {formatNumber1(
                  Math.max(0, Number((remainingDue - splitHintTotal).toFixed(2))),
                )}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeCollect}
              disabled={submitting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmPayment}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aa-accent-hover)] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isSplit
                ? `Confirm ${collectionSide === "transfer" ? "Transfer" : "Cash"}`
                : "Confirm Payment"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={advanceOpen}
        onOpenChange={(open) => {
          if (!open) closeAdvanceSheet();
        }}
      >
        <SheetContent
          side="right"
          className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 sm:!max-w-md [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:bg-white/15"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-white/10 bg-[var(--aa-navy)] px-5 py-4 text-left">
            <SheetTitle className="pr-8 text-lg font-semibold text-white">
              Make Deposit
            </SheetTitle>
            <SheetDescription className="text-sm text-white/70">
              Record a prepaid customer deposit (Cash, Transfer, or Cash +
              Transfer). Use Collect Payment for invoices awaiting collection.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Customer
              </label>
              <SearchCustomerInput
                selected={advanceCustomer ? [advanceCustomer] : []}
                onChange={(cus) => setAdvanceCustomer(cus)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Payment method
              </label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                value={advanceMode}
                onChange={(e) => {
                  setAdvanceMode(e.target.value);
                  setAdvanceAmount("");
                  setAdvanceCashAmount("");
                  setAdvanceTransferAmount("");
                }}
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="split">Cash + Transfer</option>
              </select>
            </div>

            {advanceMode === "split" ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Cash amount
                  </label>
                  <input
                    inputMode="decimal"
                    value={advanceCashAmount}
                    onChange={(e) =>
                      setAdvanceCashAmount(
                        e.target.value.replace(/[^\d.]/g, ""),
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                    placeholder="0.00"
                  />
                  <label className="text-sm font-medium text-slate-700">
                    Pay Through (Cash)
                  </label>
                  <Select
                    value={
                      cashAccounts.accountHead?.head
                        ? String(cashAccounts.accountHead.head)
                        : undefined
                    }
                    onValueChange={(val) => {
                      const cash = (cashAccounts.headList || []).find(
                        (h) => String(h.head) === String(val),
                      );
                      cashAccounts.setAccountHead(
                        cash
                          ? {
                              head: cash.head || "",
                              description: cash.description || "",
                            }
                          : {},
                      );
                    }}
                  >
                    <SelectTrigger className={payThroughSelectTriggerClass}>
                      <SelectValue placeholder="Select cash account…" />
                    </SelectTrigger>
                    <SelectContent className={payThroughSelectContentClass}>
                      {(cashAccounts.headList || []).map((h) => (
                        <SelectItem key={String(h.head)} value={String(h.head)}>
                          {cashPayThroughLabel(h)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Transfer amount
                  </label>
                  <input
                    inputMode="decimal"
                    value={advanceTransferAmount}
                    onChange={(e) =>
                      setAdvanceTransferAmount(
                        e.target.value.replace(/[^\d.]/g, ""),
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                    placeholder="0.00"
                  />
                  <label className="text-sm font-medium text-slate-700">
                    Pay Through (Transfer)
                  </label>
                  <Select
                    value={
                      bankAccounts.bankAccount?.id != null
                        ? String(bankAccounts.bankAccount.id)
                        : undefined
                    }
                    onValueChange={(val) => {
                      const found = (bankAccounts.accountList || []).find(
                        (b) => String(b.id) === String(val),
                      );
                      bankAccounts.setBankAccount(found || null);
                    }}
                  >
                    <SelectTrigger className={payThroughSelectTriggerClass}>
                      <SelectValue placeholder="Select bank account…" />
                    </SelectTrigger>
                    <SelectContent className={payThroughSelectContentClass}>
                      {(bankAccounts.accountList || []).map((b) => (
                        <SelectItem key={String(b.id)} value={String(b.id)}>
                          {bankPayThroughLabel(b)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-slate-500">
                  Total advance: ₦
                  {formatNumber1(
                    (parseFloat(advanceCashAmount) || 0) +
                      (parseFloat(advanceTransferAmount) || 0),
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Advance amount
                  </label>
                  <input
                    inputMode="decimal"
                    value={advanceAmount}
                    onChange={(e) =>
                      setAdvanceAmount(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                    placeholder="0.00"
                  />
                </div>
                {advanceMode === "cash" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Pay Through
                    </label>
                    <Select
                      value={
                        cashAccounts.accountHead?.head
                          ? String(cashAccounts.accountHead.head)
                          : undefined
                      }
                      onValueChange={(val) => {
                        const cash = (cashAccounts.headList || []).find(
                          (h) => String(h.head) === String(val),
                        );
                        cashAccounts.setAccountHead(
                          cash
                            ? {
                                head: cash.head || "",
                                description: cash.description || "",
                              }
                            : {},
                        );
                      }}
                    >
                      <SelectTrigger className={payThroughSelectTriggerClass}>
                        <SelectValue placeholder="Select cash account…" />
                      </SelectTrigger>
                      <SelectContent className={payThroughSelectContentClass}>
                        {(cashAccounts.headList || []).map((h) => (
                          <SelectItem
                            key={String(h.head)}
                            value={String(h.head)}
                          >
                            {cashPayThroughLabel(h)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Pay Through
                    </label>
                    <Select
                      value={
                        bankAccounts.bankAccount?.id != null
                          ? String(bankAccounts.bankAccount.id)
                          : undefined
                      }
                      onValueChange={(val) => {
                        const found = (bankAccounts.accountList || []).find(
                          (b) => String(b.id) === String(val),
                        );
                        bankAccounts.setBankAccount(found || null);
                      }}
                    >
                      <SelectTrigger className={payThroughSelectTriggerClass}>
                        <SelectValue placeholder="Select bank account…" />
                      </SelectTrigger>
                      <SelectContent className={payThroughSelectContentClass}>
                        {(bankAccounts.accountList || []).map((b) => (
                          <SelectItem key={String(b.id)} value={String(b.id)}>
                            {bankPayThroughLabel(b)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Narration
              </label>
              <textarea
                value={advanceNarration}
                onChange={(e) => setAdvanceNarration(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                placeholder="Collection Points customer deposit"
              />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <button
              type="button"
              onClick={closeAdvanceSheet}
              disabled={advanceSubmitting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCustomerAdvance}
              disabled={advanceSubmitting}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aa-accent-hover)] disabled:opacity-50"
            >
              {advanceSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Make Deposit
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
