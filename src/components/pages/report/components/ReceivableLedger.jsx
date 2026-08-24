import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, X, Printer, Download } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const ReceivableLedger = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const facilityId = activeBusiness?.id;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const printRef = useRef(null);
  const preselectedAppliedRef = useRef(false);

  // Initialize dates - default to current month-to-date (or asAt from query)
  useEffect(() => {
    const asAt = searchParams.get("asAt") || searchParams.get("toDate");
    const fromQ = searchParams.get("fromDate");
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const end = asAt || todayStr;
    const endDate = new Date(end);
    const yearStart = Number.isNaN(endDate.getTime())
      ? new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0]
      : new Date(endDate.getFullYear(), 0, 1).toISOString().split("T")[0];
    const firstDayStr = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    setFromDate(fromQ || (asAt ? yearStart : firstDayStr));
    setToDate(end);
  }, [searchParams]);

  // Load customers using getCustomersList from customer.js controller
  useEffect(() => {
    if (!facilityId) return;

    _fetchApi(
      `/api/v1/get-customers-list/${facilityId}`,
      (response) => {
        if (response.success) {
          const customersList = response.results || response.data || [];
          const mapped = customersList.map((customer) => ({
            id: customer.customerNo || customer.id,
            name: customer.fullname || customer.name,
            customerNo: customer.customerNo,
            address: customer.address || "",
          }));
          setCustomers(mapped);
        }
      },
      (err) => {
        console.error("Error loading customers:", err);
      },
    );
  }, [facilityId]);

  // Preselect customer from Receivable Report drill-down
  useEffect(() => {
    if (preselectedAppliedRef.current || !customers.length) return;
    const customerNo =
      searchParams.get("customerNo") || searchParams.get("customerId");
    if (!customerNo) return;
    const match = customers.find(
      (c) =>
        String(c.customerNo || c.id).toLowerCase() ===
        String(customerNo).toLowerCase(),
    );
    if (match) {
      setSelectedCustomer(match);
      preselectedAppliedRef.current = true;
    } else {
      // Customer may not be in list yet — still seed selection from query
      const name = searchParams.get("customerName") || customerNo;
      setSelectedCustomer({
        id: customerNo,
        name,
        customerNo,
        address: "",
      });
      preselectedAppliedRef.current = true;
    }
  }, [customers, searchParams]);

  const fetchReceivableLedgerData = useCallback(async () => {
    if (!facilityId || !fromDate || !toDate || !selectedCustomer) {
      setError("Please provide facility ID, date range, and customer");
      return;
    }

    setLoading(true);
    setError("");

    _postApi(
      `/account/receivable-ledger`,
      {
        facilityId,
        fromDate,
        toDate,
        customerId: selectedCustomer.id,
      },
      (response) => {
        setLoading(false);
        if (response.success && response.data) {
          setLedgerData(response.data);
        } else {
          setError(
            response.message || "Failed to fetch receivable ledger data",
          );
        }
      },
      (err) => {
        setLoading(false);
        console.error("Receivable Ledger Error:", err);
        setError("An error occurred while fetching receivable ledger data");
      },
    );
  }, [facilityId, fromDate, toDate, selectedCustomer]);

  // Fetch data when dates or customer change
  useEffect(() => {
    if (fromDate && toDate && facilityId && selectedCustomer) {
      fetchReceivableLedgerData();
    }
  }, [
    fromDate,
    toDate,
    facilityId,
    selectedCustomer,
    fetchReceivableLedgerData,
  ]);

  const formatCurrency = formatNaira;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleRunReport = () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    fetchReceivableLedgerData();
  };

  const handleReactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Receivable-Ledger-${
      selectedCustomer?.name || ""
    }-${formatDate(fromDate)}-to-${formatDate(toDate)}`,
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
      .print-content {
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
        if (!printRef.current) {
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
    if (!printRef.current) {
      toast.error("Report content is not ready to print yet.");
      return;
    }

    try {
      handleReactToPrint();
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Unable to print report. Please try again.");
    }
  }, [handleReactToPrint]);

  const handleExportToExcel = async () => {
    if (!ledgerData) {
      toast.error("No data to export");
      return;
    }
    const opening = Number(
      ledgerData.openingBalance ?? ledgerData.balanceForward ?? 0,
    );
    const hasRows =
      (ledgerData.transactions?.length ?? 0) > 0 ||
      Math.abs(opening) > 0.01;
    if (!hasRows) {
      toast.error("No data to export");
      return;
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Receivable Ledger");

    // Set column widths
    worksheet.columns = [
      { width: 12 }, // Date
      { width: 15 }, // Ref
      { width: 50 }, // Description
      { width: 18 }, // Debit
      { width: 18 }, // Credit
      { width: 18 }, // Balance
    ];

    // Define styles
    const borderStyle = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };

    const headerStyle = {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4B5563" },
      },
      alignment: { vertical: "middle", horizontal: "center" },
      border: borderStyle,
    };

    const titleStyle = {
      font: { bold: true, size: 14 },
      alignment: { vertical: "middle", horizontal: "center" },
    };

    const dataStyle = {
      alignment: { vertical: "middle", horizontal: "left" },
      border: borderStyle,
    };

    const numberStyle = {
      alignment: { vertical: "middle", horizontal: "right" },
      border: borderStyle,
      numFmt: "#,##0.00",
    };

    let currentRow = 1;

    // Business Name
    const businessName = worksheet.getCell(currentRow, 3);
    businessName.value =
      activeBusiness?.business_name || activeBusiness?.name || "Business Name";
    businessName.style = titleStyle;
    worksheet.mergeCells(currentRow, 3, currentRow, 6);
    currentRow++;

    // Report Title
    const titleCell = worksheet.getCell(currentRow, 3);
    titleCell.value = "RECEIVABLE LEDGER";
    titleCell.style = { ...titleStyle, font: { bold: true, size: 12 } };
    worksheet.mergeCells(currentRow, 3, currentRow, 6);
    currentRow++;

    // Customer Name
    const customerCell = worksheet.getCell(currentRow, 3);
    customerCell.value = `Customer: ${selectedCustomer?.name || "N/A"}`;
    customerCell.style = {
      ...titleStyle,
      font: { ...titleStyle.font, size: 11 },
    };
    worksheet.mergeCells(currentRow, 3, currentRow, 6);
    currentRow++;

    // Period
    const periodCell = worksheet.getCell(currentRow, 3);
    periodCell.value = `Period: ${formatDate(fromDate)} - ${formatDate(
      toDate,
    )}`;
    periodCell.style = {
      ...titleStyle,
      font: { ...titleStyle.font, size: 11 },
    };
    worksheet.mergeCells(currentRow, 3, currentRow, 6);
    currentRow++;

    currentRow++; // Empty row

    // Header Row
    const headers = [
      "DATE",
      "REF.",
      "DESCRIPTION",
      "DEBIT",
      "CREDIT",
      "BALANCE",
    ];
    headers.forEach((header, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = header;
      cell.style = headerStyle;
    });
    currentRow++;

    // Balance Forward
    const balanceForward =
      ledgerData.balanceForward || ledgerData.openingBalance || 0;
    if (Math.abs(balanceForward) > 0.01) {
      const begBalRow = worksheet.getRow(currentRow);
      begBalRow.getCell(1).value = ledgerData.balanceForwardDate
        ? formatDate(ledgerData.balanceForwardDate)
        : "";
      begBalRow.getCell(2).value = "";
      begBalRow.getCell(3).value = "Balance brought forward";
      begBalRow.getCell(3).style = { ...dataStyle, font: { bold: true } };
      begBalRow.getCell(4).value = "";
      begBalRow.getCell(5).value = "";
      begBalRow.getCell(6).value = balanceForward;
      begBalRow.getCell(6).style = {
        ...numberStyle,
        font: { bold: true },
      };
      begBalRow.getCell(1).style = dataStyle;
      begBalRow.getCell(2).style = dataStyle;
      begBalRow.getCell(4).style = numberStyle;
      begBalRow.getCell(5).style = numberStyle;
      currentRow++;
    }

    // Transactions
    ledgerData.transactions.forEach((transaction) => {
      const transRow = worksheet.getRow(currentRow);
      transRow.getCell(1).value = transaction.date
        ? formatDate(transaction.date)
        : "";
      transRow.getCell(2).value = transaction.ref || "";
      transRow.getCell(3).value = transaction.description || "";
      transRow.getCell(4).value =
        transaction.debit > 0 ? transaction.debit : "";
      transRow.getCell(5).value =
        transaction.credit > 0 ? transaction.credit : "";
      transRow.getCell(6).value = transaction.balance || 0;

      transRow.getCell(1).style = dataStyle;
      transRow.getCell(2).style = dataStyle;
      transRow.getCell(3).style = dataStyle;
      transRow.getCell(4).style = numberStyle;
      transRow.getCell(5).style = numberStyle;
      transRow.getCell(6).style = {
        ...numberStyle,
        font: { bold: true },
      };
      currentRow++;
    });

    // Total Row
    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(1).value = "";
    totalRow.getCell(2).value = "";
    totalRow.getCell(3).value = "Total";
    totalRow.getCell(3).style = { ...dataStyle, font: { bold: true } };
    totalRow.getCell(4).value =
      ledgerData.totals.totalDebit > 0 ? ledgerData.totals.totalDebit : "";
    totalRow.getCell(5).value =
      ledgerData.totals.totalCredit > 0 ? ledgerData.totals.totalCredit : "";
    totalRow.getCell(6).value = ledgerData.finalBalance;

    totalRow.getCell(4).style = { ...numberStyle, font: { bold: true } };
    totalRow.getCell(5).style = { ...numberStyle, font: { bold: true } };
    totalRow.getCell(6).style = {
      ...numberStyle,
      font: { bold: true },
    };
    totalRow.getCell(1).style = dataStyle;
    totalRow.getCell(2).style = dataStyle;
    totalRow.getCell(3).style = dataStyle;

    // Generate filename
    const filename = `Receivable_Ledger_${
      selectedCustomer?.name || "Customer"
    }_${formatDate(fromDate)}_to_${formatDate(toDate)}.xlsx`;

    // Write file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const balanceBroughtForwardAmt = ledgerData
    ? Number(ledgerData.openingBalance ?? ledgerData.balanceForward ?? 0)
    : 0;
  const hasReceivableReportBody =
    Boolean(ledgerData) &&
    ((ledgerData.transactions?.length ?? 0) > 0 ||
      Math.abs(balanceBroughtForwardAmt) > 0.01);

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0px; box-shadow: none; }
          @page {
            margin: 0mm;
            size: A4;
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
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-1">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-100 rounded-lg no-print">
            <div className="flex items-center gap-3 flex-wrap py-2">
              {/* Customer Selection */}
              <div className="w-full md:w-auto">
                <TypeaheadCustom
                  autoFocus
                  options={customers}
                  placeholder="Select customer..."
                  labelKey={(customer) =>
                    `${customer.name} (${customer.customerNo || customer.id})`
                  }
                  onChange={(selectedItems) => {
                    const selected =
                      selectedItems.length > 0 ? selectedItems[0] : null;
                    setSelectedCustomer(selected);
                  }}
                  selected={selectedCustomer ? [selectedCustomer] : []}
                />
              </div>

              <select
                className="px-4 py-2 border border-gray-300 rounded bg-white text-gray-700"
                defaultValue="month"
                onChange={(e) => {
                  const today = new Date();
                  const value = e.target.value;
                  if (value === "month") {
                    const firstDay = new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      1,
                    );
                    setFromDate(firstDay.toISOString().split("T")[0]);
                    setToDate(today.toISOString().split("T")[0]);
                  } else if (value === "year") {
                    const firstDay = new Date(today.getFullYear(), 0, 1);
                    setFromDate(firstDay.toISOString().split("T")[0]);
                    setToDate(today.toISOString().split("T")[0]);
                  } else if (value === "lastMonth") {
                    const lastMonth = new Date(
                      today.getFullYear(),
                      today.getMonth() - 1,
                      1,
                    );
                    const lastDay = new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      0,
                    );
                    setFromDate(lastMonth.toISOString().split("T")[0]);
                    setToDate(lastDay.toISOString().split("T")[0]);
                  }
                }}
              >
                <option value="month">This Month-to-date</option>
                <option value="year">This Year</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom</option>
              </select>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded bg-white"
              />
              <span className="text-gray-600">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded bg-white"
              />
              <button
                className="px-4 py-2 border border-gray-300 rounded bg-white hover:bg-gray-50"
                onClick={handleRunReport}
                disabled={loading || !selectedCustomer}
              >
                {loading ? (
                  <>
                    <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Run report"
                )}
              </button>
              {!loading &&
                !error &&
                ledgerData &&
                hasReceivableReportBody && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                        <Printer className="h-4 w-4" />
                        <Download className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={handlePrint}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleExportToExcel}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        Download Excel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => navigate("/app/reports/accounting-reports")}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 mt-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Report Content */}
          {!loading &&
            !error &&
            ledgerData &&
            hasReceivableReportBody && (
              <div ref={printRef} className="print-content space-y-4 ">
                <BusinessDocumentHeader
                  business={activeBusiness}
                  title="RECEIVABLE LEDGER"
                  numberLabel={`Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`}
                  extraLine={`From: ${formatDate(fromDate)} - ${formatDate(toDate)}`}
                  date={new Date()}
                  dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                  className="mb-0"
                />

                <div className="grid gap-1 ">
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-sm">
                    <h6 className="text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wide">
                      Customer
                    </h6>
                    <div className="text-xs text-gray-700 leading-relaxed">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-wrap">
                          <span className="font-semibold text-gray-600">
                            Name:
                          </span>{" "}
                          <span className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:underline font-medium">
                            {selectedCustomer?.name || "N/A"}
                          </span>{" "}
                          {selectedCustomer?.customerNo && (
                            <>
                              <span className="text-gray-400 mx-1">|</span>
                              <span className="font-semibold text-gray-600">
                                Code:
                              </span>{" "}
                              <span className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:underline font-medium">
                                {selectedCustomer.customerNo}
                              </span>
                            </>
                          )}
                          {selectedCustomer?.address && (
                            <>
                              <span className="text-gray-400 mx-1">|</span>
                              <span className="font-semibold text-gray-600">
                                Address:
                              </span>{" "}
                              <span className="text-gray-900">
                                {selectedCustomer.address}
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
                              parseFloat(ledgerData?.finalBalance || 0) < 0
                                ? "text-red-600"
                                : "text-gray-900"
                            }`}
                          >
                            {formatCurrency(ledgerData?.finalBalance || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 border-blue-200 overflow-hidden rounded-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-gradient-to-r from-slate-700 to-slate-600 border-b-2 border-slate-800">
                        <tr>
                          <th className="text-end px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                            Date
                          </th>
                          <th className="text-center px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                            Ref.
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase border-r border-gray-500">
                            Debit (₦)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase border-r border-gray-500">
                            Credit (₦)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase bg-gray-700">
                            Balance (₦)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Balance Forward Row */}
                        {Math.abs(
                          ledgerData.openingBalance ||
                            ledgerData.balanceForward ||
                            0,
                        ) > 0.01 && (
                          <tr className="bg-amber-50 border-b border-amber-200">
                            <td className="px-2 py-1 text-sm text-gray-600 border-r border-gray-200 text-end">
                              {ledgerData.balanceForwardDate
                                ? formatDate(ledgerData.balanceForwardDate)
                                : ""}
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-600 border-r border-gray-200 text-center">
                              -
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-900 font-medium border-r border-gray-200">
                              {"Balance brought forward".toUpperCase()}
                            </td>
                            <td className="px-2 py-1 text-sm text-right text-amber-700 border-r border-amber-200">
                              -
                            </td>
                            <td className="px-2 py-1 text-sm text-right text-amber-700 border-r border-amber-200">
                              -
                            </td>
                            <td
                              className={`px-2 py-1 text-sm text-right font-bold bg-amber-100 ${
                                (ledgerData.openingBalance ||
                                  ledgerData.balanceForward ||
                                  0) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(
                                ledgerData.balanceForward ||
                                  ledgerData.openingBalance ||
                                  0,
                              )}
                            </td>
                          </tr>
                        )}

                        {/* Transaction Rows */}
                        {ledgerData.transactions.map((transaction, idx) => {
                          const balance = transaction.balance || 0;
                          return (
                            <tr
                              key={idx}
                              className={`border-b border-gray-200 hover:bg-blue-50 ${
                                idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                              }`}
                            >
                              <td className="px-2 py-1 text-sm text-gray-900 border-r border-gray-200 text-end">
                                {formatDate(transaction.date)}
                              </td>
                              {/* <td className="px-2 py-1 text-sm text-gray-600 font-medium border-r border-gray-200">
                                    {transaction.ref?.toUpperCase() || ""}
                                </td> */}
                              <td className="px-2 py-1 text-sm text-gray-600 font-medium border-r border-gray-200 text-center">
                                {transaction.reference_number || ""}
                              </td>
                              <td className="px-2 py-1 text-sm text-gray-900 border-r border-gray-200">
                                {transaction.description?.toUpperCase() || ""}
                              </td>
                              <td className="px-2 py-1 text-sm text-right text-emerald-700 font-semibold border-r border-gray-200">
                                {transaction.debit > 0
                                  ? formatCurrency(transaction.debit)
                                  : "-"}
                              </td>
                              <td className="px-2 py-1 text-sm text-right text-rose-700 font-semibold border-r border-gray-200">
                                {transaction.credit > 0
                                  ? formatCurrency(transaction.credit)
                                  : "-"}
                              </td>
                              <td
                                className={`px-2 py-1 text-sm text-right font-medium bg-gray-50 ${
                                  balance >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatCurrency(balance)}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Total Row */}
                        <tr className="bg-gradient-to-r from-slate-200 to-slate-100 font-semibold border-t-2 border-b-2 border-slate-400">
                          <td
                            colSpan="3"
                            className="px-2 py-1 text-sm text-gray-900 border-r border-gray-300 text-uppercase text-end"
                          >
                            Total
                          </td>
                          <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-300">
                            {ledgerData.totals.totalDebit > 0
                              ? formatCurrency(ledgerData.totals.totalDebit)
                              : 0}
                          </td>
                          <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-300">
                            {ledgerData.totals.totalCredit > 0
                              ? formatCurrency(ledgerData.totals.totalCredit)
                              : 0}
                          </td>
                          <td
                            className={`px-2 py-1 text-sm text-right font-semibold bg-gray-200 ${
                              ledgerData.finalBalance >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(ledgerData.finalBalance)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          {/* Empty State */}
          {!loading &&
            !error &&
            ledgerData &&
            !hasReceivableReportBody && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center mt-4">
                <p className="text-gray-600">
                  No receivable ledger data found for the selected customer and
                  period.
                </p>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default ReceivableLedger;
