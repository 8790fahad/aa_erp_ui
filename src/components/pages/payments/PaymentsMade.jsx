import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { Input } from "antd";
import {
  CreditCard,
  HandCoins,
  MoreVerticalIcon,
  Printer,
} from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { formatExpensePaymentMode } from "@/utils/expensePaymentMode";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ApplySupplierDeposit from "@/components/pages/payments/ApplySupplierDeposit";
import SupplierAdvancePaymentModal from "@/components/common/SupplierAdvancePaymentModal";
import { canSeeAllPayBills } from "@/lib/access";

/**
 * Pay Bills — payment history list, matching Bill / app list layout.
 *
 * Actions (all supplier payment flows live here):
 * - New Payment → pay unpaid vendor bills
 * - Make Deposit → record a supplier prepaid deposit
 * - Apply Deposit → apply existing supplier deposit to bills
 */
export default function PaymentsMade() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const canSeeAll = canSeeAllPayBills(user, activeBusiness);

  const [searchInput, setSearchInput] = useState("");
  const [modeFilter, setModeFilter] = useState(null);
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [payers, setPayers] = useState([]);
  const [page, setPage] = useState(1);
  const [applyDepositOpen, setApplyDepositOpen] = useState(false);
  const [makeDepositOpen, setMakeDepositOpen] = useState(false);
  const [depositSupplier, setDepositSupplier] = useState(null);
  const pageSize = 20;

  const fetchList = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId,
      limit: "500",
    });
    const userId = user?.id || user?.user_id;
    if (userId) params.set("userId", String(userId));
    if (canSeeAll) params.set("viewAll", "1");
    if (canSeeAll && paidByFilter && paidByFilter !== "all") {
      params.set("createdBy", String(paidByFilter));
    }

    _fetchApi(
      `/api/v1/get-supplier-advance-history?${params.toString()}`,
      (resp) => {
        setLoading(false);
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to load payments");
          setRows([]);
          return;
        }
        setRows(Array.isArray(resp.results) ? resp.results : []);
        if (Array.isArray(resp.payers)) {
          setPayers(resp.payers);
        }
      },
      () => {
        setLoading(false);
        toast.error("Failed to load payments");
        setRows([]);
      },
    );
  }, [facilityId, user?.id, user?.user_id, canSeeAll, paidByFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Deep-link: /pay-bills?action=deposit&supplierNo=…
  useEffect(() => {
    const action = String(searchParams.get("action") || "").toLowerCase();
    if (action === "deposit" || action === "make-deposit") {
      const supplierNo = searchParams.get("supplierNo") || "";
      const supplierName = searchParams.get("supplierName") || "";
      setDepositSupplier(
        supplierNo
          ? {
              supplier_number: supplierNo,
              supplierNo,
              supplier_name: supplierName || supplierNo,
            }
          : null,
      );
      setMakeDepositOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      next.delete("supplierNo");
      next.delete("supplierName");
      setSearchParams(next, { replace: true });
      return;
    }
    if (action === "apply-deposit" || action === "apply") {
      setApplyDepositOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const handleModeFilter = (e) => {
    const value = e.target.value;
    setModeFilter(value === "all" ? null : value);
    setPage(1);
  };

  const handlePaidByFilter = (e) => {
    setPaidByFilter(e.target.value || "all");
    setPage(1);
  };

  const payerOptions = useMemo(() => {
    if (payers.length) return payers;
    const seen = new Map();
    rows.forEach((r) => {
      const id = String(r.created_by || "").trim();
      if (!id || seen.has(id)) return;
      seen.set(id, {
        id,
        name: String(r.created_by_name || "").trim() || id,
      });
    });
    return [...seen.values()].sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
  }, [payers, rows]);

  const filteredRows = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return rows.filter((r) => {
      if (modeFilter) {
        const mode = String(r.mode_of_payment || "").toLowerCase();
        if (modeFilter === "cash+transfer") {
          if (
            mode !== "cash+transfer" &&
            mode !== "split" &&
            mode !== "cash_transfer"
          ) {
            return false;
          }
        } else if (mode !== modeFilter) {
          return false;
        }
      }
      if (!q) return true;
      const hay = [
        r.receipt_no,
        r.supplier_name,
        r.supplier_no,
        r.mode_of_payment,
        r.description,
        r.created_by_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, searchInput, modeFilter]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const openReceipt = (item) => {
    const ref = item.receipt_no || "";
    navigate(
      `/app/purchase/supplier-payment-receipt?ref_number=${encodeURIComponent(
        ref,
      )}&pv_code=${encodeURIComponent(ref)}&supplier_no=${encodeURIComponent(
        item.supplier_no || "",
      )}`,
    );
  };

  const fields = [
    {
      title: "Payment #",
      component: (item) => (
        <button
          type="button"
          className="text-sm font-medium text-[var(--aa-accent)] hover:underline"
          onClick={() => openReceipt(item)}
        >
          {item.receipt_no || "-"}
        </button>
      ),
    },
    {
      title: "Vendor",
      component: (item) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {item.supplier_name || "-"}
          </div>
          <div className="text-xs text-gray-500">{item.supplier_no || ""}</div>
        </div>
      ),
    },
    {
      title: "Payment Date",
      component: (item) => (
        <span className="text-sm text-gray-700">
          {item.date ? moment(item.date).format("MM/DD/YYYY") : "-"}
        </span>
      ),
    },
    {
      title: "Mode of payment",
      component: (item) => (
        <span className="text-sm text-gray-700">
          {formatExpensePaymentMode(item.mode_of_payment)}
        </span>
      ),
    },
    {
      title: "Amount (₦)",
      component: (item) => (
        <span className="text-sm font-semibold text-gray-900">
          {formatNumber1(item.amount || 0)}
        </span>
      ),
    },
    ...(canSeeAll
      ? [
          {
            title: "Created by",
            component: (item) => (
              <span className="text-sm text-gray-700">
                {item.created_by_name || item.created_by || "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      title: "Action",
      component: (item) => (
        <div className="flex justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-slate-500 data-[state=open]:bg-slate-100"
              >
                <MoreVerticalIcon className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => openReceipt(item)}>
                <Printer className="mr-2 h-4 w-4" />
                View receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="p-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pay Bills</h1>
          <p className="text-muted-foreground">
            Supplier payment hub: New Payment for unpaid bills, Make Deposit for
            prepaid vendor funds, Apply Deposit to bills. Customer collections
            are under Sales → Verification Points.
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 w-full max-w-md overflow-hidden">
          <Input.Search
            placeholder="Search by payment #, vendor, or reference"
            value={searchInput}
            onChange={handleSearchChange}
            className="w-full"
            style={{ width: "100%" }}
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <select
              value={modeFilter || "all"}
              onChange={handleModeFilter}
              className="h-9 min-w-[8rem] shrink-0 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-navy)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              aria-label="Filter by payment mode"
            >
              <option value="all">All modes</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="cheque">Cheque</option>
              <option value="cash+transfer">Cash + Transfer</option>
            </select>
            {canSeeAll ? (
              <select
                value={paidByFilter}
                onChange={handlePaidByFilter}
                className="h-9 min-w-[10rem] shrink-0 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-[var(--aa-navy)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                aria-label="Filter by user who made the payment"
              >
                <option value="all">All users</option>
                {payerOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => {
                setDepositSupplier(null);
                setMakeDepositOpen(true);
              }}
            >
              Make Deposit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setApplyDepositOpen(true)}
            >
              Apply Deposit
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex h-9 items-center gap-2 bg-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-navy-hover)]"
              onClick={() => navigate("/app/payments/pay-bills/new")}
            >
              <HandCoins className="h-4 w-4" />
              New Payment
            </Button>
        </div>
      </div>

      <div className="mt-3">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                {fields.map((field, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700"
                  >
                    {field.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {fields.map((_, fieldIdx) => (
                      <td key={fieldIdx} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={fields.length} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <CreditCard className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-lg text-gray-500">
                        {searchInput || modeFilter || paidByFilter !== "all"
                          ? "No payments found"
                          : "No payments recorded yet"}
                      </p>
                      {!searchInput && !modeFilter && paidByFilter === "all" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="flex items-center gap-2 bg-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-navy-hover)]"
                          onClick={() => navigate("/app/payments/pay-bills/new")}
                        >
                          <HandCoins className="h-4 w-4" />
                          New Payment
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => (
                  <tr
                    key={item.entry_id || item.receipt_no || idx}
                    className="hover:bg-gray-50"
                  >
                    {fields.map((field, fieldIdx) => (
                      <td
                        key={fieldIdx}
                        className="px-4 py-3 text-sm text-gray-900"
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

        {!loading && filteredRows.length > pageSize && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredRows.length)} of{" "}
              {filteredRows.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Sheet open={applyDepositOpen} onOpenChange={setApplyDepositOpen}>
        <SheetContent
          side="right"
          className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl lg:!max-w-3xl [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Apply Deposit</SheetTitle>
            <SheetDescription>
              Move deposit to goods in transit and apply to unpaid bills
            </SheetDescription>
          </SheetHeader>
          {applyDepositOpen ? (
            <ApplySupplierDeposit
              asModal
              onCancel={() => setApplyDepositOpen(false)}
              onSuccess={() => {
                setApplyDepositOpen(false);
                fetchList();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <SupplierAdvancePaymentModal
        open={makeDepositOpen}
        onClose={() => {
          setMakeDepositOpen(false);
          setDepositSupplier(null);
        }}
        onSuccess={() => {
          setMakeDepositOpen(false);
          setDepositSupplier(null);
          fetchList();
        }}
        party={depositSupplier}
      />
    </div>
  );
}
