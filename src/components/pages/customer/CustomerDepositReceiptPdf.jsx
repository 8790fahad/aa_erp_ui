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

const CustomerDepositReceiptHTML = ({ depositData, company, receiptRef }) => {
  const query = useQuery();
  const invoice_ref = query.get("invoice_ref");
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
      className="max-w-5xl mx-auto bg-white shadow-sm receipt-container border border-gray-200"
    >
      <div className="p-1">
        <BusinessDocumentHeader
          business={company}
          title="DEPOSIT RECEIPT"
          numberLabel={`No: ${companyData.receiptNumber}`}
          date={companyData.depositDate}
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

        <div className="mb-1">
          <h3 className="text-xs font-bold text-gray-800 mb-2 uppercase tracking-wide">
            Deposit Summary
          </h3>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-md">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide font-semibold">
                Amount Deposited
              </p>
              <p className="text-3xl font-bold text-green-700 mb-2">
                ₦
                {formatNumber1(
                  depositData?.cost || depositData?.amount_paid || 0
                )}
              </p>
              <p className="text-xs text-gray-700 italic border-t border-green-200 pt-2 mt-2">
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
        {/* Narration/Notes */}
        {depositData?.description && (
          <div className="mt-1 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
            <p className="text-xs font-bold text-yellow-900 mb-2">
              NOTES / NARRATION
            </p>
            <p className="text-xs text-yellow-800 leading-relaxed">
              {depositData.description || `Deposit for Invoice ${invoice_ref}`}
            </p>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-4 flex justify-between gap-8">
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-2">Prepared By</p>
            <div className="w-4/5 mx-auto">
              {depositData?.createdBy?.signature ? (
                <div className="mb-2">
                  <img
                    src={depositData.createdBy.signature}
                    alt="Signature"
                    className="max-h-10 mx-auto object-contain"
                    style={{ maxWidth: "200px" }}
                  />
                </div>
              ) : (
                <div className="border-t border-gray-300 pt-2 mb-2"></div>
              )}
              <div className="border-t border-gray-300 pt-2">
                <p className="text-xs font-bold text-gray-800">
                  {depositData?.createdBy?.name ||
                    (depositData?.firstname && depositData?.lastname
                      ? `${depositData.firstname} ${depositData.lastname}`
                      : depositData?.created_by || "_______________")}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {depositData?.created_at || depositData?.transaction_date
                    ? moment(
                        depositData.created_at || depositData.transaction_date
                      ).format("DD/MM/YYYY")
                    : moment().format("DD/MM/YYYY")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-8">Approved By</p>
            <div className="w-4/5 mx-auto border-t border-gray-300 pt-2">
              <p className="text-xs font-bold text-gray-800">_______________</p>
              <p className="text-xs text-gray-500 mt-1">Date: __________</p>
            </div>
          </div>

          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-8">Received By</p>
            <div className="w-4/5 mx-auto border-t border-gray-300 pt-2">
              <p className="text-xs font-bold text-gray-800">
                {depositData?.fullname || "_______________"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Date: __________</p>
            </div>
          </div>
        </div>

        {/* Page Footer */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-r-4 border-l-4 border-[var(--aa-accent)] p-1 shadow-sm mt-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-600"
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
            <div className="ml-2">
              <h6 className="text-xs font-semibold text-blue-900">
                Thank you for doing business with us.
              </h6>
              <h6 className="text-xs text-blue-800 mt-1">
                This solution is powered by Nexifour Limited · NDPC | ISO 27001 | ISO 9001
              </h6>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomerDepositReceiptPdf = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const query = useQuery();
  const invoice_ref = query.get("invoice_ref");
  const customer_no = query.get("customer_no");
  const [depositData, setDepositData] = useState(null);
  const [loading, setLoading] = useState(true);
  const receiptRef = useRef(null);
  const navigate = useNavigate();

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
        size: A4;
        margin: 0 !important;
      }
      html, body {
        width: 210mm;
        min-height: 297mm;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .receipt-container {
        width: 210mm !important;
        min-height: 297mm;
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        background: #fff !important;
      }
      .border-dashed { border-style: dashed !important; }
      .no-print { display: none !important; }
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
            margin: 0mm;
            size: A4;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
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
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handlePrint}
            className="px-3 py-0.5 text-sm bg-[var(--aa-navy)] text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Receipt Container */}
      <CustomerDepositReceiptHTML
        depositData={depositData}
        company={activeBusiness}
        receiptRef={receiptRef}
      />
    </div>
  );
};

export default CustomerDepositReceiptPdf;
