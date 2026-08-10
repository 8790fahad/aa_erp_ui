import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  Plus,
  Eye,
  Search,
  FileText,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
import { Skeleton } from "@/components/ui/skeleton";
import MultipleSelector from "@/components/ui/multiselect";
import {
  PROCESS_STAGES,
  CREDIT_PROCESS_STAGE,
  WorkflowStatusBadge,
  getWorkflowStatusMeta,
  statusMatchesProcessStage,
} from "@/lib/saleWorkflowStatus.js";

const STAGE_LEGEND = [...PROCESS_STAGES, CREDIT_PROCESS_STAGE];

const todayDate = () => moment().format("YYYY-MM-DD");

export default function InvoiceList() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchFromUrl = searchParams.get("search") || "";
  const branchFromUrl = searchParams.get("branchId") || "";
  const statusFromUrl = searchParams.get("status") || "";
  // Default to today's date when URL has no date params.
  const fromDateFromUrl = searchParams.get("fromDate") || todayDate();
  const toDateFromUrl = searchParams.get("toDate") || todayDate();
  const pageFromUrl = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSizeFromUrl = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10)),
  );
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const searchDebounceRef = useRef(null);
  const didInitDatesRef = useRef(false);

  // Seed URL with today's date once so filters and fetch stay in sync.
  useEffect(() => {
    if (didInitDatesRef.current) return;
    didInitDatesRef.current = true;
    const today = todayDate();
    const next = new URLSearchParams(searchParams);
    let changed = false;
    // Drop legacy "all dates" mode — always use a date range.
    if (next.get("allDates")) {
      next.delete("allDates");
      changed = true;
    }
    if (!next.get("fromDate")) {
      next.set("fromDate", today);
      changed = true;
    }
    if (!next.get("toDate")) {
      next.set("toDate", today);
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  const fetchInvoices = useCallback(() => {
    if (!activeBusiness?.id) return;

    const fromDate = fromDateFromUrl || todayDate();
    const toDate = toDateFromUrl || todayDate();

    setLoading(true);
    const params = new URLSearchParams({
      facilityId: activeBusiness.id,
      type: "sales",
      page: String(pageFromUrl),
      pageSize: String(pageSizeFromUrl),
      fromDate,
      toDate,
    });
    if (searchFromUrl.trim()) params.set("search", searchFromUrl.trim());
    if (branchFromUrl) params.set("branchId", branchFromUrl);

    _fetchApi(
      `/api/v1/transactions/get-all-transactions-data?${params.toString()}`,
      (response) => {
        setLoading(false);
        if (response.success) {
          setInvoices(response.results || response.data || []);
        } else {
          toast.error(response.message || "Failed to fetch invoices");
          setInvoices([]);
        }
      },
      (error) => {
        setLoading(false);
        console.error("Error fetching invoices:", error);
        toast.error("Error fetching invoices");
        setInvoices([]);
      },
    );
  }, [
    activeBusiness?.id,
    searchFromUrl,
    branchFromUrl,
    fromDateFromUrl,
    toDateFromUrl,
    pageFromUrl,
    pageSizeFromUrl,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      () => {},
    );
  }, [activeBusiness?.id]);

  const displayInvoices = useMemo(() => {
    // Keep only real sale invoices (INV-123). Hide CN-*, OP-*, INV-OB-*, etc.
    const salesOnly = invoices.filter((inv) =>
      /^INV-\d+$/i.test(String(inv.invoice_ref || "").trim()),
    );
    if (!statusFromUrl) return salesOnly;
    return salesOnly.filter((inv) =>
      statusMatchesProcessStage(
        inv.workflow_status,
        statusFromUrl,
        inv.workflow_payment_type,
      ),
    );
  }, [invoices, statusFromUrl]);

  const pageCount = Math.max(
    1,
    Math.ceil(displayInvoices.length / pageSizeFromUrl) || 1,
  );
  const pageRows = useMemo(() => {
    if (!statusFromUrl) return displayInvoices;
    const start = (pageFromUrl - 1) * pageSizeFromUrl;
    return displayInvoices.slice(start, start + pageSizeFromUrl);
  }, [displayInvoices, pageFromUrl, pageSizeFromUrl, statusFromUrl]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value.trim()) {
        next.set("search", value.trim());
        next.set("page", "1");
      } else {
        next.delete("search");
        next.set("page", "1");
      }
      setSearchParams(next, { replace: true });
      searchDebounceRef.current = null;
    }, 400);
  };

  const handlePageChange = (page) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next, { replace: true });
  };

  const handlePageSizeChange = (size) => {
    const next = new URLSearchParams(searchParams);
    next.set("pageSize", String(size));
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const branchOptions = branches.map((b) => ({
    value: String(b.id),
    label: b.branch_name,
  }));
  const selectedBranchIds = branchFromUrl
    ? branchFromUrl.split(",").filter(Boolean)
    : [];
  const selectedBranchOptions = branchOptions.filter((o) =>
    selectedBranchIds.includes(o.value),
  );

  const handleBranchChange = (opts) => {
    const next = new URLSearchParams(searchParams);
    const ids = (opts || []).map((o) => o.value).join(",");
    if (ids) {
      next.set("branchId", ids);
    } else {
      next.delete("branchId");
    }
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const handleDateFilterChange = (key, value) => {
    const next = new URLSearchParams(searchParams);
    const today = todayDate();
    const nextFrom =
      key === "fromDate" ? value || today : searchParams.get("fromDate") || today;
    const nextTo =
      key === "toDate" ? value || today : searchParams.get("toDate") || today;
    next.set("fromDate", nextFrom);
    next.set("toDate", nextTo);
    next.delete("allDates");
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const resetToToday = () => {
    const next = new URLSearchParams(searchParams);
    const today = todayDate();
    next.set("fromDate", today);
    next.set("toDate", today);
    next.delete("allDates");
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const handleStatusFilter = (statusId) => {
    const next = new URLSearchParams(searchParams);
    if (statusId && statusId === statusFromUrl) {
      next.delete("status");
    } else if (statusId) {
      next.set("status", statusId);
    } else {
      next.delete("status");
    }
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="h-fit w-full">
      <div className="mx-auto h-fit max-w-7xl">
        <div className="h-fit overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
                <FileText className="h-5 w-5 text-[#4267B2]" />
                Sales Invoices
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Pay → separation → warehouse collect
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => navigate("/app/sales/sale?view=lines")}
                className="flex h-8 items-center gap-1.5 border-0 bg-[var(--aa-accent)] text-sm text-white hover:bg-[var(--aa-accent)]/90"
              >
                <Plus className="h-4 w-4" />
                Create Invoice
              </Button>
            </div>
          </div>

          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Stage
              </span>
              {STAGE_LEGEND.map((stage) => {
                const active = statusFromUrl === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => handleStatusFilter(stage.id)}
                    title={stage.label}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
                      stage.badge
                    } ${
                      active
                        ? "ring-2 ring-offset-1 ring-slate-400"
                        : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                    {stage.short}
                  </button>
                );
              })}
              {statusFromUrl ? (
                <button
                  type="button"
                  onClick={() => handleStatusFilter("")}
                  className="ml-1 text-[11px] text-[#4267B2] hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice, customer…"
                value={searchInput}
                onChange={handleSearchChange}
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20"
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={fromDateFromUrl}
                onChange={(e) =>
                  handleDateFilterChange("fromDate", e.target.value)
                }
                title="From date"
                aria-label="From date"
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20"
                disabled={loading}
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={toDateFromUrl}
                min={fromDateFromUrl || undefined}
                onChange={(e) =>
                  handleDateFilterChange("toDate", e.target.value)
                }
                title="To date"
                aria-label="To date"
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20"
                disabled={loading}
              />
              {(fromDateFromUrl !== todayDate() ||
                toDateFromUrl !== todayDate()) && (
                <button
                  type="button"
                  onClick={resetToToday}
                  className="text-[11px] text-[#4267B2] hover:underline"
                >
                  Today
                </button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={fetchInvoices}
                disabled={loading}
                title="Refresh invoices"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
            {branches.length > 0 && (
              <div className="sm:w-56">
                <MultipleSelector
                  value={selectedBranchOptions}
                  onChange={handleBranchChange}
                  options={branchOptions}
                  placeholder="All Warehouses"
                  hidePlaceholderWhenSelected
                  disabled={loading}
                  className="bg-white"
                  emptyIndicator={
                    <p className="text-center text-sm text-gray-500">
                      No warehouses found
                    </p>
                  }
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="grid grid-cols-6 gap-3 px-4 py-2.5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-4 w-full max-w-[120px]" />
                  ))}
                </div>
              ))}
            </div>
          ) : pageRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <FileText className="mx-auto mb-2 h-10 w-10 text-slate-200" />
              <h3 className="mb-1 text-sm font-semibold text-slate-700">
                No invoices found
              </h3>
              <p className="mb-3 text-sm text-slate-500">
                {searchFromUrl || statusFromUrl || fromDateFromUrl || toDateFromUrl
                  ? "Try adjusting your search, dates, or status filter"
                  : "Create your first invoice to get started"}
              </p>
              {!searchFromUrl && !statusFromUrl && !fromDateFromUrl && !toDateFromUrl && (
                <Button
                  onClick={() => navigate("/app/sales/sale?view=lines")}
                  className="mx-auto flex items-center gap-2 border-0 bg-[var(--aa-accent)] text-white hover:bg-[var(--aa-accent)]/90"
                >
                  <Plus className="h-4 w-4" />
                  Create Invoice
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[7.25rem]" />
                    <col className="w-[6.75rem]" />
                    <col className="w-[15rem]" />
                    <col className="w-[7.5rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[5rem]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 font-semibold">Invoice</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Customer</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Actions
                      </th>
                      <th className="p-0" aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((item) => {
                      const meta = getWorkflowStatusMeta(
                        item.workflow_status,
                        item.workflow_payment_type,
                      );
                      const bg = meta.row || "bg-white";
                      return (
                        <tr
                          key={item.invoice_id || item.invoice_ref}
                          className="border-b border-slate-100/80"
                        >
                          <td className={`px-3 py-2 align-middle ${bg}`}>
                            <Link
                              to={`/app/sales/invoice-preview?sale_code=${item.invoice_ref || ""}`}
                              className="whitespace-nowrap font-mono text-[13px] font-semibold text-[#4267B2] hover:underline"
                            >
                              {item.invoice_ref || "—"}
                            </Link>
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2 align-middle tabular-nums text-[13px] text-slate-600 ${bg}`}
                          >
                            {item.transaction_date
                              ? moment(item.transaction_date).format(
                                  "DD MMM YYYY",
                                )
                              : "—"}
                          </td>
                          <td className={`px-3 py-2 align-middle ${bg}`}>
                            <div className="min-w-0">
                              <div
                                className="truncate text-[13px] font-medium leading-tight text-slate-800"
                                title={item.customerName || ""}
                              >
                                {item.customerName || "—"}
                              </div>
                              {item.ref_number ? (
                                <div className="mt-0.5 truncate font-mono text-[11px] leading-tight text-slate-400">
                                  {item.ref_number}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className={`px-3 py-2 align-middle ${bg}`}>
                            {item.workflow_status ? (
                              <div className="flex flex-col items-start gap-0.5">
                                <WorkflowStatusBadge
                                  status={item.workflow_status}
                                  paymentType={item.workflow_payment_type}
                                  compact
                                />
                                {statusMatchesProcessStage(
                                  item.workflow_status,
                                  "warehouse",
                                  item.workflow_payment_type,
                                ) &&
                                (item.warehouse_name ||
                                  item.warehouse_names?.length ||
                                  item.branch_name) ? (
                                  <span
                                    className="max-w-[10rem] truncate text-[10px] font-medium text-orange-800"
                                    title={
                                      item.warehouse_name ||
                                      (Array.isArray(item.warehouse_names)
                                        ? item.warehouse_names.join(", ")
                                        : "") ||
                                      item.branch_name
                                    }
                                  >
                                    {item.warehouse_name ||
                                      (Array.isArray(item.warehouse_names)
                                        ? item.warehouse_names.join(", ")
                                        : "") ||
                                      item.branch_name}
                                  </span>
                                ) : null}
                                {item.hold_overnight ? (
                                  <span className="text-[10px] font-medium text-red-600">
                                    Held
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2 align-middle text-right text-[13px] font-semibold tabular-nums text-slate-900 ${bg}`}
                          >
                            ₦{formatNumber1(item.amount || 0)}
                          </td>
                          <td className={`px-3 py-2 align-middle text-right ${bg}`}>
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `/app/sales/invoice-preview?sale_code=${item.invoice_ref || ""}`,
                                  )
                                }
                                className="h-7 w-7 p-0 text-slate-500 hover:bg-white/70 hover:text-[#4267B2]"
                                title="View invoice"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {item.workflow_status ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    navigate(
                                      `/app/sales/process?sale_code=${encodeURIComponent(
                                        item.invoice_ref || "",
                                      )}`,
                                    )
                                  }
                                  className="h-7 w-7 p-0 text-slate-500 hover:bg-white/70 hover:text-[#4267B2]"
                                  title="Open sales process"
                                >
                                  <GitBranch className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </td>
                          <td className={`p-0 ${bg}`} aria-hidden="true" />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>Rows</span>
                  <select
                    value={pageSizeFromUrl}
                    onChange={(e) =>
                      handlePageSizeChange(Number(e.target.value))
                    }
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                  >
                    {[10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-slate-600">
                  Page {pageFromUrl}
                  {statusFromUrl ? ` of ${pageCount}` : ""}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={pageFromUrl <= 1}
                    onClick={() => handlePageChange(pageFromUrl - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={
                      statusFromUrl
                        ? pageFromUrl >= pageCount
                        : pageRows.length < pageSizeFromUrl
                    }
                    onClick={() => handlePageChange(pageFromUrl + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
