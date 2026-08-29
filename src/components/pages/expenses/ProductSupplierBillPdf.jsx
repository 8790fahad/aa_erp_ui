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
import { isProductTaxable } from "@/utils/taxableStatus";

const ProductSupplierBillHTML = ({ billData, company, invoiceRef }) => {
  const formatDate = (date) => {
    if (!date) return "N/A";
    const momentDate = moment(date);
    if (!momentDate.isValid()) return "N/A";
    return momentDate.format("DD MMM, YYYY");
  };

  const formatNumber = (num) => {
    return parseFloat(num || 0)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Calculate payment terms in days from transaction date and due date
  const calculatePaymentTerms = () => {
    const transactionDate = billData?.transaction_date || billData?.date;
    const dueDate = billData?.due_date;

    if (!transactionDate || !dueDate) {
      return billData?.terms ? `${billData.terms} days` : "N/A";
    }

    const transDate = moment(transactionDate);
    const due = moment(dueDate);

    if (!transDate.isValid() || !due.isValid()) {
      return billData?.terms ? `${billData.terms} days` : "N/A";
    }

    const daysDiff = due.diff(transDate, "days");
    return `${daysDiff} days`;
  };

  const items = billData?.items || [];
  const taxes = billData?.taxes || [];
  const vatPolicy =
    billData?.vat_policy || company?.vat_policy || "vat_exclusive";
  const totalVatAmount =
    billData?.total_vat_amount ||
    taxes.reduce(
      (sum, tax) => sum + (parseFloat(tax.amount) || parseFloat(tax.cost) || 0),
      0
    );

  const subtotal = items.reduce(
    (sum, item) =>
      sum + (parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 0),
    0
  );

  const totalTaxFromItems = (items || []).reduce((sum, item) => {
    const dbVat = parseFloat(item.vat_amount);
    return sum + (Number.isFinite(dbVat) && dbVat > 0 ? dbVat : 0);
  }, 0);
  const totalTax =
    totalTaxFromItems > 0
      ? totalTaxFromItems
      : parseFloat(totalVatAmount) || 0;

  const isTaxInclusiveType = (tax) => {
    const inclusiveType = String(tax.inclusive_type || tax.tax_type || "")
      .toLowerCase()
      .trim();
    if (inclusiveType === "inclusive") return true;
    if (inclusiveType === "exclusive") return false;
    return vatPolicy === "vat_inclusive";
  };

  const formatTaxName = (tax) => {
    const isInclusive = isTaxInclusiveType(tax);
    const typeLabel = isInclusive ? "Incl." : "Excl.";
    let base = String(tax.name || "").trim();
    if (!base) {
      base = String(tax.description || "Input VAT")
        .replace(/\s*@?\s*\d+(\.\d+)?\s*%/gi, "")
        .replace(/\s*\((inclusive|exclusive|incl\.?|excl\.?)\)/gi, "")
        .replace(/\s+on purchase of\s+.+$/i, "")
        .replace(/\s+purchase of\s+.+$/i, "")
        .trim();
    }
    if (!base || /^vat$/i.test(base)) base = "Input VAT";
    const rateRaw = tax.rate != null && tax.rate !== "" ? String(tax.rate) : "";
    const rateLabel = rateRaw ? ` ${rateRaw}%` : "";
    return `${base}${rateLabel} (${typeLabel})`;
  };

  const taxNameLabels = [];
  const taxNameSeen = new Set();
  let inclusiveTaxAmount = 0;
  let exclusiveTaxAmount = 0;
  (taxes || []).forEach((tax) => {
    const amt = parseFloat(tax.amount) || parseFloat(tax.cost) || 0;
    if (amt <= 0) return;
    if (isTaxInclusiveType(tax)) inclusiveTaxAmount += amt;
    else exclusiveTaxAmount += amt;
    const label = formatTaxName(tax);
    if (taxNameSeen.has(label)) return;
    taxNameSeen.add(label);
    taxNameLabels.push(label);
  });

  // When only item vat_amount is available, treat by vat_policy
  if (
    (!taxes || taxes.length === 0 || inclusiveTaxAmount + exclusiveTaxAmount <= 0) &&
    totalTax > 0
  ) {
    if (vatPolicy === "vat_inclusive") inclusiveTaxAmount = totalTax;
    else if (vatPolicy === "vat_exclusive") exclusiveTaxAmount = totalTax;
    else inclusiveTaxAmount = totalTax;
  }

  const totalTaxLabel =
    taxNameLabels.length > 0
      ? `${taxNameLabels.join(" + ")}:`
      : totalTax > 0
        ? vatPolicy === "vat_exclusive"
          ? "Input VAT 7.5% (Excl.):"
          : "Input VAT 7.5% (Incl.):"
        : "TOTAL TAX:";

  // Standard invoice totals:
  // Inclusive: Subtotal (excl. VAT) + VAT = Grand Total (incl. VAT)
  // Exclusive: Subtotal + VAT = Grand Total
  const hasInclusiveTax =
    vatPolicy === "vat_inclusive" ||
    (inclusiveTaxAmount > 0 && vatPolicy !== "vat_exclusive");

  let displaySubtotal = subtotal;
  let subtotalLabel = "SUBTOTAL:";
  let grandTotal = subtotal;

  if (vatPolicy === "vat_inclusive" || (hasInclusiveTax && exclusiveTaxAmount <= 0)) {
    displaySubtotal = Math.max(0, subtotal - (inclusiveTaxAmount || totalTax));
    subtotalLabel = "SUBTOTAL (excl. VAT):";
    grandTotal = subtotal;
  } else if (vatPolicy === "all") {
    displaySubtotal = Math.max(0, subtotal - inclusiveTaxAmount);
    subtotalLabel =
      inclusiveTaxAmount > 0 ? "SUBTOTAL (excl. VAT):" : "SUBTOTAL:";
    grandTotal = subtotal + exclusiveTaxAmount;
  } else {
    // vat_exclusive
    displaySubtotal = subtotal;
    subtotalLabel = "SUBTOTAL:";
    grandTotal = subtotal + (exclusiveTaxAmount || totalTax);
  }

  const colCount = 5; // #, Description, Quantity, Unit Price, Amount

  return (
    <div
      ref={invoiceRef}
      className="max-w-5xl mx-auto bg-white shadow-sm invoice-container border border-gray-200"
    >
      <div className="p-">
        <BusinessDocumentHeader
          business={company}
          title="Product  Bill"
          numberLabel={`No: ${billData?.invoice_ref || billData?.ref_number || "N/A"}`}
          date={billData?.transaction_date || billData?.date}
        />

        {/* Supplier Information */}
        {billData?.supplier_name && (
          <div className="grid gap-1 mb-1">
            <div className="bg-blue-50 border border-blue-200 p-1">
              <h6 className="text-xs font-semibold text-blue-800 mb- uppercase tracking-wide">
                Supplier
              </h6>
              <p className="text-xs text-gray-700 leading-relaxed">
                <span className="font-semibold text-gray-600">Name:</span>{" "}
                <span className="text-gray-900">
                  {billData.supplier_name || "N/A"}
                </span>{" "}
                {billData.supplier_code && (
                  <>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="font-semibold text-gray-600">
                      Code:
                    </span>{" "}
                    <span className="text-gray-900">
                      {billData.supplier_code}
                    </span>
                  </>
                )}
                {billData.supplier_address && (
                  <>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="font-semibold text-gray-600">
                      Address:
                    </span>{" "}
                    <span className="text-gray-900">
                      {billData.supplier_address}
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
                <th className="border-r border-[var(--aa-accent)] px-2 py-1.5 text-center text-xs font-semibold">
                  #
                </th>
                <th className="border-r border-[var(--aa-accent)] px-2 py-1.5 text-left text-xs font-semibold">
                  Description
                </th>
                <th className="border-r border-[var(--aa-accent)] px-2 py-1.5 text-center text-xs font-semibold">
                  Quantity
                </th>
                <th className="border-r border-[var(--aa-accent)] px-2 py-1.5 text-right text-xs font-semibold">
                  Unit Price
                </th>
                <th className="px-2 py-1.5 text-right text-xs font-semibold">
                  Amount (₦)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {items && items.length > 0 ? (
                <>
                  {items.map((item, index) => {
                    const quantity = parseFloat(item.quantity) || 0;
                    const cost = parseFloat(item.cost) || 0;
                    const amount = quantity * cost;
                    return (
                      <tr
                        key={`item-${index}`}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="border-r border-t border-gray-200 px-2 py-1.5 text-center text-xs font-semibold text-gray-600">
                          {index + 1}
                        </td>
                        <td className="border-r border-t border-gray-200 px-2 py-1.5 text-xs">
                          <div className="flex flex- gap-2">
                            <strong className="text-gray-800">
                              {item.item_name || item.description || "N/A"}
                            </strong>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold w-fit ${
                                isProductTaxable(item.taxable)
                                  ? "bg-green-100 text-green-800"
                                  : ""
                              }`}
                            >
                              {isProductTaxable(item.taxable) ? "Taxable" : null}
                            </span>
                          </div>
                        </td>
                        <td className="border-r border-t border-gray-200 px-2 py-1.5 text-center text-xs text-gray-700">
                          {formatNumber1(quantity)}
                        </td>
                        <td className="border-r border-t border-gray-200 px-2 py-1.5 text-right text-xs text-gray-700">
                          {formatNumber(cost)}
                        </td>
                        <td className="border-t border-gray-200 px-2 py-1.5 text-right text-xs font-semibold text-gray-900">
                          {formatNumber(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ) : (
                <tr>
                  <td
                    colSpan={colCount}
                    className="border-t border-gray-200 px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No data to view
                  </td>
                </tr>
              )}
              {/* Standardized totals: SUBTOTAL → TOTAL TAX → GRAND TOTAL */}
              {items && items.length > 0 && (
                <>
                  <tr className="bg-slate-100 border-t border-slate-300">
                    <td
                      colSpan={4}
                      className="border-r border-slate-300 px-2 py-2 text-right text-xs font-bold text-slate-800"
                    >
                      {subtotalLabel}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-slate-900 tabular-nums">
                      {formatNumber(displaySubtotal)}
                    </td>
                  </tr>
                  {totalTax > 0 ? (
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td
                        colSpan={4}
                        className="border-r border-slate-200 px-2 py-2 text-right text-xs font-bold text-slate-800"
                      >
                        {totalTaxLabel}
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-bold text-slate-900 tabular-nums">
                        {formatNumber(totalTax)}
                      </td>
                    </tr>
                  ) : null}
                  <tr className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white border-t-2 border-[var(--aa-accent)]">
                    <td
                      colSpan={4}
                      className="border-r border-[var(--aa-accent)] px-2 py-2 text-right text-sm font-bold"
                    >
                      GRAND TOTAL:
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-bold tabular-nums">
                      {formatNumber(grandTotal)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Section */}
        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="bg-gray-50 border border-gray-200 p-2">
            <h3 className="text-xs font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">
              Bill Details
            </h3>
            <p className="text-xs mb-1 text-gray-700">
              <span className="font-semibold">Bill No:</span>{" "}
              <span className="text-gray-900">
                {billData?.invoice_ref || billData?.ref_number || "N/A"}
              </span>
            </p>
            <p className="text-xs mb-1 text-gray-700">
              <span className="font-semibold">Transaction Date:</span>{" "}
              <span className="text-gray-900">
                {formatDate(billData?.transaction_date || billData?.date)}
              </span>
            </p>
            <p className="text-xs mb-1 text-gray-700">
              <span className="font-semibold">Due Date:</span>{" "}
              <span className="text-gray-900">
                {billData?.due_date ? formatDate(billData.due_date) : "N/A"}
              </span>
            </p>
            {/* <p className="text-xs mb-1 text-gray-700">
              <span className="font-semibold">Payment Terms:</span>{" "}
              <span className="text-gray-900">{calculatePaymentTerms()}</span>
            </p> */}
            <p className="text-xs mb-2 text-gray-700">
              <span className="font-semibold">Remark/Description:</span>{" "}
              <span className="text-gray-900">
                {billData?.remark || billData?.description || "N/A"}
              </span>
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-1.5">
            <h6 className="text-xs font-bold text-gray-800 mb-2 border-b border-blue-300 pb-1">
              Authorization
            </h6>
            <p className="text-xs mb-1.5 text-gray-700 pt-3">
              <span className="font-semibold ">Authorized By:</span>{" "}
              <span className="text-gray-900">_________________</span>
            </p>
            <div className="mt- border-t border-blue-300 pt-4">
              <p className="text-xs text-gray-600">
                Signature: ___________________________________
              </p>
            </div>
          </div>
        </div>

        {/* Page Footer */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-r-4 border-l-4 border-[var(--aa-accent)] p-1 shadow-sm">
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
              <h6 className="text-xs text-blue-800 mt-">
                This solution is powered by Nexifour Limited · NDPC | ISO 27001 | ISO 9001
              </h6>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProductSupplierBillPdf = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const invoiceRef = useQuery().get("invoice_ref");
  const refNumber = useQuery().get("ref_number");
  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if ((invoiceRef || refNumber) && activeBusiness?.id) {
      setLoading(true);
      _fetchApi(
        `/account/get-expense-bill?invoice_ref=${
          invoiceRef || refNumber
        }&facilityId=${activeBusiness.id}`,
        (data) => {
          setLoading(false);
          if (data.success) {
            setBillData(data.data);
          } else {
            toast.error(data.message || "Error fetching expense bill");
          }
        },
        (err) => {
          setLoading(false);
          console.error("Error fetching expense bill:", err);
          toast.error("Error fetching expense bill");
        }
      );
    } else {
      setLoading(false);
    }
  }, [invoiceRef, refNumber, activeBusiness?.id]);

  const handleReactToPrint = useReactToPrint({
    contentRef: pdfRef,
    documentTitle: `Product-Supplier-Bill-${invoiceRef || refNumber || "N/A"}`,
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
        if (!pdfRef.current) {
          toast.error("Bill content is not ready to print yet.");
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
      toast.error("Unable to print bill. Please try again.");
    },
  });

  const handlePrint = useCallback(() => {
    if (!pdfRef.current) {
      toast.error("Bill content is not ready to print yet.");
      return;
    }

    try {
      handleReactToPrint();
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Unable to print bill. Please try again.");
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

  if (!billData) {
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
            No expense bill data found
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
            className="px-3 py-0.5 text-sm bg-[var(--aa-navy)] text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Bill Container */}
      <ProductSupplierBillHTML
        billData={billData}
        company={activeBusiness}
        invoiceRef={pdfRef}
      />
    </div>
  );
};

export default ProductSupplierBillPdf;
