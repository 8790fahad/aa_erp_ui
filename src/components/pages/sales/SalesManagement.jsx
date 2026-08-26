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
import { _fetchApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { formatNumber1 } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFulfillmentStatusMeta,
  getWorkflowStatusMeta,
  normalizeWorkflowHistory,
  WorkflowStatusBadge,
} from "@/lib/saleWorkflowStatus.js";
import SaleWorkflowSearchBar from "./SaleWorkflowSearchBar";

const FILTERS = [
  { id: "active", label: "In progress" },
  { id: "invoice", label: "Invoice", statuses: ["sales_order", "invoice_generated", "submitted"] },
  {
    id: "cashier",
    label: "Verification Points",
    statuses: ["awaiting_payment", "awaiting_cashier_confirm"],
  },
  {
    id: "paid",
    label: "Invoice Separation",
    statuses: [
      "payment_confirmed",
      "invoice_separation",
      "credit_approved",
      "final_invoice",
    ],
  },
  {
    id: "warehouse",
    label: "Warehouse Collection",
    statuses: ["warehouse_picking"],
  },
  {
    id: "discount",
    label: "Discount",
    statuses: ["awaiting_discount_approval"],
  },
  { id: "credit", label: "Credit", statuses: ["awaiting_credit_approval"] },
  {
    id: "done",
    label: "Done",
    statuses: ["dual_signature", "goods_released", "completed"],
  },
  { id: "all", label: "All" },
];

