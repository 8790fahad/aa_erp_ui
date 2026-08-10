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
import { WorkflowStatusBadge } from "@/lib/saleWorkflowStatus.js";

const TREATMENTS = [
  {
    id: "cash",
    label: "Cash",
    hint: "Cashier collects cash payment",
  },
  {
    id: "transfer",
    label: "Transfer",
    hint: "Cashier collects bank transfer",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    hint: "Skip cashier — go to separation / warehouse",
  },
];

function treatmentLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t === "warehouse") return "Warehouse";
  if (t === "transfer" || t === "bank") return "Transfer";
  if (t === "credit") return "Credit";
  if (t === "split") return "Cash + Transfer";
  return "Cash";
}

function treatmentBadgeClass(type) {
  const t = String(type || "").toLowerCase();
  if (t === "warehouse") return "bg-orange-100 text-orange-800 border-orange-200";
  if (t === "transfer" || t === "bank")
    return "bg-sky-100 text-sky-800 border-sky-200";
  if (t === "credit") return "bg-violet-100 text-violet-800 border-violet-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

/**
 * Switch sales invoices between Cash, Transfer, and Warehouse treatment.
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
  const [targetType, setTargetType] = useState("warehouse");
  const [filterType, setFilterType] = useState("all");

  const from =
    fromDate ||
    moment().startOf("month").format("YYYY-MM-DD");
  const to = toDate || moment().format("YYYY-MM-DD");

  const fetchRows = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ facilityId: activeBusiness.id });
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
        const list = (res.results || []).filter((r) => {
          const ts = moment(
            r.updated_at || r.created_at || r.createdAt,
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

  const visibleRows = useMemo(() => {
    if (filterType === "all") return rows;
    return rows.filter((r) => {
      const pt = String(r.payment_type || "").toLowerCase();
      if (filterType === "cash") return pt === "cash" || pt === "split";
      if (filterType === "transfer")
        return pt === "transfer" || pt === "bank" || pt === "split";
      if (filterType === "warehouse") return pt === "warehouse";
      return pt === filterType;
    });
  }, [rows, filterType]);

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
    setSaving(true);
    _postApi(
      "/api/v1/sale-workflows/special-treatment",
      {
        facilityId: activeBusiness.id,
        saleCodes: [...selected],
        paymentType: targetType,
        updated_by: user?.id,
        note: `Special invoice treatment → ${targetType}`,
      },
      (res) => {
        setSaving(false);
        if (res.success) {
          toast.success(res.message || "Updated");
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
            Switch invoices between Cash, Transfer, and Warehouse. Warehouse
            skips cashier and goes to separation / warehouse collection.
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
          {["all", ...TREATMENTS.map((t) => t.id)].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterType(id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filterType === id
                  ? "border-[#4267B2] bg-[#4267B2] text-white"
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
              No invoices in this period.
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
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Switch selected to
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {TREATMENTS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTargetType(t.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  targetType === t.id
                    ? "border-[#4267B2] bg-white ring-2 ring-[#4267B2]/30"
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
            disabled={saving || selected.size === 0}
            onClick={applyTreatment}
            style={{ backgroundColor: "#4267B2" }}
          >
            {saving
              ? "Updating…"
              : `Apply to ${selected.size || 0} invoice${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Compact Cash / Transfer / Warehouse filter for report toolbars. */
export function InvoiceTreatmentFilter({ value = "all", onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-slate-600 mr-1">Type</span>
      {["all", "cash", "transfer", "warehouse"].map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange?.(id)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            value === id
              ? "border-[#4267B2] bg-[#4267B2] text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {id === "all" ? "All" : treatmentLabel(id)}
        </button>
      ))}
    </div>
  );
}
