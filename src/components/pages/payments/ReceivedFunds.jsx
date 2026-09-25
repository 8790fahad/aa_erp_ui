import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
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
import {
  getUserFunctionalities,
  hasFullAccess,
  isBusinessOwner,
} from "@/lib/access";

const DEPOSIT_SUMMARY_PRIVILEGE = "Deposit Summary";
const CREDIT_SUMMARY_PRIVILEGE = "Credit Summary";
const DEPOSIT_HISTORY_PRIVILEGE = "Deposit History";
const MAKE_DEPOSIT_PRIVILEGE = "Make Deposit";
const APPLY_DEPOSIT_PRIVILEGE = "Apply Deposit";

function modeBreakdown(item) {
  if (
    item.direction === "applied" ||
    String(item.mode_of_payment || "").toUpperCase() === "ADVANCE"
  ) {
    return [{ label: "Apply Deposit", amount: Number(item.amount) || 0 }];
  }
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

function parseFuncs(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Received payments — deposit receipts and deposits applied to invoices.
 * Deposit balances live on the Deposit Report; credit balances on the Receivable Report.
 */
export default function ReceivedFunds() {
  const navigate = useNavigate();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;

  const functionalities = useMemo(() => {
    const fromAccess = getUserFunctionalities(user, activeBusiness);
    if (fromAccess?.length) return fromAccess;
    return [
      ...new Set([
        ...parseFuncs(activeBusiness?.functionalities),
        ...parseFuncs(user?.functionalities),
      ]),
    ];
  }, [user, activeBusiness]);

  const elevated =
    isBusinessOwner(user, activeBusiness) ||
    hasFullAccess(functionalities) ||
    !functionalities.length;

  const parentPaymentAccess =
    functionalities.includes("Received Payment") ||
    functionalities.includes("Receive Payment") ||
    functionalities.includes("Customer Deposit");

  const canSummary =
    elevated ||
    functionalities.includes(DEPOSIT_SUMMARY_PRIVILEGE) ||
    parentPaymentAccess;

  const canCreditSummary =
    elevated ||
    functionalities.includes(CREDIT_SUMMARY_PRIVILEGE) ||
    functionalities.includes(DEPOSIT_SUMMARY_PRIVILEGE) ||
    parentPaymentAccess;

  const canHistory =
    elevated ||
    functionalities.includes(DEPOSIT_HISTORY_PRIVILEGE) ||
    parentPaymentAccess;

  const canApplyDeposit =
    elevated ||
    functionalities.includes(APPLY_DEPOSIT_PRIVILEGE) ||
    functionalities.includes(MAKE_DEPOSIT_PRIVILEGE) ||
    parentPaymentAccess;

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    const params = new URLSearchParams({
      facilityId,
      page: "1",
      pageSize: "100",
    });

    _fetchApi(
      `/api/v1/get-received-payment-history?${params.toString()}`,
      (resp) => {
        setLoading(false);
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to load deposit history");
          setRows([]);
          setTotalCount(0);
          return;
        }
        setRows(Array.isArray(resp.results) ? resp.results : []);
        setTotalCount(parseInt(resp.total || 0, 10) || 0);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load deposit history");
        setRows([]);
        setTotalCount(0);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    if (canHistory || canSummary || canCreditSummary) fetchHistory();
  }, [canHistory, canSummary, canCreditSummary, fetchHistory]);

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
        r.invoice_ref,
        r.link_id,
        r.status_label,
        r.direction,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const refreshActive = () => fetchHistory();

  const goApplyDeposit = () => navigate("/app/payments/apply-advance");

  const openCustomerLedger = (customerNo, customerName) => {
    const id = String(customerNo || "").trim();
    if (!id) return;
    const params = new URLSearchParams({ customerNo: id });
    if (customerName) params.set("customerName", String(customerName));
    navigate(
      `/app/reports/accounting-reports/receivable-ledger-aging?${params.toString()}`,
    );
  };

  const openCustomer = (customerNo, customerName) => {
    openCustomerLedger(customerNo, customerName);
  };

  const printReceipt = (item) => {
    if (item?.direction === "applied" && item?.invoice_ref) {
      navigate(
        `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
          item.invoice_ref,
        )}&doc=invoice`,
      );
      return;
    }
    navigate(
      `/app/customers/view-receipt/print?invoice_ref=${encodeURIComponent(
        item.receipt_no,
      )}&customer_no=${encodeURIComponent(item.customer_no || "")}`,
    );
  };

  const historyFields = useMemo(
    () => [
      {
        title: "Payment #",
        custom: true,
        component: (item) => (
          <div>
            <button
              type="button"
              className="text-sm font-medium text-[var(--aa-accent)] hover:underline"
              onClick={() => printReceipt(item)}
            >
              {item.receipt_no || "-"}
            </button>
            {item.invoice_ref ? (
              <button
                type="button"
                className="mt-0.5 block text-[11px] text-slate-500 hover:text-[var(--aa-accent)] hover:underline"
                onClick={() =>
                  navigate(
                    `/app/sales/invoice-preview?sale_code=${encodeURIComponent(
                      item.invoice_ref,
                    )}&doc=invoice`,
                  )
                }
                title="Open invoice"
              >
                → {item.invoice_ref}
              </button>
            ) : null}
          </div>
        ),
      },
      {
        title: "Customer",
        custom: true,
        component: (item) => (
          <div>
            <button
              type="button"
              className="text-sm font-medium text-[var(--aa-accent)] hover:underline"
              onClick={() =>
                openCustomer(item.customer_no, item.customer_name)
              }
            >
              {item.customer_name || "-"}
            </button>
            <button
              type="button"
              className="block text-xs text-gray-500 hover:text-[var(--aa-accent)] hover:underline"
              onClick={() =>
                openCustomer(item.customer_no, item.customer_name)
              }
            >
              {item.customer_no || ""}
            </button>
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
        title: "Status",
        custom: true,
        component: (item) => {
          const applied = item.direction === "applied";
          return (
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                applied
                  ? "border-sky-200 bg-sky-50 text-sky-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {applied ? "Deposit applied" : "Received"}
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
              <DropdownMenuContent align="end" className="w-44">
                {item.direction === "applied" && item.invoice_ref ? (
                  <DropdownMenuItem onClick={() => printReceipt(item)}>
                    <Printer className="mr-2 h-4 w-4" />
                    View invoice
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => printReceipt(item)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print receipt
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [navigate],
  );

  if (!canSummary && !canCreditSummary && !canHistory) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Received Payment
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Ask an admin to grant <strong>Deposit History</strong> under Sales →
            Received Payment. Deposit balances are on the Deposit Report, and
            credit balances are on the Receivable Report.
          </p>
        </div>
      </div>
    );
  }

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
              Deposits received and deposits applied to invoices. Open a
              receipt or invoice from any row. Deposit balances are on the{" "}
              <button
                type="button"
                className="font-medium text-[var(--aa-accent)] hover:underline"
                onClick={() =>
                  navigate("/app/reports/accounting-reports/deposit-report")
                }
              >
                Deposit Report
              </button>
              , and credit balances are on the{" "}
              <button
                type="button"
                className="font-medium text-[var(--aa-accent)] hover:underline"
                onClick={() =>
                  navigate(
                    "/app/reports/accounting-reports/receivable-ledger?tab=credit",
                  )
                }
              >
                Receivable Report
              </button>
              .
              {totalCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {totalCount} total
                </span>
              )}
            </p>
          </div>
        </div>
        {canApplyDeposit ? (
          <CustomButton className="!mb-0" onClick={goApplyDeposit}>
            Apply Deposit
          </CustomButton>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full sm:max-w-md sm:min-w-[16rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              placeholder="Search by payment #, customer, invoice…"
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={refreshActive}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="w-full overflow-hidden">
              <div className="border-b bg-gray-50 p-4">
                <div className="grid grid-cols-6 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-5 w-24" />
                  ))}
                </div>
              </div>
              <div className="divide-y">
                {[...Array(8)].map((_, index) => (
                  <div key={index} className="p-4">
                    <div className="grid grid-cols-6 gap-4">
                      {[...Array(6)].map((__, j) => (
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
                {search
                  ? "No matching payments"
                  : "No deposits or applications yet"}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                {search
                  ? "Try a different search term."
                  : "Make a customer deposit, or apply a deposit to an invoice — both appear here."}
              </p>
              {!search && canApplyDeposit && (
                <CustomButton className="!mb-0 mt-4" onClick={goApplyDeposit}>
                  Apply Deposit
                </CustomButton>
              )}
            </div>
          ) : (
            <CustomTable1
              fields={historyFields}
              data={filteredRows}
              message="No payments found"
            />
          )}
      </div>
    </div>
  );
}
