import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import { FaPlus } from "react-icons/fa";
import { Input as AntInput } from "antd";
import {
  FileText,
  MoreVerticalIcon,
  RefreshCw,
  Undo2,
  Ban,
  RotateCcw,
  UserRound,
  ArrowRight,
  X,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreditNoteCreateForm from "./CreditNoteCreateForm";

function resolveCreditNoteParty(pathname, searchParams) {
  const path = String(pathname || "").toLowerCase();
  if (path.includes("/party-vendor")) return "vendor";
  if (path.includes("/party-customer")) return "customer";
  const q = String(searchParams?.get?.("party") || "").toLowerCase();
  if (q === "vendor" || q === "supplier") return "vendor";
  return "customer";
}

/** Old `/credit-note?party=` links → dedicated party routes. */
export function CreditNoteIndexRedirect() {
  const [searchParams] = useSearchParams();
  const party = String(searchParams.get("party") || "").toLowerCase();
  const to =
    party === "vendor" || party === "supplier"
      ? "/app/payments/credit-note/party-vendor"
      : "/app/payments/credit-note/party-customer";
  return <Navigate to={to} replace />;
}

/**
 * Credit Notes / Vendor Credits — app-standard table list
 * (same pattern as Payees / Suppliers), with Zoho lifecycle + apply/refund.
 */
export default function CreditNote() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const facilityId = activeBusiness?.id;
  const userId = user?.id || user?.email;

  const partyParam = resolveCreditNoteParty(location.pathname, searchParams);
  const isVendor =
    partyParam === "vendor" || partyParam === "supplier";
  const apiType = isVendor ? "supplier" : "customer";
  const labels = isVendor
    ? {
        plural: "Vendor Credits",
        singular: "Vendor Credit",
        party: "Vendor",
        apply: "Apply to Bills",
        invoice: "Bill",
        invoices: "bills",
        subtitle: "Returns, refunds, or corrections for vendors",
      }
    : {
        plural: "Credit Notes",
        singular: "Credit Note",
        party: "Customer",
        apply: "Apply to Invoices",
        invoice: "Invoice",
        invoices: "invoices",
        subtitle:
          "Returns post to customer deposit — apply on Create Invoice with Apply Deposit",
      };

  const [view, setView] = useState("list"); // list | create
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | closed
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ openCount: 0, closedCount: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [detail, setDetail] = useState(null);
  const [showApply, setShowApply] = useState(false);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [applyAmounts, setApplyAmounts] = useState({});
  const [applying, setApplying] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const previewPath = useCallback(
    (cnNo, { apply = false } = {}) => {
      const q = new URLSearchParams({
        cn: cnNo,
        party: isVendor ? "vendor" : "customer",
      });
      if (apply) q.set("apply", "1");
      return `/app/payments/credit-note/preview?${q.toString()}`;
    },
    [isVendor],
  );

  const openDetail = useCallback(
    (cnNo) => {
      if (!cnNo) return;
      navigate(previewPath(cnNo));
    },
    [navigate, previewPath],
  );

  const fetchList = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _postApi(
      "/api/credit-notes/list",
      {
        facilityId,
        type: apiType,
        status: statusFilter === "all" ? "all" : statusFilter,
        search: search.trim() || undefined,
        limit: 500,
      },
      (resp) => {
        setLoading(false);
        if (!resp?.success) {
          toast.error(resp?.message || `Failed to load ${labels.plural}`);
          setRows([]);
          return;
        }
        const list = Array.isArray(resp.data) ? resp.data : [];
        setRows(list);
        setMeta(resp.meta || { openCount: 0, closedCount: 0 });
      },
      () => {
        setLoading(false);
        toast.error(`Failed to load ${labels.plural}`);
        setRows([]);
      },
    );
  }, [facilityId, apiType, statusFilter, search, labels.plural]);

  useEffect(() => {
    if (view === "list") fetchList();
  }, [fetchList, view, isVendor]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, search, isVendor]);

  const openApplyFromList = (item) => {
    setDetail(null);
    setShowApply(true);
    setLoadingInvoices(true);
    setApplyAmounts({});
    _fetchApi(
      `/api/credit-notes/${encodeURIComponent(item.creditNoteNumber)}?facilityId=${facilityId}`,
      (resp) => {
        if (!resp?.success) {
          setLoadingInvoices(false);
          setShowApply(false);
          toast.error(resp?.message || "Not found");
          return;
        }
        const doc = resp.data;
        setDetail(doc);
        if (!doc?.entityId) {
          setLoadingInvoices(false);
          setShowApply(false);
          toast.error(`${labels.party} not found on this document`);
          return;
        }
        _fetchApi(
          `/api/credit-notes/invoices/${encodeURIComponent(doc.entityId)}?facilityId=${facilityId}&type=${apiType}`,
          (invResp) => {
            setLoadingInvoices(false);
            const list = Array.isArray(invResp?.data) ? invResp.data : [];
            setOpenInvoices(list);
            const seed = {};
            let left = doc.creditsRemaining || 0;
            for (const inv of list) {
              if (left <= 0) break;
              const due = parseFloat(inv.amount) || 0;
              const applyAmt = Math.min(due, left);
              if (applyAmt > 0) {
                seed[inv.invoiceRef || inv.invoice_ref] = String(applyAmt);
                left -= applyAmt;
              }
            }
            setApplyAmounts(seed);
          },
          () => {
            setLoadingInvoices(false);
            setOpenInvoices([]);
            toast.error(`Failed to load open ${labels.invoices}`);
          },
        );
      },
      () => {
        setLoadingInvoices(false);
        setShowApply(false);
        toast.error("Failed to load details");
      },
    );
  };

  const submitApply = () => {
    const applications = Object.entries(applyAmounts)
      .map(([invoiceRef, amount]) => ({
        invoiceRef,
        amount: parseFloat(amount) || 0,
      }))
      .filter((a) => a.amount > 0);
    if (!applications.length) {
      toast.error("Enter at least one amount to apply");
      return;
    }
    setApplying(true);
    _postApi(
      "/api/credit-notes/apply",
      {
        facilityId,
        userId,
        creditNoteNumber: detail.creditNoteNumber,
        applications,
      },
      (resp) => {
        setApplying(false);
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to apply credits");
          return;
        }
        toast.success("Credits applied");
        setShowApply(false);
        fetchList();
      },
      () => {
        setApplying(false);
        toast.error("Failed to apply credits");
      },
    );
  };

  const totalCount = meta.openCount + meta.closedCount;
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.creditNoteNumber,
        r.entityName,
        r.entityId,
        r.reference,
        r.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const fields = useMemo(
    () => [
      {
        title: "Note #",
        value: "creditNoteNumber",
        custom: true,
        component: (item) => (
          <button
            type="button"
            className="font-mono text-sm font-semibold text-[var(--aa-accent)] hover:underline"
            onClick={() => openDetail(item.creditNoteNumber)}
          >
            {item.creditNoteNumber}
          </button>
        ),
      },
      {
        title: labels.party,
        value: "entityName",
        custom: true,
        component: (item) => (
          <div>
            <div className="font-medium text-slate-900">
              {item.entityName || "—"}
            </div>
            {item.entityId ? (
              <div className="font-mono text-xs text-slate-500">
                {item.entityId}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: "Date",
        value: "date",
        custom: true,
        component: (item) => (
          <div className="text-sm text-slate-700">
            {item.date ? moment(item.date).format("DD MMM YYYY") : "—"}
          </div>
        ),
      },
      {
        title: "Status",
        value: "status",
        custom: true,
        component: (item) => <StatusBadge status={item.status} />,
      },
      {
        title: "Total",
        value: "totalAmount",
        custom: true,
        component: (item) => (
          <div className="font-mono text-sm">
            {formatNumber1(item.totalAmount)}
          </div>
        ),
      },
      {
        title: "Applied",
        value: "creditsApplied",
        custom: true,
        component: (item) => (
          <div className="font-mono text-sm text-emerald-700">
            {formatNumber1(item.creditsApplied)}
          </div>
        ),
      },
      {
        title: "Remaining",
        value: "creditsRemaining",
        custom: true,
        component: (item) => (
          <div className="font-mono text-sm font-semibold text-slate-900">
            {formatNumber1(item.creditsRemaining)}
          </div>
        ),
      },
      {
        title: "Action",
        value: "actions",
        custom: true,
        component: (item) => (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100"
                  size="icon"
                >
                  <MoreVerticalIcon />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => openDetail(item.creditNoteNumber)}
                >
                  View details
                </DropdownMenuItem>
                {item.status === "open" && (
                  <DropdownMenuItem onClick={() => openApplyFromList(item)}>
                    {labels.apply}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openDetail(item.creditNoteNumber)}
                >
                  Print / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [labels.apply, labels.party, openDetail, openApplyFromList],
  );

  if (view === "create") {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <CreditNoteCreateForm
          embedded
          forcedParty={isVendor ? "vendor" : "customer"}
          onCancel={() => setView("list")}
          onCreated={(cnNo) => {
            setView("list");
            fetchList();
            if (cnNo) openDetail(cnNo);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* Page header — same pattern as Payees / Suppliers */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <FileText className="h-6 w-6" />
                </div>
                <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {labels.plural}
            </h1>
            <p className="text-sm text-muted-foreground">
              {labels.subtitle}
              {totalCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {totalCount} total
                </span>
              )}
                  </p>
                </div>
              </div>
        <CustomButton
          color="primary"
          size="sm"
          className="!mb-0"
          onClick={() => setView("create")}
        >
          <FaPlus className="mr-1 h-4 w-4" aria-hidden />
          New {labels.singular}
        </CustomButton>
          </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-md">
              <AntInput.Search
                allowClear
                placeholder={`Search by note #, ${labels.party.toLowerCase()}, or reference`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onSearch={() => fetchList()}
                className="w-full [&_.ant-input-affix-wrapper]:!rounded-lg [&_.ant-input-search-button]:!rounded-r-lg"
              />
            </div>
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
              {[
                {
                  key: "all",
                  label: `All (${meta.openCount + meta.closedCount})`,
                },
                { key: "open", label: `Open (${meta.openCount})` },
                { key: "closed", label: `Closed (${meta.closedCount})` },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setStatusFilter(t.key)}
                  className={`rounded-md px-3 py-1.5 ${
                    statusFilter === t.key
                      ? "bg-[var(--aa-navy)] text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={fetchList}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
            </div>

        {search && (
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span>
              Showing {filteredRows.length} of {rows.length}{" "}
              {labels.plural.toLowerCase()}
            </span>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Clear search
            </button>
              </div>
            )}
      </div>

      {/* Table */}
      <div className="mt-1">
        {loading ? (
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-gray-50 p-4">
              <div className="grid grid-cols-7 gap-4">
                {[...Array(7)].map((_, i) => (
                  <Skeleton key={i} className="h-5 w-24" />
                ))}
              </div>
            </div>
            <div className="divide-y">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="p-4">
                  <div className="grid grid-cols-7 gap-4">
                    {[...Array(7)].map((__, j) => (
                      <Skeleton key={j} className="h-4 w-20" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              Handle returns and adjustments with{" "}
              {labels.plural.toLowerCase()}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              Create {labels.plural.toLowerCase()} for returns, refunds, or
              corrections — without changing the original{" "}
              {labels.invoice.toLowerCase()}.
            </p>
            <CustomButton
              color="primary"
              size="sm"
              className="!mb-0 mt-4"
              onClick={() => setView("create")}
            >
              <FaPlus className="mr-1 h-4 w-4" aria-hidden />
              Create {labels.singular}
            </CustomButton>

            <div className="mx-auto mt-8 max-w-md text-left">
              <div className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Life cycle of a {labels.singular}
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex w-[72px] flex-col gap-2">
                  <div className="flex flex-col items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-2">
                    <Undo2 className="h-4 w-4 text-slate-500" />
                    <span className="text-center text-[9px] font-medium leading-tight text-slate-600">
                      Product returned
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-2">
                    <Ban className="h-4 w-4 text-slate-500" />
                    <span className="text-center text-[9px] font-medium leading-tight text-slate-600">
                      Order cancelled
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <div className="flex w-[76px] flex-col items-center gap-1 rounded-md border-2 border-slate-800 bg-slate-900 px-1.5 py-3 text-white shadow-sm">
                  <FileText className="h-5 w-5" />
                  <span className="text-center text-[9px] font-semibold leading-tight">
                    {labels.plural}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                    <div className="flex w-[64px] flex-col items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1 py-1.5">
                      <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                      <span className="text-[9px] font-semibold text-amber-800">
                        Refund
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3 text-slate-300" />
                    <div className="flex w-[64px] flex-col items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1 py-1.5">
                      <UserRound className="h-3.5 w-3.5 text-emerald-700" />
                      <span className="text-[9px] font-semibold text-emerald-800">
                        Credits
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 self-end text-slate-300" />
                <div className="mb-0.5 flex w-[72px] flex-col items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-center text-[9px] font-medium leading-tight text-slate-600">
                    Apply to future {labels.invoices}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <CustomTable1
            fields={fields}
            data={filteredRows}
            loading={false}
            pageSize={itemsPerPage}
            initialPageIndex={Math.max(0, currentPage - 1)}
            onPageChange={(pageIndex) => setCurrentPage(pageIndex + 1)}
            onPageSizeChange={(size) => {
              setItemsPerPage(size);
              setCurrentPage(1);
            }}
            message={`No ${labels.plural.toLowerCase()} found`}
          />
        )}
      </div>

      {showApply && detail && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="my-8 w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="font-semibold text-slate-900">{labels.apply}</h3>
                <p className="text-xs text-slate-500">
                  {detail.creditNoteNumber} ·{" "}
                  {formatNumber1(detail.creditsRemaining)} available
                </p>
                              </div>
                          <Button
                variant="ghost"
                            size="sm"
                onClick={() => setShowApply(false)}
                          >
                <X className="h-4 w-4" />
                          </Button>
                        </div>
            <div className="max-h-[50vh] overflow-y-auto p-4">
              {loadingInvoices && (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                        </div>
                      )}
              {!loadingInvoices && openInvoices.length === 0 && (
                <p className="text-sm text-slate-500">
                  No open {labels.invoices} for this{" "}
                  {labels.party.toLowerCase()}.
                </p>
              )}
              {!loadingInvoices &&
                openInvoices.map((inv) => {
                  const ref = inv.invoiceRef || inv.invoice_ref;
                  return (
                    <div
                      key={ref}
                      className="mb-3 flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                      >
                        <div>
                        <div className="font-mono text-sm font-medium">
                          {ref}
                        </div>
                        <div className="text-xs text-slate-500">
                          {moment(inv.date).format("DD MMM YYYY")} · Due{" "}
                          {formatNumber1(inv.amount)}
                                      </div>
                                    </div>
                            <Input
                        className="h-8 w-28 text-right font-mono"
                        value={applyAmounts[ref] ?? ""}
                        onChange={(e) =>
                          setApplyAmounts((s) => ({
                            ...s,
                            [ref]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                            />
                          </div>
                  );
                })}
                      </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <Button variant="outline" onClick={() => setShowApply(false)}>
                    Cancel
                  </Button>
              <Button onClick={submitApply} disabled={applying}>
                {applying ? "Applying…" : "Apply credits"}
                  </Button>
                </div>
          </div>
      </div>
      )}


    </div>
  );
}

function StatusBadge({ status }) {
  const open = status === "open";
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        open
          ? "border-amber-300 bg-amber-50 text-amber-800"
          : "border-emerald-300 bg-emerald-50 text-emerald-800"
      }`}
    >
      {open ? "Open" : "Closed"}
    </span>
  );
}
