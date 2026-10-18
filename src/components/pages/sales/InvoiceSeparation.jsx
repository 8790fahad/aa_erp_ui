import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
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
import {
  canAccessPrivileges,
  getUserFunctionalities,
} from "@/lib/access";

const REPRINT_GOODS_ISSUE_PRIVILEGE = "Reprint Goods Issue Note";
const HISTORY_PRIVILEGE = "Invoice Separation History";
const HISTORY_STATUSES = new Set([
  "warehouse_picking",
  "dual_signature",
  "goods_released",
  "completed",
]);
const QUEUE_STATUSES = new Set([
  "payment_confirmed",
  "invoice_separation",
  "credit_approved",
  "final_invoice",
]);

function isPackPrinted(pack) {
  if (!pack) return false;
  if (pack.printed_at) return true;
  return ["printed", "collecting", "collected"].includes(
    String(pack.status || "").toLowerCase(),
  );
}

export default function InvoiceSeparation() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const functionalities = getUserFunctionalities(user, activeBusiness);
  const canReprintGoodsIssue = canAccessPrivileges(
    [REPRINT_GOODS_ISSUE_PRIVILEGE],
    functionalities,
  );
  const canViewHistory = canAccessPrivileges(
    [HISTORY_PRIVILEGE],
    functionalities,
  );
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const saleFromUrl = searchParams.get("sale_code") || "";
  const tabFromUrl =
    searchParams.get("tab") === "history" && canViewHistory
      ? "history"
      : "pending";

  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [loading, setLoading] = useState(false);
  const [packsLoading, setPacksLoading] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const [printingAll, setPrintingAll] = useState(false);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [pendingRows, setPendingRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [selectedCode, setSelectedCode] = useState(saleFromUrl);
  const [packs, setPacks] = useState([]);
  const [searchQuery, setSearchQuery] = useState(saleFromUrl);
  const loadedCode = useRef("");

  const rows = activeTab === "history" ? historyRows : pendingRows;

  const placeWorkflow = useCallback(
    (row) => {
      const saleCode = row?.sale_code;
      if (!saleCode) return;
      const isHistory = HISTORY_STATUSES.has(String(row.status || ""));
      loadedCode.current = saleCode;
      if (isHistory && canViewHistory) {
        setHistoryRows([row]);
        setPendingRows((prev) => prev.filter((item) => item.sale_code !== saleCode));
        setActiveTab("history");
        setSelectedCode(saleCode);
      } else if (isHistory) {
        setPendingRows([]);
        setSelectedCode("");
        toast.message(`${saleCode} is already separated.`);
      } else {
        setPendingRows([row]);
        setActiveTab("pending");
        setSelectedCode(saleCode);
      }
      setSearchQuery(saleCode);
    },
    [canViewHistory],
  );

  const fetchAwaitingCount = useCallback(() => {
    if (!activeBusiness?.id) return;
    const status = [...QUEUE_STATUSES].join(",");
    _fetchApi(
      `/api/v1/sale-workflows?facilityId=${encodeURIComponent(
        activeBusiness.id,
      )}&status=${status}&countOnly=1`,
      (res) => {
        if (res?.success) setAwaitingCount(Number(res.count) || 0);
      },
      () => {},
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchAwaitingCount();
  }, [fetchAwaitingCount]);

  const fetchOne = useCallback(
    (saleCode) => {
      const code = String(saleCode || "").trim();
      if (!activeBusiness?.id || !code) return;
      loadedCode.current = code;
      setLoading(true);
      _fetchApi(
        `/api/v1/sale-workflows/one?facilityId=${encodeURIComponent(
          activeBusiness.id,
        )}&saleCode=${encodeURIComponent(code)}`,
        (res) => {
          setLoading(false);
          const row = res?.results || res?.result;
          if (!res?.success || !row) {
            loadedCode.current = "";
            setPendingRows([]);
            setHistoryRows([]);
            setSelectedCode("");
            toast.error(res?.message || `No invoice found for ${code}`);
            return;
          }
          placeWorkflow(row);
        },
        () => {
          setLoading(false);
          loadedCode.current = "";
          toast.error(`No invoice found for ${code}`);
        },
      );
    },
    [activeBusiness?.id, placeWorkflow],
  );

  useEffect(() => {
    if (!activeBusiness?.id || !saleFromUrl) return;
    if (loadedCode.current === saleFromUrl) return;
    fetchOne(saleFromUrl);
  }, [activeBusiness?.id, saleFromUrl, fetchOne]);

  const selected = useMemo(
    () =>
      rows.find((r) => r.sale_code === selectedCode) ||
      pendingRows.find((r) => r.sale_code === selectedCode) ||
      historyRows.find((r) => r.sale_code === selectedCode) ||
      null,
    [rows, pendingRows, historyRows, selectedCode],
  );

  const isHistoryRecord = activeTab === "history";
  const needsCreditApproval =
    selected?.status === "awaiting_credit_approval";
  const parkedPaidModeSwitch =
    selected?.status === "awaiting_payment_mode_approval" &&
    [
      "payment_confirmed",
      "invoice_separation",
      "credit_approved",
      "final_invoice",
    ].includes(selected?.pending_payment_mode?.previous_status);
  const canSeparate =
    selected &&
    !isHistoryRecord &&
    !needsCreditApproval &&
    ([
      "payment_confirmed",
      "invoice_separation",
      "credit_approved",
      "final_invoice",
    ].includes(selected.status) ||
      parkedPaidModeSwitch);

  const selectedHistory = useMemo(
    () => normalizeWorkflowHistory(selected?.history),
    [selected?.history],
  );

  const visibleRows = rows;

  const handleSearchQueryChange = useCallback(
    (value) => {
      const next = String(value || "");
      setSearchQuery(next);
      if (next.trim()) return;
      loadedCode.current = "";
      setSelectedCode("");
      setPendingRows([]);
      setHistoryRows([]);
      setPacks([]);
      setActiveTab("pending");
      setSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete("sale_code");
        return nextParams;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const handleSearchSelect = useCallback(
    (row, code) => {
      const saleCode = row?.sale_code || code;
      if (!saleCode || !row) return;
      placeWorkflow(row);
      const next = new URLSearchParams(searchParams);
      next.set("sale_code", saleCode);
      next.delete("tab");
      setSearchParams(next, { replace: true });
    },
    [placeWorkflow, searchParams, setSearchParams],
  );

  useEffect(() => {
    if (canViewHistory || activeTab !== "history") return;
    setActiveTab("pending");
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete("tab");
      return next;
    }, { replace: true });
  }, [activeTab, canViewHistory, setSearchParams]);

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
    if (tab === "history" && !canViewHistory) {
      toast.error("You need History permission to open Invoice Separation history.");
      return;
    }
    setActiveTab(tab);
    const list = tab === "history" ? historyRows : pendingRows;
    const nextCode =
      selectedCode && list.some((r) => r.sale_code === selectedCode)
        ? selectedCode
        : "";
    setSelectedCode(nextCode);
    const next = new URLSearchParams(searchParams);
    if (tab === "history") next.set("tab", "history");
    else next.delete("tab");
    if (nextCode) next.set("sale_code", nextCode);
    else next.delete("sale_code");
    setSearchParams(next, { replace: true });
  };

  const denyReprint = () => {
    toast.error(
      "This Goods Issue Note is already printed. Ask an admin for Reprint Goods Issue Note permission.",
    );
  };

  const completeSeparation = (saleCode, packCount, done) => {
    if (!activeBusiness?.id || !saleCode) {
      done?.({ success: false });
      return;
    }
    _postApi(
      "/api/v1/sale-workflows/complete-separation",
      {
        facilityId: activeBusiness.id,
        saleCode,
        updated_by: user?.id,
        note: `Printed and separated into ${packCount || 1} store invoice copies`,
      },
      (res) => {
        if (res?.success) {
          fetchAwaitingCount();
          fetchOne(saleCode);
        }
        done?.(res);
      },
      () => done?.({ success: false }),
    );
  };

  const openPrintPreview = (pack, line) => {
    navigate(
      `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
        pack.sale_code,
      )}&doc=gin&branch_id=${pack.branch_id}&pack_code=${encodeURIComponent(
        pack.pack_code,
      )}&branch_name=${encodeURIComponent(
        pack.branch_name || `Warehouse ${pack.branch_id}`,
      )}${
        line?.id
          ? `&line_id=${encodeURIComponent(line.id)}&product_id=${encodeURIComponent(
              line.product_id || "",
            )}`
          : ""
      }&auto_print=1`,
    );
  };

  const openBranchInvoice = (pack, line) => {
    if (!activeBusiness?.id || !pack) return;
    const alreadyPrinted = isPackPrinted(pack);
    if (alreadyPrinted && !canReprintGoodsIssue && !canSeparate) {
      denyReprint();
      return;
    }
    const afterPreview = () => {
      setPrintingId(null);
      fetchPacks();
      if (canSeparate) {
        completeSeparation(pack.sale_code || selected?.sale_code, packs.length);
      }
    };
    // Same as Verification: one click opens the page, and that page opens
    // the print dialog. Marking the copy printed does not hold the click.
    openPrintPreview(pack, line);
    afterPreview();
    if (alreadyPrinted && !canReprintGoodsIssue) return;
    _postApi(
      "/api/v1/sale-workflows/fulfillment/print",
      {
        facilityId: activeBusiness.id,
        id: pack.id,
        packCode: pack.pack_code,
        updated_by: user?.id,
      },
      (res) => {
        if (!res?.success) {
          toast.error(res?.message || "Could not mark this copy printed");
        }
      },
      () => {
        toast.error("Could not mark this copy printed");
      },
    );
  };

  const printPreviewUrl = useCallback(
    (codes) => {
      const unique = [...new Set((codes || []).filter(Boolean))];
      const receiptType = String(
        activeBusiness?.default_receipt_type || "pdf",
      )
        .trim()
        .toLowerCase();
      const thermalQs = receiptType === "terminal" ? "&thermal=1" : "";
      const params = new URLSearchParams({
        doc: "gin",
        print_all: "1",
        per_product: "1",
        auto_print: "1",
      });
      if (unique.length === 1) params.set("sale_code", unique[0]);
      else params.set("sale_codes", unique.join(","));
      return `/app/sales/invoice-preview?${params.toString()}${thermalQs}`;
    },
    [activeBusiness?.default_receipt_type],
  );

  const markPacksPrinted = useCallback(
    (packList, done) => {
      const uniquePacks = [];
      const seen = new Set();
      for (const pack of packList || []) {
        const key = pack?.id || pack?.pack_code;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniquePacks.push(pack);
      }
      if (!uniquePacks.length) {
        done(false);
        return;
      }
      let remaining = uniquePacks.length;
      let failed = false;
      uniquePacks.forEach((pack) => {
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
            remaining -= 1;
            if (remaining <= 0) done(failed);
          },
          () => {
            failed = true;
            remaining -= 1;
            if (remaining <= 0) done(failed);
          },
        );
      });
    },
    [activeBusiness?.id, user?.id],
  );

  const openPrintAllPreview = useCallback(
    (codes, packList) => {
      const unique = [...new Set((codes || []).filter(Boolean))];
      if (!unique.length) {
        setPrintingAll(false);
        toast.error("No invoices to print");
        return;
      }
      const toMark = packList.filter((pack) => !isPackPrinted(pack));
      const pendingCodes = unique.filter((code) =>
        pendingRows.some((row) => row.sale_code === code),
      );
      navigate(printPreviewUrl(unique));
      setPrintingAll(false);
      fetchPacks();
      pendingCodes.forEach((code) => {
        const count = packList.filter((pack) => pack.sale_code === code).length;
        completeSeparation(code, count || packs.length);
      });
      if (!toMark.length) return;
      markPacksPrinted(toMark, (failed) => {
        if (failed) toast.error("Some copies could not be marked printed");
      });
    },
    [fetchPacks, markPacksPrinted, navigate, pendingRows, packs.length, printPreviewUrl],
  );

  const printAllInvoices = () => {
    if (!activeBusiness?.id || !selected || packs.length === 0) return;
    const toPrint =
      canSeparate || canReprintGoodsIssue
        ? packs
        : packs.filter((pack) => !isPackPrinted(pack));
    if (!toPrint.length) {
      denyReprint();
      return;
    }
    setPrintingAll(true);
    openPrintAllPreview([selected.sale_code], toPrint);
  };

  const productPrints = packs.flatMap((pack) => {
    const lines =
      Array.isArray(pack.lines) && pack.lines.length ? pack.lines : [null];
    return lines.map((line) => ({ pack, line }));
  });
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
                Print one {dispatchDocLabel} for each product (Sales Invoice is
                printed at Verification Points). Printing marks the sale
                separated. After a copy is printed, reprint needs Reprint Goods
                Issue Note permission.                 Enter or scan one invoice number. Credit invoices open here
                only after approval at Verification Points.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  fetchAwaitingCount();
                  if (selectedCode) fetchOne(selectedCode);
                  fetchPacks();
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
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
                  Awaiting ({awaitingCount})
                </button>
                {canViewHistory ? (
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
                ) : null}
              </div>
              <SaleWorkflowSearchBar
                facilityId={activeBusiness?.id}
                remote
                initialQuery={saleFromUrl}
                onSelect={handleSearchSelect}
                onQueryChange={handleSearchQueryChange}
                placeholder="Enter or scan invoice number"
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
                {searchQuery.trim()
                  ? "No invoice found. Press Enter or scan the invoice number."
                  : awaitingCount > 0
                    ? `${awaitingCount} invoice${awaitingCount === 1 ? "" : "s"} waiting. Enter or scan a number to open one.`
                    : "No invoices waiting for separation."}
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
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-16 px-6 text-center">
                <FileStack className="w-12 h-12 text-gray-300" />
                <p className="font-medium text-gray-600">
                  Click an invoice to open separation
                </p>
                <p className="text-sm">
                  Print store copies after you open the invoice. Printing
                  marks it separated.
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
                    {/* Sales Invoice is printed at Verification Points, not here
                    <Link
                      to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                        selected.sale_code,
                      )}&doc=invoice`}
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      Sales Invoice
                    </Link>
                    */}
                    {needsCreditApproval && !isHistoryRecord ? (
                      <Link
                        to={`/app/payments/verification-points?tab=credit`}
                        className="inline-flex items-center rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 hover:bg-rose-100"
                      >
                        Open Verification Points (Credit)
                      </Link>
                    ) : null}
                    {canSeparate && packs.length > 0 ? (
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
                          : `Print all ${dispatchDocLabel}s (${productPrints.length || packs.length})`}
                      </Button>
                    ) : null}
                    {isHistoryRecord && packs.length > 0 && canReprintGoodsIssue ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={printingAll || packsLoading}
                        onClick={printAllInvoices}
                        className="flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        Reprint all {dispatchDocLabel}s (
                        {productPrints.length || packs.length})
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
                      : productPrints.length
                        ? `One ${dispatchDocLabel} per product (${productPrints.length}). Sales Invoice is printed at Verification Points. Use Print all for ${
                            isThermalDispatch
                              ? "a continuous 80mm thermal strip (cut marks between products)"
                              : String(activeBusiness?.default_receipt_type || "")
                                    .toLowerCase() === "a5"
                                ? `one A5 ${dispatchDocLabel} per product`
                                : `one A4 ${dispatchDocLabel} per product`
                          }. Printing marks it separated.`
                        : "One evidence copy is created for each product on this invoice."}
                  </p>

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
                      {productPrints.map(({ pack, line }, idx) => {
                        const fMeta = getFulfillmentStatusMeta(pack.status);
                        const printKey = line?.id || pack.id;
                        const itemLabel = line
                          ? line.item_name || line.product_id || "Item"
                          : "All items";
                        return (
                          <li
                            key={`${pack.id}-${printKey}`}
                            className="rounded-md border border-violet-100 bg-white px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="font-medium text-gray-900 text-sm">
                                  Copy {idx + 1} of {productPrints.length} ·{" "}
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

                            <table className={`w-full text-sm ${productPrints.length > 1 ? "" : "mb-3"}`}>
                              <thead>
                                <tr className="text-left text-xs text-gray-500 border-b">
                                  <th className="py-1 font-medium">Item</th>
                                  <th className="py-1 font-medium text-right">
                                    Qty
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-gray-50">
                                  <td className="py-1.5 text-gray-800">
                                    {itemLabel}
                                  </td>
                                  <td className="py-1.5 text-right text-gray-700">
                                    {line
                                      ? formatNumber1(Number(line.qty || 0))
                                      : "—"}
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {productPrints.length > 1 ? null : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                printingId === printKey ||
                                (isPackPrinted(pack) &&
                                  !canReprintGoodsIssue &&
                                  !canSeparate)
                              }
                              onClick={() => openBranchInvoice(pack, line)}
                              className="h-8"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              {printingId === printKey
                                ? "Opening…"
                                : isPackPrinted(pack)
                                  ? canReprintGoodsIssue || canSeparate
                                    ? `Print ${dispatchDocLabel}`
                                    : "Already printed"
                                  : `Print ${dispatchDocLabel}`}
                            </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {canSeparate && packs.length > 0 ? (
                  <p className="text-xs text-gray-500">
                    Printing the copies also marks this sale separated and
                    moves it to Warehouse Requests
                    {canViewHistory ? " (and History)" : ""}.
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
