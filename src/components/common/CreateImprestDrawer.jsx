import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  Loader2,
  X,
  Wallet,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  ListOrdered,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import { useAdvancePaymentAccounts } from "@/components/common/useAdvancePaymentAccounts";
import AdvancePaymentPaymentFields from "@/components/common/AdvancePaymentPaymentFields";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import { isProductTaxable } from "@/utils/taxableStatus";
import { formatExpensePaymentMode } from "@/utils/expensePaymentMode";

const HISTORY_PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

function parseNumberFromFormatted(value) {
  if (value === "" || value === null || value === undefined) return "";
  return String(value).replace(/,/g, "");
}

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

function lineRowTotal(line) {
  const q =
    typeof line.quantity === "number"
      ? line.quantity
      : parseFloat(parseNumberFromFormatted(String(line.quantity))) || 0;
  const c =
    typeof line.unitCost === "number"
      ? line.unitCost
      : parseFloat(parseNumberFromFormatted(String(line.unitCost))) || 0;
  return q * c;
}

/**
 * Tax used for totals: only when a tax is turned on in Apply Taxes (`draftTax`).
 * Stored `line.tax` is ignored until then so toggling off clears VAT from the summary.
 */
function effectiveLineTax(line, draftTax) {
  if (!draftTax) return null;
  if (line?.tax) return line.tax;
  if (
    (isProductTaxable(line?.taxable) || line?.taxable === true) &&
    draftTax
  ) {
    return draftTax;
  }
  return null;
}

/**
 * Percentage rate for VAT; empty rate_type is treated as percent (common API shape).
 */
function getTaxPercentRate(tax) {
  if (!tax) return 0;
  const rateNum =
    parseFloat(String(tax.rate || "0").replace(/,/g, "")) || 0;
  if (rateNum <= 0) return 0;
  const rt = String(tax.rate_type || "").toLowerCase();
  if (rt === "percentage" || rt.includes("percent") || rt === "") {
    return rateNum;
  }
  return 0;
}

/** Exclusive VAT on top (matches direct-expenses). */
function lineExclusiveVat(line, draftTax) {
  const tax = effectiveLineTax(line, draftTax);
  if (!tax) return 0;
  const base = lineRowTotal(line);
  if (String(tax.inclusive_type || "").toLowerCase() === "inclusive")
    return 0;
  const rt = String(tax.rate_type || "").toLowerCase();
  const rateNum =
    parseFloat(String(tax.rate || "0").replace(/,/g, "")) || 0;
  if (rt === "percentage" || rt.includes("percent") || rt === "") {
    return Math.round(base * rateNum * 0.01 * 100) / 100;
  }
  return Math.round(rateNum * 100) / 100;
}

/** VAT embedded in gross when tax is inclusive (display split). */
function lineInclusiveVatExtracted(line, draftTax) {
  const tax = effectiveLineTax(line, draftTax);
  if (!tax || !isTaxInclusiveType(tax)) return 0;
  const gross = lineRowTotal(line);
  const rateNum = getTaxPercentRate(tax);
  if (rateNum <= 0) return 0;
  const net = Math.round((gross / (1 + rateNum * 0.01)) * 100) / 100;
  return Math.round((gross - net) * 100) / 100;
}

/** Subtotal (net): exclusive = entered net; inclusive = gross ex-VAT. */
function lineNetForSubtotal(line, draftTax) {
  const gross = lineRowTotal(line);
  const tax = effectiveLineTax(line, draftTax);
  if (!tax) return gross;
  if (isTaxInclusiveType(tax)) {
    const rateNum = getTaxPercentRate(tax);
    if (rateNum <= 0) return gross;
    return Math.round((gross / (1 + rateNum * 0.01)) * 100) / 100;
  }
  return gross;
}

/** Payable: inclusive = gross line; exclusive = net + VAT on top. */
function linePayableAmount(line, draftTax) {
  const gross = lineRowTotal(line);
  const tax = effectiveLineTax(line, draftTax);
  if (!tax) return gross;
  if (isTaxInclusiveType(tax)) return gross;
  return gross + lineExclusiveVat(line, draftTax);
}

function lineTotalVatDisplay(line, draftTax) {
  return (
    lineExclusiveVat(line, draftTax) + lineInclusiveVatExtracted(line, draftTax)
  );
}

