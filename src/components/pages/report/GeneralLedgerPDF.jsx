import React, { useState, useEffect, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, X, ArrowLeft } from "lucide-react";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

export default function GeneralLedgerPDF() {
  const location = useLocation();
  const navigate = useNavigate();
  const invoiceRef = useRef(null);
  const { user, activeBusiness } = useSelector((state) => state.auth);

  // Get data from navigation state
  const { reportData: rawReportData, fromDate, toDate, reportTotals } = location.state || {};

  // Dummy data for demonstration
  const dummyTransactions = [
    // Zenith Bank Account
    {
      account_code: "1-201",
      account_description: "Zenith Bank",
      transaction_date: "2024-01-15",
      transaction_type: "Deposit",
      reference: "DEP001",
      transaction_id: "TXN001",
      customer_name: "ABC Corporation",
      memo: "Payment for Invoice #INV-2024-001",
      description: "Customer payment received",
      split_account: "4-100",
      dr: "500000.00",
      cr: "0.00"
    },
    {
      account_code: "1-201",
      account_description: "Zenith Bank",
      transaction_date: "2024-01-16",
      transaction_type: "Payment",
      reference: "PAY001",
      transaction_id: "TXN002",
      supplier_name: "XYZ Suppliers Ltd",
      memo: "Payment for raw materials",
      description: "Supplier payment",
      split_account: "2-300",
      dr: "0.00",
      cr: "150000.00"
    },
    {
      account_code: "1-201",
      account_description: "Zenith Bank",
      transaction_date: "2024-01-18",
      transaction_type: "Transfer",
      reference: "TRF001",
      transaction_id: "TXN003",
      customer_name: "Internal Transfer",
      memo: "Transfer to petty cash",
      description: "Fund transfer",
      split_account: "1-105",
      dr: "0.00",
      cr: "25000.00"
    },
    {
      account_code: "1-201",
      account_description: "Zenith Bank",
      transaction_date: "2024-01-20",
      transaction_type: "Deposit",
      reference: "DEP002",
      transaction_id: "TXN004",
      customer_name: "DEF Industries",
      memo: "Payment for services rendered",
      description: "Service payment",
      split_account: "4-200",
      dr: "750000.00",
      cr: "0.00"
    },
    {
      account_code: "1-201",
      account_description: "Zenith Bank",
      transaction_date: "2024-01-22",
      transaction_type: "Payment",
      reference: "PAY002",
      transaction_id: "TXN005",
      supplier_name: "Utility Company",
      memo: "Electricity bill payment",
      description: "Utility payment",
      split_account: "5-400",
      dr: "0.00",
      cr: "45000.00"
    },
    // Access Bank Account
    {
      account_code: "1-202",
      account_description: "Access Bank",
      transaction_date: "2024-01-14",
      transaction_type: "Deposit",
      reference: "DEP003",
      transaction_id: "TXN006",
      customer_name: "GHI Trading Co.",
      memo: "Sales revenue",
      description: "Product sales",
      split_account: "4-100",
      dr: "320000.00",
      cr: "0.00"
    },
    {
      account_code: "1-202",
      account_description: "Access Bank",
      transaction_date: "2024-01-17",
      transaction_type: "Payment",
      reference: "PAY003",
      transaction_id: "TXN007",
      supplier_name: "Office Supplies Ltd",
      memo: "Office equipment purchase",
      description: "Equipment payment",
      split_account: "1-500",
      dr: "0.00",
      cr: "85000.00"
    },
    {
      account_code: "1-202",
      account_description: "Access Bank",
      transaction_date: "2024-01-21",
      transaction_type: "Deposit",
      reference: "DEP004",
      transaction_id: "TXN008",
      customer_name: "JKL Enterprises",
      memo: "Consulting fees",
      description: "Professional services",
      split_account: "4-300",
      dr: "450000.00",
      cr: "0.00"
    },
    // Accounts Receivable
    {
      account_code: "1-300",
      account_description: "Accounts Receivable",
      transaction_date: "2024-01-10",
      transaction_type: "Invoice",
      reference: "INV-001",
      transaction_id: "TXN009",
      customer_name: "MNO Corporation",
      memo: "Product delivery - Invoice #INV-001",
      description: "Sales on credit",
      split_account: "4-100",
      dr: "680000.00",
      cr: "0.00"
    },
    {
      account_code: "1-300",
      account_description: "Accounts Receivable",
      transaction_date: "2024-01-19",
      transaction_type: "Payment",
      reference: "REC-001",
      transaction_id: "TXN010",
      customer_name: "MNO Corporation",
      memo: "Payment received for INV-001",
      description: "Customer payment",
      split_account: "1-201",
      dr: "0.00",
      cr: "680000.00"
    },
    {
      account_code: "1-300",
      account_description: "Accounts Receivable",
      transaction_date: "2024-01-23",
      transaction_type: "Invoice",
      reference: "INV-002",
      transaction_id: "TXN011",
      customer_name: "PQR Limited",
      memo: "Service contract - Invoice #INV-002",
      description: "Service revenue",
      split_account: "4-200",
      dr: "920000.00",
      cr: "0.00"
    },
    // Accounts Payable
    {
      account_code: "2-300",
      account_description: "Accounts Payable",
      transaction_date: "2024-01-12",
      transaction_type: "Bill",
      reference: "BILL-001",
      transaction_id: "TXN012",
      supplier_name: "STU Suppliers",
      memo: "Raw materials purchase",
      description: "Inventory purchase",
      split_account: "1-400",
      dr: "0.00",
      cr: "540000.00"
    },
    {
      account_code: "2-300",
      account_description: "Accounts Payable",
      transaction_date: "2024-01-16",
      transaction_type: "Payment",
      reference: "PAY-004",
      transaction_id: "TXN013",
      supplier_name: "STU Suppliers",
      memo: "Payment for BILL-001",
      description: "Supplier payment",
      split_account: "1-201",
      dr: "540000.00",
      cr: "0.00"
    },
    {
      account_code: "2-300",
      account_description: "Accounts Payable",
      transaction_date: "2024-01-24",
      transaction_type: "Bill",
      reference: "BILL-002",
      transaction_id: "TXN014",
      supplier_name: "VWX Services",
      memo: "Maintenance services",
      description: "Service expense",
      split_account: "5-500",
      dr: "0.00",
      cr: "125000.00"
    },
    // Sales Revenue
    {
      account_code: "4-100",
      account_description: "Sales Revenue",
      transaction_date: "2024-01-11",
      transaction_type: "Sale",
      reference: "SALE-001",
      transaction_id: "TXN015",
      customer_name: "YZA Company",
      memo: "Product sales - Cash",
      description: "Cash sales",
      split_account: "1-201",
      dr: "0.00",
      cr: "380000.00"
    },
    {
      account_code: "4-100",
      account_description: "Sales Revenue",
      transaction_date: "2024-01-13",
      transaction_type: "Sale",
      reference: "SALE-002",
      transaction_id: "TXN016",
      customer_name: "BCD Traders",
      memo: "Bulk order delivery",
      description: "Credit sales",
      split_account: "1-300",
      dr: "0.00",
      cr: "560000.00"
    }
  ];

  // Use dummy data if no real data is provided
  const reportData = rawReportData && rawReportData.length > 0 ? rawReportData : dummyTransactions;

  const [loading, setLoading] = useState(false);

  const business = activeBusiness;

  const formatNumber = (num) => {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatDate = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleReactToPrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `General-Ledger-${fromDate}-to-${toDate}`,
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
      .no-print { display: none !important; }
    `,
    onBeforeGetContent: () => {
      return new Promise((resolve) => {
        if (!invoiceRef.current) {
          toast.error("Report content is not ready to print yet.");
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
      toast.error("Unable to print report. Please try again.");
    },
  });

  const handlePrint = useCallback(() => {
    if (!invoiceRef.current) {
      toast.error("Report content is not ready to print yet.");
      return;
    }

    try {
      handleReactToPrint(() => invoiceRef.current);
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Unable to print report. Please try again.");
    }
  }, [handleReactToPrint]);

  const handleBack = () => {
    navigate(-1);
  };

  // Calculate totals
  const totalDebit = reportData?.reduce((sum, row) => sum + (parseFloat(row.dr) || 0), 0) || 0;
  const totalCredit = reportData?.reduce((sum, row) => sum + (parseFloat(row.cr) || 0), 0) || 0;

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No Report Data Available
            </h2>
            <p className="text-gray-600 mb-4">
              Please generate a report first before accessing this page.
            </p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
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
        }
      `}</style>

      {/* Action Buttons */}
      <div className="max-w-5xl mx-auto mb-3 flex flex-wrap gap-2 items-center justify-between no-print p-4">
        <button
          onClick={handleBack}
          className="px-3 py-2 text-sm bg-gray-600 text-white rounded flex items-center gap-2 hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          onClick={handlePrint}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Printer size={16} /> Print PDF
        </button>
      </div>

      {/* Report Container */}
      <div
        ref={invoiceRef}
        className="max-w-5xl mx-auto bg-white shadow-sm invoice-container border border-gray-200"
      >
        <div className="p-6">
          <BusinessDocumentHeader
            business={business}
            title="General Ledger"
            numberLabel={`${formatDate(fromDate)} - ${formatDate(toDate)}`}
            date={new Date()}
            dateFormat="DD MMM YYYY, hh:mm A"
            className="mb-4 rounded"
          />

          {/* Summary Table - Below Header, Before Main Content */}
          <div className="w-full mb-6">
            <div className="border border-gray-300">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300">
                    <th className="px-2 py-3 text-left font-semibold text-gray-700 text-xs">DATE</th>
                    <th className="px-2 py-3 text-left font-semibold text-gray-700 text-xs">ACCOUNT</th>
                    <th className="px-2 py-3 text-left font-semibold text-gray-700 text-xs">TYPE</th>
                    <th className="px-2 py-3 text-left font-semibold text-gray-700 text-xs">NO.</th>
                    <th className="px-2 py-3 text-left font-semibold text-gray-700 text-xs">NAME</th>
                    <th className="px-2 py-3 text-left font-semibold text-gray-700 text-xs">MEMO</th>
                    <th className="px-2 py-3 text-left font-semibold text-gray-700 text-xs">SPLIT</th>
                    <th className="px-2 py-3 text-right font-semibold text-gray-700 text-xs">AMOUNT</th>
                    <th className="px-2 py-3 text-right font-semibold text-gray-700 text-xs">BALANCE</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData && reportData.length > 0 ? (
                    (() => {
                      let runningBalance = 0;
                      return reportData.map((transaction, index) => {
                        const debit = parseFloat(transaction.dr) || 0;
                        const credit = parseFloat(transaction.cr) || 0;
                        runningBalance += debit - credit;
                        
                        return (
                          <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-2 py-2 text-xs">
                              {transaction.transaction_date
                                ? new Date(transaction.transaction_date).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : ""}
                            </td>
                            <td className="px-2 py-2 text-xs font-medium">
                              {transaction.account_code} - {transaction.account_description}
                            </td>
                            <td className="px-2 py-2 text-xs">{transaction.transaction_type || "General"}</td>
                            <td className="px-2 py-2 text-xs">{transaction.reference || transaction.transaction_id || ""}</td>
                            <td className="px-2 py-2 text-xs">{transaction.customer_name || transaction.supplier_name || ""}</td>
                            <td className="px-2 py-2 text-xs">{transaction.memo || transaction.description || ""}</td>
                            <td className="px-2 py-2 text-xs">{transaction.split_account || ""}</td>
                            <td className="px-2 py-2 text-right text-xs">
                              {debit > 0 ? (
                                <span className="text-green-600">₦{formatNumber(debit)}</span>
                              ) : credit > 0 ? (
                                <span className="text-red-600">-₦{formatNumber(credit)}</span>
                              ) : (
                                "₦0.00"
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-medium text-xs">
                              ₦{formatNumber(Math.abs(runningBalance))}
                            </td>
                          </tr>
                        );
                      });
                    })()
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-gray-500 text-sm">
                        No transactions available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notice */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-r-4 border-amber-500 p-2 shadow-sm rounded">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-amber-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-2">
                <h6 className="text-xs font-semibold text-amber-900">
                  CONFIDENTIAL DOCUMENT
                </h6>
                <h6 className="text-xs text-amber-800 mt-1">
                  This report contains confidential financial information. Unauthorized
                  distribution or disclosure is strictly prohibited.
                </h6>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
