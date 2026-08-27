import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Eye,
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
  POSTING_DATE_MIN,
  getPostingDateMax,
} from "@/utilities";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvancePaymentAccounts, isCashInHandHead } from "@/components/common/useAdvancePaymentAccounts";
import { WorkflowStatusBadge } from "@/lib/saleWorkflowStatus.js";
import useScanDetection from "@/hooks/useScanDetection";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import CreditSaleInvoiceImproved from "@/components/pages/sales/CreditSaleInvoiceImproved";

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
  {
    id: "mode",
    label: "Mode Switch",
    icon: ArrowRightLeft,
    privilege: "Approve Payment Mode Switch",
  },
];

const COLLECTION_TAB_PRIVILEGES = METHOD_TABS.map((t) => t.privilege);

const SWITCH_PAYMENT_MODE_PRIVILEGE = "Switch Payment Mode";
const APPROVE_PAYMENT_MODE_PRIVILEGE = "Approve Payment Mode Switch";

const LEGACY_COLLECTION_PRIVILEGES = [
  "Verification Points",
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
    t === "cash + transfer" ||
    t === "credit_split" ||
    t === "credit+cash+transfer" ||
    t === "credit + cash + transfer" ||
    t === "credit_cash_transfer"
  );
}

/** Normalize DB / legacy payment_type to a switch value. */
function normalizePaymentMode(type) {
  const t = String(type || "")
    .toLowerCase()
    .trim();
  if (t === "bank") return "transfer";
  if (
    t === "credit_split" ||
    t === "credit+cash+transfer" ||
    t === "credit + cash + transfer" ||
    t === "credit_cash_transfer"
  ) {
    return "credit_split";
  }
  if (isSplitPaymentType(t)) return "split";
  if (t === "credit") return "credit";
  if (t === "transfer") return "transfer";
  if (t === "cash") return "cash";
  return t || "cash";
}

const PAYMENT_MODE_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "transfer", label: "Transfer", icon: Building2 },
  { value: "split", label: "Transfer + Cash", icon: Split },
  { value: "credit", label: "Credit", icon: CreditCard },
  { value: "credit_split", label: "Credit + Cash + Transfer", icon: Wallet },
];

function paymentTypeLabel(type) {
  const t = normalizePaymentMode(type);
  const opt = PAYMENT_MODE_OPTIONS.find((o) => o.value === t);
  if (opt) return opt.label;
  if (t === "customer_advance" || t === "deposit") return "Deposit";
  if (t === "warehouse") return "Warehouse";
  return type || "—";
}

function paymentTypeBadgeClass(type) {
  const t = normalizePaymentMode(type);
  if (t === "split" || t === "credit_split")
    return "bg-violet-50 text-violet-700 ring-violet-200";
  if (t === "transfer") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (t === "credit") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

/** Journal-style amount input: 10000 → 10,000 (preserves typing decimals). */
function formatNumberWithCommas(value) {
  if (!value || value === "") return "";
  const numericValue = String(value).replace(/[^0-9.]/g, "");
  const endsWithDot = numericValue.endsWith(".");
  const parts = numericValue.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts[1] || "";
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimalPart) return `${formattedInteger}.${decimalPart}`;
  if (endsWithDot) return integerPart ? `${formattedInteger}.` : ".";
  return formattedInteger;
}

function parseFormattedAmount(value) {
  return parseFloat(String(value || "").replace(/,/g, "")) || 0;
}

/** Cash / Transfer / Credit tabs — credit_split appears on all three. */
function matchesMethod(paymentType, method) {
  const pt = normalizePaymentMode(paymentType);
  if (method === "cash")
    return pt === "cash" || pt === "split" || pt === "credit_split";
  if (method === "transfer")
    return pt === "transfer" || pt === "split" || pt === "credit_split";
  if (method === "credit") return pt === "credit" || pt === "credit_split";
  return true;
}

