import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import { FaPlus } from "react-icons/fa";
import { Input as AntInput } from "antd";
import {
  FileText,
  MoreVerticalIcon,
  Printer,
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

/**
 * Credit Notes / Vendor Credits — app-standard table list
 * (same pattern as Payees / Suppliers), with Zoho lifecycle + apply/refund.
 */
export default function CreditNote() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const facilityId = activeBusiness?.id;
  const userId = user?.id || user?.email;
  const businessName =
    activeBusiness?.business_name || activeBusiness?.name || "Business";

  const partyParam = String(searchParams.get("party") || "").toLowerCase();
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
        subtitle: "Returns, refunds, or corrections for customers",
      };

  const [view, setView] = useState("list"); // list | create
  const [statusFilter, setStatusFilter] = useState("all"); // all | open | closed
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ openCount: 0, closedCount: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [selectedNo, setSelectedNo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [applyAmounts, setApplyAmounts] = useState({});
  const [applying, setApplying] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

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

  const fetchDetail = useCallback(
    (cnNo) => {
      if (!facilityId || !cnNo) {
        setDetail(null);
      return;
    }
      setLoadingDetail(true);
      _fetchApi(
        `/api/credit-notes/${encodeURIComponent(cnNo)}?facilityId=${facilityId}`,
        (resp) => {
          setLoadingDetail(false);
          if (resp?.success) setDetail(resp.data);
          else {
            toast.error(resp?.message || "Not found");
            setDetail(null);
          }
        },
        () => {
          setLoadingDetail(false);
          toast.error("Failed to load details");
          setDetail(null);
        },
      );
    },
    [facilityId],
  );

  const openDetail = (cnNo) => {
    setSelectedNo(cnNo);
    setShowDetail(true);
    fetchDetail(cnNo);
  };

  const openApply = (fromDetail = true) => {
    const doc = fromDetail ? detail : null;
    if (!doc?.entityId) {
      toast.error(`${labels.party} not found on this document`);
      return;
    }
    setShowApply(true);
    setLoadingInvoices(true);
    setApplyAmounts({});
    _fetchApi(
      `/api/credit-notes/invoices/${encodeURIComponent(doc.entityId)}?facilityId=${facilityId}&type=${apiType}`,
      (resp) => {
        setLoadingInvoices(false);
        const list = Array.isArray(resp?.data) ? resp.data : [];
        setOpenInvoices(list);
        const seed = {};
        let left = doc.creditsRemaining || 0;
        for (const inv of list) {
          if (left <= 0) break;
          const due = parseFloat(inv.amount) || 0;
          const apply = Math.min(due, left);
          if (apply > 0) {
            seed[inv.invoiceRef || inv.invoice_ref] = String(apply);
            left -= apply;
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
        fetchDetail(detail.creditNoteNumber);
      },
      () => {
        setApplying(false);
        toast.error("Failed to apply credits");
      },
    );
  };

  const printDoc = () => window.print();

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
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedNo(item.creditNoteNumber);
                      setShowDetail(true);
                      setLoadingDetail(true);
                      _fetchApi(
                        `/api/credit-notes/${encodeURIComponent(item.creditNoteNumber)}?facilityId=${facilityId}`,
                        (resp) => {
                          setLoadingDetail(false);
                          if (resp?.success) {
                            setDetail(resp.data);
                            setShowApply(true);
                            setLoadingInvoices(true);
                            setApplyAmounts({});
                            const entityId = resp.data.entityId;
                            const left = resp.data.creditsRemaining || 0;
                            _fetchApi(
                              `/api/credit-notes/invoices/${encodeURIComponent(entityId)}?facilityId=${facilityId}&type=${apiType}`,
                              (invResp) => {
                                setLoadingInvoices(false);
                                const list = Array.isArray(invResp?.data)
                                  ? invResp.data
                                  : [];
                                setOpenInvoices(list);
                                const seed = {};
                                let rem = left;
                                for (const inv of list) {
                                  if (rem <= 0) break;
                                  const due = parseFloat(inv.amount) || 0;
                                  const applyAmt = Math.min(due, rem);
                                  if (applyAmt > 0) {
                                    seed[
                                      inv.invoiceRef || inv.invoice_ref
                                    ] = String(applyAmt);
                                    rem -= applyAmt;
                                  }
                                }
                                setApplyAmounts(seed);
                              },
                              () => {
                                setLoadingInvoices(false);
                                setOpenInvoices([]);
                              },
                            );
    } else {
                            toast.error(resp?.message || "Not found");
                          }
                        },
                        () => {
                          setLoadingDetail(false);
                          toast.error("Failed to load details");
                        },
                      );
                    }}
                  >
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
    [labels.apply, labels.party, facilityId, apiType],
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
            setSelectedNo(cnNo);
            setShowDetail(true);
            fetchList();
            if (cnNo) fetchDetail(cnNo);
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

      {/* Detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="my-6 w-full max-w-3xl rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 print:hidden">
              <div className="flex items-center gap-2">
                {detail && <StatusBadge status={detail.status} />}
                <span className="font-mono text-sm font-semibold">
                  {selectedNo}
                  </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail?.status === "open" && (
                  <Button size="sm" onClick={() => openApply(true)}>
                    {labels.apply}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={printDoc}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print / PDF
                </Button>
                  <Button
                  variant="ghost"
                    size="sm"
                    onClick={() => {
                    setShowDetail(false);
                    setSelectedNo(null);
                    setDetail(null);
                  }}
                >
                  <X className="h-4 w-4" />
                  </Button>
              </div>
                </div>

            {loadingDetail && (
              <div className="space-y-3 p-6">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {!loadingDetail && detail && (
              <article className="credit-note-sheet p-6">
                <div
                  className="mb-6 rounded-md px-5 py-4 text-white"
                    style={{
                    background:
                      "linear-gradient(135deg, #0f2744 0%, #1a3a5c 55%, #0f2744 100%)",
                    }}
                  >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300">
                        {labels.singular}
                  </div>
                      <h2 className="mt-1 text-lg font-semibold">
                        {businessName}
                      </h2>
                      </div>
                    <div className="text-right">
                      <div className="font-mono text-base font-semibold text-[var(--aa-accent,#c4a35a)]">
                        {detail.creditNoteNumber}
                          </div>
                      <div className="mt-1 text-xs text-slate-300">
                        {moment(detail.date).format("DD MMM YYYY")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                          <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {labels.party}
                          </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {detail.entityName}
                        </div>
                    {detail.entityId ? (
                      <div className="font-mono text-xs text-slate-500">
                        {detail.entityId}
                        </div>
                    ) : null}
                      </div>
                  <div className="sm:text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Reference
                  </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {detail.reference || "—"}
                </div>
              </div>
                </div>

                <p className="mb-4 text-sm text-slate-600">
                  {detail.description || detail.reason || "—"}
                </p>

                <div className="mb-6 grid grid-cols-3 gap-3 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-center">
                <div>
                    <div className="text-[10px] uppercase text-slate-500">
                      Total
                    </div>
                    <div className="font-mono text-sm font-semibold">
                      {formatNumber1(detail.totalAmount)}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] uppercase text-slate-500">
                      Applied
                </div>
                    <div className="font-mono text-sm font-semibold text-emerald-700">
                      {formatNumber1(detail.creditsApplied)}
              </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500">
                      Credits remaining
                    </div>
                    <div className="font-mono text-sm font-semibold text-slate-900">
                      {formatNumber1(detail.creditsRemaining)}
                    </div>
                  </div>
                </div>

                {detail.applications?.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Applications
                  </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500">
                          <th className="py-1.5 font-semibold">
                            {labels.invoice}
                          </th>
                          <th className="py-1.5 text-right font-semibold">
                            Amount
                          </th>
                          <th className="py-1.5 text-right font-semibold">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.applications.map((a) => (
                          <tr key={a.id} className="border-b border-slate-100">
                            <td className="py-2 font-mono text-xs">
                              {String(a.invoiceRef).toUpperCase() === "REFUND"
                                ? "Refund (cash / bank)"
                                : a.invoiceRef}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {formatNumber1(a.amount)}
                              </td>
                            <td className="py-2 text-right text-xs text-slate-500">
                              {moment(a.date).format("DD MMM YYYY")}
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {detail.entries?.length > 0 && (
                  <div>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Journal entries
                      </div>
                          <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-500">
                          <th className="py-1.5 font-semibold">Account</th>
                          <th className="py-1.5 text-right font-semibold">
                            Debit
                          </th>
                          <th className="py-1.5 text-right font-semibold">
                            Credit
                          </th>
                              </tr>
                            </thead>
                      <tbody>
                        {detail.entries.map((e, idx) => (
                          <tr
                            key={`${e.account_code}-${idx}`}
                            className="border-b border-slate-100"
                          >
                            <td className="py-2 text-xs">
                              <span className="font-mono">
                                {e.account_code}
                              </span>{" "}
                              {e.account_description}
                                  </td>
                            <td className="py-2 text-right font-mono">
                              {Number(e.dr) > 0 ? formatNumber1(e.dr) : "—"}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {Number(e.cr) > 0 ? formatNumber1(e.cr) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
              </article>
            )}
          </div>
                        </div>
                      )}

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

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .credit-note-sheet, .credit-note-sheet * { visibility: visible !important; }
          .credit-note-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
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
