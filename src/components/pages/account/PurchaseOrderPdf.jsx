import useQuery from "@/hooks/useQuery";
import { useEffect, useState, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { _fetchApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

// Helper function to render signature
const renderSignature = (person) => {
  if (person?.signature) {
    return (
      <div className="w-full h-10 border border-dashed border-gray-300 mb-2 flex items-center justify-center bg-white rounded">
        <img
          src={person.signature}
          alt="Signature"
          className="max-w-[90%] max-h-[90%] object-contain"
        />
      </div>
    );
  }
  return (
    <div className="w-full h-10 border border-dashed border-gray-300 mb-2 bg-white rounded"></div>
  );
};

const PurchaseOrderHTML = ({ orderData, company, invoiceRef }) => {
  const companyData = {
    name:
      orderData?.company?.name ||
      company?.business_name ||
      "INVENTRIA MANUFACTURING LTD",
    requestNumber: orderData?.pr_no || "N/A",
    requestDate: orderData?.requestDate || orderData?.date || "N/A",
    branch: orderData?.branch || "N/A",
    email:
      orderData?.company?.email ||
      company?.business_email ||
      "procurement@inventria.app",
  };

  const materials = orderData?.items || [];

  // Process authorization logs
  const logData = orderData?.logs || [];

  const requestedLog =
    logData
      .filter((log) => log.status?.toUpperCase() === "PENDING")
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;

  const approvedLog =
    logData
      .filter((log) => log.status?.toUpperCase() === "APPROVED")
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;

  // Authorization data objects
  const requestedByData = {
    name: requestedLog?.name || orderData?.requestedBy?.name || null,
    date: requestedLog?.date || orderData?.requestedBy?.date || null,
    signature:
      requestedLog?.signature || orderData?.requestedBy?.signature || null,
  };

  const approvedByData = {
    name: approvedLog?.name || orderData?.approvedBy?.name || null,
    date: approvedLog?.date || orderData?.approvedBy?.date || null,
    signature:
      approvedLog?.signature || orderData?.approvedBy?.signature || null,
  };

  // Check if data exists (not null and not "N/A")
  const hasRequestedBy = requestedByData.name && requestedByData.name !== "N/A";
  const hasApprovedBy = approvedByData.name && approvedByData.name !== "N/A";

  const formatSignatureDate = (date) => {
    console.log(date, "date");
    if (!date) return "";
    const momentDate = moment(date);
    if (!momentDate.isValid()) return "";
    return momentDate.format("DD MMM, YYYY");
  };

  return (
    <div
      ref={invoiceRef}
      className="max-w-5xl mx-auto bg-white shadow-sm invoice-container border border-gray-200"
    >
      <div className="p-">
        <BusinessDocumentHeader
          business={{
            ...company,
            business_name: companyData.name,
          }}
          title="Purchase Order"
          numberLabel={`No: ${companyData.requestNumber}`}
          date={companyData.requestDate}
        />

        {/* Supplier Information */}
        {orderData?.supplier && (
          <div className="grid gap-1 mb-1">
            <div className="bg-blue-50 border border-blue-200 p-1">
              <h6 className="text-xs font-semibold text-blue-800 mb- uppercase tracking-wide">
                Supplier
              </h6>
              <p className="text-xs text-gray-700 leading-relaxed">
                <span className="font-semibold text-gray-600">Name:</span>{" "}
                <span className="text-gray-900">
                  {orderData.supplier.name || "N/A"}
                </span>{" "}
                {orderData.supplier.code && (
                  <>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="font-semibold text-gray-600">
                      Code:
                    </span>{" "}
                    <span className="text-gray-900">
                      {orderData.supplier.code}
                    </span>
                  </>
                )}
                {orderData.supplier.address && (
                  <>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="font-semibold text-gray-600">
                      Address:
                    </span>{" "}
                    <span className="text-gray-900">
                      {orderData.supplier.address}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="mb-1">
          <table className="w-full border-collapse border border-gray-300 overflow-hidden shadow-sm">
            <thead>
              <tr className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white">
                <th className="border-r border-blue-500 px-2 py-1.5 text-center text-xs font-semibold">
                  #
                </th>
                <th className="border-r border-blue-500 px-2 py-1.5 text-left text-xs font-semibold">
                  Item Name
                </th>
                <th className="border-r border-blue-500 px-2 py-1.5 text-center text-xs font-semibold">
                  Quantity
                </th>
                <th className="px-2 py-1.5 text-center text-xs font-semibold">
                  Unit of Measure
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {materials && materials.length > 0 ? (
                materials.map((material, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="border-r border-t border-gray-200 px-2 py-1.5 text-center text-xs font-semibold text-gray-600">
                      {index + 1}
                    </td>
                    <td className="border-r border-t border-gray-200 px-2 py-1.5 text-xs">
                      <strong className="text-gray-800">
                        {material.description || material.item_name || "N/A"}
                      </strong>
                      {material.itemCode && (
                        <div className="text-gray-600 text-xs mt-0.5">
                          Code: {material.itemCode}
                        </div>
                      )}
                    </td>
                    <td className="border-r border-t border-gray-200 px-2 py-1.5 text-center text-xs text-gray-700">
                      {formatNumber1(material.quantity || 0)}
                    </td>
                    <td className="border-t border-gray-200 px-2 py-1.5 text-center text-xs text-gray-700">
                      {material.unit || material.unit_measure || "N/A"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="border-t border-gray-200 px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No data to view
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Section */}
        {(hasRequestedBy || hasApprovedBy) && (
          <div className="grid grid-cols-2 gap-2 mb-1">
            {hasRequestedBy && (
              <div className="bg-gray-50 border border-gray-200 p-2">
                <h3 className="text-xs font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">
                  Requested By
                </h3>
                <p className="text-xs font-bold text-gray-900 text-center mb-3">
                  {requestedByData.name}
                </p>
                {renderSignature(requestedByData)}
                <p className="text-xs text-gray-500 text-center">
                  {requestedByData.date}
                </p>
              </div>
            )}
            {/* {JSON.stringify()} */}
            {hasApprovedBy && (
              <div className="bg-blue-50 border border-blue-200 p-2">
                <h3 className="text-xs font-bold text-gray-800 mb-2 border-b border-blue-300 pb-1">
                  Approved By
                </h3>
                <p className="text-xs font-bold text-gray-900 text-center mb-3">
                  {approvedByData.name}
                </p>
                {renderSignature(approvedByData)}
                <p className="text-xs text-gray-500 text-center">
                  {approvedByData.date}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const InventriaMaterialRequestPDF = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const pr_no = useQuery().get("pr_no");
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const invoiceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (pr_no && activeBusiness?.id) {
      setLoading(true);
      _fetchApi(
        `/get/purchase-order-pdf?pr_no=${pr_no}&facilityId=${activeBusiness.id}`,
        (data) => {
          setLoading(false);
          if (data.success) {
            setOrderData(data.data);
          } else {
            toast.error(data.message || "Error fetching purchase order");
          }
        },
        (err) => {
          setLoading(false);
          console.error("Error fetching purchase order:", err);
          toast.error("Error fetching purchase order");
        }
      );
    } else {
      setLoading(false);
    }
  }, [pr_no, activeBusiness?.id]);

  const handleReactToPrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `Purchase-Order-${pr_no || "N/A"}`,
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
      .invoice-container {
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
        if (!invoiceRef.current) {
          toast.error("Purchase order content is not ready to print yet.");
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
      toast.error("Unable to print purchase order. Please try again.");
    },
  });

  const handlePrint = useCallback(() => {
    if (!invoiceRef.current) {
      toast.error("Purchase order content is not ready to print yet.");
      return;
    }

    try {
      handleReactToPrint();
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Unable to print purchase order. Please try again.");
    }
  }, [handleReactToPrint]);

  const renderSkeletonFrame = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Action Buttons Skeleton */}
        <div className="flex justify-between items-center mb-3">
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
        </div>
        {/* Header Skeleton */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] p-4 space-y-3">
            <div className="h-8 bg-blue-800/50 animate-pulse rounded w-3/4" />
            <div className="h-4 bg-blue-800/50 animate-pulse rounded w-1/2" />
            <div className="h-4 bg-blue-800/50 animate-pulse rounded w-2/3" />
          </div>
          {/* Supplier Skeleton */}
          <div className="p-4 border-b border-gray-200">
            <div className="h-4 bg-gray-200 animate-pulse rounded w-1/4 mb-2" />
            <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
          </div>
          {/* Table Skeleton */}
          <div className="p-4 space-y-3">
            <div className="h-6 bg-gray-200 animate-pulse rounded w-1/2" />
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-4 bg-gray-200 animate-pulse rounded"
                />
              ))}
            </div>
            {[...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className="h-12 bg-gray-200 animate-pulse rounded"
              />
            ))}
          </div>
          {/* Footer Skeleton */}
          <div className="p-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(2)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-24 bg-gray-200 animate-pulse rounded"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return renderSkeletonFrame();
  }

  if (!orderData) {
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
            No purchase order data found
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
          .invoice-container { padding: 0px; box-shadow: none; }
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
            className="px-3 py-0.5 text-sm bg-blue-600 text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Purchase Order Container */}
      <PurchaseOrderHTML
        orderData={orderData}
        company={activeBusiness}
        invoiceRef={invoiceRef}
      />
    </div>
  );
};

export default InventriaMaterialRequestPDF;
