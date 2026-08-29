import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import moment from "moment";
import { Loader2, X, History, Receipt, Plus, Printer } from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import { POSTING_DATE_MIN, getPostingDateMax, validatePostingDateClient } from "@/utilities";
import { useAdvancePaymentAccounts } from "@/components/common/useAdvancePaymentAccounts";
import AdvancePaymentPaymentFields from "@/components/common/AdvancePaymentPaymentFields";

function parseNumberFromFormatted(value) {
  if (value === "" || value === null || value === undefined) return "";
  return String(value).replace(/,/g, "");
}

/** Allow typing naturally; strip non-numeric except one decimal point. */
function sanitizeAmountInput(raw) {
  const s = String(raw || "").replace(/,/g, "");
  if (s === "") return "";
  const cleaned = s.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
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
    return dec !== ""
      ? `${formattedInt}.${dec}`
      : `${formattedInt}.`;
  }
  return formattedInt;
}

function modeForCustomerDeposit(uiMode) {
  const m = String(uiMode || "").toLowerCase();
  if (m === "cash") return "cash";
  if (m === "bank") return "bank transfer";
  if (m === "cheque") return "cheque";
  return "cash";
}

function validatePaymentSource(
  modeOfPayment,
  accountHead,
  bankAccount,
  chequeNumber
) {
  if (modeOfPayment === "cash") {
    if (!accountHead?.head) {
      toast.error("Please select an account head for cash payment");
      return false;
    }
  } else if (["bank", "cheque"].includes(modeOfPayment)) {
    if (!bankAccount?.id) {
      toast.error("Please select a bank account");
      return false;
    }
  }
  if (modeOfPayment === "cheque" && !String(chequeNumber || "").trim()) {
    toast.error("Please enter cheque number");
    return false;
  }
  return true;
}

function invoiceRowKey(inv) {
  return String(inv.invoice_id ?? inv.invoice_ref ?? "");
}

/** Keep raw string for typing; cap numeric value at balance due when it exceeds. */
function capPaymentAtBalanceDue(raw, balanceDue) {
  const due = Math.max(0, parseFloat(balanceDue) || 0);
  if (raw === "" || raw === null || raw === undefined) return "";
  const s = String(raw).replace(/,/g, "");
  if (s === "" || s === ".") return raw;
  const num = parseFloat(s);
  if (Number.isNaN(num)) return raw;
  if (num <= due + 1e-9) return raw;
  return due > 0 ? String(due) : "";
}

/**
 * Customer deposit / prepayment drawer.
 * Lists outstanding invoices with manual payment per line; POSTs to
 * POST /api/v1/customer-advance-payment (with or without invoice lines; server FIFO when empty).
 */
