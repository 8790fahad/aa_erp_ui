import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  HandHelping,
  Package,
  Printer,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { formatNumber1 } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFulfillmentStatusMeta,
  getWorkflowStatusMeta,
  WorkflowStatusBadge,
} from "@/lib/saleWorkflowStatus.js";

const FILTERS = [
  { id: "active", label: "In progress" },
  { id: "invoice", label: "Invoice", statuses: ["sales_order", "invoice_generated", "submitted"] },
  {
    id: "cashier",
    label: "Cashier",
    statuses: ["awaiting_payment", "awaiting_cashier_confirm"],
  },
  {
    id: "paid",
    label: "Separation",
    statuses: [
      "payment_confirmed",
      "invoice_separation",
      "credit_approved",
      "final_invoice",
    ],
  },
  {
    id: "warehouse",
    label: "Warehouse",
    statuses: ["warehouse_picking", "dual_signature", "goods_released"],
  },
  { id: "credit", label: "Credit", statuses: ["awaiting_credit_approval"] },
  { id: "done", label: "Done", statuses: ["completed"] },
  { id: "all", label: "All" },
];

function advanceActionLabel(nextStatus) {
  const map = {
    payment_confirmed: "Confirm Payment",
    credit_approved: "Approve Credit",
    invoice_separation: "Mark Separated → Warehouse",
    final_invoice: "Send to Warehouse",
    warehouse_picking: "Send to Warehouse",
    dual_signature: "Confirm Dual Signature",
    goods_released: "Release Goods",
    completed: "Mark Completed",
    awaiting_cashier_confirm: "Receive Payment → Cashier",
  };
  return map[nextStatus] || "Advance to next stage";
}

function paymentTypeLabel(type) {
  if (type === "credit") return "Credit";
  if (type === "transfer" || type === "bank") return "Transfer";
  if (type === "split") return "Cash + Transfer";
  return "Cash";
}

