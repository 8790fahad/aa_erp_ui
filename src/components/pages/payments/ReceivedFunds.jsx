import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { FaPlus } from "react-icons/fa";
import {
  Banknote,
  MoreVerticalIcon,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function modeBreakdown(item) {
  const cash = Number(item.cash_amount) || 0;
  const transfer = Number(item.transfer_amount) || 0;
  const card = Number(item.card_amount) || 0;
  const lines = [];
  if (cash > 0.05) lines.push({ label: "Cash", amount: cash });
  if (transfer > 0.05) lines.push({ label: "Transfer", amount: transfer });
  if (card > 0.05) lines.push({ label: "Card", amount: card });
  if (lines.length) return lines;
  const mode = String(item.mode_of_payment || "").toLowerCase();
  const amount = Number(item.amount) || 0;
  if (
    mode.includes("cash") &&
    (mode.includes("transfer") || mode.includes("bank"))
  ) {
    return [{ label: "Cash + Transfer", amount }];
  }
  if (mode === "card") return [{ label: "Card", amount }];
  if (mode === "bank" || mode === "transfer")
    return [{ label: "Transfer", amount }];
  if (mode) return [{ label: "Cash", amount }];
  return [{ label: "—", amount }];
}

/**
 * Customer deposits and prepaid funds (not supplier Pay Bills).
 */
export default function ReceivedFunds() {
  const navigate = useNavigate();
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const fetchList = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId,
      page: "1",
      pageSize: "500",
    });

    _fetchApi(
      `/api/v1/get-received-payment-history?${params.toString()}`,
      (resp) => {
        setLoading(false);
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to load received funds");
          setRows([]);
          setTotalCount(0);
          return;
        }
        setRows(Array.isArray(resp.results) ? resp.results : []);
        setTotalCount(parseInt(resp.total || 0, 10) || 0);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load received funds");
        setRows([]);
        setTotalCount(0);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.receipt_no,
        r.customer_name,
        r.customer_no,
        r.mode_of_payment,
        r.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const goNew = () => navigate("/app/payments/receive-payment/new");

  const fields = useMemo(
    () => [
      {
        title: "Payment #",
        custom: true,
        component: (item) => (
          <button
            type="button"
            className="text-sm font-medium text-[var(--aa-accent)] hover:underline"
            onClick={() =>
              navigate(
                `/app/customers/view-receipt/print?invoice_ref=${encodeURIComponent(
                  item.receipt_no,
                )}&customer_no=${encodeURIComponent(item.customer_no || "")}`,
              )
            }
          >
            {item.receipt_no || "-"}
          </button>
        ),
      },
      {
        title: "Customer",
        custom: true,
        component: (item) => (
          <div>
            <div className="text-sm font-medium text-gray-900">
              {item.customer_name || "-"}
            </div>
            <div className="text-xs text-gray-500">{item.customer_no || ""}</div>
          </div>
        ),
      },
      {
        title: "Date",
        custom: true,
        component: (item) => (
          <div className="text-sm text-gray-700">
            {item.date ? moment(item.date).format("DD MMM YYYY") : "-"}
          </div>
        ),
      },
      {
        title: "Mode",
        custom: true,
        component: (item) => (
          <div className="space-y-0.5 text-[11px] leading-snug text-slate-600">
            {modeBreakdown(item).map((line) => (
              <div key={line.label} className="tabular-nums">
                <span className="text-slate-500">{line.label}:</span>{" "}
                <span className="font-medium text-slate-800">
                  ₦{formatNumber1(line.amount)}
                </span>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: "Amount",
        custom: true,
        component: (item) => (
          <div className="text-right text-sm font-semibold text-gray-900">
            {formatNumber1(item.amount || 0)}
          </div>
        ),
      },
      {
        title: "Applied",
        custom: true,
        component: (item) => (
          <div className="text-right text-sm font-medium text-emerald-600">
            {formatNumber1(item.applied || 0)}
          </div>
        ),
      },
      {
        title: "Status",
        custom: true,
        component: (item) => {
          const amount = parseFloat(item.amount) || 0;
          const applied = parseFloat(item.applied) || 0;
          const fullyApplied = amount > 0 && applied >= amount - 0.01;
          return (
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                fullyApplied
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {fullyApplied ? "Applied" : "Received"}
            </span>
          );
        },
      },
      {
        title: "Action",
        custom: true,
        component: (item) => (
          <div className="flex justify-center">
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
                <DropdownMenuItem
                  onClick={() =>
                    navigate(
                      `/app/customers/view-receipt/print?invoice_ref=${encodeURIComponent(
                        item.receipt_no,
                      )}&customer_no=${encodeURIComponent(
                        item.customer_no || "",
                      )}`,
                    )
                  }
                >
                  <Printer className="mr-2 h-4 w-4" />
                  View receipt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Received Payment
            </h1>
            <p className="text-sm text-muted-foreground">
              Customer deposits and prepaid funds. Make a new deposit at{" "}
              <span className="font-medium text-gray-800">Verification Points</span>
              . Supplier payments are under Purchase → Pay Bills.
              {totalCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {totalCount} total
                </span>
              )}
            </p>
          </div>
        </div>
        <CustomButton className="!mb-0" onClick={goNew}>
          <FaPlus className="h-4 w-4" aria-hidden />
          Make Payment
        </CustomButton>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              placeholder="Search by payment #, customer, or reference"
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={fetchList}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {search && (
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span>
              Showing {filteredRows.length} of {totalCount} payments
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

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="w-full overflow-hidden">
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
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Banknote className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">
              {search ? "No matching deposits" : "No deposits recorded yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
              {search
                ? "Try a different search term."
                : "Make a customer deposit at Verification Points, or collect invoice payments there."}
            </p>
            {!search && (
              <CustomButton className="!mb-0 mt-4" onClick={goNew}>
                <FaPlus className="h-4 w-4" aria-hidden />
                Make Payment
              </CustomButton>
            )}
          </div>
        ) : (
          <CustomTable1
            fields={fields}
            data={filteredRows}
            message="No payments found"
          />
        )}
      </div>
    </div>
  );
}
