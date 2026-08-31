import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileStack,
  History,
  Printer,
  RefreshCw,
  SplitSquareVertical,
} from "lucide-react";
import moment from "moment";
import { _fetchApi, _postApi } from "@/redux/actions/api";
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

export default function InvoiceSeparation() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const saleFromUrl = searchParams.get("sale_code") || "";
  const tabFromUrl = searchParams.get("tab") === "history" ? "history" : "pending";

  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [loading, setLoading] = useState(false);
  const [packsLoading, setPacksLoading] = useState(false);
  const [separating, setSeparating] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [pendingRows, setPendingRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [selectedCode, setSelectedCode] = useState(saleFromUrl);
  const [packs, setPacks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const rows = activeTab === "history" ? historyRows : pendingRows;

  const applyDashboardLists = useCallback(
    (pending, history) => {
      setPendingRows(pending);
      setHistoryRows(history);
      setSelectedCode((prev) => {
        if (saleFromUrl) {
          if (pending.some((r) => r.sale_code === saleFromUrl)) {
            setActiveTab("pending");
            return saleFromUrl;
          }
          if (history.some((r) => r.sale_code === saleFromUrl)) {
            setActiveTab("history");
            return saleFromUrl;
          }
        }
        if (prev) {
          if (pending.some((r) => r.sale_code === prev)) return prev;
          if (history.some((r) => r.sale_code === prev)) return prev;
        }
        return pending[0]?.sale_code || history[0]?.sale_code || "";
      });
    },
    [saleFromUrl],
  );

  const fetchListFallback = useCallback(() => {
    if (!activeBusiness?.id) return;
    const facilityId = activeBusiness.id;
    const pendingStatus =
      "payment_confirmed,invoice_separation,credit_approved,final_invoice";
    const historyStatus =
      "warehouse_picking,dual_signature,goods_released,completed";

    let pendingDone = false;
    let historyDone = false;
    let pending = [];
    let history = [];

    const finish = () => {
      if (!pendingDone || !historyDone) return;
      setLoading(false);
      applyDashboardLists(pending, history);
    };

    _fetchApi(
      `/api/v1/sale-workflows?facilityId=${facilityId}&status=${pendingStatus}`,
      (res) => {
        pendingDone = true;
        if (res.success) pending = res.results || [];
        finish();
      },
      () => {
        pendingDone = true;
        finish();
      },
    );

    _fetchApi(
      `/api/v1/sale-workflows?facilityId=${facilityId}&status=${historyStatus}`,
      (res) => {
        historyDone = true;
        if (res.success) history = res.results || [];
        finish();
      },
      () => {
        historyDone = true;
        finish();
      },
    );
  }, [activeBusiness?.id, applyDashboardLists]);

  const fetchList = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
    });
    _fetchApi(
      `/api/v1/sale-workflows/separation-dashboard?${params.toString()}`,
      (res) => {
        if (res.success) {
          setLoading(false);
          applyDashboardLists(
            res.results?.pending || [],
            res.results?.history || [],
          );
          return;
        }
        // Older API builds don't have separation-dashboard yet — fall back.
        fetchListFallback();
      },
      () => {
        fetchListFallback();
      },
    );
  }, [activeBusiness?.id, applyDashboardLists, fetchListFallback]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selected = useMemo(
    () =>
      rows.find((r) => r.sale_code === selectedCode) ||
      pendingRows.find((r) => r.sale_code === selectedCode) ||
      historyRows.find((r) => r.sale_code === selectedCode) ||
      null,
    [rows, pendingRows, historyRows, selectedCode],
  );

  const isHistoryRecord = activeTab === "history";

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
        String(r.customer_no || "")
          .toLowerCase()
          .includes(q),
    );
  }, [rows, searchQuery]);

  const handleSearchSelect = useCallback(
    (row, code) => {
      const saleCode = row?.sale_code || code;
      if (!saleCode) return;
      const inHistory = historyRows.some((r) => r.sale_code === saleCode);
      const inPending = pendingRows.some((r) => r.sale_code === saleCode);
      if (inHistory && !inPending) setActiveTab("history");
      else setActiveTab("pending");
      if (!inPending && !inHistory && row) {
        setPendingRows((prev) => [{ ...row, sale_code: saleCode }, ...prev]);
        setActiveTab("pending");
      }
      setSelectedCode(saleCode);
      const next = new URLSearchParams(searchParams);
      next.set("sale_code", saleCode);
      setSearchParams(next, { replace: true });
    },
    [historyRows, pendingRows, searchParams, setSearchParams],
  );

  const fetchPacks = useCallback(() => {
    if (!activeBusiness?.id || !selectedCode) {
      setPacks([]);
      return;
    }

    if (activeTab === "history") {
      const historyMatch = historyRows.find(
        (r) => r.sale_code === selectedCode,
      );
      if (historyMatch?.packs?.length) {
        setPacks(historyMatch.packs);
        setPacksLoading(false);
        return;
      }
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
  }, [activeBusiness?.id, selectedCode, historyRows, activeTab]);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const selectRow = (code) => {
    setSelectedCode(code);
    const next = new URLSearchParams(searchParams);
    if (code) next.set("sale_code", code);
    else next.delete("sale_code");
    if (activeTab === "history") next.set("tab", "history");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    const list = tab === "history" ? historyRows : pendingRows;
    const nextCode =
      (selectedCode && list.some((r) => r.sale_code === selectedCode)
        ? selectedCode
        : list[0]?.sale_code) || "";
    setSelectedCode(nextCode);
    const next = new URLSearchParams(searchParams);
    if (tab === "history") next.set("tab", "history");
    else next.delete("tab");
    if (nextCode) next.set("sale_code", nextCode);
    else next.delete("sale_code");
    setSearchParams(next, { replace: true });
  };

  const openBranchInvoice = (pack) => {
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
          fetchPacks();
          navigate(
            `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
              pack.sale_code,
            )}&doc=gin&branch_id=${pack.branch_id}&pack_code=${encodeURIComponent(
              pack.pack_code,
            )}&branch_name=${encodeURIComponent(
              pack.branch_name || `Warehouse ${pack.branch_id}`,
            )}`,
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
      if (failed) {
        toast.error("Some copies could not be marked printed");
      }
      const receiptType = String(
        activeBusiness?.default_receipt_type || "pdf",
      )
        .trim()
        .toLowerCase();
      const thermalQs = receiptType === "terminal" ? "&thermal=1" : "";
      navigate(
        `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
          selected.sale_code,
        )}&doc=gin&print_all=1&auto_print=1${thermalQs}`,
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

  const markSeparated = () => {
    if (!activeBusiness?.id || !selected) return;
    if (!packs.length) {
      toast.error("No store copies to separate");
      return;
    }
    setSeparating(true);
    _postApi(
      "/api/v1/sale-workflows/complete-separation",
      {
        facilityId: activeBusiness.id,
        saleCode: selected.sale_code,
        updated_by: user?.id,
        note: `Separated into ${packs.length} store invoice copies`,
      },
      (res) => {
        setSeparating(false);
        if (res.success) {
          toast.success(res.message || "Marked separated");
          setActiveTab("history");
          const next = new URLSearchParams(searchParams);
          next.set("tab", "history");
          if (selected.sale_code) next.set("sale_code", selected.sale_code);
          setSearchParams(next, { replace: true });
          fetchList();
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

  const needsCreditApproval =
    selected?.status === "awaiting_credit_approval";
  const canSeparate =
    selected &&
    !isHistoryRecord &&
    !needsCreditApproval &&
    [
      "payment_confirmed",
      "invoice_separation",
      "credit_approved",
      "final_invoice",
    ].includes(selected.status);

  const storeCountLabel =
    packs.length === 1
      ? "1 store copy"
      : `${packs.length} store copies`;

  const dispatchDocLabel =
    String(activeBusiness?.delivery_document_type || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_") === "goods_issue_note"
      ? "Goods Issue Note"
      : "Delivery Order";
  const isThermalDispatch =
    String(activeBusiness?.delivery_order_format || "")
      .trim()
      .toLowerCase() === "thermal";

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <SplitSquareVertical className="w-8 h-8 text-violet-600" />
                Invoice Separation
              </h1>
              <p className="text-gray-600 mt-1">
                Print the {dispatchDocLabel} per store (Sales Invoice is printed
                at Verification Points), then mark separated. Credit invoices
                appear here only after approval at Verification Points.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <Link
                to="/app/sales/warehouse-requests"
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Warehouse
              </Link>
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
            <div className="px-4 py-3 border-b border-gray-100 space-y-3">
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => switchTab("pending")}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${
                    activeTab === "pending"
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  Awaiting ({pendingRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("history")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                    activeTab === "history"
                      ? "bg-white text-violet-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  History ({historyRows.length})
                </button>
              </div>
              <SaleWorkflowSearchBar
                facilityId={activeBusiness?.id}
                rows={[...pendingRows, ...historyRows]}
                onSelect={handleSearchSelect}
                onQueryChange={setSearchQuery}
                placeholder="Search or scan invoice, customer…"
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
                {activeTab === "history"
                  ? "No separated invoices yet. Mark Separated moves sales here."
                  : "No invoices waiting. After Verification Points confirms payment (or approves credit), sales appear here to split by store."}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {visibleRows.map((row) => {
                  const active = row.sale_code === selectedCode;
                  return (
                    <li key={row.sale_code}>
                      <button
                        type="button"
                        onClick={() => selectRow(row.sale_code)}
                        className={`w-full text-left px-4 py-3 hover:bg-violet-50/60 ${
                          active
                            ? "bg-violet-50 border-l-4 border-violet-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-gray-900 font-mono text-sm">
                              {row.sale_code}
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {row.customer_name || "—"}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {moment(row.updated_at || row.updatedAt).format(
                                "DD MMM YYYY HH:mm",
                              )}
                            </div>
                            {activeTab === "history" && row.pack_count != null ? (
                              <div className="text-xs text-violet-700 mt-1">
                                {row.pack_count} store
                                {row.pack_count === 1 ? "" : "s"} ·{" "}
                                {row.packs_printed || 0} printed
                              </div>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              ₦{formatNumber1(Number(row.amount || 0))}
                            </div>
                            <div className="mt-1">
                              <WorkflowStatusBadge
                                status={row.status}
                                paymentType={row.payment_type}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm p-6 min-h-[420px]">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 py-16">
                <FileStack className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm">
                  Select a sale to view printed evidence by store.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 font-mono">
                      {selected.sale_code}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {selected.customer_name || "—"} · ₦
                      {formatNumber1(Number(selected.amount || 0))}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <WorkflowStatusBadge
                        status={selected.status}
                        paymentType={selected.payment_type}
                      />
                      {packs.length > 0 ? (
                        <span className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">
                          {storeCountLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                        selected.sale_code,
                      )}&doc=invoice`}
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Sales Invoice
                    </Link>
                    {needsCreditApproval && !isHistoryRecord ? (
                      <Link
                        to={`/app/payments/credit-approval`}
                        className="inline-flex items-center rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 hover:bg-rose-100"
                      >
                        Open Credit Approval
                      </Link>
                    ) : null}
                    {canSeparate && packs.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={printingAll || packsLoading}
                        onClick={printAllInvoices}
                        className="flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        {printingAll
                          ? "Opening…"
                          : `Print all ${dispatchDocLabel}s (${packs.length})`}
                      </Button>
                    ) : null}
                    {canSeparate ? (
                      <Button
                        type="button"
                        disabled={separating || packs.length === 0}
                        onClick={markSeparated}
                        style={{ backgroundColor: "var(--aa-navy)" }}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {separating ? "Separating…" : "Mark Separated"}
                      </Button>
                    ) : null}
                    {isHistoryRecord && packs.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={printingAll || packsLoading}
                        onClick={printAllInvoices}
                        className="flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        Reprint all {dispatchDocLabel}s ({packs.length})
                      </Button>
                    ) : null}
                  </div>
                </div>

                {needsCreditApproval && !isHistoryRecord ? (
                  <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    This credit sale is waiting for approval at{" "}
                    <strong>Verification Points → Credit</strong>. It cannot move
                    to Invoice Separation until credit is approved.
                  </div>
                ) : null}

                <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4 mb-4">
                  <h3 className="text-sm font-semibold text-violet-900 uppercase tracking-wide mb-1">
                    Printed Evidence
                  </h3>
                  <p className="text-xs text-violet-800 mb-3">
                    {needsCreditApproval && !isHistoryRecord
                      ? "Store copies appear only after credit is approved at Verification Points."
                      : packs.length
                        ? `One ${dispatchDocLabel} per store (${packs.length}). Sales Invoice is printed at Verification Points. Use Print all for ${
                            isThermalDispatch
                              ? "a continuous 80mm thermal strip (cut marks between stores)"
                              : String(activeBusiness?.default_receipt_type || "")
                                    .toLowerCase() === "a5"
                                ? `one A5 ${dispatchDocLabel} per warehouse`
                                : `one A4 ${dispatchDocLabel} per warehouse`
                          }, then mark separated.`
                        : "One evidence copy is created for each store involved in this invoice."}
                  </p>

                  {!needsCreditApproval && packs.length > 1 && canSeparate ? (
                    <div className="mb-3">
                      <Button
                        type="button"
                        size="sm"
                        disabled={printingAll}
                        onClick={printAllInvoices}
                        className="h-8"
                        style={{ backgroundColor: "var(--aa-navy)" }}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1" />
                        {printingAll
                          ? "Opening…"
                          : `Print all ${packs.length} ${dispatchDocLabel}s`}
                      </Button>
                    </div>
                  ) : null}

                  {packsLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : packs.length === 0 ? (
                    <p className="text-sm text-violet-800">
                      {needsCreditApproval && !isHistoryRecord
                        ? "No store copies yet — approve credit at Verification Points first."
                        : "No store lines found on this invoice yet."}
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {packs.map((pack, idx) => {
                        const fMeta = getFulfillmentStatusMeta(pack.status);
                        const lines = pack.lines || [];
                        return (
                          <li
                            key={pack.id}
                            className="rounded-md border border-violet-100 bg-white px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="font-medium text-gray-900 text-sm">
                                  Copy {idx + 1} of {packs.length} ·{" "}
                                  {pack.branch_name ||
                                    `Store ${pack.branch_id}`}
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

                            <table className="w-full text-sm mb-3">
                              <thead>
                                <tr className="text-left text-xs text-gray-500 border-b">
                                  <th className="py-1 font-medium">Item</th>
                                  <th className="py-1 font-medium text-right">
                                    Qty
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((line) => (
                                  <tr
                                    key={line.id}
                                    className="border-b border-gray-50"
                                  >
                                    <td className="py-1.5 text-gray-800">
                                      {line.item_name || line.product_id}
                                    </td>
                                    <td className="py-1.5 text-right text-gray-700">
                                      {formatNumber1(Number(line.qty || 0))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={printingId === pack.id}
                              onClick={() => openBranchInvoice(pack)}
                              className="h-8"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              {printingId === pack.id
                                ? "Opening…"
                                : isHistoryRecord
                                  ? `Reprint ${dispatchDocLabel}`
                                  : `Print ${dispatchDocLabel}`}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {canSeparate && packs.length > 0 ? (
                  <p className="text-xs text-gray-500">
                    After you print the copies, click{" "}
                    <strong>Mark Separated</strong> to move this sale to
                    Warehouse Requests (and History).
                  </p>
                ) : null}

                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Process history
                  </h3>
                  {selectedHistory.length ? (
                    <ul className="text-xs text-gray-600 space-y-2 max-h-48 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-3">
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
