import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Nfc,
  Eye,
  History,
  Landmark,
  Loader2,
  Lock,
  Percent,
  Plus,
  RefreshCw,
  Receipt,
  ScanLine,
  Search,
  Split,
  Wallet,
  ChevronRight,
} from "lucide-react";
import moment from "moment";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { hasFullAccess } from "@/lib/access";
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
import CreateImprestDrawer from "@/components/common/CreateImprestDrawer";
import RecordSupplierPaymentForm from "@/components/pages/payments/RecordSupplierPaymentForm";

const cashPayThroughLabel = (option) =>
  `${option?.description || option?.head || ""} (${option?.head || ""})`.trim();

const bankPayThroughLabel = (option) => {
  const name = option?.account_name || option?.bank_name || option?.head || "";
  const num = option?.account_number || option?.head || "";
  return num ? `${name} (${num})` : String(name);
};

function tillPayBillMode(tab) {
  if (tab === "transfer") return "bank";
  if (tab === "card") return "card";
  return "cash";
}

function TillSummaryCard({
  modeLabel,
  icon: Icon,
  iconClass,
  amountClass,
  retire,
  onOpen,
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:border-[var(--aa-accent)] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          {modeLabel} to retire
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--aa-navy)]">
          Open till
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${amountClass}`}>
        ₦{formatNumber1(retire)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Tap to open till
      </p>
    </button>
  );
}

function TillLine({ label, value, onClick, tone = "neutral", prefix = "" }) {
  const isTotal = tone === "total";
  const valueClass = isTotal
    ? "font-semibold text-emerald-700"
    : tone === "minus"
      ? "font-medium text-slate-700"
      : "font-medium text-slate-900";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-baseline justify-between gap-4 py-1.5 text-sm ${
        onClick
          ? "-mx-1 rounded-md px-1 text-left hover:bg-slate-100"
          : ""
      }`}
    >
      <span
        className={`inline-flex items-center gap-1 ${
          isTotal ? "font-semibold text-slate-800" : "text-slate-600"
        }`}
      >
        {label}
        {onClick ? <History className="h-3.5 w-3.5 text-slate-400" /> : null}
      </span>
      <span className={`tabular-nums ${valueClass}`}>
        {prefix}
        ₦{formatNumber1(value)}
      </span>
    </Comp>
  );
}

