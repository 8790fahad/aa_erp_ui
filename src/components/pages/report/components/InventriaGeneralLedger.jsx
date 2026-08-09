import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Printer,
  Download,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import moment from "moment";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const InventriaGeneralLedger = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountHierarchy, setAccountHierarchy] = useState([]);
  const [error, setError] = useState("");
  const [templateView, setTemplateView] = useState(true);
  const printRef = useRef(null);

  // Initialize dates - default to current month-to-date
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const firstDayStr = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    ).toISOString().split("T")[0];

    if (location.state?.fromDate && location.state?.toDate) {
      setFromDate(location.state.fromDate);
      setToDate(location.state.toDate);
    } else {
      // 2025-12-01 → 2025-12-26
      setFromDate(firstDayStr);
      setToDate(todayStr);
    }
  }, [location.state?.fromDate, location.state?.toDate]);

  const fetchGeneralLedgerData = useCallback(async () => {
    if (!facilityId || !fromDate || !toDate) {
      setError("Please provide facility ID and date range");
      return;
    }

    setLoading(true);
    setError("");

    _postApi(
      `/account/hierarchical-general-ledger`,
      {
        facilityId,
        fromDate,
        toDate,
      },
      (response) => {
        setLoading(false);
        if (response.success && response.data?.accountHierarchy) {
          setAccountHierarchy(response.data.accountHierarchy);
        } else {
          setError(response.message || "Failed to fetch general ledger data");
        }
      },
      (err) => {
        setLoading(false);
        console.error("General Ledger Error:", err);
        setError("An error occurred while fetching general ledger data");
      }
    );
  }, [facilityId, fromDate, toDate]);

  // Fetch data when dates change
  useEffect(() => {
    if (fromDate && toDate && facilityId) {
      fetchGeneralLedgerData();
    }
  }, [fromDate, toDate, facilityId, fetchGeneralLedgerData]);

  // Auto-expand all head groups when data loads
  useEffect(() => {
    if (accountHierarchy.length > 0) {
      const expanded = {};
      accountHierarchy.forEach((h) => {
        expanded[h.head] = true;
      });
      setExpandedAccounts(expanded);
    }
  }, [accountHierarchy]);
  const toggleAccount = (id) => {
    setExpandedAccounts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

  const calculateAccountTotals = (account) => {
    // Transactions are filtered by date range and sorted by transaction_id ASC in the controller; all statuses included
    const transactions = account.transactions || [];
    const beginningBalance = account.beginningBalance || 0;

    // Calculate totals from period transactions only (exclude opening balance)
    const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredit = transactions.reduce(
      (sum, t) => sum + (t.credit || 0),
      0
    );

    // Get the final balance (from last transaction or beginning balance if no transactions)
    const finalBalance =
      account.finalBalance !== undefined
        ? account.finalBalance
        : transactions.length > 0
        ? transactions[transactions.length - 1].balance
        : beginningBalance;

    return {
      totalDebit,
      totalCredit,
      balance: finalBalance,
      beginningBalance,
      count: transactions.length, // Count only period transactions
      filtered: transactions, // Return period transactions for display
    };
  };

  const calculateHeadTotals = (head) => {
    let totalDebit = 0;
    let totalCredit = 0;
    let balance = 0;
    let count = 0;

    head.accounts.forEach((account) => {
      const totals = calculateAccountTotals(account);
      totalDebit += totals.totalDebit;
      totalCredit += totals.totalCredit;
      balance += totals.balance;
      count += totals.count;
    });

    return { totalDebit, totalCredit, balance, count };
  };

  const calculateGrandTotals = () => {
    let totalDebits = 0;
    let totalCredits = 0;
    let totalTransactions = 0;

    accountHierarchy.forEach((head) => {
      const headTotals = calculateHeadTotals(head);
      totalDebits += headTotals.totalDebit;
      totalCredits += headTotals.totalCredit;
      totalTransactions += headTotals.count;
    });

    return { totalDebits, totalCredits, totalTransactions };
  };

  const handleRunReport = () => {
    fetchGeneralLedgerData();
  };

  const handleReactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `General-Ledger-${formatDate(fromDate)}-to-${formatDate(
      toDate
    )}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 0 !important;
      }
      html, body {
        width: 297mm;
        min-height: 210mm;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .print-content {
        width: 297mm !important;
        min-height: 210mm;
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
    if (!accountHierarchy || accountHierarchy.length === 0) {
      alert("No data to export");
      return;
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("General Ledger");

    // Set column widths
    worksheet.columns = [
      { width: 30 }, // Column A - Account hierarchy
      { width: 12 }, // Column B - Date
      { width: 15 }, // Column C - Num (Ref.)
      { width: 50 }, // Column D - Memo/Description
      { width: 18 }, // Column E - Debit
      { width: 18 }, // Column F - Credit
      { width: 18 }, // Column G - Balance
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
        fgColor: { argb: "FF4B5563" }, // gray-600
      },
      alignment: { vertical: "middle", horizontal: "center" },
      border: borderStyle,
    };

    const headerStyleNoRightBorder = {
      ...headerStyle,
      border: {
        ...borderStyle,
        right: { style: "none" },
      },
    };

    const titleStyle = {
      font: { bold: true, size: 14 },
      alignment: { vertical: "middle", horizontal: "center" },
    };

    const accountNameStyle = {
      font: { bold: true },
      alignment: { vertical: "middle", horizontal: "left" },
      border: borderStyle,
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

    const numberStyleNoRightBorder = {
      ...numberStyle,
      border: {
        ...borderStyle,
        right: { style: "none" },
      },
    };

    const boldStyle = {
      font: { bold: true },
      border: borderStyle,
    };

    let currentRow = 1;

    // Row 1: Business Name
    const businessName = worksheet.getCell(currentRow, 3);
    businessName.value =
      activeBusiness?.business_name || activeBusiness?.name || "Business Name";
    businessName.style = titleStyle;
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    // Row 2: RC Number
    if (activeBusiness?.rc || activeBusiness?.registration_number) {
      const rcCell = worksheet.getCell(currentRow, 3);
      rcCell.value = `RC. ${
        activeBusiness?.rc || activeBusiness?.registration_number
      }`;
      rcCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 11 } };
      worksheet.mergeCells(currentRow, 3, currentRow, 7);
      currentRow++;
    }

    // Row 3: Address
    if (activeBusiness?.business_address || activeBusiness?.address) {
      const addressCell = worksheet.getCell(currentRow, 3);
      addressCell.value =
        activeBusiness?.business_address || activeBusiness?.address;
      addressCell.style = {
        ...titleStyle,
        font: { ...titleStyle.font, size: 10 },
      };
      worksheet.mergeCells(currentRow, 3, currentRow, 7);
      currentRow++;
    }

    // Row 4: Contact Info
    const contactInfo = [];
    if (activeBusiness?.business_phone || activeBusiness?.phone) {
      contactInfo.push(
        `Tel: ${activeBusiness?.business_phone || activeBusiness?.phone}`
      );
    }
    if (activeBusiness?.business_email || activeBusiness?.email) {
      contactInfo.push(
        `Email: ${activeBusiness?.business_email || activeBusiness?.email}`
      );
    }
    if (contactInfo.length > 0) {
      const contactCell = worksheet.getCell(currentRow, 3);
      contactCell.value = contactInfo.join(" | ");
      contactCell.style = {
        ...titleStyle,
        font: { ...titleStyle.font, size: 10 },
      };
      worksheet.mergeCells(currentRow, 3, currentRow, 7);
      currentRow++;
    }

    currentRow++; // Empty row

    // Row: GENERAL LEDGER
    const titleCell = worksheet.getCell(currentRow, 3);
    titleCell.value = "GENERAL LEDGER";
    titleCell.style = { ...titleStyle, font: { bold: true, size: 12 } };
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    // Row: Period
    const periodCell = worksheet.getCell(currentRow, 3);
    periodCell.value = `Period: ${formatDate(fromDate)} - ${formatDate(
      toDate
    )}`;
    periodCell.style = {
      ...titleStyle,
      font: { ...titleStyle.font, size: 11 },
    };
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    // Row: Generated Date
    const dateCell = worksheet.getCell(currentRow, 3);
    dateCell.value = `Date: ${moment().format(
      "dddd, DD MMMM YYYY hh:mm A [GMT]Z"
    )}`;
    dateCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 10 } };
    worksheet.mergeCells(currentRow, 3, currentRow, 7);
    currentRow++;

    currentRow++; // Empty row

    // Header Row - track this row number
    const headerRowIndex = currentRow;
    const headers = [
      "",
      "DATE",
      "REF.",
      "MEMO/DESCRIPTION",
      "DEBIT",
      "CREDIT",
      "BALANCE",
    ];
    headers.forEach((header, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = header;
      if (colIndex > 0) {
        // Skip Column A
        if (colIndex === 6) {
          // Balance column - no right border, slightly different background
          cell.style = headerStyleNoRightBorder;
          cell.style.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF6B7280" }, // gray-500
          };
        } else {
          cell.style = headerStyle;
        }
        // All headers are centered (already set in headerStyle)
      }
    });
    currentRow++;

    // Process each group
    accountHierarchy
      .filter((group) => {
        const hasValidName = group.name && !group.name.startsWith("Group ");
        return hasValidName && group.accounts.length > 0;
      })
      .forEach((group) => {
        const activeAccounts = group.accounts.filter((account) => {
          const accountTotals = calculateAccountTotals(account);
          return (
            accountTotals.count > 0 ||
            Math.abs(accountTotals.balance) > 0.01 ||
            Math.abs(accountTotals.beginningBalance || 0) > 0.01
          );
        });

        if (activeAccounts.length === 0) return;

        // Group header in Column A
        const groupCell = worksheet.getCell(currentRow, 1);
        groupCell.value = `${group.code} ${group.name}`;
        groupCell.style = accountNameStyle;
        currentRow++;

        // Process each account
        activeAccounts.forEach((account) => {
          const accountTotals = calculateAccountTotals(account);
          const transactions = accountTotals.filtered || [];

          // Account name in Column A
          const accountCell = worksheet.getCell(currentRow, 1);
          accountCell.value = `${account.name} - Account #: ${account.code}`;
          accountCell.style = accountNameStyle;
          currentRow++;

          // Beginning Balance row - always include (including when 0)
          const begBalRow = worksheet.getRow(currentRow);
          begBalRow.getCell(2).value = ""; // Date
          begBalRow.getCell(3).value = ""; // Num
          begBalRow.getCell(4).value = "Beginning Balance";
          begBalRow.getCell(4).style = { ...boldStyle, ...dataStyle };
          begBalRow.getCell(5).value = ""; // Debit
          begBalRow.getCell(6).value = ""; // Credit
          begBalRow.getCell(7).value = accountTotals.beginningBalance || 0;
          begBalRow.getCell(7).style = {
            ...numberStyleNoRightBorder,
            font: { bold: true },
          };
          begBalRow.getCell(2).style = dataStyle;
          begBalRow.getCell(3).style = dataStyle;
          begBalRow.getCell(5).style = numberStyle;
          begBalRow.getCell(6).style = numberStyle;
          currentRow++;

          // Transactions
          transactions.forEach((transaction) => {
            const transRow = worksheet.getRow(currentRow);
            transRow.getCell(1).value = ""; // Column A
            transRow.getCell(2).value = transaction.date
              ? formatDate(transaction.date)
              : "";
            transRow.getCell(3).value = transaction.ref || "";
            transRow.getCell(4).value = transaction.description || "";
            transRow.getCell(5).value =
              transaction.debit > 0 ? transaction.debit : "";
            transRow.getCell(6).value =
              transaction.credit > 0 ? transaction.credit : "";
            transRow.getCell(7).value = transaction.balance || 0;

            transRow.getCell(1).style = dataStyle;
            transRow.getCell(2).style = dataStyle;
            transRow.getCell(3).style = dataStyle;
            transRow.getCell(4).style = dataStyle;
            transRow.getCell(5).style = numberStyle;
            transRow.getCell(6).style = numberStyle;
            transRow.getCell(7).style = {
              ...numberStyleNoRightBorder,
              font: { bold: true },
            };
            currentRow++;
          });

          // Account Total
          if (
            transactions.length > 0 ||
            Math.abs(accountTotals.beginningBalance || 0) > 0.01
          ) {
            const accountTotalRow = worksheet.getRow(currentRow);
            accountTotalRow.getCell(1).value = ""; // Column A
            accountTotalRow.getCell(2).value = ""; // Date
            accountTotalRow.getCell(3).value = ""; // Num
            accountTotalRow.getCell(
              4
            ).value = `Total for ${account.code} - ${account.name}`;
            accountTotalRow.getCell(5).value =
              accountTotals.totalDebit > 0 ? accountTotals.totalDebit : "";
            accountTotalRow.getCell(6).value =
              accountTotals.totalCredit > 0 ? accountTotals.totalCredit : "";
            accountTotalRow.getCell(7).value = accountTotals.balance;

            accountTotalRow.getCell(4).style = { ...boldStyle, ...dataStyle };
            accountTotalRow.getCell(5).style = { ...boldStyle, ...numberStyle };
            accountTotalRow.getCell(6).style = { ...boldStyle, ...numberStyle };
            accountTotalRow.getCell(7).style = {
              ...boldStyle,
              ...numberStyleNoRightBorder,
            };
            accountTotalRow.getCell(1).style = dataStyle;
            accountTotalRow.getCell(2).style = dataStyle;
            accountTotalRow.getCell(3).style = dataStyle;
            currentRow++;
          }
        });

        // Group Total
        if (group.totals) {
          const groupTotalRow = worksheet.getRow(currentRow);
          groupTotalRow.getCell(1).value = ""; // Column A
          groupTotalRow.getCell(2).value = ""; // Date
          groupTotalRow.getCell(3).value = ""; // Num
          groupTotalRow.getCell(
            4
          ).value = `Total for ${group.name} (${group.code})`;
          groupTotalRow.getCell(5).value =
            group.totals.totalDebit > 0 ? group.totals.totalDebit : "";
          groupTotalRow.getCell(6).value =
            group.totals.totalCredit > 0 ? group.totals.totalCredit : "";
          groupTotalRow.getCell(7).value = group.totals.totalBalance;

          groupTotalRow.getCell(4).style = { ...boldStyle, ...dataStyle };
          groupTotalRow.getCell(5).style = { ...boldStyle, ...numberStyle };
          groupTotalRow.getCell(6).style = { ...boldStyle, ...numberStyle };
          groupTotalRow.getCell(7).style = {
            ...boldStyle,
            ...numberStyleNoRightBorder,
          };
          groupTotalRow.getCell(1).style = dataStyle;
          groupTotalRow.getCell(2).style = dataStyle;
          groupTotalRow.getCell(3).style = dataStyle;
          currentRow++;
        }
      });

    // Remove right border from all Balance column cells (column 7) throughout the sheet
    // Start from header row + 1 (data rows)
    for (let row = headerRowIndex + 1; row < currentRow; row++) {
      const cell = worksheet.getCell(row, 7); // Column G (Balance)
      if (
        cell &&
        cell.value !== undefined &&
        cell.value !== null &&
        cell.value !== ""
      ) {
        if (cell.style) {
          if (!cell.style.border) {
            cell.style.border = { ...borderStyle };
          }
          cell.style.border.right = { style: "none" };
        } else {
          // Create style if it doesn't exist
          cell.style = { ...numberStyleNoRightBorder };
        }
      }
    }

    // Remove bottom border from last row (all columns)
    if (currentRow > headerRowIndex + 1) {
      const lastRow = worksheet.getRow(currentRow - 1);
      for (let col = 1; col <= 7; col++) {
        const cell = lastRow.getCell(col);
        if (cell) {
          if (cell.style) {
            if (!cell.style.border) {
              cell.style.border = { ...borderStyle };
            }
            cell.style.border.bottom = { style: "none" };
            // Also ensure Balance column has no right border
            if (col === 7) {
              cell.style.border.right = { style: "none" };
            }
          } else {
            // Create style if it doesn't exist
            const baseStyle =
              col === 7
                ? numberStyleNoRightBorder
                : col >= 4 && col <= 6
                ? numberStyle
                : dataStyle;
            cell.style = { ...baseStyle };
            cell.style.border.bottom = { style: "none" };
            if (col === 7) {
              cell.style.border.right = { style: "none" };
            }
          }
        }
      }
    }

    // Generate filename
    const filename = `General_Ledger_${formatDate(fromDate)}_to_${formatDate(
      toDate
    )}.xlsx`;

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

  const grandTotals = calculateGrandTotals();

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0px; box-shadow: none; }
          @page {
            margin: 0mm;
            size: A4 landscape;
          }
          html, body {
            width: 297mm;
            min-height: 210mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print-content {
            width: 297mm !important;
            min-height: 210mm;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #fff !important;
            position: relative;
          }
          .print-content table {
            border-collapse: collapse;
            width: 100%;
            font-size: 10pt;
          }
          .print-content th,
          .print-content td {
            border: 1px solid #000;
            padding: 4px;
          }
          .print-content .bg-gray-50,
          .print-content .bg-gray-100,
          .print-content .bg-gray-200 {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-1">
        {/* Header */}
        {/* Header */}
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-100 rounded-lg no-print">
            <div className="flex items-center gap-3 flex-wrap py-2">
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
                      1
                    );
                    setFromDate(firstDay.toISOString().split("T")[0]);
                    setToDate(today.toISOString().split("T")[0]);
                  } else if (value === "year") {
                    const firstDay = new Date(today.getFullYear(), 0, 1);
                    const lastDay = new Date(today.getFullYear(), 11, 31);
                    setFromDate(firstDay.toISOString().split("T")[0]);
                    setToDate(lastDay.toISOString().split("T")[0]);
                  } else if (value === "lastMonth") {
                    const lastMonth = new Date(
                      today.getFullYear(),
                      today.getMonth() - 1,
                      1
                    );
                    const lastDay = new Date(
                      today.getFullYear(),
                      today.getMonth(),
                      0
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
                disabled={loading}
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
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded ml-auto">
                <Label
                  htmlFor="template-view"
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Template View
                </Label>
                <Switch
                  id="template-view"
                  checked={templateView}
                  onCheckedChange={setTemplateView}
                />
              </div>
              {!loading &&
                !error &&
                accountHierarchy.length > 0 &&
                templateView && (
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
      
          {/* Business Header */}
          {loading && (
            <>
              {/* Loading State with Skeleton Frame */}
              <div className="space-y-4">
                {/* Skeleton for Head Groups */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg shadow-sm overflow-hidden"
                  >
                    {/* Head Header Skeleton */}
                    <div className="flex items-center justify-between p-4 border-b bg-blue-50">
                      <div className="flex items-center gap-4 flex-1">
                        <Skeleton className="h-5 w-5 rounded" />
                        <div className="flex-1">
                          <Skeleton className="h-6 w-48 mb-2" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-6 w-24 mb-2" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>

                    {/* Account Skeletons */}
                    <div className="divide-y divide-gray-200">
                      {[1, 2].map((j) => (
                        <div key={j}>
                          {/* Account Header Skeleton */}
                          <div className="flex items-center justify-between p-4 pl-12">
                            <div className="flex items-center gap-4 flex-1">
                              <Skeleton className="h-4 w-4 rounded" />
                              <div className="flex-1">
                                <Skeleton className="h-5 w-56 mb-2" />
                                <Skeleton className="h-4 w-28" />
                              </div>
                            </div>
                            <div className="text-right">
                              <Skeleton className="h-5 w-20" />
                            </div>
                          </div>

                          {/* Transaction Table Skeleton */}
                          <div className="pl-16 pr-4 pb-4">
                            <div className="overflow-x-auto">
                              <div className="space-y-2">
                                {/* Table Header Skeleton */}
                                <div className="grid grid-cols-7 gap-4 pb-2 border-b">
                                  <Skeleton className="h-4 w-16" />
                                  <Skeleton className="h-4 w-16" />
                                  <Skeleton className="h-4 w-12" />
                                  <Skeleton className="h-4 w-24" />
                                  <Skeleton className="h-4 w-16 ml-auto" />
                                  <Skeleton className="h-4 w-16 ml-auto" />
                                  <Skeleton className="h-4 w-16 ml-auto" />
                                </div>
                                {/* Table Rows Skeleton */}
                                {[1, 2, 3].map((k) => (
                                  <div
                                    key={k}
                                    className="grid grid-cols-7 gap-4 py-2 border-b"
                                  >
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-16 ml-auto" />
                                    <Skeleton className="h-4 w-16 ml-auto" />
                                    <Skeleton className="h-4 w-16 ml-auto" />
                                  </div>
                                ))}
                                {/* Total Row Skeleton */}
                                <div className="grid grid-cols-7 gap-4 py-2 bg-gray-100 mt-2">
                                  <Skeleton className="h-4 w-32 col-span-4" />
                                  <Skeleton className="h-4 w-16 ml-auto" />
                                  <Skeleton className="h-4 w-16 ml-auto" />
                                  <Skeleton className="h-4 w-16 ml-auto" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Summary Footer Skeleton */}
                <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                  <Skeleton className="h-6 w-40 mb-4" />
                  <Skeleton className="h-4 w-64 mb-4" />
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-8 w-32" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          {/* Template View */}
          {!loading &&
            !error &&
            accountHierarchy.length > 0 &&
            templateView && (
              <div ref={printRef} className="print-content space-y-4">
                <div className="mb-">
                  <BusinessDocumentHeader
                    business={activeBusiness}
                    title="GENERAL LEDGER"
                    numberLabel={`Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`}
                    date={new Date()}
                    dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                    className="mb-0"
                  />
                </div>
                {/* {JSON.stringify(accountHierarchy)} */}
                <div className="bg-white  border-2 border-gray-300 overflow-hidden ">
                  {/* Single Table for All Groups and Accounts */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      {/* Single Header Row */}

                      <thead className="bg-gray-600 border-b-2 border-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                            Ref.
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                            Memo/Description
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase border-r border-gray-500">
                            Debit
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase border-r border-gray-500">
                            Credit
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase bg-gray-700">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountHierarchy
                          .filter((group) => {
                            const hasValidName =
                              group.name && !group.name.startsWith("Group ");
                            return hasValidName && group.accounts.length > 0;
                          })
                          .map((group) => {
                            // Filter accounts with activity
                            const activeAccounts = group.accounts.filter(
                              (account) => {
                                const accountTotals =
                                  calculateAccountTotals(account);
                                return (
                                  accountTotals.count > 0 ||
                                  Math.abs(accountTotals.balance) > 0.01 ||
                                  Math.abs(
                                    accountTotals.beginningBalance || 0
                                  ) > 0.01
                                );
                              }
                            );

                            if (activeAccounts.length === 0) return null;

                            return (
                              <React.Fragment key={group.code}>
                                {/* Group Header Row */}
                                <tr className="bg-gray-50 border-t-2 border-gray-500">
                                  <td
                                    colSpan="6"
                                    className="px-1 py-0.5 text-sm font-semibold text-gray-900"
                                  >
                                    {group.name} ({group.code})
                                  </td>
                                </tr>

                                {activeAccounts.map((account) => {
                                  const accountTotals =
                                    calculateAccountTotals(account);
                                  const transactions =
                                    accountTotals.filtered || [];

                                  return (
                                    <React.Fragment key={account.code}>
                                      {/* Account Header Row */}
                                      <tr className="bg-gray-100 border-t border-b border-gray-300">
                                        <td
                                          colSpan="6"
                                          className="px-2 py-1 text-sm font-semibold text-gray-900"
                                        >
                                          {account.name} - Account #:{" "}
                                          {account.code}
                                        </td>
                                      </tr>

                                      {/* Beginning Balance Row - always show (including when 0) */}
                                      <tr className="bg-white border-b border-gray-200 hover:bg-gray-50">
                                        <td className="px-2 py-1 text-sm text-gray-600 border-r border-gray-200">
                                          {/* Blank */}
                                        </td>
                                        <td className="px-2 py-1 text-sm text-gray-600 border-r border-gray-200">
                                          {/* Blank */}
                                        </td>
                                        <td className="px-2 py-1 text-sm text-gray-900 font-medium border-r border-gray-200">
                                          Beginning Balance
                                        </td>
                                        <td className="px-2 py-1 text-sm text-right text-gray-600 border-r border-gray-200">
                                          {/* Blank */}
                                        </td>
                                        <td className="px-2 py-1 text-sm text-right text-gray-600 border-r border-gray-200">
                                          {/* Blank */}
                                        </td>
                                        <td
                                          className={`px-2 py-1 text-sm text-right font-medium bg-gray-50 ${
                                            (accountTotals.beginningBalance || 0) >= 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }`}
                                        >
                                          {formatCurrency(
                                            accountTotals.beginningBalance || 0
                                          )}
                                        </td>
                                      </tr>

                                      {/* Transaction Rows */}
                                      {transactions.map((transaction, idx) => {
                                        const balance =
                                          transaction.balance || 0;
                                        return (
                                          <tr
                                            key={idx}
                                            className="bg-white border-b border-gray-200 hover:bg-gray-50"
                                          >
                                            <td className="px-2 py-1 text-sm text-gray-900 border-r border-gray-200">
                                              {formatDate(transaction.date)}
                                            </td>
                                            <td className="px-2 py-1 text-sm text-gray-600 font-medium border-r border-gray-200">
                                              {transaction.ref || ""}
                                            </td>
                                            <td className="px-2 py-1 text-sm text-gray-900 border-r border-gray-200">
                                              {transaction.description || ""}
                                            </td>
                                            <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-200">
                                              {transaction.debit > 0
                                                ? formatCurrency(
                                                    transaction.debit
                                                  )
                                                : ""}
                                            </td>
                                            <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-200">
                                              {transaction.credit > 0
                                                ? formatCurrency(
                                                    transaction.credit
                                                  )
                                                : ""}
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

                                      {/* Account Total Row */}
                                      {(transactions.length > 0 ||
                                        Math.abs(
                                          accountTotals.beginningBalance || 0
                                        ) > 0.01) && (
                                        <tr className="bg-gray-100 font-semibold border-t- border-b border-gray-400">
                                          <td
                                            colSpan="3"
                                            className="px-2 py-1 text-sm text-gray-900 border-r border-gray-300"
                                          >
                                            Total for {account.code} -{" "}
                                            {account.name}
                                          </td>
                                          <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-300">
                                            {accountTotals.totalDebit > 0
                                              ? formatCurrency(
                                                  accountTotals.totalDebit
                                                )
                                              : ""}
                                          </td>
                                          <td className="px-2 py-1 text-sm text-right text-gray-900 border-r border-gray-300">
                                            {accountTotals.totalCredit > 0
                                              ? formatCurrency(
                                                  accountTotals.totalCredit
                                                )
                                              : ""}
                                          </td>
                                          <td
                                            className={`px-2 py-1 text-sm text-right font-semibold bg-gray-200 ${
                                              accountTotals.balance >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            }`}
                                          >
                                            {formatCurrency(
                                              accountTotals.balance
                                            )}
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}

                                {/* Group Total Row */}
                                {group.totals && (
                                  <tr className="bg-gray-200 font-semibold border-t-1 border-b-1 border-gray-600">
                                    <td
                                      colSpan="3"
                                      className="px-1 py-0.5 text-sm text-gray-900 border-r border-gray-400"
                                    >
                                      Total for {group.name} ({group.code})
                                    </td>
                                    <td className="px-1 py-0.5 text-sm text-right text-gray-900 border-r border-gray-400">
                                      {group.totals.totalDebit > 0
                                        ? formatCurrency(
                                            group.totals.totalDebit
                                          )
                                        : ""}
                                    </td>
                                    <td className="px-1 py-0.5 text-right  text-sm text- text-gray-900 border-r border-gray-400">
                                      {group.totals.totalCredit > 0
                                        ? formatCurrency(
                                            group.totals.totalCredit
                                          )
                                        : ""}{" "}
                                    </td>
                                    <td
                                      className={`px-1 py-0.5 text-sm text-right font-semibold bg-gray-200 ${
                                        group.totals.totalBalance >= 0
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {formatCurrency(
                                        group.totals.totalBalance
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Template Footer Summary */}
                  <div className="bg-white rounded-lg shadow-sm p-6 mt-2 no-print">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      Report Summary
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Period: {formatDate(fromDate)} to {formatDate(toDate)}
                    </p>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Total Debits
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(grandTotals.totalDebits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Total Credits
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(grandTotals.totalCredits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">
                          Total Transactions
                        </p>
                        <p className="text-2xl font-bold text-gray-900">
                          {grandTotals.totalTransactions}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Accounts by Head - Original View */}
          {!loading &&
            !error &&
            accountHierarchy.length > 0 &&
            !templateView && (
              <div className="space-y-4">
                <div className="mb-1">
                  <BusinessDocumentHeader
                    business={activeBusiness}
                    title="General Ledger Report"
                    numberLabel={`Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`}
                    date={new Date()}
                    dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                    className="mb-0"
                  />
                </div>
                {accountHierarchy
                  .filter((head) => {
                    // Filter out head groups with no accounts or only zero-balance accounts
                    // Also filter out groups with generic names like "Group 101"
                    const headTotals = calculateHeadTotals(head);
                    const hasValidName =
                      head.name && !head.name.startsWith("Group ");
                    return (
                      hasValidName &&
                      head.accounts.length > 0 &&
                      (Math.abs(headTotals.balance) > 0.01 ||
                        headTotals.count > 0)
                    );
                  })
                  .map((head) => {
                    const headTotals = calculateHeadTotals(head);
                    const isHeadExpanded = expandedAccounts[head.head];

                    return (
                      <div
                        key={head.head}
                        className="bg-white  overflow-hidden"
                      >
                        {/* Head Header */}
                        <div
                          className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 border-b bg-gray-100"
                          onClick={() => toggleAccount(head.head)}
                        >
                          <div className="flex items-center gap-4">
                            {isHeadExpanded ? (
                              <ChevronUp size={20} />
                            ) : (
                              <ChevronDown size={20} />
                            )}
                            <div>
                              <h2 className="font-bold text-lg text-gray-900">
                                {head.head} - {head.name}
                              </h2>
                              <p className="text-sm text-gray-600">
                                {head.accounts.length} accounts
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-900">
                              {formatCurrency(headTotals.balance)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {/* {JSON.stringify(headTotals)} */}
                              {headTotals.count} transactions
                            </p>
                          </div>
                        </div>

                        {/* Accounts under this head */}
                        {isHeadExpanded && (
                          <div className="divide-y divide-gray-200">
                            {head.accounts
                              .filter((account) => {
                                const accountTotals =
                                  calculateAccountTotals(account);
                                // Filter out accounts with zero balance and no transactions
                                return (
                                  accountTotals.count > 0 ||
                                  Math.abs(accountTotals.balance) > 0.01
                                );
                              })
                              .map((account) => {
                                const accountTotals =
                                  calculateAccountTotals(account);
                                const isAccountExpanded =
                                  expandedAccounts[account.code];

                                return (
                                  <div key={account.code}>
                                    {/* Account Header */}
                                    <div
                                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 pl-12"
                                      onClick={() =>
                                        toggleAccount(account.code)
                                      }
                                    >
                                      <div className="flex items-center gap-4">
                                        {isAccountExpanded ? (
                                          <ChevronUp size={18} />
                                        ) : (
                                          <ChevronDown size={18} />
                                        )}
                                        <div>
                                          <h3 className="font-semibold text-gray-900">
                                            {account.code} - {account.name}
                                          </h3>
                                          <p className="text-sm text-gray-600">
                                            {accountTotals.count} transactions
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-semibold text-gray-900">
                                          {formatCurrency(
                                            accountTotals.balance
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Transaction Details */}
                                    {isAccountExpanded &&
                                      (accountTotals.filtered.length > 0 ||
                                        Math.abs(
                                          accountTotals.beginningBalance || 0
                                        ) > 0.01) && (
                                        <div className="overflow-x-auto pl-16 pr-4 pb-4">
                                          <table className="w-full">
                                            <thead className="bg-gray-50">
                                              <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Date
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Num
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                  Memo/Description
                                                </th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Debit
                                                </th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Credit
                                                </th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                                  Balance
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                              {/* Beginning Balance Row - always show (including when 0) */}
                                              <tr className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-sm text-gray-900">
                                                  {/* Blank */}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-600">
                                                  {/* Blank */}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900 font-semibold">
                                                  Beginning Balance
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                                  {/* Blank */}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                                  {/* Blank */}
                                                </td>
                                                <td
                                                  className={`px-4 py-2 text-sm text-right font-medium ${
                                                    (accountTotals.beginningBalance || 0) >= 0
                                                      ? "text-green-600"
                                                      : "text-red-600"
                                                  }`}
                                                >
                                                  {formatCurrency(
                                                    accountTotals.beginningBalance || 0
                                                  )}
                                                </td>
                                              </tr>
                                              {/* Transaction Rows */}
                                              {accountTotals.filtered.map(
                                                (transaction, idx) => (
                                                  <tr
                                                    key={idx}
                                                    className="hover:bg-gray-50"
                                                  >
                                                    <td className="px-4 py-2 text-sm text-gray-900">
                                                      {formatDate(
                                                        transaction.date
                                                      )}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">
                                                      {transaction.ref || "-"}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">
                                                      {transaction.description ||
                                                        "-"}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-right text-gray-900">
                                                      {transaction.debit > 0
                                                        ? formatCurrency(
                                                            transaction.debit
                                                          )
                                                        : ""}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-right text-gray-900">
                                                      {transaction.credit > 0
                                                        ? formatCurrency(
                                                            transaction.credit
                                                          )
                                                        : ""}
                                                    </td>
                                                    <td
                                                      className={`px-4 py-2 text-sm text-right font-medium ${
                                                        transaction.balance >= 0
                                                          ? "text-green-600"
                                                          : "text-red-600"
                                                      }`}
                                                    >
                                                      {formatCurrency(
                                                        transaction.balance
                                                      )}
                                                    </td>
                                                  </tr>
                                                )
                                              )}
                                              <tr className="bg-gray-100 font-semibold">
                                                <td
                                                  colSpan="3"
                                                  className="px-4 py-2 text-sm text-gray-900"
                                                >
                                                  Total for {account.code} -{" "}
                                                  {account.name}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                                  {formatCurrency(
                                                    accountTotals.totalDebit
                                                  )}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right text-gray-900">
                                                  {formatCurrency(
                                                    accountTotals.totalCredit
                                                  )}
                                                </td>
                                                <td
                                                  className={`px-4 py-2 text-sm text-right ${
                                                    accountTotals.balance >= 0
                                                      ? "text-green-600"
                                                      : "text-red-600"
                                                  }`}
                                                >
                                                  {formatCurrency(
                                                    accountTotals.balance
                                                  )}
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          {/* Summary Footer - Original View Only */}
          {!loading &&
            !error &&
            accountHierarchy.length > 0 &&
            !templateView && (
              <div className="bg-white rounded-lg shadow-sm p-6 mt-2">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Report Summary
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Period: {formatDate(fromDate)} to {formatDate(toDate)}
                </p>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Total Debits</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(grandTotals.totalDebits)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Total Credits</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(grandTotals.totalCredits)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Total Transactions
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {grandTotals.totalTransactions}
                    </p>
                  </div>
                </div>
              </div>
            )}
          {/* Empty State - show for both template and non-template view */}
          {!loading &&
            !error &&
            accountHierarchy.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-600">
                  No general ledger data found for the selected period.
                </p>
              </div>
            )}
        </div>
      </div>
    </>
  );
};

export default InventriaGeneralLedger;
