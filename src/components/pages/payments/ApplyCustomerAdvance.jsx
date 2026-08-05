import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { FileText, RefreshCw, Wallet } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import CustomButton from "@/common/Custom/CustomButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  POSTING_DATE_MIN,
  getPostingDateMax,
  validatePostingDateClient,
} from "@/utilities";

function parseNumberFromFormatted(value) {
  if (value === "" || value === null || value === undefined) return "";
  return String(value).replace(/,/g, "");
}

function formatNumberWithCommas(value) {
  if (value === "" || value === null || value === undefined) return "";
  const withoutCommas = String(value).replace(/,/g, "");
  if (withoutCommas === "") return "";
  const endsWithDot = withoutCommas.endsWith(".");
  const [intRaw, ...rest] = withoutCommas.split(".");
  const dec = rest.join("");
  const intPart = (intRaw || "").replace(/\D/g, "");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (rest.length > 0 || endsWithDot) {
    return dec !== "" ? `${formattedInt}.${dec}` : `${formattedInt}.`;
  }
  return formattedInt;
}

function invoiceKey(inv) {
  return String(inv.invoice_ref || inv.invoiceRef || "");
}

/**
 * Apply existing customer advance to unpaid invoices —
 * same settlement idea as Credit Notes → Apply to Invoices.
 */
