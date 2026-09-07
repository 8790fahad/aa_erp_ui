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
import { printThermalReceipt } from "@/components/pages/sales/ThermalReceipt";

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

function amountInWords(amount) {
  const amountStr = Number(amount || 0).toFixed(2);
  const [nairaPart, koboPart] = amountStr.split(".");
  const nairaWords = toWordsconver(nairaPart)?.toUpperCase() || "";
  const koboWords =
    koboPart && koboPart !== "00" && koboPart !== "0"
      ? toWordsconver(koboPart)?.toUpperCase() || ""
      : null;
  return `${nairaWords} NAIRA${koboWords ? ` AND ${koboWords} KOBO` : ""} ONLY`;
}

function defaultPrintFormat(business) {
  const t = String(business?.default_receipt_type || "pdf")
    .trim()
    .toLowerCase();
  if (t === "a5") return "a5";
  if (t === "terminal") return "thermal";
  return "a4";
}

const tabBtn = (active) =>
  `px-3 py-0.5 text-sm transition-colors ${
    active
      ? "bg-[var(--aa-navy)] text-white"
      : "bg-white text-slate-700 hover:bg-slate-50"
  }`;

const CustomerDepositReceiptHTML = ({
  depositData,
  company,
  receiptRef,
  paperSize = "a4",
  printInColor = false,
}) => {
  const query = useQuery();
  const invoice_ref = query.get("invoice_ref");
  const isA5 = String(paperSize).toLowerCase() === "a5";
  const companyData = {
    receiptNumber:
      depositData?.invoice_ref ||
      depositData?.reference_number ||
      invoice_ref ||
      "N/A",
    depositDate:
      depositData?.transaction_date || depositData?.date || new Date(),
  };

  return (
    <div
      ref={receiptRef}
      className={`${
        isA5 ? "max-w-[148mm]" : "max-w-5xl"
      } mx-auto bg-white shadow-sm receipt-container border border-gray-200${
        printInColor ? "" : " invoice-bw"
      }`}
      style={isA5 ? { width: "148mm" } : undefined}
    >
      <div className={isA5 ? "p-0.5" : "p-1"}>
        <BusinessDocumentHeader
          business={company}
          title="DEPOSIT RECEIPT"
          numberLabel={`No: ${companyData.receiptNumber}`}
          date={companyData.depositDate}
          compact={isA5}
        />
        {/* Customer Information */}
        {depositData?.fullname && (
          <div className="grid gap-1 mb-1">
            <div className="bg-blue-50 border border-blue-200 p-1">
              <h6 className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">
                Customer
              </h6>
              <div className="text-xs text-gray-700 leading-relaxed">
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap">
                    <span className="font-semibold text-gray-600">Name:</span>{" "}
                    <span className="text-gray-900">
                      {depositData.fullname || "N/A"}
                    </span>{" "}
                    {depositData?.customerNo && (
                      <>
                        <span className="text-gray-400 mx-1">|</span>
                        <span className="font-semibold text-gray-600">
                          Code:
                        </span>{" "}
                        <span className="text-gray-900">
                          {depositData.customerNo}
                        </span>
                      </>
                    )}
                    {depositData?.address && (
                      <>
                        <span className="text-gray-400 mx-1">|</span>
                        <span className="font-semibold text-gray-600">
                          Address:
                        </span>{" "}
                        <span className="text-gray-900">
                          {depositData.address}
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
                        parseFloat(depositData?.outstanding_balance || 0) < 0
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      ₦
                      {formatNumber1(
                        Math.abs(depositData?.outstanding_balance || 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Payment Details */}
        <div className="mb-1">
          <h3 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wide">
            Payment Details
          </h3>
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1 font-semibold">
                  Mode of Payment
                </p>
                <div className="bg-white border border-blue-300 rounded px-2 py-1.5">
                  <p className="text-sm font-bold text-blue-800">
                    {depositData?.payment_method?.toUpperCase() ||
                      depositData?.mode_of_payment?.toUpperCase() ||
                      "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1 font-semibold">
                  Account / Bank
                </p>
                <div className="bg-white border border-blue-300 rounded px-2 py-1.5">
                  <p className="text-sm font-bold text-blue-800">
                    {depositData?.account_info?.name ||
                      depositData?.bank_name ||
                      "N/A"}
                    {depositData?.account_info?.code && (
                      <> | Code: {depositData.account_info.code}</>
                    )}
                    {depositData?.account_info?.account_number && (
                      <> | Account: {depositData.account_info.account_number}</>
                    )}
                    {depositData?.cheque_number && (
                      <> | Cheque Number: {depositData.cheque_number}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Deposit Summary */}

        <div className={isA5 ? "mb-0.5" : "mb-1"}>
          <h3
            className={`font-bold text-gray-800 uppercase tracking-wide ${
              isA5 ? "text-[10px] mb-0.5" : "text-xs mb-1"
            }`}
          >
            Deposit Summary
          </h3>
          <div
            className={`bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-md ${
              isA5 ? "px-2 py-1" : "px-3 py-1.5"
            }`}
          >
            <div className="text-center">
              <p
                className={`text-gray-600 uppercase tracking-wide font-semibold ${
                  isA5 ? "text-[10px] mb-0" : "text-xs mb-0.5"
                }`}
              >
                Amount Deposited
              </p>
              <p
                className={`font-bold text-green-700 ${
                  isA5 ? "text-lg leading-tight" : "text-2xl leading-tight"
                }`}
              >
                ₦
                {formatNumber1(
                  depositData?.cost || depositData?.amount_paid || 0
                )}
              </p>
              <p
                className={`text-gray-700 italic border-t border-green-200 ${
                  isA5 ? "text-[10px] pt-0.5 mt-0.5" : "text-xs pt-1 mt-1"
                }`}
              >
                {(() => {
                  const amount = parseFloat(
                    depositData?.cost || depositData?.amount_paid || 0
                  );
                  const amountStr = amount.toFixed(2);
                  const parts = amountStr.split(".");
                  const nairaPart = parts[0];
                  const koboPart = parts[1];

                  const nairaWords =
                    toWordsconver(nairaPart)?.toUpperCase() || "";
                  const koboWords =
                    koboPart && koboPart !== "00" && koboPart !== "0"
                      ? toWordsconver(koboPart)?.toUpperCase() || ""
                      : null;

                  return (
                    <>
                      {nairaWords} NAIRA
                      {koboWords ? ` AND ${koboWords} KOBO` : ""} ONLY
                    </>
                  );
                })()}
              </p>
            </div>
          </div>
        </div>
        <div
          className={`grid grid-cols-2 gap-2 ${isA5 ? "mb-0.5 mt-1" : "mb-1 mt-2"}`}
        >
          <div
            className={`bg-yellow-50 border border-yellow-300 ${
              isA5 ? "p-1" : "p-3"
            }`}
          >
            <p
              className={`font-bold text-yellow-900 border-b border-yellow-200 pb-1 ${
                isA5 ? "text-[10px] mb-1" : "text-xs mb-2"
              }`}
            >
              NOTES / NARRATION
            </p>
            <p
              className={`${isA5 ? "text-[10px]" : "text-xs"} text-yellow-800 leading-relaxed`}
            >
              {depositData?.description || "Customer payment"}
            </p>
          </div>
          <div
            className={`bg-blue-50 border border-blue-200 ${
              isA5 ? "p-1" : "p-1.5"
            }`}
          >
            <h6
              className={`font-bold text-gray-800 border-b border-blue-300 pb-1 ${
                isA5 ? "text-[10px] mb-1" : "text-xs mb-2"
              }`}
            >
              Prepared Details
            </h6>
            <p
              className={`${isA5 ? "text-[10px]" : "text-xs"} mb-1.5 text-gray-700`}
            >
              <span className="font-semibold">Prepared By:</span>{" "}
              {depositData?.createdBy?.name ||
                (depositData?.firstname && depositData?.lastname
                  ? `${depositData.firstname} ${depositData.lastname}`
                  : depositData?.created_by || "—")}
              {depositData?.createdBy?.id
                ? ` (${depositData.createdBy.id})`
                : ""}
            </p>
            {depositData?.createdBy?.signature ? (
              <div className="flex flex-col items-center gap-1 my-1">
                <img
                  src={depositData.createdBy.signature}
                  alt="Prepared by signature"
                  className={`${isA5 ? "h-8" : "h-10"} object-contain`}
                />
                <span className="text-[0.65rem] text-gray-500 uppercase tracking-wide">
                  Signature
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 my-1">
                <div
                  className={`${isA5 ? "h-8" : "h-10"} w-full border-b border-blue-300`}
                />
                <span className="text-[0.65rem] text-gray-500 uppercase tracking-wide">
                  Signature
                </span>
              </div>
            )}
            <p className="mt-1 text-xs font-bold text-center text-blue-800 py-1 bg-blue-100 rounded">
              FOR {company?.business_name || "COMPANY"}
            </p>
          </div>
        </div>

        <div
          className={`border-t border-dashed border-slate-300 ${
            isA5 ? "mt-1 px-1 py-1" : "mt-2 px-1.5 py-1.5"
          }`}
        >
          <p
            className={`${isA5 ? "text-[9px] leading-snug" : "text-[11px] leading-snug"} text-center italic text-slate-600`}
          >
            Thank you for doing business with us.
          </p>
          <p
            className={`${isA5 ? "text-[8px] leading-snug mt-0.5" : "text-[9px] leading-snug mt-1"} text-center text-slate-400`}
          >
            This solution is powered by Nexifour Limited
          </p>
        </div>
      </div>
    </div>
  );
};

function ThermalDepositReceipt({ depositData, company }) {
  const receiptNo =
    depositData?.invoice_ref ||
    depositData?.reference_number ||
    "N/A";
  const amount = Number(depositData?.cost || depositData?.amount_paid || 0);
  const mode =
    depositData?.payment_method ||
    depositData?.mode_of_payment ||
    "N/A";
  const account =
    depositData?.account_info?.name ||
    depositData?.bank_name ||
    "";

  return (
    <div className="flex justify-center">
      <style>{`
        .thermal-receipt-root.thermal-receipt-preview {
          display: block;
          width: 80mm;
          max-width: 80mm;
          margin: 0 auto;
          padding: 1mm 1mm 0;
          font-family: "Courier New", Courier, monospace;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.25;
          color: #000;
          background: #fff;
          box-sizing: border-box;
        }
        .thermal-receipt-root .tr-center { text-align: center; }
        .thermal-receipt-root .tr-bold { font-weight: 700; }
        .thermal-receipt-root .tr-muted { font-size: 12px; opacity: 0.9; }
        .thermal-receipt-root .tr-divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .thermal-receipt-root .tr-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .thermal-receipt-root .tr-total {
          margin-top: 4px;
          font-size: 16px;
          font-weight: 700;
        }
        .thermal-receipt-root .tr-business-name { font-size: 16px; }
      `}</style>
      <div className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden w-[80mm]">
        <div className="no-print border-b border-gray-100 bg-gray-50 px-3 py-1 text-center">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            80mm · Deposit receipt
          </span>
        </div>
        <div className="thermal-receipt-root thermal-receipt-preview">
          <div className="tr-center tr-bold tr-business-name">
            {company?.business_name || "Receipt"}
          </div>
          {company?.business_address ? (
            <div className="tr-center tr-muted">{company.business_address}</div>
          ) : null}
          {company?.business_phone ? (
            <div className="tr-center tr-muted">
              Tel: {company.business_phone}
            </div>
          ) : null}
          <div className="tr-divider" />
          <div className="tr-center tr-bold">DEPOSIT RECEIPT</div>
          <div>No: {receiptNo}</div>
          <div>
            Date:{" "}
            {moment(
              depositData?.transaction_date || depositData?.date || new Date(),
            ).format("DD/MM/YYYY HH:mm")}
          </div>
          <div className="tr-divider" />
          <div className="tr-bold">Customer</div>
          <div>{depositData?.fullname || "—"}</div>
          {depositData?.customerNo ? (
            <div>{depositData.customerNo}</div>
          ) : null}
          <div className="tr-divider" />
          <div className="tr-row">
            <span>Mode</span>
            <span>{String(mode).toUpperCase()}</span>
          </div>
          {account ? (
            <div className="tr-row">
              <span>Account</span>
              <span>{account}</span>
            </div>
          ) : null}
          <div className="tr-row tr-total">
            <span>Amount</span>
            <span>₦{formatNumber1(amount)}</span>
          </div>
          <div className="tr-muted" style={{ marginTop: 4 }}>
            {amountInWords(amount)}
          </div>
          {depositData?.description ? (
            <>
              <div className="tr-divider" />
              <div className="tr-muted">{depositData.description}</div>
            </>
          ) : null}
          <div className="tr-divider" />
          <div className="tr-center tr-muted">Thank you</div>
          <div className="tr-center tr-muted">
            {depositData?.createdBy?.name || ""}
          </div>
        </div>
      </div>
    </div>
  );
}

const CustomerDepositReceiptPdf = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const query = useQuery();
  const invoice_ref = query.get("invoice_ref");
  const customer_no = query.get("customer_no");
  const [depositData, setDepositData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printInColor, setPrintInColor] = useState(false);
  const [printFormat, setPrintFormat] = useState(() =>
    defaultPrintFormat(activeBusiness),
  );
  const receiptRef = useRef(null);
  const navigate = useNavigate();
  const isA5 = printFormat === "a5";
  const isThermal = printFormat === "thermal";

  useEffect(() => {
    if (invoice_ref && customer_no && activeBusiness?.id) {
      setLoading(true);
      _fetchApi(
        `/api/v1/get-customer-deposit/${customer_no}/${activeBusiness.id}/${invoice_ref}`,
        (data) => {
          setLoading(false);
          if (data.success) {
            // Merge the data object with additional fields from the response
            setDepositData({
              ...data.data,
              // Add customer information from response
              fullname: data.customer?.fullname || data.data?.fullname,
              customerNo: data.customer?.customerNo || data.data?.customerNo,
              address: data.customer?.address || data.data?.address,
              outstanding_balance: data.outstanding_balance,
              business_name: data.business_name,
              business_address: data.business_address,
              business_phone: data.business_phone,
              invoice_ref: data.invoice_ref,
            });
          } else {
            toast.error(data.message || "Error fetching deposit receipt");
          }
        },
        (err) => {
          setLoading(false);
          console.error("Error fetching deposit receipt:", err);
          toast.error("Error fetching deposit receipt");
        }
      );
    } else {
      setLoading(false);
    }
  }, [invoice_ref, customer_no, activeBusiness?.id]);

  const handleReactToPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Deposit-Receipt-${invoice_ref || "N/A"}`,
    pageStyle: `
      @page {
        size: ${isA5 ? "A5" : "A4"} portrait;
        margin: ${isA5 ? "6mm" : "0"} !important;
      }
      html, body {
        width: ${isA5 ? "148mm" : "210mm"};
        min-height: ${isA5 ? "210mm" : "297mm"};
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        print-color-adjust: ${printInColor ? "exact" : "economy"};
        -webkit-print-color-adjust: ${printInColor ? "exact" : "economy"};
      }
      .receipt-container {
        width: ${isA5 ? "148mm" : "210mm"} !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        background: #fff !important;
      }
      .border-dashed { border-style: dashed !important; }
      .no-print { display: none !important; }
      ${printInColor ? "" : receiptBwCss}
    `,
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
    if (isThermal) {
      printThermalReceipt();
      return;
    }
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
  }, [handleReactToPrint, isThermal]);

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

  if (!depositData) {
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
            No deposit receipt data found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .receipt-container { padding: 0px; box-shadow: none; }
          @page {
            margin: ${isA5 ? "6mm" : "0"};
            size: ${isA5 ? "A5" : "A4"} portrait;
          }
          body {
            print-color-adjust: ${printInColor ? "exact" : "economy"};
            -webkit-print-color-adjust: ${printInColor ? "exact" : "economy"};
          }
          .border-dashed {
            border-style: dashed !important;
          }
        }
        ${printInColor ? "" : receiptBwCss}
      `}</style>

      <div className="max-w-5xl mx-auto mb-3 flex flex-wrap gap-2 items-center justify-between no-print">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-0.5 text-sm bg-red-600 text-white rounded flex items-center gap-1 hover:bg-gray-700 transition-colors"
        >
          <X size={14} /> Cancel
        </button>
        <div className="flex flex-wrap gap-2 ml-auto items-center">
          {!isThermal ? (
            <div
              className="inline-flex rounded-md border border-slate-300 overflow-hidden bg-white"
              role="tablist"
              aria-label="Print color"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!printInColor}
                onClick={() => setPrintInColor(false)}
                className={tabBtn(!printInColor)}
              >
                Black and white
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={printInColor}
                onClick={() => setPrintInColor(true)}
                className={`${tabBtn(printInColor)} border-l border-slate-300`}
              >
                Color
              </button>
            </div>
          ) : null}
          <div
            className="inline-flex rounded-md border border-slate-300 overflow-hidden bg-white"
            role="tablist"
            aria-label="Paper size"
          >
            <button
              type="button"
              role="tab"
              aria-selected={printFormat === "a4"}
              onClick={() => setPrintFormat("a4")}
              className={tabBtn(printFormat === "a4")}
            >
              A4
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={printFormat === "a5"}
              onClick={() => setPrintFormat("a5")}
              className={`${tabBtn(printFormat === "a5")} border-l border-slate-300`}
            >
              A5
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isThermal}
              onClick={() => setPrintFormat("thermal")}
              className={`${tabBtn(isThermal)} border-l border-slate-300`}
            >
              Thermal
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="px-3 py-0.5 text-sm bg-[var(--aa-navy)] text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
          >
            <Printer size={14} /> Print
            {isThermal ? " (Thermal)" : isA5 ? " (A5)" : " (A4)"}
          </button>
        </div>
      </div>

      {isThermal ? (
        <ThermalDepositReceipt
          depositData={depositData}
          company={activeBusiness}
        />
      ) : (
        <CustomerDepositReceiptHTML
          depositData={depositData}
          company={activeBusiness}
          receiptRef={receiptRef}
          paperSize={printFormat}
          printInColor={printInColor}
        />
      )}
    </div>
  );
};

export default CustomerDepositReceiptPdf;
