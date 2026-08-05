import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
 * Supplier advance payment — uses /api/v1/supplier-advance-payment (controller: supplierAdvancePayment.js).
 */
export default function SupplierAdvancePaymentModal({
  open,
  onClose,
  onSuccess,
  party,
  suppliersList = null,
}) {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [modeOfPayment, setModeOfPayment] = useState("cash");
  const [narration, setNarration] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [fetchedSuppliers, setFetchedSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [activeTab, setActiveTab] = useState("payment");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [availableAdvance, setAvailableAdvance] = useState(0);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null); // receipt being viewed in detail
  const [showAccounting, setShowAccounting] = useState(false);
  /** keyed by invoiceRowKey(inv) → formatted payment string */
  const [invoicePayments, setInvoicePayments] = useState({});
  /**
   * When line edits bump the total up, we skip auto-FIFO until the user edits
   * total payment again — otherwise FIFO would overwrite manual splits.
   */
  const amountBumpedFromLinesRef = useRef(false);

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
    amountBumpedFromLinesRef.current = false;
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setModeOfPayment("cash");
    setNarration("");
    setChequeNumber("");
    setSelectedSupplier(null);
    setActiveTab("payment");
    setHistory([]);
    setAvailableAdvance(0);
    setLastReceipt(null);
    setSelectedReceipt(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setSelectedSupplier(party || null);
  }, [open, party, reset]);

  useEffect(() => {
    if (modeOfPayment !== "cheque") setChequeNumber("");
  }, [modeOfPayment]);

  const resolvedSuppliersList = useMemo(() => {
    if (Array.isArray(suppliersList) && suppliersList.length > 0) {
      return suppliersList;
    }
    return fetchedSuppliers;
  }, [suppliersList, fetchedSuppliers]);

  // Load suppliers when opened from toolbar without a pre-selected payee.
  useEffect(() => {
    if (!open || !activeBusiness?.id) {
      setFetchedSuppliers([]);
      return;
    }
    if (party?.supplier_number) return;
    if (Array.isArray(suppliersList) && suppliersList.length > 0) return;

    setLoadingSuppliers(true);
    _fetchApi(
      `/api/suppliers?facilityId=${activeBusiness.id}&limit=1000`,
      (data) => {
        setLoadingSuppliers(false);
        let rows = [];
        if (data?.success && data?.data?.suppliers) {
          rows = data.data.suppliers;
        } else if (Array.isArray(data?.results)) {
          rows = data.results;
        }
        setFetchedSuppliers(Array.isArray(rows) ? rows : []);
      },
      () => {
        setLoadingSuppliers(false);
        setFetchedSuppliers([]);
      },
    );
  }, [open, activeBusiness?.id, party, suppliersList]);

  const supplierNoForQuery =
    selectedSupplier?.supplier_number || party?.supplier_number || null;

  useEffect(() => {
    if (!open || !activeBusiness?.id || !supplierNoForQuery) {
      setOutstandingInvoices([]);
      return;
    }

    setLoadingInvoices(true);
    _fetchApi(
      `/api/v1/get-outstanding-supplier-invoices?supplierNo=${encodeURIComponent(
        supplierNoForQuery,
      )}&facilityId=${encodeURIComponent(activeBusiness.id)}`,
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
  }, [open, activeBusiness?.id, supplierNoForQuery]);

  useEffect(() => {
    setInvoicePayments({});
    amountBumpedFromLinesRef.current = false;
    setHistory([]);
    setAvailableAdvance(0);
    setLastReceipt(null);
  }, [supplierNoForQuery]);

  // Fetch history whenever History or Receipt tab is active — all suppliers for the facility
  useEffect(() => {
    if (!["history", "receipt"].includes(activeTab) || !activeBusiness?.id) return;
    setLoadingHistory(true);
    const qs = supplierNoForQuery
      ? `supplierNo=${encodeURIComponent(supplierNoForQuery)}&facilityId=${encodeURIComponent(activeBusiness.id)}`
      : `facilityId=${encodeURIComponent(activeBusiness.id)}`;
    _fetchApi(
      `/api/v1/get-supplier-advance-history?${qs}`,
      (resp) => {
        setLoadingHistory(false);
        if (resp?.success) {
          setHistory(Array.isArray(resp.results) ? resp.results : []);
          setAvailableAdvance(parseFloat(resp.available_advance) || 0);
        } else {
          setHistory([]);
        }
      },
      () => { setLoadingHistory(false); setHistory([]); },
    );
  }, [activeTab, activeBusiness?.id]);

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

  /** When line payments exceed total payment, bump total up so they stay aligned. */
  useEffect(() => {
    if (outstandingInvoices.length === 0) return;
    setAmount((prev) => {
      const prevNum = parseFloat(parseNumberFromFormatted(prev)) || 0;
      if (allocatedSum > prevNum + 0.000001) {
        amountBumpedFromLinesRef.current = true;
        return formatNumberWithCommas(String(allocatedSum));
      }
      return prev;
    });
  }, [allocatedSum, outstandingInvoices.length]);

  /**
   * Split total across invoice lines (oldest first, up to each balance due) whenever
   * the total or invoice list changes, except while the total was auto-raised from line edits.
   */
  useEffect(() => {
    if (amountBumpedFromLinesRef.current) return;
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

  const showSupplierPicker = true;

  const displayName =
    selectedSupplier?.supplier_name ||
    selectedSupplier?.supplier_number ||
    party?.supplier_name ||
    party?.supplier_number;

  const supplierTypeaheadSelected = useMemo(() => {
    if (!selectedSupplier?.supplier_number) return [];
    const match = resolvedSuppliersList?.find(
      (s) => s.supplier_number === selectedSupplier.supplier_number,
    );
    return match ? [match] : [selectedSupplier];
  }, [selectedSupplier, resolvedSuppliersList]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(parseNumberFromFormatted(amount));
    if (!activeBusiness?.id) {
      toast.error("Missing facility");
      return;
    }

    const supplierParty = selectedSupplier || party;
    if (!supplierParty?.supplier_number) {
      toast.error("Select a supplier");
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

    if (
      activeBusiness?.payable_code === "" ||
      activeBusiness?.payable_code === null ||
      activeBusiness?.payable_code === undefined
    ) {
      toast.error("Payable code is not set for this business");
      return;
    }
    if (
      activeBusiness?.payable_accural_code === "" ||
      activeBusiness?.payable_accural_code === null ||
      activeBusiness?.payable_accural_code === undefined
    ) {
      toast.error("Payable accrual / advance code is not set for this business");
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
          `Payment for ${inv.invoice_ref || "bill"} cannot exceed balance due (₦${formatNumber1(due)}).`,
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
        "Sum of bill payments cannot exceed the total payment amount. Increase the total or reduce per-bill amounts.",
      );
      return;
    }

    if (outstandingInvoices.length > 0 && totalOutstanding > 0.000001) {
      const required = Math.min(amt, totalOutstanding);
      if (sumAlloc + 0.02 < required) {
        toast.error(
          `Apply the full payment to outstanding bills (up to each balance due) before saving. Required on bills: at least ₦${formatNumber1(required)}; currently ₦${formatNumber1(sumAlloc)}.`,
        );
        return;
      }
    }

    setSubmitting(true);

    const baseDesc = narration.trim() || "Supplier advance payment";
    const description =
      modeOfPayment === "cheque" && String(chequeNumber || "").trim()
        ? `${baseDesc} [Cheque: ${String(chequeNumber).trim()}]`
        : baseDesc;

    const basePayload = {
      transaction_date: paymentDate,
      amount_paid: amt,
      supplier_number: supplierParty.supplier_number,
      facilityId: activeBusiness.id,
      userId: user?.id || user?.user_id || "",
      narration: description,
      payable_code: activeBusiness.payable_code,
      payable_accural_code: activeBusiness.payable_accural_code,
      mode_of_payment: modeOfPayment,
      line_of_business: "General",
      bank_account_id: bankAccount?.id || accountHead?.head,
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

    const url = "/api/v1/supplier-advance-payment";
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
          ref ? `Payment recorded (${ref})` : "Advance payment recorded",
        );
        // Build receipt data so user can view/print it
        setLastReceipt({
          ref,
          date: paymentDate,
          amount: amt,
          supplier: selectedSupplier || party,
          mode: modeOfPayment,
          narration: narration.trim() || "Supplier advance payment",
          chequeNumber: modeOfPayment === "cheque" ? chequeNumber : "",
          invoices: invoicesPayload,
        });
        setActiveTab("receipt");
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

  if (!open) {
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
        className="bg-white border-gray-200 flex flex-col sm:max-w-xl"
      >
        <DrawerHeader className="border-b border-gray-200 shrink-0 pb-0">
          <div className="flex items-start justify-between gap-3 pb-4">
            <div className="min-w-0 text-left">
              <DrawerTitle className="text-gray-900 text-xl">
                Supplier advance payment
              </DrawerTitle>
              <DrawerDescription className="text-gray-600 mt-1">
                Record a prepayment or allocate to purchase bills
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-gray-500" />
              </Button>
            </DrawerClose>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 -mx-4 px-4 gap-1">
            {[
              { id: "payment", label: "New Payment", icon: <Plus size={14} /> },
              { id: "history", label: "History",     icon: <History size={14} /> },
              { id: "receipt", label: "Receipt",     icon: <Receipt size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-[#2C5CC5] text-[#2C5CC5]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === "receipt" && (lastReceipt || history.length > 0) && (
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
                {loadingHistory ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                  </div>
                ) : (
                  <>
                    {availableAdvance > 0 && (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
                        <p className="text-sm text-blue-800 font-medium">Available advance balance</p>
                        <p className="text-sm font-bold text-blue-900 tabular-nums">₦{formatNumber1(availableAdvance)}</p>
                      </div>
                    )}
                    {history.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        <History size={32} className="mx-auto mb-2 opacity-30" />
                        No advance payment records found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-gray-600">
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 font-medium">Supplier</th>
                              <th className="px-3 py-2 font-medium">Reference</th>
                              <th className="px-3 py-2 font-medium">Mode</th>
                              <th className="px-3 py-2 font-medium text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((h, i) => (
                              <tr key={h.entry_id || i} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                  {h.date ? moment(h.date).format("DD MMM YYYY") : "—"}
                                </td>
                                <td className="px-3 py-2 text-gray-900 max-w-[130px]">
                                  <p className="font-medium truncate">{h.supplier_name || h.supplier_no || "—"}</p>
                                  {h.supplier_no && h.supplier_name && (
                                    <p className="text-[10px] text-gray-400">{h.supplier_no}</p>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-700">
                                  {h.receipt_no || h.invoice_ref || "—"}
                                </td>
                                <td className="px-3 py-2 capitalize text-gray-600">
                                  {h.mode_of_payment || "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">
                                  ₦{formatNumber1(h.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-gray-200">
                              <td colSpan={4} className="px-3 py-2 text-right font-medium text-gray-700 text-xs">
                                Total ({history.length} payments)
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900 text-xs">
                                ₦{formatNumber1(history.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Receipt Tab ── */}
            {activeTab === "receipt" && (
              <div className="space-y-3">
                {/* Detail view — shown when a receipt row is clicked */}
                {selectedReceipt ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(null)}
                      className="flex items-center gap-1.5 text-xs text-[#2C5CC5] hover:underline print:hidden"
                    >
                      ← Back to all receipts
                    </button>

                    <div id="supplier-advance-receipt" className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base">Payment Receipt</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Supplier Advance Payment</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs print:hidden" onClick={() => window.print()}>
                          <Printer size={13} /> Print
                        </Button>
                      </div>

                      <div className="border-t border-dashed border-gray-200 pt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Reference No.</p>
                          <p className="font-mono font-semibold text-gray-900">{selectedReceipt.ref || selectedReceipt.receipt_no || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Date</p>
                          <p className="font-medium text-gray-900">{selectedReceipt.date ? moment(selectedReceipt.date).format("DD MMM YYYY") : "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500 mb-0.5">Supplier</p>
                          <p className="font-medium text-gray-900">
                            {selectedReceipt.supplier_name || selectedReceipt.supplier?.supplier_name || selectedReceipt.supplier_no || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Mode of Payment</p>
                          <p className="font-medium text-gray-900 capitalize">{selectedReceipt.mode || selectedReceipt.mode_of_payment || "—"}</p>
                        </div>
                        {selectedReceipt.narration && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 mb-0.5">Narration</p>
                            <p className="text-gray-700">{selectedReceipt.narration || selectedReceipt.description}</p>
                          </div>
                        )}
                        {!selectedReceipt.narration && selectedReceipt.description && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 mb-0.5">Description</p>
                            <p className="text-gray-700">{selectedReceipt.description}</p>
                          </div>
                        )}
                      </div>

                      {selectedReceipt.invoices?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Bills Applied</p>
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
                        <p className="text-sm font-bold text-gray-900">Total Paid</p>
                        <p className="text-xl font-bold text-[#2C5CC5] tabular-nums">₦{formatNumber1(selectedReceipt.amount)}</p>
                      </div>
                      <p className="text-center text-[10px] text-gray-400 border-t border-dashed border-gray-200 pt-3">
                        This is a system-generated receipt — no signature required.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Receipt list table */
                  <>
                    {/* If there's a freshly-created receipt, show it at the top */}
                    {lastReceipt && (
                      <div
                        className="rounded-lg border-2 border-[#2C5CC5] bg-blue-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => setSelectedReceipt(lastReceipt)}
                      >
                        <div>
                          <p className="text-xs text-[#2C5CC5] font-semibold uppercase tracking-wide mb-0.5">Latest receipt</p>
                          <p className="font-mono font-bold text-gray-900 text-sm">{lastReceipt.ref || "—"}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{moment(lastReceipt.date).format("DD MMM YYYY")} · {lastReceipt.mode}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#2C5CC5] tabular-nums">₦{formatNumber1(lastReceipt.amount)}</p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 justify-end">
                            <Printer size={11} /> View / Print
                          </p>
                        </div>
                      </div>
                    )}

                    {loadingHistory ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading receipts…
                      </div>
                    ) : history.length === 0 && !lastReceipt ? (
                      <div className="text-center py-10 text-gray-400 text-sm">
                        <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                        No receipts yet. Record a payment to generate a receipt.
                      </div>
                    ) : history.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-gray-600">
                              <th className="px-3 py-2.5 font-medium">Date</th>
                              <th className="px-3 py-2.5 font-medium">Supplier</th>
                              <th className="px-3 py-2.5 font-medium">Receipt No.</th>
                              <th className="px-3 py-2.5 font-medium">Mode</th>
                              <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                              <th className="px-3 py-2.5 font-medium text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((h, i) => (
                              <tr
                                key={h.entry_id || i}
                                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                onClick={() => setSelectedReceipt(h)}
                              >
                                <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                                  {h.date ? moment(h.date).format("DD MMM YYYY") : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-gray-900 max-w-[110px]">
                                  <p className="font-medium truncate">{h.supplier_name || h.supplier_no || "—"}</p>
                                  {h.supplier_no && h.supplier_name && (
                                    <p className="text-[10px] text-gray-400">{h.supplier_no}</p>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-gray-800">
                                  {h.receipt_no || "—"}
                                </td>
                                <td className="px-3 py-2.5 capitalize text-gray-600">
                                  {h.mode_of_payment || "—"}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                                  ₦{formatNumber1(h.amount)}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 text-[#2C5CC5] hover:underline text-[11px]">
                                    <Printer size={11} /> Print
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-gray-200">
                              <td colSpan={4} className="px-3 py-2 text-right font-medium text-gray-700 text-xs">
                                Total ({history.length} receipts)
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900 text-xs">
                                ₦{formatNumber1(history.reduce((s, h) => s + (parseFloat(h.amount) || 0), 0))}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}

            {/* ── Payment Tab ── */}
            {activeTab === "payment" && showSupplierPicker && (
              <div className="space-y-2">
                <Label className="text-gray-900 font-medium">Supplier *</Label>
                {loadingSuppliers ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading suppliers…
                  </div>
                ) : resolvedSuppliersList.length === 0 ? (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    No payees found. Add a supplier first, then record an advance
                    payment.
                  </p>
                ) : (
                  <Typeahead
                    id="supplier-advance-payment-supplier"
                    options={resolvedSuppliersList}
                    placeholder="Search or select supplier…"
                    labelKey={(s) =>
                      s
                        ? `${s.supplier_name || ""} (${s.supplier_number || ""})`
                        : ""
                    }
                    selected={supplierTypeaheadSelected}
                    onChange={(selected) => {
                      setSelectedSupplier(selected[0] || null);
                    }}
                    renderMenuItemChildren={(option) => (
                      <div className="py-1">
                        <div className="font-semibold text-slate-800">
                          {option.supplier_name || ""}
                        </div>
                        <small className="text-slate-600 text-xs">
                          Payee ID: {option.supplier_number}
                        </small>
                      </div>
                    )}
                    clearButton
                    positionFixed
                    flip
                    className="w-full [&_.rbt-input-main]:rounded-md [&_.rbt-input-main]:border [&_.rbt-input-main]:border-gray-200 [&_.rbt-input-main]:min-h-10 [&_.rbt-input-main]:shadow-sm"
                  />
                )}
              </div>
            )}

            {activeTab === "payment" && supplierNoForQuery ? (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="supplier-adv-amount"
                    className="text-gray-900 font-medium"
                  >
                    Total payment *
                  </Label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-gray-500"
                      aria-hidden
                    >
                      ₦
                    </span>
                    <Input
                      id="supplier-adv-amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => {
                        amountBumpedFromLinesRef.current = false;
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
                        <strong>Total payment</strong> must be{" "}
                        <strong>greater than or equal to</strong> the sum of the{" "}
                        <strong>Payment</strong> column. The total is split
                        across bills automatically (oldest first, up to each
                        balance due) when you change it. Editing a line raises
                        the total automatically if needed and keeps your line
                        amounts until you edit the total again. Each line cannot
                        exceed that bill&apos;s balance due; any extra is
                        unallocated supplier advance.
                      </p>
                      {remainderToDeposit > 0.000001 ? (
                        <p className="text-gray-700">
                          Allocated from table: ₦{formatNumber1(allocatedSum)} ·
                          Remainder to advance: ₦
                          {formatNumber1(remainderToDeposit)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Amount paid out to the supplier for this entry.
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-gray-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-900 font-medium text-sm">
                    Outstanding purchase bills
                  </Label>
                  {loadingInvoices ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  ) : null}
                </div>
                <p className="text-xs text-gray-600">
                  Enter how much applies to each bill (cannot exceed balance
                  due per line). You must allocate the full payment across these
                  lines up to each balance due (everything up to the lesser of
                  total payment and total due) before you can save — no saving
                  while money is left unapplied on bills.
                </p>
                {loadingInvoices ? (
                  <p className="text-xs text-gray-500">Loading…</p>
                ) : outstandingInvoices.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    No outstanding purchase bills for this supplier.
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
                          ? `Sum of Payment is at least total due — bills can be fully settled from these lines.`
                          : `Sum of Payment (₦${formatNumber1(
                              allocatedSum,
                            )}) is below total due — increase line payments (up to each balance due) or the total payment.`}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="supplier-adv-date"
                    className="text-gray-900 font-medium"
                  >
                    Date
                  </Label>
                  <Input
                    id="supplier-adv-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="border-gray-200"
                  />
                </div>

                <AdvancePaymentPaymentFields
                  idPrefix="supplier-adv"
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
                />

                <div className="space-y-2">
                  <Label
                    htmlFor="supplier-adv-narration"
                    className="text-gray-900 font-medium"
                  >
                    Narration / reference
                  </Label>
                  <Textarea
                    id="supplier-adv-narration"
                    rows={3}
                    placeholder="Optional note for this payment"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="border-gray-200 resize-y min-h-[72px]"
                  />
                </div>

                {/* ── Accounting Treatment Preview (collapsible) ── */}
                {(() => {
                  const amt = parseFloat(parseNumberFromFormatted(amount || "")) || 0;
                  if (amt <= 0) return null;

                  const allocatedToBills = allocatedSum;
                  const advancePortion = Math.max(0, amt - allocatedToBills);

                  const sourceLabel =
                    modeOfPayment === "cash"
                      ? accountHead?.description || "Cash on hand"
                      : modeOfPayment === "bank"
                      ? bankAccount?.name || bankAccount?.account_name || "Bank account"
                      : modeOfPayment === "cheque"
                      ? `Cheque — ${bankAccount?.name || "Bank account"}`
                      : "Payment source";

                  const rows = [];
                  if (allocatedToBills > 0) {
                    rows.push({ side: "Dr", account: "Trade Payables (payable account)", note: "Closes outstanding bills", amount: allocatedToBills, color: "text-emerald-700" });
                  }
                  if (advancePortion > 0) {
                    rows.push({ side: "Dr", account: "Advance to Suppliers (accrual account)", note: "Recorded as prepayment / advance", amount: advancePortion, color: "text-emerald-700" });
                  }
                  rows.push({ side: "Cr", account: sourceLabel, note: "Cash / bank paid out", amount: amt, color: "text-rose-600" });

                  return (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 overflow-hidden">
                      {/* Clickable header */}
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

                      {/* Collapsible body */}
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
                          <tfoot>
                            <tr className="bg-blue-100/50 border-t border-blue-200">
                              <td colSpan={2} className="px-3 py-1.5 text-right text-gray-600 font-semibold">Totals</td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-bold text-emerald-700">₦{formatNumber1(amt)}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-bold text-rose-600">₦{formatNumber1(amt)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : null}
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
                <Button
                  type="submit"
                  disabled={
                    submitting || allocationBlocksSubmit || !supplierNoForQuery
                  }
                  className="w-full bg-[#2C5CC5] hover:bg-[#1e4ba8] text-white h-11 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save payment"
                  )}
                </Button>
              </>
            )}
            {activeTab === "history" && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={() => setActiveTab("payment")}
              >
                <Plus size={15} className="mr-2" /> New Payment
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
                    <Plus size={15} /> New Payment
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

SupplierAdvancePaymentModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  party: PropTypes.object,
  suppliersList: PropTypes.array,
};
