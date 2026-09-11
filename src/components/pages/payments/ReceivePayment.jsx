import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  Nfc,
  Eye,
  History,
  Landmark,
  Loader2,
  Lock,
  Percent,
  Printer,
  RefreshCw,
  Receipt,
  ScanLine,
  Search,
  Pencil,
  Split,
  Trash2,
  UserPlus,
  Wallet,
  ChevronRight,
} from "lucide-react";
import ExcelJS from "exceljs";
import moment from "moment";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { hasFullAccess, isBusinessOwner, DISCOUNT_COLLECTION_PRIVILEGE, HAND_IN_PRIVILEGE, RECONCILIATION_HISTORY_PRIVILEGE, COLLECTION_RECONCILIATION_PRIVILEGE } from "@/lib/access";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvancePaymentAccounts, isCashInHandHead } from "@/components/common/useAdvancePaymentAccounts";
import { WorkflowStatusBadge, isEditableSalesInvoiceStatus, isProcessedSalesInvoiceStatus, alreadyProcessedInvoiceMessage } from "@/lib/saleWorkflowStatus.js";
import useScanDetection from "@/hooks/useScanDetection";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import { getCustomers } from "@/redux/actions/customer";
import {
  normalizeNigerianPhone,
  isValidNigerianPhone,
  sanitizePhoneInput,
  NIGERIAN_PHONE_HINT,
} from "@/lib/nigerianPhone";
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

