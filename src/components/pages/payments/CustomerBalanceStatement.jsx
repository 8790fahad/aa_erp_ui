import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useReactToPrint } from "react-to-print";
import moment from "moment";
import { toast } from "sonner";
import { Printer, X, Search } from "lucide-react";
import useQuery from "@/hooks/useQuery";
import { _fetchApi } from "@/redux/actions/api";
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
 * Printable customer deposit + credit balance statement.
 * Route: /app/payments/receive-payment/balance-statement?customer_no=...&as_at=YYYY-MM-DD
 */
export default function CustomerBalanceStatement() {
  const navigate = useNavigate();
  const query = useQuery();
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;

  const initialCustomerNo = String(query.get("customer_no") || "").trim();
  const initialName = String(query.get("name") || "").trim();
  const asAt =
    String(query.get("as_at") || "").trim() || moment().format("YYYY-MM-DD");

  const [customerNo, setCustomerNo] = useState(initialCustomerNo);
  const [lookupInput, setLookupInput] = useState(initialCustomerNo);
  const [customer, setCustomer] = useState({
    customerNo: initialCustomerNo,
    fullname: initialName || initialCustomerNo,
    phone: "",
    address: "",
  });
  const [deposit, setDeposit] = useState(0);
  const [credit, setCredit] = useState(0);
  const [creditInvoices, setCreditInvoices] = useState([]);
  const [loading, setLoading] = useState(Boolean(initialCustomerNo));
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

  const loadBalances = useCallback(
    (no) => {
      const customerNoSafe = String(no || "").trim();
      if (!facilityId || !customerNoSafe) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setCustomerNo(customerNoSafe);

      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending <= 0) setLoading(false);
      };

      _fetchApi(
        `/api/v1/get-customer-balance/${encodeURIComponent(
          customerNoSafe,
        )}/${encodeURIComponent(facilityId)}`,
        (bal) => {
          if (!bal?.success) {
            toast.error(bal?.message || bal?.error || "Failed to load balances");
            setDeposit(0);
            done();
            return;
          }
          setDeposit(Number(bal.deposit) || 0);
          done();
        },
        () => {
          toast.error("Failed to load customer balances");
          setDeposit(0);
          done();
        },
      );

      _fetchApi(
        `/api/v1/get-outstanding-invoices?customerNo=${encodeURIComponent(
          customerNoSafe,
        )}&facilityId=${encodeURIComponent(facilityId)}`,
        (invResp) => {
          const list = Array.isArray(invResp?.results) ? invResp.results : [];
          const mapped = list
            .map((inv) => ({
              invoiceRef: inv.invoice_ref,
              transactionDate: inv.transaction_date,
              amount: Number(inv.amount) || 0,
              totalPaid: Number(inv.total_paid) || 0,
              balanceDue: Number(inv.amount_due ?? inv.balance_due) || 0,
              status: inv.status || "",
            }))
            .filter((inv) => inv.balanceDue > 0.001)
            .sort((a, b) => {
              const da = a.transactionDate
                ? new Date(a.transactionDate).getTime()
                : 0;
              const db = b.transactionDate
                ? new Date(b.transactionDate).getTime()
                : 0;
              return da - db;
            });
          setCreditInvoices(mapped);
          setCredit(
            mapped.reduce((s, inv) => s + (Number(inv.balanceDue) || 0), 0),
          );
          done();
        },
        () => {
          toast.error("Failed to load credit invoices");
          setCreditInvoices([]);
          setCredit(0);
          done();
        },
      );

      _fetchApi(
        `/get-customer-by-id?customer_id=${encodeURIComponent(
          customerNoSafe,
        )}&facilityId=${encodeURIComponent(facilityId)}`,
        (custResp) => {
          const c =
            custResp?.customer ||
            custResp?.data ||
            custResp?.results ||
            custResp;
          const row = Array.isArray(c) ? c[0] : c;
          if (row && (row.customerNo || row.fullname || row.customer_id)) {
            setCustomer({
              customerNo: row.customerNo || row.customer_id || customerNoSafe,
              fullname:
                row.fullname ||
                row.name ||
                row.store_name ||
                initialName ||
                customerNoSafe,
              phone: row.phone || "",
              address: row.address || "",
            });
          } else {
            setCustomer((prev) => ({
              ...prev,
              customerNo: customerNoSafe,
              fullname: prev.fullname || initialName || customerNoSafe,
            }));
          }
        },
        () => {
          setCustomer((prev) => ({
            ...prev,
            customerNo: customerNoSafe,
            fullname: prev.fullname || initialName || customerNoSafe,
          }));
        },
      );
    },
    [facilityId, initialName],
  );

  useEffect(() => {
    if (initialCustomerNo) loadBalances(initialCustomerNo);
  }, [initialCustomerNo, loadBalances]);

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
    documentTitle: `Customer-Balance-${customerNo || "N/A"}`,
    pageStyle,
    onPrintError: () => toast.error("Unable to print. Please try again."),
  });

  const handlePrint = () => {
    if (!customerNo) {
      toast.error("Enter a customer ID first");
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
      toast.error("Enter a customer ID");
      return;
    }
    navigate(
      `/app/payments/receive-payment/balance-statement?customer_no=${encodeURIComponent(
        q,
      )}&as_at=${encodeURIComponent(asAt)}`,
      { replace: true },
    );
    loadBalances(q);
  };

  const displayName = customer.fullname || customerNo;
  const asAtLabel = moment(asAt).format("DD MMM YYYY");
  // Net receivable: what the customer still owes after available deposit.
  const netBalance = Number(credit || 0) - Number(deposit || 0);
  const netLabel =
    netBalance > 0.005
      ? "Amount still receivable after deposit"
      : netBalance < -0.005
        ? "Surplus deposit after credit"
        : "Balances offset";
  const netAbs = Math.abs(netBalance);
  const poweredByText = (() => {
    const configured = activeBusiness?.invoice_powered_by;
    if (configured === undefined || configured === null) {
      return "This solution is powered by Nexifour Limited";
    }
    return String(configured).trim();
  })();

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <style>{printInColor ? "" : receiptBwCss}</style>

      <div
        className={`mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 no-print ${previewMaxClass}`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/app/payments/receive-payment")}
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
                placeholder="Customer ID"
                className="w-36 rounded-md border border-slate-300 py-1.5 pl-7 pr-2 text-sm sm:w-40"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Load
            </Button>
          </form>

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

          <Button
            size="sm"
            className="gap-1 bg-[var(--aa-navy)] text-white hover:opacity-90"
            onClick={handlePrint}
            disabled={loading || !customerNo}
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
      ) : !customerNo ? (
        <div
          className={`mx-auto rounded border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 ${previewMaxClass}`}
        >
          Enter a customer ID above to load and print deposit and credit
          balances.
        </div>
      ) : isTerminal ? (
        <div
          ref={printRef}
          className={`statement-container mx-auto bg-white font-mono text-[11px] leading-snug shadow-sm ${
            printInColor ? "" : "invoice-bw"
          }`}
          style={{ width: "80mm", maxWidth: "80mm" }}
        >
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wide">
              Balance Statement
            </div>
            <div className="mt-1 text-xs font-bold leading-tight">
              {activeBusiness?.business_name || activeBusiness?.name}
            </div>
            {activeBusiness?.address || activeBusiness?.business_address ? (
              <div className="mt-0.5 text-[9px] text-slate-600">
                {activeBusiness.business_address || activeBusiness.address}
              </div>
            ) : null}
          </div>

          <div className="my-2 border-t border-dashed border-slate-400" />

          <div className="flex justify-between gap-2 text-[10px]">
            <span>{customerNo}</span>
            <span>{asAtLabel}</span>
          </div>
          <div className="mt-1 font-semibold leading-tight">{displayName}</div>
          {customer.phone ? (
            <div className="text-[10px] text-slate-600">{customer.phone}</div>
          ) : null}

          <div className="my-2 border-t border-dashed border-slate-400" />

          <div className="mb-1.5 flex justify-between gap-2">
            <span>Deposit</span>
            <span className="font-semibold tabular-nums">
              {formatNumber1(deposit)}
            </span>
          </div>
          <div className="mb-1.5 flex justify-between gap-2">
            <span>Credit</span>
            <span className="font-semibold tabular-nums">
              {formatNumber1(credit)}
            </span>
          </div>
          {creditInvoices.length > 0 ? (
            <div className="mb-1.5 space-y-0.5 border-t border-dashed border-slate-300 pt-1 text-[9px]">
              {creditInvoices.slice(0, 12).map((inv) => (
                <div key={inv.invoiceRef} className="flex justify-between gap-1">
                  <span className="truncate">{inv.invoiceRef}</span>
                  <span className="tabular-nums">
                    {formatNumber1(inv.balanceDue)}
                  </span>
                </div>
              ))}
              {creditInvoices.length > 12 ? (
                <div className="text-slate-500">
                  +{creditInvoices.length - 12} more invoice(s)
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="my-1.5 border-t border-dashed border-slate-400" />
          <div className="flex justify-between gap-2 font-bold">
            <span>Net</span>
            <span className="tabular-nums">
              {netBalance < -0.005 ? "(" : ""}
              {formatNumber1(netAbs)}
              {netBalance < -0.005 ? ")" : ""}
            </span>
          </div>
          <div className="mt-0.5 text-[9px] text-slate-500">{netLabel}</div>

          <div className="my-2 border-t border-dashed border-slate-400" />
          <div className="text-center text-[9px] text-slate-500">
            Generated {moment().format("DD MMM YYYY HH:mm")}
          </div>
          {poweredByText ? (
            <div className="mt-1 text-center text-[8px] leading-snug text-slate-400">
              {poweredByText}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          ref={printRef}
          className={`statement-container mx-auto border-2 border-[var(--aa-navy,#1a2d5e)] bg-white shadow-sm ${
            printInColor ? "" : "invoice-bw"
          }`}
          style={{
            width: `${pageWidthMm}mm`,
            maxWidth: `${pageWidthMm}mm`,
          }}
        >
          <div className={isA5 ? "p-1.5" : "p-3 sm:p-4"}>
            <BusinessDocumentHeader
              business={activeBusiness}
              forcePrintInColor={printInColor}
              title="CUSTOMER BALANCE STATEMENT"
              numberLabel={customerNo ? `Customer: ${customerNo}` : ""}
              date={asAt}
              compact={isA5}
            />

            <div
              className={`rounded border border-slate-200 bg-slate-50 ${
                isA5 ? "mb-2 p-1.5 text-[11px]" : "mb-3 p-3 text-sm"
              }`}
            >
              <div
                className={`font-semibold uppercase tracking-wide text-slate-500 ${
                  isA5 ? "mb-0.5 text-[9px]" : "mb-1 text-[10px]"
                }`}
              >
                Customer
              </div>
              <div
                className={`font-semibold text-slate-900 ${
                  isA5 ? "text-[13px] leading-tight" : "text-base"
                }`}
              >
                {displayName}
              </div>
              <div
                className={`mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-slate-600 ${
                  isA5 ? "text-[10px]" : "text-[11px]"
                }`}
              >
                <span>
                  <span className="font-medium">ID:</span> {customerNo}
                </span>
                {customer.phone ? (
                  <span>
                    <span className="font-medium">Phone:</span> {customer.phone}
                  </span>
                ) : null}
                {customer.address ? (
                  <span>
                    <span className="font-medium">Address:</span>{" "}
                    {customer.address}
                  </span>
                ) : null}
              </div>
              <div
                className={`mt-1 text-slate-500 ${
                  isA5 ? "text-[10px]" : "text-[11px]"
                }`}
              >
                Balances as at {asAtLabel}
              </div>
            </div>

            <table
              className={`w-full border-collapse ${
                isA5 ? "mb-2 text-[11px]" : "mb-3 text-sm"
              }`}
            >
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50 text-left text-[9px] uppercase tracking-wide text-slate-500">
                  <th
                    className={`${isA5 ? "px-1.5 py-1" : "px-3 py-2"} font-semibold`}
                  >
                    Description
                  </th>
                  <th
                    className={`${isA5 ? "px-1.5 py-1" : "px-3 py-2"} text-right font-semibold`}
                  >
                    Amount (₦)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className={isA5 ? "px-1.5 py-1.5" : "px-3 py-3"}>
                    <div className="font-medium text-slate-900">
                      Deposit balance
                    </div>
                    <div className="text-[9px] leading-snug text-slate-500">
                      Prepaid funds available to apply to invoices
                    </div>
                  </td>
                  <td
                    className={`${
                      isA5 ? "px-1.5 py-1.5 text-[12px]" : "px-3 py-3 text-base"
                    } text-right font-semibold tabular-nums text-slate-900`}
                  >
                    {formatNumber1(deposit)}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className={isA5 ? "px-1.5 py-1.5" : "px-3 py-3"}>
                    <div className="font-medium text-slate-900">
                      Credit balance
                    </div>
                    <div className="text-[9px] leading-snug text-slate-500">
                      Outstanding amount receivable from open invoices
                      {creditInvoices.length
                        ? ` (${creditInvoices.length} invoice${
                            creditInvoices.length === 1 ? "" : "s"
                          })`
                        : ""}
                    </div>
                  </td>
                  <td
                    className={`${
                      isA5 ? "px-1.5 py-1.5 text-[12px]" : "px-3 py-3 text-base"
                    } text-right font-semibold tabular-nums text-slate-900`}
                  >
                    {formatNumber1(credit)}
                  </td>
                </tr>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className={isA5 ? "px-1.5 py-1.5" : "px-3 py-3"}>
                    <div className="font-semibold text-slate-900">
                      Net balance
                    </div>
                    <div className="text-[9px] leading-snug text-slate-500">
                      {netLabel}
                    </div>
                  </td>
                  <td
                    className={`${
                      isA5 ? "px-1.5 py-1.5 text-[12px]" : "px-3 py-3 text-base"
                    } text-right font-bold tabular-nums text-slate-900`}
                  >
                    {netBalance < -0.005 ? "(" : ""}
                    {formatNumber1(netAbs)}
                    {netBalance < -0.005 ? ")" : ""}
                  </td>
                </tr>
              </tbody>
            </table>

            {creditInvoices.length > 0 ? (
              <div className={isA5 ? "mb-2" : "mb-3"}>
                <div
                  className={`font-semibold uppercase tracking-wide text-slate-500 ${
                    isA5 ? "mb-1 text-[9px]" : "mb-1.5 text-[10px]"
                  }`}
                >
                  Credit by invoice
                </div>
                <table
                  className={`w-full border-collapse ${
                    isA5 ? "text-[10px]" : "text-xs"
                  }`}
                >
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50 text-left text-[9px] uppercase tracking-wide text-slate-500">
                      <th className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} font-semibold`}>
                        Invoice
                      </th>
                      <th className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} font-semibold`}>
                        Date
                      </th>
                      <th
                        className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} text-right font-semibold`}
                      >
                        Invoice (₦)
                      </th>
                      <th
                        className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} text-right font-semibold`}
                      >
                        Paid (₦)
                      </th>
                      <th
                        className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} text-right font-semibold`}
                      >
                        Due (₦)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditInvoices.map((inv) => (
                      <tr
                        key={inv.invoiceRef}
                        className="border-b border-slate-100"
                      >
                        <td className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} font-mono`}>
                          {inv.invoiceRef}
                        </td>
                        <td className={isA5 ? "px-1 py-1" : "px-2 py-1.5"}>
                          {inv.transactionDate
                            ? moment(inv.transactionDate).format("DD MMM YYYY")
                            : "—"}
                        </td>
                        <td
                          className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} text-right tabular-nums`}
                        >
                          {formatNumber1(inv.amount)}
                        </td>
                        <td
                          className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} text-right tabular-nums`}
                        >
                          {formatNumber1(inv.totalPaid)}
                        </td>
                        <td
                          className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} text-right font-semibold tabular-nums`}
                        >
                          {formatNumber1(inv.balanceDue)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
                      <td
                        className={isA5 ? "px-1 py-1" : "px-2 py-1.5"}
                        colSpan={4}
                      >
                        Total credit due
                      </td>
                      <td
                        className={`${isA5 ? "px-1 py-1" : "px-2 py-1.5"} text-right tabular-nums`}
                      >
                        {formatNumber1(credit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p
                className={`text-slate-500 ${
                  isA5 ? "mb-2 text-[10px]" : "mb-3 text-xs"
                }`}
              >
                No open credit invoices for this customer.
              </p>
            )}

            <div
              className={`mx-auto grid max-w-md grid-cols-2 text-center text-slate-600 ${
                isA5 ? "mt-3 gap-4 text-[10px]" : "mt-6 gap-8 text-xs"
              }`}
            >
              <div>
                <div
                  className={`border-b border-slate-500 ${
                    isA5 ? "mb-1 h-8" : "mb-1.5 h-12"
                  }`}
                />
                <div>Customer signature</div>
              </div>
              <div>
                <div
                  className={`border-b border-slate-500 ${
                    isA5 ? "mb-1 h-8" : "mb-1.5 h-12"
                  }`}
                />
                <div>Authorized signature</div>
              </div>
            </div>

            <p
              className={`text-center text-slate-400 ${
                isA5 ? "mt-2 text-[9px]" : "mt-4 text-[10px]"
              }`}
            >
              Generated {moment().format("DD MMM YYYY HH:mm")}
            </p>
            {poweredByText ? (
              <p
                className={`text-center text-slate-400 ${
                  isA5 ? "mt-0.5 text-[8px] leading-snug" : "mt-1 text-[9px] leading-snug"
                }`}
              >
                {poweredByText}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