export default function CustomerAdvancePaymentModal({
  open,
  onClose,
  onSuccess,
  party,
  customersList = null,
}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [modeOfPayment, setModeOfPayment] = useState("cash");
  const [narration, setNarration] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAccounting, setShowAccounting] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [advanceHistory, setAdvanceHistory] = useState([]);
  const [loadingAdvanceHistory, setLoadingAdvanceHistory] = useState(false);
  const [availableDeposit, setAvailableDeposit] = useState(0);
  const [activeTab, setActiveTab] = useState("payment");
  const [lastReceipt, setLastReceipt] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  /** keyed by invoiceRowKey(inv) → formatted payment string */
  const [invoicePayments, setInvoicePayments] = useState({});

  const {
    accountHead,
    setAccountHead,
    bankAccount,
    setBankAccount,
    accountList,
    headList,
  } = useAdvancePaymentAccounts(open, activeBusiness?.id, modeOfPayment);

  const reset = useCallback(() => {
    setAmount("");
    setInvoicePayments({});
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setModeOfPayment("cash");
    setNarration("");
    setChequeNumber("");
    setAdvanceHistory([]);
    setAvailableDeposit(0);
    setActiveTab("payment");
    setLastReceipt(null);
    setSelectedReceipt(null);
    setShowAccounting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setSelectedCustomer(party || null);
  }, [open, party, reset]);

  useEffect(() => {
    if (modeOfPayment !== "cheque") setChequeNumber("");
  }, [modeOfPayment]);

  const customerNoForQuery =
    selectedCustomer?.customerNo || party?.customerNo || null;

  const loadAdvanceHistory = useCallback(() => {
    if (!activeBusiness?.id || !customerNoForQuery) {
      setAdvanceHistory([]);
      setAvailableDeposit(0);
      return;
    }
    setLoadingAdvanceHistory(true);
    _fetchApi(
      `/api/v1/get-customer-advance-history?customerNo=${encodeURIComponent(
        customerNoForQuery,
      )}&facilityId=${encodeURIComponent(activeBusiness.id)}&limit=25`,
      (response) => {
        setLoadingAdvanceHistory(false);
        if (response?.success) {
          setAdvanceHistory(
            Array.isArray(response.results) ? response.results : [],
          );
          setAvailableDeposit(parseFloat(response.available_deposit) || 0);
        } else {
          setAdvanceHistory([]);
          setAvailableDeposit(0);
        }
      },
      () => {
        setLoadingAdvanceHistory(false);
        setAdvanceHistory([]);
        setAvailableDeposit(0);
      },
    );
  }, [activeBusiness?.id, customerNoForQuery]);

  useEffect(() => {
    if (!open) return;
    loadAdvanceHistory();
  }, [open, loadAdvanceHistory]);

  useEffect(() => {
    if (!open || !activeBusiness?.id || !customerNoForQuery) {
      setOutstandingInvoices([]);
      return;
    }

    setLoadingInvoices(true);
    _fetchApi(
      `/api/v1/get-outstanding-invoices?customerNo=${encodeURIComponent(
        customerNoForQuery,
      )}&facilityId=${encodeURIComponent(activeBusiness.id)}&userId=${encodeURIComponent(
        user?.id || user?.user_id || "",
      )}`,
      (response) => {
        setLoadingInvoices(false);
        if (response?.success && Array.isArray(response.results)) {
          const rows = [...response.results];
          // Oldest first — matches FIFO allocation on save
          rows.sort(
            (a, b) =>
              new Date(a.transaction_date || 0) -
              new Date(b.transaction_date || 0),
          );
          setOutstandingInvoices(rows);
        } else {
          setOutstandingInvoices([]);
        }
      },
      () => {
        setLoadingInvoices(false);
        setOutstandingInvoices([]);
      },
    );
  }, [open, activeBusiness?.id, customerNoForQuery, user?.id, user?.user_id]);

  useEffect(() => {
    setInvoicePayments({});
  }, [customerNoForQuery]);

  const totalOutstanding = useMemo(
    () =>
      outstandingInvoices.reduce(
        (sum, inv) =>
          sum + parseFloat(inv.amount_due ?? inv.balance_due ?? 0),
        0,
      ),
    [outstandingInvoices],
  );

  const allocatedSum = useMemo(() => {
    let sum = 0;
    for (const inv of outstandingInvoices) {
      const k = invoiceRowKey(inv);
      sum +=
        parseFloat(parseNumberFromFormatted(invoicePayments[k] || "")) || 0;
    }
    return sum;
  }, [invoicePayments, outstandingInvoices]);

  /**
   * Split total across invoice lines (oldest first, up to each balance due) whenever
   * the total or invoice list changes.
   */
  useEffect(() => {
    if (outstandingInvoices.length === 0) return;
    const total = parseFloat(parseNumberFromFormatted(amount || "")) || 0;
    if (total <= 0) {
      setInvoicePayments({});
      return;
    }
    let remaining = total;
    const next = {};
    for (const inv of outstandingInvoices) {
      const k = invoiceRowKey(inv);
      const due =
        parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
      const pay = Math.min(Math.max(0, due), Math.max(0, remaining));
      next[k] = pay > 0 ? formatNumberWithCommas(String(pay)) : "";
      remaining -= pay;
    }
    setInvoicePayments(next);
  }, [amount, outstandingInvoices]);

  const remainderToDeposit = useMemo(() => {
    const t = parseFloat(parseNumberFromFormatted(amount || "")) || 0;
    return Math.max(0, t - allocatedSum);
  }, [amount, allocatedSum]);

  /** Minimum that must be applied to invoice lines: all of the receipt up to total balance due (cannot save with unused “gap” on invoices). */
  const minRequiredInvoiceAllocation = useMemo(() => {
    if (outstandingInvoices.length === 0 || totalOutstanding <= 0.000001) return 0;
    const t = parseFloat(parseNumberFromFormatted(amount || "")) || 0;
    if (t <= 0) return 0;
    return Math.min(t, totalOutstanding);
  }, [amount, outstandingInvoices.length, totalOutstanding]);

  const allocationBlocksSubmit = useMemo(() => {
    if (minRequiredInvoiceAllocation <= 0) return false;
    return allocatedSum + 0.02 < minRequiredInvoiceAllocation;
  }, [allocatedSum, minRequiredInvoiceAllocation]);

  const showCustomerPicker =
    Array.isArray(customersList) && customersList.length > 0;

  const displayName =
    selectedCustomer?.fullname ||
    selectedCustomer?.customerNo ||
    party?.fullname ||
    party?.customerNo;

  const customerTypeaheadSelected = useMemo(() => {
    if (!selectedCustomer?.customerNo) return [];
    const match = customersList?.find(
      (c) => c.customerNo === selectedCustomer.customerNo
    );
    return match ? [match] : [selectedCustomer];
  }, [selectedCustomer, customersList]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(parseNumberFromFormatted(amount));
    if (!activeBusiness?.id) {
      toast.error("Missing facility");
      return;
    }

    const customerParty = selectedCustomer || party;
    if (!customerParty?.customerNo) {
      toast.error("Select a customer");
      return;
    }
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount greater than zero");
      return;
    }
    if (!validatePaymentSource(
      modeOfPayment,
      accountHead,
      bankAccount,
      chequeNumber
    )) {
      return;
    }

    const paymentDateErr = validatePostingDateClient(paymentDate, {
      field: "Payment date",
    });
    if (paymentDateErr) {
      toast.error(paymentDateErr);
      return;
    }

    if (
      activeBusiness?.receivable_code === "" ||
      activeBusiness?.receivable_code === null ||
      activeBusiness?.receivable_code === undefined
    ) {
      toast.error("Receivable code is not set for this business");
      return;
    }
    if (
      activeBusiness?.receivable_accural_code === "" ||
      activeBusiness?.receivable_accural_code === null ||
      activeBusiness?.receivable_accural_code === undefined
    ) {
      toast.error("Receivable accrual / deposit code is not set for this business");
      return;
    }

    const invoicesPayload = [];
    for (const inv of outstandingInvoices) {
      const k = invoiceRowKey(inv);
      const pay =
        parseFloat(parseNumberFromFormatted(invoicePayments[k] || "")) || 0;
      if (pay <= 0) continue;
      const due = parseFloat(inv.amount_due ?? inv.balance_due ?? 0) || 0;
      if (pay > due + 0.01) {
        toast.error(
          `Payment for ${inv.invoice_ref || "invoice"} cannot exceed balance due (₦${formatNumber1(due)}).`,
        );
        return;
      }
      invoicesPayload.push({
        invoice_ref: inv.invoice_ref,
        amount_paid: pay,
      });
    }

    const sumAlloc = invoicesPayload.reduce((s, x) => s + x.amount_paid, 0);
    if (sumAlloc > amt + 0.01) {
      toast.error(
        "Sum of invoice payments cannot exceed the total payment amount. Increase the total or reduce per-invoice payments.",
      );
      return;
    }

    if (outstandingInvoices.length > 0 && totalOutstanding > 0.000001) {
      const required = Math.min(amt, totalOutstanding);
      if (sumAlloc + 0.02 < required) {
        toast.error(
          `Apply the full payment to outstanding invoices (up to each balance due) before saving. Required on invoices: at least ₦${formatNumber1(required)}; currently ₦${formatNumber1(sumAlloc)}.`,
        );
        return;
      }
    }

    setSubmitting(true);

    const customerNo = customerParty.customerNo;
    const mode = modeForCustomerDeposit(modeOfPayment);
    const baseDesc = narration.trim() || "Customer advance payment";
    const description =
      modeOfPayment === "cheque" && String(chequeNumber || "").trim()
        ? `${baseDesc} [Cheque: ${String(chequeNumber).trim()}]`
        : baseDesc;

    const basePayload = {
      transaction_date: paymentDate,
      amount_paid: amt,
      customer_no: customerNo,
      mode_of_payment: mode,
      cheque_number: chequeNumber || undefined,
      facilityId: activeBusiness.id,
      userId: user?.id || user?.user_id || "",
      narration: description,
      receivable_deposit_code: activeBusiness.receivable_accural_code,
      receivable_code: activeBusiness.receivable_code,
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

    const url = "/api/v1/customer-advance-payment";
    const payload =
      invoicesPayload.length > 0
        ? { ...basePayload, invoices: invoicesPayload }
        : { ...basePayload, allocation_order: "fifo" };

    const onDone = (resp) => {
      setSubmitting(false);
      if (resp?.error) {
        toast.error(String(resp.error));
        return;
      }
      if (resp?.success) {
        const ref =
          resp.data?.reference_number ||
          resp.data?.transaction_ref ||
          resp.results?.reference_number ||
          "";
        toast.success(
          ref ? `Deposit recorded (${ref})` : "Deposit recorded",
        );
        setLastReceipt({
          ref,
          date: paymentDate,
          amount: amt,
          customer: selectedCustomer || party,
          mode: modeOfPayment,
          narration: narration.trim() || "Customer deposit payment",
          chequeNumber: modeOfPayment === "cheque" ? chequeNumber : "",
          invoices: invoicesPayload,
        });
        setActiveTab("receipt");
        setSelectedReceipt(null);
        loadAdvanceHistory();
        onSuccess?.();
      } else {
        toast.error(
          resp?.message ||
            resp?.err?.message ||
            "Could not record payment",
        );
      }
    };

    const onFail = (err) => {
      setSubmitting(false);
      console.error(err);
      toast.error(
        err?.error || err?.message || "Could not record advance payment",
      );
    };

    _postApi(url, payload, onDone, onFail);
  };

  if (!party && (!customersList || customersList.length === 0)) {
    return null;
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DrawerContent
        side="right"
        className="bg-white border-gray-200 flex flex-col sm:max-w-2xl"
      >
        <DrawerHeader className="border-b border-gray-200 shrink-0 pb-0">
          <div className="flex items-start justify-between gap-3 pb-4">
            <div className="min-w-0 text-left">
              <DrawerTitle className="text-gray-900 text-xl">
                Make Deposit
              </DrawerTitle>
              <DrawerDescription className="text-gray-600 mt-1">
                Record a customer deposit or prepayment
              </DrawerDescription>
              {displayName ? (
                <p className="text-sm text-gray-700 mt-2 font-medium truncate">
                  Customer: {displayName}
                </p>
              ) : null}
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5 text-gray-500" />
              </Button>
            </DrawerClose>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 -mx-4 px-4 gap-1">
            {[
              { id: "payment", label: "Make Deposit", icon: <Plus size={14} /> },
              { id: "history", label: "History",     icon: <History size={14} /> },
              { id: "receipt", label: "Receipt",     icon: <Receipt size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setSelectedReceipt(null); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-[#2C5CC5] text-[#2C5CC5]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "receipt" && (lastReceipt || advanceHistory.length > 0) && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-green-500 inline-block" />
                )}
              </button>
            ))}
          </div>
        </DrawerHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-6 py-4 space-y-5 flex-1 overflow-y-auto">

            {/* ── History Tab ── */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {availableDeposit > 0 && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-blue-800 font-medium">Available deposit balance</p>
                    <p className="text-sm font-bold text-blue-900 tabular-nums">₦{formatNumber1(availableDeposit)}</p>
                  </div>
                )}
                {loadingAdvanceHistory ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                  </div>
                ) : advanceHistory.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    <History size={32} className="mx-auto mb-2 opacity-30" />
                    No deposit or advance records found.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="text-gray-600">
                          <th className="px-3 py-2.5 font-medium">Date</th>
                          <th className="px-3 py-2.5 font-medium">Reference</th>
                          <th className="px-3 py-2.5 font-medium">Description</th>
                          <th className="px-3 py-2.5 font-medium">Type</th>
                          <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {advanceHistory.map((row, i) => {
                          const isReceived = row.direction === "received";
                          return (
                            <tr key={row.entry_id || i} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                                {row.date ? moment(row.date).format("DD MMM YYYY") : "—"}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-gray-900">
                                {row.link_id || row.receipt_no || "—"}
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 max-w-[150px] truncate">
                                {row.description || "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${isReceived ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                                  {isReceived ? "Received" : "Applied"}
                                </span>
                              </td>
                              <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${isReceived ? "text-emerald-800" : "text-amber-900"}`}>
                                {isReceived ? "+" : "−"}₦{formatNumber1(row.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={4} className="px-3 py-2 text-right font-medium text-gray-700 text-xs">
                            Total ({advanceHistory.length} entries)
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900 text-xs">
                            ₦{formatNumber1(advanceHistory.filter(r => r.direction === "received").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Receipt Tab ── */}
            {activeTab === "receipt" && (
              <div className="space-y-3">
                {selectedReceipt ? (
                  <div className="space-y-4">
                    <button type="button" onClick={() => setSelectedReceipt(null)} className="flex items-center gap-1.5 text-xs text-[#2C5CC5] hover:underline print:hidden">
                      ← Back to all receipts
                    </button>
                    <div id="customer-advance-receipt" className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base">Payment Receipt</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Customer Deposit Payment</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs print:hidden" onClick={() => window.print()}>
                          <Printer size={13} /> Print
                        </Button>
                      </div>
                      <div className="border-t border-dashed border-gray-200 pt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Reference No.</p>
                          <p className="font-mono font-semibold text-gray-900">{selectedReceipt.ref || selectedReceipt.receipt_no || selectedReceipt.link_id || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Date</p>
                          <p className="font-medium text-gray-900">{selectedReceipt.date ? moment(selectedReceipt.date).format("DD MMM YYYY") : "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500 mb-0.5">Customer</p>
                          <p className="font-medium text-gray-900">
                            {selectedReceipt.customer?.fullname || selectedReceipt.customer?.customerNo || displayName || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Mode of Payment</p>
                          <p className="font-medium text-gray-900 capitalize">{selectedReceipt.mode || selectedReceipt.mode_of_payment || "—"}</p>
                        </div>
                        {(selectedReceipt.narration || selectedReceipt.description) && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 mb-0.5">Narration</p>
                            <p className="text-gray-700">{selectedReceipt.narration || selectedReceipt.description}</p>
                          </div>
                        )}
                      </div>
                      {selectedReceipt.invoices?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Invoices Applied</p>
                          <div className="rounded-lg border border-gray-100 overflow-hidden">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-3 py-2 font-medium text-gray-600">Invoice Ref</th>
                                  <th className="px-3 py-2 font-medium text-gray-600 text-right">Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedReceipt.invoices.map((inv, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="px-3 py-1.5 text-gray-800 font-mono">{inv.invoice_ref}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-900">₦{formatNumber1(inv.amount_paid)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      <div className="border-t-2 border-gray-900 pt-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">Total Received</p>
                        <p className="text-xl font-bold text-[#2C5CC5] tabular-nums">₦{formatNumber1(selectedReceipt.amount)}</p>
                      </div>
                      <p className="text-center text-[10px] text-gray-400 border-t border-dashed border-gray-200 pt-3">
                        This is a system-generated receipt — no signature required.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {lastReceipt && (
                      <div className="rounded-lg border-2 border-[#2C5CC5] bg-blue-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => setSelectedReceipt(lastReceipt)}>
                        <div>
                          <p className="text-xs text-[#2C5CC5] font-semibold uppercase tracking-wide mb-0.5">Latest receipt</p>
                          <p className="font-mono font-bold text-gray-900 text-sm">{lastReceipt.ref || "—"}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{moment(lastReceipt.date).format("DD MMM YYYY")} · {lastReceipt.mode}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#2C5CC5] tabular-nums">₦{formatNumber1(lastReceipt.amount)}</p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 justify-end"><Printer size={11} /> View / Print</p>
                        </div>
                      </div>
                    )}
                    {advanceHistory.filter(r => r.direction === "received").length === 0 && !lastReceipt ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                        No receipts yet. Record a payment to generate a receipt.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-gray-600">
                              <th className="px-3 py-2.5 font-medium">Date</th>
                              <th className="px-3 py-2.5 font-medium">Receipt No.</th>
                              <th className="px-3 py-2.5 font-medium">Description</th>
                              <th className="px-3 py-2.5 font-medium">Mode</th>
                              <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                              <th className="px-3 py-2.5 font-medium text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {advanceHistory.filter(r => r.direction === "received").map((row, i) => (
                              <tr key={row.entry_id || i} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedReceipt({ ...row, ref: row.link_id || row.receipt_no, date: row.date, amount: row.amount, mode_of_payment: row.mode_of_payment, description: row.description })}>
                                <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{row.date ? moment(row.date).format("DD MMM YYYY") : "—"}</td>
                                <td className="px-3 py-2.5 font-mono text-gray-900">{row.link_id || row.receipt_no || "—"}</td>
                                <td className="px-3 py-2.5 text-gray-600 max-w-[130px] truncate">{row.description || "—"}</td>
                                <td className="px-3 py-2.5 capitalize text-gray-600">{row.mode_of_payment || "—"}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-800">+₦{formatNumber1(row.amount)}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 text-[#2C5CC5] text-[11px]"><Printer size={11} /> Print</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-gray-200">
                              <td colSpan={4} className="px-3 py-2 text-right font-medium text-gray-700 text-xs">
                                Total ({advanceHistory.filter(r => r.direction === "received").length} receipts)
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900 text-xs">
                                ₦{formatNumber1(advanceHistory.filter(r => r.direction === "received").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Payment Tab ── */}
            {activeTab === "payment" && showCustomerPicker && (
              <div className="space-y-2">
                <Label className="text-gray-900 font-medium">Customer *</Label>
                <Typeahead
                  id="customer-advance-payment-customer"
                  options={customersList}
                  placeholder="Search or select customer…"
                  labelKey={(c) =>
                    c
                      ? `${c.fullname || ""} (${c.customerNo || ""})`
                      : ""
                  }
                  selected={customerTypeaheadSelected}
                  onChange={(selected) => {
                    setSelectedCustomer(selected[0] || null);
                  }}
                  renderMenuItemChildren={(option) => (
                    <div className="py-1">
                      <div className="font-semibold text-slate-800">
                        {option.fullname || ""}
                      </div>
                      <small className="text-slate-600 text-xs">
                        Customer ID: {option.customerNo}
                      </small>
                    </div>
                  )}
                  clearButton
                  positionFixed
                  flip
                  className="w-full [&_.rbt-input-main]:rounded-md [&_.rbt-input-main]:border [&_.rbt-input-main]:border-gray-200 [&_.rbt-input-main]:min-h-10 [&_.rbt-input-main]:shadow-sm"
                />
              </div>
            )}

            {activeTab === "payment" && customerNoForQuery ? (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="customer-adv-amount"
                    className="text-gray-900 font-medium"
                  >
                    Total payment received *
                  </Label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-gray-500"
                      aria-hidden
                    >
                      ₦
                    </span>
                    <Input
                      id="customer-adv-amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => {
                        const next = sanitizeAmountInput(e.target.value);
                        setAmount(formatNumberWithCommas(next));
                      }}
                      className="border-gray-200 pl-8 text-right tabular-nums"
                      required
                    />
                  </div>
                  {outstandingInvoices.length > 0 ? (
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>
                        <strong>Total payment received</strong> must be{" "}
                        <strong>greater than or equal to</strong> the sum of the{" "}
                        <strong>Payment</strong> column. The total is split
                        across invoices automatically (oldest first, up to each
                        balance due) when you change it. Each line cannot
                        exceed that invoice&apos;s balance due; reduce line
                        payments or increase the total if allocations exceed
                        what was received.
                      </p>
                      {allocatedSum >
                      (parseFloat(parseNumberFromFormatted(amount || "")) ||
                        0) +
                        0.000001 ? (
                        <p className="text-amber-800 font-medium">
                          Invoice payments (₦{formatNumber1(allocatedSum)})
                          exceed total received (₦
                          {formatNumber1(
                            parseFloat(
                              parseNumberFromFormatted(amount || ""),
                            ) || 0,
                          )}
                          ). Reduce per-invoice amounts or increase the total.
                        </p>
                      ) : null}
                      {remainderToDeposit > 0.000001 ? (
                        <p className="text-gray-700">
                          Allocated from table: ₦{formatNumber1(allocatedSum)} ·
                          Remainder to deposit: ₦
                          {formatNumber1(remainderToDeposit)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Cash collected from the customer for this receipt.
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-gray-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-900 font-medium text-sm">
                    Outstanding invoices
                  </Label>
                  {loadingInvoices ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  ) : null}
                </div>
                <p className="text-xs text-gray-600">
                  Enter how much applies to each invoice (cannot exceed balance
                  due per line). You must allocate the full receipt across these
                  lines up to each balance due (everything up to the lesser of
                  total received and total due) before you can save — no saving
                  while money is left unapplied on invoices.
                </p>
                {loadingInvoices ? (
                  <p className="text-xs text-gray-500">Loading…</p>
                ) : outstandingInvoices.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No outstanding invoices for this customer.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto border-t border-gray-200 pt-2 mt-1 -mx-1">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-gray-600 border-b border-gray-200">
                            <th className="py-1.5 pr-2 font-medium">Invoice</th>
                            <th className="py-1.5 px-1 font-medium text-right whitespace-nowrap">
                              Inv. amount
                            </th>
                            <th className="py-1.5 px-1 font-medium text-right whitespace-nowrap">
                              Balance due
                            </th>
                            <th className="py-1.5 pl-1 font-medium text-right min-w-[7.5rem]">
                              Payment
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {outstandingInvoices.map((inv) => {
                            const k = invoiceRowKey(inv);
                            const invAmt = parseFloat(inv.amount ?? 0) || 0;
                            const due = parseFloat(
                              inv.amount_due ?? inv.balance_due ?? 0,
                            );
                            return (
                              <tr
                                key={k}
                                className="border-b border-gray-100 align-top"
                              >
                                <td className="py-2 pr-2">
                                  <div className="font-semibold text-gray-900">
                                    {inv.invoice_ref || "—"}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    {inv.transaction_date
                                      ? moment(inv.transaction_date).format(
                                          "MMM D, YYYY",
                                        )
                                      : "—"}
                                    <span className="capitalize ml-1">
                                      · {inv.status || ""}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-1 text-right tabular-nums text-gray-800">
                                  ₦{formatNumber1(invAmt)}
                                </td>
                                <td className="py-2 px-1 text-right tabular-nums text-amber-900">
                                  ₦{formatNumber1(due)}
                                </td>
                                <td className="py-2 pl-1">
                                  <div className="relative">
                                    <span className="pointer-events-none absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-[10px] text-gray-400">
                                      ₦
                                    </span>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      autoComplete="off"
                                      placeholder="0"
                                      value={invoicePayments[k] ?? ""}
                                      onChange={(e) => {
                                        const next = sanitizeAmountInput(
                                          e.target.value,
                                        );
                                        const s = String(next).replace(
                                          /,/g,
                                          "",
                                        );
                                        const parsed =
                                          s === "" || s === "."
                                            ? NaN
                                            : parseFloat(s);
                                        const capped = capPaymentAtBalanceDue(
                                          next,
                                          due,
                                        );
                                        if (
                                          !Number.isNaN(parsed) &&
                                          parsed > due + 1e-9 &&
                                          next !== ""
                                        ) {
                                          if (due <= 0) {
                                            toast.warning(
                                              "No balance due on this invoice — payment cannot be applied here.",
                                            );
                                          } else {
                                            toast.warning(
                                              `Payment cannot exceed balance due (₦${formatNumber1(due)}) for ${inv.invoice_ref || "this invoice"}.`,
                                            );
                                          }
                                        }
                                        setInvoicePayments((prev) => ({
                                          ...prev,
                                          [k]: formatNumberWithCommas(capped),
                                        }));
                                      }}
                                      className="h-8 pl-5 text-right text-xs tabular-nums border-gray-200"
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {outstandingInvoices.length > 0 ? (
                          <tfoot>
                            <tr className="border-t border-gray-200 bg-slate-50/90 text-gray-800">
                              <td
                                colSpan={3}
                                className="py-2 pr-2 text-right font-medium"
                              >
                                Allocated (sum of Payment)
                              </td>
                              <td className="py-2 pl-1 text-right font-semibold tabular-nums">
                                ₦{formatNumber1(allocatedSum)}
                              </td>
                            </tr>
                          </tfoot>
                        ) : null}
                      </table>
                    </div>
                    <p className="text-xs font-medium text-gray-700 pt-2 border-t border-gray-200">
                      Total due (all lines): ₦{formatNumber1(totalOutstanding)}
                    </p>
                    {totalOutstanding > 0.000001 ? (
                      <p
                        className={`text-xs mt-1.5 ${
                          allocatedSum + 0.01 >= totalOutstanding
                            ? "text-emerald-800"
                            : "text-amber-800"
                        }`}
                      >
                        {allocatedSum + 0.01 >= totalOutstanding
                          ? `Sum of Payment is at least total due — invoices can be fully settled from these lines.`
                          : `Sum of Payment (₦${formatNumber1(
                              allocatedSum,
                            )}) is below total due — increase line payments (up to each balance due) or the total received.`}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              </>
            ) : null}

            {activeTab === "payment" && (<>
            <div className="space-y-2">
              <Label htmlFor="customer-adv-date" className="text-gray-900 font-medium">Date</Label>
              <Input
                id="customer-adv-date"
                type="date"
                value={paymentDate}
                min={POSTING_DATE_MIN}
                max={getPostingDateMax()}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="border-gray-200"
              />
            </div>

            <AdvancePaymentPaymentFields
              idPrefix="customer-adv"
              modeOfPayment={modeOfPayment}
              onModeChange={setModeOfPayment}
              accountHead={accountHead}
              onAccountHeadChange={setAccountHead}
              bankAccount={bankAccount}
              onBankAccountChange={setBankAccount}
              accountList={accountList}
              headList={headList}
              chequeNumber={chequeNumber}
              onChequeNumberChange={setChequeNumber}
              allowCashTransfer={false}
            />

            <div className="space-y-2">
              <Label htmlFor="customer-adv-narration" className="text-gray-900 font-medium">Narration / reference</Label>
              <Textarea id="customer-adv-narration" rows={3} placeholder="Optional note for this payment" value={narration} onChange={(e) => setNarration(e.target.value)} className="border-gray-200 resize-y min-h-[72px]" />
            </div>

            {/* ── Accounting Treatment Preview (collapsible) ── */}
            {(() => {
              const amt = parseFloat(parseNumberFromFormatted(amount || "")) || 0;
              if (amt <= 0) return null;

              const advancePortion = remainderToDeposit;
              const allocatedToInvoices = allocatedSum;

              const sourceLabel =
                modeOfPayment === "cash"
                  ? accountHead?.description || "Cash on hand"
                  : modeOfPayment === "bank"
                  ? bankAccount?.name || bankAccount?.account_name || "Bank account"
                  : modeOfPayment === "cheque"
                  ? `Cheque — ${bankAccount?.name || "Bank account"}`
                  : "Payment source";

              const rows = [];
              rows.push({ side: "Dr", account: sourceLabel, note: "Cash / bank received from customer", amount: amt, color: "text-emerald-700" });
              if (allocatedToInvoices > 0) {
                rows.push({ side: "Cr", account: "Trade Receivables (receivable account)", note: "Closes outstanding invoice(s)", amount: allocatedToInvoices, color: "text-rose-600" });
              }
              if (advancePortion > 0) {
                rows.push({ side: "Cr", account: "Customer Deposit / Advance Received", note: "Recorded as customer prepayment / deposit", amount: advancePortion, color: "text-rose-600" });
              }

              return (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAccounting((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-blue-100/70 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                        Accounting Treatment Preview
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${showAccounting ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAccounting && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-blue-200">
                          <th className="px-3 py-1.5 font-medium text-left w-6"></th>
                          <th className="px-3 py-1.5 font-medium text-left">Account</th>
                          <th className="px-3 py-1.5 font-medium text-right">Debit</th>
                          <th className="px-3 py-1.5 font-medium text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className="border-b border-blue-100 last:border-0">
                            <td className={`px-3 py-1.5 font-bold ${r.color}`}>{r.side}</td>
                            <td className="px-3 py-1.5 text-gray-800">
                              <p className="font-medium">{r.account}</p>
                              <p className="text-[10px] text-gray-400">{r.note}</p>
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 font-semibold">
                              {r.side === "Dr" ? `₦${formatNumber1(r.amount)}` : "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-rose-600 font-semibold">
                              {r.side === "Cr" ? `₦${formatNumber1(r.amount)}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}
            </>)}
          </div>

          <DrawerFooter className="border-t border-gray-200 bg-gray-50 shrink-0 space-y-2">
            {activeTab === "payment" && (
              <>
                {allocationBlocksSubmit && outstandingInvoices.length > 0 ? (
                  <p className="text-xs text-red-700 text-center px-1">
                    Allocate at least ₦{formatNumber1(minRequiredInvoiceAllocation)}{" "}
                    across the invoices above (up to each balance due) to save.
                    Currently ₦{formatNumber1(allocatedSum)}.
                  </p>
                ) : null}
                <Button type="submit" disabled={submitting || allocationBlocksSubmit} className="w-full bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white h-11 disabled:opacity-60">
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Make Deposit"}
                </Button>
              </>
            )}
            {activeTab === "history" && (
              <Button type="button" variant="outline" className="w-full h-11" onClick={() => setActiveTab("payment")}>
                <Plus size={15} className="mr-2" /> Make Deposit
              </Button>
            )}
            {activeTab === "receipt" && (
              <div className="flex gap-2">
                {selectedReceipt ? (
                  <>
                    <Button type="button" variant="outline" className="flex-1 h-11 gap-1.5" onClick={() => window.print()}>
                      <Printer size={15} /> Print Receipt
                    </Button>
                    <Button type="button" className="flex-1 h-11 bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white gap-1.5" onClick={() => setSelectedReceipt(null)}>
                      ← All Receipts
                    </Button>
                  </>
                ) : (
                  <Button type="button" className="w-full h-11 bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white gap-1.5" onClick={() => setActiveTab("payment")}>
                    <Plus size={15} /> Make Deposit
                  </Button>
                )}
              </div>
            )}
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

CustomerAdvancePaymentModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  party: PropTypes.object,
  customersList: PropTypes.array,
};
