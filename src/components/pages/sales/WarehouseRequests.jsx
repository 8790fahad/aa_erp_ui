import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileText,
  Package,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { formatNumber1 } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getFulfillmentStatusMeta,
  WorkflowStatusBadge,
} from "@/lib/saleWorkflowStatus.js";

export default function WarehouseRequests() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [collecting, setCollecting] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [branchFilter, setBranchFilter] = useState("all");
  const [invoiceItems, setInvoiceItems] = useState([]);

  const userBranchId = useMemo(() => {
    const bid = parseInt(user?.branchId ?? user?.branch_id, 10);
    return Number.isFinite(bid) && bid > 0 ? bid : null;
  }, [user]);

  const roleLower = String(user?.role || "").toLowerCase();
  const isAdmin =
    roleLower.includes("admin") ||
    roleLower.includes("owner") ||
    roleLower.includes("manager");

  const fetchList = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ facilityId: activeBusiness.id });
    const effectiveBranch =
      branchFilter !== "all"
        ? branchFilter
        : !isAdmin && userBranchId
          ? String(userBranchId)
          : null;
    if (effectiveBranch) params.set("branchId", effectiveBranch);

    _fetchApi(
      `/api/v1/sale-workflows/warehouse-requests?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res.success) {
          const list = res.results || [];
          setRows(list);
          setSelectedId((prev) => {
            if (prev && list.some((r) => r.id === prev)) return prev;
            return list[0]?.id || null;
          });
        } else {
          toast.error(res.message || "Failed to load warehouse requests");
          setRows([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Failed to load warehouse requests");
        setRows([]);
      },
    );
  }, [activeBusiness?.id, branchFilter, isAdmin, userBranchId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  const branchInvoiceUrl = useMemo(() => {
    if (!selected) return "";
    return `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
      selected.sale_code,
    )}&branch_id=${selected.branch_id}&pack_code=${encodeURIComponent(
      selected.pack_code,
    )}&collect=1`;
  }, [selected]);

  /** Load this branch's invoice lines — collect qty comes from the invoice. */
  useEffect(() => {
    if (!activeBusiness?.id || !selected?.sale_code) {
      setInvoiceItems([]);
      return;
    }
    setInvoiceLoading(true);
    _fetchApi(
      `/api/v1/transactions/get-sale?sale_code=${encodeURIComponent(
        selected.sale_code,
      )}&facility_id=${activeBusiness.id}`,
      (res) => {
        setInvoiceLoading(false);
        if (!res.success || !res.data) {
          setInvoiceItems([]);
          return;
        }
        const bid = parseInt(selected.branch_id, 10);
        const items = (res.data.items || []).filter((it) => {
          const itemBid = parseInt(it.branch_id ?? it.branchId, 10);
          return Number.isFinite(bid) && itemBid === bid;
        });
        setInvoiceItems(items);
      },
      () => {
        setInvoiceLoading(false);
        setInvoiceItems([]);
      },
    );
  }, [activeBusiness?.id, selected?.sale_code, selected?.branch_id, selected?.id]);

  /** Merge invoice lines with pack collect status (match by product). */
  const invoiceCollectRows = useMemo(() => {
    const packLines = selected?.lines || [];
    const used = new Set();

    const matchPackLine = (item) => {
      const sku = String(item.item_code || item.product_id || item.sku || "");
      const name = String(item.item_name || item.name || item.description || "")
        .trim()
        .toLowerCase();
      let found = packLines.find(
        (l) => !used.has(l.id) && String(l.product_id || "") === sku,
      );
      if (!found && name) {
        found = packLines.find(
          (l) =>
            !used.has(l.id) &&
            String(l.item_name || "")
              .trim()
              .toLowerCase() === name,
        );
      }
      if (found) used.add(found.id);
      return found || null;
    };

    if (invoiceItems.length > 0) {
      return invoiceItems.map((item, idx) => {
        const packLine = matchPackLine(item);
        const invoiceQty = Number(
          item.quantity_sold ?? item.quantity ?? item.qty ?? 0,
        );
        const collected = Number(packLine?.qty_collected || 0);
        return {
          key: `inv-${idx}-${item.id || item.item_code || idx}`,
          item_name: item.item_name || item.name || item.description || "Item",
          product_id: item.item_code || item.product_id || item.sku || "",
          invoice_qty: invoiceQty,
          amount: Number(item.amount || 0),
          pack_line_id: packLine?.id || null,
          qty_collected: collected,
          done: packLine
            ? collected >= Number(packLine.qty || invoiceQty)
            : false,
        };
      });
    }

    // Fallback to pack lines if invoice items missing branch meta
    return packLines.map((line) => ({
      key: `pack-${line.id}`,
      item_name: line.item_name || line.product_id,
      product_id: line.product_id || "",
      invoice_qty: Number(line.qty || 0),
      amount: null,
      pack_line_id: line.id,
      qty_collected: Number(line.qty_collected || 0),
      done:
        Number(line.qty_collected || 0) >= Number(line.qty || 0),
    }));
  }, [invoiceItems, selected?.lines]);

  const branchOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.branch_id != null) {
        map.set(r.branch_id, r.branch_name || `Warehouse ${r.branch_id}`);
      }
    });
    return [...map.entries()];
  }, [rows]);

  const collect = (pack, { collectAll = true, lineIds } = {}) => {
    if (!activeBusiness?.id || !pack) return;
    setCollecting(pack.id);
    _postApi(
      "/api/v1/sale-workflows/fulfillment/collect",
      {
        facilityId: activeBusiness.id,
        id: pack.id,
        packCode: pack.pack_code,
        collectAll,
        lineIds,
        updated_by: user?.id,
      },
      (res) => {
        setCollecting(null);
        if (res.success) {
          toast.success(res.message || "Invoice items collected");
          if (res.workflow?.status === "dual_signature") {
            toast.success("All branch invoices collected — dual signature");
          }
          fetchList();
        } else {
          toast.error(res.message || "Could not mark collected");
        }
      },
      () => {
        setCollecting(null);
        toast.error("Could not mark collected");
      },
    );
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Warehouse className="w-8 h-8 text-orange-600" />
                Warehouse Requests
              </h1>
              <p className="text-gray-600 mt-1">
                Collect items as shown on each branch invoice copy
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(isAdmin || branchOptions.length > 1) && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">All branches</option>
                  {branchOptions.map(([id, name]) => (
                    <option key={id} value={String(id)}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={fetchList}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Link
                to="/app/sales/process"
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Sales Process
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">
              Warehouse invoices to collect ({rows.length})
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No branch invoices waiting. After separation, each branch copy
                appears here for collection.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {rows.map((row) => {
                  const active = row.id === selectedId;
                  const fMeta = getFulfillmentStatusMeta(row.status);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors ${
                          active
                            ? "bg-orange-50 border-l-4 border-orange-500"
                            : ""
                        }`}
                      >
                        <div className="font-semibold text-gray-900 text-sm font-mono">
                          {row.sale_code}
                        </div>
                        <div className="text-sm text-gray-600">
                          {row.branch_name || `Warehouse ${row.branch_id}`} invoice
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${fMeta.badge}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${fMeta.dot}`}
                            />
                            {fMeta.label}
                          </span>
                          {row.workflow ? (
                            <WorkflowStatusBadge
                              status={row.workflow.status}
                              paymentType={row.workflow.payment_type}
                            />
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {Number(row.qty_collected || 0) > 0
                            ? `${formatNumber1(Number(row.qty_collected || 0))} / ${formatNumber1(Number(row.qty_total || 0))} collected`
                            : `${formatNumber1(Number(row.qty_total || 0))} to collect on invoice`}
                        </div>
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
                <Package className="w-10 h-10 text-gray-300" />
                Select a branch invoice to collect
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-orange-700 text-xs font-semibold uppercase tracking-wide mb-1">
                      <FileText className="w-3.5 h-3.5" />
                      Warehouse invoice
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 font-mono">
                      {selected.sale_code}
                    </h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {selected.branch_name || `Warehouse ${selected.branch_id}`} ·{" "}
                      <span className="font-mono text-xs text-gray-500">
                        {selected.pack_code}
                      </span>
                    </p>
                    {selected.workflow?.customer_name ? (
                      <p className="text-sm text-gray-500">
                        {selected.workflow.customer_name}
                      </p>
                    ) : null}
                    <p className="text-xs text-amber-800 mt-2 rounded-md bg-amber-50 border border-amber-100 px-2.5 py-1.5 max-w-lg">
                      Collect exactly the items and quantities on this branch
                      invoice — not items for other branches on the same sale.
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
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      to={branchInvoiceUrl}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4267B2] hover:underline"
                    >
                      Open branch invoice
                      <FileText className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Items on this invoice
                </div>

                {invoiceLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-orange-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-orange-50/80 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">
                            Invoice item
                          </th>
                          <th className="px-3 py-2 text-right font-semibold">
                            Invoice qty
                          </th>
                          <th className="px-3 py-2 text-right font-semibold">
                            Collect qty
                          </th>
                          <th className="px-3 py-2 text-right font-semibold">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoiceCollectRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-6 text-center text-slate-500"
                            >
                              No items on this branch invoice.
                            </td>
                          </tr>
                        ) : (
                          invoiceCollectRows.map((row) => (
                            <tr key={row.key} className="bg-white">
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-slate-900">
                                  {row.item_name}
                                </div>
                                {row.product_id ? (
                                  <div className="text-xs text-slate-500 font-mono">
                                    {row.product_id}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-800">
                                {formatNumber1(row.invoice_qty)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {row.done ? (
                                  <span className="inline-flex items-center gap-1 text-green-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Done
                                  </span>
                                ) : (
                                  <span className="tabular-nums font-medium text-orange-700">
                                    {formatNumber1(
                                      Math.max(
                                        0,
                                        Number(row.invoice_qty || 0) -
                                          Number(row.qty_collected || 0),
                                      ),
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                {!row.done && row.pack_line_id ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={collecting === selected.id}
                                    onClick={() =>
                                      collect(selected, {
                                        collectAll: false,
                                        lineIds: [row.pack_line_id],
                                      })
                                    }
                                    className="h-8"
                                  >
                                    Collect
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {selected.status !== "collected" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={collecting === selected.id}
                      onClick={() => collect(selected, { collectAll: true })}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {collecting === selected.id
                        ? "Updating…"
                        : "Collect all invoice items"}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link to={branchInvoiceUrl}>
                        <FileText className="w-4 h-4 mr-1.5" />
                        View / print invoice
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md bg-green-50 text-green-800 text-sm px-4 py-3">
                    All items on this branch invoice are collected.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
