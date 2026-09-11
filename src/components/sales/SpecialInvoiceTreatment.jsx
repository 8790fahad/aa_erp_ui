import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, RefreshCw } from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { formatNumber1 } from "@/components/router/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  VERIFICATION_POINT_STATUSES,
  WorkflowStatusBadge,
} from "@/lib/saleWorkflowStatus.js";

const COLLECTION_MODES = [
  {
    id: "cash",
    label: "Cash",
    hint: "Cashier collects cash payment",
  },
  {
    id: "card",
    label: "POS",
    hint: "Cashier collects POS / card payment",
  },
  {
    id: "transfer",
    label: "Transfer",
    hint: "Cashier collects bank transfer",
  },
];

const ROUTE_ACTIONS = [
  {
    id: "separation",
    label: "Separation",
    hint: "Skip cashier — send invoice to Invoice Separation",
  },
  {
    id: "credit",
    label: "Credit",
    hint: "Send remaining unpaid balance to Credit Approval",
  },
];

const COLLECTION_PAYMENT_TYPES = new Set([
  "cash",
  "card",
  "pos",
  "transfer",
  "bank",
  "split",
  "credit_split",
]);

const VP_COLLECTION_STATUSES = VERIFICATION_POINT_STATUSES.filter(
  (s) => s !== "awaiting_credit_approval",
);

function normalizeMode(type) {
  const t = String(type || "").toLowerCase().trim();
  if (t === "pos") return "card";
  if (t === "bank") return "transfer";
  return t;
}

function treatmentLabel(type) {
  const t = normalizeMode(type);
  if (t === "card") return "POS";
  if (t === "transfer") return "Transfer";
  if (t === "credit") return "Credit";
  if (t === "credit_split") return "Split + Credit";
  if (t === "split") return "Split";
  if (t === "warehouse") return "Warehouse";
  return "Cash";
}

