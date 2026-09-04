import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  History,
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
  FULFILLMENT_STATUS_META,
  getFulfillmentStatusMeta,
} from "@/lib/saleWorkflowStatus.js";
import SaleWorkflowSearchBar from "./SaleWorkflowSearchBar";

export default function WarehouseRequests() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [collecting, setCollecting] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [branchFilter, setBranchFilter] = useState("all");
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [listTab, setListTab] = useState("pending");

  const userBranchIds = useMemo(() => {
    if (Array.isArray(user?.branchIds) && user.branchIds.length > 0) {
      return user.branchIds.map(Number).filter(Boolean);
    }
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((b) => Number(b.id || b.branch_id))
        .filter(Boolean);
    }
    const bid = parseInt(user?.branchId ?? user?.branch_id, 10);
    return Number.isFinite(bid) && bid > 0 ? [bid] : [];
  }, [user?.branchIds, user?.branches, user?.branchId, user?.branch_id]);

  const assignedWarehouses = useMemo(() => {
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((b) => ({
          id: Number(b.id || b.branch_id),
          name: b.branch_name || b.name || `Warehouse ${b.id || b.branch_id}`,
        }))
        .filter((b) => Number.isFinite(b.id) && b.id > 0);
    }
    return userBranchIds.map((id) => ({ id, name: `Warehouse ${id}` }));
  }, [user?.branches, userBranchIds]);

  const fetchList = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({ facilityId: activeBusiness.id });
    if (user?.id) params.set("userId", String(user.id));
    if (branchFilter !== "all") {
      params.set("branchId", String(branchFilter));
    } else if (userBranchIds.length) {
      params.set("branchId", userBranchIds.join(","));
    }

    _fetchApi(
      `/api/v1/sale-workflows/warehouse-requests?${params.toString()}`,
      (res) => {
        setLoading(false);
        if (res.success) {
          const list = res.results || [];
          setRows(list);
          setSelectedId((prev) => {
            if (prev && list.some((r) => r.id === prev)) return prev;
            const pending = list.filter(
              (r) => String(r.status || "").toLowerCase() !== "collected",
            );
            return pending[0]?.id || list[0]?.id || null;
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
  }, [activeBusiness?.id, branchFilter, user?.id, userBranchIds]);

  const pendingRows = useMemo(
    () =>
      rows.filter(
        (r) => String(r.status || "").toLowerCase() !== "collected",
      ),
    [rows],
  );

  const collectedRows = useMemo(() => {
    const list = rows.filter(
      (r) => String(r.status || "").toLowerCase() === "collected",
    );
    return list.sort((a, b) => {
      const ta = new Date(a.collected_at || a.updated_at || 0).getTime();
      const tb = new Date(b.collected_at || b.updated_at || 0).getTime();
      return tb - ta;
    });
  }, [rows]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  const selectedHistory = useMemo(() => {
    if (!selected) return [];
    const events = [];
    if (selected.printed_at) {
      events.push({
        at: selected.printed_at,
        status: "printed",
        note: "Warehouse invoice printed",
        by: null,
      });
    }
    if (
      String(selected.status || "").toLowerCase() === "collecting" &&
      selected.updated_at
    ) {
      events.push({
        at: selected.updated_at,
        status: "collecting",
        note: "Collection in progress",
        by: selected.updated_by,
      });
    }
    if (selected.collected_at) {
      events.push({
        at: selected.collected_at,
        status: "collected",
        note: "Goods collected on this branch invoice",
        by: selected.updated_by,
      });
    }
    return events.sort((a, b) => {
      const ta = new Date(a.at || 0).getTime();
      const tb = new Date(b.at || 0).getTime();
      return tb - ta;
    });
  }, [selected]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const pool = listTab === "history" ? collectedRows : pendingRows;
    if (!pool.length) return;
    if (selectedId && pool.some((r) => r.id === selectedId)) return;
    setSelectedId(pool[0].id);
  }, [listTab, collectedRows, pendingRows, selectedId]);

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const source = listTab === "history" ? collectedRows : pendingRows;
    if (!q) return source;
    return source.filter(
      (r) =>
        String(r.sale_code || "")
          .toLowerCase()
          .includes(q) ||
        String(r.pack_code || "")
          .toLowerCase()
          .includes(q) ||
        String(r.customer_name || r.workflow?.customer_name || "")
          .toLowerCase()
          .includes(q) ||
        String(r.branch_name || "")
          .toLowerCase()
          .includes(q),
    );
  }, [rows, pendingRows, collectedRows, searchQuery, listTab]);

  const handleSearchSelect = useCallback((row) => {
    if (row?.id != null) {
      if (String(row.status || "").toLowerCase() === "collected") {
        setListTab("history");
      } else {
        setListTab("pending");
      }
      setSelectedId(row.id);
      return;
    }
    if (row?.sale_code) {
      setRows((prev) => {
        const match = prev.find((r) => r.sale_code === row.sale_code);
        if (match) {
          if (String(match.status || "").toLowerCase() === "collected") {
            setListTab("history");
          } else {
            setListTab("pending");
          }
          setSelectedId(match.id);
          return prev;
        }
        return prev;
      });
    }
  }, []);

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
    if (assignedWarehouses.length) {
      return assignedWarehouses.map((w) => [w.id, w.name]);
    }
    const map = new Map();
    rows.forEach((r) => {
      if (r.branch_id != null) {
        map.set(r.branch_id, r.branch_name || `Warehouse ${r.branch_id}`);
      }
    });
    return [...map.entries()];
  }, [rows, assignedWarehouses]);

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
          setListTab("history");
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
                Warehouse Collection
              </h1>
              <p className="text-gray-600 mt-1">
                Collect goods after Invoice Separation for each branch invoice.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {branchOptions.length > 1 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="all">
                    {userBranchIds.length
                      ? "My warehouses"
                      : "All warehouses"}
                  </option>
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
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setListTab("pending")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                    listTab === "pending"
                      ? "bg-white text-[var(--aa-navy)] shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Pending ({pendingRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setListTab("history")}
                  className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                    listTab === "history"
                      ? "bg-white text-[var(--aa-navy)] shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  History ({collectedRows.length})
                </button>
              </div>
              <div className="font-semibold text-gray-800">
                {listTab === "history"
                  ? "Collected invoices"
                  : "Warehouse invoices to collect"}
              </div>
              <SaleWorkflowSearchBar
                facilityId={activeBusiness?.id}
                rows={rows}
                getRowCode={(r) => r.pack_code || r.sale_code}
                onSelect={handleSearchSelect}
                onQueryChange={setSearchQuery}
                placeholder="Search or scan invoice, pack, customer…"
              />
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                {listTab === "history"
                  ? "No collected invoices yet. Marked collections appear here."
                  : "No branch invoices waiting. After separation, each branch copy appears here for collection."}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {visibleRows.map((row) => {
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
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {String(row.status || "").toLowerCase() ===
                          "collected"
                            ? `Collected${
                                row.collected_at
                                  ? ` ${moment(row.collected_at).format(
                                      "DD MMM, HH:mm",
                                    )}`
                                  : ""
                              }`
                            : Number(row.qty_collected || 0) > 0
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
                Select a branch invoice
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-orange-700 text-xs font-semibold uppercase tracking-wide mb-1">
                      <Package className="w-3.5 h-3.5" />
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
                    {selected.status !== "collected" ? (
                      <p className="text-xs text-amber-800 mt-2 rounded-md bg-amber-50 border border-amber-100 px-2.5 py-1.5 max-w-lg">
                        Collect exactly the items and quantities on this branch
                        invoice — not items for other branches on the same sale.
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-400 mt-1">
                      Updated{" "}
                      {selected.updated_at
                        ? moment(selected.updated_at).format(
                            "MMM DD, YYYY HH:mm",
                          )
                        : "—"}
                    </p>
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoiceCollectRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
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
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {selected.status !== "collected" ? (
                  <div className="mt-4">
                    <Button
                      type="button"
                      disabled={collecting === selected.id}
                      onClick={() => collect(selected, { collectAll: true })}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {collecting === selected.id ? "Updating…" : "Collected"}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md bg-green-50 text-green-800 text-sm px-4 py-3">
                    All items on this branch invoice are collected
                    {selected.collected_at
                      ? ` · ${moment(selected.collected_at).format(
                          "DD MMM YYYY, HH:mm",
                        )}`
                      : ""}
                    .
                  </div>
                )}

                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Collection history
                  </h3>
                  {selectedHistory.length ? (
                    <ul className="text-xs text-gray-600 space-y-2 max-h-56 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-3">
                      {selectedHistory.map((h, i) => {
                        const fMeta =
                          FULFILLMENT_STATUS_META[h.status] ||
                          FULFILLMENT_STATUS_META.pending;
                        return (
                          <li
                            key={`${h.at}-${h.status}-${i}`}
                            className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                          >
                            <span className="font-mono text-gray-400 shrink-0">
                              {h.at
                                ? moment(h.at).format("DD MMM YYYY HH:mm")
                                : "—"}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${fMeta.badge}`}
                            >
                              {fMeta.label}
                            </span>
                            {h.by ? (
                              <span className="text-gray-500">by {h.by}</span>
                            ) : null}
                            {h.note ? (
                              <span className="w-full text-gray-500">
                                {h.note}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 rounded-md border border-dashed border-gray-200 px-3 py-4">
                      No collection history recorded for this invoice yet.
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