function paymentTypeLabel(type) {
  if (type === "credit") return "Credit";
  if (type === "deposit") return "Apply Deposit";
  if (type === "credit_split") return "Credit + Cash + Transfer";
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
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("active");
  const [selectedCode, setSelectedCode] = useState(saleFromUrl);
  const [packs, setPacks] = useState([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
            list = list.filter(
              (r) =>
                ![
                  "completed",
                  "dual_signature",
                  "goods_released",
                  "cancelled",
                  "reversed",
                ].includes(r.status),
            );
          } else if (filter === "done") {
            list = list.filter((r) =>
              ["completed", "dual_signature", "goods_released"].includes(
                r.status,
              ),
            );
          }

          const parsePriv = (raw) => {
            if (Array.isArray(raw)) return raw.filter(Boolean);
            if (typeof raw === "string" && raw.trim()) {
              return raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            }
            return [];
          };
          const privs = [
            ...new Set([
              ...parsePriv(user?.functionalities),
              ...parsePriv(activeBusiness?.functionalities),
            ]),
          ];
          const hasCash = privs.includes("Cash Collection");
          const hasTransfer = privs.includes("Transfer Collection");
          const hasAnyCollectionTab =
            hasCash ||
            hasTransfer ||
            privs.includes("Credit Collection");
          // Only restrict when user has an explicit Cash/Transfer collection privilege
          if (hasAnyCollectionTab && (hasCash || hasTransfer) && !(hasCash && hasTransfer)) {
            list = list.filter((r) => {
              if (
                r.status !== "awaiting_cashier_confirm" &&
                r.status !== "awaiting_payment"
              ) {
                return true;
              }
              const pt = String(r.payment_type || "").toLowerCase();
              if (hasCash && !hasTransfer) {
                return pt === "cash" || pt === "split";
              }
              if (hasTransfer && !hasCash) {
                return pt === "transfer" || pt === "bank" || pt === "split";
              }
              return true;
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
  }, [activeBusiness?.id, activeBusiness?.functionalities, filter, saleFromUrl, user?.functionalities]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selected = useMemo(
    () => rows.find((r) => r.sale_code === selectedCode) || null,
    [rows, selectedCode],
  );

  const selectedHistory = useMemo(
    () => normalizeWorkflowHistory(selected?.history),
    [selected?.history],
  );

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.sale_code || "")
          .toLowerCase()
          .includes(q) ||
        String(r.customer_name || "")
          .toLowerCase()
          .includes(q) ||
        String(r.pack_code || "")
          .toLowerCase()
          .includes(q),
    );
  }, [rows, searchQuery]);

  const handleSearchSelect = useCallback(
    (row, code) => {
      const saleCode = row?.sale_code || code;
      if (!saleCode) return;
      setRows((prev) => {
        if (prev.some((r) => r.sale_code === saleCode)) return prev;
        return [{ ...row, sale_code: saleCode }, ...prev];
      });
      setFilter("all");
      setSelectedCode(saleCode);
      const next = new URLSearchParams(searchParams);
      next.set("sale_code", saleCode);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
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

  const selectRow = (code) => {
    setSelectedCode(code);
    const next = new URLSearchParams(searchParams);
    if (code) next.set("sale_code", code);
    else next.delete("sale_code");
    setSearchParams(next, { replace: true });
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
    if (["awaiting_discount_approval"].includes(s)) {
      return "awaiting_discount_approval";
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
    if (["warehouse_picking"].includes(s)) {
      return "warehouse_picking";
    }
    if (["dual_signature", "goods_released", "completed"].includes(s)) {
      return "completed";
    }
    return s;
  })();
  const currentIdx = stagePath.findIndex((s) => s.id === timelineStatusId);

  const nextActionHub = (() => {
    if (!selected || selected.status === "completed") return null;
    const s = selected.status;
    if (
      ["awaiting_payment", "awaiting_cashier_confirm", "submitted"].includes(s)
    ) {
      return {
        title: "Next: Verification Points",
        description: "Collect payment for this invoice at Verification Points.",
        to: "/app/payments/verification-points",
        label: "Open Verification Points",
      };
    }
    if (s === "awaiting_discount_approval") {
      return {
        title: "Next: Discount approval",
        description:
          "Approve the discount at Verification Points before cash/transfer collection.",
        to: "/app/payments/verification-points",
        label: "Open Verification Points",
      };
    }
    if (s === "awaiting_credit_approval") {
      return {
        title: "Next: Credit approval",
        description: "Approve this credit sale at Verification Points.",
        to: "/app/payments/verification-points",
        label: "Open Verification Points",
      };
    }
    if (
      [
        "payment_confirmed",
        "invoice_separation",
        "credit_approved",
        "final_invoice",
      ].includes(s)
    ) {
      return {
        title: "Next: Invoice Separation",
        description:
          "Split the invoice into warehouse copies on Invoice Separation.",
        to: `/app/sales/separation?sale_code=${encodeURIComponent(selected.sale_code)}`,
        label: "Open Invoice Separation",
      };
    }
    if (s === "warehouse_picking") {
      return {
        title: "Next: Warehouse Collection",
        description: "Collect goods and print the collection receipt.",
        to: "/app/sales/warehouse-requests",
        label: "Open Warehouse Collection",
      };
    }
    return null;
  })();

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-blue-600" />
                Sales Process
              </h1>
              <p className="text-gray-600 mt-1">
                Customer → Create Invoice → Verification Points → Invoice
                Separation → Warehouse Collection.
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
                Invoice Separation
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/sales/warehouse-requests")}
                className="flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Warehouse Collection
              </Button>
              <Button
                onClick={() => navigate("/app/sales/sale?view=lines")}
                className="flex items-center gap-2"
                style={{ backgroundColor: "var(--aa-navy)" }}
              >
                Create Invoice
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
                    ? "bg-[var(--aa-navy)] text-white border-blue-600"
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
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="font-semibold text-gray-800">
                Sales queue ({visibleRows.length})
              </div>
              <SaleWorkflowSearchBar
                facilityId={activeBusiness?.id}
                rows={rows}
                onSelect={handleSearchSelect}
                onQueryChange={setSearchQuery}
                placeholder="Search or scan invoice, customer…"
              />
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No sales in this queue yet. Create an invoice to start the
                process.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {visibleRows.map((row) => {
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
                Select a sale to track its progress
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
                    className="inline-flex items-center gap-1 text-sm text-[var(--aa-accent)] hover:underline"
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
                    </div>
                    <p className="text-xs text-violet-800 mb-3">
                      Read-only here. Print and collect from Invoice Separation /
                      Warehouse Collection.
                    </p>
                    {packsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : packs.length === 0 ? (
                      <p className="text-sm text-violet-800">
                        No warehouse copies yet.
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
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}

                {selected.status === "completed" ||
                ["dual_signature", "goods_released"].includes(
                  selected.status,
                ) ? (
                  <div className="rounded-md bg-emerald-50 text-emerald-800 text-sm px-4 py-3">
                    Process completed — goods collected.
                  </div>
                ) : nextActionHub ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {nextActionHub.title}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {nextActionHub.description}
                    </p>
                    <Button
                      type="button"
                      className="mt-3"
                      style={{ backgroundColor: "var(--aa-navy)" }}
                      onClick={() => navigate(nextActionHub.to)}
                    >
                      {nextActionHub.label}
                    </Button>
                  </div>
                ) : null}

                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Process history
                  </h3>
                  {selectedHistory.length ? (
                    <ul className="text-xs text-gray-600 space-y-2 max-h-56 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-3">
                      {[...selectedHistory].reverse().map((h, i) => {
                        const hMeta = getWorkflowStatusMeta(h.status);
                        return (
                          <li
                            key={`${h.at}-${i}`}
                            className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                          >
                            <span className="font-mono text-gray-400 shrink-0">
                              {h.at
                                ? moment(h.at).format("DD MMM YYYY HH:mm")
                                : "—"}
                            </span>
                            <WorkflowStatusBadge
                              status={h.status}
                              label={hMeta.label}
                            />
                            {h.by ? (
                              <span className="text-gray-500">by {h.by}</span>
                            ) : null}
                            {h.note ? (
                              <span className="w-full text-gray-500 pl-0 sm:pl-0">
                                {h.note}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 rounded-md border border-dashed border-gray-200 px-3 py-4">
                      No history recorded for this sale yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
