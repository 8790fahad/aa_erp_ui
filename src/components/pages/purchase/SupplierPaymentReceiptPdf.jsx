import PropTypes from "prop-types";
import useQuery from "@/hooks/useQuery";
import { useEffect, useState, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { _fetchApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import moment from "moment";
import { formatNumber1, toWordsconver } from "@/components/router/utilities";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const receiptBwCss = `
  .receipt-bw,
  .receipt-bw *:not(img):not(svg):not(canvas):not(path) {
    background: #fff !important;
    background-color: #fff !important;
    background-image: none !important;
    color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
  .receipt-bw,
  .receipt-bw * {
    border-color: #111 !important;
    -webkit-print-color-adjust: economy !important;
    print-color-adjust: economy !important;
  }
  .receipt-bw img,
  .receipt-bw svg,
  .receipt-bw canvas {
    filter: grayscale(1) contrast(1.2) !important;
  }
`;

function amountInWords(amountPaid) {
  const amount = parseFloat(amountPaid || 0);
  const amountStr = amount.toFixed(2);
  const parts = amountStr.split(".");
  const nairaWords = toWordsconver(parts[0])?.toUpperCase() || "";
  const koboPart = parts[1];
  const koboWords =
    koboPart && koboPart !== "00" && koboPart !== "0"
      ? toWordsconver(koboPart)?.toUpperCase() || ""
      : null;
  return `${nairaWords} NAIRA${koboWords ? ` AND ${koboWords} KOBO` : ""} ONLY`;
}

function receiptPageStyle(paperSize, printInColor) {
  const size = String(paperSize || "a5").toLowerCase();
  const isThermal = size === "thermal";
  const isA5 = size === "a5";
  const pageWidthMm = isThermal ? 80 : isA5 ? 148 : 210;
  const pageHeightMm = isThermal ? null : isA5 ? 210 : 297;
  const pageSize = isThermal
    ? "80mm auto"
    : isA5
      ? "A5 portrait"
      : "A4 portrait";
  const ink = printInColor ? "exact" : "economy";
  return `
    @page {
      size: ${pageSize};
      margin: ${isThermal ? "2mm" : isA5 ? "6mm" : "0"} !important;
    }
    html, body {
      width: ${pageWidthMm}mm;
      ${pageHeightMm ? `min-height: ${pageHeightMm}mm;` : ""}
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      print-color-adjust: ${ink};
      -webkit-print-color-adjust: ${ink};
    }
    ${printInColor ? "" : receiptBwCss}
    .receipt-container {
      width: ${pageWidthMm}mm !important;
      max-width: ${pageWidthMm}mm !important;
      ${pageHeightMm ? `min-height: ${pageHeightMm}mm;` : ""}
      margin: 0 auto !important;
      padding: ${isThermal ? "2mm" : "0"} !important;
      box-shadow: none !important;
      border: ${isThermal ? "none" : "none"} !important;
      background: #fff !important;
    }
    .border-dashed { border-style: dashed !important; }
    .no-print { display: none !important; }
  `;
}

const SupplierPaymentReceiptHTML = ({
  paymentData,
  company,
  receiptRef,
  paperSize = "a5",
  printInColor = false,
}) => {
  const formatDate = (date) => {
    if (!date) return "N/A";
    const momentDate = moment(date);
    if (!momentDate.isValid()) return "N/A";
    return momentDate.format("DD MMM, YYYY");
  };
  const query = useQuery();
  const invoice_ref = query.get("ref_number");
  const payment_ref = query.get("pv_code");
  const size = String(paperSize || "a5").toLowerCase();
  const isThermal = size === "thermal";
  const isA5 = size === "a5";
  const companyData = {
    name: company?.business_name || "AA_ERP MANUFACTURING LTD",
    receiptNumber:
      paymentData?.reference_number || paymentData?.ref_number || "N/A",
    paymentDate:
      paymentData?.transaction_date || paymentData?.date || new Date(),
  };

  if (isThermal) {
    const biz = company || {};
    return (
      <div
        ref={receiptRef}
        className={`receipt-container mx-auto bg-white ${
          printInColor ? "" : "receipt-bw"
        }`}
        style={{ width: "80mm", maxWidth: "80mm" }}
      >
        <div
          className="px-2 py-2 text-black"
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: "13px",
            lineHeight: 1.3,
          }}
        >
          <div className="text-center font-bold uppercase">
            {biz.business_name || companyData.name}
          </div>
          {biz.business_address ? (
            <div className="text-center text-[11px]">{biz.business_address}</div>
          ) : null}
          <div className="my-2 border-t border-dashed border-black" />
          <div className="text-center font-bold">PAYMENT RECEIPT</div>
          <div className="text-center text-[11px]">
            No: PR-{payment_ref || companyData.receiptNumber}
          </div>
          <div className="text-center text-[11px]">
            {formatDate(companyData.paymentDate)}
          </div>
          <div className="my-2 border-t border-dashed border-black" />
          <div className="flex justify-between gap-1">
            <span>Paid to</span>
            <span className="text-right font-bold">
              {paymentData?.supplier_name || "N/A"}
            </span>
          </div>
          {paymentData?.supplier_no ? (
            <div className="flex justify-between gap-1">
              <span>Code</span>
              <span>{paymentData.supplier_no}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-1">
            <span>Mode</span>
            <span>{paymentData?.mode_of_payment?.toUpperCase() || "N/A"}</span>
          </div>
          {(String(paymentData?.mode_of_payment || "").toLowerCase() ===
            "cash" ||
            paymentData?.account_info?.kind === "cash") &&
          (paymentData?.account_info?.name ||
            paymentData?.account_info?.code) ? (
            <div className="flex justify-between gap-1">
              <span>Cash Head</span>
              <span className="text-right">
                {[
                  paymentData.account_info.name,
                  paymentData.account_info.code,
                ]
                  .filter(Boolean)
                  .join(" | ")}
              </span>
            </div>
          ) : null}
          <div className="my-2 border-t border-dashed border-black" />
          <div className="text-center text-[11px] uppercase">Amount Paid</div>
          <div className="text-center text-lg font-bold">
            ₦{formatNumber1(paymentData?.amount_paid || 0)}
          </div>
          <div className="mt-1 text-center text-[10px] leading-snug">
            {amountInWords(paymentData?.amount_paid || 0)}
          </div>
          {(paymentData?.description || paymentData?.narration) && (
            <>
              <div className="my-2 border-t border-dashed border-black" />
              <div className="text-[11px] leading-snug">
                {paymentData?.narration || paymentData?.description}
              </div>
            </>
          )}
          <div className="my-2 border-t border-dashed border-black" />
          <div className="text-[11px]">
            Prepared: {paymentData?.createdBy?.name || " "}
          </div>
          <div className="mt-3 text-center text-[10px]">Thank you</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={receiptRef}
      className={`mx-auto bg-white shadow-sm receipt-container border border-gray-200 ${
        isA5 ? "max-w-[148mm]" : "max-w-5xl"
      } ${printInColor ? "" : "receipt-bw"}`}
      style={isA5 ? { width: "148mm" } : undefined}
    >
      <div className={isA5 ? "p-1.5" : "p-2"}>
        <BusinessDocumentHeader
          business={company}
          title="PAYMENT RECEIPT"
          numberLabel={`No: PR-${payment_ref}`}
          date={companyData.paymentDate}
          compact={isA5}
        />
        {/* Supplier Information */}
        {paymentData?.supplier_name && (
          <div className="grid gap-0.5 mb-1">
            <div className="bg-blue-50 border border-blue-200 p-2">
              <h6 className="text-xs font-semibold text-blue-800 mb-0.5 uppercase tracking-wide">
                Beneficiary
              </h6>
              <div className="text-xs text-gray-700 leading-snug">
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap">
                    <span className="font-semibold text-gray-600">Name:</span>{" "}
                    <span className="text-gray-900">
                      {paymentData.supplier_name || "N/A"}
                    </span>{" "}
                    {paymentData?.supplier_no && (
                      <>
                        <span className="text-gray-400 mx-1">|</span>
                        <span className="font-semibold text-gray-600">
                          Code:
                        </span>{" "}
                        <span className="text-gray-900">
                          {paymentData.supplier_no}
                        </span>
                      </>
                    )}
                    {paymentData?.supplier_address && (
                      <>
                        <span className="text-gray-400 mx-1">|</span>
                        <span className="font-semibold text-gray-600">
                          Address:
                        </span>{" "}
                        <span className="text-gray-900">
                          {paymentData.supplier_address}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center ml-4">
                    <span className="font-semibold text-gray-600">
                      Balance:
                    </span>{" "}
                    <span
                      className={`font-bold ml-1 ${
                        parseFloat(paymentData?.new_balance || 0) < 0
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      ₦{formatNumber1(Math.abs(paymentData?.new_balance || 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Payment Details */}
        <div className="mb-1">
          <h3 className="text-xs font-bold text-gray-800 mb-1 uppercase tracking-wide">
            Payment Details
          </h3>
          <div className="bg-blue-50 border border-blue-200 p-2 rounded-md">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-0.5 font-semibold">
                  Mode of Payment
                </p>
                <div className="bg-white border border-blue-300 rounded px-2 py-1">
                  <p className="text-sm font-bold text-blue-800">
                    {paymentData?.mode_of_payment?.toUpperCase() || "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-0.5 font-semibold">
                  {String(paymentData?.mode_of_payment || "").toLowerCase() ===
                    "cash" || paymentData?.account_info?.kind === "cash"
                    ? "Cash Head"
                    : "Bank Account"}
                </p>
                <div className="bg-white border border-blue-300 rounded px-2 py-1">
                  <p className="text-sm font-bold text-blue-800">
                    {paymentData?.account_info?.name ||
                      paymentData?.bank_name ||
                      "N/A"}
                    {paymentData?.account_info?.code && (
                      <> | {paymentData.account_info.code}</>
                    )}
                    {paymentData?.account_info?.account_number && (
                      <> | Account: {paymentData.account_info.account_number}</>
                    )}
                    {paymentData?.cheque_no && (
                      <> | Cheque No.: {paymentData.cheque_no}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Payment Summary */}
        <div className="mb-1">
          <h3 className="text-xs font-bold text-gray-800 mb-1 uppercase tracking-wide">
            Payment Summary
          </h3>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-2 rounded-md">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide font-semibold">
                Amount Paid
              </p>
              <p className="text-2xl font-bold text-green-700 mb-1">
                ₦{formatNumber1(paymentData?.amount_paid || 0)}
              </p>
              <p className="text-xs text-gray-700 italic border-t border-green-200 pt-1 mt-1">
                {amountInWords(paymentData?.amount_paid || 0)}
              </p>
            </div>
          </div>
        </div>
        {(paymentData?.narration || paymentData?.description) && (
          <div className="mt-0.5 p-2 bg-yellow-50 border border-yellow-300 border-l-[4px] border-l-yellow-600 rounded-md">
            <p className="text-xs font-bold text-yellow-900 mb-0.5">
              Narration
            </p>
            <p className="text-xs text-yellow-800 leading-snug">
              {paymentData.narration || paymentData.description}
            </p>
          </div>
        )}

        {/* Signatures — Prepared By only */}
        {(() => {
          const transactionDate =
            paymentData?.transaction_date ||
            paymentData?.date ||
            paymentData?.created_at;
          const formattedDate = transactionDate
            ? moment(transactionDate).format("DD/MM/YYYY")
            : "";
          return (
            <div className="mt-2 flex justify-start">
              <div className="w-48 text-center">
                <p className="text-xs text-gray-600 mb-1">Prepared By</p>
                <div className="space-y-0.5">
                  <div className="min-h-8 flex items-end justify-center">
                    {paymentData?.createdBy?.signature ? (
                      <img
                        src={paymentData.createdBy.signature}
                        alt="Signature"
                        className="max-h-9 mx-auto object-contain"
                        style={{ maxWidth: "130px" }}
                      />
                    ) : (
                      <div className="border-t border-gray-200 w-full pt-0.5" />
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-1 min-h-5">
                    <p className="text-sm font-bold text-gray-900">
                      {paymentData?.createdBy?.name ||
                        paymentData?.created_by ||
                        " "}
                    </p>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-xs text-gray-600">
                      Date: {formattedDate}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Page Footer */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-r-4 border-l-4 border-[var(--aa-accent)] p-2 shadow-sm mt-2">
          <div className="flex items-start gap-1">
            <div className="flex-shrink-0">
              <svg
                className="h-4 w-4 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h6 className="text-xs font-semibold text-blue-900">
                Thank you for doing business with us.
              </h6>
              <h6 className="text-xs text-blue-800 mt-0.5">
                This solution is powered by Nexifour Limited · NDPC | ISO 27001 | ISO 9001
              </h6>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

SupplierPaymentReceiptHTML.propTypes = {
  paymentData: PropTypes.shape({
    reference_number: PropTypes.string,
    ref_number: PropTypes.string,
    transaction_date: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    date: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    supplier_name: PropTypes.string,
    supplier_no: PropTypes.string,
    supplier_address: PropTypes.string,
    new_balance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    mode_of_payment: PropTypes.string,
    account_info: PropTypes.shape({
      kind: PropTypes.string,
      name: PropTypes.string,
      code: PropTypes.string,
      account_number: PropTypes.string,
    }),
    bank_name: PropTypes.string,
    cheque_no: PropTypes.string,
    amount_paid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    narration: PropTypes.string,
    created_at: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    created_by: PropTypes.string,
    createdBy: PropTypes.shape({
      name: PropTypes.string,
      signature: PropTypes.string,
    }),
  }),
  company: PropTypes.shape({
    business_name: PropTypes.string,
    rc: PropTypes.string,
    description: PropTypes.string,
    business_address: PropTypes.string,
    business_phone: PropTypes.string,
    fax: PropTypes.string,
    business_email: PropTypes.string,
  }),
  receiptRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  paperSize: PropTypes.oneOf(["a4", "a5", "thermal"]),
  printInColor: PropTypes.bool,
};

const SupplierPaymentReceiptPdf = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const ref_number = useQuery().get("ref_number");
  const pv_code = useQuery().get("pv_code");
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paperSize, setPaperSize] = useState("a5");
  const [printInColor, setPrintInColor] = useState(false);
  const receiptRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (ref_number && activeBusiness?.id) {
      setLoading(true);
      _fetchApi(
        `/api/supplier/payment-receipt?ref_number=${ref_number}&facilityId=${activeBusiness.id}&pv_code=${pv_code}`,
        (data) => {
          setLoading(false);
          if (data.success) {
            setPaymentData(data.data);
          } else {
            toast.error(data.message || "Error fetching payment receipt");
          }
        },
        (err) => {
          setLoading(false);
          console.error("Error fetching payment receipt:", err);
          toast.error("Error fetching payment receipt");
        },
      );
    } else {
      setLoading(false);
    }
  }, [ref_number, pv_code, activeBusiness?.id]);

  const handleReactToPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Payment-Receipt-${ref_number || "N/A"}`,
    pageStyle: receiptPageStyle(paperSize, printInColor),
    onBeforeGetContent: () => {
      return new Promise((resolve) => {
        if (!receiptRef.current) {
          toast.error("Receipt content is not ready to print yet.");
          resolve();
          return;
        }
        setTimeout(() => {
          resolve();
        }, 100);
      });
    },
    onPrintError: (error) => {
      console.error("Print failed:", error);
      toast.error("Unable to print receipt. Please try again.");
    },
  });

  const handlePrint = useCallback(() => {
    if (!receiptRef.current) {
      toast.error("Receipt content is not ready to print yet.");
      return;
    }

    try {
      handleReactToPrint();
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Unable to print receipt. Please try again.");
    }
  }, [handleReactToPrint]);

  const renderSkeletonFrame = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex justify-between items-center mb-3">
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] p-4 space-y-3">
            <div className="h-8 bg-blue-800/50 animate-pulse rounded w-3/4" />
            <div className="h-4 bg-blue-800/50 animate-pulse rounded w-1/2" />
          </div>
          <div className="p-4 space-y-3">
            <div className="h-6 bg-gray-200 animate-pulse rounded w-1/2" />
            {[...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className="h-12 bg-gray-200 animate-pulse rounded"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return renderSkeletonFrame();
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b border-gray-200 p-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-0.5 text-sm bg-red-600 text-white rounded flex items-center gap-1 hover:bg-gray-700 transition-colors"
          >
            <X size={14} /> Cancel
          </button>
        </div>
        <div className="max-w-5xl mx-auto p-8">
          <p className="text-center text-gray-500">
            No payment receipt data found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        ${printInColor ? "" : receiptBwCss}
        @media print {
          .no-print { display: none !important; }
          .receipt-container { padding: 0px; box-shadow: none; }
          ${receiptPageStyle(paperSize, printInColor)}
          .border-dashed {
            border-style: dashed !important;
          }
        }
      `}</style>

      {/* Action Buttons */}
      <div className="max-w-5xl mx-auto mb-3 flex flex-wrap gap-2 items-center justify-between no-print">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-0.5 text-sm bg-red-600 text-white rounded flex items-center gap-1 hover:bg-gray-700 transition-colors"
        >
          <X size={14} /> Cancel
        </button>
        <div className="flex flex-wrap gap-2 ml-auto items-center">
          <div
            className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
            role="tablist"
            aria-label="Paper size"
          >
            {[
              { id: "a4", label: "A4" },
              { id: "a5", label: "A5" },
              { id: "thermal", label: "Thermal" },
            ].map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={paperSize === opt.id}
                onClick={() => setPaperSize(opt.id)}
                className={`px-3 py-0.5 text-sm transition-colors ${
                  idx > 0 ? "border-l border-slate-300" : ""
                } ${
                  paperSize === opt.id
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
              className={`px-3 py-0.5 text-sm border-l border-slate-300 transition-colors ${
                printInColor
                  ? "bg-[var(--aa-navy)] text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Colour
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="px-3 py-0.5 text-sm bg-[var(--aa-navy)] text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Receipt Container */}
      <SupplierPaymentReceiptHTML
        paymentData={paymentData}
        company={activeBusiness}
        receiptRef={receiptRef}
        paperSize={paperSize}
        printInColor={printInColor}
      />
    </div>
  );
};

export default SupplierPaymentReceiptPdf;
