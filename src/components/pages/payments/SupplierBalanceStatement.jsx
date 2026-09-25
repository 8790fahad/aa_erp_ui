import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";
import moment from "moment";
import { toast } from "sonner";
import { Printer, Search, X } from "lucide-react";
import useQuery from "@/hooks/useQuery";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import BusinessDocumentHeader, {
  getDocumentPrintInColor,
} from "@/components/common/BusinessDocumentHeader";
import { Button } from "@/components/ui/button";

const receiptBwCss = `
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

function defaultPaperFromBusiness(business) {
  const raw = String(business?.default_receipt_type || "a4")
    .trim()
    .toLowerCase();
  if (raw === "a5") return "a5";
  if (raw === "terminal" || raw === "thermal" || raw === "receipt")
    return "terminal";
  return "a4";
}

/**
 * Printable supplier advance + open-bill balance statement.
 * Route: /app/payments/pay-bills/balance-statement?supplier_no=...&as_at=YYYY-MM-DD
 */
export default function SupplierBalanceStatement() {
  const navigate = useNavigate();
  const query = useQuery();
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;

  const initialSupplierNo = String(query.get("supplier_no") || "").trim();
  const initialName = String(query.get("name") || "").trim();
  const asAt =
    String(query.get("as_at") || "").trim() || moment().format("YYYY-MM-DD");

  const [supplierNo, setSupplierNo] = useState(initialSupplierNo);
  const [lookupInput, setLookupInput] = useState(initialSupplierNo);
  const [supplier, setSupplier] = useState({
    supplier_number: initialSupplierNo,
    supplier_name: initialName || initialSupplierNo,
    phone: "",
    address: "",
  });
  const [advance, setAdvance] = useState(0);
  const [billsDue, setBillsDue] = useState(0);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(Boolean(initialSupplierNo));
  const [printPaper, setPrintPaper] = useState(() =>
    defaultPaperFromBusiness(activeBusiness),
  );
  const [printInColor, setPrintInColor] = useState(() =>
    getDocumentPrintInColor(activeBusiness),
  );
  const printRef = useRef(null);

  const isA5 = printPaper === "a5";
  const isTerminal = printPaper === "terminal";
  const pageWidthMm = isTerminal ? 80 : isA5 ? 148 : 210;
  const pageSizeLabel = isTerminal ? "80mm" : isA5 ? "A5" : "A4";
  const previewMaxClass = isTerminal
    ? "max-w-[80mm]"
    : isA5
      ? "max-w-[148mm]"
      : "max-w-[210mm]";

  useEffect(() => {
    setPrintInColor(getDocumentPrintInColor(activeBusiness));
  }, [activeBusiness]);

  useEffect(() => {
    setPrintPaper(defaultPaperFromBusiness(activeBusiness));
  }, [activeBusiness?.default_receipt_type]);

  const loadStatement = useCallback(
    (no) => {
      const supplierNoSafe = String(no || "").trim();
      if (!facilityId || !supplierNoSafe) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setSupplierNo(supplierNoSafe);
      _postApi(
        "/account/supplier-balance-statement",
        {
          facilityId,
          supplierNo: supplierNoSafe,
          asAtDate: asAt,
        },
        (resp) => {
          setLoading(false);
          if (!resp?.success) {
            toast.error(resp?.message || "Failed to load supplier balance");
            setAdvance(0);
            setBillsDue(0);
            setBills([]);
            return;
          }
          const data = resp.data || {};
          const row = data.supplier || {};
          setSupplier({
            supplier_number: row.supplier_number || supplierNoSafe,
            supplier_name:
              row.supplier_name || initialName || supplierNoSafe,
            phone: row.phone || "",
            address: row.address || "",
          });
          setAdvance(Number(data.advance) || 0);
          setBillsDue(Number(data.billsDue) || 0);
          setBills(Array.isArray(data.bills) ? data.bills : []);
        },
        () => {
          setLoading(false);
          toast.error("Failed to load supplier balance");
          setAdvance(0);
          setBillsDue(0);
          setBills([]);
        },
      );
    },
    [facilityId, asAt, initialName],
  );

  useEffect(() => {
    if (initialSupplierNo) loadStatement(initialSupplierNo);
  }, [initialSupplierNo, loadStatement]);

  const pageStyle = useMemo(
    () => `
      @page {
        size: ${isTerminal ? "80mm auto" : `${pageSizeLabel} portrait`};
        margin: ${isTerminal ? "2mm" : isA5 ? "6mm" : "10mm"} !important;
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
      ${printInColor ? "" : receiptBwCss}
      .no-print { display: none !important; }
      .statement-container {
        width: ${pageWidthMm}mm !important;
        max-width: ${pageWidthMm}mm !important;
        margin: 0 auto !important;
        padding: ${isTerminal ? "2mm" : isA5 ? "3mm" : "4mm"} !important;
        box-shadow: none !important;
        border: ${isTerminal ? "none" : "2px solid #1a2d5e"} !important;
        background: #fff !important;
      }
    `,
    [isTerminal, isA5, pageSizeLabel, pageWidthMm, printInColor],
  );

  const handleReactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Supplier-Balance-${supplierNo || "N/A"}`,
    pageStyle,
    onPrintError: () => toast.error("Unable to print. Please try again."),
  });

  const handlePrint = () => {
    if (!supplierNo) {
      toast.error("Enter a supplier ID first");
      return;
    }
    if (!printRef.current) {
      toast.error("Statement is not ready to print yet");
      return;
    }
    handleReactToPrint();
  };

  const handleLookup = (e) => {
    e?.preventDefault?.();
    const q = String(lookupInput || "").trim();
    if (!q) {
      toast.error("Enter a supplier ID");
      return;
    }
    navigate(
      `/app/payments/pay-bills/balance-statement?supplier_no=${encodeURIComponent(
        q,
      )}&as_at=${encodeURIComponent(asAt)}`,
      { replace: true },
    );
    loadStatement(q);
  };

  const displayName = supplier.supplier_name || supplierNo;
  const asAtLabel = moment(asAt).format("DD MMM YYYY");
  const netBalance = Number(billsDue || 0) - Number(advance || 0);
  const netLabel =
    netBalance > 0.005
      ? "Amount still payable after advance"
      : netBalance < -0.005
        ? "Surplus advance after bills"
        : "Balances offset";
  const netAbs = Math.abs(netBalance);
  const poweredByText = (() => {
    const configured = activeBusiness?.invoice_powered_by;
    if (configured === undefined || configured === null) {
      return "This solution is powered by Nexifour Limited";
    }
    return String(configured).trim();
  })();
  const cell = isA5 ? "px-1.5 py-1.5" : "px-3 py-3";
  const amountClass = isA5 ? "px-1.5 py-1.5 text-[12px]" : "px-3 py-3 text-base";

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <style>{printInColor ? "" : receiptBwCss}</style>
      <div
        className={`mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 no-print ${previewMaxClass}`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/app/reports/accounting-reports/creditors-report")}
        >
          <X className="mr-1 h-4 w-4" />
          Close
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleLookup} className="flex items-center gap-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="Supplier ID"
                className="w-36 rounded-md border border-slate-300 py-1.5 pl-7 pr-2 text-sm sm:w-40"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Load
            </Button>
          </form>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white">
            {[
              { id: "a4", label: "A4" },
              { id: "a5", label: "A5" },
              { id: "terminal", label: "Terminal" },
            ].map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPrintPaper(opt.id)}
                className={`px-3 py-0.5 text-sm ${
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
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white">
            <button
              type="button"
              onClick={() => setPrintInColor(false)}
              className={`px-3 py-0.5 text-sm ${
                !printInColor
                  ? "bg-[var(--aa-navy)] text-white"
                  : "bg-white text-slate-700"
              }`}
            >
              Black and white
            </button>
            <button
              type="button"
              onClick={() => setPrintInColor(true)}
              className={`border-l border-slate-300 px-3 py-0.5 text-sm ${
                printInColor
                  ? "bg-[var(--aa-navy)] text-white"
                  : "bg-white text-slate-700"
              }`}
            >
              Color
            </button>
          </div>
          <Button
            size="sm"
            className="gap-1 bg-[var(--aa-navy)] text-white hover:opacity-90"
            onClick={handlePrint}
            disabled={loading || !supplierNo}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={`mx-auto space-y-3 ${previewMaxClass}`}>
          <div className="h-28 animate-pulse rounded bg-slate-200" />
          <div className="h-48 animate-pulse rounded bg-slate-200" />
        </div>
      ) : !supplierNo ? (
        <div
          className={`mx-auto rounded border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 ${previewMaxClass}`}
        >
          Enter a supplier ID above to load and print advance and bill balances.
        </div>
      ) : (
        <div
          ref={printRef}
          className={`statement-container mx-auto bg-white shadow-sm ${
            isTerminal ? "font-mono text-[11px] leading-snug" : "border-2 border-[var(--aa-navy,#1a2d5e)]"
          } ${printInColor ? "" : "invoice-bw"}`}
          style={{ width: `${pageWidthMm}mm`, maxWidth: `${pageWidthMm}mm` }}
        >
          <div className={isTerminal ? "" : isA5 ? "p-1.5" : "p-3 sm:p-4"}>
            {isTerminal ? (
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-wide">
                  Supplier Balance Statement
                </div>
                <div className="mt-1 text-xs font-bold leading-tight">
                  {activeBusiness?.business_name || activeBusiness?.name}
                </div>
              </div>
            ) : (
              <BusinessDocumentHeader
                business={activeBusiness}
                forcePrintInColor={printInColor}
                title="SUPPLIER BALANCE STATEMENT"
                numberLabel={supplierNo ? `Supplier: ${supplierNo}` : ""}
                date={asAt}
                compact={isA5}
              />
            )}

            <div
              className={`rounded border border-slate-200 bg-slate-50 ${
                isA5 || isTerminal ? "mb-2 p-1.5 text-[11px]" : "mb-3 p-3 text-sm"
              }`}
            >
              <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                Supplier
              </div>
              <div className={`font-semibold text-slate-900 ${isA5 ? "text-[13px]" : "text-base"}`}>
                {displayName}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-slate-600 text-[10px]">
                <span>
                  <span className="font-medium">ID:</span> {supplierNo}
                </span>
                {supplier.phone ? (
                  <span>
                    <span className="font-medium">Phone:</span> {supplier.phone}
                  </span>
                ) : null}
                {supplier.address ? (
                  <span>
                    <span className="font-medium">Address:</span> {supplier.address}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                Balances as at {asAtLabel}
              </div>
            </div>

            <table className={`w-full border-collapse ${isA5 ? "mb-2 text-[11px]" : "mb-3 text-sm"}`}>
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50 text-left text-[9px] uppercase tracking-wide text-slate-500">
                  <th className={`${cell} font-semibold`}>Description</th>
                  <th className={`${cell} text-right font-semibold`}>Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className={cell}>
                    <div className="font-medium text-slate-900">Advance balance</div>
                    <div className="text-[9px] leading-snug text-slate-500">
                      Cash already paid to this supplier, available to apply to bills
                    </div>
                  </td>
                  <td className={`${amountClass} text-right font-semibold tabular-nums`}>
                    {formatNumber1(advance)}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className={cell}>
                    <div className="font-medium text-slate-900">Bill balance</div>
                    <div className="text-[9px] leading-snug text-slate-500">
                      Amount still owed on open bills
                      {bills.length
                        ? ` (${bills.length} bill${bills.length === 1 ? "" : "s"})`
                        : ""}
                    </div>
                  </td>
                  <td className={`${amountClass} text-right font-semibold tabular-nums`}>
                    {formatNumber1(billsDue)}
                  </td>
                </tr>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className={cell}>
                    <div className="font-semibold text-slate-900">Net balance</div>
                    <div className="text-[9px] leading-snug text-slate-500">{netLabel}</div>
                  </td>
                  <td className={`${amountClass} text-right font-bold tabular-nums`}>
                    {netBalance < -0.005 ? "(" : ""}
                    {formatNumber1(netAbs)}
                    {netBalance < -0.005 ? ")" : ""}
                  </td>
                </tr>
              </tbody>
            </table>

            {bills.length > 0 ? (
              <div className={isA5 ? "mb-2" : "mb-3"}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Bills
                </div>
                <table className={`w-full border-collapse ${isA5 ? "text-[10px]" : "text-xs"}`}>
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50 text-left text-[9px] uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-1.5 font-semibold">Bill</th>
                      <th className="px-2 py-1.5 font-semibold">Date</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Bill (₦)</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Paid (₦)</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Due (₦)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.reference} className="border-b border-slate-100">
                        <td className="px-2 py-1.5 font-mono">{bill.reference}</td>
                        <td className="px-2 py-1.5">
                          {bill.transactionDate
                            ? moment(bill.transactionDate).format("DD MMM YYYY")
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatNumber1(bill.amount)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatNumber1(bill.paid)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                          {formatNumber1(bill.due)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                      <td className="px-2 py-1.5" colSpan={4}>
                        Total bills due
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatNumber1(billsDue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={`text-slate-500 ${isA5 ? "mb-2 text-[10px]" : "mb-3 text-xs"}`}>
                No open bills for this supplier.
              </p>
            )}

            <div
              className={`mx-auto grid max-w-md grid-cols-2 text-center text-slate-600 ${
                isA5 ? "mt-3 gap-4 text-[10px]" : "mt-6 gap-8 text-xs"
              }`}
            >
              <div>
                <div className={`border-b border-slate-500 ${isA5 ? "mb-1 h-8" : "mb-1.5 h-12"}`} />
                <div>Supplier signature</div>
              </div>
              <div>
                <div className={`border-b border-slate-500 ${isA5 ? "mb-1 h-8" : "mb-1.5 h-12"}`} />
                <div>Authorized signature</div>
              </div>
            </div>
            <p className={`text-center text-slate-400 ${isA5 ? "mt-2 text-[9px]" : "mt-4 text-[10px]"}`}>
              Generated {moment().format("DD MMM YYYY HH:mm")}
            </p>
            {poweredByText ? (
              <p className={`text-center text-slate-400 ${isA5 ? "mt-0.5 text-[8px]" : "mt-1 text-[9px]"}`}>
                {poweredByText}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
