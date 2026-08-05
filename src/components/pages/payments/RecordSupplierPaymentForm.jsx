import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Info,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import CustomButton from "@/common/Custom/CustomButton";
import SearchSupplierInput from "@/components/pages/purchase/SearchSuppliers";
import { useAdvancePaymentAccounts } from "@/components/common/useAdvancePaymentAccounts";
import {
  POSTING_DATE_MIN,
  getPostingDateMax,
  validatePostingDateClient,
} from "@/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

function invoiceRowKey(inv) {
  return String(inv.invoice_id ?? inv.invoice_ref ?? "");
}

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

/** Label-left / field-right row, Zoho-style. */
function Row({ label, required, children, error }) {
  return (
    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-6">
      <label
        className={`w-full shrink-0 pt-1.5 text-[13px] sm:w-40 ${
          required ? "text-red-600" : "text-gray-700"
        }`}
      >
        {label}
        {required ? "*" : ""}
      </label>
      <div className="min-w-0 flex-1 sm:max-w-[420px]">
        {children}
        {error ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Zoho-style New Payment (Payments Made) — vendor-first form with unpaid bills table.
 */
export default function RecordSupplierPaymentForm() {
  const navigate = useNavigate();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const currency =
    activeBusiness?.currency ||
    activeBusiness?.currency_code ||
    activeBusiness?.base_currency ||
    "NGN";

  const [showBanner, setShowBanner] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(moment().format("YYYY-MM-DD"));
  const [paymentNumber, setPaymentNumber] = useState("");
  const [reference, setReference] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("cash");
  const [chequeNumber, setChequeNumber] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [notes, setNotes] = useState("");
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const isSubmittingRef = useRef(false);
  const skipAutoAllocateRef = useRef(false);
  const manualAllocationRef = useRef(false);
  const cashTypeaheadRef = useRef();

  const {
    accountHead,
    setAccountHead,
    bankAccount,
    setBankAccount,
    accountList,
    headList,
  } = useAdvancePaymentAccounts(true, facilityId, modeOfPayment);

  const userBranchIds = useMemo(() => {
    if (Array.isArray(user?.branchIds) && user.branchIds.length > 0) {
      return user.branchIds.map(Number).filter(Boolean);
    }
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((b) => Number(b.id || b.branch_id))
        .filter(Boolean);
    }
    if (user?.branchId) return [Number(user.branchId)];
    return [];
  }, [user?.branchIds, user?.branches, user?.branchId]);

  const visibleBranches = useMemo(() => {
    if (!branches.length) return [];
    if (!userBranchIds.length) return branches;
    const filtered = branches.filter((b) =>
      userBranchIds.includes(Number(b.id)),
    );
    return filtered.length ? filtered : branches;
  }, [branches, userBranchIds]);

  const generatePaymentNumber = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/get-and-update/sup_dep/${facilityId}`,
      (resp) => {
        if (resp?.success) {
          const n = `${resp.results}`.padStart(5, "0");
          setPaymentNumber(`PV-${n}`);
        }
      },
      () => setPaymentNumber(`PV-${Date.now().toString().slice(-5)}`),
    );
  }, [facilityId]);

  useEffect(() => {
    generatePaymentNumber();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  useEffect(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/get/branches?facilityId=${facilityId}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err),
    );
  }, [facilityId]);

  useEffect(() => {
    if (!visibleBranches.length) return;
    setSelectedBranch((prev) => {
      if (prev && visibleBranches.some((b) => String(b.id) === String(prev))) {
        return prev;
      }
      return String(visibleBranches[0].id);
    });
  }, [visibleBranches]);

  const fetchOutstanding = useCallback(
    (supplierNo) => {
      if (!supplierNo || !facilityId) {
        setOutstandingInvoices([]);
        return;
      }
      setLoadingInvoices(true);
      _fetchApi(
        `/api/v1/get-outstanding-supplier-invoices?supplierNo=${encodeURIComponent(
          supplierNo,
        )}&facilityId=${encodeURIComponent(facilityId)}`,
        (response) => {
          setLoadingInvoices(false);
          const invoices = Array.isArray(response?.results)
            ? response.results
            : [];
          invoices.sort((a, b) => {
            const dateA = new Date(
              a.transaction_date || a.created_at || a.invoice_date || 0,
            );
            const dateB = new Date(
              b.transaction_date || b.created_at || b.invoice_date || 0,
            );
            return dateA - dateB;
          });
          setOutstandingInvoices(invoices);
          setInvoicePayments({});
        },
        () => {
          setLoadingInvoices(false);
          setOutstandingInvoices([]);
          toast.error("Failed to load unpaid bills");
        },
      );
    },
    [facilityId],
  );

  const handleSupplierChange = (supplier) => {
    if (!supplier || !supplier.supplier_number) {
      setSelectedSupplier(null);
      setOutstandingInvoices([]);
      setInvoicePayments({});
      manualAllocationRef.current = false;
      setErrors((prev) => ({ ...prev, supplier: undefined }));
      return;
    }
    setSelectedSupplier(supplier);
    manualAllocationRef.current = false;
    setErrors((prev) => ({ ...prev, supplier: undefined }));
    fetchOutstanding(supplier.supplier_number);
  };

  const allocateFromPaid = useCallback(
    (totalStr) => {
      if (outstandingInvoices.length === 0) return;
      const total = parseFloat(parseNumberFromFormatted(totalStr)) || 0;
      if (total <= 0) {
        setInvoicePayments({});
        return;
      }
      let remaining = total;
      const next = {};
      for (const inv of outstandingInvoices) {
        const k = invoiceRowKey(inv);
        const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
        const pay = Math.min(Math.max(0, due), Math.max(0, remaining));
        next[k] = pay > 0 ? formatNumberWithCommas(String(pay.toFixed(2))) : "";
        remaining -= pay;
      }
      setInvoicePayments(next);
    },
    [outstandingInvoices],
  );

  useEffect(() => {
    if (outstandingInvoices.length === 0) return;
    if (skipAutoAllocateRef.current) {
      skipAutoAllocateRef.current = false;
      return;
    }
    if (manualAllocationRef.current) return;
    allocateFromPaid(amountPaid);
  }, [amountPaid, outstandingInvoices, allocateFromPaid]);

  const allocatedSum = useMemo(() => {
    let sum = 0;
    for (const inv of outstandingInvoices) {
      const k = invoiceRowKey(inv);
      sum +=
        parseFloat(parseNumberFromFormatted(invoicePayments[k] || "")) || 0;
    }
    return sum;
  }, [invoicePayments, outstandingInvoices]);

  const paidNum = parseFloat(parseNumberFromFormatted(amountPaid)) || 0;
  const excess = Math.max(0, +(paidNum - allocatedSum).toFixed(2));

  const syncAmountPaidUp = useCallback(
    (nextAllocated) => {
      const paid = parseFloat(parseNumberFromFormatted(amountPaid)) || 0;
      if (nextAllocated > paid + 0.001) {
        skipAutoAllocateRef.current = true;
        setAmountPaid(formatNumberWithCommas(nextAllocated.toFixed(2)));
      }
    },
    [amountPaid],
  );

  const clearApplied = () => {
    manualAllocationRef.current = true;
    setInvoicePayments({});
  };

  const setInvoicePayment = (inv, raw) => {
    manualAllocationRef.current = true;
    const k = invoiceRowKey(inv);
    const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
    const formatted = formatNumberWithCommas(raw);
    const num = parseFloat(parseNumberFromFormatted(formatted)) || 0;
    const capped =
      num > due ? formatNumberWithCommas(due.toFixed(2)) : formatted;
    setInvoicePayments((prev) => {
      const next = { ...prev, [k]: capped };
      let sum = 0;
      for (const row of outstandingInvoices) {
        const key = invoiceRowKey(row);
        sum += parseFloat(parseNumberFromFormatted(next[key] || "")) || 0;
      }
      syncAmountPaidUp(sum);
      return next;
    });
  };

  const applyFull = (inv) => {
    manualAllocationRef.current = true;
    const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
    const k = invoiceRowKey(inv);
    setInvoicePayments((prev) => {
      const next = {
        ...prev,
        [k]: due > 0 ? formatNumberWithCommas(due.toFixed(2)) : "",
      };
      let sum = 0;
      for (const row of outstandingInvoices) {
        const key = invoiceRowKey(row);
        sum += parseFloat(parseNumberFromFormatted(next[key] || "")) || 0;
      }
      syncAmountPaidUp(sum);
      return next;
    });
  };

  const handleAmountPaidChange = (raw) => {
    manualAllocationRef.current = false;
    setAmountPaid(formatNumberWithCommas(raw));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!selectedSupplier?.supplier_number) {
      next.supplier = "Vendor is required";
    }
    const amt = parseFloat(parseNumberFromFormatted(amountPaid)) || 0;
    if (amt <= 0) next.amount = "Payment amount is required";
    if (!paymentDate) next.date = "Payment date is required";
    else {
      const dateErr = validatePostingDateClient(paymentDate, {
        field: "Payment date",
      });
      if (dateErr) next.date = dateErr;
    }
    if (!modeOfPayment) next.mode = "Payment mode is required";
    if (modeOfPayment === "cash" && !accountHead?.head) {
      next.paidThrough = "Paid Through is required";
    }
    if (["bank", "cheque"].includes(modeOfPayment) && !bankAccount?.id) {
      next.paidThrough = "Paid Through is required";
    }
    if (modeOfPayment === "cheque" && !String(chequeNumber || "").trim()) {
      next.cheque = "Cheque number is required";
    }
    if (
      activeBusiness?.payable_code === "" ||
      activeBusiness?.payable_code === null ||
      activeBusiness?.payable_code === undefined
    ) {
      toast.error("Payable code is not set for this business");
      return false;
    }
    if (
      activeBusiness?.payable_accural_code === "" ||
      activeBusiness?.payable_accural_code === null ||
      activeBusiness?.payable_accural_code === undefined
    ) {
      toast.error("Payable accrual / advance code is not set for this business");
      return false;
    }
    if (allocatedSum > amt + 0.01) {
      toast.error(
        `Applied payments (${formatNumber1(allocatedSum)}) cannot exceed amount paid (${formatNumber1(amt)})`,
      );
      return false;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (isSubmittingRef.current || saving) return;
    if (!validate()) {
      toast.error("Please fix the form errors before saving");
      return;
    }

    const amountPaidNum = parseFloat(parseNumberFromFormatted(amountPaid)) || 0;
    const invoicesPayload = outstandingInvoices
      .map((invoice) => {
        const k = invoiceRowKey(invoice);
        const paymentAmount =
          parseFloat(parseNumberFromFormatted(invoicePayments[k] || "")) || 0;
        if (paymentAmount <= 0) return null;
        return {
          invoice_ref: invoice.invoice_ref,
          amount_paid: paymentAmount,
        };
      })
      .filter(Boolean);

    const notesParts = [String(reference || "").trim()];
    if (paymentNumber) notesParts.push(`Payment #: ${paymentNumber}`);
    if (String(notes || "").trim()) notesParts.push(String(notes).trim());
    const baseDesc =
      notesParts.filter(Boolean).join(" · ") ||
      `Vendor payment${paymentNumber ? ` ${paymentNumber}` : ""}`;
    const narration =
      modeOfPayment === "cheque" && String(chequeNumber || "").trim()
        ? `${baseDesc} [Cheque: ${String(chequeNumber).trim()}]`
        : baseDesc;

    isSubmittingRef.current = true;
    setSaving(true);

    const basePayload = {
      transaction_date: paymentDate,
      amount_paid: amountPaidNum,
      supplier_number: selectedSupplier.supplier_number,
      facilityId,
      userId: user?.id || user?.user_id || "",
      narration,
      payable_code: activeBusiness.payable_code,
      payable_accural_code: activeBusiness.payable_accural_code,
      mode_of_payment: modeOfPayment,
      line_of_business: "General",
      bank_account_id: bankAccount?.id || accountHead?.head,
      branchId:
        selectedBranch && selectedBranch !== "all"
          ? parseInt(selectedBranch, 10) || null
          : null,
    };
    if (modeOfPayment === "cash" && accountHead?.head) {
      basePayload.accountHead = {
        head: accountHead.head,
        description: accountHead.description,
      };
    }
    if (["bank", "cheque"].includes(modeOfPayment) && bankAccount?.id) {
      basePayload.bankAccount = { id: bankAccount.id };
    }

    const payload =
      invoicesPayload.length > 0
        ? { ...basePayload, invoices: invoicesPayload }
        : { ...basePayload, allocation_order: "fifo" };

    _postApi(
      "/api/v1/supplier-advance-payment",
      payload,
      (res) => {
        setSaving(false);
        isSubmittingRef.current = false;
        if (res?.error) {
          toast.error(String(res.error));
          return;
        }
        if (res?.success) {
          const referenceNumber =
            res.data?.reference_number ||
            res.data?.transaction_ref ||
            res.results?.reference_number ||
            "";
          toast.success(
            referenceNumber
              ? `Payment recorded (${referenceNumber})`
              : "Payment recorded",
          );
          navigate("/app/payments/pay-bills", { replace: true });
        } else {
          toast.error(res?.message || "Failed to save payment");
        }
      },
      (error) => {
        setSaving(false);
        isSubmittingRef.current = false;
        toast.error(
          error?.error || error?.message || "Failed to save payment",
        );
      },
    );
  };

  const goBack = () => navigate("/app/payments/pay-bills");

  const supplierChipLabel = useMemo(() => {
    if (!selectedSupplier) return "";
    const name = (
      selectedSupplier.supplier_name ||
      selectedSupplier.name ||
      ""
    ).toUpperCase();
    return name.length > 18 ? `${name.slice(0, 18)}…` : name;
  }, [selectedSupplier]);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-8xl">
        <div className="mb-1.5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            New Payment
          </h1>
          <button
            type="button"
            onClick={goBack}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showBanner && (
          <div className="mb-3 flex items-start gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="flex-1">
              Apply this payment directly to unpaid bills below. Any amount in
              excess is kept as a vendor advance / credit.
            </p>
            <button
              type="button"
              onClick={() => setShowBanner(false)}
              className="text-blue-400 hover:text-blue-600"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row">
          <div className="w-full flex-1">
            <Row label="Vendor Name" required error={errors.supplier}>
              <SearchSupplierInput
                onChange={handleSupplierChange}
                disabled={saving}
              />
            </Row>
          </div>
          {selectedSupplier && (
            <div className="shrink-0 rounded bg-slate-800 px-4 py-2 text-xs font-semibold text-white">
              {supplierChipLabel}
              <span className="ml-1.5">›</span>
            </div>
          )}
        </div>

        <Row label="Payment Made" required error={errors.amount}>
          <div className="flex overflow-hidden rounded border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <span className="flex items-center border-r border-gray-300 bg-gray-50 px-3 text-sm font-medium text-gray-600">
              {currency}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amountPaid}
              onChange={(e) => handleAmountPaidChange(e.target.value)}
              disabled={saving}
              placeholder="0.00"
              className="w-full border-0 px-3 py-1.5 text-sm outline-none"
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Apply to bills below, or leave payments at 0 to record the full
            amount as vendor advance. Any Amount in Excess also becomes advance.
          </p>
        </Row>

        <Row label="Payment Date" required error={errors.date}>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={paymentDate}
              min={POSTING_DATE_MIN}
              max={getPostingDateMax()}
              onChange={(e) => {
                setPaymentDate(e.target.value);
                setErrors((prev) => ({ ...prev, date: undefined }));
              }}
              disabled={saving}
              className={`${inputClass} pl-9 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:opacity-0`}
            />
          </div>
        </Row>

        <Row label="Payment #" required>
          <div className="flex gap-2">
            <input
              type="text"
              value={paymentNumber}
              onChange={(e) => setPaymentNumber(e.target.value)}
              disabled={saving}
              className={inputClass}
            />
            <button
              type="button"
              onClick={generatePaymentNumber}
              disabled={saving}
              title="Generate new number"
              className="flex shrink-0 items-center justify-center rounded border border-gray-300 bg-white px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </Row>

        <Row label="Payment Mode" error={errors.mode}>
          <select
            value={modeOfPayment}
            onChange={(e) => {
              setModeOfPayment(e.target.value);
              setAccountHead({});
              setBankAccount(null);
              setChequeNumber("");
              setErrors((prev) => ({
                ...prev,
                mode: undefined,
                paidThrough: undefined,
                cheque: undefined,
              }));
            }}
            disabled={saving}
            className={inputClass}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank Transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </Row>

        <Row label="Paid Through" required error={errors.paidThrough}>
          {modeOfPayment === "cash" ? (
            <Typeahead
              ref={cashTypeaheadRef}
              id="supplier-payment-cash-head"
              labelKey={(option) =>
                `${option.head || ""} ${option.description || ""}`.trim()
              }
              options={headList}
              placeholder="Select an account…"
              disabled={saving}
              onChange={(selectedItems) => {
                if (selectedItems?.length) {
                  const cash = selectedItems[0];
                  setAccountHead({
                    head: cash.head || "",
                    description: cash.description || "",
                  });
                } else {
                  setAccountHead({});
                }
                setErrors((prev) => ({ ...prev, paidThrough: undefined }));
              }}
              selected={
                accountHead?.head
                  ? headList.filter((c) => c.head === accountHead.head)
                  : []
              }
              clearButton
              inputProps={{
                style: {
                  height: "2.125rem",
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.875rem",
                  border: "1px solid rgb(209 213 219)",
                  borderRadius: "0.25rem",
                },
              }}
            />
          ) : (
            <select
              value={bankAccount?.id?.toString() || ""}
              onChange={(e) => {
                const acc = accountList.find(
                  (a) => String(a.id) === e.target.value,
                );
                setBankAccount(acc || null);
                setErrors((prev) => ({ ...prev, paidThrough: undefined }));
              }}
              disabled={saving}
              className={inputClass}
            >
              <option value="">Select an account…</option>
              {accountList.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name}
                  {account.account_number
                    ? ` (${account.account_number})`
                    : ""}
                </option>
              ))}
            </select>
          )}
        </Row>

        {modeOfPayment === "cheque" ? (
          <Row label="Cheque Number" required error={errors.cheque}>
            <input
              type="text"
              value={chequeNumber}
              onChange={(e) => {
                setChequeNumber(e.target.value);
                setErrors((prev) => ({ ...prev, cheque: undefined }));
              }}
              disabled={saving}
              className={inputClass}
            />
          </Row>
        ) : null}

        {visibleBranches.length > 1 && (
          <Row label="Warehouse">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={saving}
              className={inputClass}
            >
              {visibleBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
          </Row>
        )}

        <Row label="Reference#">
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={saving}
            className={inputClass}
          />
        </Row>

        <div className="my-4 border-t border-gray-200" />

        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Unpaid Bills
          </h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-1 text-sm text-gray-400"
            >
              Filter by Date Range
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={clearApplied}
              disabled={saving || allocatedSum <= 0}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
            >
              Clear Applied Amount
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          {!selectedSupplier ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              There are no bills for this vendor.
            </div>
          ) : loadingInvoices ? (
            <div className="space-y-2 p-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : outstandingInvoices.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              There are no bills for this vendor.
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Bill#</th>
                  <th className="px-3 py-2 text-right">Bill Amount</th>
                  <th className="px-3 py-2 text-right">Amount Due</th>
                  <th className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      Payment
                      <Info
                        className="h-3 w-3 text-slate-400"
                        title="Amount of this payment applied to the bill"
                      />
                    </span>
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {outstandingInvoices.map((inv) => {
                  const k = invoiceRowKey(inv);
                  return (
                    <tr key={k} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-gray-700">
                        {inv.transaction_date
                          ? moment(inv.transaction_date).format("DD MMM YYYY")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 font-medium text-blue-600">
                        {inv.invoice_ref}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-800">
                        {formatNumber1(inv.amount || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {formatNumber1(inv.amount_due ?? inv.balance_due ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={invoicePayments[k] || ""}
                          onChange={(e) =>
                            setInvoicePayment(inv, e.target.value)
                          }
                          disabled={saving}
                          placeholder="0.00"
                          className="ml-auto w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => applyFull(inv)}
                          disabled={saving}
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
                <tr className="border-t bg-gray-50">
                  <td
                    colSpan={4}
                    className="px-3 py-2 text-xs italic text-gray-500"
                  >
                    *List contains only unpaid bills
                  </td>
                  <td
                    colSpan={2}
                    className="px-3 py-2 text-right text-sm font-semibold text-gray-900"
                  >
                    Total {formatNumber1(allocatedSum)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div
          className={`my-4 w-full rounded border px-3 py-3 ${
            excess > 0
              ? "border-red-200 bg-red-50/60"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:divide-x sm:divide-gray-200">
            <div className="flex min-w-0 flex-col gap-1 px-2">
              <span className="text-[12px] text-gray-600">Amount Paid :</span>
              <div className="flex overflow-hidden rounded border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                <span className="flex items-center border-r border-gray-200 bg-gray-50 px-2 text-xs font-medium text-gray-600">
                  {currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={(e) => handleAmountPaidChange(e.target.value)}
                  disabled={saving}
                  placeholder="0.00"
                  className="w-full min-w-0 border-0 px-2 py-1.5 text-right text-sm font-semibold tabular-nums outline-none"
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1 px-2">
              <span className="text-[12px] text-gray-600">
                Amount used for Payments :
              </span>
              <span className="py-1.5 text-right text-sm font-semibold tabular-nums text-gray-900 sm:text-left">
                {formatNumber1(allocatedSum)}
              </span>
            </div>

            <div
              className={`flex min-w-0 flex-col gap-1 rounded px-2 ${
                excess > 0 ? "bg-red-100/70" : ""
              }`}
            >
              <span
                className={`text-[12px] ${
                  excess > 0 ? "font-semibold text-red-600" : "text-gray-600"
                }`}
              >
                Amount in Excess :
              </span>
              <span
                className={`py-1.5 text-right text-sm font-semibold tabular-nums sm:text-left ${
                  excess > 0 ? "text-red-600" : "text-gray-900"
                }`}
              >
                {excess > 0 ? "⚠ " : ""}
                {currency} {formatNumber1(excess)}
              </span>
            </div>
          </div>
          {excess > 0 ? (
            <p className="mt-2 px-2 text-[11px] font-medium text-red-600">
              Excess {currency} {formatNumber1(excess)} will be kept as vendor
              advance / credit.
            </p>
          ) : null}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <div className="min-w-0">
            <label className="mb-1 block text-[13px] text-gray-700">
              Notes (Internal use. Not visible to vendor)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={3}
              className="w-full resize-y rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[13px] text-gray-700">
              Attachments
            </label>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-3.5 py-1.5 text-sm text-gray-400"
            >
              <Upload className="h-4 w-4" />
              Upload File
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <p className="mt-1 text-xs text-gray-500">
              You can upload a maximum of 5 files, 5MB each
            </p>
          </div>
        </div>

        <div className="my-4 border-t border-gray-200" />

        <div className="flex flex-wrap items-center gap-3 pb-4">
          <Button
            type="button"
            variant="outline"
            disabled
            title="Draft saving isn't available yet"
          >
            Save as Draft
          </Button>
          <CustomButton
            className="!mb-0"
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            Save as Paid
          </CustomButton>
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