function TillSpendButton({ title, icon: Icon, allowed, onClick }) {
  return (
    <button
      type="button"
      onClick={allowed ? onClick : undefined}
      disabled={!allowed}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
        allowed
          ? "border-slate-200 bg-white text-slate-800 hover:border-[var(--aa-accent)] hover:bg-slate-50"
          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
      }`}
    >
      {allowed ? (
        <Icon className="h-4 w-4" />
      ) : (
        <Lock className="h-3.5 w-3.5" />
      )}
      {title}
    </button>
  );
}

function TillHubDialog({
  open,
  onOpenChange,
  modeLabel,
  collect,
  collected,
  retire,
  expenses,
  imprestTotal,
  payBillTotal,
  pendingCount,
  canImprest,
  canPayBill,
  onImprest,
  onPayBill,
  onViewCollected,
}) {
  const showCollect = Number(collect) > 0.005 || Number(pendingCount) > 0;
  const spendOver =
    Number(expenses) - Number(collected) > 0.005
      ? Number(expenses) - Number(collected)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>{modeLabel} till</DialogTitle>
          <DialogDescription>
            Collections minus Imprest and Pay Bill.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 px-3 py-2">
          {showCollect ? (
            <TillLine
              label={`To collect${pendingCount ? ` (${pendingCount})` : ""}`}
              value={collect}
            />
          ) : null}
          <TillLine
            label="Collected today"
            value={collected}
            onClick={onViewCollected}
          />
          <TillLine
            label="Imprest"
            value={imprestTotal}
            tone="minus"
            prefix="− "
          />
          <TillLine
            label="Pay Bill"
            value={payBillTotal}
            tone="minus"
            prefix="− "
          />
          <div className="mt-1 border-t border-slate-200 pt-1">
            <TillLine
              label={`${modeLabel} to retire`}
              value={retire}
              tone="total"
            />
          </div>
          {spendOver > 0 ? (
            <p className="pb-1 text-[11px] text-slate-500">
              Spend exceeds collections by ₦{formatNumber1(spendOver)} — retire
              is ₦0.00.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <TillSpendButton
            title="Imprest"
            icon={Receipt}
            allowed={canImprest}
            onClick={onImprest}
          />
          <TillSpendButton
            title="Pay Bill"
            icon={Landmark}
            allowed={canPayBill}
            onClick={onPayBill}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
    id: "card",
    label: "POS",
    icon: Nfc,
    privilege: "Card Collection",
  },
  {
    id: "credit",
    label: "Credit",
    icon: CreditCard,
    privilege: "Credit Collection",
  },
  {
    id: "deposit",
    label: "Apply Deposit",
    icon: Wallet,
    privilege: "Apply Deposit",
  },
  {
    id: "discount",
    label: "Discount",
    icon: Percent,
    privilege: "Discount Collection",
  },
  {
    id: "mode",
    label: "Mode Switch",
    icon: ArrowRightLeft,
    privilege: "Switch Payment Mode",
  },
];

/** Status chip under the invoice number follows the active Verification Points tab. */
function tabWorkflowBadge(methodTab, row) {
  if (methodTab === "cash") return { label: "Cash", paymentType: "cash" };
  if (methodTab === "transfer")
    return { label: "Transfer", paymentType: "transfer" };
  if (methodTab === "card") return { label: "POS", paymentType: "card" };
  if (methodTab === "credit") return { label: "Credit", paymentType: "credit" };
  if (methodTab === "deposit")
    return { label: "Apply deposit", paymentType: "deposit" };
  return {
    label: undefined,
    paymentType:
      row?.payment_type ||
      (row?.status === "awaiting_credit_approval" ? "credit" : undefined),
  };
}

const SWITCH_PAYMENT_MODE_PRIVILEGE = "Switch Payment Mode";
const APPROVE_PAYMENT_MODE_PRIVILEGE = "Approve Payment Mode Switch";

const MAKE_DEPOSIT_PRIVILEGE = "Make Deposit";
const RECONCILIATION_PRIVILEGE = "Collection Reconciliation";
const IMPREST_PRIVILEGE = "Imprest";
const PAY_BILL_PRIVILEGE = "Pay Bill";

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
  if (t === "deposit" || t === "apply_deposit" || t === "apply deposit")
    return "deposit";
  if (t === "transfer") return "transfer";
  if (t === "card") return "card";
  if (t === "cash") return "cash";
  return t || "cash";
}

const PAYMENT_MODE_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "transfer", label: "Transfer", icon: Building2 },
  { value: "card", label: "POS", icon: Nfc },
  { value: "split", label: "Transfer + Cash", icon: Split },
  { value: "credit", label: "Credit", icon: CreditCard },
  { value: "credit_split", label: "Credit + Cash + Transfer", icon: Wallet },
  { value: "deposit", label: "Apply Deposit", icon: Wallet },
];

const MODE_LABELS = {
  cash: "Cash",
  transfer: "Transfer",
  card: "POS",
  credit: "Credit",
  deposit: "Apply Deposit",
};

function paymentTypeLabel(type, row = null) {
  const modes = row ? rowPaymentModes(row) : [];
  const named = ["cash", "transfer", "card", "credit", "deposit"].filter((id) =>
    modes.includes(id),
  );
  if (named.length > 1) {
    return named.map((id) => MODE_LABELS[id]).join(" + ");
  }
  if (row?.credit_after_deposit) return "Apply Deposit + Credit";
  if (row?.collect_after_deposit) return "Apply Deposit + Cash/Transfer";
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
  if (t === "card") return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  if (t === "credit") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (t === "deposit") return "bg-teal-50 text-teal-700 ring-teal-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

const AWAITING_CREDIT_STATUSES = new Set(["awaiting_credit_approval"]);
const CREDITED_STATUSES = new Set([
  "credit_approved",
  "invoice_separation",
  "final_invoice",
  "warehouse_picking",
  "dual_signature",
  "goods_released",
  "completed",
  "payment_confirmed",
]);

function isAwaitingCreditRow(row) {
  return AWAITING_CREDIT_STATUSES.has(String(row?.status || "").toLowerCase());
}

function isCreditedRow(row) {
  return CREDITED_STATUSES.has(String(row?.status || "").toLowerCase());
}

/** True only for Apply Deposit workflows — not Credit / Credit+Cash+Transfer. */
function isDepositWorkflowRow(row) {
  const pt = normalizePaymentMode(row?.payment_type);
  return (
    pt === "deposit" ||
    Boolean(row?.deposit_pending) ||
    Boolean(row?.credit_after_deposit) ||
    Boolean(row?.collect_after_deposit)
  );
}

/** Verification Points Credit tab: deposit invoices that still need apply-then-credit. */
function isCreditPlusDepositRow(row) {
  if (!row || !isDepositWorkflowRow(row)) return false;
  const modes = rowPaymentModes(row);
  if (row.credit_after_deposit || modes.includes("credit")) return true;
  if (modes.includes("cash") || modes.includes("transfer") || modes.includes("card")) return false;
  if (row.deposit_pending) return true;
  if (Number(row.credit_remainder) > 0.05) return true;
  const due = Number(row.amount) || 0;
  const dep = Number(row.deposit_available) || 0;
  return due - dep > 0.05;
}

/** Deposit invoices that also selected Cash and/or Transfer. */
function isCollectionPlusDepositRow(row, method) {
  if (!row || !isDepositWorkflowRow(row)) return false;
  if (String(row.status || "").toLowerCase() === "awaiting_credit_approval") {
    return false;
  }
  if (collectionSideDone(row, method)) return false;
  const modes = rowPaymentModes(row);
  if (method === "cash") {
    if (modes.includes("cash")) return true;
    return Boolean(row.collect_after_deposit) && !modes.includes("transfer") && !modes.includes("card");
  }
  if (method === "transfer") return modes.includes("transfer");
  if (method === "card") return modes.includes("card");
  return false;
}

function isDepositPendingCollection(row, method) {
  return isCollectionPlusDepositRow(row, method);
}

function isCreditAvailabilityRow(row) {
  if (!row || isDepositPendingCredit(row)) return false;
  const pt = normalizePaymentMode(row.payment_type);
  const status = String(row.status || "").toLowerCase();
  return (
    status === "awaiting_credit_approval" ||
    pt === "credit" ||
    pt === "credit_split"
  );
}

function isDepositPendingCredit(row) {
  if (
    String(row?.status || "").toLowerCase() === "awaiting_credit_approval"
  ) {
    return false;
  }
  return isCreditPlusDepositRow(row);
}

function creditStateLabel(row) {
  if (isDepositPendingCredit(row)) {
    return paymentTypeLabel(row.payment_type, row);
  }
  if (isAwaitingCreditRow(row)) return "Awaiting credit";
  if (normalizePaymentMode(row?.payment_type) === "credit_split") {
    return "Confirm credit";
  }
  if (isCreditedRow(row)) return "Credited";
  return "Awaiting credit";
}

function depositApplyPreview(row) {
  const due = Number(row?.amount) || 0;
  const available = Number(row?.deposit_available) || 0;
  const apply = Math.min(Math.max(0, due), Math.max(0, available));
  return { due, available, apply };
}

function collectModeIds(row) {
  return ["cash", "transfer", "card", "credit", "deposit"].filter((id) =>
    rowPaymentModes(row).includes(id),
  );
}

function collectionSideDone(row, method) {
  const p = row?.split_progress || {};
  if (method === "cash") {
    if (Boolean(p.cash_done) || Number(p.cash) > 0.05) return true;
  } else if (method === "transfer") {
    if (Boolean(p.transfer_done) || Number(p.transfer) > 0.05) return true;
  } else if (method === "card") {
    if (Boolean(p.card_done) || Number(p.card) > 0.05) return true;
  } else if (method === "credit") {
    if (Number(p.credit_allocated) > 0.05) return true;
  } else if (method === "deposit") {
    if (Number(p.deposit_applied) > 0.05) return true;
  }
  const history = Array.isArray(row?.history) ? row.history : [];
  if (method === "deposit") {
    return history.some((h) => Number(h?.deposit_application?.amount) > 0.05);
  }
  if (method === "credit") {
    return history.some((h) => Number(h?.credit_allocation?.amount) > 0.05);
  }
  return history.some((h) => {
    const side = String(h?.collection?.side || "").toLowerCase();
    const amt = Number(h?.collection?.amount) || 0;
    if (amt <= 0.05) return false;
    if (method === "transfer") return side === "transfer" || side === "bank";
    return side === method;
  });
}

/** Two or more modes → collect any portion; last completing payment opens print. */
function rowCollectsAsSplit(row) {
  if (!row) return false;
  const pt = String(row.payment_type || "")
    .toLowerCase()
    .trim();
  if (isSplitPaymentType(pt)) return true;
  if (collectModeIds(row).length > 1) return true;
  if (pt === "deposit" || pt === "apply_deposit" || pt === "apply deposit") {
    const modes = rowPaymentModes(row);
    return (
      modes.includes("cash") ||
      modes.includes("transfer") ||
      modes.includes("card") ||
      modes.includes("credit")
    );
  }
  return false;
}

function unappliedDepositCover(row) {
  if (!row) return 0;
  if ((Number(row.split_progress?.deposit_applied) || 0) > 0.05) return 0;
  if (!rowPaymentModes(row).includes("deposit")) return 0;
  return Math.max(0, Number(row.deposit_available) || 0);
}

const MODE_BREAKDOWN_ORDER = ["cash", "transfer", "card", "deposit", "credit"];

function fallbackModeIds(row) {
  const pt = normalizePaymentMode(row?.payment_type);
  if (pt === "credit_split") return ["cash", "transfer", "credit"];
  if (pt === "split") return ["cash", "transfer"];
  if (MODE_LABELS[pt]) return [pt];
  return [];
}

/** Per-mode amounts for the Verification Points list (collected, or expected). */
function rowPaymentModeBreakdown(row) {
  if (!row) return [];
  const selected = collectModeIds(row);
  const ids = selected.length ? selected : fallbackModeIds(row);
  if (!ids.length) return [];

  const ordered = MODE_BREAKDOWN_ORDER.filter((id) => ids.includes(id));
  const sp = row.split_progress || {};
  const due = Number(row.amount) || 0;
  const cash = Number(sp.cash) || 0;
  const transfer = Number(sp.transfer) || 0;
  const card = Number(sp.card) || 0;
  const depositApplied = Number(sp.deposit_applied) || 0;
  const depositExpected = Math.min(unappliedDepositCover(row), due);
  const depositAmt =
    depositApplied > 0.05 ? depositApplied : depositExpected;
  const creditKnown = Number(sp.credit_allocated) || 0;

  return ordered.map((id) => {
    let amount = 0;
    if (id === "cash") amount = cash;
    else if (id === "transfer") amount = transfer;
    else if (id === "card") amount = card;
    else if (id === "deposit") amount = depositAmt;
    else if (id === "credit") {
      amount = creditKnown;
    }
    if (ordered.length === 1 && amount <= 0.05) amount = due;
    const collected =
      (id === "cash" && cash > 0.05) ||
      (id === "transfer" && transfer > 0.05) ||
      (id === "card" && card > 0.05) ||
      (id === "deposit" && depositApplied > 0.05) ||
      (id === "credit" &&
        (Number(sp.credit_allocated) > 0.05 || Number(sp.credit) > 0.05));
    return {
      id,
      label: MODE_LABELS[id] || id,
      amount: Number(amount.toFixed(2)),
      collected,
    };
  });
}

function PaymentModeBreakdown({ row, className = "" }) {
  const items = rowPaymentModeBreakdown(row);
  if (!items.length) return null;
  return (
    <div className={`space-y-0.5 text-[11px] leading-snug ${className}`}>
      {items.map((item) => (
        <div key={item.id} className="tabular-nums text-slate-600">
          <span className="text-slate-500">{item.label}:</span>{" "}
          <span
            className={
              item.amount > 0.05
                ? item.collected
                  ? "font-medium text-emerald-700"
                  : "font-medium text-slate-800"
                : "font-medium text-amber-700"
            }
          >
            ₦{formatNumber1(item.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function rowPaymentModes(row) {
  const top = Array.isArray(row?.payment_modes) ? row.payment_modes : [];
  if (top.length) {
    return top
      .map((m) => String(m || "").toLowerCase().trim())
      .filter(Boolean);
  }
  const history = Array.isArray(row?.history) ? row.history : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const raw = history[i]?.payment_modes;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((m) => String(m || "").toLowerCase().trim()).filter(Boolean);
    }
  }
  const pt = normalizePaymentMode(row?.payment_type);
  if (pt === "deposit") {
    const extra = [];
    if (row?.collect_after_deposit) extra.push("cash");
    if (row?.credit_after_deposit) extra.push("credit");
    return ["deposit", ...extra];
  }
  if (pt === "credit") return ["credit"];
  if (pt === "credit_split") return ["credit", "cash", "transfer"];
  if (pt === "split") return ["cash", "transfer"];
  if (pt === "transfer") return ["transfer"];
  if (pt === "card") return ["card"];
  if (pt === "cash") return ["cash"];
  return [];
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    _postApi(
      url,
      body,
      (res) => {
        if (res?.success) resolve(res);
        else reject(new Error(res?.error || res?.message || "Request failed"));
      },
      (err) => reject(new Error(err?.message || "Request failed")),
    );
  });
}

function creditStateBadgeClass(row) {
  if (isDepositPendingCredit(row))
    return paymentTypeBadgeClass(row.payment_type, row);
  if (isAwaitingCreditRow(row))
    return "bg-amber-50 text-amber-800 ring-amber-200";
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

function snapshotInvoiceRow(row) {
  if (!row) return null;
  const sale_code = String(row.sale_code || "").trim();
  if (!sale_code) return null;
  return {
    ...row,
    id: row.id,
    sale_code,
    history: Array.isArray(row.history)
      ? row.history.map((h) => (h && typeof h === "object" ? { ...h } : h))
      : [],
    payment_modes: Array.isArray(row.payment_modes)
      ? [...row.payment_modes]
      : row.payment_modes,
    split_progress:
      row.split_progress && typeof row.split_progress === "object"
        ? { ...row.split_progress }
        : row.split_progress,
  };
}

function isRowCreatedOn(row, ymd) {
  const raw = row?.created_at || row?.createdAt;
  if (!raw || !ymd) return false;
  const m = moment(raw);
  return m.isValid() && m.format("YYYY-MM-DD") === ymd;
}

/** Cash / Transfer / Card / Credit tabs — credit_split appears on matching sides. */
function matchesMethod(paymentType, method, row = null) {
  const modes = row ? rowPaymentModes(row) : [];
  const pt = normalizePaymentMode(paymentType);
  const legacySplit = (pt === "split" || pt === "credit_split") && !modes.length;
  if (method === "card") {
    if (modes.includes("card")) return true;
    return pt === "card";
  }
  if (method === "transfer") {
    if (modes.includes("transfer")) return true;
    if (modes.length) return false;
    return pt === "transfer" || legacySplit;
  }
  if (method === "cash") {
    if (modes.includes("cash")) return true;
    if (modes.length) return false;
    return pt === "cash" || legacySplit;
  }
  if (method === "credit") return pt === "credit_split";
  if (method === "credit_approval") return pt === "credit";
  if (method === "deposit") return pt === "deposit";
  if (method === "discount") {
    return (
      Boolean(row?.has_discount) ||
      Number(row?.discount_amount) > 0 ||
      (Array.isArray(row?.history) &&
        row.history.some((h) =>
          String(h?.note || "")
            .toLowerCase()
            .includes("discount approved"),
        ))
    );
  }
  if (method === "mode") {
    return (
      row?.status === "awaiting_payment_mode_approval" ||
      Boolean(row?.proposed_payment_type) ||
      Boolean(row?.pending_payment_mode)
    );
  }
  return false;
}

/** Show a mixed invoice on a tab only while that side is still unpaid. */
function needsCollectionSide(row, method) {
  if (!rowCollectsAsSplit(row)) return true;
  const due = Number(row?.amount) || 0;
  const collected = Number(row?.split_progress?.collected_total) || 0;
  const creditAlloc = Number(row?.split_progress?.credit_allocated) || 0;
  const remaining = Number((due - collected - creditAlloc).toFixed(2));
  if (remaining <= 0.05) return false;
  if (method === "cash" || method === "transfer" || method === "card") {
    return !collectionSideDone(row, method);
  }
  if (method === "credit") return !collectionSideDone(row, "credit");
  return true;
}

export default function ReceivePayment() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const hasFullCollectionAccess =
    hasFullAccess(functionalities) || !functionalities.length;
  const canSwitchPaymentMode =
    hasFullCollectionAccess ||
    functionalities.includes(SWITCH_PAYMENT_MODE_PRIVILEGE);
  const canApprovePaymentMode =
    hasFullCollectionAccess ||
    functionalities.includes(APPROVE_PAYMENT_MODE_PRIVILEGE);

  const canUseHeaderAction = useCallback(
    (privilege) => {
      if (hasFullCollectionAccess) return true;
      return functionalities.includes(privilege);
    },
    [functionalities, hasFullCollectionAccess],
  );

  const canViewCollectionTab = useCallback(
    (privilege) => {
      if (hasFullAccess(functionalities) || !functionalities.length)
        return true;

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

      return false;
    },
    [functionalities],
  );

  const visibleMethodTabs = useMemo(
    () =>
      METHOD_TABS.filter((t) => {
        if (t.id === "mode") {
          return canSwitchPaymentMode || canApprovePaymentMode;
        }
        return canViewCollectionTab(t.privilege);
      }),
    [canViewCollectionTab, canSwitchPaymentMode, canApprovePaymentMode],
  );

  const [methodTab, setMethodTab] = useState(() => {
    const q = String(searchParams.get("tab") || "").toLowerCase();
    if (q === "deposit" || q === "credit") return q;
    if (q === "credit_approval") return "credit";
    if (String(location.pathname || "").includes("credit-approval"))
      return "credit";
    return "cash";
  });
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const todayYmd = moment().format("YYYY-MM-DD");
  const [historyFrom, setHistoryFrom] = useState(todayYmd);
  const [historyTo, setHistoryTo] = useState(todayYmd);
  const [pending, setPending] = useState([]);
  const [creditPending, setCreditPending] = useState([]);
  const [depositPending, setDepositPending] = useState([]);
  const [discountPending, setDiscountPending] = useState([]);
  const [modePending, setModePending] = useState([]);
  const [history, setHistory] = useState([]);
  const pendingToday = useMemo(
    () => pending.filter((r) => isRowCreatedOn(r, todayYmd)),
    [pending, todayYmd],
  );
  const creditPendingToday = useMemo(
    () => creditPending.filter((r) => isRowCreatedOn(r, todayYmd)),
    [creditPending, todayYmd],
  );
  const depositPendingToday = useMemo(
    () => depositPending.filter((r) => isRowCreatedOn(r, todayYmd)),
    [depositPending, todayYmd],
  );
  const discountPendingToday = useMemo(
    () => discountPending.filter((r) => isRowCreatedOn(r, todayYmd)),
    [discountPending, todayYmd],
  );
  const modePendingToday = useMemo(
    () => modePending.filter((r) => isRowCreatedOn(r, todayYmd)),
    [modePending, todayYmd],
  );
  const [imprestOpen, setImprestOpen] = useState(false);
  const [tillHubOpen, setTillHubOpen] = useState(false);
  const [payBillOpen, setPayBillOpen] = useState(false);
  const [expenseList, setExpenseList] = useState([]);
  const [summary, setSummary] = useState({
    pending_cash: 0,
    pending_transfer: 0,
    pending_split: 0,
    pending_credit: 0,
    pending_deposit: 0,
    pending_discount: 0,
    pending_mode: 0,
    pending_count: 0,
    pending_total: 0,
    collected_cash_today: 0,
    collected_transfer_today: 0,
    collected_today: 0,
    approved_credit_today: 0,
    approved_credit_count_today: 0,
    applied_deposit_today: 0,
    applied_deposit_count_today: 0,
    history_from: todayYmd,
    history_to: todayYmd,
  });
  const [search, setSearch] = useState("");
  const searchInputRef = useRef(null);
  const treatingInvoiceRef = useRef(null);
  const hubInvoiceRequestRef = useRef(0);

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
  const [depositConfirmRow, setDepositConfirmRow] = useState(null);
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const collectOpen =
    hubOpen && (hubAction === "collect" || hubAction === "deposit");

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
  const selectedModes = selected ? rowPaymentModes(selected) : [];
  const isSplit = rowCollectsAsSplit(selected);
  const isCreditSplitHub =
    normalizePaymentMode(paymentType) === "credit_split" ||
    (paymentType === "deposit" && selectedModes.includes("credit"));
  const awaitingCollection = [
    "awaiting_cashier_confirm",
    "awaiting_payment",
  ].includes(String(selected?.status || "").toLowerCase());
  // Split invoices: show only the active tab’s side (cash person vs transfer person)
  const collectionSide = isSplit
    ? methodTab === "card"
      ? "card"
      : methodTab === "transfer"
        ? "transfer"
        : "cash"
    : methodTab === "card"
      ? "card"
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
  const showCardFields =
    paymentType === "card" || (isSplit && collectionSide === "card");
  const isCashOnly = paymentType === "cash" || (isSplit && collectionSide === "cash");
  const isTransferOnly =
    paymentType === "transfer" ||
    paymentType === "bank" ||
    (isSplit && collectionSide === "transfer");
  const isCardOnly =
    paymentType === "card" || (isSplit && collectionSide === "card");
  const splitProgress = selected?.split_progress || null;
  const remainingDue = isSplit
    ? Number(
        Math.max(
          0,
          amountDue -
            (Number(splitProgress?.collected_total) || 0) -
            (Number(splitProgress?.credit_allocated) || 0),
        ).toFixed(2),
      )
    : amountDue;
  const depositCover = unappliedDepositCover(selected);
  const suggestedPortion = isSplit
    ? Number(Math.max(0, remainingDue - depositCover).toFixed(2))
    : remainingDue;
  const unpaidBeforeCredit = isSplit
    ? Number(
        (
          amountDue - (Number(splitProgress?.collected_total) || 0)
        ).toFixed(2),
      )
    : amountDue;

  const loadCashPayThrough =
    (collectOpen && showCashFields) ||
    (advanceOpen && (advanceMode === "cash" || advanceMode === "split"));
  const loadBankPayThrough =
    (collectOpen && (showTransferFields || showCardFields)) ||
    (advanceOpen &&
      (advanceMode === "transfer" || advanceMode === "split"));

  const cashAccounts = useAdvancePaymentAccounts(
    loadCashPayThrough,
    activeBusiness?.id,
    "cash",
  );
  const bankAccounts = useAdvancePaymentAccounts(
    loadBankPayThrough,
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
          setDepositPending(res.results?.deposit_pending || []);
          setDiscountPending(res.results?.discount_pending || []);
          setModePending(res.results?.mode_pending || []);
          setHistory(res.results?.history || []);
          setSummary(
            res.results?.summary || {
              pending_cash: 0,
              pending_transfer: 0,
              pending_split: 0,
              pending_credit: 0,
              pending_deposit: 0,
              pending_discount: 0,
              pending_mode: 0,
              pending_count: 0,
              pending_total: 0,
              collected_cash_today: 0,
              collected_transfer_today: 0,
              collected_today: 0,
              approved_credit_today: 0,
              approved_credit_count_today: 0,
              applied_deposit_today: 0,
              applied_deposit_count_today: 0,
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

  useEffect(() => {
    if (!imprestOpen || !activeBusiness?.id || expenseList.length) return;
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp?.success) {
          setExpenseList(
            (resp.results || []).map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
              account_type: item.account_type || "",
              show: item.show || "",
            })),
          );
        }
      },
      () => {},
    );
  }, [imprestOpen, activeBusiness?.id, expenseList.length]);

  // Cash + Transfer: always start amounts at empty when opening collect
  useEffect(() => {
    if (!collectOpen || !selected) return;
    if (!isSplitPaymentType(selected.payment_type)) return;
    setCashAmount("");
    setTransferAmount("");
  }, [collectOpen, selected?.sale_code, selected?.payment_type]);

  // Prefill Apply Deposit with available balance when the hub opens.
  useEffect(() => {
    if (!hubOpen || hubAction !== "deposit" || !selected) return;
    const due = Number(selected.amount) || 0;
    const available = Number(selected.deposit_available) || 0;
    const preset = Math.min(Math.max(0, due), Math.max(0, available));
    if (preset <= 0.05) return;
    setDepositAmount((prev) => {
      if (String(prev || "").trim() !== "" && parseFormattedAmount(prev) > 0.05) {
        return prev;
      }
      return formatNumberWithCommas(String(preset));
    });
  }, [
    hubOpen,
    hubAction,
    selected?.sale_code,
    selected?.amount,
    selected?.deposit_available,
  ]);

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
        showCardFields ||
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
    showCardFields,
    bankAccounts.bankAccount?.id,
    bankAccounts.accountList,
    bankAccounts.setBankAccount,
  ]);

  const viewSummary = useMemo(() => {
    const sumAmounts = (list) =>
      list.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const cashQueue = [
      ...pendingToday.filter(
        (r) =>
          matchesMethod(r.payment_type, "cash", r) && needsCollectionSide(r, "cash"),
      ),
      ...depositPendingToday.filter((r) => isCollectionPlusDepositRow(r, "cash")),
    ];
    const transferQueue = [
      ...pendingToday.filter(
        (r) =>
          matchesMethod(r.payment_type, "transfer", r) &&
          needsCollectionSide(r, "transfer"),
      ),
      ...depositPendingToday.filter((r) =>
        isCollectionPlusDepositRow(r, "transfer"),
      ),
    ];
    const cardQueue = [
      ...pendingToday.filter(
        (r) =>
          matchesMethod(r.payment_type, "card", r) &&
          needsCollectionSide(r, "card"),
      ),
      ...depositPendingToday.filter((r) => isCollectionPlusDepositRow(r, "card")),
    ];

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
        expenses_today: Number(summary.expenses_cash_today) || 0,
        imprest_today: Number(summary.imprest_cash_today) || 0,
        pay_bills_today: Number(summary.pay_bills_cash_today) || 0,
        retire_today: Number(
          summary.retire_cash_today ??
            Math.max(
              0,
              (Number(summary.collected_cash_today) || 0) -
                (Number(summary.expenses_cash_today) || 0),
            ),
        ),
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
        expenses_today: Number(summary.expenses_transfer_today) || 0,
        imprest_today: Number(summary.imprest_transfer_today) || 0,
        pay_bills_today: Number(summary.pay_bills_transfer_today) || 0,
        retire_today: Number(
          summary.retire_transfer_today ??
            Math.max(
              0,
              (Number(summary.collected_transfer_today) || 0) -
                (Number(summary.expenses_transfer_today) || 0),
            ),
        ),
        pending_count: transferQueue.length,
      };
    }
    if (methodTab === "card") {
      return {
        showCash: false,
        showTransfer: false,
        showCard: true,
        showSplit: false,
        showCredit: false,
        showDiscount: false,
        showMode: false,
        pending_cash: 0,
        pending_transfer: 0,
        pending_card: sumAmounts(cardQueue),
        pending_split: 0,
        pending_credit: 0,
        pending_discount: 0,
        pending_mode: 0,
        collected_cash_today: 0,
        collected_transfer_today: 0,
        collected_card_today: summary.collected_card_today,
        expenses_today: Number(summary.expenses_card_today) || 0,
        imprest_today: Number(summary.imprest_card_today) || 0,
        pay_bills_today: Number(summary.pay_bills_card_today) || 0,
        retire_today: Number(
          summary.retire_card_today ??
            Math.max(
              0,
              (Number(summary.collected_card_today) || 0) -
                (Number(summary.expenses_card_today) || 0),
            ),
        ),
        pending_count: cardQueue.length,
      };
    }
    if (methodTab === "credit") {
      const creditSplitPending = pendingToday.filter(
        (r) =>
          normalizePaymentMode(r.payment_type) === "credit_split" &&
          needsCollectionSide(r, "credit"),
      );
      const depositCredit = depositPendingToday.filter(isCreditPlusDepositRow);
      const byCode = new Map();
      for (const r of [
        ...creditPendingToday,
        ...creditSplitPending,
        ...depositCredit,
      ]) {
        if (!r?.sale_code) continue;
        const existing = byCode.get(r.sale_code);
        if (!existing || r.status === "awaiting_credit_approval") {
          byCode.set(r.sale_code, r);
        }
      }
      const awaitingRows = [...byCode.values()];
      return {
        showCash: false,
        showTransfer: false,
        showSplit: false,
        showCredit: false,
        showCreditApproval: true,
        showCredited: true,
        showDiscount: false,
        showMode: false,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: 0,
        pending_credit: sumAmounts(awaitingRows),
        pending_discount: 0,
        pending_mode: 0,
        collected_cash_today: 0,
        collected_transfer_today: 0,
        approved_credit_today: Number(summary.approved_credit_today) || 0,
        approved_credit_count_today:
          Number(summary.approved_credit_count_today) || 0,
        awaiting_credit_count: awaitingRows.length,
        pending_count: awaitingRows.length,
      };
    }
    if (methodTab === "deposit") {
      return {
        showCash: false,
        showTransfer: false,
        showSplit: false,
        showCredit: false,
        showDeposit: true,
        showDiscount: false,
        showMode: false,
        pending_cash: 0,
        pending_transfer: 0,
        pending_split: 0,
        pending_credit: 0,
        pending_deposit:
          Number(summary.pending_deposit) || sumAmounts(depositPendingToday),
        pending_discount: 0,
        pending_mode: 0,
        collected_cash_today: 0,
        collected_transfer_today: 0,
        applied_deposit_today: Number(summary.applied_deposit_today) || 0,
        applied_deposit_count_today:
          Number(summary.applied_deposit_count_today) || 0,
        pending_count: depositPendingToday.length,
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
          Number(summary.pending_discount) || sumAmounts(discountPendingToday),
        pending_mode: 0,
        collected_cash_today: 0,
        collected_transfer_today: 0,
        pending_count: discountPendingToday.length,
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
          Number(summary.pending_mode) || sumAmounts(modePendingToday),
        collected_cash_today: 0,
        collected_transfer_today: 0,
        pending_count: modePendingToday.length,
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
  }, [methodTab, pendingToday, creditPendingToday, depositPendingToday, discountPendingToday, modePendingToday, summary]);

  const tillHub = useMemo(() => {
    if (methodTab === "transfer") {
      return {
        modeLabel: "Transfer",
        collect: viewSummary.pending_transfer,
        collected: viewSummary.collected_transfer_today,
      };
    }
    if (methodTab === "card") {
      return {
        modeLabel: "POS",
        collect: viewSummary.pending_card,
        collected: viewSummary.collected_card_today,
      };
    }
    return {
      modeLabel: "Cash",
      collect: viewSummary.pending_cash,
      collected: viewSummary.collected_cash_today,
    };
  }, [methodTab, viewSummary]);

  const methodPendingCounts = useMemo(() => {
    const creditSplitPending = pendingToday.filter(
      (r) =>
        matchesMethod(r.payment_type, "credit") &&
        needsCollectionSide(r, "credit") &&
        normalizePaymentMode(r.payment_type) === "credit_split",
    );
    const depositCredit = depositPendingToday.filter(isCreditPlusDepositRow);
    const creditCodes = new Set(
      [...creditPendingToday, ...depositCredit]
        .map((r) => r.sale_code)
        .filter(Boolean),
    );
    const cashCodes = new Set();
    const transferCodes = new Set();
    const cardCodes = new Set();
    for (const r of pendingToday) {
      if (
        r?.sale_code &&
        matchesMethod(r.payment_type, "cash", r) &&
        needsCollectionSide(r, "cash")
      ) {
        cashCodes.add(r.sale_code);
      }
      if (
        r?.sale_code &&
        matchesMethod(r.payment_type, "transfer", r) &&
        needsCollectionSide(r, "transfer")
      ) {
        transferCodes.add(r.sale_code);
      }
      if (
        r?.sale_code &&
        matchesMethod(r.payment_type, "card", r) &&
        needsCollectionSide(r, "card")
      ) {
        cardCodes.add(r.sale_code);
      }
    }
    for (const r of depositPendingToday) {
      if (r?.sale_code && isCollectionPlusDepositRow(r, "cash")) {
        cashCodes.add(r.sale_code);
      }
      if (r?.sale_code && isCollectionPlusDepositRow(r, "transfer")) {
        transferCodes.add(r.sale_code);
      }
      if (r?.sale_code && isCollectionPlusDepositRow(r, "card")) {
        cardCodes.add(r.sale_code);
      }
    }
    const counts = {
      cash: cashCodes.size,
      transfer: transferCodes.size,
      card: cardCodes.size,
      credit: creditCodes.size + creditSplitPending.length,
      deposit: depositPendingToday.length,
      discount: discountPendingToday.length,
      mode: modePendingToday.length,
    };
    return counts;
  }, [
    pendingToday,
    creditPendingToday,
    depositPendingToday,
    discountPendingToday,
    modePendingToday,
  ]);

  const pendingForTab = useMemo(() => {
    let list;
    if (methodTab === "credit") {
      const split = pendingToday.filter(
        (r) =>
          normalizePaymentMode(r.payment_type) === "credit_split" &&
          needsCollectionSide(r, "credit"),
      );
      const depositCredit = depositPendingToday.filter(isCreditPlusDepositRow);
      const byCode = new Map();
      for (const r of [...creditPendingToday, ...split, ...depositCredit]) {
        if (!r?.sale_code) continue;
        const existing = byCode.get(r.sale_code);
        if (!existing || r.status === "awaiting_credit_approval") {
          byCode.set(r.sale_code, r);
        }
      }
      list = [...byCode.values()];
    } else if (methodTab === "deposit") {
      list = depositPendingToday;
    } else if (methodTab === "discount") {
      list = discountPendingToday;
    } else if (methodTab === "mode") {
      // Mode Switch: invoices you can change + those awaiting mode approval
      const byCode = new Map();
      for (const r of [
        ...pendingToday,
        ...creditPendingToday,
        ...modePendingToday,
      ]) {
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
      const collectionDeposit = depositPendingToday.filter((r) =>
        isCollectionPlusDepositRow(r, methodTab),
      );
      const byCode = new Map();
      for (const r of [
        ...pendingToday.filter(
          (r) =>
            matchesMethod(r.payment_type, methodTab, r) &&
            needsCollectionSide(r, methodTab),
        ),
        ...collectionDeposit,
      ]) {
        if (!r?.sale_code) continue;
        if (!byCode.has(r.sale_code)) byCode.set(r.sale_code, r);
      }
      list = [...byCode.values()];
    }
    return list;
  }, [
    pendingToday,
    creditPendingToday,
    depositPendingToday,
    discountPendingToday,
    modePendingToday,
    methodTab,
  ]);

  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pendingForTab;
    return pendingForTab.filter((r) =>
      [r.sale_code, r.customer_no, r.customer_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [pendingForTab, search]);

  const filteredHistory = useMemo(() => {
    let list = history.filter((r) => {
      // Received Payment (AD-*) stays on Received Payment — not this hub
      if (r.kind === "customer_advance") return false;
      if (methodTab === "credit") {
        return (
          matchesMethod(r.payment_type, "credit") ||
          matchesMethod(r.payment_type, "credit_approval")
        );
      }
      if (methodTab === "deposit") {
        return (
          matchesMethod(r.payment_type, "deposit") ||
          r.kind === "deposit_applied"
        );
      }
      if (methodTab === "discount") {
        return matchesMethod(r.payment_type, "discount", r);
      }
      if (methodTab === "mode") {
        return matchesMethod(r.payment_type, "mode", r);
      }
      if (
        methodTab === "cash" ||
        methodTab === "transfer" ||
        methodTab === "card"
      ) {
        if (rowCollectsAsSplit(r) || rowPaymentModes(r).length > 1) {
          return collectionSideDone(r, methodTab);
        }
      }
      return matchesMethod(r.payment_type, methodTab, r);
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
    if (!canUseHeaderAction(MAKE_DEPOSIT_PRIVILEGE)) return;
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
  }, [searchParams, setSearchParams, openAdvanceSheet, methodTab, canUseHeaderAction]);

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
      const requestId = hubInvoiceRequestRef.current + 1;
      hubInvoiceRequestRef.current = requestId;
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
          if (hubInvoiceRequestRef.current !== requestId) return;
          setHubLoading(false);
          if (res?.success && res.data) {
            const returned = String(
              res.data.transaction?.reference ||
                res.data.transaction?.id ||
                res.data.sale_code ||
                "",
            ).trim();
            if (returned && returned !== code) {
              setHubInvoiceData(null);
              return;
            }
            setHubInvoiceData(res.data);
          } else {
            toast.error(res?.message || "Failed to load invoice");
            setHubInvoiceData(null);
          }
        },
        () => {
          if (hubInvoiceRequestRef.current !== requestId) return;
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
      if (methodTab === "credit" && !isDepositPendingCredit(row)) {
        if (
          pt === "credit" ||
          pt === "credit_split" ||
          row?.status === "awaiting_credit_approval"
        ) {
          return "credit";
        }
      }
      if (
        methodTab === "credit" &&
        isDepositPendingCredit(row) &&
        rowPaymentModes(row).includes("credit")
      ) {
        return "credit";
      }
      if (pt === "credit_split" || pt === "split") return "collect";
      if (methodTab === "cash" || methodTab === "transfer" || methodTab === "card") {
        if (
          pt === "deposit" &&
          isDepositPendingCollection(row, methodTab)
        ) {
          return "collect";
        }
      }
      if (methodTab === "deposit" || pt === "deposit") return "deposit";
      if (
        row?.status === "awaiting_credit_approval" ||
        pt === "credit"
      )
        return "credit";
      if (methodTab === "credit") return "collect";
      if (methodTab === "discount") return "discount";
      if (methodTab === "mode") return "mode";
      if (pt === "credit") return "credit";
      return "collect";
    },
    [methodTab],
  );

  const resolveTreatingInvoice = () => {
    const treating = treatingInvoiceRef.current;
    const code = String(treating?.sale_code || "").trim();
    if (!code) return null;
    const selectedCode = String(selected?.sale_code || "").trim();
    if (selectedCode && selectedCode !== code) return null;
    if (selected?.id != null && treating?.id != null && selected.id !== treating.id) {
      return null;
    }
    return {
      sale_code: code,
      id: treating?.id ?? null,
    };
  };

  const confirmApplyDeposit = useCallback(async () => {
    const target = resolveTreatingInvoice();
    const row = depositConfirmRow || selected;
    const saleCode = String(
      target?.sale_code || row?.sale_code || "",
    ).trim();
    if (!saleCode || !activeBusiness?.id || !user?.id) return;
    if (row?.sale_code && String(row.sale_code).trim() !== saleCode) {
      toast.error("This collection is not for the open invoice. Close and try again.");
      return;
    }

    const available = Number(row.deposit_available) || 0;
    const typedDep = parseFormattedAmount(depositAmount);
    const previewApply = depositApplyPreview(row).apply;
    const depAmt =
      String(depositAmount || "").trim() === ""
        ? previewApply
        : typedDep;

    if (depAmt <= 0.05) {
      toast.error("Enter a deposit amount to apply");
      return;
    }
    if (depAmt - available > 0.05) {
      toast.error(
        `Deposit cannot exceed available ₦${formatNumber1(available)}`,
      );
      return;
    }

    const due = Number(row.amount) || 0;
    const collected = Number(row.split_progress?.collected_total) || 0;
    const creditAlloc = Number(row.split_progress?.credit_allocated) || 0;
    const remaining = Number(
      (due - collected - creditAlloc - depAmt).toFixed(2),
    );

    setSubmitting(true);
    try {
      await postJson("/api/v1/apply-customer-advance", {
        facilityId: activeBusiness.id,
        userId: user.id,
        customer_no: row.customer_no,
        transaction_date: moment().format("YYYY-MM-DD"),
        narration: `Apply deposit to ${saleCode}`,
        applications: [{ invoice_ref: saleCode, amount: depAmt }],
      });

      toast.success(
        remaining > 0.05
          ? `Deposit applied · ₦${formatNumber1(remaining)} left`
          : "Last payment (deposit) recorded",
      );
      setSearch("");
      setActiveTab("pending");
      setDepositConfirmRow(null);
      setHubOpen(false);
      fetchDashboard();
    } catch (err) {
      toast.error(err?.message || "Could not apply deposit");
    } finally {
      setSubmitting(false);
    }
  }, [
    depositConfirmRow,
    selected,
    activeBusiness?.id,
    user,
    depositAmount,
    fetchDashboard,
  ]);

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

      const snapshot = snapshotInvoiceRow(row);
      if (!snapshot?.sale_code) {
        toast.error("This invoice has no sale code");
        return;
      }
      setSelected(snapshot);
      treatingInvoiceRef.current = {
        sale_code: snapshot.sale_code,
        id: snapshot.id,
      };
      setHubAction(action);
      setHubOpen(true);
      loadHubInvoice(snapshot.sale_code);
      if (action === "deposit") {
        setDepositConfirmRow(snapshot);
        const due = Number(snapshot.amount) || 0;
        const available = Number(snapshot.deposit_available) || 0;
        const preset = Math.min(Math.max(0, due), Math.max(0, available));
        setDepositAmount(
          preset > 0.05 ? formatNumberWithCommas(String(preset)) : "",
        );
        setCreditAmount("");
        setTransferAmount("");
        setCashAmount("");
      }

      if (action === "collect") {
        // Mixed modes: leave amount blank so any portion can be entered.
        // Single-mode invoices still pre-fill the full amount due.
        if (rowCollectsAsSplit(snapshot)) {
          setCashAmount("");
          setTransferAmount("");
        } else {
          const due = Number(snapshot.amount) || 0;
          const collected = Number(snapshot.split_progress?.collected_total) || 0;
          const creditAlloc = Number(snapshot.split_progress?.credit_allocated) || 0;
          const leftover = Math.max(
            0,
            Number((due - collected - creditAlloc).toFixed(2)),
          );
          const fill = leftover > 0.05 ? leftover : due;
          if (pt === "cash" || methodTab === "cash") {
            setCashAmount(fill > 0 ? formatNumberWithCommas(String(fill)) : "");
            setTransferAmount("");
          } else if (
            pt === "transfer" ||
            pt === "bank" ||
            methodTab === "transfer" ||
            methodTab === "card"
          ) {
            setCashAmount("");
            setTransferAmount(
              fill > 0 ? formatNumberWithCommas(String(fill)) : "",
            );
          } else {
            setCashAmount("");
            setTransferAmount("");
          }
        }
      }
      if (action === "credit") {
        const due = Number(snapshot.amount) || 0;
        const collected = Number(snapshot.split_progress?.collected_total) || 0;
        const allocated = Number(snapshot.split_progress?.credit_allocated) || 0;
        const unpaid = Math.max(0, Number((due - collected).toFixed(2)));
        const preset =
          allocated > 0.05 ? allocated : Number(snapshot.split_progress?.credit) > 0.05
            ? Number(snapshot.split_progress.credit)
            : unpaid;
        setCreditAmount(
          preset > 0.05 ? formatNumberWithCommas(String(preset)) : "",
        );
      }
    },
    [loadHubInvoice, resolveHubAction, methodTab],
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
        ) ||
        depositPending.find(
          (r) => String(r.sale_code || "").toLowerCase() === needle,
        );
      if (pendingMatch) {
        const pt = String(pendingMatch.payment_type || "").toLowerCase();
        if (pt === "deposit" || depositPending.includes(pendingMatch)) {
          setMethodTab("deposit");
          openHub(pendingMatch, "deposit");
          if (fromScan) toast.success(`Scanned ${pendingMatch.sale_code}`);
          return;
        }
        if (pt === "credit" || creditPending.includes(pendingMatch)) {
          setMethodTab("credit");
        } else if (pt === "transfer" || pt === "bank") {
          if (canViewCollectionTab("Transfer Collection")) {
            setMethodTab("transfer");
          }
        } else if (pt === "card") {
          if (canViewCollectionTab("Card Collection")) {
            setMethodTab("card");
          }
        } else if (pt === "cash") {
          if (canViewCollectionTab("Cash Collection")) {
            setMethodTab("cash");
          }
        } else if (isSplitPaymentType(pt)) {
          // Prefer a side this user can collect via privileges
          if (
            canViewCollectionTab("Transfer Collection") &&
            !canViewCollectionTab("Cash Collection") &&
            !canViewCollectionTab("Card Collection")
          ) {
            setMethodTab("transfer");
          } else if (
            canViewCollectionTab("Card Collection") &&
            !canViewCollectionTab("Cash Collection") &&
            !canViewCollectionTab("Transfer Collection")
          ) {
            setMethodTab("card");
          } else if (canViewCollectionTab("Cash Collection")) {
            setMethodTab("cash");
          } else if (canViewCollectionTab("Transfer Collection")) {
            setMethodTab("transfer");
          } else if (canViewCollectionTab("Card Collection")) {
            setMethodTab("card");
          } else if (
            methodTab !== "cash" &&
            methodTab !== "transfer" &&
            methodTab !== "card"
          ) {
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
    [history, pending, creditPending, depositPending, canViewCollectionTab, methodTab, openHub],
  );

  // Deep-link: /verification-points?sale_code=INV-…&tab=credit|cash|transfer
  useEffect(() => {
    const code = String(searchParams.get("sale_code") || "").trim();
    if (!code || !dashboardReady || loading) return;

    const tab = String(searchParams.get("tab") || "").toLowerCase();
    if (tab === "credit_approval" && canViewCollectionTab("Credit Collection")) {
      setMethodTab("credit");
    } else if (tab === "credit" && canViewCollectionTab("Credit Collection")) {
      setMethodTab("credit");
    } else if (
      tab === "transfer" &&
      canViewCollectionTab("Transfer Collection")
    ) {
      setMethodTab("transfer");
    } else if (
      tab === "card" &&
      canViewCollectionTab("Card Collection")
    ) {
      setMethodTab("card");
    } else if (tab === "cash" && canViewCollectionTab("Cash Collection")) {
      setMethodTab("cash");
    } else if (tab === "deposit") {
      setMethodTab("deposit");
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
    hubInvoiceRequestRef.current += 1;
    treatingInvoiceRef.current = null;
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
      treatingInvoiceRef.current = null;
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
                "Switched to Credit — approve on the Credit tab, then it opens Sales Process",
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
    if (row.credit_over_limit) {
      toast.error(
        `Credit limit exceeded. Limit ₦${formatNumber1(
          row.credit_limit,
        )}, available ₦${formatNumber1(row.credit_available)}, this invoice ₦${formatNumber1(
          row.amount,
        )}.`,
      );
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
        note: "Credit approved",
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          toast.success(
            res.message || "Credit approved — opening invoice to print",
          );
          closeHub();
          fetchDashboard();
          if (row?.sale_code) {
            navigate(
              `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                row.sale_code,
              )}&doc=invoice`,
            );
          }
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
        action: "approve_discount",
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
    const pt = normalizePaymentMode(selected.payment_type);
    const modes = rowPaymentModes(selected);
    if (
      pt !== "credit_split" &&
      !(pt === "deposit" && modes.includes("credit"))
    ) {
      toast.error("Only mixed Cash / Transfer / Credit invoices can confirm a credit amount");
      return;
    }
    const creditToSend = parseFormattedAmount(creditAmount);
    if (creditToSend <= 0.05) {
      toast.error("Enter a credit amount greater than zero");
      return;
    }
    if (creditToSend > unpaidBeforeCredit + 0.05) {
      toast.error(
        `Credit cannot exceed the unpaid amount (₦${formatNumber1(unpaidBeforeCredit)})`,
      );
      return;
    }
    const collected = Number(splitProgress?.collected_total) || 0;
    const target = resolveTreatingInvoice();
    if (!target?.sale_code || target.id == null) {
      toast.error("This collection is not for the open invoice. Close and try again.");
      return;
    }
    const saleCode = target.sale_code;
    setSubmitting(true);
    _postApi(
      "/api/v1/sale-workflows/send-credit-remainder",
      {
        facilityId: activeBusiness.id,
        saleCode,
        workflowId: target.id,
        credit_amount: creditToSend,
        updated_by: user?.id,
        note:
          collected <= 0.05 && creditToSend >= unpaidBeforeCredit - 0.05
            ? `Full amount ₦${creditToSend.toFixed(2)} confirmed as Credit`
            : `Credit ₦${creditToSend.toFixed(2)} confirmed`,
      },
      (res) => {
        if (!res?.success) {
          setSubmitting(false);
          toast.error(res?.message || "Could not confirm credit amount");
          return;
        }
        if (res.allocated) {
          setSubmitting(false);
          toast.success(
            res.message ||
              `Credit ₦${formatNumber1(creditToSend)} saved`,
          );
          setSearch("");
          setActiveTab("pending");
          closeHub();
          fetchDashboard();
          return;
        }
        _postApi(
          "/api/v1/sale-workflows/advance",
          {
            facilityId: activeBusiness.id,
            saleCode,
            action: "advance",
            updated_by: user?.id,
            note: "Credit confirmed at Verification Points — ready for separation",
          },
          (advRes) => {
            setSubmitting(false);
            if (advRes?.success) {
              toast.success("Last payment (credit) recorded");
              setSearch("");
              setActiveTab("pending");
              closeHub();
              fetchDashboard();
            } else {
              toast.success("Last payment (credit) recorded");
              setSearch("");
              setActiveTab("pending");
              closeHub();
              fetchDashboard();
            }
          },
          (err) => {
            setSubmitting(false);
            toast.success("Last payment (credit) recorded");
            setSearch("");
            setActiveTab("pending");
            closeHub();
            fetchDashboard();
          },
        );
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Could not confirm credit amount");
      },
    );
  };

  const confirmPayment = () => {
    if (!selected || !activeBusiness?.id) return;
    const target = resolveTreatingInvoice();
    if (!target?.sale_code || target.id == null) {
      toast.error("This collection is not for the open invoice. Close and try again.");
      return;
    }
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

    if (showCardFields && transferAmt > 0) {
      if (!bankAccounts.bankAccount?.id) {
        toast.error("Select a bank account (Pay Through)");
        return;
      }
      splits.push({
        mode: "card",
        amount: transferAmt,
        bankAccount: bankAccounts.bankAccount,
      });
    }

    // Credit + Cash + Transfer: no cash/transfer entered → confirm full remaining as Credit
    if (
      !splits.length &&
      normalizePaymentMode(selected.payment_type) === "credit_split" &&
      remainingDue > 0.05
    ) {
      sendCreditRemainder();
      return;
    }

    if (!splits.length) {
      toast.error(
        isSplit
          ? collectionSide === "transfer"
            ? "Enter the transfer amount"
            : collectionSide === "card"
              ? "Enter the card amount"
              : "Enter the cash amount"
          : "Enter cash, transfer, or card amount",
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
        saleCode: target.sale_code,
        workflowId: target.id,
        updated_by: user?.id,
        collector_name:
          [user?.firstname, user?.lastname].filter(Boolean).join(" ").trim() ||
          user?.name ||
          user?.username ||
          undefined,
        cashier_type:
          methodTab === "card"
            ? "card"
            : methodTab === "transfer"
              ? "transfer"
              : methodTab === "cash"
                ? "cash"
                : undefined,
        collection_side:
          methodTab === "card"
            ? "card"
            : methodTab === "transfer"
              ? "transfer"
              : methodTab === "cash"
                ? "cash"
                : isSplit
                  ? collectionSide
                  : undefined,
        payment_splits: splits,
        note: isSplit
          ? `${
              collectionSide === "card"
                ? "POS"
                : collectionSide === "transfer"
                  ? "Transfer"
                  : "Cash"
            } portion at Verification Points`
          : "Collected at Verification Points",
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          const status = String(res.results?.status || "").toLowerCase();
          const lastPay =
            Boolean(res.last_pay) ||
            [
              "invoice_separation",
              "payment_confirmed",
              "final_invoice",
            ].includes(status) ||
            (!isSplit && Math.abs(total - amountDue) <= 0.05);

          toast.success(
            lastPay
              ? res.message || "Payment confirmed"
              : res.message || "Payment recorded",
          );
          setSearch("");
          setActiveTab("pending");
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
    parseFormattedAmount(cashAmount) + parseFormattedAmount(transferAmount);

  const fillAllRemaining = (side) => {
    const amt =
      suggestedPortion > 0.05
        ? suggestedPortion
        : remainingDue > 0
          ? remainingDue
          : 0;
    const formatted = amt > 0 ? formatNumberWithCommas(String(amt)) : "";
    if (side === "transfer" || side === "card") setTransferAmount(formatted);
    else setCashAmount(formatted);
  };

  const confirmButtonAmount = (() => {
    if (isSplit) {
      return collectionSide === "transfer" || collectionSide === "card"
        ? parseFormattedAmount(transferAmount)
        : parseFormattedAmount(cashAmount);
    }
    if (showCashFields) {
      const v = parseFormattedAmount(cashAmount);
      return v > 0 ? v : remainingDue;
    }
    if (showTransferFields || showCardFields) {
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
        collectionSide === "card"
          ? "POS"
          : collectionSide === "transfer"
            ? "Transfer"
            : "Cash";
      return amtLabel
        ? `Confirm ${amtLabel} ${side} · ${selected?.sale_code || ""}`
        : `Confirm ${side} · ${selected?.sale_code || ""}`;
    }
    return amtLabel
      ? `Confirm ${amtLabel} · ${selected?.sale_code || ""}`
      : `Confirm Payment · ${selected?.sale_code || ""}`;
  })();

  const summaryGridCols =
    methodTab === "discount" || methodTab === "mode"
      ? "xl:grid-cols-1 sm:grid-cols-1"
      : "xl:grid-cols-2";

  const canMakeDeposit = canUseHeaderAction(MAKE_DEPOSIT_PRIVILEGE);
  const canReconcileCollections = canUseHeaderAction(RECONCILIATION_PRIVILEGE);
  const canImprest = canUseHeaderAction(IMPREST_PRIVILEGE);
  const canPayBill = canUseHeaderAction(PAY_BILL_PRIVILEGE);

  if (!visibleMethodTabs.length && !canMakeDeposit && !canReconcileCollections) {
    return (
      <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Verification Points
          </h1>
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              You do not have permission to collect payments. Ask an admin to
              grant Cash Collection, Transfer Collection, POS Collection, Credit Collection,
              Apply Deposit, Discount Collection, or Make Deposit under Sales →
              Verification Points.
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
              Collect invoice payments. Apply Deposit uses prepaid customer
              funds.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canMakeDeposit ? (
              <button
                type="button"
                onClick={() => openAdvanceSheet()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Make Deposit
              </button>
            ) : null}
            {canReconcileCollections ? (
            <Link
              to="/app/payments/collection-reconciliation"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              Collection Reconciliation
            </Link>
            ) : null}
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
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
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
                {viewSummary.pending_count || 0} invoice
                {(viewSummary.pending_count || 0) === 1 ? "" : "s"}
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
                {viewSummary.pending_count || 0} invoice
                {(viewSummary.pending_count || 0) === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

          {viewSummary.showCard ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Nfc className="h-4 w-4 text-indigo-600" />
                POS to collect
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_card)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewSummary.pending_count || 0} invoice
                {(viewSummary.pending_count || 0) === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

          {viewSummary.showCreditApproval ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-800">
                <ClipboardCheck className="h-4 w-4 text-amber-600" />
                Awaiting credit
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_credit)}
              </p>
              <p className="mt-1 text-xs text-amber-800/80">
                {viewSummary.awaiting_credit_count ??
                  viewSummary.pending_count}{" "}
                invoice
                {(viewSummary.awaiting_credit_count ??
                  viewSummary.pending_count) === 1
                  ? ""
                  : "s"}
              </p>
            </div>
          ) : null}

          {viewSummary.showCredited ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? "Credited today"
                  : "Credited"}
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
                ₦{formatNumber1(viewSummary.approved_credit_today)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewSummary.approved_credit_count_today || 0} invoice
                {(viewSummary.approved_credit_count_today || 0) === 1
                  ? ""
                  : "s"}
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? " today"
                  : ""}
              </p>
            </div>
          ) : null}

          {viewSummary.showCredit ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-violet-800">
                <CreditCard className="h-4 w-4 text-violet-600" />
                Credit collection
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_credit)}
              </p>
              <p className="mt-1 text-xs text-violet-800/80">
                {viewSummary.pending_count} invoice
                {viewSummary.pending_count === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

          {viewSummary.showDeposit ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-teal-800">
                <Wallet className="h-4 w-4 text-teal-600" />
                Awaiting apply deposit
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                ₦{formatNumber1(viewSummary.pending_deposit)}
              </p>
              <p className="mt-1 text-xs text-teal-800/80">
                {viewSummary.pending_count} invoice
                {viewSummary.pending_count === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

          {viewSummary.showDeposit ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? "Deposits applied today"
                  : "Deposits applied"}
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">
                ₦{formatNumber1(viewSummary.applied_deposit_today)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {viewSummary.applied_deposit_count_today || 0} settled
                {historyFrom === todayYmd && historyTo === todayYmd
                  ? " today"
                  : ""}
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
                {viewSummary.pending_count} invoice
                {viewSummary.pending_count === 1 ? "" : "s"}
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
                {viewSummary.pending_count === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

          {viewSummary.showCash ? (
            <TillSummaryCard
              modeLabel="Cash"
              icon={Wallet}
              iconClass="text-emerald-600"
              amountClass="text-emerald-700"
              retire={viewSummary.retire_today}
              onOpen={() => setTillHubOpen(true)}
            />
          ) : null}

          {viewSummary.showTransfer ? (
            <TillSummaryCard
              modeLabel="Transfer"
              icon={Building2}
              iconClass="text-sky-600"
              amountClass="text-sky-700"
              retire={viewSummary.retire_today}
              onOpen={() => setTillHubOpen(true)}
            />
          ) : null}

          {viewSummary.showCard ? (
            <TillSummaryCard
              modeLabel="POS"
              icon={Nfc}
              iconClass="text-indigo-600"
              amountClass="text-indigo-700"
              retire={viewSummary.retire_today}
              onOpen={() => setTillHubOpen(true)}
            />
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
                  ? "credit"
                  : methodTab === "deposit"
                    ? "apply deposit"
                    : methodTab === "discount"
                      ? "discount approval"
                      : methodTab === "mode"
                        ? "payment mode approval"
                        : methodTab === "transfer"
                          ? "transfer payment"
                          : methodTab === "card"
                            ? "POS payment"
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
                      {methodTab === "mode" ? (
                        <th className="px-4 py-3">Mode</th>
                      ) : null}
                      <th className="px-4 py-3 text-right">Amount due</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPending.map((row) => (
                      <tr
                        key={`${row.id || "row"}-${row.sale_code}`}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          <button
                            type="button"
                            onClick={() => openHub(row)}
                            className="text-left text-[var(--aa-accent)] hover:underline"
                            title="View invoice and take action"
                          >
                            {row.sale_code}
                          </button>
                          {methodTab === "mode" || methodTab === "discount" ? (
                          <div className="mt-1.5">
                            {(() => {
                              const badge = tabWorkflowBadge(methodTab, row);
                              return (
                                <WorkflowStatusBadge
                                  status={row.status}
                                  paymentType={badge.paymentType}
                                  label={badge.label}
                                />
                              );
                            })()}
                          </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {row.customer_name || "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.customer_no}
                          </div>
                          {methodTab === "deposit" ? (
                            <div className="mt-1 text-[11px] text-slate-500">
                              Deposit available ₦
                              {formatNumber1(row.deposit_available || 0)}
                              {Number(row.credit_remainder) > 0.05 ||
                              (Number(row.amount) || 0) -
                                (Number(row.deposit_available) || 0) >
                                0.05 ? (
                                <span className="block text-teal-700">
                                  Remainder ₦
                                  {formatNumber1(
                                    Number(row.credit_remainder) > 0
                                      ? row.credit_remainder
                                      : (Number(row.amount) || 0) -
                                          (Number(row.deposit_available) || 0),
                                  )}{" "}
                                  after deposit
                                </span>
                              ) : row.credit_after_deposit ? (
                                <span className="block text-teal-700">
                                  Deposit covers this invoice
                                </span>
                              ) : null}
                            </div>
                          ) : methodTab === "credit" &&
                            isDepositPendingCredit(row) ? (
                            <div className="mt-1 text-[11px] text-slate-500">
                              Deposit available ₦
                              {formatNumber1(row.deposit_available || 0)}
                              {Number(row.credit_remainder) > 0.05 ? (
                                <span className="block text-amber-800">
                                  Credit remainder ₦
                                  {formatNumber1(row.credit_remainder)} after
                                  deposit
                                </span>
                              ) : null}
                            </div>
                          ) : isDepositPendingCollection(row, methodTab) ? (
                            <div className="mt-1 text-[11px] text-slate-500">
                              Deposit available ₦
                              {formatNumber1(row.deposit_available || 0)}
                              <span className="block text-teal-700">
                                {Number(row.credit_remainder) > 0.05
                                  ? `Collect any mix — ₦${formatNumber1(row.credit_remainder)} still open after deposit`
                                  : "Collect any mix — last payment opens print"}
                              </span>
                            </div>
                          ) : methodTab === "credit" &&
                            isCreditAvailabilityRow(row) &&
                            row.credit_over_limit ? (
                              <div className="mt-1 text-[11px] font-semibold text-red-600">
                                Exceeds remaining credit
                              </div>
                          ) : null}
                        </td>
                        {methodTab === "mode" ? (
                        <td className="px-4 py-3">
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
                                      {paymentTypeLabel(row.payment_type, row)}
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
                                    {paymentTypeLabel(row.payment_type, row)}
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
                        </td>
                        ) : null}
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          ₦{formatNumber1(row.amount)}
                          {methodTab === "credit" &&
                          Number(row.credit_remainder) > 0.05 &&
                          Math.abs(
                            Number(row.credit_remainder) - Number(row.amount),
                          ) > 0.05 ? (
                            <div className="mt-0.5 text-[11px] font-medium text-amber-800">
                              Credit ₦{formatNumber1(row.credit_remainder)}
                            </div>
                          ) : null}
                          {Number(row.discount_amount) > 0 ? (
                            <div className="mt-0.5 text-[11px] font-medium text-orange-700">
                              Discount −₦{formatNumber1(row.discount_amount)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {row.createdAt
                            ? moment(row.createdAt).format("DD MMM, HH:mm")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {methodTab === "deposit" ? (
                            <button
                              type="button"
                              disabled={
                                submitting ||
                                Number(row.deposit_available) <= 0.05
                              }
                              title={
                                Number(row.deposit_available) <= 0.05
                                  ? "No deposit available — Apply is blocked"
                                  : "Apply deposit"
                              }
                              onClick={() => openHub(row, "deposit")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              Apply
                            </button>
                          ) : methodTab === "credit" &&
                            isDepositPendingCredit(row) ? (
                            <div className="flex flex-col items-end gap-1.5">
                              {rowPaymentModes(row).includes("credit") ? (
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => openHub(row, "credit")}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => openHub(row, "deposit")}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                                >
                                  <Wallet className="h-3.5 w-3.5" />
                                  Apply
                                </button>
                              )}
                            </div>
                          ) : methodTab === "credit" &&
                            isCreditAvailabilityRow(row) ? (
                            <button
                              type="button"
                              disabled={submitting || row.credit_over_limit}
                              title={
                                row.credit_over_limit
                                  ? "Invoice exceeds this customer's remaining credit"
                                  : undefined
                              }
                              onClick={() => openHub(row, "credit")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Approve
                            </button>
                          ) : methodTab === "credit" ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => openHub(row, "collect")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--aa-navy)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Collect
                            </button>
                          ) : methodTab === "discount" ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => openHub(row, "discount")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Approve
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
                          ) : isDepositPendingCollection(row, methodTab) ? (
                            <button
                              type="button"
                              onClick={() => openHub(row, "collect")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--aa-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--aa-accent-hover)]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Collect
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openHub(row, "collect")}
                              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--aa-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--aa-accent-hover)]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Collect
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
              {methodTab === "credit"
                ? "credited invoices"
                : methodTab === "deposit"
                  ? "deposit applications"
                  : methodTab === "discount"
                    ? "discounted invoices"
                    : "payments"}{" "}
              for{" "}
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
                    {methodTab === "mode" ? (
                      <th className="px-4 py-3">Mode</th>
                    ) : null}
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
                      {methodTab === "mode" ? (
                      <td className="px-4 py-3">
                        {isAdvance ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentTypeBadgeClass(
                              row.payment_type,
                            )}`}
                          >
                            Deposit · {paymentTypeLabel(row.payment_type)}
                          </span>
                        ) : (
                          <PaymentModeBreakdown row={row} />
                        )}
                      </td>
                      ) : null}
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ₦{formatNumber1(row.amount)}
                        {Number(row.discount_amount) > 0 ? (
                          <div className="mt-0.5 text-[11px] font-medium text-orange-700">
                            Discount −₦{formatNumber1(row.discount_amount)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {methodTab === "credit" && !isAdvance
                            ? "Credited"
                            : row.status_label || row.status}
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
                    : hubAction === "deposit"
                      ? "View & Apply Deposit"
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
                        tabWorkflowBadge(methodTab, selected).paymentType
                      }
                      label={tabWorkflowBadge(methodTab, selected).label}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600">Mode of payment</span>
                    <span className="text-right">
                      <PaymentModeBreakdown row={selected} />
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
                  {hubAction === "deposit" ? (
                    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 text-sm">
                      <div className="flex justify-between gap-3 text-slate-600">
                        <span>Deposit available</span>
                        <span className="font-semibold tabular-nums text-teal-700">
                          ₦
                          {formatNumber1(
                            depositApplyPreview(selected).available,
                          )}
                        </span>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-sm font-medium text-slate-700">
                            Apply deposit
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setDepositAmount(
                                formatNumberWithCommas(
                                  String(
                                    depositApplyPreview(selected).apply || 0,
                                  ),
                                ),
                              )
                            }
                            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--aa-navy)] hover:bg-slate-50"
                          >
                            Max (₦
                            {formatNumber1(
                              depositApplyPreview(selected).apply,
                            )}
                            )
                          </button>
                        </div>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={depositAmount}
                          onChange={(e) =>
                            setDepositAmount(
                              formatNumberWithCommas(e.target.value),
                            )
                          }
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                          placeholder="0.00"
                        />
                      </div>
                      {depositApplyPreview(selected).available <= 0.05 ? (
                        <p className="text-xs text-amber-800">
                          This customer has no available deposit.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {hubAction === "collect" && isSplit ? (
                    <div className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
                      <p>
                        {normalizePaymentMode(paymentType) === "credit_split"
                          ? methodTab === "cash"
                            ? "Collect any cash amount. Remaining balance can stay on credit or other modes."
                            : methodTab === "transfer"
                              ? "Collect any transfer amount. Remaining balance can stay on credit or other modes."
                              : "Collect any portion in this mode. Any unpaid balance can be Credit — confirm it on the Credit tab."
                          : "Collect any amount in this mode — including the full remaining balance as cash, transfer, or POS if needed. Unused modes stay open until the invoice is fully paid."}
                      </p>
                      {depositCover > 0.05 ? (
                        <p className="text-teal-700">
                          Deposit available ₦{formatNumber1(depositCover)} · ₦
                          {formatNumber1(suggestedPortion)} still open after
                          deposit
                        </p>
                      ) : null}
                      <p>
                        Cash: ₦
                        {formatNumber1(splitProgress?.cash || 0)}
                        {splitProgress?.cash_by_name
                          ? ` · signed by ${splitProgress.cash_by_name}`
                          : ""}
                      </p>
                      <p>
                        Transfer: ₦
                        {formatNumber1(splitProgress?.transfer || 0)}
                        {splitProgress?.transfer_by_name
                          ? ` · signed by ${splitProgress.transfer_by_name}`
                          : ""}
                      </p>
                      <p>
                        POS: ₦
                        {formatNumber1(splitProgress?.card || 0)}
                        {splitProgress?.card_by_name
                          ? ` · signed by ${splitProgress.card_by_name}`
                          : ""}
                      </p>
                      {normalizePaymentMode(paymentType) === "credit_split" ? (
                        <p>
                          Credit:{" "}
                          <span className="font-semibold tabular-nums text-amber-800">
                            ₦
                            {formatNumber1(
                              Number(splitProgress?.credit) > 0
                                ? splitProgress.credit
                                : unpaidBeforeCredit,
                            )}
                          </span>
                        </p>
                      ) : (
                        <p>
                          Remaining:{" "}
                          <span className="font-semibold tabular-nums text-slate-900">
                            ₦{formatNumber1(remainingDue)}
                          </span>
                          {suggestedPortion + 0.05 < remainingDue ? (
                            <span className="block text-teal-700">
                              After deposit: ₦
                              {formatNumber1(suggestedPortion)}
                            </span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  ) : null}
                  {hubAction === "credit" &&
                  isCreditSplitHub &&
                  awaitingCollection ? (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="credit-amount"
                          className="text-sm font-medium text-slate-700"
                        >
                          Credit amount
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setCreditAmount(
                              unpaidBeforeCredit > 0
                                ? formatNumberWithCommas(
                                    String(unpaidBeforeCredit),
                                  )
                                : "",
                            )
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--aa-navy)] hover:bg-slate-50"
                        >
                          All (₦{formatNumber1(unpaidBeforeCredit)})
                        </button>
                      </div>
                      <input
                        id="credit-amount"
                        type="text"
                        inputMode="decimal"
                        value={creditAmount}
                        onChange={(e) =>
                          setCreditAmount(
                            formatNumberWithCommas(e.target.value),
                          )
                        }
                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                        placeholder="0.00"
                      />
                      {unpaidBeforeCredit - parseFormattedAmount(creditAmount) >
                      0.05 ? (
                        <p className="text-xs text-slate-500">
                          Left for cash/transfer: ₦
                          {formatNumber1(
                            Math.max(
                              0,
                              unpaidBeforeCredit -
                                parseFormattedAmount(creditAmount),
                            ),
                          )}
                        </p>
                      ) : null}
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
                                All (₦{formatNumber1(suggestedPortion > 0.05 ? suggestedPortion : remainingDue)})
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
                              placeholder={isSplit ? "Enter any amount" : "0.00"}
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
                                All (₦{formatNumber1(suggestedPortion > 0.05 ? suggestedPortion : remainingDue)})
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
                              placeholder={isSplit ? "Enter any amount" : "0.00"}
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

                    {showCardFields ? (
                      <div className="space-y-2">
                        {isSplit || !isCardOnly ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-sm font-medium text-slate-700">
                                POS amount
                              </label>
                              <button
                                type="button"
                                onClick={() => fillAllRemaining("card")}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--aa-navy)] hover:bg-slate-50"
                              >
                                All (₦{formatNumber1(suggestedPortion > 0.05 ? suggestedPortion : remainingDue)})
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
                              placeholder={isSplit ? "Enter any amount" : "0.00"}
                            />
                          </>
                        ) : null}
                        <label className="text-sm font-medium text-slate-700">
                          {isCardOnly || isSplit
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
                            <SelectValue placeholder="Select bank / POS account…" />
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
                        Entered: ₦{formatNumber1(splitHintTotal)} ·{" "}
                        {normalizePaymentMode(paymentType) === "credit_split"
                          ? "Credit after this"
                          : "Remaining after this"}
                        : ₦
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
                  <div className="space-y-2">
                    {selected && !selected.credit_unlimited ? (
                      <div
                        className={`rounded-md border px-3 py-2 text-xs ${
                          selected.credit_over_limit
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-amber-200 bg-amber-50 text-amber-950"
                        }`}
                      >
                        <div>
                          <span className="font-semibold">Credit limit: </span>
                          ₦{formatNumber1(selected.credit_limit)}
                          <span className="mx-1.5">·</span>
                          <span className="font-semibold">Other outstanding: </span>
                          ₦{formatNumber1(selected.credit_outstanding)}
                          <span className="mx-1.5">·</span>
                          <span className="font-semibold">Available: </span>
                          ₦{formatNumber1(selected.credit_available)}
                        </div>
                        <div className="mt-0.5">
                          This invoice ₦{formatNumber1(selected.amount)}
                          {selected.credit_over_limit
                            ? " — cannot approve (exceeds remaining credit)."
                            : ` · after approval ₦${formatNumber1(
                                selected.credit_projected,
                              )} of ${formatNumber1(selected.credit_limit)} used.`}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">
                        No credit limit on this customer.
                      </p>
                    )}
                    <p className="text-sm text-slate-600">
                      {normalizePaymentMode(selected?.payment_type) ===
                        "credit_split" &&
                      String(selected?.status || "").toLowerCase() ===
                        "awaiting_cashier_confirm"
                        ? "Enter the credit amount, then confirm. Anything left is collected as cash or transfer."
                        : "Review the invoice, then approve credit to send it to Invoice Separation."}
                    </p>
                  </div>
                ) : null}
                {hubAction === "discount" ? (
                  <p className="text-sm text-slate-600">
                    Review the invoice, then approve the discount to release it
                    for collection.
                  </p>
                ) : null}
                {hubAction === "deposit" ? (
                  <p className="text-sm text-slate-600">
                    Apply the deposit here. If anything is left, collect it on
                    Cash — printing opens after that last payment.
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

                  {hubAction === "deposit" ? (
                    <button
                      type="button"
                      disabled={
                        submitting ||
                        !selected ||
                        (parseFormattedAmount(depositAmount) <= 0.05 &&
                          depositApplyPreview(selected).apply <= 0.05)
                      }
                      onClick={confirmApplyDeposit}
                      className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                      {`Approve & apply${
                        selected
                          ? ` · ₦${formatNumber1(
                              parseFormattedAmount(depositAmount) ||
                                depositApplyPreview(selected).apply,
                            )}`
                          : ""
                      }`}
                    </button>
                  ) : null}

                  {hubAction === "collect" ? (
                    <>
                      {methodTab === "credit" &&
                      isCreditSplitHub &&
                      remainingDue > 0.05 ? (
                        <button
                          type="button"
                          onClick={sendCreditRemainder}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4" />
                          )}
                          Confirm ₦{formatNumber1(remainingDue)} as Credit
                        </button>
                      ) : null}
                      {methodTab === "credit" &&
                      isCreditSplitHub &&
                      splitHintTotal <= 0.05 ? null : (
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
                      )}
                    </>
                  ) : null}

                  {hubAction === "credit" ? (
                    <button
                      type="button"
                      disabled={
                        submitting ||
                        !selected ||
                        selected.credit_over_limit ||
                        (isCreditSplitHub &&
                          awaitingCollection &&
                          parseFormattedAmount(creditAmount) <= 0.05)
                      }
                      title={
                        selected?.credit_over_limit
                          ? "Invoice exceeds this customer's remaining credit"
                          : undefined
                      }
                      onClick={() => {
                        if (
                          isCreditSplitHub &&
                          awaitingCollection
                        ) {
                          sendCreditRemainder();
                          return;
                        }
                        approveCredit(selected);
                      }}
                      className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {isCreditSplitHub && awaitingCollection
                        ? `Confirm ₦${formatNumber1(
                            parseFormattedAmount(creditAmount) ||
                              unpaidBeforeCredit,
                          )} as Credit`
                        : `Approve Credit${
                            selected?.amount > 0
                              ? ` · ₦${formatNumber1(selected.amount)}`
                              : ""
                          }`}
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
              {modeChangeNext === "deposit" ? (
                <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
                  Note: The invoice will move to the{" "}
                  <span className="font-semibold">Apply Deposit</span> tab so
                  customer deposit can be applied before collection or credit
                  approval.
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
      <TillHubDialog
        open={tillHubOpen}
        onOpenChange={setTillHubOpen}
        modeLabel={tillHub.modeLabel}
        collect={tillHub.collect}
        collected={tillHub.collected}
        retire={viewSummary.retire_today}
        expenses={viewSummary.expenses_today}
        imprestTotal={viewSummary.imprest_today || 0}
        payBillTotal={viewSummary.pay_bills_today || 0}
        pendingCount={viewSummary.pending_count || 0}
        canImprest={canImprest}
        canPayBill={canPayBill}
        onImprest={() => {
          setTillHubOpen(false);
          setImprestOpen(true);
        }}
        onPayBill={() => {
          setTillHubOpen(false);
          setPayBillOpen(true);
        }}
        onViewCollected={() => {
          setTillHubOpen(false);
          setHistoryFrom(todayYmd);
          setHistoryTo(todayYmd);
          setActiveTab("history");
        }}
      />
      <Sheet open={payBillOpen} onOpenChange={setPayBillOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-3xl"
        >
          {payBillOpen ? (
            <RecordSupplierPaymentForm
              embedded
              lockMode
              defaultMode={tillPayBillMode(methodTab)}
              onClose={() => setPayBillOpen(false)}
              onSaved={fetchDashboard}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <CreateImprestDrawer
        open={imprestOpen}
        onOpenChange={setImprestOpen}
        expenseList={expenseList}
        facilityId={activeBusiness?.id}
        user={user}
        defaultMode={methodTab === "cash" ? "cash" : "bank"}
        lockMode
        tillMode={
          methodTab === "card" || methodTab === "transfer" || methodTab === "cash"
            ? methodTab
            : "cash"
        }
        skipReceiptNavigate
        onSuccess={fetchDashboard}
      />
    </div>
  );
}