function treatmentBadgeClass(type) {
  const t = normalizeMode(type);
  if (t === "card") return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (t === "transfer") return "bg-sky-100 text-sky-800 border-sky-200";
  if (t === "credit") return "bg-violet-100 text-violet-800 border-violet-200";
  if (t === "split") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function rowModes(row) {
  const listed = Array.isArray(row?.payment_modes)
    ? row.payment_modes.map((m) => normalizeMode(m)).filter(Boolean)
    : [];
  if (listed.length) return listed;
  const pt = normalizeMode(row?.payment_type);
  if (pt === "split") return ["cash", "transfer"];
  if (pt === "credit_split") return ["cash", "transfer", "credit"];
  if (pt === "card" || pt === "transfer" || pt === "cash") return [pt];
  return [];
}

function remainingOf(row) {
  if (row?.remaining != null && Number.isFinite(Number(row.remaining))) {
    return Number(Number(row.remaining).toFixed(2));
  }
  const due = Number(row?.amount) || 0;
  const collected = Number(row?.split_progress?.collected_total) || 0;
  return Number(Math.max(0, due - collected).toFixed(2));
}

function matchesCollectionFilter(row, filterType) {
  const pt = normalizeMode(row?.payment_type);
  const modes = rowModes(row);
  if (filterType === "all") {
    return COLLECTION_PAYMENT_TYPES.has(String(row?.payment_type || "").toLowerCase()) ||
      COLLECTION_PAYMENT_TYPES.has(pt);
  }
  if (filterType === "cash") {
    return pt === "cash" || pt === "split" || modes.includes("cash");
  }
  if (filterType === "card") {
    return pt === "card" || modes.includes("card");
  }
  if (filterType === "transfer") {
    return pt === "transfer" || pt === "split" || modes.includes("transfer");
  }
  return pt === filterType;
}

/**
 * Send VP Cash / POS / Transfer invoices to Invoice Separation
 * or remaining unpaid balance to Credit.
 */
export default function SpecialInvoiceTreatment({
  fromDate,
  toDate,
  className = "",
  buttonVariant = "outline",
  buttonSize = "default",
  compact = false,
}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [targetId, setTargetId] = useState("separation");
  const [filterType, setFilterType] = useState("all");

  const from =
    fromDate ||
    moment().startOf("month").format("YYYY-MM-DD");
  const to = toDate || moment().format("YYYY-MM-DD");

  const fetchRows = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
      status: VP_COLLECTION_STATUSES.join(","),
      paymentType: "cash,transfer,bank,card,split,credit_split",
      limit: "500",
    });
    _fetchApi(
      `/api/v1/sale-workflows?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (!res.success) {
          toast.error(res.message || "Failed to load invoices");
          setRows([]);
          return;
        }
        const fromTs = moment(from).startOf("day").valueOf();
        const toTs = moment(to).endOf("day").valueOf();
        const vp = new Set(VP_COLLECTION_STATUSES);
        const list = (res.results || []).filter((r) => {
          const status = String(r.status || "").toLowerCase().trim();
          if (!vp.has(status)) return false;
          const pt = String(r.payment_type || "").toLowerCase();
          if (!COLLECTION_PAYMENT_TYPES.has(pt)) return false;
          const ts = moment(
            r.created_at || r.createdAt || r.updated_at || r.updatedAt,
          ).valueOf();
          if (!Number.isFinite(ts)) return true;
          return ts >= fromTs && ts <= toTs;
        });
        setRows(list);
        setSelected(new Set());
      },
      () => {
        setLoading(false);
        toast.error("Failed to load invoices");
        setRows([]);
      },
    );
  }, [activeBusiness?.id, from, to]);

  useEffect(() => {
    if (open) fetchRows();
  }, [open, fetchRows]);

  const visibleRows = useMemo(
    () => rows.filter((r) => matchesCollectionFilter(r, filterType)),
    [rows, filterType],
  );

  const selectedRemaining = useMemo(() => {
    return visibleRows
      .filter((r) => selected.has(r.sale_code))
      .reduce((sum, r) => sum + remainingOf(r), 0);
  }, [visibleRows, selected]);

  const toggleOne = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === visibleRows.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(visibleRows.map((r) => r.sale_code)));
  };

  const applyTreatment = () => {
    if (!activeBusiness?.id || selected.size === 0) {
      toast.error("Select at least one invoice");
      return;
    }
    if (targetId !== "separation" && targetId !== "credit") {
      toast.error("Choose Separation or Credit");
      return;
    }
    if (targetId === "credit" && selectedRemaining <= 0.05) {
      toast.error("Selected invoices have no remaining balance to send to credit");
      return;
    }
    setSaving(true);
    _postApi(
      "/api/v1/sale-workflows/special-treatment",
      {
        facilityId: activeBusiness.id,
        saleCodes: [...selected],
        action: targetId,
        verificationOnly: true,
        updated_by: user?.id,
        note:
          targetId === "credit"
            ? "Special treatment — remaining balance to Credit"
            : "Special treatment — send to Invoice Separation",
      },
      (res) => {
        setSaving(false);
        if (res.success) {
          const skipped = (res.results || []).filter((r) => r.skipped);
          if (skipped.length && skipped.length === (res.results || []).length) {
            toast.error(skipped[0]?.reason || res.message || "Nothing updated");
          } else {
            toast.success(res.message || "Updated");
            if (skipped.length) {
              toast.message(
                skipped
                  .map((s) => `${s.sale_code}: ${s.reason}`)
                  .slice(0, 3)
                  .join(" · "),
              );
            }
          }
          fetchRows();
        } else {
          toast.error(res.message || "Could not update invoices");
        }
      },
      () => {
        setSaving(false);
        toast.error("Could not update invoices");
      },
    );
  };

  const applyLabel = () => {
    const n = selected.size || 0;
    const noun = n === 1 ? "invoice" : "invoices";
    if (targetId === "credit") return `Send remaining on ${n} ${noun} to Credit`;
    return `Send ${n} ${noun} to Separation`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={buttonVariant}
          size={buttonSize}
          className={`inline-flex items-center gap-2 ${className}`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          {compact
            ? "Special treatment"
            : "Special invoice treatment for sales"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Special invoice treatment for sales</DialogTitle>
          <DialogDescription>
            Cash, POS, and Transfer invoices still on Verification Points.
            Send selected invoices to Separation, or send any remaining unpaid
            balance to Credit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>
            Period: {moment(from).format("DD MMM YYYY")} –{" "}
            {moment(to).format("DD MMM YYYY")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={fetchRows}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {["all", ...COLLECTION_MODES.map((t) => t.id)].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterType(id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filterType === id
                  ? "border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {id === "all" ? "All" : treatmentLabel(id)}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading invoices…
            </div>
          ) : visibleRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No Cash, POS, or Transfer invoices on Verification Points in this
              period.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={
                        visibleRows.length > 0 &&
                        selected.size === visibleRows.length
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const remaining = remainingOf(row);
                  return (
                    <tr
                      key={row.sale_code}
                      className="border-t border-slate-100 hover:bg-slate-50/80"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.sale_code)}
                          onChange={() => toggleOne(row.sale_code)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-medium">
                        {row.sale_code}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.customer_name || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${treatmentBadgeClass(
                            row.payment_type,
                          )}`}
                        >
                          {treatmentLabel(row.payment_type)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <WorkflowStatusBadge
                          status={row.status}
                          paymentType={row.payment_type}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        ₦{formatNumber1(Number(row.amount || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {remaining > 0.05 ? (
                          <span className="text-amber-700">
                            ₦{formatNumber1(remaining)}
                          </span>
                        ) : (
                          <span className="text-slate-400">₦0.00</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Move selected to
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ROUTE_ACTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTargetId(t.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  targetId === t.id
                    ? "border-[var(--aa-navy)] bg-white ring-2 ring-[var(--aa-accent)]/30"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  {t.label}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{t.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={
              saving ||
              selected.size === 0 ||
              (targetId === "credit" && selectedRemaining <= 0.05)
            }
            onClick={applyTreatment}
            style={{ backgroundColor: "var(--aa-navy)" }}
          >
            {saving ? "Updating…" : applyLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compact Cash / POS / Transfer filter for report toolbars. */
export function InvoiceTreatmentFilter({ value = "all", onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-slate-600 mr-1">Type</span>
      {["all", "cash", "card", "transfer"].map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange?.(id)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            value === id
              ? "border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {id === "all" ? "All" : treatmentLabel(id)}
        </button>
      ))}
    </div>
  );
}
