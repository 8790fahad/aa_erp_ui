import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HandCoins,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Wallet,
  Search,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import CreateImprestDrawer from "@/components/common/CreateImprestDrawer";
import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const STATUS_ALL = "all";
const STATUS_PAID = "paid";
const STATUS_UNPAID = "unpaid";
const STATUS_PARTIALLY_PAID = "partially_paid";

const primaryBtn =
  "border-0 bg-[#4267B2] text-white hover:bg-[#4267B2]/90 shadow-none";
const searchClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20";
const tableHeadClass =
  "border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500";
const selectTriggerClass =
  "h-9 w-full min-w-[11rem] border-slate-200 bg-white text-sm focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20";

export default function BillSources() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imprestOpen, setImprestOpen] = useState(false);
  const [createBillOpen, setCreateBillOpen] = useState(false);
  const [expenseList, setExpenseList] = useState([]);
  const searchFromUrl = searchParams.get("search") || "";
  const pageFromUrl = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSizeFromUrl = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10)));
  const statusFromUrl = searchParams.get("status") || STATUS_ALL;
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const searchDebounceRef = useRef(null);

  const searchText = searchFromUrl;
  const pageIndex = pageFromUrl - 1;
  const pageSize = pageSizeFromUrl;
  const statusFilter =
    statusFromUrl === STATUS_ALL
      ? null
      : statusFromUrl === STATUS_PAID
        ? "paid"
        : statusFromUrl === STATUS_PARTIALLY_PAID
          ? "partially_paid"
          : statusFromUrl === STATUS_UNPAID
            ? "unpaid"
            : null;

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  const getSupplierBills = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    // Request a large page so the register is not silently capped at API default (10)
    const params = new URLSearchParams({
      facilityId: String(activeBusiness.id),
      page: "1",
      limit: "1000",
    });
    _fetchApi(
      `/api/supplier/bills?${params.toString()}`,
      (resp) => {
        if (resp.success) {
          setBills(resp.data || []);
        } else {
          console.error("Failed to load supplier bills");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching supplier bills:", err);
        setLoading(false);
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    getSupplierBills();
  }, [getSupplierBills]);

  const loadExpenseListForImprest = useCallback(() => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setExpenseList(
            (resp.results || []).map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
              account_type: item.account_type || "",
            }))
          );
        }
      },
      () => {}
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    loadExpenseListForImprest();
  }, [loadExpenseListForImprest]);

  const filteredData = useMemo(() => {
    const q = String(searchText || "").trim().toLowerCase();
    const hay = (v) =>
      v != null && String(v).toLowerCase().includes(q);
    return bills.filter((item) => {
      // Search filter (safe when supplier_name / description are undefined)
      const matchesSearch =
        !q ||
        hay(item.supplier_name) ||
        hay(item.invoice_ref) ||
        hay(item.description);

      // Status filter - normalize both item status and filter to compare
      if (statusFilter === null) {
        return matchesSearch;
      }

      const itemStatusNormalized = (item.status || "")
        .toLowerCase()
        .replace(/\s+/g, "_");
      const filterNormalized = statusFilter.toLowerCase().replace(/\s+/g, "_");
      const matchesStatus = itemStatusNormalized === filterNormalized;

      return matchesSearch && matchesStatus;
    });
  }, [bills, searchText, statusFilter]);

  // Pagination calculations (clamp page to valid range)
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePageIndex = Math.min(Math.max(0, pageIndex), totalPages - 1);
  const startIndex = safePageIndex * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const updateUrl = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams);
      if (updates.search !== undefined) {
        if (updates.search) next.set("search", updates.search);
        else next.delete("search");
      }
      if (updates.page !== undefined) next.set("page", String(updates.page));
      if (updates.pageSize !== undefined) next.set("pageSize", String(updates.pageSize));
      if (updates.status !== undefined) {
        if (updates.status && updates.status !== STATUS_ALL) next.set("status", updates.status);
        else next.delete("status");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateUrl({ search: value.trim(), page: 1 });
      searchDebounceRef.current = null;
    }, 400);
  };

  const handleStatusFilter = (status) => {
    const param = status === null ? STATUS_ALL : status;
    updateUrl({ status: param, page: 1 });
  };

  const handlePageChange = (newPageIndex) => {
    updateUrl({ page: newPageIndex + 1 });
  };

  const handlePageSizeChange = (size) => {
    updateUrl({ pageSize: size, page: 1 });
  };

  const fields = [
    {
      title: "Invoice Ref.",
      custom: true,
      className: "text-center",
      component: (item) => (
        <button
          type="button"
          onClick={() => {
            const ref = String(item.invoice_ref || "");
            const isOperating =
              ref.startsWith("EP-") ||
              ref.startsWith("DE/") ||
              (item.bill_type || "").toLowerCase().includes("expense") ||
              (item.description || "").toLowerCase().includes("operating");
            navigate(
              isOperating
                ? `/app/expenses/billing/operating-expense-bill-pdf?invoice_ref=${item.invoice_ref}`
                : `/app/expenses/billing/product-supplier-bill-pdf?invoice_ref=${item.invoice_ref}`,
            );
          }}
          className="font-medium text-[#4267B2] hover:underline"
        >
          {item.invoice_ref || "N/A"}
        </button>
      ),
    },
    {
      title: "Supplier",
      custom: true,
      component: (item) => (
        <span className="font-medium text-slate-800">
          {item.supplier_name || "N/A"}
        </span>
      ),
    },
    {
      title: "Supplier ID",
      custom: true,
      component: (item) => (
        <span className="font-mono text-sm text-slate-600">
          {item.ref_number || "—"}
        </span>
      ),
    },
    {
      title: "Bill date",
      custom: true,
      component: (item) => (
        <span className="text-slate-700">
          {item.transaction_date
            ? moment(item.transaction_date).format("DD MMM YYYY")
            : "N/A"}
        </span>
      ),
    },
    {
      title: "Due date",
      custom: true,
      component: (item) => (
        <span className="text-slate-700">
          {item.due_date ? moment(item.due_date).format("DD MMM YYYY") : "N/A"}
        </span>
      ),
    },
    {
      title: "Bill amount (₦)",
      custom: true,
      component: (item) => (
        <span className="font-semibold tabular-nums text-slate-900">
          {formatNumber1(item.amount || 0)}
        </span>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => {
        const statusRaw = item.status || "";
        const statusNormalized = statusRaw.toLowerCase().replace(/\s+/g, "_");

        const statusConfig = {
          paid: {
            label: "Paid",
            className:
              "border-emerald-200 bg-emerald-50 text-emerald-800",
          },
          unpaid: {
            label: "Unpaid",
            className: "border-rose-200 bg-rose-50 text-rose-800",
          },
          partially_paid: {
            label: "Partially Paid",
            className: "border-amber-200 bg-amber-50 text-amber-800",
          },
        };

        const config = statusConfig[statusNormalized] || statusConfig.unpaid;

        return (
          <Badge
            variant="outline"
            className={`${config.className} font-medium`}
          >
            {config.label}
          </Badge>
        );
      },
    },
  ];

  const openBillType = (path) => {
    setCreateBillOpen(false);
    navigate(path);
  };

  const createBillButton = (
    <Button
      type="button"
      variant="default"
      size="sm"
      className={`flex h-9 items-center gap-2 ${primaryBtn}`}
      onClick={() => setCreateBillOpen(true)}
    >
      <HandCoins className="h-4 w-4" />
      Create Bill
    </Button>
  );

  return (
    <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <Receipt className="h-5 w-5 text-[#4267B2]" />
            Bill
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage your billing expense
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by supplier name, invoice ref, or description"
            value={searchInput}
            onChange={handleSearchChange}
            className={searchClass}
          />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <div className="w-full sm:w-[12rem] lg:w-[11rem]">
            <Select
              value={statusFromUrl || STATUS_ALL}
              onValueChange={(value) =>
                handleStatusFilter(value === STATUS_ALL ? null : value)
              }
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STATUS_ALL}>All</SelectItem>
                <SelectItem value={STATUS_PAID}>Paid</SelectItem>
                <SelectItem value={STATUS_PARTIALLY_PAID}>
                  Partially Paid
                </SelectItem>
                <SelectItem value={STATUS_UNPAID}>Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-slate-200 text-[#4267B2] hover:bg-[var(--aa-sidebar-active)]"
            onClick={() => setImprestOpen(true)}
          >
            <Wallet className="h-4 w-4 shrink-0" />
            Create Imprest
          </Button>
          {createBillButton}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {fields.map((field, idx) => (
                  <th key={idx} className={tableHeadClass}>
                    {field.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    {fields.map((_, fieldIdx) => (
                      <td key={fieldIdx} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={fields.length} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--aa-sidebar-active)] text-[#4267B2]">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        No bills found
                      </p>
                      <p className="text-xs text-slate-500">
                        Create a bill to get started
                      </p>
                      {createBillButton}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={item.invoice_id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    {fields.map((field, idx) => (
                      <td
                        key={idx}
                        className="px-4 py-3 text-sm text-slate-800"
                      >
                        {field.component
                          ? field.component(item)
                          : item[field.value]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredData.length > 0 && (
          <div className="flex items-center justify-end border-t border-slate-100 px-4 py-3">
            <div className="flex w-full items-center gap-8 lg:w-fit">
              <div className="hidden items-center gap-2 lg:flex">
                <Label
                  htmlFor="rows-per-page"
                  className="text-sm font-medium text-slate-600"
                >
                  Rows per page
                </Label>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(value) =>
                    handlePageSizeChange(Number(value))
                  }
                >
                  <SelectTrigger
                    className="h-8 w-20 border-slate-200"
                    id="rows-per-page"
                  >
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 30, 40, 50, 100].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-sm font-medium text-slate-600">
                Page {safePageIndex + 1} of {totalPages}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 border-slate-200 p-0 lg:flex"
                  onClick={() => handlePageChange(0)}
                  disabled={safePageIndex === 0}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 border-slate-200 p-0"
                  onClick={() =>
                    handlePageChange(Math.max(0, safePageIndex - 1))
                  }
                  disabled={safePageIndex === 0}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 border-slate-200 p-0"
                  onClick={() =>
                    handlePageChange(
                      Math.min(totalPages - 1, safePageIndex + 1),
                    )
                  }
                  disabled={safePageIndex >= totalPages - 1}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 border-slate-200 p-0 lg:flex"
                  onClick={() => handlePageChange(totalPages - 1)}
                  disabled={safePageIndex >= totalPages - 1}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={createBillOpen} onOpenChange={setCreateBillOpen}>
        <DialogContent className="max-w-md gap-0 border-slate-200 p-0 sm:rounded-lg">
          <DialogHeader className="space-y-1 px-5 pb-0 pt-5 pr-12 text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">
              Which bill are you creating?
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Select the bill type to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 px-5 py-4">
            <button
              type="button"
              onClick={() =>
                openBillType("/app/expenses/billing/product-supplier-bill")
              }
              className="w-full rounded-md border-0 bg-[#4267B2] px-4 py-3 text-left text-white transition-colors hover:bg-[#4267B2]/90"
            >
              <span className="block text-sm font-semibold">
                Inventory Bill
              </span>
              <span className="mt-0.5 block text-xs font-normal text-white/75">
                Product / supplier stock purchase bill
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                openBillType("/app/expenses/billing/operating-expense-bill")
              }
              className="w-full rounded-md border-0 bg-emerald-600 px-4 py-3 text-left text-white transition-colors hover:bg-emerald-700"
            >
              <span className="block text-sm font-semibold">Expense Bill</span>
              <span className="mt-0.5 block text-xs font-normal text-white/75">
                Operating expense bill
              </span>
            </button>
          </div>
          <div className="flex justify-end border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={() => setCreateBillOpen(false)}
              className="text-sm font-medium text-[#4267B2] hover:underline"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateImprestDrawer
        open={imprestOpen}
        onOpenChange={setImprestOpen}
        expenseList={expenseList}
        facilityId={activeBusiness?.id}
        user={user}
      />
    </div>
  );
}
