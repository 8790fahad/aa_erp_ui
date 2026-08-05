import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { Col, Row } from "reactstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "antd";
import {
  HandCoins,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Wallet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function BillSources() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imprestOpen, setImprestOpen] = useState(false);
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
    _fetchApi(
      `/api/supplier/bills?facilityId=${activeBusiness.id}`,
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
        <div
          style={{ cursor: "pointer" }}
          onClick={() =>
            navigate(
              `/app/expenses/billing/product-supplier-bill-pdf?invoice_ref=${item.invoice_ref}`
            )
          }
          className="text-blue-600 font-medium text-center"
        >
          {/* {JSON.stringify(item)} */}
          {item.invoice_ref || "N/A"}
        </div>
      ),
    },
    {
      title: "SUPPLIER",
      custom: true,
      component: (item) => (
        <span className="text-blue-600 font-medium">
          {item.supplier_name || "N/A"}
        </span>
      ),
    },
    {
      title: "SUPPLIER ID",
      custom: true,
      component: (item) => (
        <span className="text-sm text-gray-600 font-mono">
          {item.ref_number || "—"}
        </span>
      ),
    },
    {
      title: "BILL DATE",
      custom: true,
      component: (item) => (
        <span>
          {item.transaction_date
            ? moment(item.transaction_date).format("MM/DD/YYYY")
            : "N/A"}
        </span>
      ),
    },
    {
      title: "DUE DATE",
      custom: true,
      component: (item) => (
        <span>
          {item.due_date ? moment(item.due_date).format("MM/DD/YYYY") : "N/A"}
        </span>
      ),
    },
    {
      title: "BILL AMOUNT(₦)",
      custom: true,
      component: (item) => (
        <span className="font-semibold">{formatNumber1(item.amount || 0)}</span>
      ),
    },
    {
      title: "STATUS",
      custom: true,
      component: (item) => {
        // Normalize status: handle both "Partially Paid" and "partially_paid" formats
        const statusRaw = item.status || "";
        const statusNormalized = statusRaw.toLowerCase().replace(/\s+/g, "_");

        const statusConfig = {
          paid: {
            label: "Paid",
            className: "bg-green-100 text-green-800 border-green-200",
          },
          unpaid: {
            label: "Unpaid",
            className: "bg-red-100 text-red-800 border-red-200",
          },
          partially_paid: {
            label: "Partially Paid",
            className: "bg-yellow-100 text-yellow-800 border-yellow-200",
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
    // {
    //   title: "ACTION",
    //   custom: true,
    //   component: (item) => {
    //     const status = item.status || "unpaid";

    //     if (status === "paid") {
    //       return (
    //         <div className="flex items-center gap-2">
    //           <button
    //             onClick={() => {
    //               // You can add expand/collapse logic here if needed
    //               console.log("Show payments for", item.invoice_id);
    //             }}
    //             className="text-green-600 hover:text-green-800 font-medium cursor-pointer"
    //           >
    //             Show payments
    //           </button>
    //         </div>
    //       );
    //     }

    //     return (
    //       <div className="flex items-center gap-2">
    //         <button
    //           onClick={() => {
    //             // Navigate to make payment page or open payment modal
    //             console.log("Make payment for", item.invoice_id);
    //           }}
    //           className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
    //         >
    //           Process Payment
    //         </button>
    //       </div>
    //     );
    //   },
    // },
  ];

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Bill</h1>
          <p className="text-muted-foreground">Manage your billing expense</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium"
            onClick={() => setImprestOpen(true)}
          >
            <Wallet className="w-4 h-4 shrink-0" />
            Create Imprest 
          </Button>
        </div>
      </div>

      <Row className="mb-3">
        <Col md="6">
          <Input.Search
            placeholder="Search by supplier name, invoice ref, or description"
            value={searchInput}
            onChange={(e) => handleSearchChange(e)}
          />
        </Col>
        <Col md="6">
          <div className="flex justify-end gap-2 items-center">
            <div className="flex gap-2">
              <Button
                variant={statusFilter === null ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusFilter(null)}
                className={
                  statusFilter === null
                    ? "bg-[#4267B2] hover:bg-[#5A7EC1] text-white"
                    : ""
                }
              >
                All
              </Button>
              <Button
                variant={statusFilter === "paid" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusFilter("paid")}
                className={
                  statusFilter === "paid"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "border-green-200 text-green-700 hover:bg-green-50"
                }
              >
                Paid
              </Button>
              <Button
                variant={
                  statusFilter === "partially_paid" ? "default" : "outline"
                }
                size="sm"
                onClick={() => handleStatusFilter("partially_paid")}
                className={
                  statusFilter === "partially_paid"
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                }
              >
                Partially Paid
              </Button>
              <Button
                variant={statusFilter === "unpaid" ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusFilter("unpaid")}
                className={
                  statusFilter === "unpaid"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "border-red-200 text-red-700 hover:bg-red-50"
                }
              >
                Unpaid
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#5A7EC1] dark:bg-slate-800 dark:hover:bg-slate-700 shadow-none"
                >
                  <HandCoins className="w-4 h-4" />
                  Create Bill
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() =>
                    navigate("/app/expenses/billing/product-supplier-bill")
                  }
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <HandCoins className="w-4 h-4" />
                Inventory Bill
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate("/app/expenses/billing/operating-expense-bill")
                  }
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <HandCoins className="w-4 h-4" />
                  Expense Bill
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Col>
      </Row>

      <div className="mt-3">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {fields.map((field, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider"
                  >
                    {field.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                // Skeleton loading rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {fields.map((_, fieldIdx) => (
                      <td key={fieldIdx} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={fields.length} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <p className="text-gray-500 text-lg">No bills found</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            className="flex items-center gap-2 bg-[#4267B2] hover:bg-[#5A7EC1] dark:bg-slate-800 dark:hover:bg-slate-700 shadow-none"
                          >
                            <HandCoins className="w-4 h-4" />
                            Create Bill
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="w-48">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(
                                "/app/expenses/billing/product-supplier-bill"
                              )
                            }
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <HandCoins className="w-4 h-4" />
                            Product Bill
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(
                                "/app/expenses/billing/operating-expense-bill"
                              )
                            }
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <HandCoins className="w-4 h-4" />
                            Expense Bill
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.invoice_id} className="hover:bg-gray-50">
                    {fields.map((field, idx) => (
                      <td key={idx} className="px-4 py-3 text-sm text-gray-900">
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

          {/* Pagination */}
          {!loading && filteredData.length > 0 && (
            <div className="mt-3 flex items-center justify-end px-4 pb-4">
              <div className="flex w-full items-center gap-8 lg:w-fit">
                <div className="hidden items-center gap-2 lg:flex">
                  <Label
                    htmlFor="rows-per-page"
                    className="text-sm font-medium"
                  >
                    Rows per page
                  </Label>
                  <Select
                    value={`${pageSize}`}
                    onValueChange={(value) => handlePageSizeChange(Number(value))}
                  >
                    <SelectTrigger className="w-20" id="rows-per-page">
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
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                  Page {safePageIndex + 1} of {totalPages}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
                    onClick={() => handlePageChange(0)}
                    disabled={safePageIndex === 0}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => handlePageChange(Math.max(0, safePageIndex - 1))}
                    disabled={safePageIndex === 0}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      handlePageChange(Math.min(totalPages - 1, safePageIndex + 1))
                    }
                    disabled={safePageIndex >= totalPages - 1}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex"
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
      </div>

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