export default function ApplyCustomerAdvance() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const currency =
    activeBusiness?.currency ||
    activeBusiness?.currency_code ||
    activeBusiness?.base_currency ||
    "NGN";

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [availableDeposit, setAvailableDeposit] = useState(0);
  const [invoices, setInvoices] = useState([]);
  const [applyAmounts, setApplyAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [paymentDate, setPaymentDate] = useState(moment().format("YYYY-MM-DD"));
  const [notes, setNotes] = useState("");
  const autoSeededFor = useRef("");

  const loadCustomerData = useCallback(
    (customerNo) => {
      if (!facilityId || !customerNo) return;
      setLoading(true);
      setApplyAmounts({});
      autoSeededFor.current = "";

      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending <= 0) setLoading(false);
      };

      _fetchApi(
        `/api/v1/get-customer-advance-history?customerNo=${encodeURIComponent(
          customerNo,
        )}&facilityId=${facilityId}&limit=5`,
        (res) => {
          setAvailableDeposit(parseFloat(res?.available_deposit) || 0);
          done();
        },
        () => {
          setAvailableDeposit(0);
          toast.error("Failed to load advance balance");
          done();
        },
      );

      _fetchApi(
        `/api/v1/get-outstanding-invoices?customerNo=${encodeURIComponent(
          customerNo,
        )}&facilityId=${facilityId}&userId=${user?.id || ""}`,
        (res) => {
          const list = Array.isArray(res?.results) ? res.results : [];
          list.sort((a, b) => {
            const da = new Date(a.transaction_date || 0).getTime();
            const db = new Date(b.transaction_date || 0).getTime();
            return da - db;
          });
          setInvoices(list);
          done();
        },
        () => {
          setInvoices([]);
          toast.error("Failed to load unpaid invoices");
          done();
        },
      );
    },
    [facilityId, user?.id],
  );

  const handleCustomerChange = (customer) => {
    if (!customer?.customerNo) {
      setSelectedCustomer(null);
      setAvailableDeposit(0);
      setInvoices([]);
      setApplyAmounts({});
      return;
    }
    setSelectedCustomer(customer);
    loadCustomerData(customer.customerNo);
  };

  // FIFO seed once when advance + invoices are ready for this customer
  useEffect(() => {
    const custNo = selectedCustomer?.customerNo;
    if (!custNo || loading || availableDeposit <= 0) return;
    if (invoices.length === 0) return;
    if (autoSeededFor.current === custNo) return;

    let remaining = availableDeposit;
    const next = {};
    for (const inv of invoices) {
      const k = invoiceKey(inv);
      const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
      const pay = Math.min(Math.max(0, due), Math.max(0, remaining));
      next[k] = pay > 0 ? formatNumberWithCommas(pay.toFixed(2)) : "";
      remaining -= pay;
    }
    autoSeededFor.current = custNo;
    setApplyAmounts(next);
  }, [selectedCustomer, loading, availableDeposit, invoices]);

  const allocatedSum = useMemo(() => {
    let sum = 0;
    for (const inv of invoices) {
      const k = invoiceKey(inv);
      sum += parseFloat(parseNumberFromFormatted(applyAmounts[k] || "")) || 0;
    }
    return sum;
  }, [applyAmounts, invoices]);

  const setAmount = (inv, raw) => {
    const k = invoiceKey(inv);
    const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
    const formatted = formatNumberWithCommas(raw);
    const num = parseFloat(parseNumberFromFormatted(formatted)) || 0;
    const capped = num > due ? formatNumberWithCommas(due.toFixed(2)) : formatted;
    setApplyAmounts((prev) => ({ ...prev, [k]: capped }));
  };

  const applyFull = (inv) => {
    const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
    const k = invoiceKey(inv);
    setApplyAmounts((prev) => ({
      ...prev,
      [k]: due > 0 ? formatNumberWithCommas(due.toFixed(2)) : "",
    }));
  };

  const clearApplied = () => setApplyAmounts({});

  const seedFifo = () => {
    let remaining = availableDeposit;
    const next = {};
    for (const inv of invoices) {
      const k = invoiceKey(inv);
      const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
      const pay = Math.min(Math.max(0, due), Math.max(0, remaining));
      next[k] = pay > 0 ? formatNumberWithCommas(pay.toFixed(2)) : "";
      remaining -= pay;
    }
    setApplyAmounts(next);
  };

  const handleApply = () => {
    if (!selectedCustomer?.customerNo) {
      toast.error("Select a customer");
      return;
    }
    if (availableDeposit <= 0) {
      toast.error("This customer has no available advance");
      return;
    }
    const dateErr = validatePostingDateClient(paymentDate, {
      field: "Date",
    });
    if (dateErr) {
      toast.error(dateErr);
      return;
    }
    if (allocatedSum <= 0) {
      toast.error("Enter amounts to apply on at least one invoice");
      return;
    }
    if (allocatedSum > availableDeposit + 0.01) {
      toast.error(
        `Applied (${formatNumber1(allocatedSum)}) exceeds available advance (${formatNumber1(availableDeposit)})`,
      );
      return;
    }

    const applications = invoices
      .map((inv) => {
        const k = invoiceKey(inv);
        const amount =
          parseFloat(parseNumberFromFormatted(applyAmounts[k] || "")) || 0;
        if (amount <= 0) return null;
        return { invoice_ref: k, amount };
      })
      .filter(Boolean);

    setApplying(true);
    _postApi(
      "/api/v1/apply-customer-advance",
      {
        facilityId,
        userId: user?.id || user?.user_id,
        customer_no: selectedCustomer.customerNo,
        transaction_date: paymentDate,
        narration: notes,
        applications,
      },
      (res) => {
        setApplying(false);
        if (res?.success) {
          toast.success(
            res.message ||
              `Advance applied (${res.data?.reference_number || ""})`,
          );
          setNotes("");
          loadCustomerData(selectedCustomer.customerNo);
          setApplyAmounts({});
        } else {
          toast.error(res?.error || res?.message || "Failed to apply advance");
        }
      },
      (err) => {
        setApplying(false);
        toast.error(err?.error || err?.message || "Failed to apply advance");
      },
    );
  };

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <Wallet className="h-5 w-5 text-[var(--aa-accent)]" />
              Apply Advance
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Apply a customer&apos;s existing advance / deposit to unpaid
              invoices — like Credit Notes → Apply to Invoices.
            </p>
          </div>
          {selectedCustomer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => loadCustomerData(selectedCustomer.customerNo)}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
            Customer <span className="text-red-600">*</span>
          </label>
          <div className="max-w-md">
            <SearchCustomerInput
              onChange={handleCustomerChange}
              selected={selectedCustomer ? [selectedCustomer] : []}
              disabled={applying}
            />
          </div>

          {selectedCustomer && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                  Available advance
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800">
                  {currency} {formatNumber1(availableDeposit)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Amount to apply
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                  {currency} {formatNumber1(allocatedSum)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Remaining after apply
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                  {currency}{" "}
                  {formatNumber1(Math.max(0, availableDeposit - allocatedSum))}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[13px] text-gray-700">Date</label>
              <input
                type="date"
                value={paymentDate}
                min={POSTING_DATE_MIN}
                max={getPostingDateMax()}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={applying}
                className="h-9 w-full max-w-xs rounded border border-gray-300 px-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] text-gray-700">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={applying}
                placeholder="Internal note"
                className="h-9 w-full rounded border border-gray-300 px-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <FileText className="h-4 w-4 text-slate-500" />
              Unpaid Invoices
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={seedFifo}
                disabled={
                  applying || !selectedCustomer || availableDeposit <= 0
                }
                className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
              >
                Auto-allocate
              </button>
              <button
                type="button"
                onClick={clearApplied}
                disabled={applying || allocatedSum <= 0}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
              >
                Clear Applied
              </button>
            </div>
          </div>

          {!selectedCustomer ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              Select a customer to see unpaid invoices and available advance.
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : availableDeposit <= 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              No available advance for this customer. Record one under Received
              Funds first.
            </div>
          ) : invoices.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              No unpaid invoices for this customer.
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2 text-right">Amount Due</th>
                  <th className="px-3 py-2 text-right">Apply Advance</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => {
                  const k = invoiceKey(inv);
                  return (
                    <tr key={k} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-gray-700">
                        {inv.transaction_date
                          ? moment(inv.transaction_date).format("DD MMM YYYY")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-medium text-blue-600">
                        {k}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatNumber1(inv.amount_due ?? inv.balance_due ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={applyAmounts[k] || ""}
                          onChange={(e) => setAmount(inv, e.target.value)}
                          disabled={applying}
                          placeholder="0.00"
                          className="ml-auto w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => applyFull(inv)}
                          disabled={applying}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
                        >
                          Apply Full
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-slate-50">
                  <td colSpan={3} className="px-3 py-2 text-xs text-slate-500">
                    Applying advance does not receive new cash — it uses the
                    customer&apos;s existing credit.
                  </td>
                  <td
                    colSpan={2}
                    className="px-3 py-2 text-right text-sm font-semibold"
                  >
                    Total {formatNumber1(allocatedSum)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 pb-6">
          <CustomButton
            className="!mb-0"
            onClick={handleApply}
            loading={applying}
            disabled={
              applying ||
              !selectedCustomer ||
              allocatedSum <= 0 ||
              availableDeposit <= 0
            }
          >
            Apply Advance to Invoices
          </CustomButton>
        </div>
      </div>
    </div>
  );
}
