import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";
import moment from "moment";
import { toast } from "sonner";
import { Printer, X } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import BusinessDocumentHeader, {
  getDocumentPrintInColor,
} from "@/components/common/BusinessDocumentHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function formatNumber(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveParty(searchParams) {
  const q = String(searchParams.get("party") || "customer").toLowerCase();
  return q === "vendor" || q === "supplier" ? "vendor" : "customer";
}

function defaultPaperFromBusiness(business) {
  const raw = String(business?.default_receipt_type || "a4")
    .trim()
    .toLowerCase();
  if (raw === "a5") return "a5";
  if (raw === "terminal" || raw === "thermal" || raw === "receipt")
    return "terminal";
  return "a4";
}

export default function CreditNotePreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const userId = user?.id;
  const cnNo = String(
    searchParams.get("cn") || searchParams.get("credit_note") || "",
  ).trim();
  const party = resolveParty(searchParams);
  const isVendor = party === "vendor";
  const apiType = isVendor ? "supplier" : "customer";
  const listPath = isVendor
    ? "/app/payments/credit-note/party-vendor"
    : "/app/payments/credit-note/party-customer";
  const labels = isVendor
    ? {
        singular: "Debit Note",
        party: "Vendor",
        invoice: "Bill",
        apply: "Apply to bills",
        invoices: "bills",
      }
    : {
        singular: "Credit Note",
        party: "Customer",
        invoice: "Invoice",
        apply: "Apply to invoices",
        invoices: "invoices",
      };

  const docRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printPaper, setPrintPaper] = useState(() =>
    defaultPaperFromBusiness(activeBusiness),
  );
  const [printInColor, setPrintInColor] = useState(() =>
    getDocumentPrintInColor(activeBusiness),
  );
  const [showApply, setShowApply] = useState(false);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [applyAmounts, setApplyAmounts] = useState({});
  const [applying, setApplying] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const autoApply = searchParams.get("apply") === "1";
  const autoApplyOpened = useRef(false);

  const isA5 = printPaper === "a5";
  const isTerminal = printPaper === "terminal";
  const pageWidthMm = isTerminal ? 80 : isA5 ? 148 : 210;
  const pageSizeLabel = isTerminal ? "80mm" : isA5 ? "A5" : "A4";

  useEffect(() => {
    setPrintInColor(getDocumentPrintInColor(activeBusiness));
  }, [activeBusiness?.sales_invoice_print_in_color]);

  const fetchDetail = useCallback(() => {
    if (!facilityId || !cnNo) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    _fetchApi(
      `/api/credit-notes/${encodeURIComponent(cnNo)}?facilityId=${facilityId}`,
      (resp) => {
        setLoading(false);
        if (resp?.success) setDetail(resp.data);
        else {
          toast.error(resp?.message || "Credit note not found");
          setDetail(null);
        }
      },
      () => {
        setLoading(false);
        toast.error("Failed to load credit note");
        setDetail(null);
      },
    );
  }, [facilityId, cnNo]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const lineItems = useMemo(() => {
    const rows = Array.isArray(detail?.lineItems) ? detail.lineItems : [];
    if (rows.length) return rows;
    if (detail?.totalAmount > 0) {
      return [
        {
          sku: null,
          item_name:
            String(detail.description || detail.reason || "")
              .split("|")[0]
              .replace(/^Credit Note\s*-\s*/i, "")
              .trim() || "Credit note",
          quantity: 1,
          rate: Number(detail.totalAmount) || 0,
          amount: Number(detail.totalAmount) || 0,
        },
      ];
    }
    return [];
  }, [detail]);

  const openApply = useCallback(
    (doc = detail) => {
      if (!doc?.entityId) {
        toast.error(`${labels.party} not found on this document`);
        return;
      }
      setShowApply(true);
      setLoadingInvoices(true);
      setApplyAmounts({});
      _fetchApi(
        `/api/credit-notes/invoices/${encodeURIComponent(doc.entityId)}?facilityId=${facilityId}&type=${apiType}`,
        (resp) => {
          setLoadingInvoices(false);
          const list = Array.isArray(resp?.data) ? resp.data : [];
          setOpenInvoices(list);
          const seed = {};
          let left = doc.creditsRemaining || 0;
          for (const inv of list) {
            if (left <= 0) break;
            const due = parseFloat(inv.amount) || 0;
            const apply = Math.min(due, left);
            if (apply > 0) {
              seed[inv.invoiceRef || inv.invoice_ref] = String(apply);
              left -= apply;
            }
          }
          setApplyAmounts(seed);
        },
        () => {
          setLoadingInvoices(false);
          setOpenInvoices([]);
          toast.error(`Failed to load open ${labels.invoices}`);
        },
      );
    },
    [detail, labels.party, labels.invoices, facilityId, apiType],
  );

  useEffect(() => {
    if (
      autoApply &&
      !autoApplyOpened.current &&
      detail?.status === "open" &&
      detail?.entityId
    ) {
      autoApplyOpened.current = true;
      openApply(detail);
    }
  }, [autoApply, detail, openApply]);

  const submitApply = () => {
    const applications = Object.entries(applyAmounts)
      .map(([invoiceRef, amount]) => ({
        invoiceRef,
        amount: parseFloat(amount) || 0,
      }))
      .filter((a) => a.amount > 0);
    if (!applications.length) {
      toast.error("Enter at least one amount to apply");
      return;
    }
    setApplying(true);
    _postApi(
      "/api/credit-notes/apply",
      {
        facilityId,
        userId,
        creditNoteNumber: detail.creditNoteNumber,
        applications,
      },
      (resp) => {
        setApplying(false);
        if (!resp?.success) {
          toast.error(resp?.message || "Failed to apply credits");
          return;
        }
        toast.success("Credits applied");
        setShowApply(false);
        fetchDetail();
      },
      () => {
        setApplying(false);
        toast.error("Failed to apply credits");
      },
    );
  };

  const invoiceBwCss = `
    .invoice-bw,
    .invoice-bw *:not(img):not(svg):not(canvas):not(path) {
      background: #fff !important;
      background-color: #fff !important;
      background-image: none !important;
      color: #000 !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    .invoice-bw,
    .invoice-bw * {
      border-color: #111 !important;
      -webkit-print-color-adjust: economy !important;
      print-color-adjust: economy !important;
    }
    .invoice-bw img,
    .invoice-bw svg,
    .invoice-bw canvas {
      filter: grayscale(1) contrast(1.2) !important;
    }
  `;

  const handleReactToPrint = useReactToPrint({
    contentRef: docRef,
    documentTitle: `${detail?.creditNoteNumber || "Credit-Note"}`,
    pageStyle: `
      @page {
        size: ${isTerminal ? "80mm auto" : `${pageSizeLabel} portrait`};
        margin: ${isTerminal ? "2mm" : isA5 ? "6mm" : "0"} !important;
      }
      html, body {
        width: ${pageWidthMm}mm;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        print-color-adjust: ${printInColor ? "exact" : "economy"};
        -webkit-print-color-adjust: ${printInColor ? "exact" : "economy"};
        font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
      }
      ${printInColor ? "" : invoiceBwCss}
      .no-print { display: none !important; }
      .invoice-container {
        width: ${pageWidthMm}mm !important;
        max-width: ${pageWidthMm}mm !important;
        margin: 0 auto !important;
        padding: ${isTerminal ? "2mm" : "4px"} !important;
        box-shadow: none !important;
        border: ${isTerminal ? "none" : "2px solid #1a2d5e"} !important;
        background: #fff !important;
      }
    `,
    onPrintError: () => toast.error("Unable to print. Please try again."),
  });

  const handlePrint = () => {
    if (!docRef.current) {
      toast.error("Document is not ready to print yet.");
      return;
    }
    handleReactToPrint();
  };

  const goBack = () => navigate(listPath);

  if (!cnNo) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">No credit note selected.</p>
        <Button className="mt-3" variant="outline" onClick={goBack}>
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/80 px-3 py-4 sm:px-6">
      <style>{`
        ${printInColor ? "" : invoiceBwCss}
        .invoice-items-table th {
          font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        }
      `}</style>

      <div
        className={`mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 no-print ${
          isTerminal ? "max-w-[80mm]" : isA5 ? "max-w-[148mm]" : "max-w-5xl"
        }`}
      >
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 rounded bg-red-600 px-3 py-0.5 text-sm text-white transition-colors hover:bg-red-700"
        >
          <X size={14} /> Cancel
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
            role="tablist"
            aria-label="Paper size"
          >
            {[
              { id: "a4", label: "A4" },
              { id: "a5", label: "A5" },
              { id: "terminal", label: "Terminal" },
            ].map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={printPaper === opt.id}
                onClick={() => setPrintPaper(opt.id)}
                className={`px-3 py-0.5 text-sm transition-colors ${
                  idx > 0 ? "border-l border-slate-300" : ""
                } ${
                  printPaper === opt.id
                    ? "bg-[var(--aa-navy)] text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div
            className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
            role="tablist"
            aria-label="Print color"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!printInColor}
              onClick={() => setPrintInColor(false)}
              className={`px-3 py-0.5 text-sm transition-colors ${
                !printInColor
                  ? "bg-[var(--aa-navy)] text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Black and white
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={printInColor}
              onClick={() => setPrintInColor(true)}
              className={`border-l border-slate-300 px-3 py-0.5 text-sm transition-colors ${
                printInColor
                  ? "bg-[var(--aa-navy)] text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Color
            </button>
          </div>
          {detail?.status === "open" ? (
            <button
              type="button"
              onClick={() => openApply()}
              className="rounded bg-emerald-600 px-3 py-0.5 text-sm text-white transition-colors hover:bg-emerald-700"
            >
              {labels.apply}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1 rounded bg-[var(--aa-navy)] px-3 py-0.5 text-sm text-white transition-colors hover:bg-blue-700"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className={`mx-auto space-y-3 ${
            isTerminal ? "max-w-[80mm]" : isA5 ? "max-w-[148mm]" : "max-w-5xl"
          }`}
        >
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !detail ? (
        <div className="mx-auto max-w-5xl rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Credit note not found.
        </div>
      ) : isTerminal ? (
        <div
          ref={docRef}
          className={`invoice-container mx-auto max-w-[80mm] bg-white p-2 font-mono text-[11px] leading-snug shadow-sm ${
            printInColor ? "" : "invoice-bw"
          }`}
          style={{ width: "80mm" }}
        >
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-wide">
              {labels.singular}
            </div>
            <div className="mt-1 text-sm font-bold">
              {activeBusiness?.business_name || activeBusiness?.name}
            </div>
            {activeBusiness?.address || activeBusiness?.business_address ? (
              <div className="mt-0.5 text-[10px] text-slate-600">
                {activeBusiness.business_address || activeBusiness.address}
              </div>
            ) : null}
          </div>
          <div className="my-2 border-t border-dashed border-slate-400" />
          <div className="flex justify-between gap-2">
            <span>{detail.creditNoteNumber}</span>
            <span>{moment(detail.date).format("DD/MM/YYYY")}</span>
          </div>
          <div className="mt-1">
            {labels.party}: {detail.entityName}
          </div>
          {detail.entityId ? (
            <div className="text-[10px]">{detail.entityId}</div>
          ) : null}
          {detail.reference ? (
            <div className="text-[10px]">Ref: {detail.reference}</div>
          ) : null}
          <div className="my-2 border-t border-dashed border-slate-400" />
          {lineItems.map((item, idx) => (
            <div key={`${item.sku || item.item_name}-${idx}`} className="mb-1.5">
              <div className="font-semibold">
                {item.item_name || item.description || "Item"}
              </div>
              <div className="flex justify-between gap-2">
                <span>
                  {formatNumber(item.quantity || 1)} x{" "}
                  {formatNumber(item.rate || 0)}
                </span>
                <span>{formatNumber(item.amount || 0)}</span>
              </div>
            </div>
          ))}
          <div className="my-2 border-t border-dashed border-slate-400" />
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{formatNumber(detail.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Applied</span>
            <span>{formatNumber(detail.creditsApplied)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Remaining</span>
            <span>{formatNumber(detail.creditsRemaining)}</span>
          </div>
          {detail.applications?.length ? (
            <>
              <div className="my-2 border-t border-dashed border-slate-400" />
              <div className="text-[10px] font-semibold uppercase">Applied to</div>
              {detail.applications.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between gap-2 text-[10px]"
                >
                  <span>
                    {String(a.invoiceRef).toUpperCase() === "DEPOSIT"
                      ? "Deposit"
                      : String(a.invoiceRef).toUpperCase() === "REFUND"
                        ? "Refund"
                        : a.invoiceRef}
                  </span>
                  <span>{formatNumber(a.amount)}</span>
                </div>
              ))}
            </>
          ) : null}
          <div className="mt-3 text-center text-[10px] uppercase tracking-wide">
            {detail.status}
          </div>
        </div>
      ) : (
        <div
          ref={docRef}
          className={`invoice-container mx-auto border-2 border-[var(--aa-navy,#1a2d5e)] bg-white p-1.5 shadow-sm ${
            isA5 ? "max-w-[148mm] invoice-a5" : "max-w-5xl"
          } ${printInColor ? "" : "invoice-bw"}`}
          style={isA5 ? { width: "148mm" } : undefined}
        >
          <BusinessDocumentHeader
            business={activeBusiness}
            forcePrintInColor={printInColor}
            title={labels.singular}
            numberLabel={`No: ${detail.creditNoteNumber}`}
            warehouse={detail.status === "open" ? "OPEN" : "CLOSED"}
            date={detail.date}
            compact={isA5}
          />

          <div className={`grid gap-1 ${isA5 ? "mb-0.5" : "mb-1"}`}>
            <div
              className={`border border-blue-200 bg-blue-50 ${
                isA5 ? "p-0.5 px-1" : "p-1"
              }`}
            >
              <h6
                className={`font-semibold uppercase tracking-wide text-blue-800 ${
                  isA5 ? "mb-0 text-[10px]" : "text-xs"
                }`}
              >
                Bill To
              </h6>
              <p
                className={`${
                  isA5 ? "text-[10px] leading-snug" : "text-xs leading-relaxed"
                } text-gray-700`}
              >
                <span className="font-semibold text-gray-600">
                  Account Name:
                </span>{" "}
                <span className="text-gray-900">{detail.entityName}</span>
                <span className="mx-1 text-gray-400">|</span>
                <span className="font-semibold text-gray-600">Account No:</span>{" "}
                <span className="text-gray-900">{detail.entityId || "—"}</span>
                {detail.reference ? (
                  <>
                    <span className="mx-1 text-gray-400">|</span>
                    <span className="font-semibold text-gray-600">Reference:</span>{" "}
                    <span className="text-gray-900">{detail.reference}</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className={isA5 ? "mb-0.5" : "mb-1"}>
            <table className="invoice-items-table w-full border-collapse overflow-hidden border border-gray-300 shadow-sm">
              <thead>
                <tr className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white">
                  <th
                    className={`border-r border-[var(--aa-accent)] text-center font-semibold tracking-wide ${
                      isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                    }`}
                  >
                    #
                  </th>
                  <th
                    className={`border-r border-[var(--aa-accent)] text-left font-semibold tracking-wide ${
                      isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                    }`}
                  >
                    Description/Size
                  </th>
                  <th
                    className={`border-r border-[var(--aa-accent)] text-center font-semibold tracking-wide ${
                      isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                    }`}
                  >
                    Quantity
                  </th>
                  <th
                    className={`border-r border-[var(--aa-accent)] text-right font-semibold tracking-wide ${
                      isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                    }`}
                  >
                    Unit Price(₦)
                  </th>
                  <th
                    className={`text-right font-semibold tracking-wide ${
                      isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                    }`}
                  >
                    Amount(₦)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {lineItems.map((item, index) => (
                  <tr
                    key={`${item.sku || item.item_name}-${index}`}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td
                      className={`border-r border-t border-gray-200 text-center font-semibold text-gray-600 ${
                        isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                      }`}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={`border-r border-t border-gray-200 ${
                        isA5
                          ? "px-1.5 py-1 text-[12px]"
                          : "px-2.5 py-2 text-[15px]"
                      }`}
                    >
                      <span className="font-semibold leading-snug text-gray-900">
                        {item.item_name || item.description || "Item"}
                      </span>
                      {item.sku ? (
                        <div className="font-mono text-[10px] font-normal text-gray-500">
                          {item.sku}
                        </div>
                      ) : null}
                    </td>
                    <td
                      className={`border-r border-t border-gray-200 text-center tabular-nums text-gray-800 ${
                        isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                      }`}
                    >
                      {formatNumber(item.quantity || 1)}
                    </td>
                    <td
                      className={`border-r border-t border-gray-200 text-right tabular-nums text-gray-800 ${
                        isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                      }`}
                    >
                      {formatNumber(item.rate || 0)}
                    </td>
                    <td
                      className={`border-t border-gray-200 text-right font-semibold tabular-nums text-gray-900 ${
                        isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"
                      }`}
                    >
                      {formatNumber(item.amount || 0)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-blue-200 bg-blue-50">
                  <td colSpan="2" />
                  <td className="border-r border-t border-gray-300 px-2 py-1.5 text-center text-xs font-semibold text-gray-700">
                    {formatNumber(
                      lineItems.reduce(
                        (sum, item) => sum + Number(item.quantity || 1),
                        0,
                      ),
                    )}
                  </td>
                  <td className="border-r border-t border-gray-300" />
                  <td className="border-t border-gray-300 px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    {formatNumber(
                      lineItems.reduce(
                        (sum, item) => sum + Number(item.amount || 0),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            className={`ml-auto grid gap-0.5 ${
              isA5 ? "max-w-[9rem] text-[10px]" : "max-w-xs text-sm"
            }`}
          >
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Sub total</span>
              <span className="tabular-nums">
                {formatNumber(detail.subtotal ?? detail.totalAmount)}
              </span>
            </div>
            {Number(detail.vatAmount) > 0.009 ? (
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">VAT</span>
                <span className="tabular-nums">
                  {formatNumber(detail.vatAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-gray-300 pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                ₦{formatNumber(detail.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-gray-600">
              <span>Applied</span>
              <span className="tabular-nums">
                {formatNumber(detail.creditsApplied)}
              </span>
            </div>
            <div className="flex justify-between gap-4 font-semibold">
              <span>Credits remaining</span>
              <span className="tabular-nums">
                {formatNumber(detail.creditsRemaining)}
              </span>
            </div>
          </div>

          {detail.applications?.length > 0 ? (
            <div className={`mt-3 ${isA5 ? "text-[10px]" : "text-xs"}`}>
              <div
                className={`mb-1 font-semibold uppercase tracking-wide text-blue-800 ${
                  isA5 ? "text-[10px]" : "text-xs"
                }`}
              >
                Applications
              </div>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-slate-50 text-left text-gray-600">
                    <th className="border border-gray-300 px-2 py-1 font-semibold">
                      {labels.invoice}
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-semibold">
                      Amount
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-semibold">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.applications.map((a) => (
                    <tr key={a.id}>
                      <td className="border border-gray-300 px-2 py-1 font-mono">
                        {String(a.invoiceRef).toUpperCase() === "REFUND"
                          ? "Refund (cash / bank)"
                          : String(a.invoiceRef).toUpperCase() === "DEPOSIT"
                            ? "Customer deposit"
                            : a.invoiceRef}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">
                        {formatNumber(a.amount)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right text-gray-600">
                        {moment(a.date).format("DD MMM YYYY")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {showApply && detail ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 no-print">
          <div className="my-8 w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="font-semibold text-slate-900">{labels.apply}</h3>
                <p className="text-xs text-slate-500">
                  {detail.creditNoteNumber} · Remaining{" "}
                  {formatNumber(detail.creditsRemaining)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowApply(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-3">
              {loadingInvoices ? (
                <Skeleton className="h-20 w-full" />
              ) : openInvoices.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No open {labels.invoices} for this {labels.party.toLowerCase()}.
                </p>
              ) : (
                openInvoices.map((inv) => {
                  const ref = inv.invoiceRef || inv.invoice_ref;
                  return (
                    <div
                      key={ref}
                      className="flex items-center justify-between gap-3 rounded border border-slate-100 p-2"
                    >
                      <div>
                        <div className="font-mono text-sm font-semibold">
                          {ref}
                        </div>
                        <div className="text-xs text-slate-500">
                          Due {formatNumber(inv.amount)}
                        </div>
                      </div>
                      <Input
                        className="w-28 text-right"
                        value={applyAmounts[ref] || ""}
                        onChange={(e) =>
                          setApplyAmounts((s) => ({
                            ...s,
                            [ref]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <Button variant="outline" onClick={() => setShowApply(false)}>
                Cancel
              </Button>
              <Button onClick={submitApply} disabled={applying}>
                {applying ? "Applying…" : "Apply credits"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