function TillLine({
  label,
  value,
  onClick,
  onDownload,
  downloading = false,
  tone = "neutral",
  prefix = "",
}) {
  const isTotal = tone === "total";
  const valueClass = isTotal
    ? "font-semibold text-emerald-700"
    : tone === "minus"
      ? "font-medium text-slate-700"
      : "font-medium text-slate-900";
  return (
    <div className="flex w-full items-center justify-between gap-2 py-1.5 text-sm">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`inline-flex min-w-0 items-center gap-1 text-left ${
          onClick
            ? "-mx-1 rounded-md px-1 hover:bg-slate-100"
            : "cursor-default"
        } ${isTotal ? "font-semibold text-slate-800" : "text-slate-600"}`}
      >
        {label}
        {onClick ? <History className="h-3.5 w-3.5 text-slate-400" /> : null}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {onDownload ? (
          <button
            type="button"
            title={`Download ${label} report`}
            aria-label={`Download ${label} report`}
            disabled={downloading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDownload();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[var(--aa-navy)] disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
        <span className={`tabular-nums ${valueClass}`}>
          {prefix}
          ₦{formatNumber1(value)}
        </span>
      </div>
    </div>
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
  onDownload,
  downloadingKind = null,
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
            onDownload={() => onDownload?.("collected")}
            downloading={downloadingKind === "collected" || downloadingKind === "all"}
          />
          <TillLine
            label="Imprest"
            value={imprestTotal}
            tone="minus"
            prefix="− "
            onDownload={() => onDownload?.("imprest")}
            downloading={downloadingKind === "imprest" || downloadingKind === "all"}
          />
          <TillLine
            label="Pay Bill"
            value={payBillTotal}
            tone="minus"
            prefix="− "
            onDownload={() => onDownload?.("paybill")}
            downloading={downloadingKind === "paybill" || downloadingKind === "all"}
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
        <button
          type="button"
          disabled={Boolean(downloadingKind)}
          onClick={() => onDownload?.("all")}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:border-[var(--aa-accent)] hover:bg-slate-50 disabled:opacity-50"
        >
          {downloadingKind === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download till report
        </button>
      </DialogContent>
    </Dialog>
  );
}

function formatTillReportWhen(value) {
  if (!value) return "";
  const m = moment(value);
  return m.isValid() ? m.format("DD MMM YYYY HH:mm") : String(value);
}

async function downloadTillExcel({
  businessName,
  cashierName,
  modeLabel,
  fromDate,
  toDate,
  section,
  collected,
  imprest,
  payBills,
  retire,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Verification Points";

  const addSheet = (name, columns, lines, totalLabel, totalValue) => {
    const ws = wb.addWorksheet(name);
    ws.addRow([`${modeLabel} till — ${name}`]);
    if (businessName) ws.addRow([businessName]);
    ws.addRow([`Period: ${fromDate} to ${toDate}`]);
    if (cashierName) ws.addRow([`Prepared for: ${cashierName}`]);
    ws.addRow([]);
    ws.addRow(columns);
    ws.getRow(ws.lastRow.number).font = { bold: true };
    (lines || []).forEach((line) => {
      ws.addRow([
        formatTillReportWhen(line.transaction_date),
        line.sale_code || "",
        line.party || "",
        line.description || "",
        line.by_name || "",
        Number(line.amount) || 0,
      ]);
      ws.getRow(ws.lastRow.number).getCell(6).numFmt = "#,##0.00";
    });
    ws.addRow([]);
    const totalRow = ws.addRow(["", "", "", "", totalLabel, Number(totalValue) || 0]);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = "#,##0.00";
    ws.columns = [
      { width: 20 },
      { width: 18 },
      { width: 28 },
      { width: 36 },
      { width: 22 },
      { width: 14 },
    ];
  };

  const columns = [
    "Date / time",
    "Reference",
    "Customer / supplier",
    "Description",
    "By",
    "Amount",
  ];

  if (section === "all" || section === "collected") {
    addSheet(
      "Collected",
      columns,
      collected?.lines,
      "Collected total",
      collected?.total,
    );
  }
  if (section === "all" || section === "imprest") {
    addSheet(
      "Imprest",
      columns,
      imprest?.lines,
      "Imprest total",
      imprest?.total,
    );
  }
  if (section === "all" || section === "paybill") {
    addSheet(
      "Pay Bill",
      columns,
      payBills?.lines,
      "Pay Bill total",
      payBills?.total,
    );
  }
  if (section === "all") {
    const ws = wb.addWorksheet("Summary");
    ws.addRow([`${modeLabel} till summary`]);
    if (businessName) ws.addRow([businessName]);
    ws.addRow([`Period: ${fromDate} to ${toDate}`]);
    if (cashierName) ws.addRow([`Prepared for: ${cashierName}`]);
    ws.addRow([]);
    ws.addRow(["Item", "Amount"]);
    ws.getRow(ws.lastRow.number).font = { bold: true };
    const summaryRows = [
      ["Collected", Number(collected?.total) || 0],
      ["Imprest", Number(imprest?.total) || 0],
      ["Pay Bill", Number(payBills?.total) || 0],
      [`${modeLabel} to retire`, Number(retire) || 0],
    ];
    summaryRows.forEach(([label, amount]) => {
      const row = ws.addRow([label, amount]);
      row.getCell(2).numFmt = "#,##0.00";
    });
    ws.getRow(ws.lastRow.number).font = { bold: true };
    ws.columns = [{ width: 28 }, { width: 16 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = String(modeLabel || "till")
    .toLowerCase()
    .replace(/\s+/g, "-");
  const part =
    section === "all"
      ? "report"
      : section === "paybill"
        ? "pay-bill"
        : section;
  a.download = `${slug}-till-${part}-${fromDate}-to-${toDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
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
    privilege: "POS Collection",
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

const MAKE_DEPOSIT_PRIVILEGE = "Make Deposit";
const RECONCILIATION_PRIVILEGE = "Collection Reconciliation";
const IMPREST_PRIVILEGE = "Imprest";
const PAY_BILL_PRIVILEGE = "Pay Bill";
const EDIT_INVOICE_PRIVILEGE = "Edit Invoice";

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
  if (t === "card" || t === "pos") return "card";
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

const MODE_CHECK_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "transfer", label: "Transfer", icon: Building2 },
  { value: "card", label: "POS", icon: Nfc },
  { value: "credit", label: "Credit", icon: CreditCard },
  { value: "deposit", label: "Apply Deposit", icon: Wallet },
];

function paymentTypeFromModeChecks(checked) {
  const set = new Set(
    (Array.isArray(checked) ? checked : []).map((id) =>
      String(id || "").toLowerCase(),
    ),
  );
  const hasCash = set.has("cash");
  const hasTransfer = set.has("transfer");
  const hasCard = set.has("card");
  const hasCredit = set.has("credit");
  const hasDeposit = set.has("deposit");
  if (hasDeposit) return "deposit";
  if (hasCredit && (hasCash || hasTransfer || hasCard)) return "credit_split";
  if (hasCredit) return "credit";
  if (
    (hasCash && hasTransfer) ||
    (hasCash && hasCard) ||
    (hasTransfer && hasCard)
  ) {
    return "split";
  }
  if (hasCard && !hasCash && !hasTransfer) return "card";
  if (hasTransfer) return "transfer";
  if (hasCash) return "cash";
  return "";
}

function modeChecksFromRow(row) {
  const fromRow = rowPaymentModes(row).filter((id) =>
    MODE_CHECK_OPTIONS.some((opt) => opt.value === id),
  );
  if (fromRow.length) return fromRow;
  const pt = normalizePaymentMode(row?.payment_type);
  if (pt === "credit_split") return ["credit", "cash", "transfer"];
  if (pt === "split") return ["cash", "transfer"];
  if (pt === "deposit") return ["deposit"];
  if (pt === "card") return ["card"];
  if (pt === "transfer") return ["transfer"];
  if (pt === "credit") return ["credit"];
  if (pt === "cash") return ["cash"];
  return [];
}

function modeChecksEqual(a, b) {
  const left = [...new Set(a || [])].map(String).sort();
  const right = [...new Set(b || [])].map(String).sort();
  return (
    left.length === right.length && left.every((id, i) => id === right[i])
  );
}

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

function leftoverToSettle(row) {
  const due = Number(row?.amount) || 0;
  const sp = row?.split_progress || {};
  const collected =
    Number(sp.collected_total) ||
    (Number(sp.cash) || 0) + (Number(sp.transfer) || 0) + (Number(sp.card) || 0);
  const creditAlloc =
    Number(sp.credit_allocated) || Number(sp.credit) || 0;
  const depositApplied = Number(sp.deposit_applied) || 0;
  const settled = Number(
    (collected + creditAlloc + depositApplied).toFixed(2),
  );
  if (due <= 0) return 0;
  // amount is already the outstanding leftover (cash/credit live in history)
  if (settled > due + 0.05) return due;
  return Math.max(0, Number((due - settled).toFixed(2)));
}

function depositApplyPreview(row) {
  const leftover = leftoverToSettle(row);
  const available = Number(row?.deposit_available) || 0;
  const apply = Math.min(leftover, Math.max(0, available));
  return { due: leftover, leftover, available, apply };
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
  const creditKnown =
    Number(sp.credit_allocated) || Number(sp.credit) || 0;
  const depositExpected = Math.min(
    unappliedDepositCover(row),
    leftoverToSettle(row),
  );
  const depositAmt =
    depositApplied > 0.05 ? depositApplied : depositExpected;

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

function workflowNumericId(value) {
  const id = parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function snapshotInvoiceRow(row) {
  if (!row) return null;
  const sale_code = String(row.sale_code || "").trim();
  if (!sale_code) return null;
  return {
    ...row,
    id: workflowNumericId(row.id) ?? row.id,
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

function alreadyProcessedFromApi(res, fallbackRow) {
  const live = res?.results || fallbackRow || {};
  if (
    res?.already_processed ||
    res?.code === "ALREADY_PROCESSED" ||
    live?.already_processed ||
    isProcessedSalesInvoiceStatus(live?.status || fallbackRow?.status)
  ) {
    return alreadyProcessedInvoiceMessage({
      message: res?.message || live?.processed_message || live?.message,
      status: live?.status || fallbackRow?.status,
      saleCode: live?.sale_code || fallbackRow?.sale_code,
      processedBy: res?.processed_by || live?.processed_by,
    });
  }
  return null;
}

/** Light queue check only — not the full dashboard. Pauses when the tab is hidden. */
const QUEUE_POLL_MS = 15000;

function isRowCreatedOn(row, ymd) {
  const raw = row?.created_at || row?.createdAt;
  if (!raw || !ymd) return false;
  const m = moment(raw);
  return m.isValid() && m.format("YYYY-MM-DD") === ymd;
}

/** Created today or switched/updated today — so Mode Switch lands on Cash/Transfer. */
function isRowOnQueueDay(row, ymd) {
  if (isRowCreatedOn(row, ymd)) return true;
  const raw = row?.updated_at || row?.updatedAt;
  if (!raw || !ymd) return false;
  const m = moment(raw);
  return m.isValid() && m.format("YYYY-MM-DD") === ymd;
}

function isPendingModeSwitchRow(row) {
  return (
    row?.status === "awaiting_payment_mode_approval" ||
    Boolean(row?.proposed_payment_type) ||
    Boolean(row?.pending_payment_mode?.to) ||
    Boolean(row?.pending_payment_mode)
  );
}

function isPostedOrReversedWorkflow(row) {
  const st = String(row?.status || "").toLowerCase();
  return (
    st === "reversed" ||
    st === "cancelled" ||
    st === "payment_confirmed" ||
    st === "invoice_separation" ||
    st === "final_invoice" ||
    st === "warehouse_picking" ||
    st === "dual_signature" ||
    st === "goods_released" ||
    st === "completed" ||
    st === "credit_approved"
  );
}

const POSTED_MODE_CHECK_VALUES = new Set(["cash", "transfer", "card"]);

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
    return isPendingModeSwitchRow(row);
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

function fetchSaleInvoice(saleCode, facilityId) {
  return new Promise((resolve, reject) => {
    _fetchApi(
      `/api/v1/transactions/get-sale?sale_code=${encodeURIComponent(
        saleCode,
      )}&facility_id=${facilityId}`,
      (res) => {
        if (res?.success && res.data) resolve(res.data);
        else reject(new Error(res?.message || "Failed to load sales invoice"));
      },
      (err) =>
        reject(
          err instanceof Error
            ? err
            : new Error(err?.message || "Failed to load sales invoice"),
        ),
    );
  });
}

function mapSaleItemsToEditLines(items) {
  return (Array.isArray(items) ? items : []).map((item, idx) => {
    const qty = Number(item.quantity_sold ?? item.quantity ?? 0) || 0;
    const price = Number(item.selling_price ?? item.price ?? 0) || 0;
    const sku = item.link_id || item.product_id || item.sku || "";
    const bidRaw = item.branchId ?? item.branch_id;
    const bid =
      bidRaw != null && String(bidRaw).trim() !== ""
        ? parseInt(String(bidRaw), 10)
        : null;
    const typeRaw = String(item.item_type || item.type || "").toLowerCase();
    const isService = typeRaw.includes("service");
    return {
      key: `${sku || "line"}-${idx}`,
      product_id: sku,
      item_name: item.item_name || item.description || sku || "Item",
      quantity: qty,
      selling_price: price,
      amount: Number(item.amount) || price * qty,
      branchId: Number.isFinite(bid) && bid > 0 ? bid : null,
      branch_name: item.branch_name || item.warehouse || null,
      item_type: isService ? "Service" : item.item_type || "Finished Good",
      type: typeRaw.includes("pro-bono") ? "Pro-bono" : "Regular",
      taxable: item.taxable,
    };
  });
}

function editLineAmount(line) {
  const qty = Number(line.quantity);
  const price = Number(line.selling_price) || 0;
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return qty * price;
}

function normalizeEditInvoiceRow(row) {
  const sale_code = String(row?.sale_code || row?.invoice_ref || "").trim();
  return {
    sale_code,
    customer_name: row?.customer_name || row?.customerName || "",
    customer_no: row?.customer_no || row?.ref_number || "",
    amount: Number(row?.invoice_amount ?? row?.amount ?? 0) || 0,
    date: row?.date || row?.transaction_date || row?.invoice_date || null,
    status: row?.status || row?.workflow_status || "",
    payment_type:
      row?.payment_type ||
      row?.workflow_payment_type ||
      row?.payment_method ||
      "",
    description: row?.description || "",
  };
}

function paymentModesFromSale(data) {
  const modes = (
    Array.isArray(data?.payment_modes) ? data.payment_modes : []
  ).map((m) => String(m || "").toLowerCase());
  if (modes.length) return [...new Set(modes)];
  const mop = String(data?.mode_of_payment || "").toLowerCase();
  const next = [];
  if (mop.includes("cash")) next.push("cash");
  if (mop.includes("transfer") || mop.includes("bank")) next.push("transfer");
  if (mop.includes("card")) next.push("card");
  if (mop.includes("credit")) next.push("credit");
  if (mop.includes("deposit")) next.push("deposit");
  return next;
}

function exclusiveTaxFromRates(subtotal, discount, taxes) {
  const net = Math.max(0, subtotal - (Number(discount) || 0));
  if (!Array.isArray(taxes) || !taxes.length) return 0;
  return taxes.reduce((sum, tax) => {
    const inc = String(tax.inclusive_type || tax.tax_type || "").toLowerCase();
    if (inc.includes("inclusive")) return sum;
    const rate = parseFloat(tax.rate) || 0;
    return sum + (net * rate) / 100;
  }, 0);
}

async function waitForElementImages(root) {
  const imgs = Array.from(root?.querySelectorAll?.("img") || []);
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
    ),
  );
}

async function saveElementAsPdf(el, filename) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: Math.max(el.scrollWidth, el.clientWidth),
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let y = 0;
  while (y < imgHeight - 0.5) {
    if (y > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, -y, pageWidth, imgHeight);
    y += pageHeight;
  }
  pdf.save(filename);
}

export default function ReceivePayment() {
  const dispatch = useDispatch();
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
    isBusinessOwner(user, activeBusiness) ||
    hasFullAccess(functionalities) ||
    functionalities.includes(SWITCH_PAYMENT_MODE_PRIVILEGE);
  const canEditInvoice =
    isBusinessOwner(user, activeBusiness) ||
    hasFullAccess(functionalities) ||
    functionalities.includes(EDIT_INVOICE_PRIVILEGE);
  const canDiscountCollection =
    isBusinessOwner(user, activeBusiness) ||
    hasFullCollectionAccess ||
    functionalities.includes(DISCOUNT_COLLECTION_PRIVILEGE);
  const canOpenCollectionReconciliation =
    isBusinessOwner(user, activeBusiness) ||
    hasFullCollectionAccess ||
    functionalities.includes(COLLECTION_RECONCILIATION_PRIVILEGE) ||
    functionalities.includes(HAND_IN_PRIVILEGE) ||
    functionalities.includes(RECONCILIATION_HISTORY_PRIVILEGE) ||
    canDiscountCollection;

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
      if (
        privilege === "Card Collection" ||
        privilege === "POS Collection"
      ) {
        return (
          functionalities.includes("Card Collection") ||
          functionalities.includes("POS Collection")
        );
      }
      return false;
    },
    [functionalities],
  );

  const visibleMethodTabs = useMemo(
    () => METHOD_TABS.filter((t) => canViewCollectionTab(t.privilege)),
    [canViewCollectionTab],
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

  useEffect(() => {
    const q = String(searchParams.get("tab") || "").toLowerCase();
    if (q === "discount") {
      navigate("/app/payments/collection-reconciliation?tab=discount", {
        replace: true,
      });
      return;
    }
    if (
      canDiscountCollection &&
      !visibleMethodTabs.length &&
      !canEditInvoice &&
      !functionalities.includes(RECONCILIATION_PRIVILEGE) &&
      !hasFullCollectionAccess
    ) {
      navigate("/app/payments/collection-reconciliation?tab=discount", {
        replace: true,
      });
    }
  }, [
    searchParams,
    navigate,
    canDiscountCollection,
    visibleMethodTabs.length,
    canEditInvoice,
    functionalities,
    hasFullCollectionAccess,
  ]);
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
    () => pending.filter((r) => isRowOnQueueDay(r, todayYmd)),
    [pending, todayYmd],
  );
  const creditPendingToday = useMemo(
    () => creditPending.filter((r) => isRowOnQueueDay(r, todayYmd)),
    [creditPending, todayYmd],
  );
  const depositPendingToday = useMemo(
    () => depositPending.filter((r) => isRowOnQueueDay(r, todayYmd)),
    [depositPending, todayYmd],
  );
  const discountPendingToday = useMemo(
    () => discountPending.filter((r) => isRowOnQueueDay(r, todayYmd)),
    [discountPending, todayYmd],
  );
  const modePendingToday = useMemo(
    () => modePending.filter((r) => isPendingModeSwitchRow(r)),
    [modePending],
  );
  const [imprestOpen, setImprestOpen] = useState(false);
  const [tillHubOpen, setTillHubOpen] = useState(false);
  const [tillDownloadKind, setTillDownloadKind] = useState(null);
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
  const [editInvoiceOpen, setEditInvoiceOpen] = useState(false);
  const [editInvoiceQuery, setEditInvoiceQuery] = useState("");
  const [editInvoiceSale, setEditInvoiceSale] = useState(null);
  const [editInvoiceLines, setEditInvoiceLines] = useState([]);
  const [editInvoiceLoading, setEditInvoiceLoading] = useState(false);
  const [editInvoiceSaving, setEditInvoiceSaving] = useState(false);
  const [editInvoiceDate, setEditInvoiceDate] = useState("");
  const [editInvoiceDiscount, setEditInvoiceDiscount] = useState("");
  const [editInvoiceCustomer, setEditInvoiceCustomer] = useState(null);
  const [editNewCustomerOpen, setEditNewCustomerOpen] = useState(false);
  const [editNewCustomerName, setEditNewCustomerName] = useState("");
  const [editNewCustomerPhone, setEditNewCustomerPhone] = useState("");
  const [editNewCustomerSaving, setEditNewCustomerSaving] = useState(false);
  const [editPaymentModes, setEditPaymentModes] = useState([]);
  const [editProductOptions, setEditProductOptions] = useState([]);
  const [editProductQuery, setEditProductQuery] = useState("");
  const [verificationInvoices, setVerificationInvoices] = useState([]);
  const [loadingVerificationInvoices, setLoadingVerificationInvoices] = useState(
    false,
  );
  const searchInputRef = useRef(null);
  const treatingInvoiceRef = useRef(null);
  const hubInvoiceRequestRef = useRef(0);
  const invoiceDownloadRef = useRef(null);
  const invoiceDownloadTokenRef = useRef(0);
  const queueStampRef = useRef("");
  const queuePollInFlightRef = useRef(false);
  const hubActionRef = useRef("view");
  const hubOpenRef = useRef(false);

  /** Unified view + action hub: collect | credit | discount | mode | view */
  const [hubOpen, setHubOpen] = useState(false);
  const [hubAction, setHubAction] = useState("view");
  const [hubInvoiceData, setHubInvoiceData] = useState(null);
  const [hubLoading, setHubLoading] = useState(false);
  const [invoiceDownloadData, setInvoiceDownloadData] = useState(null);
  const [downloadingSaleCode, setDownloadingSaleCode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [switchingModeCode, setSwitchingModeCode] = useState(null);
  const [modeChangeRow, setModeChangeRow] = useState(null);
  const [modeChangeNext, setModeChangeNext] = useState("");
  const [modeChangeChecked, setModeChangeChecked] = useState([]);
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

  const removeCollectedInvoice = useCallback((saleCode) => {
    const code = String(saleCode || "").trim();
    if (!code) return;
    const keep = (r) => String(r?.sale_code || "").trim() !== code;
    setPending((rows) => rows.filter(keep));
    setCreditPending((rows) => rows.filter(keep));
    setDepositPending((rows) => rows.filter(keep));
    setDiscountPending((rows) => rows.filter(keep));
    setModePending((rows) => rows.filter(keep));
  }, []);

  const fetchDashboard = useCallback((opts = {}) => {
    if (!activeBusiness?.id) return;
    const silent = Boolean(opts && opts.silent);
    if (!silent) setLoading(true);
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
        if (!silent) setLoading(false);
        setDashboardReady(true);
        if (res?.success) {
          const nextPending = res.results?.pending || [];
          const nextCredit = res.results?.credit_pending || [];
          const nextDeposit = res.results?.deposit_pending || [];
          const nextDiscount = res.results?.discount_pending || [];
          const nextMode = res.results?.mode_pending || [];
          const pendingCodes = new Set(
            nextPending
              .map((r) => String(r?.sale_code || "").trim())
              .filter(Boolean),
          );
          setPending([
            ...nextPending,
            ...nextMode.filter((r) => {
              const code = String(r?.sale_code || "").trim();
              return code && !pendingCodes.has(code);
            }),
          ]);
          setCreditPending(nextCredit);
          setDepositPending(nextDeposit);
          setDiscountPending(nextDiscount);
          setModePending(nextMode);
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
          const liveCodes = new Set(
            [...nextPending, ...nextCredit, ...nextDeposit, ...nextDiscount, ...nextMode]
              .map((r) => String(r?.sale_code || "").trim())
              .filter(Boolean),
          );
          const openCode = String(
            treatingInvoiceRef.current?.sale_code || "",
          ).trim();
          const openAction = hubActionRef.current;
          if (
            hubOpenRef.current &&
            openCode &&
            ["collect", "credit", "deposit", "discount", "mode"].includes(
              openAction,
            ) &&
            !liveCodes.has(openCode)
          ) {
            toast.error("This invoice is already processed.");
            treatingInvoiceRef.current = null;
            hubOpenRef.current = false;
            setHubOpen(false);
          }
        } else if (!silent) {
          toast.error(res?.message || "Failed to load collection queue");
        }
      },
      (err) => {
        if (!silent) {
          setLoading(false);
          toast.error(err?.message || "Failed to load collection queue");
        }
        setDashboardReady(true);
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
    queueStampRef.current = "";
    fetchDashboard();
  }, [fetchDashboard]);

  const fetchVerificationInvoices = useCallback(() => {
    if (!activeBusiness?.id) {
      setVerificationInvoices([]);
      return;
    }
    setLoadingVerificationInvoices(true);
    _fetchApi(
      `/api/v1/sale-workflows/verification-invoices?facilityId=${encodeURIComponent(
        String(activeBusiness.id),
      )}`,
      (res) => {
        setLoadingVerificationInvoices(false);
        setVerificationInvoices(Array.isArray(res?.results) ? res.results : []);
      },
      () => {
        setLoadingVerificationInvoices(false);
        setVerificationInvoices([]);
        toast.error("Failed to load invoices for edit");
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (!editInvoiceOpen) return;
    fetchVerificationInvoices();
  }, [editInvoiceOpen, fetchVerificationInvoices]);

  useEffect(() => {
    hubActionRef.current = hubAction;
  }, [hubAction]);

  useEffect(() => {
    hubOpenRef.current = hubOpen;
  }, [hubOpen]);

  useEffect(() => {
    if (!activeBusiness?.id || !dashboardReady) return undefined;

    const params = new URLSearchParams({
      facilityId: String(activeBusiness.id),
    });
    if (user?.id != null) params.set("userId", String(user.id));
    if (user?.role) params.set("role", String(user.role));

    const dropGoneFromQueue = (codes) => {
      const live = new Set(
        (codes || []).map((c) => String(c || "").trim()).filter(Boolean),
      );
      const keep = (row) => live.has(String(row?.sale_code || "").trim());
      setPending((rows) => rows.filter(keep));
      setCreditPending((rows) => rows.filter(keep));
      setDepositPending((rows) => rows.filter(keep));
      setDiscountPending((rows) => rows.filter(keep));
      setModePending((rows) => rows.filter(keep));
      const openCode = String(
        treatingInvoiceRef.current?.sale_code || "",
      ).trim();
      const openAction = hubActionRef.current;
      if (
        hubOpenRef.current &&
        openCode &&
        ["collect", "credit", "deposit", "discount", "mode"].includes(
          openAction,
        ) &&
        !live.has(openCode)
      ) {
        toast.error("This invoice is already processed.");
        treatingInvoiceRef.current = null;
        hubOpenRef.current = false;
        setHubOpen(false);
      }
    };

    const pollQueue = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (queuePollInFlightRef.current) return;
      queuePollInFlightRef.current = true;
      _fetchApi(
        `/api/v1/sale-workflows/cashier-queue-snapshot?${params.toString()}`,
        (res) => {
          queuePollInFlightRef.current = false;
          if (!res?.success || !res.results) return;
          const stamp = String(res.results.stamp || "");
          const codes = Array.isArray(res.results.codes)
            ? res.results.codes
            : [];
          const first = !queueStampRef.current;
          if (stamp && stamp === queueStampRef.current) return;
          queueStampRef.current = stamp;
          dropGoneFromQueue(codes);
          if (!first) fetchDashboard({ silent: true });
        },
        () => {
          queuePollInFlightRef.current = false;
        },
      );
    };

    const id = window.setInterval(pollQueue, QUEUE_POLL_MS);
    const onVisible = () => {
      if (!document.hidden) pollQueue();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    activeBusiness?.id,
    user?.id,
    user?.role,
    dashboardReady,
    fetchDashboard,
  ]);

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
    const leftover = leftoverToSettle(selected);
    const available = Number(selected.deposit_available) || 0;
    const preset = Math.min(Math.max(0, leftover), Math.max(0, available));
    if (preset <= 0.05) return;
    setDepositAmount((prev) => {
      const existing = parseFormattedAmount(prev);
      if (existing > 0.05 && existing <= preset + 0.05) {
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
    selected?.split_progress?.collected_total,
    selected?.split_progress?.credit_allocated,
    selected?.split_progress?.deposit_applied,
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

  const downloadTillReport = useCallback(
    (section) => {
      if (!activeBusiness?.id || tillDownloadKind) return;
      const mode =
        methodTab === "card"
          ? "card"
          : methodTab === "transfer"
            ? "transfer"
            : "cash";
      const from = historyFrom || todayYmd;
      const to = historyTo || from;
      setTillDownloadKind(section);
      const params = new URLSearchParams({
        facilityId: String(activeBusiness.id),
        tillMode: mode,
        fromDate: from,
        toDate: to,
      });
      if (user?.id != null) params.set("userId", String(user.id));
      if (user?.role) params.set("role", String(user.role));
      _fetchApi(
        `/api/v1/sale-workflows/till-report?${params.toString()}`,
        async (res) => {
          if (!res?.success) {
            setTillDownloadKind(null);
            toast.error(res?.message || "Could not load till report");
            return;
          }
          try {
            const cashierName =
              [user?.firstname, user?.lastname]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              user?.name ||
              user?.username ||
              "";
            await downloadTillExcel({
              businessName:
                activeBusiness?.name ||
                activeBusiness?.business_name ||
                "",
              cashierName,
              modeLabel: tillHub.modeLabel,
              fromDate: res.results?.from_date || from,
              toDate: res.results?.to_date || to,
              section,
              collected: res.results?.collected,
              imprest: res.results?.imprest,
              payBills: res.results?.pay_bills,
              retire: res.results?.retire,
            });
            toast.success("Report downloaded");
          } catch (err) {
            console.error(err);
            toast.error("Could not generate Excel");
          } finally {
            setTillDownloadKind(null);
          }
        },
        () => {
          setTillDownloadKind(null);
          toast.error("Could not load till report");
        },
      );
    },
    [
      activeBusiness,
      tillDownloadKind,
      methodTab,
      historyFrom,
      historyTo,
      todayYmd,
      user,
      tillHub.modeLabel,
    ],
  );

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

  const editablePendingInvoices = useMemo(() => {
    const byCode = new Map();
    for (const r of verificationInvoices) {
      const row = normalizeEditInvoiceRow(r);
      const code = String(row?.sale_code || "").trim();
      if (!code || byCode.has(code)) continue;
      if (!isEditableSalesInvoiceStatus(row.status)) continue;
      byCode.set(code, row);
    }
    return Array.from(byCode.values());
  }, [verificationInvoices]);

  const filteredEditInvoices = useMemo(() => {
    const q = editInvoiceQuery.trim().toLowerCase();
    if (!q) return editablePendingInvoices;
    return editablePendingInvoices.filter((r) =>
      [
        r.sale_code,
        r.customer_no,
        r.customer_name,
        r.payment_type,
        r.description,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [editablePendingInvoices, editInvoiceQuery]);

  const filteredEditProducts = useMemo(() => {
    const q = editProductQuery.trim().toLowerCase();
    const list = Array.isArray(editProductOptions) ? editProductOptions : [];
    if (!q) return list.slice(0, 12);
    return list
      .filter((p) =>
        [p.item_name, p.product_id, p.sku, p.branch_name, p.location_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 12);
  }, [editProductOptions, editProductQuery]);

  const goEditInvoice = useCallback(
    async (saleCode) => {
      if (!canEditInvoice) {
        toast.error("You do not have permission to edit invoices.");
        return;
      }
      const code = String(saleCode || "").trim();
      if (!code) {
        toast.error("Enter or select an invoice to edit");
        return;
      }
      if (!activeBusiness?.id) {
        toast.error("Select a business first");
        return;
      }
      const match = editablePendingInvoices.find(
        (r) => String(r.sale_code || "").toLowerCase() === code.toLowerCase(),
      );
      if (!match) {
        toast.error(
          "This invoice is not on Verification Points or has been reversed.",
        );
        return;
      }
      if (!isEditableSalesInvoiceStatus(match.status)) {
        toast.error(
          "This invoice cannot be edited after payment, warehouse processing, or reversal.",
        );
        return;
      }
      setEditInvoiceLoading(true);
      try {
        const data = await fetchSaleInvoice(code, activeBusiness.id);
        const liveStatus = data.workflow_status || data.status;
        if (
          String(liveStatus || "").toLowerCase() === "cancelled" ||
          String(liveStatus || "").toLowerCase() === "reversed"
        ) {
          toast.error("This invoice has been reversed and cannot be edited.");
          return;
        }
        if (!isEditableSalesInvoiceStatus(liveStatus)) {
          toast.error(
            "This invoice cannot be edited after payment or warehouse processing. Issue a credit note instead.",
          );
          return;
        }
        const lines = mapSaleItemsToEditLines(data.items);
        if (!lines.length) {
          toast.error("This invoice has no line items");
          return;
        }
        const customer = data.customer
          ? {
              ...data.customer,
              fullname:
                data.customer.fullname || data.customer.customer_name,
              customerNo: data.customer.customerNo,
            }
          : null;
        setEditInvoiceSale({ ...data, sale_code: code });
        setEditInvoiceLines(lines);
        setEditInvoiceCustomer(customer);
        setEditInvoiceDate(
          data.date ? moment(data.date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD"),
        );
        const origDisc = Number(
          data.discountAmount ?? data.discount_amount ?? data.discount?.amount ?? 0,
        );
        setEditInvoiceDiscount(origDisc > 0 ? String(origDisc) : "");
        setEditPaymentModes(paymentModesFromSale(data));
        setEditProductQuery("");
      } catch (err) {
        toast.error(err?.message || "Failed to load invoice");
      } finally {
        setEditInvoiceLoading(false);
      }
    },
    [editablePendingInvoices, activeBusiness?.id, canEditInvoice],
  );

  const openEditInvoice = useCallback(() => {
    if (!canEditInvoice) {
      toast.error("You do not have permission to edit invoices.");
      return;
    }
    setEditInvoiceQuery(search.trim());
    setEditInvoiceSale(null);
    setEditInvoiceLines([]);
    setEditInvoiceCustomer(null);
    setEditInvoiceDate("");
    setEditInvoiceDiscount("");
    setEditPaymentModes([]);
    setEditInvoiceOpen(true);
    const q = search.trim();
    if (q) {
      const exact = editablePendingInvoices.find(
        (r) => String(r.sale_code || "").toLowerCase() === q.toLowerCase(),
      );
      if (exact) goEditInvoice(exact.sale_code);
    }
  }, [search, editablePendingInvoices, goEditInvoice, canEditInvoice]);

  const closeEditInvoice = useCallback(() => {
    setEditInvoiceOpen(false);
    setEditInvoiceSale(null);
    setEditInvoiceLines([]);
    setEditInvoiceQuery("");
    setEditInvoiceLoading(false);
    setEditInvoiceSaving(false);
    setEditInvoiceCustomer(null);
    setEditNewCustomerOpen(false);
    setEditNewCustomerName("");
    setEditNewCustomerPhone("");
    setEditNewCustomerSaving(false);
    setEditInvoiceDate("");
    setEditInvoiceDiscount("");
    setEditPaymentModes([]);
    setEditProductQuery("");
  }, []);

  useEffect(() => {
    if (!editInvoiceOpen || !editInvoiceSale || !activeBusiness?.id) return;
    if (editProductOptions.length) return;
    _fetchApi(
      `/account/get-ready-for-sales/${activeBusiness.id}?includeStopped=1`,
      (res) => {
        setEditProductOptions(res?.results || []);
      },
      () => setEditProductOptions([]),
    );
  }, [
    editInvoiceOpen,
    editInvoiceSale,
    activeBusiness?.id,
    editProductOptions.length,
  ]);

  const updateEditInvoiceLine = useCallback((key, field, raw) => {
    setEditInvoiceLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        if (raw === "") {
          const next = { ...line, [field]: "", amount: 0 };
          return next;
        }
        const num = parseFloat(String(raw).replace(/,/g, ""));
        if (!Number.isFinite(num) || num < 0) return line;
        const next = { ...line, [field]: num };
        const qty = Number(next.quantity);
        const price = Number(next.selling_price) || 0;
        next.amount =
          Number.isFinite(qty) && qty > 0 ? qty * price : 0;
        return next;
      }),
    );
  }, []);

  const removeEditInvoiceLine = useCallback((key) => {
    setEditInvoiceLines((prev) => prev.filter((line) => line.key !== key));
  }, []);

  const addEditInvoiceProduct = useCallback((product) => {
    if (!product) return;
    const sku = String(
      product.product_id || product.sku || product.item_code || product.id || "",
    ).trim();
    if (!sku) {
      toast.error("This item has no product code");
      return;
    }
    const price = Number(product.selling_price ?? product.price ?? 0) || 0;
    const bidRaw = product.branchId ?? product.branch_id;
    const bid =
      bidRaw != null && String(bidRaw).trim() !== ""
        ? parseInt(String(bidRaw), 10)
        : null;
    const typeRaw = String(product.item_type || product.type || "").toLowerCase();
    const isService = typeRaw.includes("service");
    setEditInvoiceLines((prev) => {
      const existing = prev.find(
        (line) =>
          String(line.product_id) === sku &&
          String(line.branchId || "") === String(Number.isFinite(bid) && bid > 0 ? bid : ""),
      );
      if (existing) {
        return prev.map((line) => {
          if (line.key !== existing.key) return line;
          const qty = (Number(line.quantity) || 0) + 1;
          return { ...line, quantity: qty, amount: qty * (Number(line.selling_price) || 0) };
        });
      }
      return [
        ...prev,
        {
          key: `${sku}-${Date.now()}`,
          product_id: sku,
          item_name: product.item_name || product.description || sku,
          quantity: 1,
          selling_price: price,
          amount: price,
          branchId: Number.isFinite(bid) && bid > 0 ? bid : null,
          branch_name: product.branch_name || product.location_name || null,
          item_type: isService ? "Service" : product.item_type || "Finished Good",
          type: "Regular",
          taxable: product.taxable,
        },
      ];
    });
    setEditProductQuery("");
  }, []);

  const editInvoiceTotals = useMemo(() => {
    const subtotal = editInvoiceLines.reduce(
      (sum, line) => sum + editLineAmount(line),
      0,
    );
    let discount = parseFloat(String(editInvoiceDiscount).replace(/,/g, "")) || 0;
    if (discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;
    discount = Number(discount.toFixed(2));
    const exclusiveTax = Number(
      exclusiveTaxFromRates(
        subtotal,
        discount,
        editInvoiceSale?.taxes,
      ).toFixed(2),
    );
    return {
      subtotal,
      discount,
      exclusiveTax,
      total: Math.max(0, subtotal - discount + exclusiveTax),
    };
  }, [editInvoiceLines, editInvoiceDiscount, editInvoiceSale?.taxes]);

  const createInstantEditCustomer = useCallback(() => {
    const name = String(editNewCustomerName || "").trim();
    const phone = String(editNewCustomerPhone || "").trim();
    if (!name) {
      toast.error("Enter the customer name");
      return;
    }
    if (!phone) {
      toast.error("Enter the customer phone number");
      return;
    }
    if (!isValidNigerianPhone(phone)) {
      toast.error(NIGERIAN_PHONE_HINT);
      return;
    }
    if (!activeBusiness?.id) {
      toast.error("Select a business first");
      return;
    }
    if (
      !activeBusiness?.receivable_code ||
      !activeBusiness?.receivable_accural_code ||
      !activeBusiness?.opening_balance_equity
    ) {
      toast.error(
        "Set receivable, deposit, and opening balance equity accounts before creating a customer.",
      );
      return;
    }
    const branchId =
      editInvoiceLines.find((l) => l.branchId)?.branchId ||
      editInvoiceSale?.branch_id ||
      editInvoiceSale?.branchId ||
      user?.branchId ||
      (Array.isArray(user?.branchIds) ? user.branchIds[0] : null) ||
      null;
    setEditNewCustomerSaving(true);
    _postApi(
      "/create-customer",
      {
        query_type: "create",
        fullname: name,
        name,
        phone: normalizeNigerianPhone(phone),
        customer_type: "walk-in",
        entity_type: "individual",
        credit_limit: 0,
        facilityId: activeBusiness.id,
        branch_id: branchId,
        receivable_code: activeBusiness.receivable_code,
        deposit_code: activeBusiness.receivable_accural_code,
        head: activeBusiness.receivable_code,
        opening_balance_equity: activeBusiness.opening_balance_equity,
        created_by: user?.id,
      },
      (res) => {
        setEditNewCustomerSaving(false);
        if (!res?.success) {
          toast.error(res?.message || "Failed to create customer");
          return;
        }
        const createdRaw = res.data?.customer || res.customer;
        const created = createdRaw?.dataValues || createdRaw;
        const customerNo = created?.customerNo || res.data?.customerNo;
        const customer = created
          ? {
              ...created,
              customerNo: created.customerNo || customerNo,
              fullname: created.fullname || created.name || name,
              phone: created.phone || normalizeNigerianPhone(phone),
              customer_type: created.customer_type || "walk-in",
              credit_limit: 0,
            }
          : {
              customerNo,
              fullname: name,
              phone: normalizeNigerianPhone(phone),
              customer_type: "walk-in",
              credit_limit: 0,
            };
        setEditInvoiceCustomer(customer);
        dispatch(getCustomers());
        setEditNewCustomerOpen(false);
        setEditNewCustomerName("");
        setEditNewCustomerPhone("");
        toast.success("Customer created and selected");
      },
      (err) => {
        setEditNewCustomerSaving(false);
        toast.error(err?.message || "Failed to create customer");
      },
    );
  }, [
    editNewCustomerName,
    editNewCustomerPhone,
    activeBusiness,
    editInvoiceLines,
    editInvoiceSale,
    user,
    dispatch,
  ]);

  const saveEditInvoiceQuantities = useCallback(() => {
    if (!canEditInvoice) {
      toast.error("You do not have permission to edit invoices.");
      return;
    }
    if (!editInvoiceSale || !activeBusiness?.id || !user?.id) {
      toast.error("Session required");
      return;
    }
    const saleCode =
      editInvoiceSale.sale_code || editInvoiceSale.transaction?.id || "";
    const lines = editInvoiceLines
      .map((line) => ({
        ...line,
        quantity: Number(line.quantity),
        selling_price: Number(line.selling_price) || 0,
      }))
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);
    if (!lines.length) {
      toast.error("Enter a quantity greater than zero on at least one item");
      return;
    }
    if (lines.some((line) => !line.product_id)) {
      toast.error("A line is missing a product code and cannot be saved");
      return;
    }
    const customerNo =
      editInvoiceCustomer?.customerNo ||
      editInvoiceSale.customer?.customerNo ||
      editInvoiceSale.customer_no;
    if (!customerNo) {
      toast.error("Select a customer for this invoice");
      return;
    }

    const modes = (editPaymentModes.length
      ? editPaymentModes
      : paymentModesFromSale(editInvoiceSale)
    ).map((m) => String(m || "").toLowerCase());
    if (!modes.length) {
      toast.error("Select at least one payment mode");
      return;
    }
    const hasCollectMode =
      modes.includes("cash") ||
      modes.includes("transfer") ||
      modes.includes("card");
    const saleBranchId = lines.find((l) => l.branchId)?.branchId || 0;
    const txnDate = editInvoiceDate
      ? moment(editInvoiceDate).format("YYYY-MM-DD")
      : moment().format("YYYY-MM-DD");
    const d = editInvoiceSale.discount;
    const discount_info =
      d && d.discount_id
        ? {
            discount_id: d.discount_id,
            discount_name: d.discount_name || d.name,
            discount_type: d.discount_type,
            value: parseFloat(d.value),
            customer_type: d.customer_type,
          }
        : null;
    const taxes = Array.isArray(editInvoiceSale.taxes)
      ? editInvoiceSale.taxes.map((t) => ({
          id: t.id,
          name: t.description || t.name,
          description: t.description || t.name,
          rate: parseFloat(t.rate) || 0,
          head: t.account_sub_head || t.account_head || t.head,
          account_head: t.account_head || t.account_sub_head || t.head,
          account_sub_head: t.account_sub_head || t.account_head || t.head,
          tax_type: t.tax_type,
          rate_type: t.rate_type || "percentage",
          inclusive_type: t.inclusive_type,
        }))
      : [];

    setEditInvoiceSaving(true);
    _postApi(
      "/api/v1/transactions/create-sale",
      {
        edit_sale_code: saleCode,
        customer_id: customerNo,
        items: lines.map((line) => ({
          product_id: line.product_id,
          sku: line.product_id,
          item_name: line.item_name,
          quantity: line.quantity,
          quantity_sold: line.quantity,
          selling_price: line.selling_price,
          price: line.selling_price,
          amount: line.quantity * line.selling_price,
          type: line.type,
          item_type: line.item_type,
          taxable: line.taxable,
          branchId: line.branchId,
          branch_id: line.branchId,
          status: "for sale",
        })),
        discount_amount: editInvoiceTotals.discount,
        discount: editInvoiceTotals.discount,
        discount_info,
        taxes,
        tax_amount: editInvoiceTotals.exclusiveTax,
        total_amount: editInvoiceTotals.total,
        txn_type:
          hasCollectMode && !modes.includes("credit")
            ? "Cash Sale"
            : "Credit Sale",
        modeOfPayment: modes.length ? modes.join(",") : "CREDIT",
        payment_modes: modes,
        facilityId: activeBusiness.id,
        created_by: user.id,
        receivable_code: activeBusiness.receivable_code,
        receivable_accural_code: activeBusiness.receivable_accural_code,
        cost_of_sale: activeBusiness.cost_of_sale,
        sale_revenue_code: activeBusiness.sale_revenue_code,
        finished_goods_code: activeBusiness.finished_goods_code,
        inventory_account: activeBusiness.inventory_account || null,
        pro_bono_code: activeBusiness.pro_bono_code,
        transaction_date: txnDate,
        sale_branch_id: saleBranchId,
        defer_payment: hasCollectMode,
        apply_prepayment: false,
      },
      (response) => {
        setEditInvoiceSaving(false);
        if (response?.success) {
          toast.success(
            `Invoice ${saleCode} updated — ledger, invoice, and stock rebuilt`,
          );
          closeEditInvoice();
          fetchDashboard();
        } else {
          toast.error(response?.message || "Failed to update invoice");
        }
      },
      (error) => {
        setEditInvoiceSaving(false);
        toast.error(error?.message || "Failed to update invoice");
      },
    );
  }, [
    editInvoiceSale,
    editInvoiceLines,
    editInvoiceTotals,
    editInvoiceCustomer,
    editInvoiceDate,
    editPaymentModes,
    activeBusiness,
    user?.id,
    closeEditInvoice,
    fetchDashboard,
    canEditInvoice,
  ]);

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

  const downloadSalesInvoice = useCallback(
    async (row) => {
      const code = String(row?.sale_code || "").trim();
      if (!code) {
        toast.error("This row has no invoice number");
        return;
      }
      if (row?.kind === "customer_advance") {
        toast.error("Customer deposits do not have a sales invoice");
        return;
      }
      if (!activeBusiness?.id) {
        toast.error("Select a business first");
        return;
      }
      const token = invoiceDownloadTokenRef.current + 1;
      invoiceDownloadTokenRef.current = token;
      setDownloadingSaleCode(code);
      setInvoiceDownloadData(null);
      try {
        const data = await fetchSaleInvoice(code, activeBusiness.id);
        if (invoiceDownloadTokenRef.current !== token) return;
        setInvoiceDownloadData(data);
      } catch (err) {
        if (invoiceDownloadTokenRef.current !== token) return;
        setDownloadingSaleCode(null);
        toast.error(err?.message || "Failed to load sales invoice");
      }
    },
    [activeBusiness?.id],
  );

  useEffect(() => {
    if (!invoiceDownloadData || !downloadingSaleCode) return;
    const token = invoiceDownloadTokenRef.current;
    let cancelled = false;
    const run = async () => {
      try {
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (cancelled || invoiceDownloadTokenRef.current !== token) return;
        const root = invoiceDownloadRef.current;
        const el =
          root?.querySelector(".invoice-container") ||
          root?.querySelector(".invoice-page") ||
          root;
        if (!el) {
          throw new Error("Sales invoice is not ready to download");
        }
        await waitForElementImages(el);
        if (cancelled || invoiceDownloadTokenRef.current !== token) return;
        await saveElementAsPdf(el, `${downloadingSaleCode}.pdf`);
        if (cancelled || invoiceDownloadTokenRef.current !== token) return;
        toast.success(`Downloaded ${downloadingSaleCode}`);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error(err?.message || "Could not download sales invoice");
        }
      } finally {
        if (!cancelled && invoiceDownloadTokenRef.current === token) {
          setDownloadingSaleCode(null);
          setInvoiceDownloadData(null);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [invoiceDownloadData, downloadingSaleCode]);

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
      if (pt === "credit") return "credit";
      return "collect";
    },
    [methodTab],
  );

  const resolveTreatingInvoice = () => {
    const treating = treatingInvoiceRef.current;
    const code = String(
      treating?.sale_code || selected?.sale_code || "",
    ).trim();
    if (!code) return null;
    const selectedCode = String(selected?.sale_code || "").trim();
    if (selectedCode && selectedCode !== code) return null;
    if (treating?.sale_code && String(treating.sale_code).trim() !== code) {
      return null;
    }
    const lists = [
      selected,
      treating,
      ...pending,
      ...creditPending,
      ...depositPending,
    ];
    const match = lists.find(
      (r) => String(r?.sale_code || "").trim() === code,
    );
    return {
      sale_code: code,
      id: workflowNumericId(treating?.id) ?? workflowNumericId(match?.id),
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
    const leftover = leftoverToSettle(row);
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
    if (leftover <= 0.05) {
      toast.error("This invoice has no leftover balance to apply deposit to");
      return;
    }
    if (depAmt - leftover > 0.05) {
      toast.error(
        `Deposit cannot exceed leftover ₦${formatNumber1(leftover)}`,
      );
      return;
    }
    if (depAmt - available > 0.05) {
      toast.error(
        `Deposit cannot exceed available ₦${formatNumber1(available)}`,
      );
      return;
    }

    const remaining = Number((leftover - depAmt).toFixed(2));

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
              : "Last payment (deposit) recorded — opening invoice to print",
          );
          if (remaining <= 0.05) {
            removeCollectedInvoice(saleCode);
          }
          setSearch("");
      setActiveTab("pending");
      setDepositConfirmRow(null);
      setHubOpen(false);
      fetchDashboard();
      if (remaining <= 0.05 && saleCode) {
        navigate(
          `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
            saleCode,
          )}&doc=invoice`,
        );
      }
    } catch (err) {
      handleAlreadyProcessedError(
        err || { message: "Could not apply deposit" },
        saleCode,
      );
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
    removeCollectedInvoice,
  ]);

  const openHub = useCallback(
    (row, preferredAction = null, options = {}) => {
      if (!row?.sale_code) return;
      const action = resolveHubAction(row, preferredAction);
      const pt = String(row?.payment_type || "").toLowerCase();
      const skipLiveCheck = Boolean(options.skipLiveCheck);

      if (action === "collect" && pt === "credit") {
        toast.info(
          "Credit invoices are approved on the Credit tab — not collected as cash/transfer",
        );
        return;
      }

      if (
        !skipLiveCheck &&
        action !== "view" &&
        activeBusiness?.id &&
        row.sale_code
      ) {
        _fetchApi(
          `/api/v1/sale-workflows/one?facilityId=${encodeURIComponent(
            activeBusiness.id,
          )}&saleCode=${encodeURIComponent(row.sale_code)}`,
          (res) => {
            const processedMsg = alreadyProcessedFromApi(res, row);
            if (processedMsg) {
              toast.error(processedMsg);
              removeCollectedInvoice(row.sale_code);
              fetchDashboard();
              return;
            }
            const live = res?.success ? res.results : null;
            openHub(
              live ? { ...row, ...live, sale_code: row.sale_code } : row,
              preferredAction,
              { skipLiveCheck: true },
            );
          },
          () => {
            openHub(row, preferredAction, { skipLiveCheck: true });
          },
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
        const preview = depositApplyPreview(snapshot);
        const preset = preview.apply;
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
    [
      loadHubInvoice,
      resolveHubAction,
      methodTab,
      activeBusiness?.id,
      removeCollectedInvoice,
      fetchDashboard,
    ],
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
        toast.error(
          alreadyProcessedInvoiceMessage({
            saleCode: historyMatch.sale_code,
            status: historyMatch.status,
          }),
        );
        if (!historyMatch.kind || historyMatch.kind !== "customer_advance") {
          openHub(historyMatch, "view", { skipLiveCheck: true });
        }
        return;
      }

      const looksLikeCode = !/\s/.test(code) && code.length >= 3;
      if (!looksLikeCode && !fromScan) return;
      if (!activeBusiness?.id) {
        toast.error(`No collection invoice found for ${code}`);
        return;
      }

      _fetchApi(
        `/api/v1/sale-workflows/one?facilityId=${encodeURIComponent(
          activeBusiness.id,
        )}&saleCode=${encodeURIComponent(code)}`,
        (res) => {
          if (!res?.success || !res.results) {
            toast.error(res?.message || `No collection invoice found for ${code}`);
            return;
          }
          const live = res.results;
          const processedMsg = alreadyProcessedFromApi(res, live);
          if (processedMsg) {
            toast.error(processedMsg);
            setActiveTab("history");
            openHub(live, "view", { skipLiveCheck: true });
            return;
          }
          const pt = String(live.payment_type || "").toLowerCase();
          if (pt === "deposit") {
            setMethodTab("deposit");
            openHub(live, "deposit", { skipLiveCheck: true });
            if (fromScan) toast.success(`Scanned ${live.sale_code}`);
            return;
          }
          if (pt === "credit" || live.status === "awaiting_credit_approval") {
            setMethodTab("credit");
            openHub(live, "credit", { skipLiveCheck: true });
            if (fromScan) toast.success(`Scanned ${live.sale_code}`);
            return;
          }
          if (pt === "transfer" || pt === "bank") {
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
          }
          openHub(live, "collect", { skipLiveCheck: true });
          if (fromScan) toast.success(`Scanned ${live.sale_code}`);
        },
        () => toast.error(`No collection invoice found for ${code}`),
      );
    },
    // openHub only uses setters + row data; safe across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      history,
      pending,
      creditPending,
      depositPending,
      canViewCollectionTab,
      methodTab,
      openHub,
      activeBusiness?.id,
    ],
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
      (tab === "card" || tab === "pos") &&
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

  const handleAlreadyProcessedError = (err, saleCode) => {
    const processedMsg = alreadyProcessedFromApi(err, { sale_code: saleCode });
    const text =
      processedMsg ||
      err?.message ||
      err?.error ||
      "This invoice is already processed.";
    toast.error(text);
    if (
      processedMsg ||
      err?.already_processed ||
      err?.code === "ALREADY_PROCESSED" ||
      /already processed/i.test(String(text))
    ) {
      if (saleCode) removeCollectedInvoice(saleCode);
      closeHub();
      fetchDashboard();
    }
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
    const posted = isPostedOrReversedWorkflow(row);
    const checked = modeChecksFromRow(row).filter((id) =>
      posted ? POSTED_MODE_CHECK_VALUES.has(id) : true,
    );
    const fallback = posted
      ? POSTED_MODE_CHECK_VALUES.has(current)
        ? [current]
        : []
      : current
        ? [current]
        : [];
    setModeChangeRow(row);
    setModeChangeChecked(checked.length ? checked : fallback);
    setModeChangeNext(
      paymentTypeFromModeChecks(checked.length ? checked : fallback) ||
        (posted ? "" : current),
    );
  };

  const closeModeChange = () => {
    if (switchingModeCode) return;
    setModeChangeRow(null);
    setModeChangeNext("");
    setModeChangeChecked([]);
  };

  const toggleModeCheck = (value) => {
    setModeChangeChecked((prev) => {
      const on = prev.includes(value);
      const next = on ? prev.filter((id) => id !== value) : [...prev, value];
      setModeChangeNext(paymentTypeFromModeChecks(next));
      return next;
    });
  };

  const confirmModeChange = () => {
    if (!modeChangeRow?.sale_code || !activeBusiness?.id) {
      return;
    }
    const nextType =
      paymentTypeFromModeChecks(modeChangeChecked) || modeChangeNext;
    if (!nextType) {
      toast.error("Tick at least one payment mode");
      return;
    }
    if (
      isPostedOrReversedWorkflow(modeChangeRow) &&
      !["cash", "transfer", "card", "split"].includes(nextType)
    ) {
      toast.error(
        "Paid or reversed invoices can only switch between Cash, Transfer, POS, or Cash + Transfer.",
      );
      return;
    }
    const current = normalizePaymentMode(
      modeChangeRow.payment_type ||
        (methodTab === "credit" ? "credit" : "cash"),
    );
    const currentChecks = modeChecksFromRow(modeChangeRow);
    if (current === nextType && modeChecksEqual(currentChecks, modeChangeChecked)) {
      toast.message("Same payment mode selected");
      return;
    }

    // Change applies on Cash / Transfer / POS / Credit immediately.
    // There is no Mode Switch approval queue.
    const requireApproval = false;

    setSwitchingModeCode(modeChangeRow.sale_code);
    _postApi(
      "/api/v1/sale-workflows/special-treatment",
      {
        facilityId: activeBusiness.id,
        saleCodes: [modeChangeRow.sale_code],
        paymentType: nextType,
        payment_modes: modeChangeChecked,
        updated_by: user?.id,
        requireApproval,
        note: `Verification Points: payment mode ${current} → ${nextType}`,
      },
      (res) => {
        setSwitchingModeCode(null);
        if (res?.success) {
          const skipped = Array.isArray(res.results)
            ? res.results.find((r) => r.skipped)
            : null;
          const unchanged =
            Array.isArray(res.results) &&
            res.results.length > 0 &&
            res.results.every((r) => r.changed === false && !r.skipped);
          if (skipped) {
            toast.error(skipped.reason || "Cannot change payment mode");
          } else if (unchanged) {
            toast.message("Same payment mode selected");
          } else {
            if (nextType === "credit" && !requireApproval) {
              toast.success(
                "Switched to Credit — approve on the Credit tab, then it opens Sales Process",
              );
            } else {
              toast.success(
                res.message ||
                  (requireApproval
                    ? `Submitted switch to ${paymentTypeLabel(nextType)} for approval`
                    : `Switched to ${paymentTypeLabel(nextType)}`),
              );
            }
            setModeChangeRow(null);
            setModeChangeNext("");
            setModeChangeChecked([]);
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
          handleAlreadyProcessedError(
            res || { message: "Could not approve credit" },
            row?.sale_code,
          );
        }
      },
      (err) => {
        setSubmitting(false);
        handleAlreadyProcessedError(
          err || { message: "Could not approve credit" },
          row?.sale_code,
        );
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
    if (!target?.sale_code) {
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
        workflowId: target.id || undefined,
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
          handleAlreadyProcessedError(
            res || { message: "Could not confirm credit amount" },
            saleCode,
          );
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
              removeCollectedInvoice(saleCode);
              setSearch("");
              setActiveTab("pending");
              closeHub();
              fetchDashboard();
            } else {
              toast.success("Last payment (credit) recorded");
              removeCollectedInvoice(saleCode);
              setSearch("");
              setActiveTab("pending");
              closeHub();
              fetchDashboard();
            }
          },
          (err) => {
            setSubmitting(false);
            toast.success("Last payment (credit) recorded");
            removeCollectedInvoice(saleCode);
            setSearch("");
            setActiveTab("pending");
            closeHub();
            fetchDashboard();
          },
        );
      },
      (err) => {
        setSubmitting(false);
        handleAlreadyProcessedError(
          err || { message: "Could not confirm credit amount" },
          saleCode,
        );
      },
    );
  };

  const confirmPayment = () => {
    if (!selected || !activeBusiness?.id) return;
    const target = resolveTreatingInvoice();
    if (!target?.sale_code) {
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
        toast.error("This invoice is already processed.");
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
        workflowId: target.id || undefined,
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
              ? res.message || "Payment confirmed — opening invoice to print"
              : res.message || "Payment recorded",
          );
          if (lastPay) {
            removeCollectedInvoice(target.sale_code);
          }
          setSearch("");
          setActiveTab("pending");
          closeCollect();
          fetchDashboard();
          if (lastPay && target?.sale_code) {
            navigate(
              `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                target.sale_code,
              )}&doc=invoice`,
            );
          }
        } else {
          handleAlreadyProcessedError(
            res || { message: "Could not confirm payment" },
            target.sale_code,
          );
        }
      },
      (err) => {
        setSubmitting(false);
        handleAlreadyProcessedError(
          err || { message: "Could not confirm payment" },
          target.sale_code,
        );
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
    methodTab === "discount"
      ? "xl:grid-cols-1 sm:grid-cols-1"
      : "xl:grid-cols-2";

  const canReconcileCollections = canUseHeaderAction(RECONCILIATION_PRIVILEGE);
  const canImprest = canUseHeaderAction(IMPREST_PRIVILEGE);
  const canPayBill = canUseHeaderAction(PAY_BILL_PRIVILEGE);

  if (
    !visibleMethodTabs.length &&
    !canReconcileCollections &&
    !canEditInvoice &&
    !canDiscountCollection &&
    !canOpenCollectionReconciliation
  ) {
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
              or Apply Deposit under Sales → Verification Points. Discount
              approval is on Collection Reconciliation.
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
            {canOpenCollectionReconciliation ? (
            <Link
              to="/app/payments/collection-reconciliation"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              Collection Reconciliation
            </Link>
            ) : null}
            {canDiscountCollection ? (
            <Link
              to="/app/payments/collection-reconciliation?tab=discount"
              className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 shadow-sm hover:bg-orange-100"
            >
              <Percent className="h-4 w-4" />
              Discount
              {methodPendingCounts.discount > 0 ? (
                <span className="rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">
                  {methodPendingCounts.discount}
                </span>
              ) : (
                <span className="rounded-full bg-orange-200 px-1.5 text-[10px] font-bold text-orange-800">
                  {methodPendingCounts.discount || 0}
                </span>
              )}
            </Link>
            ) : null}
            {canEditInvoice ? (
            <button
              type="button"
              onClick={openEditInvoice}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit Invoice
            </button>
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
            const showCount = true;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMethodTab(tab.id)}
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
                {` (${filteredPending.length})`}
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
                      <th className="px-4 py-3 text-right">Amount due</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPending.map((row) => (
                      <tr
                        key={`${row.sale_code}:${row.id || ""}`}
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
                          {methodTab === "discount" ? (
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
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          ₦{formatNumber1(row.invoice_amount ?? row.amount)}
                          {Math.abs(
                            Number(row.invoice_amount ?? row.amount) -
                              Number(row.amount),
                          ) > 0.05 ? (
                            <div className="mt-0.5 text-[11px] font-medium text-amber-800">
                              Due now ₦{formatNumber1(row.amount)}
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
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
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
                          ) : isPendingModeSwitchRow(row) ? null : isDepositPendingCollection(row, methodTab) ? (
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
                          {canSwitchPaymentMode &&
                          (methodTab === "cash" ||
                            methodTab === "transfer" ||
                            methodTab === "card" ||
                            methodTab === "credit") ? (
                            <button
                              type="button"
                              disabled={
                                switchingModeCode === row.sale_code ||
                                submitting
                              }
                              onClick={() => openModeChange(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((row) => {
                    const isAdvance = row.kind === "customer_advance";
                    const updated =
                      row.updatedAt || row.updated_at || row.createdAt;
                    return (
                    <tr key={String(row.sale_code || row.id)} className="hover:bg-slate-50/80">
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
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ₦{formatNumber1(row.amount)}
                        {Number(row.discount_amount) > 0 ? (
                          <div className="mt-0.5 text-[11px] font-medium text-orange-700">
                            Discount −₦{formatNumber1(row.discount_amount)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const st = String(row.status || "").toLowerCase();
                          const reversed =
                            st === "reversed" || st === "cancelled";
                          return (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            reversed ? "text-red-700" : "text-emerald-700"
                          }`}
                        >
                          {reversed ? null : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {reversed
                            ? st === "cancelled"
                              ? "Cancelled"
                              : "Reversed"
                            : methodTab === "credit" && !isAdvance
                            ? "Credited"
                            : row.status_label || row.status}
                        </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {updated
                          ? moment(updated).format("DD MMM, HH:mm")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAdvance ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {canSwitchPaymentMode &&
                          (methodTab === "cash" ||
                            methodTab === "transfer" ||
                            methodTab === "card" ||
                            methodTab === "credit") ? (
                            <button
                              type="button"
                              disabled={
                                switchingModeCode === row.sale_code ||
                                submitting
                              }
                              onClick={() => openModeChange(row)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {switchingModeCode === row.sale_code ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ArrowRightLeft className="h-3 w-3" />
                              )}
                              Change
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => downloadSalesInvoice(row)}
                            disabled={downloadingSaleCode === row.sale_code}
                            title="Download sales invoice"
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {downloadingSaleCode === row.sale_code ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            Download
                          </button>
                          </div>
                        )}
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
                  showPrintButton={hubAction === "view"}
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
                  {Math.abs(
                    Number(selected?.invoice_amount ?? amountDue) - amountDue,
                  ) > 0.05 ? (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Invoice amount</span>
                      <span className="tabular-nums">
                        ₦{formatNumber1(selected?.invoice_amount)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Amount due</span>
                    <span className="text-lg font-semibold tabular-nums text-slate-900">
                      ₦{formatNumber1(amountDue)}
                    </span>
                  </div>
                  {hubAction === "deposit" &&
                  leftoverToSettle(selected) + 0.05 < amountDue ? (
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-slate-600">Left to settle</span>
                      <span className="font-semibold tabular-nums text-teal-800">
                        ₦{formatNumber1(leftoverToSettle(selected))}
                      </span>
                    </div>
                  ) : null}
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
                          onChange={(e) => {
                            const raw = e.target.value;
                            const max = depositApplyPreview(selected).apply;
                            const parsed = parseFormattedAmount(raw);
                            if (max > 0 && parsed > max + 0.05) {
                              setDepositAmount(
                                formatNumberWithCommas(String(max)),
                              );
                              toast.error(
                                `Deposit cannot exceed ₦${formatNumber1(max)}`,
                              );
                              return;
                            }
                            setDepositAmount(formatNumberWithCommas(raw));
                          }}
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
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = parseFormattedAmount(raw);
                          if (
                            unpaidBeforeCredit > 0 &&
                            parsed > unpaidBeforeCredit + 0.05
                          ) {
                            setCreditAmount(
                              formatNumberWithCommas(String(unpaidBeforeCredit)),
                            );
                            toast.error(
                              `Credit cannot exceed ₦${formatNumber1(unpaidBeforeCredit)}`,
                            );
                            return;
                          }
                          setCreditAmount(formatNumberWithCommas(raw));
                        }}
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
                              onChange={(e) => {
                                const raw = e.target.value;
                                const max = remainingDue;
                                const parsed = parseFormattedAmount(raw);
                                if (max > 0 && parsed > max + 0.05) {
                                  setCashAmount(
                                    formatNumberWithCommas(String(max)),
                                  );
                                  toast.error(
                                    `Cash cannot exceed ₦${formatNumber1(max)}`,
                                  );
                                  return;
                                }
                                setCashAmount(formatNumberWithCommas(raw));
                              }}
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
                              onChange={(e) => {
                                const raw = e.target.value;
                                const max = remainingDue;
                                const parsed = parseFormattedAmount(raw);
                                if (max > 0 && parsed > max + 0.05) {
                                  setTransferAmount(
                                    formatNumberWithCommas(String(max)),
                                  );
                                  toast.error(
                                    `Transfer cannot exceed ₦${formatNumber1(max)}`,
                                  );
                                  return;
                                }
                                setTransferAmount(formatNumberWithCommas(raw));
                              }}
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
                              onChange={(e) => {
                                const raw = e.target.value;
                                const max = remainingDue;
                                const parsed = parseFormattedAmount(raw);
                                if (max > 0 && parsed > max + 0.05) {
                                  setTransferAmount(
                                    formatNumberWithCommas(String(max)),
                                  );
                                  toast.error(
                                    `POS cannot exceed ₦${formatNumber1(max)}`,
                                  );
                                  return;
                                }
                                setTransferAmount(formatNumberWithCommas(raw));
                              }}
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
                    Apply only the leftover after cash, transfer, POS, and
                    credit. If anything is still left, collect it on Cash —
                    printing opens after that last payment.
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

                  {hubAction === "view" && selected?.sale_code ? (
                    <>
                      {canSwitchPaymentMode ? (
                        <button
                          type="button"
                          disabled={
                            switchingModeCode === selected.sale_code ||
                            submitting
                          }
                          onClick={() => openModeChange(selected)}
                          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {switchingModeCode === selected.sale_code ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="h-4 w-4" />
                          )}
                          Change
                        </button>
                      ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                            selected.sale_code,
                          )}&doc=invoice`,
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      <Printer className="h-4 w-4" />
                      Open / Print Invoice
                    </button>
                    </>
                  ) : null}

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
                    {paymentTypeLabel(
                      modeChangeRow.payment_type,
                      modeChangeRow,
                    )}
                  </span>
                </>
              ) : (
                "Select the new payment mode, then confirm."
              )}
            </DialogDescription>
          </DialogHeader>

          {isPostedOrReversedWorkflow(modeChangeRow) ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              This invoice is already paid or reversed. You can only switch
              between Cash, Transfer, POS, or Cash + Transfer. Collection
              entries are not rewritten.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 py-1 sm:grid-cols-2">
            {MODE_CHECK_OPTIONS.filter((opt) =>
              isPostedOrReversedWorkflow(modeChangeRow)
                ? POSTED_MODE_CHECK_VALUES.has(opt.value)
                : true,
            ).map((opt) => {
              const Icon = opt.icon;
              const checked = modeChangeChecked.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleModeCheck(opt.value)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    checked
                      ? "border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-white bg-white text-[var(--aa-navy)]"
                        : "border-slate-400 bg-white"
                    }`}
                  >
                    {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                  </span>
                  <Icon className="h-4 w-4 shrink-0" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {modeChangeRow && paymentTypeFromModeChecks(modeChangeChecked) ? (
            <p className="text-xs text-slate-500">
              Selected:{" "}
              <span className="font-semibold text-slate-800">
                {modeChangeChecked
                  .map((id) => MODE_LABELS[id] || id)
                  .join(" + ") || "—"}
              </span>
            </p>
          ) : (
            <p className="text-xs text-amber-700">Tick at least one payment mode.</p>
          )}

          {modeChangeRow &&
          paymentTypeFromModeChecks(modeChangeChecked) &&
          !modeChecksEqual(
            modeChecksFromRow(modeChangeRow),
            modeChangeChecked,
          ) ? (
            <div className="space-y-2">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Switch from{" "}
                <span className="font-semibold text-slate-900">
                  {paymentTypeLabel(
                    modeChangeRow.payment_type,
                    modeChangeRow,
                  )}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-900">
                  {modeChangeChecked
                    .map((id) => MODE_LABELS[id] || id)
                    .join(" + ")}
                </span>
                {isPostedOrReversedWorkflow(modeChangeRow)
                  ? ". This invoice is already paid or reversed — the recorded payment mode will be updated."
                  : ". This will apply immediately."}
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
                !paymentTypeFromModeChecks(modeChangeChecked) ||
                modeChecksEqual(
                  modeChecksFromRow(modeChangeRow),
                  modeChangeChecked,
                )
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
      <Dialog
        open={editInvoiceOpen}
        onOpenChange={(open) => {
          if (!open) closeEditInvoice();
          else setEditInvoiceOpen(true);
        }}
      >
        <DialogContent className="z-[200] flex max-h-[94vh] w-[min(98vw,72rem)] max-w-6xl flex-col gap-0 overflow-hidden border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 text-left">
            <DialogTitle>
              {editInvoiceSale?.sale_code
                ? `Edit Invoice ${editInvoiceSale.sale_code}`
                : "Edit Invoice"}
            </DialogTitle>
            <DialogDescription>
              {editInvoiceSale
                ? "Change customer, date, lines, prices, discount, or payment mode. Saving rebuilds the invoice, customer ledger, stock, and general ledger."
                : "All invoices at Verification Points, any payment mode. Reduce the amount when the customer says the total is not correct."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {editInvoiceLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--aa-navy)]" />
                Loading invoice…
              </div>
            ) : editInvoiceSale ? (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Customer
                    </div>
                    <div className="mt-1 flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <SearchCustomerInput
                          selected={
                            editInvoiceCustomer ? [editInvoiceCustomer] : []
                          }
                          onChange={(cus) => setEditInvoiceCustomer(cus)}
                          disabled={editInvoiceSaving}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={editInvoiceSaving}
                        onClick={() => {
                          setEditNewCustomerName("");
                          setEditNewCustomerPhone("");
                          setEditNewCustomerOpen(true);
                        }}
                        className="mt-0 inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-[var(--aa-accent)] hover:bg-slate-50 disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        New
                      </button>
                    </div>
                    {editInvoiceCustomer?.phone || editInvoiceCustomer?.address ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {[editInvoiceCustomer.phone, editInvoiceCustomer.address]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Invoice date
                    </div>
                    <input
                      type="date"
                      min={POSTING_DATE_MIN}
                      max={getPostingDateMax()}
                      value={editInvoiceDate}
                      disabled={editInvoiceSaving}
                      onChange={(e) => setEditInvoiceDate(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Status / amount
                    </div>
                    <div className="mt-1">
                      <WorkflowStatusBadge
                        status={editInvoiceSale.workflow_status}
                        paymentType={editInvoiceSale.mode_of_payment}
                        compact
                      />
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                      ₦{formatNumber1(editInvoiceTotals.total)}
                    </div>
                    {editInvoiceSale.warehouse || editInvoiceSale.warehouse_name ? (
                      <div className="text-xs text-slate-500">
                        {editInvoiceSale.warehouse || editInvoiceSale.warehouse_name}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Payment mode
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {MODE_CHECK_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const checked = editPaymentModes.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={editInvoiceSaving}
                          onClick={() =>
                            setEditPaymentModes((prev) =>
                              prev.includes(opt.value)
                                ? prev.filter((m) => m !== opt.value)
                                : [...prev, opt.value],
                            )
                          }
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors disabled:opacity-50 ${
                            checked
                              ? "border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? "border-white bg-white text-[var(--aa-navy)]"
                                : "border-slate-400 bg-white"
                            }`}
                          >
                            {checked ? (
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            ) : null}
                          </span>
                          <Icon className="h-4 w-4 shrink-0" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {paymentTypeFromModeChecks(editPaymentModes) ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Selected:{" "}
                      <span className="font-semibold text-slate-800">
                        {editPaymentModes
                          .map((id) => MODE_LABELS[id] || id)
                          .join(" + ") || "—"}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      Tick at least one payment mode.
                    </p>
                  )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editInvoiceLines.map((line) => (
                        <tr key={line.key}>
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">
                              {line.item_name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {[line.product_id, line.branch_name, line.item_type]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.quantity}
                              disabled={editInvoiceSaving}
                              onChange={(e) =>
                                updateEditInvoiceLine(
                                  line.key,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              className="h-9 w-24 rounded-md border border-slate-200 bg-white px-2 text-right text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.selling_price}
                              disabled={editInvoiceSaving}
                              onChange={(e) =>
                                updateEditInvoiceLine(
                                  line.key,
                                  "selling_price",
                                  e.target.value,
                                )
                              }
                              className="h-9 w-28 rounded-md border border-slate-200 bg-white px-2 text-right text-sm tabular-nums outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                            ₦{formatNumber1(editLineAmount(line))}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              title="Remove line"
                              disabled={editInvoiceSaving}
                              onClick={() => removeEditInvoiceLine(line.key)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="relative">
                  <input
                    value={editProductQuery}
                    onChange={(e) => setEditProductQuery(e.target.value)}
                    disabled={editInvoiceSaving}
                    placeholder="Add item — search product name or SKU"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                  />
                  {editProductQuery.trim() && filteredEditProducts.length ? (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                      {filteredEditProducts.map((p) => {
                        const sku = p.product_id || p.sku || p.id;
                        return (
                          <li key={`${sku}-${p.branchId || p.branch_id || ""}`}>
                            <button
                              type="button"
                              onClick={() => addEditInvoiceProduct(p)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              <span>
                                <span className="block font-medium text-slate-800">
                                  {p.item_name}
                                </span>
                                <span className="block font-mono text-[11px] text-slate-400">
                                  {[sku, p.branch_name || p.location_name]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </span>
                              <span className="tabular-nums text-slate-600">
                                ₦{formatNumber1(p.selling_price ?? p.price ?? 0)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>

                <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums">
                      ₦{formatNumber1(editInvoiceTotals.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <span>Discount</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editInvoiceDiscount}
                      disabled={editInvoiceSaving}
                      onChange={(e) => setEditInvoiceDiscount(e.target.value)}
                      className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-right text-sm tabular-nums outline-none focus:border-[var(--aa-accent)]"
                    />
                  </div>
                  {editInvoiceTotals.exclusiveTax > 0 ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax</span>
                      <span className="tabular-nums">
                        ₦{formatNumber1(editInvoiceTotals.exclusiveTax)}
                      </span>
                    </div>
                  ) : null}
                  {(editInvoiceSale.taxes || []).map((tax) => (
                    <div
                      key={tax.id || tax.name}
                      className="flex justify-between text-xs text-slate-500"
                    >
                      <span>
                        {tax.description || tax.name}
                        {tax.rate ? ` (${tax.rate}%)` : ""}
                      </span>
                      <span>
                        {String(tax.inclusive_type || "").toLowerCase() ===
                        "inclusive"
                          ? "inclusive"
                          : ""}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900">
                    <span>Total</span>
                    <span className="tabular-nums">
                      ₦{formatNumber1(editInvoiceTotals.total)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={editInvoiceQuery}
                  onChange={(e) => setEditInvoiceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const typed = editInvoiceQuery.trim();
                      if (filteredEditInvoices.length === 1) {
                        goEditInvoice(filteredEditInvoices[0].sale_code);
                      } else if (typed) {
                        goEditInvoice(typed);
                      }
                    }
                  }}
                  placeholder="Search invoice or customer…"
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
                <div className="max-h-[28rem] overflow-y-auto rounded-md border border-slate-200">
                  {loadingVerificationInvoices ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      Loading invoices still on Verification Points…
                    </p>
                  ) : filteredEditInvoices.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      No invoices on Verification Points
                      {editInvoiceQuery.trim() ? " match this search" : ""}.
                      Reversed and already processed invoices are not listed.
                    </p>
                  ) : (
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Mode</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredEditInvoices.map((row) => (
                          <tr
                            key={row.sale_code}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => goEditInvoice(row.sale_code)}
                          >
                            <td className="px-3 py-2 font-mono text-sm font-semibold text-[var(--aa-navy)]">
                              {row.sale_code}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                              {row.date
                                ? moment(row.date).format("DD MMM YYYY")
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-800">
                                {row.customer_name || "—"}
                              </div>
                              {row.customer_no ? (
                                <div className="font-mono text-[11px] text-slate-400">
                                  {row.customer_no}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 capitalize text-slate-600">
                              {String(row.payment_type || "—").replace(/_/g, " ")}
                            </td>
                            <td className="px-3 py-2">
                              {row.status ? (
                                <WorkflowStatusBadge
                                  status={row.status}
                                  paymentType={row.payment_type}
                                  compact
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                              ₦{formatNumber1(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:gap-2">
            {editInvoiceSale ? (
              <button
                type="button"
                disabled={editInvoiceSaving}
                onClick={() => {
                  setEditInvoiceSale(null);
                  setEditInvoiceLines([]);
                  setEditInvoiceCustomer(null);
                }}
                className="mr-auto inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back
              </button>
            ) : null}
            <button
              type="button"
              disabled={editInvoiceSaving}
              onClick={closeEditInvoice}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            {editInvoiceSale ? (
              <button
                type="button"
                disabled={editInvoiceSaving || editInvoiceLoading}
                onClick={saveEditInvoiceQuantities}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {editInvoiceSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {editInvoiceSaving ? "Saving…" : "Save invoice"}
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  editInvoiceLoading || filteredEditInvoices.length === 0
                }
                onClick={() =>
                  goEditInvoice(
                    filteredEditInvoices.length === 1
                      ? filteredEditInvoices[0].sale_code
                      : editInvoiceQuery,
                  )
                }
                className="rounded-md bg-[var(--aa-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Open invoice
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editNewCustomerOpen}
        onOpenChange={(open) => {
          if (editNewCustomerSaving) return;
          setEditNewCustomerOpen(open);
          if (!open) {
            setEditNewCustomerName("");
            setEditNewCustomerPhone("");
          }
        }}
      >
        <DialogContent className="z-[260] w-[min(96vw,28rem)] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl sm:rounded-xl">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 text-left">
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>
              Create a customer instantly and attach them to this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Name
              </label>
              <input
                type="text"
                autoFocus
                value={editNewCustomerName}
                disabled={editNewCustomerSaving}
                onChange={(e) => setEditNewCustomerName(e.target.value)}
                placeholder="Customer name"
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Phone
              </label>
              <input
                type="tel"
                value={editNewCustomerPhone}
                disabled={editNewCustomerSaving}
                onChange={(e) =>
                  setEditNewCustomerPhone(sanitizePhoneInput(e.target.value))
                }
                placeholder="0803…"
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {NIGERIAN_PHONE_HINT}
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-3">
            <button
              type="button"
              disabled={editNewCustomerSaving}
              onClick={() => setEditNewCustomerOpen(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={editNewCustomerSaving}
              onClick={createInstantEditCustomer}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {editNewCustomerSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {editNewCustomerSaving ? "Creating…" : "Create & select"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        onDownload={downloadTillReport}
        downloadingKind={tillDownloadKind}
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

      {invoiceDownloadData ? (
        <div
          ref={invoiceDownloadRef}
          className="pointer-events-none fixed left-[-120vw] top-0 z-[-1] w-[210mm] bg-white"
          aria-hidden
        >
          <CreditSaleInvoiceImproved
            invoiceData={invoiceDownloadData}
            business={invoiceDownloadData.business || activeBusiness}
            customer={invoiceDownloadData.customer}
            date={invoiceDownloadData.date}
            taxes={invoiceDownloadData.taxes || []}
            discount={invoiceDownloadData.discount || null}
            showPrintButton={false}
            showCustomerCopyActions={false}
            enableInlineCustomerCopyPreview={false}
            documentMode="invoice"
            paperSize="a4"
          />
        </div>
      ) : null}
    </div>
  );
}
