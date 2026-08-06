import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import { ChevronLeft, FileText, RefreshCw, Wallet } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import SearchSupplierInput from "@/components/pages/purchase/SearchSuppliers";
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

function billKey(bill) {
  return String(bill.invoice_ref || bill.invoiceRef || "");
}

const fieldClass =
  "w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-slate-400 disabled:opacity-60 disabled:bg-slate-50";

/**
 * Apply existing supplier deposit / advance to unpaid bills —
 * mirrors Customer Apply Advance and Vendor Credits → Apply to Bills.
 *
 * @param {{ asModal?: boolean, onSuccess?: () => void, onCancel?: () => void }} props
 */
export default function ApplySupplierDeposit({
  asModal = false,
  onSuccess,
  onCancel,
} = {}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const currency =
    activeBusiness?.currency ||
    activeBusiness?.currency_code ||
    activeBusiness?.base_currency ||
    "NGN";

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [availableDeposit, setAvailableDeposit] = useState(0);
  const [bills, setBills] = useState([]);
  const [applyAmounts, setApplyAmounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [paymentDate, setPaymentDate] = useState(moment().format("YYYY-MM-DD"));
  const [notes, setNotes] = useState("");
  const autoSeededFor = useRef("");

  const supplierNo =
    selectedSupplier?.supplier_number ||
    selectedSupplier?.supplierNo ||
    selectedSupplier?.id ||
    "";

  const loadSupplierData = useCallback(
    (supplierNumber) => {
      if (!facilityId || !supplierNumber) return;
      setLoading(true);
      setApplyAmounts({});
      autoSeededFor.current = "";

      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending <= 0) setLoading(false);
      };

      _fetchApi(
        `/api/v1/get-supplier-advance-history?supplierNo=${encodeURIComponent(
          supplierNumber,
        )}&facilityId=${facilityId}&limit=5`,
        (res) => {
          setAvailableDeposit(
            parseFloat(res?.available_deposit ?? res?.available_advance) || 0,
          );
          done();
        },
        () => {
          setAvailableDeposit(0);
          toast.error("Failed to load deposit balance");
          done();
        },
      );

      _fetchApi(
        `/api/v1/get-outstanding-supplier-invoices?supplierNo=${encodeURIComponent(
          supplierNumber,
        )}&facilityId=${facilityId}`,
        (res) => {
          const list = (Array.isArray(res?.results) ? res.results : []).filter(
            (b) => (parseFloat(b.amount_due ?? b.balance_due ?? 0) || 0) > 0.009,
          );
          list.sort((a, b) => {
            const da = new Date(a.transaction_date || 0).getTime();
            const db = new Date(b.transaction_date || 0).getTime();
            return da - db;
          });
          setBills(list);
          done();
        },
        () => {
          setBills([]);
          toast.error("Failed to load unpaid bills");
          done();
        },
      );
    },
    [facilityId],
  );

  const handleSupplierChange = (supplier) => {
    if (!supplier?.supplier_number && !supplier?.supplierNo) {
      setSelectedSupplier(null);
      setAvailableDeposit(0);
      setBills([]);
      setApplyAmounts({});
      return;
    }
    setSelectedSupplier(supplier);
    loadSupplierData(supplier.supplier_number || supplier.supplierNo);
  };

  useEffect(() => {
    if (!supplierNo || loading || availableDeposit <= 0) return;
    if (bills.length === 0) return;
    if (autoSeededFor.current === supplierNo) return;

    let remaining = availableDeposit;
    const next = {};
    for (const bill of bills) {
      const k = billKey(bill);
      const due = parseFloat(bill.amount_due ?? bill.balance_due ?? 0) || 0;
      const pay = Math.min(Math.max(0, due), Math.max(0, remaining));
      next[k] = pay > 0 ? formatNumberWithCommas(pay.toFixed(2)) : "";
      remaining -= pay;
    }
    autoSeededFor.current = supplierNo;
    setApplyAmounts(next);
  }, [supplierNo, loading, availableDeposit, bills]);

  const allocatedSum = useMemo(() => {
    let sum = 0;
    for (const bill of bills) {
      const k = billKey(bill);
      sum += parseFloat(parseNumberFromFormatted(applyAmounts[k] || "")) || 0;
    }
    return sum;
  }, [applyAmounts, bills]);

  const setAmount = (bill, raw) => {
    const k = billKey(bill);
    const due = parseFloat(bill.amount_due ?? bill.balance_due ?? 0) || 0;
    const formatted = formatNumberWithCommas(raw);
    const num = parseFloat(parseNumberFromFormatted(formatted)) || 0;
    const capped =
      num > due ? formatNumberWithCommas(due.toFixed(2)) : formatted;
    setApplyAmounts((prev) => ({ ...prev, [k]: capped }));
  };

  const applyFull = (bill) => {
    const due = parseFloat(bill.amount_due ?? bill.balance_due ?? 0) || 0;
    const k = billKey(bill);
    setApplyAmounts((prev) => ({
      ...prev,
      [k]: due > 0 ? formatNumberWithCommas(due.toFixed(2)) : "",
    }));
  };

  const clearApplied = () => setApplyAmounts({});

  const seedFifo = () => {
    let remaining = availableDeposit;
    const next = {};
    for (const bill of bills) {
      const k = billKey(bill);
      const due = parseFloat(bill.amount_due ?? bill.balance_due ?? 0) || 0;
      const pay = Math.min(Math.max(0, due), Math.max(0, remaining));
      next[k] = pay > 0 ? formatNumberWithCommas(pay.toFixed(2)) : "";
      remaining -= pay;
    }
    setApplyAmounts(next);
  };

  const handleApply = () => {
    if (!supplierNo) {
      toast.error("Select a vendor");
      return;
    }
    if (availableDeposit <= 0) {
      toast.error("This vendor has no available deposit");
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
      toast.error("Enter amounts to apply on at least one bill");
      return;
    }
    if (allocatedSum > availableDeposit + 0.01) {
      toast.error(
        `Applied (${formatNumber1(allocatedSum)}) exceeds available deposit (${formatNumber1(availableDeposit)})`,
      );
      return;
    }

    const applications = bills
      .map((bill) => {
        const k = billKey(bill);
        const amount =
          parseFloat(parseNumberFromFormatted(applyAmounts[k] || "")) || 0;
        if (amount <= 0) return null;
        return { invoice_ref: k, amount };
      })
      .filter(Boolean);

    setApplying(true);
    _postApi(
      "/api/v1/apply-supplier-advance",
      {
        facilityId,
        userId: user?.id || user?.user_id,
        supplier_no: supplierNo,
        transaction_date: paymentDate,
        narration: notes,
        applications,
      },
      (res) => {
        setApplying(false);
        if (res?.success) {
          toast.success(
            res.message ||
              `Deposit applied (${res.data?.reference_number || ""})`,
          );
          setNotes("");
          loadSupplierData(supplierNo);
          setApplyAmounts({});
          onSuccess?.();
        } else {
          toast.error(res?.error || res?.message || "Failed to apply deposit");
        }
      },
      (err) => {
        setApplying(false);
        toast.error(err?.error || err?.message || "Failed to apply deposit");
      },
    );
  };

  const canSubmit =
    !applying &&
    !!selectedSupplier &&
    allocatedSum > 0 &&
    availableDeposit > 0;

  return (
    <div
      className={
        asModal
          ? "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          : "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-0"
      }
    >
      <div
        className={
          asModal
            ? "mx-auto w-full"
            : "mx-auto max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        }
      >
        {/* Header — same pattern as Expenses Bill */}
        <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          {(asModal || onCancel) && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCancel?.()}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-slate-300" />
            </>
          )}
          <div className="flex flex-1 items-center gap-2.5">
            <Wallet className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Apply Deposit
            </h2>
          </div>
          {selectedSupplier && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => loadSupplierData(supplierNo)}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}
        </div>

        {/* Transaction details */}
        <div className="bg-white p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Select Supplier <span className="text-red-500">*</span>
              </label>
              <SearchSupplierInput
                onChange={handleSupplierChange}
                selected={selectedSupplier ? [selectedSupplier] : []}
                disabled={applying}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={paymentDate}
                min={POSTING_DATE_MIN}
                max={getPostingDateMax()}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={applying}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileText className="h-4 w-4" />
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={applying}
              placeholder="Enter internal note..."
              className={fieldClass}
            />
          </div>

          {selectedSupplier && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                  Available deposit
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-800">
                  {currency} {formatNumber1(availableDeposit)}
                </p>
              </div>
              <div className="rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Amount to apply
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                  {currency} {formatNumber1(allocatedSum)}
                </p>
              </div>
              <div className="rounded-lg border-2 border-slate-200 bg-slate-50 px-3 py-2.5">
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
        </div>

        {/* Unpaid Bills section — green bar like Add Items */}
        <div className="flex items-center justify-between border-b-2 border-t-2 border-green-100 bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 px-6 py-3.5">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <FileText className="h-4 w-4 text-green-600" />
            Unpaid Bills
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={seedFifo}
              disabled={applying || !selectedSupplier || availableDeposit <= 0}
              className="cursor-pointer text-left font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            >
              Auto-allocate
            </button>
            <button
              type="button"
              onClick={clearApplied}
              disabled={applying || allocatedSum <= 0}
              className="cursor-pointer text-left font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
            >
              Clear Applied
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-6">
          {!selectedSupplier ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
              Select a vendor to see unpaid bills and available deposit.
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : availableDeposit <= 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
              No available deposit for this vendor. Record one under Pay Bills →
              New Payment (pay more than the bill balance) first.
            </div>
          ) : bills.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
              No unpaid bills for this vendor.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border-2 border-slate-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Bill</th>
                    <th className="px-3 py-2.5 text-right">Amount Due</th>
                    <th className="px-3 py-2.5 text-right">Apply Deposit</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.map((bill) => {
                    const k = billKey(bill);
                    return (
                      <tr key={k} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 text-slate-700">
                          {bill.transaction_date
                            ? moment(bill.transaction_date).format(
                                "DD MMM YYYY",
                              )
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-blue-600">
                          {k}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                          {formatNumber1(
                            bill.amount_due ?? bill.balance_due ?? 0,
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={applyAmounts[k] || ""}
                            onChange={(e) => setAmount(bill, e.target.value)}
                            disabled={applying}
                            placeholder="0.00"
                            className="ml-auto w-28 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-right text-sm outline-none transition-all hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => applyFull(bill)}
                            disabled={applying}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-40"
                          >
                            Apply Full
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td
                      colSpan={3}
                      className="px-3 py-2.5 text-xs text-slate-500"
                    >
                      Applying deposit does not pay new cash — it uses the
                      vendor&apos;s existing advance.
                    </td>
                    <td
                      colSpan={2}
                      className="px-3 py-2.5 text-right text-sm font-semibold text-slate-900"
                    >
                      Total {formatNumber1(allocatedSum)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={!canSubmit}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply Deposit to Bills"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