/** Show split / credit_split while any balance remains to collect. */
function needsCollectionSide(row, method) {
  if (!isSplitPaymentType(row?.payment_type)) return true;
  const due = Number(row?.amount) || 0;
  const collected = Number(row?.split_progress?.collected_total) || 0;
  const remaining = Number((due - collected).toFixed(2));
  if (remaining <= 0.05) return false;
  // Cash, Transfer, and Credit tabs all show until fully settled
  return method === "cash" || method === "transfer" || method === "credit";
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

  const hasCashCollection = functionalities.includes("Cash Collection");
  const hasTransferCollection = functionalities.includes(
    "Transfer Collection",
  );
  const canSwitchPaymentMode =
    !functionalities.length ||
    functionalities.includes(SWITCH_PAYMENT_MODE_PRIVILEGE);
  const canApprovePaymentMode =
    !functionalities.length ||
    functionalities.includes(APPROVE_PAYMENT_MODE_PRIVILEGE);

  const canViewCollectionTab = useCallback(
    (privilege) => {
      // No privilege list configured → full access (admin / legacy)
      if (!functionalities.length) return true;

      if (functionalities.includes(privilege)) return true;

      // Mode Switch is never granted by parent/legacy Collection Points alone
      if (
        privilege === APPROVE_PAYMENT_MODE_PRIVILEGE ||
        privilege === SWITCH_PAYMENT_MODE_PRIVILEGE
      ) {
        return (
          functionalities.includes(SWITCH_PAYMENT_MODE_PRIVILEGE) ||
          functionalities.includes(APPROVE_PAYMENT_MODE_PRIVILEGE)
        );
      }

      const hasAnyTabPriv = COLLECTION_TAB_PRIVILEGES.filter(
        (p) =>
          p !== APPROVE_PAYMENT_MODE_PRIVILEGE &&
          p !== SWITCH_PAYMENT_MODE_PRIVILEGE,
      ).some((p) => functionalities.includes(p));
      // Parent / legacy keys only (no Cash/Transfer/Credit yet) → collection tabs
      if (!hasAnyTabPriv) {
        return LEGACY_COLLECTION_PRIVILEGES.some((p) =>
          functionalities.includes(p),
        );
      }
      return false;
    },
    [functionalities],
  );

  const visibleMethodTabs = useMemo(
    () =>
      METHOD_TABS.filter((t) => {
        if (t.id === "mode") {
          // Explicit Switch or Approve only — not Cash/Transfer/legacy alone
          return canSwitchPaymentMode || canApprovePaymentMode;
        }
        return canViewCollectionTab(t.privilege);
      }),
    [canViewCollectionTab, canSwitchPaymentMode, canApprovePaymentMode],
  );

  const [methodTab, setMethodTab] = useState("cash");
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const todayYmd = moment().format("YYYY-MM-DD");
  const [historyFrom, setHistoryFrom] = useState(todayYmd);
  const [historyTo, setHistoryTo] = useState(todayYmd);
  const [pending, setPending] = useState([]);
  const [creditPending, setCreditPending] = useState([]);
  const [discountPending, setDiscountPending] = useState([]);
  const [modePending, setModePending] = useState([]);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    pending_cash: 0,
    pending_transfer: 0,
    pending_split: 0,
    pending_credit: 0,
    pending_discount: 0,
    pending_mode: 0,
    pending_count: 0,
    pending_total: 0,
    collected_cash_today: 0,
    collected_transfer_today: 0,
    collected_today: 0,
    approved_credit_today: 0,
    approved_credit_count_today: 0,
    history_from: todayYmd,
    history_to: todayYmd,
  });
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);

  /** Unified view + action hub: collect | credit | discount | mode | view */
  const [hubOpen, setHubOpen] = useState(false);
  const [hubAction, setHubAction] = useState("view");
  const [hubInvoiceData, setHubInvoiceData] = useState(null);
  const [hubLoading, setHubLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [switchingModeCode, setSwitchingModeCode] = useState(null);
  const [modeChangeRow, setModeChangeRow] = useState(null);
  const [modeChangeNext, setModeChangeNext] = useState("");
  const [modeApproveRow, setModeApproveRow] = useState(null);
  const [modeRejectRow, setModeRejectRow] = useState(null);
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const collectOpen = hubOpen && hubAction === "collect";

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
  const isCreditSplit = normalizePaymentMode(paymentType) === "credit_split";
  // Cash + Transfer (split): one side per tab. Credit + Cash + Transfer: both
  // cash and transfer fields in one collect form.
  const collectionSide = isCreditSplit
    ? ""
    : isSplit
      ? methodTab === "transfer"
        ? "transfer"
        : "cash"
      : methodTab === "transfer"
        ? "transfer"
        : methodTab === "cash"
          ? "cash"
          : "";
  const showCashFields =
    paymentType === "cash" ||
    (isSplit && (isCreditSplit || collectionSide === "cash"));
  const showTransferFields =
    paymentType === "transfer" ||
    paymentType === "bank" ||
    (isSplit && (isCreditSplit || collectionSide === "transfer"));
  const isCashOnly =
    paymentType === "cash" ||
    (isSplit && !isCreditSplit && collectionSide === "cash");
  const isTransferOnly =
    paymentType === "transfer" ||
    paymentType === "bank" ||
    (isSplit && !isCreditSplit && collectionSide === "transfer");
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
    let from = historyFrom || todayYmd;
    let to = historyTo || historyFrom || todayYmd;
    if (from > to) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
      historyFrom: from,
      historyTo: to,
    });
    if (user?.id != null) params.set("userId", String(user.id));
    if (user?.role) params.set("role", String(user.role));
    // Fetch all methods so tab counts/lists are complete; UI filters by method tab
    _fetchApi(
      `/api/v1/sale-workflows/cashier-dashboard?${params.toString()}`,
      (res) => {
        setLoading(false);
        setDashboardReady(true);
        if (res?.success) {
          setPending(res.results?.pending || []);
          setCreditPending(res.results?.credit_pending || []);
          setDiscountPending(res.results?.discount_pending || []);
          setModePending(res.results?.mode_pending || []);
          setHistory(res.results?.history || []);
          setSummary(
            res.results?.summary || {
              pending_cash: 0,
              pending_transfer: 0,
              pending_split: 0,
              pending_credit: 0,
              pending_discount: 0,
              pending_mode: 0,
              pending_count: 0,
              pending_total: 0,
              collected_cash_today: 0,
              collected_transfer_today: 0,
              collected_today: 0,
              approved_credit_today: 0,
              approved_credit_count_today: 0,
              history_from: from,
              history_to: to,
            },
          );
        } else {
          toast.error(res?.message || "Failed to load collection queue");
        }
      },
      (err) => {
        setLoading(false);
        setDashboardReady(true);
        toast.error(err?.message || "Failed to load collection queue");
      },
    );
  }, [
    activeBusiness?.id,
    user?.id,
    user?.role,
    historyFrom,
    historyTo,
    todayYmd,
  ]);

  useEffect(() => {
    setDashboardReady(false);
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
        showMode: false,
        pending_cash: sumAmounts(cashQueue),
        pending_transfer: 0,
        pending_split: 0,
        pending_credit: 0,
        pending_discount: 0,
        pending_mode: 0,
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
        showMode: false,
        pending_cash: 0,
        pending_transfer: sumAmounts(transferQueue),
        pending_split: 0,
        pending_credit: 0,
        pending_discount: 0,
        pending_mode: 0,
        collected_cash_today: 0,
        collected_transfer_today: summary.collected_transfer_today,
        pending_count: transferQueue.length,
      };
    }
    if (methodTab === "credit") {
      const creditSplitPending = pending.filter(
        (r) =>
          normalizePaymentMode(r.payment_type) === "credit_split" &&
          needsCollectionSide(r, "credit"),
      );
      const creditCount = creditPending.length + creditSplitPending.length;
      return {
        showCash: false,
        showTransfer: false,
        showSplit: false,
        showCredit: true,
        showDiscount: false,
        showMode: false,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: 0,
        pending_credit:
          Number(summary.pending_credit) ||
          sumAmounts([...creditPending, ...creditSplitPending]),
        pending_discount: 0,
        pending_mode: 0,
        collected_cash_today: 0,
        collected_transfer_today: 0,
        approved_credit_today: Number(summary.approved_credit_today) || 0,
        approved_credit_count_today:
          Number(summary.approved_credit_count_today) || 0,
        pending_count: creditCount,
      };
    }
    if (methodTab === "discount") {
      return {
        showCash: false,
        showTransfer: false,
        showSplit: false,
        showCredit: false,
        showDiscount: true,
        showMode: false,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: 0,
        pending_credit: 0,
        pending_discount:
          Number(summary.pending_discount) || sumAmounts(discountPending),
        pending_mode: 0,
        collected_cash_today: 0,
        collected_transfer_today: 0,
        pending_count: discountPending.length,
      };
    }
    if (methodTab === "mode") {
      return {
        showCash: false,
        showTransfer: false,
        showSplit: false,
        showCredit: false,
        showDiscount: false,
        showMode: true,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: 0,
        pending_credit: 0,
        pending_discount: 0,
        pending_mode:
          Number(summary.pending_mode) || sumAmounts(modePending),
        collected_cash_today: 0,
        collected_transfer_today: 0,
        pending_count: modePending.length,
      };
    }
    return {
      showCash: true,
      showTransfer: true,
      showSplit: false,
      showCredit: false,
      showDiscount: false,
      showMode: false,
      pending_cash: summary.pending_cash,
      pending_transfer: summary.pending_transfer,
      pending_split: summary.pending_split,
      pending_credit: summary.pending_credit || 0,
      pending_discount: summary.pending_discount || 0,
      pending_mode: summary.pending_mode || 0,
      collected_cash_today: summary.collected_cash_today,
      collected_transfer_today: summary.collected_transfer_today,
      pending_count: summary.pending_count,
    };
  }, [methodTab, pending, creditPending, discountPending, modePending, summary]);

  const methodPendingCounts = useMemo(() => {
    const creditSplitPending = pending.filter(
      (r) =>
        matchesMethod(r.payment_type, "credit") &&
        needsCollectionSide(r, "credit") &&
        normalizePaymentMode(r.payment_type) === "credit_split",
    );
    const counts = {
      cash: 0,
      transfer: 0,
      credit: creditPending.length + creditSplitPending.length,
      discount: discountPending.length,
      mode: modePending.length,
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
  }, [pending, creditPending, discountPending, modePending]);

  const filteredPending = useMemo(() => {
    let list;
    if (methodTab === "credit") {
      // Pure credit awaiting approval + Credit+Cash+Transfer still at cashier
      const byCode = new Map();
      for (const r of creditPending) {
        if (r?.sale_code) byCode.set(r.sale_code, r);
      }
      for (const r of pending) {
        if (
          normalizePaymentMode(r.payment_type) === "credit_split" &&
          needsCollectionSide(r, "credit")
        ) {
          if (r?.sale_code && !byCode.has(r.sale_code)) {
            byCode.set(r.sale_code, r);
          }
        }
      }
      list = [...byCode.values()];
    } else if (methodTab === "discount") {
      list = discountPending;
    } else if (methodTab === "mode") {
      // Mode Switch: invoices you can change + those awaiting mode approval
      const byCode = new Map();
      for (const r of [...pending, ...creditPending, ...modePending]) {
        if (!r?.sale_code) continue;
        const existing = byCode.get(r.sale_code);
        // Prefer mode-approval row when both exist
        if (
          !existing ||
          r.status === "awaiting_payment_mode_approval" ||
          r.proposed_payment_type ||
          r.pending_payment_mode
        ) {
          byCode.set(r.sale_code, r);
        }
      }
      list = [...byCode.values()];
    } else {
      list = pending.filter(
        (r) =>
          matchesMethod(r.payment_type, methodTab) &&
          needsCollectionSide(r, methodTab),
      );
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.sale_code, r.customer_no, r.customer_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [pending, creditPending, discountPending, modePending, methodTab, search]);

  const filteredHistory = useMemo(() => {
    let list = history.filter((r) => {
      if (methodTab === "credit") {
        return matchesMethod(r.payment_type, "credit");
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
    setAdvanceNarration("Verification Points customer deposit");
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

    const cashAmt = parseFormattedAmount(advanceCashAmount || advanceAmount);
    const transferAmt = parseFormattedAmount(advanceTransferAmount);
    const singleAmt = parseFormattedAmount(advanceAmount);

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
        "Verification Points customer deposit",
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

  const loadHubInvoice = useCallback(
    (saleCode) => {
      const code = String(saleCode || "").trim();
      if (!code || !activeBusiness?.id) {
        setHubInvoiceData(null);
        setHubLoading(false);
        return;
      }
      setHubLoading(true);
      setHubInvoiceData(null);
      _fetchApi(
        `/api/v1/transactions/get-sale?sale_code=${encodeURIComponent(
          code,
        )}&facility_id=${activeBusiness.id}`,
        (res) => {
          setHubLoading(false);
          if (res?.success && res.data) {
            setHubInvoiceData(res.data);
          } else {
            toast.error(res?.message || "Failed to load invoice");
            setHubInvoiceData(null);
          }
        },
        () => {
          setHubLoading(false);
          toast.error("Failed to load invoice");
          setHubInvoiceData(null);
        },
      );
    },
    [activeBusiness?.id],
  );

  const resolveHubAction = useCallback(
    (row, preferred) => {
      if (preferred) return preferred;
      const pt = normalizePaymentMode(row?.payment_type);
      // Credit + Cash + Transfer: collect (cash/transfer/remainder) on any tab
      if (pt === "credit_split" || pt === "split") return "collect";
      if (methodTab === "credit" || pt === "credit") return "credit";
      if (methodTab === "discount") return "discount";
      if (methodTab === "mode") return "mode";
      if (pt === "credit") return "credit";
      return "collect";
    },
    [methodTab],
  );

  const openHub = useCallback(
    (row, preferredAction = null) => {
      if (!row?.sale_code) return;
      const action = resolveHubAction(row, preferredAction);
      const pt = String(row?.payment_type || "").toLowerCase();

      if (action === "collect" && pt === "credit") {
        toast.info(
          "Credit invoices are approved on the Credit tab — not collected as cash/transfer",
        );
        return;
      }

      setSelected(row);
      setHubAction(action);
      setHubOpen(true);
      loadHubInvoice(row.sale_code);

      if (action === "collect") {
        const due = Number(row.amount) || 0;
        if (pt === "cash") {
          setCashAmount(due > 0 ? formatNumberWithCommas(String(due)) : "");
          setTransferAmount("");
        } else if (pt === "transfer" || pt === "bank") {
          setCashAmount("");
          setTransferAmount(due > 0 ? formatNumberWithCommas(String(due)) : "");
        } else {
          setCashAmount("");
          setTransferAmount("");
        }
      }
    },
    [loadHubInvoice, resolveHubAction],
  );

  const openCollect = (row) => openHub(row, "collect");

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
          if (canViewCollectionTab("Transfer Collection")) {
            setMethodTab("transfer");
          }
        } else if (pt === "cash") {
          if (canViewCollectionTab("Cash Collection")) {
            setMethodTab("cash");
          }
        } else if (isSplitPaymentType(pt)) {
          // Prefer a side this user can collect via privileges
          if (
            canViewCollectionTab("Transfer Collection") &&
            !canViewCollectionTab("Cash Collection")
          ) {
            setMethodTab("transfer");
          } else if (canViewCollectionTab("Cash Collection")) {
            setMethodTab("cash");
          } else if (methodTab !== "cash" && methodTab !== "transfer") {
            setMethodTab("cash");
          }
        }
        if (
          pt === "credit" ||
          creditPending.some(
            (r) =>
              r === pendingMatch || r.sale_code === pendingMatch.sale_code,
          )
        ) {
          openHub(pendingMatch, "credit");
          if (fromScan) toast.success(`Scanned ${pendingMatch.sale_code}`);
          return;
        }
        openHub(pendingMatch, "collect");
        if (fromScan) toast.success(`Scanned ${pendingMatch.sale_code}`);
        return;
      }

      const historyMatch = history.find(
        (r) => String(r.sale_code || "").toLowerCase() === needle,
      );
      if (historyMatch) {
        setActiveTab("history");
        if (!historyMatch.kind || historyMatch.kind !== "customer_advance") {
          openHub(historyMatch, "view");
        }
        if (fromScan) toast.info(`${historyMatch.sale_code} already collected`);
        return;
      }

      if (fromScan) {
        toast.error(`No collection invoice found for ${code}`);
      }
    },
    // openHub only uses setters + row data; safe across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, pending, creditPending, canViewCollectionTab, methodTab, openHub],
  );

  // Deep-link: /verification-points?sale_code=INV-…&tab=credit|cash|transfer
  useEffect(() => {
    const code = String(searchParams.get("sale_code") || "").trim();
    if (!code || !dashboardReady || loading) return;

    const tab = String(searchParams.get("tab") || "").toLowerCase();
    if (tab === "credit" && canViewCollectionTab("Credit Collection")) {
      setMethodTab("credit");
    } else if (
      tab === "transfer" &&
      canViewCollectionTab("Transfer Collection")
    ) {
      setMethodTab("transfer");
    } else if (tab === "cash" && canViewCollectionTab("Cash Collection")) {
      setMethodTab("cash");
    }

    applySearchOrScan(code);

    const next = new URLSearchParams(searchParams);
    next.delete("sale_code");
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    dashboardReady,
    loading,
    applySearchOrScan,
    canViewCollectionTab,
  ]);

  const handleBarcodeScan = useCallback(
    (code) => {
      if (hubOpen) return;
      const tag = String(document.activeElement?.tagName || "").toLowerCase();
      if (tag === "textarea") return;
      applySearchOrScan(code, { fromScan: true });
    },
    [applySearchOrScan, hubOpen],
  );

  useScanDetection({
    onComplete: handleBarcodeScan,
    minLength: 3,
  });

  const closeHub = () => {
    setHubOpen(false);
  };

  const closeCollect = () => {
    closeHub();
  };

  useEffect(() => {
    if (hubOpen) return undefined;
    const t = window.setTimeout(() => {
      setHubAction("view");
      setHubInvoiceData(null);
      setHubLoading(false);
      setSelected(null);
      setCashAmount("");
      setTransferAmount("");
    }, 200);
    return () => window.clearTimeout(t);
  }, [hubOpen]);

  const openModeChange = (row) => {
    if (!canSwitchPaymentMode) {
      toast.error("You do not have permission to switch payment mode");
      return;
    }
    const current = normalizePaymentMode(
      row.payment_type || (methodTab === "credit" ? "credit" : "cash"),
    );
    setModeChangeRow(row);
    setModeChangeNext(current);
  };

  const closeModeChange = () => {
    if (switchingModeCode) return;
    setModeChangeRow(null);
    setModeChangeNext("");
  };

  const confirmModeChange = () => {
    if (!modeChangeRow?.sale_code || !activeBusiness?.id || !modeChangeNext) {
      return;
    }
    const current = normalizePaymentMode(
      modeChangeRow.payment_type ||
        (methodTab === "credit" ? "credit" : "cash"),
    );
    if (current === modeChangeNext) {
      toast.message("Same payment mode selected");
      return;
    }

    // Approvers apply immediately; switch-only users submit for Mode tab approval
    const requireApproval = !canApprovePaymentMode;

    setSwitchingModeCode(modeChangeRow.sale_code);
    _postApi(
      "/api/v1/sale-workflows/special-treatment",
      {
        facilityId: activeBusiness.id,
        saleCodes: [modeChangeRow.sale_code],
        paymentType: modeChangeNext,
        updated_by: user?.id,
        requireApproval,
        note: `Verification Points: payment mode ${current} → ${modeChangeNext}`,
      },
      (res) => {
        setSwitchingModeCode(null);
        if (res?.success) {
          const skipped = Array.isArray(res.results)
            ? res.results.find((r) => r.skipped)
            : null;
          if (skipped) {
            toast.error(skipped.reason || "Cannot change payment mode");
          } else {
            if (modeChangeNext === "credit" && !requireApproval) {
              toast.success(
                "Switched to Credit — approve on the Credit tab before Invoice Separation",
              );
            } else {
              toast.success(
                res.message ||
                  (requireApproval
                    ? `Submitted switch to ${paymentTypeLabel(modeChangeNext)} for approval`
                    : `Switched to ${paymentTypeLabel(modeChangeNext)}`),
              );
            }
            setModeChangeRow(null);
            setModeChangeNext("");
            closeHub();
          }
          fetchDashboard();
        } else {
          toast.error(res?.message || "Could not switch payment mode");
        }
      },
      (err) => {
        setSwitchingModeCode(null);
        toast.error(err?.message || "Could not switch payment mode");
      },
    );
  };

  const confirmApprovePaymentMode = () => {
    const row = modeApproveRow;
    if (!row || !activeBusiness?.id) return;
    if (!canApprovePaymentMode) {
      toast.error("You do not have permission to approve payment mode switches");
      return;
    }
    setSubmitting(true);
    _postApi(
      "/api/v1/sale-workflows/advance",
      {
        facilityId: activeBusiness.id,
        saleCode: row.sale_code,
        action: "advance",
        updated_by: user?.id,
        note: "Payment mode switch approved",
      },
      (res) => {
        setSubmitting(false);
        setModeApproveRow(null);
        if (res?.success) {
          toast.success(res.message || "Payment mode switch approved");
          closeHub();
          fetchDashboard();
        } else {
          toast.error(res?.message || "Could not approve payment mode switch");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not approve payment mode switch");
      },
    );
  };

  const confirmRejectPaymentMode = () => {
    const row = modeRejectRow;
    if (!row || !activeBusiness?.id) return;
    if (!canApprovePaymentMode) {
      toast.error("You do not have permission to reject payment mode switches");
      return;
    }
    setSubmitting(true);
    _postApi(
      "/api/v1/sale-workflows/advance",
      {
        facilityId: activeBusiness.id,
        saleCode: row.sale_code,
        action: "reject_payment_mode",
        updated_by: user?.id,
        note: "Payment mode switch rejected",
      },
      (res) => {
        setSubmitting(false);
        setModeRejectRow(null);
        if (res?.success) {
          toast.success(res.message || "Payment mode switch rejected");
          closeHub();
          fetchDashboard();
        } else {
          toast.error(res?.message || "Could not reject payment mode switch");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not reject payment mode switch");
      },
    );
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
          toast.success(
            res.message ||
              "Credit approved — invoice sent to Invoice Separation",
          );
          closeHub();
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
          closeHub();
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

  const sendCreditRemainder = () => {
    if (!selected || !activeBusiness?.id) return;
    if (normalizePaymentMode(selected.payment_type) !== "credit_split") {
      toast.error("Only Credit + Cash + Transfer invoices can leave a credit remainder");
      return;
    }
    if (remainingDue <= 0.05) {
      toast.error("Nothing left to send to credit");
      return;
    }
    setSubmitting(true);
    _postApi(
      "/api/v1/sale-workflows/send-credit-remainder",
      {
        facilityId: activeBusiness.id,
        saleCode: selected.sale_code,
        updated_by: user?.id,
        note: `Remainder ₦${remainingDue.toFixed(2)} sent to Credit Approval`,
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          toast.success(
            res.message ||
              "Remainder sent to Credit Approval — approve on the Credit tab",
          );
          closeCollect();
          fetchDashboard();
        } else {
          toast.error(res?.message || "Could not send remainder to credit");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not send remainder to credit");
      },
    );
  };

  const confirmPayment = () => {
    if (!selected || !activeBusiness?.id) return;
    const cashAmt = parseFormattedAmount(cashAmount);
    const transferAmt = parseFormattedAmount(transferAmount);
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
        cashier_type:
          methodTab === "transfer"
            ? "transfer"
            : methodTab === "cash"
              ? "cash"
              : undefined,
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
          ? `${collectionSide === "transfer" ? "Transfer" : "Cash"} portion at Verification Points`
          : "Collected at Verification Points",
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
    parseFormattedAmount(cashAmount) + parseFormattedAmount(transferAmount);

  const fillAllRemaining = (side) => {
    const amt = remainingDue > 0 ? remainingDue : 0;
    const formatted = amt > 0 ? formatNumberWithCommas(String(amt)) : "";
    if (side === "transfer") setTransferAmount(formatted);
    else setCashAmount(formatted);
  };

  const confirmButtonAmount = (() => {
    if (isSplit) {
      return collectionSide === "transfer"
        ? parseFormattedAmount(transferAmount)
        : parseFormattedAmount(cashAmount);
    }
    if (showCashFields) {
      const v = parseFormattedAmount(cashAmount);
      return v > 0 ? v : remainingDue;
    }
    if (showTransferFields) {
      const v = parseFormattedAmount(transferAmount);
      return v > 0 ? v : remainingDue;
    }
    return remainingDue;
  })();

  const confirmButtonLabel = (() => {
    const amtLabel =
      confirmButtonAmount > 0
        ? `₦${formatNumber1(confirmButtonAmount)}`
        : null;
    if (isSplit) {
      const side =
        collectionSide === "transfer" ? "Transfer" : "Cash";
      return amtLabel ? `Confirm ${amtLabel} ${side}` : `Confirm ${side}`;
    }
    return amtLabel ? `Confirm ${amtLabel}` : "Confirm Payment";
  })();

  const summaryGridCols =
    methodTab === "credit" ||
    methodTab === "discount" ||
    methodTab === "mode"
      ? "xl:grid-cols-1 sm:grid-cols-1"
      : "xl:grid-cols-2";

  if (!visibleMethodTabs.length) {
    return (
      <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Verification Points
          </h1>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              You do not have permission to collect payments. Ask an admin to
              grant Cash Collection, Transfer Collection, or Credit Collection
              under Sales → Verification Points.
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
              Verification Points
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Customer collection hub: open any invoice to view it and collect,
              approve credit/discount, or switch mode in the same modal. Make
              Deposit for prepaid funds, and Apply Deposit to open invoices.
              Supplier payments are handled under Purchase → Pay Bills.
              {hasCashCollection || hasTransferCollection ? (
                <span className="ml-1 font-medium text-[var(--aa-navy)]">
                  Access:{" "}
                  {[
                    hasCashCollection ? "Cash Collection" : null,
                    hasTransferCollection ? "Transfer Collection" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  .
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
            <Link
              to="/app/payments/collection-reconciliation"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              Collection Reconciliation
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
            const showCount = tab.id !== "mode";
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
                {showCount ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
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
                Awaiting cash payment (includes Transfer + Cash)
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
                Awaiting bank transfer (includes Transfer + Cash)
              </p>
            </div>
          ) : null}

          {viewSummary.showCredit ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-800">
                <CreditCard className="h-4 w-4 text-amber-600" />
                Credit awaiting approval
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_credit)}
              </p>
              <p className="mt-1 text-xs text-amber-800/80">
                {viewSummary.pending_count} credit invoice
                {viewSummary.pending_count === 1 ? "" : "s"} — approve before
                Invoice Separation
              </p>
            </div>
          ) : null}

          {viewSummary.showCredit ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? "Credit approved today"
                  : "Credit approved"}
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
                ₦{formatNumber1(viewSummary.approved_credit_today)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewSummary.approved_credit_count_today || 0} credit invoice
                {(viewSummary.approved_credit_count_today || 0) === 1
                  ? ""
                  : "s"}{" "}
                approved
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? " today"
                  : historyFrom === historyTo
                    ? ` on ${moment(historyFrom).format("DD MMM")}`
                    : ` in range`}
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

          {viewSummary.showMode ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                Mode switches awaiting approval
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_mode)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewSummary.pending_count} invoice
                {viewSummary.pending_count === 1 ? "" : "s"} — approve or reject
                the requested payment mode
              </p>
            </div>
          ) : null}

          {viewSummary.showCash ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Wallet className="h-4 w-4 text-emerald-600" />
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? "Cash collected today"
                  : "Cash collected"}
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
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? "Transfer collected today"
                  : "Transfer collected"}
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
                Pending
                {methodTab === "mode" ? null : ` (${filteredPending.length})`}
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

            {activeTab === "history" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  Date
                </span>
                <input
                  type="date"
                  value={historyFrom}
                  min={POSTING_DATE_MIN}
                  max={getPostingDateMax()}
                  onChange={(e) => {
                    const v = e.target.value || todayYmd;
                    setHistoryFrom(v);
                    if (historyTo && v > historyTo) setHistoryTo(v);
                  }}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={historyTo}
                  min={historyFrom || POSTING_DATE_MIN}
                  max={getPostingDateMax()}
                  onChange={(e) => {
                    const v = e.target.value || historyFrom || todayYmd;
                    setHistoryTo(v);
                  }}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setHistoryFrom(todayYmd);
                    setHistoryTo(todayYmd);
                  }}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Today
                </button>
              </div>
            ) : null}
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
                    : methodTab === "mode"
                      ? "payment mode approval"
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
                      <th className="px-4 py-3">Cashier</th>
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
                          <button
                            type="button"
                            onClick={() => openHub(row)}
                            className="text-left text-[var(--aa-accent)] hover:underline"
                            title="View invoice and take action"
                          >
                            {row.sale_code}
                          </button>
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
                          <div className="text-sm text-slate-800">
                            {row.assigned_cashier_name || "—"}
                          </div>
                          {row.assigned_cashier_id ? (
                            <div className="text-[11px] text-slate-500">
                              ID {row.assigned_cashier_id}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {methodTab === "mode" ? (
                            <div className="space-y-2">
                              {row.status === "awaiting_payment_mode_approval" ||
                              row.proposed_payment_type ||
                              row.pending_payment_mode?.to ? (
                                <div className="space-y-1 text-xs">
                                  <div>
                                    <span className="text-slate-500">Current: </span>
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                                        row.payment_type,
                                      )}`}
                                    >
                                      {paymentTypeLabel(row.payment_type)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Requested: </span>
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                                        row.proposed_payment_type ||
                                          row.pending_payment_mode?.to,
                                      )}`}
                                    >
                                      {paymentTypeLabel(
                                        row.proposed_payment_type ||
                                          row.pending_payment_mode?.to,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                                      row.payment_type,
                                    )}`}
                                  >
                                    {paymentTypeLabel(row.payment_type)}
                                  </span>
                                  {canSwitchPaymentMode ? (
                                    <button
                                      type="button"
                                      disabled={
                                        switchingModeCode === row.sale_code ||
                                        submitting
                                      }
                                      onClick={() => openModeChange(row)}
                                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      {switchingModeCode === row.sale_code ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <ArrowRightLeft className="h-3 w-3" />
                                      )}
                                      Change
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                                row.payment_type ||
                                  (methodTab === "credit" ? "credit" : ""),
                              )}`}
                            >
                              {paymentTypeLabel(
                                row.payment_type ||
                                  (methodTab === "credit" ? "credit" : ""),
                              )}
                            </span>
                          )}
                          {methodTab !== "mode" &&
                          (isSplitPaymentType(row.payment_type) ||
                            normalizePaymentMode(row.payment_type) ===
                              "credit_split") ? (
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
                            normalizePaymentMode(row.payment_type) ===
                            "credit_split" ? (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => openHub(row, "collect")}
                                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--aa-navy)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View & Collect
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => openHub(row, "credit")}
                                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View & Approve
                              </button>
                            )
                          ) : methodTab === "discount" ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => openHub(row, "discount")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View & Approve
                            </button>
                          ) : methodTab === "mode" ? (
                            row.status === "awaiting_payment_mode_approval" ||
                            row.proposed_payment_type ||
                            row.pending_payment_mode?.to ? (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => openHub(row, "mode")}
                                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View & Review
                              </button>
                            ) : canSwitchPaymentMode ? (
                              <button
                                type="button"
                                disabled={
                                  switchingModeCode === row.sale_code ||
                                  submitting
                                }
                                onClick={() => openHub(row, "mode")}
                                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--aa-navy)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View & Switch
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openHub(row, "view")}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => openHub(row, "collect")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--aa-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--aa-accent-hover)]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View & Collect
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
              No confirmed{" "}
              {methodTab === "credit" ? "credit approvals" : "payments"} for{" "}
              {historyFrom === historyTo
                ? moment(historyFrom).format("DD MMM YYYY")
                : `${moment(historyFrom).format("DD MMM YYYY")} – ${moment(
                    historyTo,
                  ).format("DD MMM YYYY")}`}
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
                          <button
                            type="button"
                            onClick={() => openHub(row, "view")}
                            className="text-left text-[var(--aa-accent)] hover:underline"
                            title="View invoice"
                          >
                            {row.sale_code}
                          </button>
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

      <Dialog
        open={hubOpen}
        onOpenChange={(open) => {
          if (!open) closeHub();
        }}
      >
        <DialogContent className="z-[200] flex max-h-[94vh] w-[min(98vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-slate-200 bg-[var(--aa-navy)] px-5 py-3.5 pr-12 text-left">
            <DialogTitle className="pr-4 text-base font-semibold text-white sm:text-lg">
              {hubAction === "collect"
                ? "View & Collect Payment"
                : hubAction === "credit"
                  ? "View & Approve Credit"
                  : hubAction === "discount"
                    ? "View & Approve Discount"
                    : hubAction === "mode"
                      ? "View & Review Mode"
                      : "Invoice"}{" "}
              {selected?.sale_code ? `· ${selected.sale_code}` : ""}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/70">
              {selected?.customer_name || "Customer"}
              {selected?.customer_no ? ` · ${selected.customer_no}` : ""}
              {" · "}
              {paymentTypeLabel(
                selected?.payment_type ||
                  (hubAction === "credit" ? "credit" : ""),
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
            <div className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50 px-2 py-3 sm:px-4 lg:border-b-0 lg:border-r">
              {hubLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : hubInvoiceData ? (
                <CreditSaleInvoiceImproved
                  invoiceData={hubInvoiceData}
                  business={hubInvoiceData.business || activeBusiness}
                  customer={hubInvoiceData.customer}
                  date={hubInvoiceData.date}
                  taxes={hubInvoiceData.taxes || []}
                  discount={hubInvoiceData.discount || null}
                  showPrintButton={false}
                  showCustomerCopyActions={false}
                  enableInlineCustomerCopyPreview={false}
                  documentMode="invoice"
                  paperSize={
                    String(
                      hubInvoiceData?.business?.default_receipt_type ||
                        activeBusiness?.default_receipt_type ||
                        "pdf",
                    )
                      .toLowerCase()
                      .trim() === "a5"
                      ? "a5"
                      : "a4"
                  }
                />
              ) : (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  Invoice could not be loaded. You can still use the actions on
                  the right.
                </p>
              )}
            </div>

            <div className="flex min-h-0 flex-col bg-white">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Amount due</span>
                    <span className="text-lg font-semibold tabular-nums text-slate-900">
                      ₦{formatNumber1(amountDue)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-600">Status</span>
                    <WorkflowStatusBadge
                      status={selected?.status}
                      paymentType={
                        selected?.payment_type ||
                        (hubAction === "credit" ? "credit" : undefined)
                      }
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600">Mode of payment</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                        paymentType ||
                          (hubAction === "credit" ? "credit" : ""),
                      )}`}
                    >
                      {paymentTypeLabel(
                        paymentType ||
                          (hubAction === "credit" ? "credit" : ""),
                      )}
                    </span>
                  </div>
                  {hubAction === "mode" &&
                  (selected?.proposed_payment_type ||
                    selected?.pending_payment_mode?.to) ? (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Requested</span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                          selected.proposed_payment_type ||
                            selected.pending_payment_mode?.to,
                        )}`}
                      >
                        {paymentTypeLabel(
                          selected.proposed_payment_type ||
                            selected.pending_payment_mode?.to,
                        )}
                      </span>
                    </div>
                  ) : null}
                  {hubAction === "collect" && isSplit ? (
                    <div className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                      <p>
                        Collecting{" "}
                        <span className="font-semibold text-slate-800">
                          {collectionSide === "transfer" ? "Transfer" : "Cash"}
                        </span>{" "}
                        part payment — both points can collect until the invoice
                        is fully paid
                        {normalizePaymentMode(paymentType) === "credit_split"
                          ? ", or send the unpaid remainder to Credit Approval"
                          : ""}
                        .
                      </p>
                      <p>
                        Cash collected: ₦
                        {formatNumber1(splitProgress?.cash || 0)}
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
                    </div>
                  ) : null}
                </div>

                {hubAction === "collect" ? (
                  <>
                    {showCashFields ? (
                      <div className="space-y-2">
                        {isSplit || !isCashOnly ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-sm font-medium text-slate-700">
                                Cash amount
                              </label>
                              <button
                                type="button"
                                onClick={() => fillAllRemaining("cash")}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--aa-navy)] hover:bg-slate-50"
                              >
                                All (₦{formatNumber1(remainingDue)})
                              </button>
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={cashAmount}
                              onChange={(e) =>
                                setCashAmount(
                                  formatNumberWithCommas(e.target.value),
                                )
                              }
                              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                              placeholder="0.00"
                            />
                          </>
                        ) : null}
                        <label className="text-sm font-medium text-slate-700">
                          {isCashOnly || isSplit
                            ? "Pay Through"
                            : "Cash account"}
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
                    ) : null}

                    {showTransferFields ? (
                      <div className="space-y-2">
                        {isSplit || !isTransferOnly ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-sm font-medium text-slate-700">
                                Transfer amount
                              </label>
                              <button
                                type="button"
                                onClick={() => fillAllRemaining("transfer")}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--aa-navy)] hover:bg-slate-50"
                              >
                                All (₦{formatNumber1(remainingDue)})
                              </button>
                            </div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={transferAmount}
                              onChange={(e) =>
                                setTransferAmount(
                                  formatNumberWithCommas(e.target.value),
                                )
                              }
                              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                              placeholder="0.00"
                            />
                          </>
                        ) : null}
                        <label className="text-sm font-medium text-slate-700">
                          {isTransferOnly || isSplit
                            ? "Pay Through"
                            : "Bank account"}
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
                              <SelectItem
                                key={String(b.id)}
                                value={String(b.id)}
                              >
                                {bankPayThroughLabel(b)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {isSplit ? (
                      <p className="text-xs text-slate-500">
                        Entered: ₦{formatNumber1(splitHintTotal)} · Remaining
                        after this: ₦
                        {formatNumber1(
                          Math.max(
                            0,
                            Number((remainingDue - splitHintTotal).toFixed(2)),
                          ),
                        )}
                      </p>
                    ) : null}
                  </>
                ) : null}

                {hubAction === "credit" ? (
                  <p className="text-sm text-slate-600">
                    Review the invoice, then approve credit to send it to Invoice
                    Separation.
                  </p>
                ) : null}
                {hubAction === "discount" ? (
                  <p className="text-sm text-slate-600">
                    Review the invoice, then approve the discount to release it
                    for collection.
                  </p>
                ) : null}
                {hubAction === "mode" ? (
                  <p className="text-sm text-slate-600">
                    {selected?.status === "awaiting_payment_mode_approval" ||
                    selected?.proposed_payment_type ||
                    selected?.pending_payment_mode?.to
                      ? "Review the invoice and approve or reject the requested payment mode switch."
                      : "Review the invoice, then switch the payment mode if needed."}
                  </p>
                ) : null}
                {hubAction === "view" ? (
                  <p className="text-sm text-slate-600">
                    Read-only view of this invoice from Verification Points
                    history.
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeHub}
                    disabled={submitting}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Close
                  </button>

                  {hubAction === "collect" ? (
                    <>
                      {normalizePaymentMode(paymentType) === "credit_split" &&
                      remainingDue > 0.05 ? (
                        <button
                          type="button"
                          onClick={sendCreditRemainder}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4" />
                          )}
                          Leave ₦{formatNumber1(remainingDue)} on Credit
                        </button>
                      ) : null}
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
                        {confirmButtonLabel}
                      </button>
                    </>
                  ) : null}

                  {hubAction === "credit" ? (
                    <button
                      type="button"
                      disabled={submitting || !selected}
                      onClick={() => approveCredit(selected)}
                      className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve Credit
                      {selected?.amount > 0
                        ? ` · ₦${formatNumber1(selected.amount)}`
                        : ""}
                    </button>
                  ) : null}

                  {hubAction === "discount" ? (
                    <button
                      type="button"
                      disabled={submitting || !selected}
                      onClick={() => approveDiscount(selected)}
                      className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve Discount
                    </button>
                  ) : null}

                  {hubAction === "mode" ? (
                    selected?.status === "awaiting_payment_mode_approval" ||
                    selected?.proposed_payment_type ||
                    selected?.pending_payment_mode?.to ? (
                      canApprovePaymentMode ? (
                        <>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setModeRejectRow(selected)}
                            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => setModeApproveRow(selected)}
                            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve Mode
                          </button>
                        </>
                      ) : (
                        <span className="self-center text-xs text-slate-500">
                          Awaiting approval
                        </span>
                      )
                    ) : canSwitchPaymentMode ? (
                      <button
                        type="button"
                        disabled={
                          switchingModeCode === selected?.sale_code ||
                          submitting
                        }
                        onClick={() => openModeChange(selected)}
                        className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {switchingModeCode === selected?.sale_code ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4" />
                        )}
                        Switch Mode
                      </button>
                    ) : null
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <option value="split">Transfer + Cash</option>
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
                        formatNumberWithCommas(e.target.value),
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
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
                        formatNumberWithCommas(e.target.value),
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
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
                    parseFormattedAmount(advanceCashAmount) +
                      parseFormattedAmount(advanceTransferAmount),
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
                      setAdvanceAmount(formatNumberWithCommas(e.target.value))
                    }
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
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
                placeholder="Verification Points customer deposit"
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

      {/* Change payment mode — button picker + confirm */}
      <Dialog
        open={Boolean(modeChangeRow)}
        onOpenChange={(open) => {
          if (!open) closeModeChange();
        }}
      >
        <DialogContent className="z-[200] max-w-lg border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Change payment mode</DialogTitle>
            <DialogDescription>
              {modeChangeRow ? (
                <>
                  Invoice{" "}
                  <span className="font-mono font-medium text-slate-800">
                    {modeChangeRow.sale_code}
                  </span>
                  {" · "}
                  Current:{" "}
                  <span className="font-medium text-slate-800">
                    {paymentTypeLabel(modeChangeRow.payment_type)}
                  </span>
                </>
              ) : (
                "Select the new payment mode, then confirm."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 py-1">
            {PAYMENT_MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = modeChangeNext === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModeChangeNext(opt.value)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {modeChangeRow &&
          modeChangeNext &&
          normalizePaymentMode(modeChangeRow.payment_type) !==
            modeChangeNext ? (
            <div className="space-y-2">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Switch from{" "}
                <span className="font-semibold text-slate-900">
                  {paymentTypeLabel(modeChangeRow.payment_type)}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-900">
                  {paymentTypeLabel(modeChangeNext)}
                </span>
                {canApprovePaymentMode
                  ? ". This will apply immediately."
                  : ". This will be sent for approval on the Mode tab."}
              </p>
              {modeChangeNext === "credit" ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Note: Credit must be approved on the{" "}
                  <span className="font-semibold">Credit</span> tab before the
                  invoice can go to{" "}
                  <span className="font-semibold">Invoice Separation</span>.
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={closeModeChange}
              disabled={Boolean(switchingModeCode)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmModeChange}
              disabled={
                Boolean(switchingModeCode) ||
                !modeChangeNext ||
                normalizePaymentMode(modeChangeRow?.payment_type) ===
                  modeChangeNext
              }
              className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aa-accent-hover)] disabled:opacity-50"
            >
              {switchingModeCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm change
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(modeApproveRow)}
        onOpenChange={(open) => {
          if (!open && !submitting) setModeApproveRow(null);
        }}
      >
        <AlertDialogContent className="z-[200] border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Approve payment mode switch?</AlertDialogTitle>
            <AlertDialogDescription>
              {modeApproveRow ? (
                <>
                  Apply{" "}
                  <span className="font-semibold text-slate-800">
                    {paymentTypeLabel(
                      modeApproveRow.proposed_payment_type ||
                        modeApproveRow.pending_payment_mode?.to,
                    )}
                  </span>{" "}
                  on invoice{" "}
                  <span className="font-mono font-medium text-slate-800">
                    {modeApproveRow.sale_code}
                  </span>
                  ?
                </>
              ) : (
                "Confirm approving this payment mode switch."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                confirmApprovePaymentMode();
              }}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {submitting ? "Approving…" : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(modeRejectRow)}
        onOpenChange={(open) => {
          if (!open && !submitting) setModeRejectRow(null);
        }}
      >
        <AlertDialogContent className="z-[200] border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject payment mode switch?</AlertDialogTitle>
            <AlertDialogDescription>
              {modeRejectRow ? (
                <>
                  Keep current mode{" "}
                  <span className="font-semibold text-slate-800">
                    {paymentTypeLabel(modeRejectRow.payment_type)}
                  </span>{" "}
                  on invoice{" "}
                  <span className="font-mono font-medium text-slate-800">
                    {modeRejectRow.sale_code}
                  </span>
                  ?
                </>
              ) : (
                "Confirm rejecting this payment mode switch."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                confirmRejectPaymentMode();
              }}
              className="bg-slate-800 text-white hover:bg-slate-900"
            >
              {submitting ? "Rejecting…" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
