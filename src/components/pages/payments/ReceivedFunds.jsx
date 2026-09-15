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
import { _fetchApi, _postApi } from "@/redux/actions/api";
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
 * Customer deposits & credit — Deposit Summary, Credit Summary, History.
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

  const canMakeDeposit =
    elevated ||
    functionalities.includes(MAKE_DEPOSIT_PRIVILEGE) ||
    parentPaymentAccess;

  const [activeTab, setActiveTab] = useState(() =>
    canSummary ? "summary" : canCreditSummary ? "credit" : "history",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditRows, setCreditRows] = useState([]);
  const [asAtDate, setAsAtDate] = useState(() =>
    moment().format("YYYY-MM-DD"),
  );

  useEffect(() => {
    if (activeTab === "summary" && !canSummary) {
      setActiveTab(
        canCreditSummary ? "credit" : canHistory ? "history" : "summary",
      );
    } else if (activeTab === "credit" && !canCreditSummary) {
      setActiveTab(canSummary ? "summary" : canHistory ? "history" : "credit");
    } else if (activeTab === "history" && !canHistory) {
      setActiveTab(
        canSummary ? "summary" : canCreditSummary ? "credit" : "history",
      );
    }
  }, [activeTab, canSummary, canCreditSummary, canHistory]);

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

  const fetchSummary = useCallback(() => {
    if (!facilityId || !asAtDate) return;
    setSummaryLoading(true);
    _postApi(
      "/account/customer-deposits-report",
      { facilityId, asAtDate },
      (response) => {
        setSummaryLoading(false);
        if (!response?.success) {
          toast.error(response?.message || "Failed to load deposit summary");
          setSummaryRows([]);
          return;
        }
        const raw = Array.isArray(response?.data?.rows)
          ? response.data.rows
          : [];
        setSummaryRows(
          raw
            .map((item) => ({
              partyId: item.party_id,
              partyName: item.party_name || item.party_id,
              balance: Number(item.balance) || 0,
            }))
            .sort((a, b) => b.balance - a.balance),
        );
      },
      () => {
        setSummaryLoading(false);
        toast.error("Failed to load deposit summary");
        setSummaryRows([]);
      },
    );
  }, [facilityId, asAtDate]);

  const fetchCreditSummary = useCallback(() => {
    if (!facilityId || !asAtDate) return;
    setCreditLoading(true);
    _postApi(
      "/account/customer-credits-report",
      { facilityId, asAtDate },
      (response) => {
        setCreditLoading(false);
        if (!response?.success) {
          toast.error(response?.message || "Failed to load credit summary");
          setCreditRows([]);
          return;
        }
        const raw = Array.isArray(response?.data?.rows)
          ? response.data.rows
          : [];
        setCreditRows(
          raw
            .map((item) => ({
              partyId: item.party_id,
              partyName: item.party_name || item.party_id,
              balance: Number(item.balance) || 0,
              invoiceCount: Number(item.invoice_count) || 0,
            }))
            .sort((a, b) => b.balance - a.balance),
        );
      },
      () => {
        setCreditLoading(false);
        toast.error("Failed to load credit summary");
        setCreditRows([]);
      },
    );
  }, [facilityId, asAtDate]);

  useEffect(() => {
    if (activeTab === "history" && canHistory) fetchHistory();
  }, [activeTab, canHistory, fetchHistory]);

  useEffect(() => {
    if (activeTab === "summary" && canSummary) fetchSummary();
  }, [activeTab, canSummary, fetchSummary]);

  useEffect(() => {
    if (activeTab === "credit" && canCreditSummary) fetchCreditSummary();
  }, [activeTab, canCreditSummary, fetchCreditSummary]);

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

  const filteredSummary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaryRows;
    return summaryRows.filter((r) => {
      const hay = [r.partyId, r.partyName].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [summaryRows, search]);

  const filteredCredit = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return creditRows;
    return creditRows.filter((r) => {
      const hay = [r.partyId, r.partyName].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [creditRows, search]);

  const summaryTotal = useMemo(
    () => filteredSummary.reduce((s, r) => s + (Number(r.balance) || 0), 0),
    [filteredSummary],
  );

  const creditTotal = useMemo(
    () => filteredCredit.reduce((s, r) => s + (Number(r.balance) || 0), 0),
    [filteredCredit],
  );

  const isBalanceTab = activeTab === "summary" || activeTab === "credit";
  const balanceLoading = activeTab === "credit" ? creditLoading : summaryLoading;
  const balanceRows =
    activeTab === "credit" ? filteredCredit : filteredSummary;
  const balanceTotal = activeTab === "credit" ? creditTotal : summaryTotal;
  const balanceLabel =
    activeTab === "credit" ? "Credit Balance (₦)" : "Deposit Balance (₦)";
  const balanceEmpty =
    activeTab === "credit"
      ? "No customers with an outstanding credit balance for this date."
      : "No customers with an outstanding deposit balance for this date.";

  const refreshActive = () => {
    if (activeTab === "summary") fetchSummary();
    else if (activeTab === "credit") fetchCreditSummary();
    else fetchHistory();
  };

  const goNew = () => navigate("/app/payments/receive-payment/new");

  const openCustomerLedger = (customerNo, customerName) => {
    const id = String(customerNo || "").trim();
    if (!id) return;
    const params = new URLSearchParams({ customerNo: id });
    if (customerName) params.set("customerName", String(customerName));
    if (asAtDate) {
      params.set("asAt", asAtDate);
      params.set("toDate", asAtDate);
    }
    navigate(
      `/app/reports/accounting-reports/receivable-ledger-aging?${params.toString()}`,
    );
  };

  const openCustomer = (customerNo, customerName) => {
    openCustomerLedger(customerNo, customerName);
  };

  const printBalanceStatement = (row) => {
    const customerNo = row?.partyId || String(search || "").trim();
    if (!customerNo) {
      toast.error("Select a customer or enter a customer ID in search");
      return;
    }
    const params = new URLSearchParams({
      customer_no: customerNo,
      as_at: asAtDate,
    });
    if (row?.partyName) params.set("name", row.partyName);
    navigate(
      `/app/payments/receive-payment/balance-statement?${params.toString()}`,
    );
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
            Ask an admin to grant <strong>Deposit Summary</strong>,{" "}
            <strong>Credit Summary</strong>, or{" "}
            <strong>Deposit History</strong> under Sales → Received Payment.
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
              Customer deposit and credit balances, plus payment history
              (deposits received and deposits applied to invoices). Print a
              balance statement for any customer, or open a receipt/invoice from
              History. Record a new deposit with{" "}
              <span className="font-medium text-gray-800">Make Deposit</span>.
              {activeTab === "history" && totalCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {totalCount} total
                </span>
              )}
            </p>
          </div>
        </div>
        {canMakeDeposit ? (
          <CustomButton className="!mb-0" onClick={goNew}>
            <FaPlus className="h-4 w-4" aria-hidden />
            Make Deposit
          </CustomButton>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {canSummary ? (
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === "summary"
                ? "bg-[var(--aa-navy)] text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Deposit Summary
          </button>
        ) : null}
        {canCreditSummary ? (
          <button
            type="button"
            onClick={() => setActiveTab("credit")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === "credit"
                ? "bg-[var(--aa-navy)] text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Credit Summary
          </button>
        ) : null}
        {canHistory ? (
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === "history"
                ? "bg-[var(--aa-navy)] text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            History
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {isBalanceTab ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Date as at
                </label>
                <input
                  type="date"
                  value={asAtDate}
                  onChange={(e) => setAsAtDate(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
                />
              </div>
            ) : null}
            <div className="relative w-full sm:max-w-md sm:min-w-[16rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                placeholder={
                  isBalanceTab
                    ? "Search by customer name or ID"
                    : "Search by payment #, customer, invoice…"
                }
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isBalanceTab ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const match =
                    balanceRows.length === 1
                      ? balanceRows[0]
                      : balanceRows.find(
                          (r) =>
                            String(r.partyId).toLowerCase() ===
                            search.trim().toLowerCase(),
                        );
                  printBalanceStatement(match || { partyId: search.trim() });
                }}
              >
                <Printer className="h-4 w-4" />
                Print statement
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={refreshActive}
              disabled={isBalanceTab ? balanceLoading : loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  (isBalanceTab ? balanceLoading : loading) ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {isBalanceTab ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {balanceLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="px-4 py-2.5 font-semibold">Customer ID</th>
                  <th className="px-4 py-2.5 font-semibold">Customer Name</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    {balanceLabel}
                  </th>
                  <th className="px-4 py-2.5 text-center font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      {balanceEmpty}
                    </td>
                  </tr>
                ) : (
                  <>
                    {balanceRows.map((row, idx) => (
                      <tr
                        key={row.partyId}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <button
                            type="button"
                            className="text-[var(--aa-accent)] hover:underline"
                            onClick={() =>
                              openCustomerLedger(row.partyId, row.partyName)
                            }
                            title="Open receivable ledger"
                          >
                            {row.partyId}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            className="text-left text-[var(--aa-accent)] hover:underline"
                            onClick={() =>
                              openCustomerLedger(row.partyId, row.partyName)
                            }
                            title="Open receivable ledger"
                          >
                            {row.partyName}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {formatNumber1(row.balance)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-[var(--aa-accent)]"
                              onClick={() => printBalanceStatement(row)}
                              title="Print deposit & credit balances"
                            >
                              <Printer className="h-4 w-4" />
                              Print
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-4 py-3" colSpan={3}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber1(balanceTotal)}
                      </td>
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      ) : (
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
              {!search && canMakeDeposit && (
                <CustomButton className="!mb-0 mt-4" onClick={goNew}>
                  <FaPlus className="h-4 w-4" aria-hidden />
                  Make Deposit
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
      )}
    </div>
  );
}
