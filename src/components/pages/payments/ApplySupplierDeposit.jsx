import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import moment from "moment";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  ChevronLeft,
  FileText,
  Package,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import SearchSupplierInput from "@/components/pages/purchase/SearchSuppliers";
import { Button } from "@/components/ui/button";
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
import {
  POSTING_DATE_MIN,
  getPostingDateMax,
  validatePostingDateClient,
} from "@/utilities";

const APP_BLUE = "#4267B2";
const APP_NAVY = "var(--aa-navy, #1a2d5e)";

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
  "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4267B2]/30 focus:border-[#4267B2] transition-all hover:border-slate-400 disabled:opacity-60 disabled:bg-slate-50";

/**
 * Apply vendor deposit / goods-in-transit to unpaid bills.
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
  const [availableGit, setAvailableGit] = useState(0);
  const [applySource, setApplySource] = useState("deposit"); // deposit | goods_in_transit
  const [moveAmount, setMoveAmount] = useState("");
  const [moving, setMoving] = useState(false);
  const [writeOffAmount, setWriteOffAmount] = useState("");
  const [writingOff, setWritingOff] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // move | write_off | apply
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

  const sourceBalance =
    applySource === "goods_in_transit" ? availableGit : availableDeposit;

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
          setAvailableGit(
            parseFloat(
              res?.available_goods_in_transit ?? res?.available_git,
            ) || 0,
          );
          done();
        },
        () => {
          setAvailableDeposit(0);
          setAvailableGit(0);
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
      setAvailableGit(0);
      setBills([]);
      setApplyAmounts({});
      setMoveAmount("");
      return;
    }
    setSelectedSupplier(supplier);
    loadSupplierData(supplier.supplier_number || supplier.supplierNo);
  };

  useEffect(() => {
    if (!supplierNo || loading || sourceBalance <= 0) return;
    if (bills.length === 0) return;
    const seedKey = `${supplierNo}:${applySource}`;
    if (autoSeededFor.current === seedKey) return;

    let remaining = sourceBalance;
    const next = {};
    for (const bill of bills) {
      const k = billKey(bill);
      const due = parseFloat(bill.amount_due ?? bill.balance_due ?? 0) || 0;
      const pay = Math.min(Math.max(0, due), Math.max(0, remaining));
      next[k] = pay > 0 ? formatNumberWithCommas(pay.toFixed(2)) : "";
      remaining -= pay;
    }
    autoSeededFor.current = seedKey;
    setApplyAmounts(next);
  }, [supplierNo, loading, sourceBalance, bills, applySource]);

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
    let remaining = sourceBalance;
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

  const executeMoveToGit = (amt) => {
    setMoving(true);
    _postApi(
      "/api/v1/move-supplier-deposit-to-git",
      {
        facilityId,
        userId: user?.id || user?.user_id,
        supplier_no: supplierNo,
        amount: amt,
        transaction_date: paymentDate,
        narration: notes,
      },
      (res) => {
        setMoving(false);
        if (res?.success) {
          toast.success(res.message || "Moved to goods in transit");
          setMoveAmount("");
          setAvailableDeposit(
            parseFloat(res?.data?.available_deposit) || 0,
          );
          setAvailableGit(
            parseFloat(res?.data?.available_goods_in_transit) || 0,
          );
          setApplySource("goods_in_transit");
          autoSeededFor.current = "";
          loadSupplierData(supplierNo);
        } else {
          toast.error(res?.error || res?.message || "Failed to move deposit");
        }
      },
      (err) => {
        setMoving(false);
        toast.error(err?.error || err?.message || "Failed to move deposit");
      },
    );
  };

  const handleMoveToGit = () => {
    if (!supplierNo) {
      toast.error("Select a vendor");
      return;
    }
    const amt =
      parseFloat(parseNumberFromFormatted(moveAmount || "")) || 0;
    if (amt <= 0) {
      toast.error("Enter an amount to move");
      return;
    }
    if (amt > availableDeposit + 0.01) {
      toast.error("Amount exceeds available deposit");
      return;
    }
    const dateErr = validatePostingDateClient(paymentDate, { field: "Date" });
    if (dateErr) {
      toast.error(dateErr);
      return;
    }
    setConfirmAction({ type: "move", amount: amt });
  };

  const executeWriteOffGit = (amt) => {
    setWritingOff(true);
    _postApi(
      "/api/v1/write-off-supplier-git",
      {
        facilityId,
        userId: user?.id || user?.user_id,
        supplier_no: supplierNo,
        amount: amt,
        transaction_date: paymentDate,
        narration: notes,
      },
      (res) => {
        setWritingOff(false);
        if (res?.success) {
          toast.success(res.message || "Goods in transit written off");
          setWriteOffAmount("");
          setAvailableGit(
            parseFloat(res?.data?.available_goods_in_transit) || 0,
          );
          autoSeededFor.current = "";
          loadSupplierData(supplierNo);
        } else {
          toast.error(res?.error || res?.message || "Failed to write off");
        }
      },
      (err) => {
        setWritingOff(false);
        toast.error(err?.error || err?.message || "Failed to write off");
      },
    );
  };

  const handleWriteOffGit = () => {
    if (!supplierNo) {
      toast.error("Select a vendor");
      return;
    }
    const amt =
      parseFloat(parseNumberFromFormatted(writeOffAmount || "")) || 0;
    if (amt <= 0) {
      toast.error("Enter an amount to write off");
      return;
    }
    if (amt > availableGit + 0.01) {
      toast.error("Amount exceeds available goods in transit");
      return;
    }
    const dateErr = validatePostingDateClient(paymentDate, { field: "Date" });
    if (dateErr) {
      toast.error(dateErr);
      return;
    }
    setConfirmAction({ type: "write_off", amount: amt });
  };

  const buildApplications = () =>
    bills
      .map((bill) => {
        const k = billKey(bill);
        const amount =
          parseFloat(parseNumberFromFormatted(applyAmounts[k] || "")) || 0;
        if (amount <= 0) return null;
        return { invoice_ref: k, amount };
      })
      .filter(Boolean);

  const executeApply = (applications) => {
    setApplying(true);
    _postApi(
      "/api/v1/apply-supplier-advance",
      {
        facilityId,
        userId: user?.id || user?.user_id,
        supplier_no: supplierNo,
        transaction_date: paymentDate,
        narration: notes,
        source: applySource,
        applications,
      },
      (res) => {
        setApplying(false);
        if (res?.success) {
          toast.success(
            res.message ||
              `Applied (${res.data?.reference_number || ""})`,
          );
          setNotes("");
          loadSupplierData(supplierNo);
          setApplyAmounts({});
          onSuccess?.();
        } else {
          toast.error(res?.error || res?.message || "Failed to apply");
        }
      },
      (err) => {
        setApplying(false);
        toast.error(err?.error || err?.message || "Failed to apply");
      },
    );
  };

  const handleApply = () => {
    if (!supplierNo) {
      toast.error("Select a vendor");
      return;
    }
    if (sourceBalance <= 0) {
      toast.error(
        applySource === "goods_in_transit"
          ? "No goods in transit available"
          : "This vendor has no available deposit",
      );
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
    if (allocatedSum > sourceBalance + 0.01) {
      toast.error(
        `Applied (${formatNumber1(allocatedSum)}) exceeds available (${formatNumber1(sourceBalance)})`,
      );
      return;
    }

    const applications = buildApplications();
    setConfirmAction({
      type: "apply",
      amount: allocatedSum,
      applications,
      billCount: applications.length,
    });
  };

  const confirmCopy = useMemo(() => {
    if (!confirmAction) return null;
    const supplierLabel =
      selectedSupplier?.supplier_name ||
      selectedSupplier?.supplierName ||
      supplierNo;
    if (confirmAction.type === "move") {
      return {
        title: "Confirm move to goods in transit",
        description: `Move ${currency} ${formatNumber1(confirmAction.amount)} from deposit to goods in transit for ${supplierLabel}?`,
        confirmLabel: "Yes, move",
        destructive: false,
      };
    }
    if (confirmAction.type === "write_off") {
      return {
        title: "Confirm write-off",
        description: `Write off ${currency} ${formatNumber1(confirmAction.amount)} goods in transit for ${supplierLabel}? This posts to Goods in Transit Loss and cannot be undone from here.`,
        confirmLabel: "Yes, write off",
        destructive: true,
      };
    }
    return {
      title:
        applySource === "goods_in_transit"
          ? "Confirm apply GIT to bills"
          : "Confirm apply deposit to bills",
      description: `Apply ${currency} ${formatNumber1(confirmAction.amount)} ${
        applySource === "goods_in_transit" ? "goods in transit" : "deposit"
      } to ${confirmAction.billCount} unpaid bill(s) for ${supplierLabel}?`,
      confirmLabel:
        applySource === "goods_in_transit"
          ? "Yes, apply GIT"
          : "Yes, apply deposit",
      destructive: false,
    };
  }, [
    confirmAction,
    selectedSupplier,
    supplierNo,
    currency,
    applySource,
  ]);

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    const pending = confirmAction;
    setConfirmAction(null);
    if (pending.type === "move") executeMoveToGit(pending.amount);
    else if (pending.type === "write_off") executeWriteOffGit(pending.amount);
    else if (pending.type === "apply") executeApply(pending.applications || []);
  };

  const canSubmit =
    !applying &&
    !!selectedSupplier &&
    allocatedSum > 0 &&
    sourceBalance > 0;

  const shellClass = asModal
    ? "flex h-full min-h-0 flex-col bg-white"
    : "min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4";

  const cardClass = asModal
    ? "flex h-full min-h-0 flex-col"
    : "mx-auto max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl";

  return (
    <div className={shellClass}>
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent className="z-[200] border border-slate-200 bg-white text-slate-900 shadow-2xl sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">
              {confirmCopy?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              {confirmCopy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={moving || writingOff || applying}
              className="border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmAction();
              }}
              className={
                confirmCopy?.destructive
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "text-white hover:opacity-90"
              }
              style={
                confirmCopy?.destructive
                  ? undefined
                  : { backgroundColor: APP_BLUE }
              }
            >
              {confirmCopy?.confirmLabel || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className={cardClass}>
        <div
          className="flex shrink-0 items-center gap-3 px-5 py-4 text-white"
          style={{ backgroundColor: APP_NAVY }}
        >
          {(asModal || onCancel) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCancel?.()}
              className="h-8 w-8 p-0 text-white hover:bg-white/10"
            >
              {asModal ? <X className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
          <div className="flex flex-1 items-center gap-2.5 min-w-0">
            <Wallet className="h-5 w-5 shrink-0 text-white/90" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight">
                Apply Deposit
              </h2>
              <p className="text-xs text-white/70 truncate">
                Deposit → Goods in transit → Unpaid bills
              </p>
            </div>
          </div>
          {selectedSupplier && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-white hover:bg-white/10"
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="bg-white p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Select Supplier <span className="text-red-500">*</span>
                </label>
                <SearchSupplierInput
                  onChange={handleSupplierChange}
                  selected={selectedSupplier ? [selectedSupplier] : []}
                  disabled={applying || moving || writingOff}
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
                  disabled={applying || moving || writingOff}
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                <FileText className="h-4 w-4" />
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={applying || moving || writingOff}
                placeholder="Enter internal note..."
                className={fieldClass}
              />
            </div>

            {selectedSupplier && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-lg border px-3 py-2.5"
                    style={{
                      borderColor: `${APP_BLUE}55`,
                      background: `${APP_BLUE}12`,
                    }}
                  >
                    <p
                      className="text-[11px] font-medium uppercase tracking-wide"
                      style={{ color: APP_BLUE }}
                    >
                      Available deposit
                    </p>
                    <p
                      className="mt-0.5 text-lg font-bold tabular-nums"
                      style={{ color: APP_NAVY }}
                    >
                      {currency} {formatNumber1(availableDeposit)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
                      Goods in transit
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-950">
                      {currency} {formatNumber1(availableGit)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ArrowRightLeft className="h-4 w-4" style={{ color: APP_BLUE }} />
                    Move deposit → goods in transit
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[8rem] flex-1">
                      <label className="mb-1 block text-xs text-slate-600">
                        Amount
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={moveAmount}
                        onChange={(e) =>
                          setMoveAmount(formatNumberWithCommas(e.target.value))
                        }
                        disabled={
                          moving || applying || writingOff || availableDeposit <= 0
                        }
                        placeholder="0.00"
                        className={fieldClass}
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={
                        moving ||
                        applying ||
                        writingOff ||
                        availableDeposit <= 0 ||
                        !(parseFloat(parseNumberFromFormatted(moveAmount)) > 0)
                      }
                      onClick={handleMoveToGit}
                      className="text-white"
                      style={{ backgroundColor: APP_BLUE }}
                    >
                      <Package className="mr-1.5 h-4 w-4" />
                      {moving ? "Moving…" : "Move to GIT"}
                    </Button>
                    <button
                      type="button"
                      className="text-xs font-medium hover:underline disabled:opacity-40"
                      style={{ color: APP_BLUE }}
                      disabled={moving || writingOff || availableDeposit <= 0}
                      onClick={() =>
                        setMoveAmount(
                          formatNumberWithCommas(availableDeposit.toFixed(2)),
                        )
                      }
                    >
                      Move all
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Trash2 className="h-4 w-4 text-rose-600" />
                    Write off goods in transit
                  </div>
                  <p className="mb-2 text-xs text-slate-600">
                    Posts to Goods in Transit Loss (800904), or Inventory
                    Write-off if that head is missing.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[8rem] flex-1">
                      <label className="mb-1 block text-xs text-slate-600">
                        Amount
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={writeOffAmount}
                        onChange={(e) =>
                          setWriteOffAmount(
                            formatNumberWithCommas(e.target.value),
                          )
                        }
                        disabled={
                          writingOff || moving || applying || availableGit <= 0
                        }
                        placeholder="0.00"
                        className={fieldClass}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        writingOff ||
                        moving ||
                        applying ||
                        availableGit <= 0 ||
                        !(
                          parseFloat(
                            parseNumberFromFormatted(writeOffAmount),
                          ) > 0
                        )
                      }
                      onClick={handleWriteOffGit}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {writingOff ? "Writing off…" : "Write off GIT"}
                    </Button>
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-700 hover:underline disabled:opacity-40"
                      disabled={writingOff || availableGit <= 0}
                      onClick={() =>
                        setWriteOffAmount(
                          formatNumberWithCommas(availableGit.toFixed(2)),
                        )
                      }
                    >
                      Write off all
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div
            className="flex items-center justify-between border-y px-5 py-3"
            style={{
              borderColor: `${APP_BLUE}33`,
              background: `linear-gradient(90deg, ${APP_BLUE}14, ${APP_BLUE}08)`,
            }}
          >
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <FileText className="h-4 w-4" style={{ color: APP_BLUE }} />
              Unpaid Bills
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={seedFifo}
                disabled={applying || !selectedSupplier || sourceBalance <= 0}
                className="cursor-pointer text-left text-sm font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: APP_BLUE }}
              >
                Auto-allocate
              </button>
              <button
                type="button"
                onClick={clearApplied}
                disabled={applying || allocatedSum <= 0}
                className="cursor-pointer text-left text-sm font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: APP_BLUE }}
              >
                Clear Applied
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-5 space-y-4">
            {selectedSupplier && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setApplySource("deposit");
                    autoSeededFor.current = "";
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    applySource === "deposit"
                      ? "text-white border-transparent"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                  style={
                    applySource === "deposit"
                      ? { backgroundColor: APP_BLUE }
                      : undefined
                  }
                >
                  Apply deposit ({formatNumber1(availableDeposit)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApplySource("goods_in_transit");
                    autoSeededFor.current = "";
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    applySource === "goods_in_transit"
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
                >
                  Apply GIT ({formatNumber1(availableGit)})
                </button>
              </div>
            )}

            {!selectedSupplier ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
                Select a vendor to see unpaid bills, deposit, and goods in
                transit.
              </div>
            ) : loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sourceBalance <= 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
                {applySource === "goods_in_transit"
                  ? "No goods in transit. Move deposit to GIT first."
                  : "No available deposit. Record one under New Payment (pay more than the bill) first."}
              </div>
            ) : bills.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
                No unpaid bills for this vendor.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Bill</th>
                      <th className="px-3 py-2.5 text-right">Due</th>
                      <th className="px-3 py-2.5 text-right">Apply</th>
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
                          <td
                            className="px-3 py-2.5 font-medium"
                            style={{ color: APP_BLUE }}
                          >
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
                              className="ml-auto w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/25"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => applyFull(bill)}
                              disabled={applying}
                              className="text-xs font-medium hover:underline disabled:opacity-40"
                              style={{ color: APP_BLUE }}
                            >
                              Full
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
                        Applying{" "}
                        {applySource === "goods_in_transit"
                          ? "goods in transit"
                          : "deposit"}{" "}
                        does not pay new cash.
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

            <div className="flex flex-wrap items-center gap-3 pb-2">
              <button
                type="button"
                onClick={handleApply}
                disabled={!canSubmit}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: APP_BLUE }}
              >
                {applying
                  ? "Applying…"
                  : applySource === "goods_in_transit"
                    ? "Apply GIT to Bills"
                    : "Apply Deposit to Bills"}
              </button>
              <span className="text-xs text-slate-500">
                Remaining{" "}
                {formatNumber1(Math.max(0, sourceBalance - allocatedSum))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