function isTaxInclusiveType(tax) {
  if (!tax) return false;
  const inc = String(tax.inclusive_type || "").toLowerCase();
  if (inc === "inclusive") return true;
  if (inc === "exclusive") return false;
  const tt = String(tax.tax_type || "").toLowerCase();
  return tt === "inclusive";
}

function formatTaxRateForLabel(tax) {
  const rt = String(tax.rate_type || "").toLowerCase();
  const r = tax.rate;
  if (rt === "percentage" || rt.includes("percent") || rt === "") {
    return `${r}%`;
  }
  return String(r ?? "");
}

function taxRecordKey(tax) {
  if (!tax || typeof tax !== "object") return "";
  const id = tax.id ?? tax.tax_id ?? tax.taxId;
  if (id != null && String(id).trim() !== "") return `id:${id}`;
  const desc = String(tax.description || "").trim();
  const rate = String(tax.rate ?? "");
  if (desc || rate) return `h:${desc}|${rate}`;
  return "";
}

/** Line carries a tax object usable for labels / submission (id optional from API). */
function lineHasTaxRecord(ln) {
  const t = ln.tax;
  if (!t || typeof t !== "object") return false;
  return Boolean(taxRecordKey(t));
}

function formatTaxRowLabel(t) {
  const inc = isTaxInclusiveType(t);
  const name = (t.description || "Tax").trim();
  return `${name} (${formatTaxRateForLabel(t)}) · ${inc ? "Inc" : "Exc"}`;
}

/** Same rules as effectiveLineTax — no tax_id unless Apply Taxes has a selection on submit. */
function resolveLineTaxForSubmit(line, draftSelectedTax) {
  if (!draftSelectedTax) return null;
  if (line?.tax) return line.tax;
  if (
    (isProductTaxable(line?.taxable) || line?.taxable === true) &&
    draftSelectedTax
  ) {
    return draftSelectedTax;
  }
  return null;
}

/**
 * Left label for the VAT totals row: uses the tax record(s) on lines (what you turned on).
 */
