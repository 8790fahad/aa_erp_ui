import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Nfc,
  Pencil,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import {
  WorkflowStatusBadge,
  isEditableSalesInvoiceStatus,
} from "@/lib/saleWorkflowStatus.js";
import {
  hasFullAccess,
  isBusinessOwner,
  getUserFunctionalities,
} from "@/lib/access";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EDIT_INVOICE_PRIVILEGE = "Edit Invoice";
const EDIT_ACTION_PRIVILEGE = "Edit";
const CHANGE_ACTION_PRIVILEGE = "Change";
const SWITCH_PAYMENT_MODE_PRIVILEGE = "Switch Payment Mode";

const MODE_CHECK_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "transfer", label: "Transfer", icon: Building2 },
  { value: "card", label: "POS", icon: Nfc },
  { value: "credit", label: "Credit", icon: CreditCard },
  { value: "deposit", label: "Apply Deposit", icon: Wallet },
];

const MODE_LABELS = {
  cash: "Cash",
  transfer: "Transfer",
  card: "POS",
  credit: "Credit",
  deposit: "Apply Deposit",
  apply_credit: "Apply Deposit",
};

function normalizePaymentMode(type) {
  const t = String(type || "")
    .toLowerCase()
    .trim();
  if (t === "bank") return "transfer";
  if (
    t === "credit_split" ||
    (t.includes("credit") && t.includes("cash"))
  )
    return "credit_split";
  if (t === "split" || t === "both") return "split";
  if (t === "credit") return "credit";
  if (t === "deposit" || t === "apply_deposit" || t === "apply deposit")
    return "deposit";
  if (t === "apply_credit" || t === "apply credit") return "deposit";
  if (t === "transfer") return "transfer";
  if (t === "card" || t === "pos") return "card";
  if (t === "cash") return "cash";
  return t || "cash";
}

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
  const pt = normalizePaymentMode(row?.payment_type);
  if (pt === "credit_split") return ["credit", "cash", "transfer"];
  if (pt === "split") return ["cash", "transfer"];
  if (pt === "deposit" || pt === "apply_credit") return ["deposit"];
  if (pt === "card") return ["card"];
  if (pt === "transfer") return ["transfer"];
  if (pt === "credit") return ["credit"];
  if (pt === "cash") return ["cash"];
  return pt ? [pt] : [];
}

function modeChecksEqual(a, b) {
  const left = [...new Set(a || [])].map(String).sort();
  const right = [...new Set(b || [])].map(String).sort();
  return (
    left.length === right.length && left.every((id, i) => id === right[i])
  );
}