export default function SalesManagement() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const saleFromUrl = searchParams.get("sale_code") || "";

  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("active");
  const [selectedCode, setSelectedCode] = useState(saleFromUrl);
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [separating, setSeparating] = useState(false);

  const fetchList = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ facilityId: activeBusiness.id });
    const filterDef = FILTERS.find((f) => f.id === filter);
    if (filterDef?.statuses?.length) {
      params.set("status", filterDef.statuses.join(","));
    } else if (filter !== "all" && filter !== "active" && filter !== "done") {
      params.set("status", filter);
    }
    _fetchApi(
      `/api/v1/sale-workflows?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res.success) {
          let list = res.results || [];
          if (filter === "active") {
            list = list.filter((r) => r.status !== "completed");
          } else if (filter === "done") {
            list = list.filter((r) => r.status === "completed");
          }

          const roleLower = String(user?.role || "").toLowerCase();
          const isCashier =
            roleLower.includes("cashier") || roleLower.includes("casheir");
          const cashierType = String(user?.cashier_type || "").toLowerCase();
          if (isCashier && (cashierType === "cash" || cashierType === "transfer")) {
            list = list.filter((r) => {
              if (
                r.status !== "awaiting_cashier_confirm" &&
                r.status !== "awaiting_payment"
              ) {
                return true;
              }
              const pt = String(r.payment_type || "").toLowerCase();
              if (cashierType === "cash") {
                return pt === "cash" || pt === "split";
              }
              return pt === "transfer" || pt === "bank" || pt === "split";
            });
          }

          setRows(list);
          setSelectedCode((prev) => {
            if (saleFromUrl && list.some((r) => r.sale_code === saleFromUrl)) {
              return saleFromUrl;
            }
            if (prev && list.some((r) => r.sale_code === prev)) return prev;
            return list[0]?.sale_code || "";
          });
        } else {
          toast.error(res.message || "Failed to load sales process");
          setRows([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Failed to load sales process");
        setRows([]);
      },
    );
  }, [activeBusiness?.id, filter, saleFromUrl, user?.role, user?.cashier_type]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selected = useMemo(
    () => rows.find((r) => r.sale_code === selectedCode) || null,
    [rows, selectedCode],
  );

  const showSeparation =
    selected &&
    [
      "invoice_separation",
      "final_invoice",
      "warehouse_picking",
      "dual_signature",
      "goods_released",
      "completed",
    ].includes(selected.status);

  const fetchPacks = useCallback(() => {
    if (!activeBusiness?.id || !selectedCode || !showSeparation) {
      setPacks([]);
      return;
    }
    setPacksLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
      saleCode: selectedCode,
    });
    _fetchApi(
      `/api/v1/sale-workflows/fulfillments?${params.toString()}`,
      (res) => {
        setPacksLoading(false);
        if (res.success) {
          setPacks(res.results || []);
        } else {
          setPacks([]);
        }
      },
      () => {
        setPacksLoading(false);
        setPacks([]);
      },
    );
  }, [activeBusiness?.id, selectedCode, showSeparation]);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const cashierCanConfirmSelected = useMemo(() => {
    if (!selected) return true;
    const roleLower = String(user?.role || "").toLowerCase();
    const isCashier =
      roleLower.includes("cashier") || roleLower.includes("casheir");
    if (!isCashier) return true;
    const cashierType = String(user?.cashier_type || "").toLowerCase();
    if (cashierType !== "cash" && cashierType !== "transfer") return true;
    if (selected.next_status !== "payment_confirmed") return true;
    const pt = String(selected.payment_type || "").toLowerCase();
    if (pt === "split") return true;
    if (cashierType === "cash") return pt === "cash";
    return pt === "transfer" || pt === "bank";
  }, [selected, user?.role, user?.cashier_type]);

  const selectRow = (code) => {
    setSelectedCode(code);
    const next = new URLSearchParams(searchParams);
    if (code) next.set("sale_code", code);
    else next.delete("sale_code");
    setSearchParams(next, { replace: true });
  };

  const advance = (action = "advance", note) => {
    if (!selected || !activeBusiness?.id) return;
    setAdvancing(true);
    _postApi(
      "/api/v1/sale-workflows/advance",
      {
        facilityId: activeBusiness.id,
        saleCode: selected.sale_code,
        action,
        note,
        updated_by: user?.id,
      },
      (res) => {
        setAdvancing(false);
        if (res.success) {
          toast.success(res.message || "Updated");
          fetchList();
          fetchPacks();
        } else {
          toast.error(res.message || "Could not update stage");
        }
      },
      () => {
        setAdvancing(false);
        toast.error("Could not update stage");
      },
    );
  };

  const markPrinted = (pack) => {
    if (!activeBusiness?.id || !pack) return;
    setPrintingId(pack.id);
    _postApi(
      "/api/v1/sale-workflows/fulfillment/print",
      {
        facilityId: activeBusiness.id,
        id: pack.id,
        packCode: pack.pack_code,
        updated_by: user?.id,
      },
      (res) => {
        setPrintingId(null);
        if (res.success) {
          toast.success("Warehouse invoice opened");
          fetchPacks();
          window.open(
            `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
              pack.sale_code,
            )}&branch_id=${pack.branch_id}&pack_code=${encodeURIComponent(
              pack.pack_code,
            )}`,
            "_blank",
          );
        } else {
          toast.error(res.message || "Could not open branch invoice");
        }
      },
      () => {
        setPrintingId(null);
        toast.error("Could not open branch invoice");
      },
    );
  };

  const markSeparated = () => {
    if (!activeBusiness?.id || !selected) return;
    setSeparating(true);
    _postApi(
      "/api/v1/sale-workflows/complete-separation",
      {
        facilityId: activeBusiness.id,
        saleCode: selected.sale_code,
        updated_by: user?.id,
        note: `Separated into ${packs.length} branch invoice copies`,
      },
      (res) => {
        setSeparating(false);
        if (res.success) {
          toast.success(res.message || "Marked separated");
          fetchList();
          fetchPacks();
        } else {
          toast.error(res.message || "Could not mark separated");
        }
      },
      () => {
        setSeparating(false);
        toast.error("Could not mark separated");
      },
    );
  };

  const printAllInvoices = () => {
    if (!activeBusiness?.id || !selected || packs.length === 0) return;
    setPrintingAll(true);
    let remaining = packs.length;
    let failed = false;
    const finish = () => {
      remaining -= 1;
      if (remaining > 0) return;
      setPrintingAll(false);
      fetchPacks();
      if (failed) toast.error("Some copies could not be marked printed");
      window.open(
        `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
          selected.sale_code,
        )}&print_all=1&auto_print=1`,
        "_blank",
      );
    };
    packs.forEach((pack) => {
      _postApi(
        "/api/v1/sale-workflows/fulfillment/print",
        {
          facilityId: activeBusiness.id,
          id: pack.id,
          packCode: pack.pack_code,
          updated_by: user?.id,
        },
        (res) => {
          if (!res.success) failed = true;
          finish();
        },
        () => {
          failed = true;
          finish();
        },
      );
    });
  };

  const stagePath = selected?.stage_path || [];
  const timelineStatusId = (() => {
    const s = selected?.status;
    if (!s) return null;
    if (["sales_order", "invoice_generated", "submitted"].includes(s)) {
      return "invoice_generated";
    }
    if (["awaiting_payment", "awaiting_cashier_confirm"].includes(s)) {
      return "awaiting_cashier_confirm";
    }
    if (["awaiting_credit_approval"].includes(s)) {
      return "awaiting_credit_approval";
    }
    if (
      [
        "payment_confirmed",
        "invoice_separation",
        "credit_approved",
        "final_invoice",
      ].includes(s)
    ) {
      return "invoice_separation";
    }
    if (
      ["warehouse_picking", "dual_signature", "goods_released"].includes(s)
    ) {
      return "warehouse_picking";
    }
    if (s === "completed") return "completed";
    return s;
  })();
  const currentIdx = stagePath.findIndex((s) => s.id === timelineStatusId);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-blue-600" />
                Sales Management
              </h1>
              <p className="text-gray-600 mt-1">
                One invoice → pay → separation → warehouse collect
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  fetchList();
                  fetchPacks();
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/sales/separation")}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Separation
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/sales/warehouse-requests")}
                className="flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Warehouse
              </Button>
              <Button
                onClick={() => navigate("/app/sales/sale?view=lines")}
                className="flex items-center gap-2"
                style={{ backgroundColor: "#4267B2" }}
              >
                New Invoice
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  filter === f.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">
              Sales queue ({rows.length})
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No sales in this queue yet. Create an invoice to start the
                process.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {rows.map((row) => {
                  const active = row.sale_code === selectedCode;
                  return (
                    <li key={`${row.facility_id}-${row.sale_code}`}>
                      <button
                        type="button"
                        onClick={() => selectRow(row.sale_code)}
                        className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                          active ? "bg-blue-50 border-l-4 border-blue-600" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">
                              {row.sale_code}
                            </div>
                            <div className="text-sm text-gray-600 truncate max-w-[220px]">
                              {row.customer_name || "—"}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                              row.payment_type === "credit"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {paymentTypeLabel(row.payment_type)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <WorkflowStatusBadge
                            status={row.status}
                            paymentType={row.payment_type}
                          />
                          <span className="text-xs text-gray-500">
                            ₦{formatNumber1(Number(row.amount || 0))}
                          </span>
                        </div>
                        {row.hold_overnight ? (
                          <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Held overnight (unpaid before close)
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6">
            {!selected ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-500 gap-2">
                <HandHelping className="w-10 h-10 text-gray-300" />
                Select a sale to view and advance the process
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        {selected.sale_code}
                      </h2>
                      <WorkflowStatusBadge
                        status={selected.status}
                        paymentType={selected.payment_type}
                      />
                    </div>
                    <p className="text-gray-600 text-sm mt-0.5">
                      {selected.customer_name || "—"} ·{" "}
                      {paymentTypeLabel(selected.payment_type)} · ₦
                      {formatNumber1(Number(selected.amount || 0))}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Updated{" "}
                      {selected.updated_at
                        ? moment(selected.updated_at).format(
                            "MMM DD, YYYY HH:mm",
                          )
                        : "—"}
                    </p>
                  </div>
                  <Link
                    to={`/app/sales/invoice-preview?sale_code=${selected.sale_code}`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <Eye className="w-4 h-4" />
                    View full invoice
                  </Link>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Process steps
                  </h3>
                  <ol className="space-y-0">
                    {stagePath.map((stage, idx) => {
                      const done = currentIdx > idx;
                      const current = currentIdx === idx;
                      const meta = getWorkflowStatusMeta(stage.id);
                      return (
                        <li key={stage.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            {done ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : current ? (
                              <div
                                className={`w-5 h-5 rounded-full ring-4 ${meta.dot} ring-opacity-30`}
                                style={{ boxShadow: "0 0 0 4px rgba(0,0,0,0.06)" }}
                              />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300" />
                            )}
                            {idx < stagePath.length - 1 ? (
                              <div
                                className={`w-0.5 flex-1 min-h-[20px] ${
                                  done ? "bg-emerald-400" : "bg-gray-200"
                                }`}
                              />
                            ) : null}
                          </div>
                          <div
                            className={`pb-4 ${
                              current
                                ? "font-semibold text-gray-900"
                                : done
                                  ? "text-gray-700"
                                  : "text-gray-400"
                            }`}
                          >
                            <div className="text-sm leading-5 flex items-center gap-2">
                              {stage.label}
                              {current ? (
                                <span
                                  className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium ${meta.badge}`}
                                >
                                  Current
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {showSeparation ? (
                  <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-violet-900 uppercase tracking-wide">
                        Warehouse invoice copies
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={fetchPacks}
                          className="h-8"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Refresh
                        </Button>
                        {selected.status === "invoice_separation" ||
                        selected.status === "payment_confirmed" ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={separating || packs.length === 0}
                            onClick={markSeparated}
                            className="h-8"
                            style={{ backgroundColor: "#4267B2" }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            {separating ? "Separating…" : "Mark Separated"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-violet-800 mb-3">
                      Each branch gets its own invoice copy with only that
                      branch&apos;s items (e.g. fish → Branch A, eggs → Branch
                      B).
                    </p>
                    {packs.length > 1 ? (
                      <div className="mb-3">
                        <Button
                          type="button"
                          size="sm"
                          disabled={printingAll}
                          onClick={printAllInvoices}
                          className="h-8"
                          style={{ backgroundColor: "#4267B2" }}
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          {printingAll
                            ? "Opening…"
                            : `Print all ${packs.length} invoices`}
                        </Button>
                      </div>
                    ) : null}
                    {packsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : packs.length === 0 ? (
                      <p className="text-sm text-violet-800">
                        No branch copies yet. Stock lines on this invoice will
                        split by branch here.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {packs.map((pack, idx) => {
                          const fMeta = getFulfillmentStatusMeta(pack.status);
                          const lines = pack.lines || [];
                          return (
                            <li
                              key={pack.id}
                              className="rounded-md border border-violet-100 bg-white px-3 py-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium text-gray-900 text-sm">
                                    Copy {idx + 1}/{packs.length} ·{" "}
                                    {pack.branch_name ||
                                      `Warehouse ${pack.branch_id}`}
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono">
                                    {pack.pack_code}
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${fMeta.badge}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${fMeta.dot}`}
                                  />
                                  {fMeta.label}
                                </span>
                              </div>
                              {lines.length > 0 ? (
                                <ul className="mt-2 space-y-0.5 text-xs text-gray-700">
                                  {lines.map((line) => (
                                    <li key={line.id}>
                                      {line.item_name || line.product_id} ×{" "}
                                      {formatNumber1(Number(line.qty || 0))}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={printingId === pack.id}
                                  onClick={() => markPrinted(pack)}
                                  className="h-8"
                                >
                                  <Printer className="w-3.5 h-3.5 mr-1" />
                                  {printingId === pack.id
                                    ? "Opening…"
                                    : "Print branch invoice"}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {selected.status === "invoice_separation" &&
                    packs.length > 0 ? (
                      <p className="mt-3 text-xs text-violet-700">
                        Print each branch copy, then Mark Separated to send to
                        warehouse.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {selected.status !== "completed" ? (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <Button
                      disabled={
                        advancing ||
                        !selected.next_status ||
                        !cashierCanConfirmSelected
                      }
                      onClick={() => advance("advance")}
                      style={{ backgroundColor: "#4267B2" }}
                    >
                      {advancing
                        ? "Updating…"
                        : advanceActionLabel(selected.next_status)}
                    </Button>
                    {!cashierCanConfirmSelected ? (
                      <p className="w-full text-xs text-amber-700">
                        This invoice payment type does not match your cashier
                        type (
                        {user?.cashier_type === "transfer"
                          ? "Bank Transfer"
                          : "Cash"}
                        ).
                      </p>
                    ) : null}
                    {selected.payment_type !== "credit" &&
                    [
                      "awaiting_payment",
                      "awaiting_cashier_confirm",
                      "submitted",
                    ].includes(selected.status) ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={advancing || selected.hold_overnight}
                        onClick={() =>
                          advance(
                            "hold_overnight",
                            "If not paid before closing hours",
                          )
                        }
                        className="text-red-700 border-red-200 hover:bg-red-50"
                      >
                        <Clock className="w-4 h-4 mr-1" />
                        {selected.hold_overnight
                          ? "Already held overnight"
                          : "Not paid before closing"}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-md bg-emerald-50 text-emerald-800 text-sm px-4 py-3">
                    Goods released — process completed.
                  </div>
                )}

                {Array.isArray(selected.history) && selected.history.length ? (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      History
                    </h3>
                    <ul className="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                      {[...selected.history].reverse().map((h, i) => {
                        const hMeta = getWorkflowStatusMeta(h.status);
                        return (
                          <li
                            key={`${h.at}-${i}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="font-mono text-gray-400">
                              {h.at
                                ? moment(h.at).format("MMM DD HH:mm")
                                : "—"}
                            </span>
                            <WorkflowStatusBadge
                              status={h.status}
                              label={hMeta.label}
                            />
                            {h.note ? (
                              <span className="text-gray-500">— {h.note}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