function vatTotalsLabelFromLines(lines) {
  const withTax = lines.filter((ln) => lineHasTaxRecord(ln));
  if (withTax.length === 0) return "VAT";

  const byKey = new Map();
  for (const ln of withTax) {
    const k = taxRecordKey(ln.tax);
    if (k && !byKey.has(k)) byKey.set(k, ln.tax);
  }
  const unique = [...byKey.values()];
  if (unique.length === 1) {
    return formatTaxRowLabel(unique[0]);
  }
  return unique.map((t) => formatTaxRowLabel(t)).join(" · ");
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

function emptyDraft() {
  return {
    selectedExpense: null,
    /** `null` = use header payment date when adding the line */
    linePaymentDate: null,
    description: "",
    quantity: "1",
    unitCost: "",
    selectedTax: null,
    /** Explicit "taxable" when no tax code is selected (still sends taxable to API). */
    taxableLine: false,
  };
}

/**
 * Imprest drawer: payment mode first, then multiple expense lines (optional purchase tax per line).
 * POST /account/direct-expenses with data[] (tax_id when a tax applies).
 */
export default function CreateImprestDrawer({
  open,
  onOpenChange,
  expenseList,
  facilityId,
  user,
  prefillLine,
  defaultMode = "cash",
  lockMode = false,
  tillMode = null,
  skipReceiptNavigate = false,
  onSuccess,
}) {
  const [lines, setLines] = useState([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [modeOfPayment, setModeOfPayment] = useState("cash");
  const [narration, setNarration] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [taxList, setTaxList] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const [showTaxSelection, setShowTaxSelection] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [impressRows, setImpressRows] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);

  const navigate = useNavigate();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const {
    accountHead,
    setAccountHead,
    bankAccount,
    setBankAccount,
    accountList,
    headList,
  } = useAdvancePaymentAccounts(open, facilityId, modeOfPayment);

  const reset = useCallback(() => {
    setLines([]);
    setDraft(emptyDraft());
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setModeOfPayment(defaultMode || "cash");
    setNarration("");
    setChequeNumber("");
  }, [defaultMode]);

  useEffect(() => {
    if (open) setModeOfPayment(defaultMode || "cash");
  }, [open, defaultMode]);

  const fetchImpressHistory = useCallback(() => {
    const fid = facilityId || activeBusiness?.id;
    if (!fid) {
      toast.error("Business context is required");
      return;
    }
    setLoadingHistory(true);
    const params = new URLSearchParams({
      facilityId: String(fid),
      page: String(historyPage),
      limit: String(historyPageSize),
    });
    _fetchApi(
      `/account/impress?${params.toString()}`,
      (res) => {
        setLoadingHistory(false);
        if (res?.success && Array.isArray(res.results)) {
          setImpressRows(res.results);
          setHistoryTotal(Number(res.total) || 0);
        } else {
          setImpressRows([]);
          setHistoryTotal(0);
          toast.error(res?.message || "Could not load imprest history");
        }
      },
      () => {
        setLoadingHistory(false);
        setImpressRows([]);
        setHistoryTotal(0);
        toast.error("Could not load imprest history");
      }
    );
  }, [facilityId, activeBusiness?.id, historyPage, historyPageSize]);

  useEffect(() => {
    if (!historyOpen) return;
    fetchImpressHistory();
  }, [historyOpen, fetchImpressHistory]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyTotal / historyPageSize) || 1,
  );
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const historyShowingFrom =
    historyTotal === 0 ? 0 : (safeHistoryPage - 1) * historyPageSize + 1;
  const historyShowingTo = Math.min(
    safeHistoryPage * historyPageSize,
    historyTotal,
  );

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  const openImpressHistory = useCallback(() => {
    setHistoryPage(1);
    setHistoryOpen(true);
  }, []);

  const goToImprestReceipt = useCallback(
    (refNumber) => {
      if (!refNumber) return;
      setHistoryOpen(false);
      onOpenChange(false);
      navigate(
        `/app/expenses/billing/imprest-receipt?ref=${encodeURIComponent(String(refNumber))}`
      );
    },
    [navigate, onOpenChange]
  );

  useEffect(() => {
    if (modeOfPayment !== "cheque") setChequeNumber("");
  }, [modeOfPayment]);

  const loadTaxesForFacility = useCallback(() => {
    if (!facilityId) return;
    setLoadingTaxes(true);

    const finish = (list) => {
      setTaxList(Array.isArray(list) ? list : []);
      setLoadingTaxes(false);
    };

    /** Only Purchase-category taxes (imprest = purchase VAT), never Sales. */
    const isPurchaseTax = (t) =>
      String(t?.tax_category || "").toLowerCase() === "purchase";

    const fallbackPurchaseFromAll = () => {
      _fetchApi(
        `/api/taxes?facilityId=${encodeURIComponent(facilityId)}`,
        (res) => {
          const raw = res?.success ? res.results || [] : [];
          const purchaseOnly = raw.filter(isPurchaseTax);
          finish(purchaseOnly);
        },
        () => finish([])
      );
    };

    _fetchApi(
      `/api/get-taxes-by-category?facilityId=${encodeURIComponent(facilityId)}&tax_category=purchase`,
      (response) => {
        let list = response?.success ? response.results || [] : [];
        if (list.length > 0) return finish(list);
        _fetchApi(
          `/api/get-taxes-by-category?facilityId=${encodeURIComponent(facilityId)}&tax_category=${encodeURIComponent("Purchase")}`,
          (r2) => {
            list = r2?.success ? r2.results || [] : [];
            if (list.length > 0) return finish(list);
            fallbackPurchaseFromAll();
          },
          () => fallbackPurchaseFromAll()
        );
      },
      () => fallbackPurchaseFromAll()
    );
  }, [facilityId]);

  useEffect(() => {
    if (!open || !facilityId) return;
    loadTaxesForFacility();
  }, [open, facilityId, loadTaxesForFacility]);

  const filteredTaxes = useMemo(() => {
    if (!taxList?.length) return [];
    return taxList;
  }, [taxList]);

  const toggleDraftTax = (tax) => {
    setDraft((d) => {
      if (d.selectedTax?.id === tax.id) {
        return { ...d, selectedTax: null };
      }
      return { ...d, selectedTax: tax };
    });
  };

  /** Only the "Mark as Taxable" checkbox — independent of Apply Taxes selection. */
  const draftIsTaxable = Boolean(draft.taxableLine);

  const setLineTaxableCheckbox = (lineId, checked) => {
    setLines((prev) =>
      prev.map((ln) => {
        if (ln.id !== lineId) return ln;
        if (!checked) {
          return {
            ...ln,
            taxable: "Non-Taxable",
            tax: null,
          };
        }
        return { ...ln, taxable: "Taxable" };
      })
    );
  };

  const draftLineNet = useMemo(() => {
    const q =
      parseFloat(parseNumberFromFormatted(draft.quantity) || "0") || 0;
    const c =
      parseFloat(parseNumberFromFormatted(draft.unitCost) || "0") || 0;
    return q * c;
  }, [draft.quantity, draft.unitCost]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    reset();
    if (
      prefillLine?.head &&
      expenseList?.length &&
      (prefillLine.description || prefillLine.item_name)
    ) {
      const exp = expenseList.find((e) => e.code === prefillLine.head) || {
        name: prefillLine.item_name || "",
        code: prefillLine.head,
      };
      const qtyParsed = parseNumberFromFormatted(
        String(prefillLine.quantity ?? "1")
      );
      const qty =
        qtyParsed === "" ? 1 : parseFloat(qtyParsed) || 1;
      const costParsed = parseNumberFromFormatted(
        String(prefillLine.cost ?? "")
      );
      const cost = costParsed === "" ? 0 : parseFloat(costParsed) || 0;
      setLines([
        {
          id: uuidv4(),
          expense: exp,
          description:
            prefillLine.description || prefillLine.item_name || "",
          quantity: qty,
          unitCost: cost,
          tax: null,
          taxable:
            isProductTaxable(prefillLine.taxable) ? "Taxable" : "Non-Taxable",
          transaction_date:
            prefillLine.transaction_date ||
            new Date().toISOString().slice(0, 10),
        },
      ]);
    }
  }, [open, facilityId, prefillLine, expenseList, reset]);

  const subtotalNet = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + lineNetForSubtotal(line, draft.selectedTax),
        0
      ),
    [lines, draft.selectedTax]
  );

  const totalVat = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + lineTotalVatDisplay(line, draft.selectedTax),
        0
      ),
    [lines, draft.selectedTax]
  );

  const vatRowLabel = useMemo(() => {
    const fromLines = vatTotalsLabelFromLines(lines);
    if (fromLines !== "VAT") return fromLines;
    const t = draft.selectedTax;
    if (t && taxRecordKey(t)) {
      return formatTaxRowLabel(t);
    }
    return "VAT";
  }, [lines, draft.selectedTax]);

  const grandTotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + linePayableAmount(line, draft.selectedTax),
        0
      ),
    [lines, draft.selectedTax]
  );

  const addLineFromDraft = () => {
    if (!draft.selectedExpense?.code) {
      toast.error("Select an expense account");
      return;
    }
    if (!String(draft.description || "").trim()) {
      toast.error("Enter a line description");
      return;
    }
    const qty = parseFloat(parseNumberFromFormatted(draft.quantity)) || 0;
    const cost = parseFloat(parseNumberFromFormatted(draft.unitCost)) || 0;
    if (qty <= 0 || cost <= 0) {
      toast.error("Enter a valid quantity and unit cost");
      return;
    }
    const taxableStatus = draft.taxableLine ? "Taxable" : "Non-Taxable";
    const lineTxDate = draft.linePaymentDate ?? paymentDate;
    setLines((prev) => [
      ...prev,
      {
        id: uuidv4(),
        expense: {
          name: draft.selectedExpense.name,
          code: draft.selectedExpense.code,
        },
        description: draft.description.trim(),
        quantity: qty,
        unitCost: cost,
        tax: draft.selectedTax,
        taxable: taxableStatus,
        transaction_date: lineTxDate,
      },
    ]);
    setDraft(emptyDraft());
  };

  const removeLine = (id) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!facilityId) {
      toast.error("Missing facility");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one expense line");
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

    setSubmitting(true);
    const data = lines.map((ln) => {
      const isTaxable =
        Boolean(ln.tax) ||
        isProductTaxable(ln.taxable) ||
        ln.taxable === true;
      const row = {
        head: ln.expense.code,
        description: ln.description.trim(),
        quantity: ln.quantity,
        cost: ln.unitCost,
        item_name: ln.expense.name || ln.expense.code,
        taxable: isTaxable ? "Taxable" : "Non-Taxable",
        transaction_date: ln.transaction_date || paymentDate,
      };
      const taxForApi = resolveLineTaxForSubmit(ln, draft.selectedTax);
      const taxId =
        taxForApi?.id ?? taxForApi?.tax_id ?? taxForApi?.taxId;
      if (taxId != null && String(taxId).trim() !== "") {
        row.tax_id = taxId;
      }
      return row;
    });

    const lineDates = lines
      .map((ln) => ln.transaction_date)
      .filter(Boolean)
      .sort();
    const headerPaymentDate =
      lineDates.length > 0 ? lineDates[lineDates.length - 1] : paymentDate;

    const payload = {
      facilityId,
      user_id: user?.id || user?.user_id,
      remark:
        narration.trim() ||
        `Imprest (${lines.length} line${lines.length === 1 ? "" : "s"})`,
      transaction_date: headerPaymentDate,
      mode_of_payment: modeOfPayment,
      accountHead: modeOfPayment === "cash" ? accountHead : {},
      bankAccount: ["bank", "cheque"].includes(modeOfPayment)
        ? bankAccount
        : {},
      cheque_number: modeOfPayment === "cheque" ? chequeNumber : undefined,
      data,
      /** Imprest posts to direct-expenses but must not create a purchase invoice row */
      skip_invoice: true,
      till_mode: tillMode || null,
    };

    _postApi(
      "/account/direct-expenses",
      payload,
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          const displayRef =
            res.data?.reference ||
            res.data?.ref_code ||
            res.data?.impress_ref ||
            "";
          const refCode =
            res.data?.ref_code != null
              ? String(res.data.ref_code)
              : res.data?.impress_ref != null
                ? String(res.data.impress_ref)
                : "";
          toast.success(
            displayRef
              ? `Recorded. Receipt ${displayRef}`
              : "Imprest expense recorded successfully"
          );
          onOpenChange(false);
          onSuccess?.();
          if (refCode && !skipReceiptNavigate) {
            navigate(
              `/app/expenses/billing/imprest-receipt?ref=${encodeURIComponent(refCode)}`
            );
          }
        } else {
          toast.error(res?.message || "Could not record imprest");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(
          err?.error || err?.message || "Could not record imprest expense"
        );
      }
    );
  };

  return (
    <>
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onOpenChange(false);
      }}
    >
        <DrawerContent
        side="right"
        className="bg-white border-slate-200 flex flex-col w-full sm:!max-w-4xl lg:!max-w-5xl"
      >
        <DrawerHeader className="border-b border-slate-200 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-left">
              <DrawerTitle className="text-slate-900 text-xl flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[var(--aa-navy)] shrink-0" />
                Create imprest
              </DrawerTitle>
              <DrawerDescription className="text-slate-600 mt-1">
                Choose payment source first, then add expense lines. For each
                line you can pick a purchase tax from Tax setup (exclusive VAT
                increases the amount paid from cash or bank).
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-6 py-4 space-y-5 flex-1 overflow-y-auto">
            <AdvancePaymentPaymentFields
              idPrefix="imprest"
              modeOfPayment={modeOfPayment}
              onModeChange={lockMode ? () => {} : setModeOfPayment}
              modeLocked={lockMode}
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
              <Label htmlFor="imprest-narration">Narration (optional)</Label>
              <Textarea
                id="imprest-narration"
                rows={2}
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Overall note for this receipt…"
                className="border-slate-200 resize-none"
              />
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-[var(--aa-navy)]/20 bg-[var(--aa-sidebar-active)] px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Package className="h-4 w-4 shrink-0 text-[var(--aa-navy)]" />
                  Expense lines
                </h2>
                <span className="rounded border border-[var(--aa-navy)]/20 bg-white px-2 py-1 text-xs font-medium text-slate-600">
                  {lines.length} line{lines.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[8.5rem]" />
                    <col className="w-[22%]" />
                    <col />
                    <col className="w-[4.75rem]" />
                    <col className="w-[7.5rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[4.25rem]" />
                    <col className="w-[2.75rem]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                        Expense
                      </th>
                      <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                        Description
                      </th>
                      <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                        Qty
                      </th>
                      <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                        Unit Cost
                      </th>
                      <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                        Total
                      </th>
                      <th className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide">
                        Tax
                      </th>
                      <th className="px-1 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((ln) => (
                      <tr
                        key={ln.id}
                        className="bg-white hover:bg-slate-50/80"
                      >
                        <td className="px-2 py-2 align-middle whitespace-nowrap tabular-nums text-slate-700">
                          {ln.transaction_date
                            ? moment(ln.transaction_date).format("DD/MM/YYYY")
                            : "—"}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          <div className="truncate font-medium text-slate-900">
                            {ln.expense.name}
                          </div>
                          <div className="truncate text-[11px] font-mono text-slate-500">
                            {ln.expense.code}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle text-slate-800">
                          <span className="line-clamp-2 break-words">
                            {ln.description}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums text-slate-800">
                          {ln.quantity}
                        </td>
                        <td className="px-2 py-2 align-middle text-right tabular-nums text-slate-800">
                          ₦{formatNumber1(ln.unitCost)}
                        </td>
                        <td className="px-2 py-2 align-middle text-right font-semibold tabular-nums text-slate-900">
                          ₦{formatNumber1(lineRowTotal(ln))}
                        </td>
                        <td className="px-1 py-2 align-middle text-center">
                          <input
                            type="checkbox"
                            checked={isProductTaxable(ln.taxable)}
                            onChange={(e) =>
                              setLineTaxableCheckbox(ln.id, e.target.checked)
                            }
                            className="mx-auto h-4 w-4 rounded border-slate-300 text-[var(--aa-navy)] accent-[var(--aa-navy)] focus:ring-[var(--aa-accent)]/30"
                            aria-label="Taxable"
                          />
                        </td>
                        <td className="px-1 py-2 align-middle text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mx-auto h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => removeLine(ln.id)}
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-slate-50/50">
                      <td className="px-2 py-2 align-middle">
                        <Input
                          id="imprest-draft-line-date"
                          type="date"
                          value={draft.linePaymentDate ?? paymentDate}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              linePaymentDate: e.target.value,
                            }))
                          }
                          className="h-9 w-full border-slate-300 bg-white px-1.5 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <Typeahead
                          id="imprest-draft-expense"
                          options={expenseList || []}
                          placeholder="Select expense…"
                          labelKey={(option) =>
                            `${option.name || ""} (${option.code || ""})`
                          }
                          selected={
                            draft.selectedExpense ? [draft.selectedExpense] : []
                          }
                          onChange={(sel) =>
                            setDraft((d) => ({
                              ...d,
                              selectedExpense: sel?.[0] || null,
                            }))
                          }
                          renderMenuItemChildren={(option) => (
                            <div className="py-1">
                              <div className="font-semibold text-slate-800">
                                {option.name}
                              </div>
                              <small className="text-xs text-slate-600">
                                {option.code}
                              </small>
                            </div>
                          )}
                          clearButton
                          positionFixed
                          className="w-full [&_.rbt-input-main]:h-9 [&_.rbt-input-main]:min-h-9 [&_.rbt-input-main]:rounded-md [&_.rbt-input-main]:border [&_.rbt-input-main]:border-slate-300 [&_.rbt-input-main]:bg-white [&_.rbt-input-main]:px-2 [&_.rbt-input-main]:py-1 [&_.rbt-input-main]:text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <Input
                          id="imprest-draft-desc"
                          value={draft.description}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Description…"
                          className="h-9 w-full border-slate-300 bg-white text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <Input
                          inputMode="decimal"
                          value={draft.quantity}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              quantity: sanitizeAmountInput(e.target.value),
                            }))
                          }
                          placeholder="0"
                          className="h-9 w-full border-slate-300 bg-white px-1.5 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-xs text-slate-500">
                            ₦
                          </span>
                          <Input
                            inputMode="decimal"
                            value={draft.unitCost}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                unitCost: formatNumberWithCommas(
                                  sanitizeAmountInput(e.target.value)
                                ),
                              }))
                            }
                            placeholder="0.00"
                            className="h-9 w-full border-slate-300 bg-white pl-5 pr-1.5 text-right text-sm tabular-nums"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex h-9 w-full items-center justify-end rounded-md border border-slate-200 bg-slate-100 px-1.5 text-sm font-semibold tabular-nums text-slate-800">
                          {formatNumber1(draftLineNet)}
                        </div>
                      </td>
                      <td className="px-1 py-2 align-middle text-center">
                        <input
                          type="checkbox"
                          id="imprest-draft-taxable-line"
                          checked={draftIsTaxable}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              taxableLine: e.target.checked,
                            }))
                          }
                          className="mx-auto h-4 w-4 rounded border-slate-300 text-[var(--aa-navy)] accent-[var(--aa-navy)] focus:ring-[var(--aa-accent)]/30"
                          aria-label="Mark as taxable"
                        />
                      </td>
                      <td className="px-1 py-2 align-middle" />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLineFromDraft}
                  className="h-9 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Add line
                </Button>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 rounded-lg border border-[var(--aa-navy)]/25 bg-[var(--aa-sidebar-active)] px-3 py-3">
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowTaxSelection(!showTaxSelection)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-[var(--aa-navy)] transition-colors"
                    >
                      <span>Apply Taxes</span>
                      {showTaxSelection ? (
                        <ChevronUp className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                    {activeBusiness?.vat_policy && (
                      <span className="text-xs px-2 py-0.5 bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)] rounded font-medium">
                        VAT:{" "}
                        {activeBusiness.vat_policy === "vat_inclusive"
                          ? "Inclusive"
                          : activeBusiness.vat_policy === "vat_exclusive"
                            ? "Exclusive"
                            : "All"}
                      </span>
                    )}
                  </div>
                  {showTaxSelection && filteredTaxes.length > 0 && (
                    <p className="text-xs text-[var(--aa-navy)] mb-2">
                      Both inclusive and exclusive taxes are available. Select one
                      for the next line you add (toggle off to clear).
                    </p>
                  )}

                  {showTaxSelection && (
                    <>
                      {filteredTaxes.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {filteredTaxes.map((tax) => {
                            const isSelected = draft.selectedTax?.id === tax.id;
                            const isInclusive =
                              tax.inclusive_type === "inclusive" ||
                              (tax.inclusive_type === undefined &&
                                tax.tax_type === "inclusive");
                            const isExclusive =
                              tax.inclusive_type === "exclusive" ||
                              (tax.inclusive_type === undefined &&
                                tax.tax_type === "exclusive");
                            const showIncExcBadge = isInclusive || isExclusive;
                            return (
                              <div
                                key={tax.id}
                                className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-[var(--aa-navy)]/40 transition-colors"
                              >
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleDraftTax(tax)}
                                    className="sr-only"
                                  />
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleDraftTax(tax)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ")
                                        toggleDraftTax(tax);
                                    }}
                                    className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${
                                      isSelected ? "bg-[var(--aa-navy)]" : "bg-slate-300"
                                    }`}
                                  >
                                    <div
                                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                        isSelected
                                          ? "transform translate-x-5"
                                          : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                                <span className="text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap">
                                  {tax.description} ({tax.rate}%)
                                  {showIncExcBadge && (
                                    <span
                                      className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                                        isInclusive
                                          ? "bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)]"
                                          : "bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)]"
                                      }`}
                                    >
                                      {isInclusive ? "Inc" : "Exc"}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {filteredTaxes.length === 0 && !loadingTaxes && (
                        <p className="text-xs text-slate-500 mt-2">
                          No taxes available for purchase category
                        </p>
                      )}
                      {loadingTaxes && (
                        <p className="text-xs text-slate-500 mt-2">
                          Loading taxes…
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

                <div className="w-full shrink-0 space-y-2 rounded-lg border border-[var(--aa-navy)]/25 bg-[var(--aa-sidebar-active)] px-3 py-3 text-sm lg:w-72">
                <div className="flex items-baseline justify-between gap-4 text-slate-800">
                  <span>Subtotal (net)</span>
                  <span className="tabular-nums">
                    ₦{formatNumber1(subtotalNet)}
                  </span>
                </div>
                {Math.abs(totalVat) > 1e-9 && (
                  <div className="flex items-baseline justify-between gap-4 text-slate-700">
                    <span className="min-w-0 break-words leading-snug">
                      {vatRowLabel}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      ₦{formatNumber1(totalVat)}
                    </span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t border-[var(--aa-navy)]/25 pt-2 font-semibold text-slate-900">
                  <span>Grand total</span>
                  <span className="text-base font-bold tabular-nums text-[var(--aa-navy)]">
                    ₦{formatNumber1(grandTotal)}
                  </span>
                </div>
              </div>
              </div>
            </div>
          </div>

          <DrawerFooter className="shrink-0 flex-row flex-wrap items-center justify-end gap-2 border-t border-slate-200 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="m-0"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openImpressHistory}
              disabled={submitting}
              className="m-0 gap-1"
            >
              <ListOrdered className="h-4 w-4" />
              View imprest
            </Button>
            <Button
              type="submit"
              disabled={submitting || lines.length === 0}
              className="m-0 border-0 bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy)]/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Record & receipt"
              )}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>

      <Drawer open={historyOpen} onOpenChange={setHistoryOpen}>
        <DrawerContent
          side="right"
          className="bg-white border-slate-200 flex flex-col sm:max-w-lg z-[60]"
        >
          <DrawerHeader className="border-b border-slate-200 shrink-0">
            <DrawerTitle className="text-slate-900 text-lg flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-[var(--aa-navy)] shrink-0" />
              Imprest history
            </DrawerTitle>
            <DrawerDescription className="text-slate-600 text-sm">
              Recent direct-expense (imprest) records. Open a receipt to print.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {loadingHistory && (
              <p className="text-sm text-slate-500 py-6 text-center">
                Loading…
              </p>
            )}
            {!loadingHistory && impressRows.length === 0 && (
              <p className="text-sm text-slate-500 py-6 text-center">
                No imprest records yet.
              </p>
            )}
            {!loadingHistory && impressRows.length > 0 && (
              <ul className="divide-y divide-slate-100 border rounded-lg mt-2">
                {impressRows.map((row) => (
                  <li
                    key={row.id || row.ref_number}
                    className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-slate-900 truncate">
                        {row.reference_display || row.ref_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.transaction_date
                          ? moment(row.transaction_date).format("DD MMM, YYYY")
                          : "—"}{" "}
                        · ₦{formatNumber1(row.total_payment ?? 0)}
                        {" · "}
                        {formatExpensePaymentMode(row.mode_of_payment)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 shrink-0"
                      onClick={() => goToImprestReceipt(row.ref_number)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Receipt
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-700">
                {historyShowingFrom}–{historyShowingTo}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700">{historyTotal}</span>
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Rows</span>
                <Select
                  value={String(historyPageSize)}
                  onValueChange={(value) => {
                    setHistoryPageSize(Number(value));
                    setHistoryPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[72px] border-slate-200 bg-white text-xs shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HISTORY_PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 border-slate-200 p-0"
                  disabled={safeHistoryPage <= 1 || loadingHistory}
                  onClick={() => setHistoryPage(1)}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 border-slate-200 p-0"
                  disabled={safeHistoryPage <= 1 || loadingHistory}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[4.5rem] text-center text-xs text-slate-600">
                  {safeHistoryPage} / {historyTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 border-slate-200 p-0"
                  disabled={
                    safeHistoryPage >= historyTotalPages || loadingHistory
                  }
                  onClick={() =>
                    setHistoryPage((p) =>
                      Math.min(historyTotalPages, p + 1),
                    )
                  }
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 border-slate-200 p-0"
                  disabled={
                    safeHistoryPage >= historyTotalPages || loadingHistory
                  }
                  onClick={() => setHistoryPage(historyTotalPages)}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

CreateImprestDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  expenseList: PropTypes.array,
  facilityId: PropTypes.string,
  user: PropTypes.object,
  prefillLine: PropTypes.object,
  defaultMode: PropTypes.string,
  lockMode: PropTypes.bool,
  tillMode: PropTypes.string,
  skipReceiptNavigate: PropTypes.bool,
  onSuccess: PropTypes.func,
};
