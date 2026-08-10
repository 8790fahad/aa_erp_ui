import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Banknote,
  Building2,
  CheckCircle2,
  History,
  Loader2,
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
import { useAdvancePaymentAccounts } from "@/components/common/useAdvancePaymentAccounts";
import { WorkflowStatusBadge } from "@/lib/saleWorkflowStatus.js";
import useScanDetection from "@/hooks/useScanDetection";

function paymentTypeLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t === "split") return "Cash + Transfer";
  if (t === "transfer" || t === "bank") return "Transfer";
  if (t === "cash") return "Cash";
  return type || "—";
}

function paymentTypeBadgeClass(type) {
  const t = String(type || "").toLowerCase();
  if (t === "split") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (t === "transfer" || t === "bank")
    return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

export default function ReceivePayment() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);

  const cashierType = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    const isCashier =
      role.includes("cashier") || role.includes("casheir");
    const ct = String(user?.cashier_type || "").toLowerCase();
    if (isCashier && (ct === "cash" || ct === "transfer")) return ct;
    return "";
  }, [user?.role, user?.cashier_type]);

  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    pending_cash: 0,
    pending_transfer: 0,
    pending_split: 0,
    pending_count: 0,
    pending_total: 0,
    collected_cash_today: 0,
    collected_transfer_today: 0,
    collected_today: 0,
  });
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const searchInputRef = useRef(null);

  const [collectOpen, setCollectOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const amountDue = Number(selected?.amount) || 0;
  const paymentType = String(selected?.payment_type || "").toLowerCase();
  const needsCash =
    paymentType === "cash" ||
    paymentType === "split" ||
    (paymentType === "" && cashierType !== "transfer");
  const needsTransfer =
    paymentType === "transfer" ||
    paymentType === "bank" ||
    paymentType === "split";

  const cashAccounts = useAdvancePaymentAccounts(
    collectOpen && needsCash,
    activeBusiness?.id,
    "cash",
  );
  const bankAccounts = useAdvancePaymentAccounts(
    collectOpen && needsTransfer,
    activeBusiness?.id,
    "bank",
  );

  const fetchDashboard = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
    });
    if (cashierType) params.set("cashierType", cashierType);
    _fetchApi(
      `/api/v1/sale-workflows/cashier-dashboard?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res?.success) {
          setPending(res.results?.pending || []);
          setHistory(res.results?.history || []);
          setSummary(
            res.results?.summary || {
              pending_cash: 0,
              pending_transfer: 0,
              pending_split: 0,
              pending_count: 0,
              pending_total: 0,
              collected_cash_today: 0,
              collected_transfer_today: 0,
              collected_today: 0,
            },
          );
        } else {
          toast.error(res?.message || "Failed to load cashier queue");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to load cashier queue");
      },
    );
  }, [activeBusiness?.id, cashierType]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!collectOpen) return;
    if (
      needsCash &&
      !cashAccounts.accountHead?.head &&
      cashAccounts.headList?.length
    ) {
      cashAccounts.setAccountHead(cashAccounts.headList[0]);
    }
  }, [
    collectOpen,
    needsCash,
    cashAccounts.accountHead?.head,
    cashAccounts.headList,
    cashAccounts.setAccountHead,
  ]);

  useEffect(() => {
    if (!collectOpen) return;
    if (
      needsTransfer &&
      !bankAccounts.bankAccount?.id &&
      bankAccounts.accountList?.length
    ) {
      bankAccounts.setBankAccount(bankAccounts.accountList[0]);
    }
  }, [
    collectOpen,
    needsTransfer,
    bankAccounts.bankAccount?.id,
    bankAccounts.accountList,
    bankAccounts.setBankAccount,
  ]);

  const viewMode = cashierType || modeFilter;

  const viewSummary = useMemo(() => {
    const fromList = (list, pred) =>
      list.reduce(
        (sum, r) => sum + (pred(String(r.payment_type || "").toLowerCase()) ? Number(r.amount) || 0 : 0),
        0,
      );

    if (viewMode === "cash") {
      return {
        showCash: true,
        showTransfer: false,
        showSplit: false,
        pending_cash: fromList(pending, (pt) => pt === "cash"),
        pending_transfer: 0,
        pending_split: fromList(pending, (pt) => pt === "split"),
        collected_cash_today: summary.collected_cash_today,
        collected_transfer_today: 0,
        pending_count: pending.filter((r) =>
          ["cash", "split"].includes(String(r.payment_type || "").toLowerCase()),
        ).length,
      };
    }
    if (viewMode === "transfer") {
      return {
        showCash: false,
        showTransfer: true,
        showSplit: false,
        pending_cash: 0,
        pending_transfer: fromList(pending, (pt) =>
          ["transfer", "bank"].includes(pt),
        ),
        pending_split: fromList(pending, (pt) => pt === "split"),
        collected_cash_today: 0,
        collected_transfer_today: summary.collected_transfer_today,
        pending_count: pending.filter((r) =>
          ["transfer", "bank", "split"].includes(
            String(r.payment_type || "").toLowerCase(),
          ),
        ).length,
      };
    }
    if (viewMode === "split") {
      return {
        showCash: false,
        showTransfer: false,
        showSplit: true,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: fromList(pending, (pt) => pt === "split"),
        collected_cash_today: summary.collected_cash_today,
        collected_transfer_today: summary.collected_transfer_today,
        pending_count: pending.filter(
          (r) => String(r.payment_type || "").toLowerCase() === "split",
        ).length,
      };
    }
    return {
      showCash: true,
      showTransfer: true,
      showSplit: false,
      pending_cash: summary.pending_cash,
      pending_transfer: summary.pending_transfer,
      pending_split: summary.pending_split,
      collected_cash_today: summary.collected_cash_today,
      collected_transfer_today: summary.collected_transfer_today,
      pending_count: summary.pending_count,
    };
  }, [viewMode, pending, summary]);

  const filteredPending = useMemo(() => {
    let list = pending;
    if (modeFilter === "cash") {
      list = list.filter((r) => String(r.payment_type).toLowerCase() === "cash");
    } else if (modeFilter === "transfer") {
      list = list.filter((r) =>
        ["transfer", "bank"].includes(String(r.payment_type).toLowerCase()),
      );
    } else if (modeFilter === "split") {
      list = list.filter(
        (r) => String(r.payment_type).toLowerCase() === "split",
      );
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.sale_code, r.customer_no, r.customer_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [pending, modeFilter, search]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter((r) =>
      [r.sale_code, r.customer_no, r.customer_name, r.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [history, search]);

  const openCollect = (row) => {
    setSelected(row);
    const due = Number(row.amount) || 0;
    const pt = String(row.payment_type || "").toLowerCase();
    if (pt === "cash") {
      setCashAmount(String(due));
      setTransferAmount("");
    } else if (pt === "transfer" || pt === "bank") {
      setCashAmount("");
      setTransferAmount(String(due));
    } else {
      const half = Number((due / 2).toFixed(2));
      setCashAmount(String(half));
      setTransferAmount(String(Number((due - half).toFixed(2))));
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
      const pendingMatch = pending.find(
        (r) => String(r.sale_code || "").toLowerCase() === needle,
      );
      if (pendingMatch) {
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
        toast.error(`No cashier invoice found for ${code}`);
      }
    },
    // openCollect only uses setters + row data; safe across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, pending],
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

  const confirmPayment = () => {
    if (!selected || !activeBusiness?.id) return;
    const cashAmt = parseFloat(String(cashAmount).replace(/,/g, "")) || 0;
    const transferAmt =
      parseFloat(String(transferAmount).replace(/,/g, "")) || 0;
    const splits = [];

    if (needsCash && cashAmt > 0) {
      if (!cashAccounts.accountHead?.head) {
        toast.error("Select a cash account");
        return;
      }
      splits.push({
        mode: "cash",
        amount: cashAmt,
        accountHead: cashAccounts.accountHead,
      });
    }
    if (needsTransfer && transferAmt > 0) {
      if (!bankAccounts.bankAccount?.id) {
        toast.error("Select a bank account");
        return;
      }
      splits.push({
        mode: "bank",
        amount: transferAmt,
        bankAccount: bankAccounts.bankAccount,
      });
    }

    if (!splits.length) {
      toast.error("Enter cash and/or transfer amount");
      return;
    }

    const total = splits.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (Math.abs(total - amountDue) > 0.05) {
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
        cashier_type: cashierType || undefined,
        payment_splits: splits,
        note: `Collected at Cashier Point`,
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          toast.success(res.message || "Payment confirmed");
          closeCollect();
          fetchDashboard();
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

  return (
    <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Cashier Point
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Collect invoice payments by mode — cash, transfer, or both.
              {cashierType ? (
                <span className="ml-1 font-medium text-[var(--aa-navy)]">
                  You are a {cashierType === "transfer" ? "Transfer" : "Cash"}{" "}
                  cashier.
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchDashboard}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Summary cards — follow Cash / Transfer / All filter */}
        <div
          className={`grid gap-3 sm:grid-cols-2 ${
            viewMode === "all" || viewMode === "split"
              ? "xl:grid-cols-4"
              : "xl:grid-cols-2"
          }`}
        >
          {viewSummary.showCash ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Banknote className="h-4 w-4 text-emerald-600" />
                Cash to collect
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_cash)}
              </p>
              {viewMode === "all" && viewSummary.pending_split > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  Split invoices: ₦{formatNumber1(viewSummary.pending_split)}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Awaiting cash payment</p>
              )}
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
                {viewMode === "all" && viewSummary.pending_split > 0
                  ? `Split invoices: ₦${formatNumber1(viewSummary.pending_split)}`
                  : "Awaiting bank transfer"}
              </p>
            </div>
          ) : null}

          {viewSummary.showSplit ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Split className="h-4 w-4 text-violet-600" />
                Split to collect
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_split)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Cash + transfer invoices
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

          {viewMode === "split" ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Cash collected today
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
                  ₦{formatNumber1(viewSummary.collected_cash_today)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <Building2 className="h-4 w-4 text-sky-600" />
                  Transfer collected today
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-sky-700">
                  ₦{formatNumber1(viewSummary.collected_transfer_today)}
                </p>
              </div>
            </>
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

            {activeTab === "pending" && !cashierType ? (
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)]"
              >
                <option value="all">All modes</option>
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="split">Cash + Transfer</option>
              </select>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading cashier queue…
            </div>
          ) : activeTab === "pending" ? (
            filteredPending.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-slate-500">
                No invoices awaiting payment
                {cashierType
                  ? ` for ${cashierType === "transfer" ? "transfer" : "cash"}`
                  : ""}
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
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          <Link
                            to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                              row.sale_code,
                            )}`}
                            className="text-[var(--aa-accent)] hover:underline"
                            title="Open invoice PDF"
                          >
                            {row.sale_code}
                          </Link>
                          <div className="mt-1.5">
                            <WorkflowStatusBadge
                              status={row.status}
                              paymentType={row.payment_type}
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
                              row.payment_type,
                            )}`}
                          >
                            {String(row.payment_type).toLowerCase() ===
                            "split" ? (
                              <Split className="h-3 w-3" />
                            ) : null}
                            {paymentTypeLabel(row.payment_type)}
                          </span>
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
                          <button
                            type="button"
                            onClick={() => openCollect(row)}
                            className="rounded-md bg-[var(--aa-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--aa-accent-hover)]"
                          >
                            Collect Payment
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredHistory.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-slate-500">
              No confirmed payments yet.
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
                  {filteredHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        <Link
                          to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                            row.sale_code,
                          )}`}
                          className="text-[var(--aa-accent)] hover:underline"
                          title="Open invoice PDF"
                        >
                          {row.sale_code}
                        </Link>
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
                          {paymentTypeLabel(row.payment_type)}
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
                        {row.updatedAt
                          ? moment(row.updatedAt).format("DD MMM, HH:mm")
                          : "—"}
                      </td>
                    </tr>
                  ))}
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
            </div>

            {needsCash ? (
              <div className="space-y-2">
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
                  disabled={paymentType === "cash"}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)] disabled:bg-slate-50"
                  placeholder="0.00"
                />
                <label className="text-sm font-medium text-slate-700">
                  Cash account
                </label>
                <select
                  value={cashAccounts.accountHead?.head || ""}
                  onChange={(e) => {
                    const head = cashAccounts.headList.find(
                      (h) => String(h.head) === e.target.value,
                    );
                    cashAccounts.setAccountHead(head || {});
                  }}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)]"
                >
                  <option value="">Select cash account</option>
                  {(cashAccounts.headList || []).map((h) => (
                    <option key={h.head} value={h.head}>
                      {h.description || h.head} ({h.head})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {needsTransfer ? (
              <div className="space-y-2">
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
                  disabled={
                    paymentType === "transfer" || paymentType === "bank"
                  }
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)] disabled:bg-slate-50"
                  placeholder="0.00"
                />
                <label className="text-sm font-medium text-slate-700">
                  Bank account
                </label>
                <select
                  value={bankAccounts.bankAccount?.id || ""}
                  onChange={(e) => {
                    const bank = bankAccounts.accountList.find(
                      (b) => String(b.id) === e.target.value,
                    );
                    bankAccounts.setBankAccount(bank || null);
                  }}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)]"
                >
                  <option value="">Select bank account</option>
                  {(bankAccounts.accountList || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.account_name || b.bank_name || b.head} (
                      {b.account_number || b.head})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {paymentType === "split" ? (
              <p
                className={`text-xs ${
                  Math.abs(splitHintTotal - amountDue) <= 0.05
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                Entered total: ₦{formatNumber1(splitHintTotal)} / due ₦
                {formatNumber1(amountDue)}
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
              Confirm Payment
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
