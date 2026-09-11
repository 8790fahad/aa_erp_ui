import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Eye,
  History,
  Loader2,
  Percent,
  RefreshCw,
  Vault,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
} from "@/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import "react-bootstrap-typeahead/css/Typeahead.css";
import {
  getUserFunctionalities,
  parseAccessList,
  allowedReconciliationModes,
  hasFullAccess,
  isBusinessOwner,
  allowedCollectionReconciliationTabs,
} from "@/lib/access";
import { isCashInHandHead } from "@/components/common/useAdvancePaymentAccounts";

function lineModeLabel(paymentType) {
  const pt = String(paymentType || "").toLowerCase();
  if (pt === "card") return "POS";
  if (pt === "apply_deposit" || pt === "deposit") return "Apply Deposit";
  if (pt === "credit" || pt === "credit_split") return "Credit";
  return paymentType || "—";
}

function visibleLine(line, reconModes) {
  const pt = String(line?.payment_type || "").toLowerCase();
  if (pt === "credit" || pt === "credit_split") return true;
  if (pt === "apply_deposit" || pt === "deposit") return true;
  return reconModes.some((m) => pt.includes(m));
}

function cashSafePrefsKey(facilityId) {
  return `aa_erp.cashSafePrefs.${facilityId}`;
}

function loadCashSafePrefs(facilityId) {
  if (!facilityId) return {};
  try {
    const raw = localStorage.getItem(cashSafePrefsKey(facilityId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCashSafePrefs(facilityId, prefs) {
  if (!facilityId) return;
  try {
    localStorage.setItem(cashSafePrefsKey(facilityId), JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function accountCode(acc) {
  return String(acc?.head || acc?.code || acc?.account_code || "").trim();
}

function isSafeAccount(acc) {
  const desc = String(acc?.description || "").toLowerCase();
  return /safe|vault|strong.?room/.test(desc);
}

function AccountTypeahead({
  options,
  value,
  onChange,
  placeholder,
}) {
  const selected = options.find((a) => accountCode(a) === String(value || ""));
  return (
    <TypeaheadCustom
      options={options}
      placeholder={placeholder}
      labelKey={(i) => `${i.description || ""} — (${accountCode(i)})`}
      onChange={(selectedItems) => {
        if (selectedItems?.length) {
          onChange(accountCode(selectedItems[0]));
        } else {
          onChange("");
        }
      }}
      fixed
      flip
      selected={selected ? [selected] : []}
    />
  );
}

/**
 * Cashier supervisor hand-in confirmation — not bank reconciliation.
 */
export default function CollectionReconciliation() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const facilityId = activeBusiness?.id;
  const functionalities = useMemo(() => {
    const fromBusiness = parseAccessList(activeBusiness?.functionalities);
    const fromUser = parseAccessList(user?.functionalities);
    return [...new Set([...fromBusiness, ...fromUser])];
  }, [activeBusiness?.functionalities, user?.functionalities]);
  const fullAccess =
    hasFullAccess(functionalities) ||
    isBusinessOwner(user, activeBusiness) ||
    !functionalities.length;
  const reconTabs = useMemo(() => {
    if (fullAccess) return ["handin", "history", "discount"];
    return allowedCollectionReconciliationTabs(functionalities);
  }, [fullAccess, functionalities]);
  const canHandIn = reconTabs.includes("handin");
  const canHistory = reconTabs.includes("history");
  const canApproveDiscount = reconTabs.includes("discount");
  const reconModes = useMemo(
    () =>
      allowedReconciliationModes(
        getUserFunctionalities(user, activeBusiness),
      ),
    [user, activeBusiness],
  );
  const showCash = reconModes.includes("cash");
  const showCard = reconModes.includes("card");
  const showTransfer = reconModes.includes("transfer");
  const visibleColCount =
    1 +
    (showCash ? 2 : 0) +
    (showCard ? 2 : 0) +
    (showTransfer ? 2 : 0) +
    2 +
    3;

  const [date, setDate] = useState(() => moment().format("YYYY-MM-DD"));
  const [cashierFilter, setCashierFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [cashiers, setCashiers] = useState([]);
  const [cashierOptions, setCashierOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [linesByCashier, setLinesByCashier] = useState({});
  const [linesLoading, setLinesLoading] = useState(null);
  const [pageView, setPageView] = useState(() => {
    const q = String(searchParams.get("tab") || "").toLowerCase();
    if (q === "discount") return "discount";
    if (q === "history") return "history";
    return "handin";
  });
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [cashDialog, setCashDialog] = useState(null);
  const [historyFrom, setHistoryFrom] = useState(() =>
    moment().subtract(30, "days").format("YYYY-MM-DD"),
  );
  const [historyTo, setHistoryTo] = useState(() => moment().format("YYYY-MM-DD"));
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [discountPending, setDiscountPending] = useState([]);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountSubmitting, setDiscountSubmitting] = useState("");
  const [discountSelected, setDiscountSelected] = useState(null);

  const selectView = (view) => {
    setPageView(view);
    if (view === "discount") {
      setSearchParams({ tab: "discount" }, { replace: true });
    } else if (view === "history") {
      setSearchParams({ tab: "history" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const loadDiscountPending = useCallback(() => {
    if (!facilityId) return;
    setDiscountLoading(true);
    const today = moment().format("YYYY-MM-DD");
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      historyFrom: today,
      historyTo: today,
    });
    if (user?.id != null) params.set("userId", String(user.id));
    _fetchApi(
      `/api/v1/sale-workflows/cashier-dashboard?${params.toString()}`,
      (res) => {
        setDiscountLoading(false);
        if (res?.success) {
          setDiscountPending(
            Array.isArray(res.results?.discount_pending)
              ? res.results.discount_pending
              : [],
          );
        } else {
          toast.error(res?.message || "Failed to load discount queue");
          setDiscountPending([]);
        }
      },
      (err) => {
        setDiscountLoading(false);
        toast.error(err?.message || "Failed to load discount queue");
        setDiscountPending([]);
      },
    );
  }, [facilityId, user?.id]);

  const approveDiscount = (row) => {
    if (!row?.sale_code || !facilityId) return;
    setDiscountSubmitting(row.sale_code);
    _postApi(
      "/api/v1/sale-workflows/advance",
      {
        facilityId,
        saleCode: row.sale_code,
        action: "approve_discount",
        updated_by: user?.id,
        note: "Discount approved",
      },
      (res) => {
        setDiscountSubmitting("");
        if (res?.success) {
          toast.success(
            res.message ||
              "Discount approved — invoice released to Verification Points",
          );
          setDiscountSelected(null);
          setDiscountPending((rows) =>
            rows.filter((r) => r.sale_code !== row.sale_code),
          );
          loadDiscountPending();
        } else {
          toast.error(res?.message || "Could not approve discount");
        }
      },
      (err) => {
        setDiscountSubmitting("");
        toast.error(err?.message || "Could not approve discount");
      },
    );
  };

  const load = useCallback(() => {
    if (!facilityId || !date) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      date,
    });

    _fetchApi(
      `/api/v1/collection-reconciliation?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res?.success) {
          const list = Array.isArray(res.cashiers) ? res.cashiers : [];
          const options = Array.isArray(res.cashier_options)
            ? res.cashier_options
            : list.map((c) => ({
                cashier_user_id: c.cashier_user_id,
                cashier_name: c.cashier_name,
              }));
          setCashiers(list);
          setCashierOptions(options);
          setSummary(res.summary || null);
          setCashierFilter((prev) => {
            if (prev === "all") return prev;
            const stillThere = options.some(
              (c) => String(c.cashier_user_id) === String(prev),
            );
            return stillThere ? prev : "all";
          });
          const next = {};
          list.forEach((c) => {
            const cashVal =
              c.received_cash != null ? c.received_cash : c.expected_cash ?? 0;
            const cardVal =
              c.received_card != null ? c.received_card : c.expected_card ?? 0;
            const transferVal =
              c.received_transfer != null
                ? c.received_transfer
                : c.expected_transfer ?? 0;
            next[c.cashier_user_id] = {
              received_cash: formatNumberWithCommas(String(cashVal)),
              received_card: formatNumberWithCommas(String(cardVal)),
              received_transfer: formatNumberWithCommas(String(transferVal)),
              note: c.note || "",
            };
          });
          setDrafts(next);
        } else {
          toast.error(res?.message || "Failed to load reconciliation");
          setCashiers([]);
          setCashierOptions([]);
          setSummary(null);
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to load reconciliation");
        setCashiers([]);
        setCashierOptions([]);
        setSummary(null);
      },
    );
  }, [facilityId, date]);

  useEffect(() => {
    if (canHandIn) load();
  }, [load, canHandIn]);

  const loadChartOfAccount = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/chart-of-accounts/${facilityId}`,
      (resp) => {
        if (resp?.success) {
          const results = Array.isArray(resp.results) ? resp.results : [];
          setChartOfAccount(
            results
              .map((acc) => ({
                ...acc,
                head: acc.head || acc.account_code || acc.code || "",
                description: acc.description || acc.head || "",
              }))
              .filter((acc) => acc.head),
          );
        }
      },
      () => setChartOfAccount([]),
    );
  }, [facilityId]);

  const loadHistory = useCallback(() => {
    if (!facilityId || !historyFrom || !historyTo) return;
    setHistoryLoading(true);
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      from: historyFrom,
      to: historyTo,
    });
    _fetchApi(
      `/api/v1/collection-reconciliation/history?${params.toString()}`,
      (res) => {
        setHistoryLoading(false);
        if (res?.success) {
          setHistory(Array.isArray(res.history) ? res.history : []);
        } else {
          toast.error(res?.message || "Failed to load history");
          setHistory([]);
        }
      },
      (err) => {
        setHistoryLoading(false);
        toast.error(err?.message || "Failed to load history");
        setHistory([]);
      },
    );
  }, [facilityId, historyFrom, historyTo]);

  useEffect(() => {
    if (pageView === "history") loadHistory();
  }, [pageView, loadHistory]);

  useEffect(() => {
    if (canApproveDiscount) loadDiscountPending();
  }, [canApproveDiscount, loadDiscountPending]);

  useEffect(() => {
    if (!reconTabs.length) return;
    if (!reconTabs.includes(pageView)) {
      selectView(reconTabs[0]);
    }
  }, [reconTabs, pageView]);

  const loadLines = useCallback(
    (cashierUserId) => {
      if (!facilityId || !date || !cashierUserId) return;
      if (linesByCashier[cashierUserId]) return;
      setLinesLoading(cashierUserId);
      const params = new URLSearchParams({
        facilityId: String(facilityId),
        date,
      });
      _fetchApi(
        `/api/v1/collection-reconciliation/${encodeURIComponent(
          cashierUserId,
        )}/lines?${params.toString()}`,
        (res) => {
          setLinesLoading(null);
          if (res?.success) {
            setLinesByCashier((prev) => ({
              ...prev,
              [cashierUserId]: Array.isArray(res.lines) ? res.lines : [],
            }));
          } else {
            toast.error(res?.message || "Failed to load lines");
          }
        },
        (err) => {
          setLinesLoading(null);
          toast.error(err?.message || "Failed to load lines");
        },
      );
    },
    [facilityId, date, linesByCashier],
  );

  const toggleExpand = (cashierUserId) => {
    if (expandedId === cashierUserId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(cashierUserId);
    loadLines(cashierUserId);
  };

  const updateDraft = (cashierUserId, field, value) => {
    let nextValue = value;
    if (field === "received_cash" || field === "received_transfer") {
      const withoutCommas = String(value || "").replace(/,/g, "");
      const sanitizedValue = filterJournalAmountInput(withoutCommas);
      const parts = sanitizedValue.split(".");
      const numericValue =
        parts.length > 2
          ? parts[0] + "." + parts.slice(1).join("")
          : sanitizedValue;
      nextValue = formatNumberWithCommas(numericValue);
    }
    setDrafts((prev) => ({
      ...prev,
      [cashierUserId]: {
        ...(prev[cashierUserId] || {
          received_cash: "",
          received_card: "",
          received_transfer: "",
          note: "",
        }),
        [field]: nextValue,
      },
    }));
  };

  const parseReceived = (row) => {
    const draft = drafts[row.cashier_user_id] || {};
    const received_cash = showCash
      ? parseFloat(parseNumberFromFormatted(draft.received_cash))
      : Number(row.received_cash ?? row.expected_cash) || 0;
    const received_card = showCard
      ? parseFloat(parseNumberFromFormatted(draft.received_card))
      : Number(row.received_card ?? row.expected_card) || 0;
    const received_transfer = showTransfer
      ? parseFloat(parseNumberFromFormatted(draft.received_transfer))
      : Number(row.received_transfer ?? row.expected_transfer) || 0;
    return { draft, received_cash, received_card, received_transfer };
  };

  const submitConfirm = (row, amounts, accounts = {}) => {
    if (!facilityId || !user?.id) {
      toast.error("Missing business or user session");
      return;
    }
    setConfirmingId(row.cashier_user_id);
    _postApi(
      "/api/v1/collection-reconciliation/confirm",
      {
        facilityId,
        date,
        branchId: 0,
        cashierUserId: row.cashier_user_id,
        received_cash: amounts.received_cash,
        received_card: amounts.received_card,
        received_transfer: amounts.received_transfer,
        cash_to_safe_amount: amounts.received_cash,
        shortage_amount: amounts.shortage_amount,
        note: amounts.note || null,
        confirmed_by: user.id,
        confirmed_by_name:
          [user.firstname, user.lastname].filter(Boolean).join(" ").trim() ||
          user.name ||
          user.username ||
          null,
        cash_from_account: accounts.cashFrom || null,
        safe_account: accounts.safe || null,
        shortage_account: accounts.shortageAccount || null,
      },
      (res) => {
        setConfirmingId(null);
        if (res?.success) {
          toast.success(res.message || "Confirmed");
          setCashDialog(null);
          setLinesByCashier({});
          load();
          if (pageView === "history") loadHistory();
        } else {
          toast.error(res?.message || "Could not confirm");
        }
      },
      (err) => {
        setConfirmingId(null);
        toast.error(err?.message || "Could not confirm");
      },
    );
  };

  const startConfirm = (row) => {
    if (!facilityId || !user?.id) {
      toast.error("Missing business or user session");
      return;
    }
    const parsed = parseReceived(row);
    if (
      !Number.isFinite(parsed.received_cash) ||
      !Number.isFinite(parsed.received_card) ||
      !Number.isFinite(parsed.received_transfer)
    ) {
      toast.error("Enter valid received amounts");
      return;
    }
    const expectedCash = Number(row.expected_cash) || 0;
    const needsCash =
      showCash && (expectedCash > 0.05 || parsed.received_cash > 0.05);
    if (!needsCash) {
      submitConfirm(
        row,
        {
          ...parsed,
          note: parsed.draft.note || null,
        },
        {},
      );
      return;
    }

    loadChartOfAccount();
    const prefs = loadCashSafePrefs(facilityId);
    const settingCash = String(
      activeBusiness?.recon_cash_account_code || "",
    ).trim();
    const settingSafe = String(
      activeBusiness?.recon_safe_account_code || "",
    ).trim();
    const settingShortage = String(
      activeBusiness?.recon_shortage_account_code || "",
    ).trim();
    const counted = moneySafe(Math.max(parsed.received_cash, 0));
    const toSafe = moneySafe(Math.min(counted, Math.max(expectedCash, 0)));
    const shortage = moneySafe(Math.max(expectedCash, 0) - toSafe);
    setCashDialog({
      row,
      received_cash: parsed.received_cash,
      received_card: parsed.received_card,
      received_transfer: parsed.received_transfer,
      expected_cash: expectedCash,
      to_safe: toSafe,
      shortage,
      to_safe_input: formatNumberWithCommas(String(toSafe)),
      shortage_input: formatNumberWithCommas(String(shortage)),
      lastEdited: "to_safe",
      cashFrom: settingCash || prefs.cashFrom || "",
      safe: settingSafe || prefs.safe || "",
      shortageAccount: settingShortage || prefs.shortage || "",
      note: parsed.draft.note || "",
    });
  };

  const applyChartDefaults = (dialog, accounts) => {
    if (!dialog) return dialog;
    const next = { ...dialog };
    const currentFrom = accounts.find(
      (a) => accountCode(a) === String(next.cashFrom || ""),
    );
    const fromLooksWrong =
      currentFrom &&
      /receivable/.test(String(currentFrom.description || "").toLowerCase());
    if (!next.cashFrom || fromLooksWrong) {
      const cash = accounts.find((a) => isCashInHandHead(a));
      if (cash) next.cashFrom = accountCode(cash);
    }
    if (!next.safe) {
      const safe = accounts.find((a) => isSafeAccount(a));
      if (safe) next.safe = accountCode(safe);
    }
    return next;
  };

  useEffect(() => {
    if (!cashDialog || !chartOfAccount.length) return;
    setCashDialog((prev) =>
      prev ? applyChartDefaults(prev, chartOfAccount) : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartOfAccount, cashDialog?.row?.cashier_user_id]);

  const liveTillSplit = cashDialog
    ? splitTillAmounts(
        cashDialog.expected_cash,
        cashDialog.to_safe_input,
        cashDialog.shortage_input,
        cashDialog.lastEdited,
      )
    : { expectedAmt: 0, toSafe: 0, shortage: 0 };

  const updateTillSplit = (field, raw) => {
    setCashDialog((prev) => {
      if (!prev) return prev;
      const formatted = formatAmountInput(raw);
      const split = splitTillAmounts(
        prev.expected_cash,
        field === "to_safe" ? formatted : prev.to_safe_input,
        field === "shortage" ? formatted : prev.shortage_input,
        field,
      );
      return {
        ...prev,
        lastEdited: field,
        to_safe: split.toSafe,
        shortage: split.shortage,
        to_safe_input:
          field === "to_safe"
            ? formatted
            : formatNumberWithCommas(String(split.toSafe)),
        shortage_input:
          field === "shortage"
            ? formatted
            : formatNumberWithCommas(String(split.shortage)),
      };
    });
  };

  const syncTillSplitInputs = (field) => {
    setCashDialog((prev) => {
      if (!prev) return prev;
      const split = splitTillAmounts(
        prev.expected_cash,
        prev.to_safe_input,
        prev.shortage_input,
        field || prev.lastEdited,
      );
      return {
        ...prev,
        lastEdited: field || prev.lastEdited,
        to_safe: split.toSafe,
        shortage: split.shortage,
        to_safe_input: formatNumberWithCommas(String(split.toSafe)),
        shortage_input: formatNumberWithCommas(String(split.shortage)),
      };
    });
  };

  const submitCashDialog = () => {
    if (!cashDialog?.row) return;
    const { row, received_card, received_transfer, expected_cash } = cashDialog;
    const split = splitTillAmounts(
      expected_cash,
      cashDialog.to_safe_input,
      cashDialog.shortage_input,
      cashDialog.lastEdited,
    );
    const { toSafe, shortage } = split;
    if (expected_cash > 0.05 && !cashDialog.cashFrom) {
      toast.error("Select the cash (till) account");
      return;
    }
    if (toSafe > 0.05 && !cashDialog.safe) {
      toast.error("Select the Safe account");
      return;
    }
    if (toSafe > 0.05 && cashDialog.cashFrom === cashDialog.safe) {
      toast.error("Cash and Safe accounts must be different");
      return;
    }
    if (Math.abs(shortage) > 0.05 && !cashDialog.shortageAccount) {
      toast.error(
        shortage > 0
          ? "Select an account for the shortage"
          : "Select an account for the overage",
      );
      return;
    }
    saveCashSafePrefs(facilityId, {
      cashFrom: cashDialog.cashFrom,
      safe: cashDialog.safe,
      shortage: cashDialog.shortageAccount,
    });
    submitConfirm(
      row,
      {
        received_cash: toSafe,
        received_card,
        received_transfer,
        shortage_amount: shortage,
        note: cashDialog.note || null,
      },
      {
        cashFrom: cashDialog.cashFrom,
        safe: cashDialog.safe,
        shortageAccount: cashDialog.shortageAccount,
      },
    );
  };

  const isLocked = (status) =>
    status === "confirmed" || status === "variance";

  const filteredCashiers = useMemo(() => {
    if (cashierFilter === "all") return cashiers;
    return cashiers.filter(
      (c) => String(c.cashier_user_id) === String(cashierFilter),
    );
  }, [cashiers, cashierFilter]);

  const viewSummary = useMemo(() => {
    const pick = (cash, card, transfer) =>
      (showCash ? Number(cash) || 0 : 0) +
      (showCard ? Number(card) || 0 : 0) +
      (showTransfer ? Number(transfer) || 0 : 0);

    if (cashierFilter === "all" && summary) {
      return {
        expected_cash: Number(summary.expected_cash) || 0,
        expected_card: Number(summary.expected_card) || 0,
        expected_transfer: Number(summary.expected_transfer) || 0,
        expected_total: pick(
          summary.expected_cash,
          summary.expected_card,
          summary.expected_transfer,
        ),
        credit_total: Number(summary.credit_total) || 0,
        deposit_total: Number(summary.deposit_total) || 0,
        confirmed_cash: Number(summary.received_cash) || 0,
        confirmed_card: Number(summary.received_card) || 0,
        confirmed_transfer: Number(summary.received_transfer) || 0,
        confirmed_total: pick(
          summary.received_cash,
          summary.received_card,
          summary.received_transfer,
        ),
        confirmed_count: Number(summary.confirmed_count) || 0,
        open_count: Number(summary.open_count) || 0,
      };
    }

    const rows = filteredCashiers;
    let expected_cash = 0;
    let expected_card = 0;
    let expected_transfer = 0;
    let credit_total = 0;
    let deposit_total = 0;
    let confirmed_cash = 0;
    let confirmed_card = 0;
    let confirmed_transfer = 0;
    let confirmed_count = 0;
    let open_count = 0;

    rows.forEach((c) => {
      expected_cash += Number(c.expected_cash) || 0;
      expected_card += Number(c.expected_card) || 0;
      expected_transfer += Number(c.expected_transfer) || 0;
      credit_total += Number(c.credit_total) || 0;
      deposit_total += Number(c.deposit_total) || 0;
      if (isLocked(c.status)) {
        confirmed_count += 1;
        confirmed_cash += Number(c.received_cash) || 0;
        confirmed_card += Number(c.received_card) || 0;
        confirmed_transfer += Number(c.received_transfer) || 0;
      } else {
        open_count += 1;
      }
    });

    return {
      expected_cash,
      expected_card,
      expected_transfer,
      expected_total: pick(expected_cash, expected_card, expected_transfer),
      credit_total,
      deposit_total,
      confirmed_cash,
      confirmed_card,
      confirmed_transfer,
      confirmed_total: pick(confirmed_cash, confirmed_card, confirmed_transfer),
      confirmed_count,
      open_count,
    };
  }, [cashierFilter, summary, filteredCashiers, showCash, showCard, showTransfer]);

  const cards = useMemo(
    () =>
      [
        {
          label: "To retire",
          value: viewSummary.expected_total,
        },
        showCash
          ? {
              label: "Cash to retire",
              value: viewSummary.expected_cash,
            }
          : null,
        showCard
          ? {
              label: "POS to retire",
              value: viewSummary.expected_card,
            }
          : null,
        showTransfer
          ? {
              label: "Transfer to retire",
              value: viewSummary.expected_transfer,
            }
          : null,
        {
          label: "Credit",
          value: viewSummary.credit_total,
        },
        {
          label: "Apply Deposit",
          value: viewSummary.deposit_total,
        },
        {
          label: "Confirmed total",
          value: viewSummary.confirmed_total,
        },
        {
          label: "Confirmed",
          value: viewSummary.confirmed_count,
          raw: true,
        },
        {
          label: "Open",
          value: viewSummary.open_count,
          raw: true,
        },
      ].filter(Boolean),
    [viewSummary, showCash, showCard, showTransfer],
  );

  return (
    <div className="min-h-screen bg-slate-50/80 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/app/payments/verification-points"
              className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[var(--aa-accent)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Verification Points
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <ClipboardCheck className="h-7 w-7 text-[var(--aa-accent)]" />
              Collection Reconciliation
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {pageView === "discount"
                ? "Approve invoice discounts here. After approval the invoice goes to Verification Points for cash, transfer, POS, or credit."
                : "Supervisor confirms each cashier's hand-in for the day. Cash is moved from the till to Safe. If cash is short, pick an account to post the shortage. Credit and Apply Deposit are day totals (not till cash)."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reconTabs.length ? (
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {canHandIn ? (
              <button
                type="button"
                onClick={() => selectView("handin")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  pageView === "handin"
                    ? "bg-[var(--aa-navy)] text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Hand-in
              </button>
              ) : null}
              {canHistory ? (
              <button
                type="button"
                onClick={() => selectView("history")}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                  pageView === "history"
                    ? "bg-[var(--aa-navy)] text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>
              ) : null}
              {canApproveDiscount ? (
              <button
                type="button"
                onClick={() => selectView("discount")}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                  pageView === "discount"
                    ? "bg-[var(--aa-navy)] text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                Discount
                {discountPending.length ? (
                  <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                    {discountPending.length}
                  </span>
                ) : null}
              </button>
              ) : null}
            </div>
            ) : null}
            {reconTabs.length ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={
                pageView === "history"
                  ? loadHistory
                  : pageView === "discount"
                    ? loadDiscountPending
                    : load
              }
              disabled={loading || historyLoading || discountLoading}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loading || historyLoading || discountLoading
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </Button>
            ) : null}
          </div>
        </div>

        {!reconTabs.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-600">
            You do not have permission for these tabs. Ask an admin to grant
            Hand-in, History, or Discount Collection under Sales → Verification
            Points → Collection Reconciliation.
          </p>
        </div>
        ) : pageView === "discount" ? (
        <DiscountApprovalPanel
          rows={discountPending}
          loading={discountLoading}
          submittingCode={discountSubmitting}
          selected={discountSelected}
          onSelect={setDiscountSelected}
          onApprove={approveDiscount}
        />
        ) : pageView === "handin" ? (
        <>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setCashierFilter("all");
                setLinesByCashier({});
                setExpandedId(null);
              }}
              className="h-10 w-[160px] bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Cashier
            </label>
            <Select
              value={cashierFilter}
              onValueChange={(v) => {
                setCashierFilter(v);
                setExpandedId(null);
              }}
            >
              <SelectTrigger className="h-10 w-[220px] bg-white">
                <SelectValue placeholder="All cashiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cashiers</SelectItem>
                {cashierOptions.map((c) => (
                  <SelectItem
                    key={c.cashier_user_id}
                    value={String(c.cashier_user_id)}
                  >
                    {c.cashier_name || c.cashier_user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {c.label}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {c.raw
                  ? c.value ?? 0
                  : `₦${formatNumber1(Number(c.value) || 0)}`}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredCashiers.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              {cashierOptions.length === 0
                ? "No Cashier users found for this business."
                : `No collections found for this date${
                    cashierFilter !== "all" ? " / cashier" : ""
                  }.`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Cashier</th>
                    {showCash ? (
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Cash to retire
                      </th>
                    ) : null}
                    {showCard ? (
                      <th className="px-3 py-2.5 font-semibold text-right">
                        POS to retire
                      </th>
                    ) : null}
                    {showTransfer ? (
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Transfer to retire
                      </th>
                    ) : null}
                    {showCash ? (
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Received cash
                      </th>
                    ) : null}
                    {showCard ? (
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Received POS
                      </th>
                    ) : null}
                    {showTransfer ? (
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Received transfer
                      </th>
                    ) : null}
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Credit
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Apply Deposit
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Variance
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCashiers.map((row) => {
                    const locked = isLocked(row.status);
                    const draft = drafts[row.cashier_user_id] || {};
                    const recvCash =
                      parseFloat(
                        parseNumberFromFormatted(draft.received_cash),
                      ) || 0;
                    const recvCard =
                      parseFloat(
                        parseNumberFromFormatted(draft.received_card),
                      ) || 0;
                    const recvTransfer =
                      parseFloat(
                        parseNumberFromFormatted(draft.received_transfer),
                      ) || 0;
                    const liveVariance =
                      locked && row.variance_total != null && showCash && showCard && showTransfer
                        ? Number(row.variance_total)
                        : (showCash
                            ? moneySafe(recvCash - row.expected_cash)
                            : 0) +
                          (showCard
                            ? moneySafe(recvCard - (row.expected_card || 0))
                            : 0) +
                          (showTransfer
                            ? moneySafe(recvTransfer - row.expected_transfer)
                            : 0);
                    const expanded = expandedId === row.cashier_user_id;
                    const lines = linesByCashier[row.cashier_user_id] || [];

                    return (
                      <Fragment key={row.cashier_user_id}>
                        <tr className="border-b border-slate-100 align-middle">
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-[var(--aa-accent)]"
                              onClick={() => toggleExpand(row.cashier_user_id)}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {row.cashier_name || row.cashier_user_id}
                            </button>
                          </td>
                          {showCash ? (
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            ₦{formatNumber1(row.expected_cash)}
                            {Number(row.expenses_cash) > 0 ? (
                              <div className="text-[10px] font-normal text-slate-400">
                                coll. ₦{formatNumber1(row.collected_cash)} −
                                exp. ₦{formatNumber1(row.expenses_cash)}
                              </div>
                            ) : null}
                          </td>
                          ) : null}
                          {showCard ? (
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            ₦{formatNumber1(row.expected_card || 0)}
                          </td>
                          ) : null}
                          {showTransfer ? (
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            ₦{formatNumber1(row.expected_transfer)}
                          </td>
                          ) : null}
                          {showCash ? (
                          <td className="px-3 py-2.5 text-right">
                            {locked ? (
                              <span className="tabular-nums">
                                ₦{formatNumber1(row.received_cash)}
                              </span>
                            ) : (
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="ml-auto h-8 w-[110px] text-right tabular-nums"
                                value={draft.received_cash ?? ""}
                                onChange={(e) =>
                                  updateDraft(
                                    row.cashier_user_id,
                                    "received_cash",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </td>
                          ) : null}
                          {showCard ? (
                          <td className="px-3 py-2.5 text-right">
                            {locked ? (
                              <span className="tabular-nums">
                                ₦{formatNumber1(row.received_card)}
                              </span>
                            ) : (
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="ml-auto h-8 w-[110px] text-right tabular-nums"
                                value={draft.received_card ?? ""}
                                onChange={(e) =>
                                  updateDraft(
                                    row.cashier_user_id,
                                    "received_card",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </td>
                          ) : null}
                          {showTransfer ? (
                          <td className="px-3 py-2.5 text-right">
                            {locked ? (
                              <span className="tabular-nums">
                                ₦{formatNumber1(row.received_transfer)}
                              </span>
                            ) : (
                              <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="ml-auto h-8 w-[130px] text-right tabular-nums"
                                value={draft.received_transfer ?? ""}
                                onChange={(e) =>
                                  updateDraft(
                                    row.cashier_user_id,
                                    "received_transfer",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </td>
                          ) : null}
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            ₦{formatNumber1(row.credit_total || 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            ₦{formatNumber1(row.deposit_total || 0)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                              Math.abs(liveVariance) > 0.05
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            ₦{formatNumber1(liveVariance)}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusPill status={row.status} />
                          </td>
                          <td className="px-3 py-2.5">
                            {locked ? (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                {row.confirmed_by_name || "Confirmed"}
                              </span>
                            ) : (Number(row.expected_total) || 0) > 0.05 ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-8"
                                disabled={confirmingId === row.cashier_user_id}
                                onClick={() => startConfirm(row)}
                              >
                                {confirmingId === row.cashier_user_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : showCash &&
                                  (Number(row.expected_cash) || 0) > 0.05 ? (
                                  "Move to Safe"
                                ) : (
                                  "Confirm"
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-slate-100 bg-slate-50/70">
                            <td colSpan={visibleColCount} className="px-4 py-3">
                              {linesLoading === row.cashier_user_id ? (
                                <p className="text-xs text-slate-500">
                                  Loading lines…
                                </p>
                              ) : lines.filter((line) =>
                                  visibleLine(line, reconModes),
                                ).length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No collection lines
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500">
                                      <th className="py-1 text-left font-medium">
                                        Time
                                      </th>
                                      <th className="py-1 text-left font-medium">
                                        Ref
                                      </th>
                                      <th className="py-1 text-left font-medium">
                                        Customer
                                      </th>
                                      <th className="py-1 text-left font-medium">
                                        Mode
                                      </th>
                                      <th className="py-1 text-right font-medium">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines
                                      .filter((line) =>
                                        visibleLine(line, reconModes),
                                      )
                                      .map((line) => (
                                      <tr
                                        key={line.entry_id}
                                        className="border-t border-slate-200/80"
                                      >
                                        <td className="py-1.5 text-slate-600">
                                          {moment(line.created_at).format(
                                            "HH:mm",
                                          )}
                                        </td>
                                        <td className="py-1.5">
                                          {line.sale_code || "—"}
                                        </td>
                                        <td className="py-1.5">
                                          {line.customer_name ||
                                            line.customer_no ||
                                            "—"}
                                        </td>
                                        <td className="py-1.5 capitalize">
                                          {lineModeLabel(line.payment_type)}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">
                                          ₦{formatNumber1(line.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {!locked ? (
                                <div className="mt-3 max-w-md">
                                  <label className="mb-1 block text-xs font-medium text-slate-600">
                                    Note (optional)
                                  </label>
                                  <Input
                                    value={draft.note || ""}
                                    onChange={(e) =>
                                      updateDraft(
                                        row.cashier_user_id,
                                        "note",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="e.g. short by ₦500 — IOU"
                                    className="h-8 bg-white"
                                  />
                                </div>
                              ) : row.note ? (
                                <p className="mt-2 text-xs text-slate-600">
                                  Note: {row.note}
                                </p>
                              ) : null}
                              {locked && (row.cash_transfer_id || row.safe_account) ? (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                  <p className="font-semibold text-slate-700">
                                    Cash to Safe
                                    {row.cash_transfer_id
                                      ? ` · ${row.cash_transfer_id}`
                                      : ""}
                                  </p>
                                  <p className="mt-1">
                                    {row.cash_from_account_name ||
                                      row.cash_from_account ||
                                      "Cash"}{" "}
                                    →{" "}
                                    {row.safe_account_name ||
                                      row.safe_account ||
                                      "Safe"}
                                    {row.cash_to_safe_amount
                                      ? ` · ₦${formatNumber1(row.cash_to_safe_amount)}`
                                      : ""}
                                  </p>
                                  {Math.abs(Number(row.shortage_amount) || 0) >
                                  0.05 ? (
                                    <p className="mt-1">
                                      {Number(row.shortage_amount) > 0
                                        ? "Shortage"
                                        : "Overage"}{" "}
                                      ₦
                                      {formatNumber1(
                                        Math.abs(Number(row.shortage_amount)),
                                      )}{" "}
                                      →{" "}
                                      {row.shortage_account_name ||
                                        row.shortage_account}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  From
                </label>
                <Input
                  type="date"
                  value={historyFrom}
                  onChange={(e) => setHistoryFrom(e.target.value)}
                  className="h-10 w-[160px] bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  To
                </label>
                <Input
                  type="date"
                  value={historyTo}
                  onChange={(e) => setHistoryTo(e.target.value)}
                  className="h-10 w-[160px] bg-white"
                />
              </div>
            </div>
            {historyLoading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : history.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                No cash-to-safe moves in this date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Ref</th>
                      <th className="px-3 py-2.5 font-semibold">Cashier</th>
                      <th className="px-3 py-2.5 font-semibold">From</th>
                      <th className="px-3 py-2.5 font-semibold">Safe</th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        To Safe
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Shortage
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        Shortage account
                      </th>
                      <th className="px-3 py-2.5 font-semibold">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr
                        key={row.id || row.cash_transfer_id}
                        className="border-b border-slate-100"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {row.recon_date
                            ? moment(row.recon_date).format("DD/MM/YYYY")
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">
                          {row.cash_transfer_id || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.cashier_name || row.cashier_user_id}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.cash_from_account_name ||
                            row.cash_from_account ||
                            "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.safe_account_name || row.safe_account || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          ₦{formatNumber1(row.cash_to_safe_amount || 0)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right tabular-nums ${
                            Number(row.shortage_amount) > 0.05
                              ? "text-amber-700"
                              : Number(row.shortage_amount) < -0.05
                                ? "text-emerald-700"
                                : "text-slate-500"
                          }`}
                        >
                          ₦{formatNumber1(row.shortage_amount || 0)}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.shortage_account_name ||
                            row.shortage_account ||
                            "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.confirmed_by_name || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <Dialog
          open={!!cashDialog}
          onOpenChange={(open) => {
            if (!open && confirmingId == null) setCashDialog(null);
          }}
        >
          <DialogContent className="max-w-lg sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Vault className="h-5 w-5 text-[var(--aa-accent)]" />
                Move cash to Safe
              </DialogTitle>
              <DialogDescription>
                {cashDialog?.row?.cashier_name || "Cashier"} — enter how much
                cash goes to Safe. The rest is posted as shortage.
              </DialogDescription>
            </DialogHeader>
            {cashDialog ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Cash to retire</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    ₦{formatNumber1(cashDialog.expected_cash)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Amount to Safe + shortage must equal this total.
                  </p>
                </div>

                <div>
                  <Label className="mb-1.5 text-xs font-medium text-slate-600">
                    From (cash / till){" "}
                    {cashDialog.expected_cash > 0.05 ? (
                      <span className="text-red-500">*</span>
                    ) : null}
                  </Label>
                  <AccountTypeahead
                    options={chartOfAccount}
                    value={cashDialog.cashFrom}
                    onChange={(code) =>
                      setCashDialog((prev) =>
                        prev ? { ...prev, cashFrom: code } : prev,
                      )
                    }
                    placeholder="Select cash account…"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                    <div>
                      <Label className="mb-1.5 text-xs font-medium text-slate-600">
                        Amount to Safe <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={cashDialog.to_safe_input}
                        onChange={(e) =>
                          updateTillSplit("to_safe", e.target.value)
                        }
                        onBlur={() => syncTillSplitInputs("to_safe")}
                        placeholder="0.00"
                        className="h-9 tabular-nums"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 text-xs font-medium text-slate-600">
                        To (Safe){" "}
                        {liveTillSplit.toSafe > 0.05 ? (
                          <span className="text-red-500">*</span>
                        ) : null}
                      </Label>
                      <AccountTypeahead
                        options={chartOfAccount}
                        value={cashDialog.safe}
                        onChange={(code) =>
                          setCashDialog((prev) =>
                            prev ? { ...prev, safe: code } : prev,
                          )
                        }
                        placeholder="Select Safe account…"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                    <div>
                      <Label className="mb-1.5 text-xs font-medium text-slate-600">
                        Shortage (left as short)
                      </Label>
                      <Input
                        value={cashDialog.shortage_input}
                        onChange={(e) =>
                          updateTillSplit("shortage", e.target.value)
                        }
                        onBlur={() => syncTillSplitInputs("shortage")}
                        placeholder="0.00"
                        className={`h-9 tabular-nums ${
                          liveTillSplit.shortage > 0.05 ? "text-amber-800" : ""
                        }`}
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 text-xs font-medium text-slate-600">
                        Shortage account (head){" "}
                        {liveTillSplit.shortage > 0.05 ? (
                          <span className="text-red-500">*</span>
                        ) : null}
                      </Label>
                      <AccountTypeahead
                        options={chartOfAccount}
                        value={cashDialog.shortageAccount}
                        onChange={(code) =>
                          setCashDialog((prev) =>
                            prev ? { ...prev, shortageAccount: code } : prev,
                          )
                        }
                        placeholder="Select shortage head…"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  ₦{formatNumber1(liveTillSplit.toSafe)} to Safe
                  {liveTillSplit.shortage > 0.05
                    ? ` + ₦${formatNumber1(liveTillSplit.shortage)} short`
                    : ""}{" "}
                  = ₦{formatNumber1(cashDialog.expected_cash)} to retire
                </p>

                <div>
                  <Label className="mb-1.5 text-xs font-medium text-slate-600">
                    Note (optional)
                  </Label>
                  <Input
                    value={cashDialog.note}
                    onChange={(e) =>
                      setCashDialog((prev) =>
                        prev ? { ...prev, note: e.target.value } : prev,
                      )
                    }
                    placeholder="e.g. short ₦5,000 — cashier IOU"
                    className="h-9"
                  />
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCashDialog(null)}
                disabled={!!confirmingId}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitCashDialog}
                disabled={!!confirmingId}
              >
                {confirmingId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirm & move to Safe"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function moneySafe(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function formatAmountInput(value) {
  const withoutCommas = String(value || "").replace(/,/g, "");
  const sanitizedValue = filterJournalAmountInput(withoutCommas);
  const parts = sanitizedValue.split(".");
  const numericValue =
    parts.length > 2
      ? parts[0] + "." + parts.slice(1).join("")
      : sanitizedValue;
  return formatNumberWithCommas(numericValue);
}

function parseAmountInput(value) {
  const n = parseFloat(parseNumberFromFormatted(value));
  return Number.isFinite(n) ? moneySafe(n) : 0;
}

function splitTillAmounts(expected, toSafeRaw, shortageRaw, prefer = "to_safe") {
  const expectedAmt = moneySafe(Math.max(expected, 0));
  let toSafe = parseAmountInput(toSafeRaw);
  let shortage = parseAmountInput(shortageRaw);
  if (toSafe < 0) toSafe = 0;
  if (shortage < 0) shortage = 0;
  if (prefer === "shortage") {
    if (shortage > expectedAmt) shortage = expectedAmt;
    toSafe = moneySafe(expectedAmt - shortage);
  } else {
    if (toSafe > expectedAmt) toSafe = expectedAmt;
    shortage = moneySafe(expectedAmt - toSafe);
  }
  return { expectedAmt, toSafe, shortage };
}

function DiscountApprovalPanel({
  rows,
  loading,
  submittingCode,
  selected,
  onSelect,
  onApprove,
}) {
  const totalDiscount = (rows || []).reduce(
    (sum, row) => sum + (Number(row.discount_amount) || 0),
    0,
  );
  const totalInvoice = (rows || []).reduce(
    (sum, row) => sum + (Number(row.invoice_amount ?? row.amount) || 0),
    0,
  );

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Discount awaiting approval
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            ₦{formatNumber1(totalDiscount)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Invoice total
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            ₦{formatNumber1(totalInvoice)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Invoices
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {rows?.length || 0}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading discount queue…
          </div>
        ) : !rows?.length ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            No invoices awaiting discount approval.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Invoice</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold text-right">
                    Invoice
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-right">
                    Discount
                  </th>
                  <th className="px-4 py-2.5 font-semibold">Mode</th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                  <th className="px-4 py-2.5 font-semibold text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.sale_code || row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800">
                      {row.sale_code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.customer_name || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {row.customer_no || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      ₦{formatNumber1(row.invoice_amount ?? row.amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-orange-700">
                      −₦{formatNumber1(row.discount_amount)}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {lineModeLabel(row.payment_type)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {row.createdAt || row.created_at
                        ? moment(row.createdAt || row.created_at).format(
                            "DD MMM, HH:mm",
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!!submittingCode}
                        onClick={() => onSelect(row)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !submittingCode) onSelect(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve discount</DialogTitle>
            <DialogDescription>
              Confirm this discount, then the invoice is released to
              Verification Points for collection or credit approval.
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Invoice</span>
                <span className="font-mono font-semibold">
                  {selected.sale_code}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Customer</span>
                <span className="font-medium text-right">
                  {selected.customer_name || selected.customer_no || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Invoice amount</span>
                <span className="tabular-nums font-semibold">
                  ₦{formatNumber1(selected.invoice_amount ?? selected.amount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Discount</span>
                <span className="tabular-nums font-semibold text-orange-700">
                  −₦{formatNumber1(selected.discount_amount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Payment mode</span>
                <span className="capitalize">
                  {lineModeLabel(selected.payment_type)}
                </span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onSelect(null)}
              disabled={!!submittingCode}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={!selected || !!submittingCode}
              onClick={() => selected && onApprove(selected)}
            >
              {submittingCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Approve Discount"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusPill({ status }) {
  const s = String(status || "open");
  const styles =
    s === "confirmed"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : s === "variance"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  const label =
    s === "confirmed"
      ? "Confirmed"
      : s === "variance"
        ? "Variance"
        : "Open";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}
