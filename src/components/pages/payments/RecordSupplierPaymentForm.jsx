import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Paperclip,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { formatExpensePaymentMode } from "@/utils/expensePaymentMode";
import SearchSupplierInput from "@/components/pages/purchase/SearchSuppliers";
import { useAdvancePaymentAccounts } from "@/components/common/useAdvancePaymentAccounts";
import CashTransferPaymentFields, {
  buildPaymentSplits,
  isCashTransferSplitMode,
  parseMoneyInput,
} from "@/components/common/CashTransferPaymentFields";
import {
  POSTING_DATE_MIN,
  getPostingDateMax,
  validatePostingDateClient,
} from "@/utilities";
import {
  cloudinaryDocumentHref,
  formatCloudinaryFileSize,
  pickAndStageCloudinaryFiles,
} from "@/utils/cloudinaryDocuments";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const PAYMENT_FILE_MAX_BYTES = 25 * 1024 * 1024;
const PAYMENT_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const inputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)] disabled:bg-slate-50 disabled:text-slate-500";

/** Invoice-style label | control row — matches Inventory Bill. */
function Field({ label, required, children, error, wide = false, alignStart = false }) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 ${
        wide
          ? "lg:grid-cols-[9rem_minmax(0,1fr)]"
          : "lg:grid-cols-[9rem_minmax(0,28rem)]"
      } ${alignStart ? "lg:items-start" : "lg:items-center"}`}
    >
      <label
        className={`text-sm font-medium text-slate-600 lg:text-right ${
          alignStart ? "pt-2" : ""
        }`}
      >
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <div className="min-w-0">
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
 * New Payment — layout matches Inventory Bill (Product Supplier Bill).
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

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(moment().format("YYYY-MM-DD"));
  const [paymentNumber, setPaymentNumber] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("cash");
  const [chequeNumber, setChequeNumber] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [errors, setErrors] = useState({});
  const isSubmittingRef = useRef(false);
  const skipAutoAllocateRef = useRef(false);
  const manualAllocationRef = useRef(false);
  const cashTypeaheadRef = useRef();
  const isSplitPayment = isCashTransferSplitMode(modeOfPayment);
  const attachmentUploading = attachments.some((doc) => doc.uploading);

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
    if (isSplitPayment) {
      const cash = parseMoneyInput(cashAmount);
      const transfer = parseMoneyInput(transferAmount);
      if (cash <= 0 || transfer <= 0) {
        next.paidThrough = "Enter both cash and transfer amounts";
      } else if (Math.abs(cash + transfer - amt) > 0.02) {
        next.paidThrough = `Cash + Transfer must equal payment made (${formatNumber1(amt)})`;
      } else {
        if (!accountHead?.head) {
          next.paidThrough = "Cash account is required";
        }
        if (!bankAccount?.id) {
          next.paidThrough = next.paidThrough || "Bank account is required";
        }
      }
    } else {
      if (modeOfPayment === "cash" && !accountHead?.head) {
        next.paidThrough = "Paid Through is required";
      }
      if (["bank", "cheque", "card"].includes(modeOfPayment) && !bankAccount?.id) {
        next.paidThrough = "Paid Through is required";
      }
      if (modeOfPayment === "cheque" && !String(chequeNumber || "").trim()) {
        next.cheque = "Cheque number is required";
      }
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

    if (attachments.some((f) => f.uploading)) {
      toast.error("Wait for document uploads to finish");
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

    const notesParts = [];
    if (paymentNumber) notesParts.push(`Payment #: ${paymentNumber}`);
    if (String(notes || "").trim()) notesParts.push(String(notes).trim());
    if (attachments.length) {
      notesParts.push(
        `Attachments: ${attachments
          .map((f) => f.document_name || f.original_name || f.name)
          .filter(Boolean)
          .join(", ")}`,
      );
    }
    const baseDesc =
      notesParts.filter(Boolean).join(" · ") ||
      `Vendor payment${paymentNumber ? ` ${paymentNumber}` : ""}`;
    const narration =
      modeOfPayment === "cheque" && String(chequeNumber || "").trim()
        ? `${baseDesc} [Cheque: ${String(chequeNumber).trim()}]`
        : baseDesc;

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
      attachments: attachments
        .filter((doc) => doc.file_path && !doc.uploading)
        .map((doc) => ({
          file_path: doc.file_path,
          url: doc.url || doc.file_path,
          document_name: doc.document_name || doc.original_name || doc.name,
          original_name: doc.original_name || doc.name,
          file_size: doc.file_size || doc.size,
          mime_type: doc.mime_type,
        })),
    };
    if (
      (modeOfPayment === "cash" || isSplitPayment) &&
      accountHead?.head
    ) {
      basePayload.accountHead = {
        head: accountHead.head,
        description: accountHead.description,
      };
    }
    if (
      (["bank", "cheque", "card"].includes(modeOfPayment) || isSplitPayment) &&
      bankAccount?.id
    ) {
      basePayload.bankAccount = { id: bankAccount.id };
    }
    const paymentSplits = buildPaymentSplits({
      mode: modeOfPayment,
      cashAmount,
      transferAmount,
      accountHead,
      bankAccount,
    });
    if (paymentSplits?.length) {
      basePayload.payment_splits = paymentSplits;
    }

    const payload =
      invoicesPayload.length > 0
        ? { ...basePayload, invoices: invoicesPayload }
        : { ...basePayload, allocation_order: "fifo" };

    const advancePortion = Math.max(
      0,
      +(
        amountPaidNum -
        invoicesPayload.reduce((s, x) => s + (x.amount_paid || 0), 0)
      ).toFixed(2),
    );

    setPendingSave({ payload, advancePortion, amountPaidNum });
    setConfirmOpen(true);
  };

  const executeSave = () => {
    if (!pendingSave || isSubmittingRef.current || saving) return;
    const { payload } = pendingSave;
    setConfirmOpen(false);
    isSubmittingRef.current = true;
    setSaving(true);

    _postApi(
      "/api/v1/supplier-advance-payment",
      payload,
      (res) => {
        setSaving(false);
        isSubmittingRef.current = false;
        setPendingSave(null);
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
        setPendingSave(null);
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

  const missingSupplier = !selectedSupplier;
  const missingAmount =
    !(parseFloat(parseNumberFromFormatted(amountPaid)) > 0);
  const missingMode = !modeOfPayment;
  const showValidation =
    missingSupplier || missingAmount || missingMode || errors.date;

  return (
    <div className="relative min-h-screen bg-white">
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setConfirmOpen(false);
            setPendingSave(null);
          }
        }}
      >
        <AlertDialogContent className="z-[200] border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              {pendingSave?.advancePortion > 0.02 ? (
                <>
                  Excess {currency} {formatNumber1(pendingSave.advancePortion)}{" "}
                  will be kept as vendor advance / credit. Continue?
                </>
              ) : (
                <>
                  Record payment of {currency}{" "}
                  {formatNumber1(pendingSave?.amountPaidNum || 0)}. Continue?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeSave();
              }}
              disabled={saving}
              className="bg-[var(--aa-accent)] text-white hover:opacity-90"
            >
              {saving ? "Saving…" : "Yes, continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-screen flex-col bg-white">
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText
                className="size-6 text-[var(--aa-accent)]"
                strokeWidth={1.75}
              />
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  New Payment
                </h1>
                <p className="text-xs text-slate-500">
                  Apply this payment to unpaid bills. Excess is kept as vendor
                  advance.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
          {showValidation && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {missingSupplier && (
                <span className="mr-3">Select a supplier.</span>
              )}
              {missingAmount && (
                <span className="mr-3">Enter the payment amount.</span>
              )}
              {missingMode && (
                <span className="mr-3">Choose a payment mode.</span>
              )}
              {errors.date && <span>{errors.date}</span>}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-4 border-b border-slate-100 bg-white px-6 py-5">
          <Field label="Vendor" required error={errors.supplier}>
            <SearchSupplierInput
              onChange={handleSupplierChange}
              disabled={saving}
            />
            {selectedSupplier && (
              <p className="mt-1 text-[11px] text-slate-500">
                Supplier:{" "}
                <span className="font-medium">{supplierChipLabel}</span>
              </p>
            )}
          </Field>

          <Field label="Payment Made" required error={errors.amount}>
            <div className="flex h-9 max-w-md overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-[var(--aa-accent)] focus-within:ring-1 focus-within:ring-[var(--aa-accent)]">
              <span className="flex items-center border-r border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-600">
                {currency}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountPaid}
                onChange={(e) => handleAmountPaidChange(e.target.value)}
                disabled={saving}
                placeholder="0.00"
                className="w-full border-0 px-3 text-sm outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Apply to bills below, or leave payments at 0 to record the full
              amount as vendor advance.
            </p>
          </Field>

          <Field label="Payment Date" required error={errors.date}>
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
              className={`${inputClass} max-w-xs`}
            />
          </Field>

          <Field label="Payment #">
            <div className="flex max-w-md gap-2">
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </Field>

          <CashTransferPaymentFields
            modeOfPayment={modeOfPayment}
            onModeChange={(value) => {
              setModeOfPayment(value);
              setAccountHead({});
              setBankAccount(null);
              setChequeNumber("");
              setCashAmount("");
              setTransferAmount("");
              setErrors((prev) => ({
                ...prev,
                mode: undefined,
                paidThrough: undefined,
                cheque: undefined,
              }));
            }}
            cashAmount={cashAmount}
            onCashAmountChange={(v) => {
              setCashAmount(v);
              setErrors((prev) => ({ ...prev, paidThrough: undefined }));
            }}
            transferAmount={transferAmount}
            onTransferAmountChange={(v) => {
              setTransferAmount(v);
              setErrors((prev) => ({ ...prev, paidThrough: undefined }));
            }}
            expectedTotal={
              parseFloat(parseNumberFromFormatted(amountPaid)) || 0
            }
            accountHead={accountHead}
            onAccountHeadChange={(v) => {
              setAccountHead(v || {});
              setErrors((prev) => ({ ...prev, paidThrough: undefined }));
            }}
            bankAccount={bankAccount}
            onBankAccountChange={(acc) => {
              setBankAccount(acc || null);
              setErrors((prev) => ({ ...prev, paidThrough: undefined }));
            }}
            accountList={accountList}
            headList={headList}
            chequeNumber={chequeNumber}
            onChequeNumberChange={(v) => {
              setChequeNumber(v);
              setErrors((prev) => ({ ...prev, cheque: undefined }));
            }}
            cashTypeaheadRef={cashTypeaheadRef}
            disabled={saving}
          />
          {(errors.mode || errors.paidThrough || errors.cheque) && (
            <p className="ml-0 flex items-center gap-1 text-xs text-red-600 lg:ml-[9rem] lg:pl-4">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {errors.mode || errors.paidThrough || errors.cheque}
            </p>
          )}

          {visibleBranches.length > 1 && (
            <Field label="Warehouse">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={saving}
                className="h-9 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              >
                {visibleBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Notes" alignStart>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={3}
              placeholder="Internal use. Not visible to vendor"
              className="w-full max-w-md resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
            />
          </Field>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Attachments
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Receipts and other payment documents (PDF, PNG, JPG, DOCX)
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {attachments.length}{" "}
                {attachments.length === 1 ? "file" : "files"}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                e.target.value = "";
                pickAndStageCloudinaryFiles({
                  picked,
                  kind: "payments",
                  setItems: setAttachments,
                  allowedTypes: PAYMENT_FILE_TYPES,
                  maxBytes: PAYMENT_FILE_MAX_BYTES,
                });
              }}
            />
            <button
              type="button"
              disabled={saving || attachmentUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {attachmentUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {attachmentUploading ? "Uploading…" : "Upload documents"}
            </button>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Files upload to Cloudinary as soon as you select them. 25MB each.
            </p>
            {attachments.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {attachments.map((file, idx) => {
                  const href = file.uploading
                    ? null
                    : cloudinaryDocumentHref(file);
                  const label =
                    file.document_name || file.original_name || file.name;
                  const sizeBytes = file.file_size || file.size;
                  return (
                    <li
                      key={file.clientId || `${label}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        {file.uploading ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--aa-accent)]" />
                        ) : (
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--aa-accent)]" />
                        )}
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-[var(--aa-accent)] hover:text-[var(--aa-navy)] hover:underline"
                          >
                            {label}
                            {formatCloudinaryFileSize(sizeBytes) ? (
                              <span className="text-slate-400">
                                {" "}
                                ({formatCloudinaryFileSize(sizeBytes)})
                              </span>
                            ) : null}
                          </a>
                        ) : (
                          <span className="truncate">
                            {label}
                            {formatCloudinaryFileSize(sizeBytes) ? (
                              <span className="text-slate-400">
                                {" "}
                                ({formatCloudinaryFileSize(sizeBytes)})
                              </span>
                            ) : null}
                          </span>
                        )}
                        {href ? (
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                        ) : null}
                        {file.uploading ? (
                          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Uploading
                          </span>
                        ) : (
                          <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            Uploaded
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={saving || file.uploading}
                        onClick={() =>
                          setAttachments((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="shrink-0 text-red-600 hover:text-red-700"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Unpaid Bills
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled
                title="Coming soon"
                className="inline-flex items-center gap-1 text-xs text-slate-400"
              >
                Filter by Date Range
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={clearApplied}
                disabled={saving || allocatedSum <= 0}
                className="text-sm font-medium text-[var(--aa-accent)] hover:underline disabled:opacity-40"
              >
                Clear Applied Amount
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto px-4 sm:px-6">
            {!selectedSupplier ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">
                Select a vendor to load unpaid bills.
              </div>
            ) : loadingInvoices ? (
              <div className="space-y-2 py-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : outstandingInvoices.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">
                There are no bills for this vendor.
              </div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                      Bill#
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                      Mode of payment
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                      Bill Amount
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                      Amount Due
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1">
                        Payment
                        <Info
                          className="h-3 w-3 text-slate-400"
                          title="Amount of this payment applied to the bill"
                        />
                      </span>
                    </th>
                    <th className="w-10 px-1 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {outstandingInvoices.map((inv) => {
                    const k = invoiceRowKey(inv);
                    return (
                      <tr key={k} className="bg-white hover:bg-slate-50/80">
                        <td className="px-3 py-3 text-sm text-slate-700">
                          {inv.transaction_date
                            ? moment(inv.transaction_date).format("DD MMM YYYY")
                            : "-"}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-[var(--aa-accent)]">
                          {inv.invoice_ref}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-700">
                          {formatExpensePaymentMode(inv.mode_of_payment)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm tabular-nums text-slate-800">
                          {formatNumber1(inv.amount || 0)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium tabular-nums text-slate-900">
                          {formatNumber1(
                            inv.amount_due ?? inv.balance_due ?? 0,
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={invoicePayments[k] || ""}
                            onChange={(e) =>
                              setInvoicePayment(inv, e.target.value)
                            }
                            disabled={saving}
                            placeholder="0.00"
                            className="ml-auto h-9 w-28 rounded-md border border-slate-300 bg-white px-3 text-right text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                          />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => applyFull(inv)}
                            disabled={saving}
                            className="text-xs font-medium text-[var(--aa-accent)] hover:underline disabled:opacity-40"
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
                      colSpan={5}
                      className="px-3 py-2.5 text-xs italic text-slate-500"
                    >
                      *List contains only unpaid bills
                    </td>
                    <td
                      colSpan={2}
                      className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900"
                    >
                      Total {formatNumber1(allocatedSum)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div className="mt-4 flex justify-end px-6 pb-4">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600">Amount Paid</span>
                <span className="tabular-nums text-slate-900">
                  {formatNumber1(
                    parseFloat(parseNumberFromFormatted(amountPaid)) || 0,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600">Applied to Bills</span>
                <span className="tabular-nums text-slate-900">
                  {formatNumber1(allocatedSum)}
                </span>
              </div>
              <div
                className={`flex items-center justify-between gap-4 border-t border-slate-200 pt-3 ${
                  excess > 0 ? "text-red-600" : ""
                }`}
              >
                <span
                  className={`text-base font-semibold ${
                    excess > 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  Excess ({currency})
                </span>
                <span
                  className={`text-lg font-bold tabular-nums ${
                    excess > 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {formatNumber1(excess)}
                </span>
              </div>
              {excess > 0 ? (
                <p className="text-[11px] font-medium text-red-600">
                  Excess will be kept as vendor advance / credit.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#f7f7f8] px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || attachmentUploading}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aa-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                "Save as Paid"
              )}
            </button>
            <button
              type="button"
              disabled
              title="Draft saving isn't available yet"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-slate-900">
              Payment Amount:{" "}
              <span className="tabular-nums">
                {currency}{" "}
                {formatNumber1(
                  parseFloat(parseNumberFromFormatted(amountPaid)) || 0,
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