function paymentTypeLabel(type) {
  const t = normalizePaymentMode(type);
  return MODE_LABELS[t] || String(type || "—").replace(/_/g, " ");
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

export default function EditInvoice() {
  const navigate = useNavigate();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;

  const functionalities = useMemo(
    () => getUserFunctionalities(user, activeBusiness),
    [user, activeBusiness],
  );

  const canAccessPage =
    isBusinessOwner(user, activeBusiness) ||
    hasFullAccess(functionalities) ||
    functionalities.includes(EDIT_INVOICE_PRIVILEGE) ||
    functionalities.includes(EDIT_ACTION_PRIVILEGE) ||
    functionalities.includes(CHANGE_ACTION_PRIVILEGE);

  /** Edit button: parent Edit Invoice or child Edit. */
  const canEditInvoice =
    isBusinessOwner(user, activeBusiness) ||
    hasFullAccess(functionalities) ||
    functionalities.includes(EDIT_INVOICE_PRIVILEGE) ||
    functionalities.includes(EDIT_ACTION_PRIVILEGE);

  /** Change button: parent Edit Invoice, child Change, or VP Switch Payment Mode. */
  const canSwitchPaymentMode =
    isBusinessOwner(user, activeBusiness) ||
    hasFullAccess(functionalities) ||
    functionalities.includes(EDIT_INVOICE_PRIVILEGE) ||
    functionalities.includes(CHANGE_ACTION_PRIVILEGE) ||
    functionalities.includes(SWITCH_PAYMENT_MODE_PRIVILEGE);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [modeChangeRow, setModeChangeRow] = useState(null);
  const [modeChangeChecked, setModeChangeChecked] = useState([]);
  const [modeChangeNext, setModeChangeNext] = useState("");
  const [switchingModeCode, setSwitchingModeCode] = useState(null);

  const fetchList = useCallback(() => {
    if (!facilityId) {
      setRows([]);
      return;
    }
    setLoading(true);
    _fetchApi(
      `/api/v1/sale-workflows/verification-invoices?facilityId=${encodeURIComponent(
        String(facilityId),
      )}&date=${encodeURIComponent(moment().format("YYYY-MM-DD"))}`,
      (res) => {
        setLoading(false);
        const list = Array.isArray(res?.results) ? res.results : [];
        const byCode = new Map();
        for (const raw of list) {
          const row = normalizeEditInvoiceRow(raw);
          const code = String(row.sale_code || "").trim();
          if (!code || byCode.has(code)) continue;
          if (!isEditableSalesInvoiceStatus(row.status)) continue;
          byCode.set(code, row);
        }
        setRows(Array.from(byCode.values()));
      },
      () => {
        setLoading(false);
        setRows([]);
        toast.error("Failed to load invoices for edit");
      },
    );
  }, [facilityId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
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
  }, [rows, query]);

  const openEdit = (saleCode) => {
    if (!canEditInvoice) {
      toast.error("You do not have permission to edit invoices.");
      return;
    }
    const code = String(saleCode || "").trim();
    if (!code) return;
    navigate(
      `/app/sales/sale?view=lines&edit=${encodeURIComponent(code)}&from=edit-invoice`,
    );
  };

  const openModeChange = (row) => {
    if (!canSwitchPaymentMode) {
      toast.error("You do not have permission to switch payment mode");
      return;
    }
    const current = normalizePaymentMode(row.payment_type || "cash");
    const checked = modeChecksFromRow(row);
    const fallback = current ? [current] : [];
    const nextChecks = checked.length ? checked : fallback;
    setModeChangeRow(row);
    setModeChangeChecked(nextChecks);
    setModeChangeNext(paymentTypeFromModeChecks(nextChecks) || current);
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
    if (!modeChangeRow?.sale_code || !facilityId) return;
    const nextType =
      paymentTypeFromModeChecks(modeChangeChecked) || modeChangeNext;
    if (!nextType) {
      toast.error("Tick at least one payment mode");
      return;
    }
    const current = normalizePaymentMode(modeChangeRow.payment_type || "cash");
    const currentChecks = modeChecksFromRow(modeChangeRow);
    if (current === nextType && modeChecksEqual(currentChecks, modeChangeChecked)) {
      toast.message("Same payment mode selected");
      return;
    }

    setSwitchingModeCode(modeChangeRow.sale_code);
    _postApi(
      "/api/v1/sale-workflows/special-treatment",
      {
        facilityId,
        saleCodes: [modeChangeRow.sale_code],
        paymentType: nextType,
        payment_modes: modeChangeChecked,
        updated_by: user?.id,
        requireApproval: false,
        note: `Edit Invoice: payment mode ${current} → ${nextType}`,
      },
      (res) => {
        setSwitchingModeCode(null);
        if (res?.success) {
          const skipped = Array.isArray(res.results)
            ? res.results.find((r) => r.skipped)
            : null;
          if (skipped) {
            toast.error(skipped.reason || "Cannot change payment mode");
            return;
          }
          toast.success(
            res.message || `Switched to ${paymentTypeLabel(nextType)}`,
          );
          setModeChangeRow(null);
          setModeChangeNext("");
          setModeChangeChecked([]);
          fetchList();
        } else {
          toast.error(res?.message || "Failed to change payment mode");
        }
      },
      () => {
        setSwitchingModeCode(null);
        toast.error("Failed to change payment mode");
      },
    );
  };

  if (!canAccessPage) {
    return (
      <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Edit Invoice</h1>
          <p className="mt-3 text-sm text-slate-600">
            You do not have permission to edit invoices. Ask an admin to grant{" "}
            <strong>Edit Invoice</strong>, <strong>Edit</strong>, or{" "}
            <strong>Change</strong> under Sales.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f5f7fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
              <Pencil className="h-6 w-6 text-[var(--aa-navy)]" />
              Edit Invoice
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Today&apos;s invoices still at Verification Points. Use{" "}
              <strong>Edit</strong> for lines and prices, or{" "}
              <strong>Change</strong> for payment mode.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchList}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const typed = query.trim();
                  if (!typed) return;
                  const exact = filtered.find(
                    (r) =>
                      String(r.sale_code || "").toLowerCase() ===
                      typed.toLowerCase(),
                  );
                  if (exact) {
                    if (canEditInvoice) openEdit(exact.sale_code);
                    else if (canSwitchPaymentMode) openModeChange(exact);
                    else toast.error("No matching editable invoice");
                  } else toast.error("No matching editable invoice");
                }}
                placeholder="Search or type invoice number…"
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--aa-navy)]" />
                Loading invoices…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-slate-500">
                No editable invoices
                {query.trim() ? " match this search" : " for today"}.
                <div className="mt-2 text-xs">
                  Paid, separated, or reversed invoices cannot be edited here.{" "}
                  <Link
                    to="/app/payments/credit-note/party-customer"
                    className="font-medium text-[var(--aa-accent)] underline"
                  >
                    Use a credit note
                  </Link>{" "}
                  instead.
                </div>
              </div>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Invoice</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Customer</th>
                    <th className="px-4 py-2.5 font-semibold">Payment</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Amount
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.sale_code}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-[var(--aa-accent)]">
                        {row.sale_code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.date
                          ? moment(row.date).format("DD MMM YYYY")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {row.customer_name || "—"}
                        </div>
                        {row.customer_no ? (
                          <div className="font-mono text-[11px] text-slate-400">
                            {row.customer_no}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {paymentTypeLabel(row.payment_type)}
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                        ₦{formatNumber1(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {canEditInvoice ? (
                            <button
                              type="button"
                              title="Edit invoice"
                              onClick={() => openEdit(row.sale_code)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--aa-navy)] px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          ) : null}
                          {canSwitchPaymentMode ? (
                            <button
                              type="button"
                              title="Change payment mode"
                              disabled={switchingModeCode === row.sale_code}
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
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(modeChangeRow)}
        onOpenChange={(open) => {
          if (!open) closeModeChange();
        }}
      >
        <DialogContent className="max-w-lg">
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

          <div className="grid grid-cols-1 gap-2 py-1 sm:grid-cols-2">
            {MODE_CHECK_OPTIONS.map((opt) => {
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
            <p className="text-xs text-amber-700">
              Tick at least one payment mode.
            </p>
          )}

          {modeChangeNext === "deposit" ? (
            <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              The invoice will move to{" "}
              <span className="font-semibold">Apply Deposit</span> on
              Verification Points.
            </p>
          ) : null}
          {modeChangeNext === "credit" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Credit must be approved on the{" "}
              <span className="font-semibold">Credit</span> tab before Invoice
              Separation.
            </p>
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
    </div>
  );
}
