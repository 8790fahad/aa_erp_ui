import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, X, Printer, Download } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
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
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const InventriaStatementOfFinancialPosition = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [asOfDate, setAsOfDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [balanceSheetData, setBalanceSheetData] = useState(null);
  const [error, setError] = useState("");
  const printRef = useRef(null);

  // Initialize date - default to today
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (location.state?.asOfDate) {
      setAsOfDate(location.state.asOfDate);
    } else {
      setAsOfDate(todayStr);
    }
  }, [location.state?.asOfDate]);

  const fetchBalanceSheetData = useCallback(async () => {
    if (!facilityId || !asOfDate) {
      setError("Please provide facility ID and date");
      return;
    }

    setLoading(true);
    setError("");

    _postApi(
      `/accounting/balance-sheet`,
      {
        facilityId,
        asOfDate,
      },
      (response) => {
        setLoading(false);
        if (response.success && response.data) {
          setBalanceSheetData(response.data);
        } else {
          setError(response.message || "Failed to fetch balance sheet data");
        }
      },
      (err) => {
        setLoading(false);
        console.error("Balance Sheet Error:", err);
        setError("An error occurred while fetching balance sheet data");
      }
    );
  }, [facilityId, asOfDate]);

  // Fetch data when date changes
  useEffect(() => {
    if (asOfDate && facilityId) {
      fetchBalanceSheetData();
    }
  }, [asOfDate, facilityId, fetchBalanceSheetData]);

  const formatCurrency = (amount) => {
    return formatNumber1(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const handleRunReport = () => {
    fetchBalanceSheetData();
  };

  const handleReactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Statement-of-Financial-Position-${formatDate(asOfDate)}`,
    pageStyle: `
      @page {
        size: A4 portrait;
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
    if (!balanceSheetData) {
      toast.error("No data to export");
      return;
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Statement of Financial Position");

    // Set column widths
    worksheet.columns = [
      { width: 50 }, // Column A - Description
      { width: 12 }, // Column B - Notes
      { width: 18 }, // Column C - 2025 (Current Year)
      { width: 18 }, // Column D - 2024 (Previous Year - placeholder)
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

    const labelStyle = {
      font: { bold: true },
      alignment: { vertical: "middle", horizontal: "left" },
      border: borderStyle,
    };

    const numberStyle = {
      alignment: { vertical: "middle", horizontal: "right" },
      border: borderStyle,
      numFmt: "#,##0.00",
    };

    const boldNumberStyle = {
      font: { bold: true },
      alignment: { vertical: "middle", horizontal: "right" },
      border: borderStyle,
      numFmt: "#,##0.00",
    };

    let currentRow = 1;

    // Business Name
    const businessName = worksheet.getCell(currentRow, 1);
    businessName.value =
      activeBusiness?.business_name || activeBusiness?.name || "Business Name";
    businessName.style = titleStyle;
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    currentRow++;

    // RC Number
    if (activeBusiness?.rc || activeBusiness?.registration_number) {
      const rcCell = worksheet.getCell(currentRow, 1);
      rcCell.value = `RC. ${
        activeBusiness?.rc || activeBusiness?.registration_number
      }`;
      rcCell.style = { ...titleStyle, font: { ...titleStyle.font, size: 11 } };
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      currentRow++;
    }

    // Address
    if (activeBusiness?.business_address || activeBusiness?.address) {
      const addressCell = worksheet.getCell(currentRow, 1);
      addressCell.value =
        activeBusiness?.business_address || activeBusiness?.address;
      addressCell.style = {
        ...titleStyle,
        font: { ...titleStyle.font, size: 10 },
      };
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      currentRow++;
    }

    currentRow++; // Empty row

    // Title
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = "STATEMENT OF FINANCIAL POSITION";
    titleCell.style = { ...titleStyle, font: { bold: true, size: 12 } };
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    currentRow++;

    // As At Date
    const dateCell = worksheet.getCell(currentRow, 1);
    dateCell.value = `AS AT ${formatDate(asOfDate).toUpperCase()}`;
    dateCell.style = {
      ...titleStyle,
      font: { ...titleStyle.font, size: 11 },
    };
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    currentRow++;

    currentRow++; // Empty row

    // Headers
    const headers = ["Description", "Notes", "2025 (N)", "2024 (N)"];
    headers.forEach((header, colIndex) => {
      const cell = worksheet.getCell(currentRow, colIndex + 1);
      cell.value = header;
      cell.style = headerStyle;
    });
    currentRow++;

    // Assets Section
    const assetsCell = worksheet.getCell(currentRow, 1);
    assetsCell.value = "ASSETS";
    assetsCell.style = labelStyle;
    currentRow++;

    // Non-current assets
    const nonCurrentAssetsLabel = worksheet.getCell(currentRow, 1);
    nonCurrentAssetsLabel.value = "Non-current assets";
    nonCurrentAssetsLabel.style = labelStyle;
    currentRow++;

    balanceSheetData.assets.nonCurrent.forEach((asset) => {
      const descCell = worksheet.getCell(currentRow, 1);
      descCell.value = asset.account_name;
      descCell.style = { ...labelStyle, font: { bold: false } };

      const notesCell = worksheet.getCell(currentRow, 2);
      notesCell.value = "";
      notesCell.style = borderStyle;

      const amountCell = worksheet.getCell(currentRow, 3);
      amountCell.value = parseFloat(asset.amount);
      amountCell.style = numberStyle;

      const prevYearCell = worksheet.getCell(currentRow, 4);
      prevYearCell.value = "";
      prevYearCell.style = numberStyle;
      currentRow++;
    });

    // Property, plant and equipment total
    const ppeTotal = worksheet.getCell(currentRow, 1);
    ppeTotal.value = "Property, plant and equipment";
    ppeTotal.style = labelStyle;

    const ppeNotes = worksheet.getCell(currentRow, 2);
    ppeNotes.value = "";
    ppeNotes.style = borderStyle;

    const ppeAmount = worksheet.getCell(currentRow, 3);
    ppeAmount.value = parseFloat(balanceSheetData.assets.nonCurrentTotal);
    ppeAmount.style = boldNumberStyle;

    const ppePrev = worksheet.getCell(currentRow, 4);
    ppePrev.value = "";
    ppePrev.style = boldNumberStyle;
    currentRow++;

    // Current assets
    const currentAssetsLabel = worksheet.getCell(currentRow, 1);
    currentAssetsLabel.value = "Current assets";
    currentAssetsLabel.style = labelStyle;
    currentRow++;

    // Inventories
    const inventories = balanceSheetData.assets.current.filter((a) =>
      a.account_name.toLowerCase().includes("inventor")
    );
    if (inventories.length > 0) {
      const invAmount = inventories.reduce(
        (sum, inv) => sum + parseFloat(inv.amount),
        0
      );
      const invCell = worksheet.getCell(currentRow, 1);
      invCell.value = "Inventories";
      invCell.style = { ...labelStyle, font: { bold: false } };

      const invNotes = worksheet.getCell(currentRow, 2);
      invNotes.value = "";
      invNotes.style = borderStyle;

      const invAmountCell = worksheet.getCell(currentRow, 3);
      invAmountCell.value = invAmount;
      invAmountCell.style = numberStyle;

      const invPrev = worksheet.getCell(currentRow, 4);
      invPrev.value = "";
      invPrev.style = numberStyle;
      currentRow++;
    }

    // Trade and other receivables
    const receivables = balanceSheetData.assets.current.filter(
      (a) =>
        a.account_name.toLowerCase().includes("receivable") ||
        a.account_name.toLowerCase().includes("trade")
    );
    if (receivables.length > 0) {
      const recAmount = receivables.reduce(
        (sum, rec) => sum + parseFloat(rec.amount),
        0
      );
      const recCell = worksheet.getCell(currentRow, 1);
      recCell.value = "Trade and other receivables";
      recCell.style = { ...labelStyle, font: { bold: false } };

      const recNotes = worksheet.getCell(currentRow, 2);
      recNotes.value = "";
      recNotes.style = borderStyle;

      const recAmountCell = worksheet.getCell(currentRow, 3);
      recAmountCell.value = recAmount;
      recAmountCell.style = numberStyle;

      const recPrev = worksheet.getCell(currentRow, 4);
      recPrev.value = "";
      recPrev.style = numberStyle;
      currentRow++;
    }

    // Cash and cash equivalents
    const cash = balanceSheetData.assets.current.filter((a) =>
      a.account_name.toLowerCase().includes("cash")
    );
    if (cash.length > 0) {
      const cashAmount = cash.reduce((sum, c) => sum + parseFloat(c.amount), 0);
      const cashCell = worksheet.getCell(currentRow, 1);
      cashCell.value = "Cash and cash equivalents";
      cashCell.style = { ...labelStyle, font: { bold: false } };

      const cashNotes = worksheet.getCell(currentRow, 2);
      cashNotes.value = "";
      cashNotes.style = borderStyle;

      const cashAmountCell = worksheet.getCell(currentRow, 3);
      cashAmountCell.value = cashAmount;
      cashAmountCell.style = numberStyle;

      const cashPrev = worksheet.getCell(currentRow, 4);
      cashPrev.value = "";
      cashPrev.style = numberStyle;
      currentRow++;
    }

    // Total current assets
    const totalCurrentAssets = worksheet.getCell(currentRow, 1);
    totalCurrentAssets.value = "Total current assets";
    totalCurrentAssets.style = labelStyle;

    const totalCurrentNotes = worksheet.getCell(currentRow, 2);
    totalCurrentNotes.value = "";
    totalCurrentNotes.style = borderStyle;

    const totalCurrentAmount = worksheet.getCell(currentRow, 3);
    totalCurrentAmount.value = parseFloat(balanceSheetData.assets.currentTotal);
    totalCurrentAmount.style = boldNumberStyle;

    const totalCurrentPrev = worksheet.getCell(currentRow, 4);
    totalCurrentPrev.value = "";
    totalCurrentPrev.style = boldNumberStyle;
    currentRow++;

    // Total assets
    const totalAssets = worksheet.getCell(currentRow, 1);
    totalAssets.value = "Total assets";
    totalAssets.style = {
      ...labelStyle,
      font: { bold: true, size: 12 },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };

    const totalAssetsNotes = worksheet.getCell(currentRow, 2);
    totalAssetsNotes.value = "";
    totalAssetsNotes.style = {
      ...borderStyle,
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };

    const totalAssetsAmount = worksheet.getCell(currentRow, 3);
    totalAssetsAmount.value = parseFloat(balanceSheetData.totals.totalAssets);
    totalAssetsAmount.style = {
      ...boldNumberStyle,
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };

    const totalAssetsPrev = worksheet.getCell(currentRow, 4);
    totalAssetsPrev.value = "";
    totalAssetsPrev.style = {
      ...boldNumberStyle,
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };
    currentRow++;
    currentRow++; // Empty row

    // LIABILITIES (equity is a separate section below)
    const liabilitiesLabel = worksheet.getCell(currentRow, 1);
    liabilitiesLabel.value = "LIABILITIES";
    liabilitiesLabel.style = labelStyle;
    currentRow++;

    // Current liabilities
    const currentLiabilitiesLabel = worksheet.getCell(currentRow, 1);
    currentLiabilitiesLabel.value = "Current liabilities";
    currentLiabilitiesLabel.style = labelStyle;
    currentRow++;

    // Payables and accruals
    const payables = balanceSheetData.liabilities.current.filter(
      (l) =>
        l.account_name.toLowerCase().includes("payable") ||
        l.account_name.toLowerCase().includes("accrual")
    );
    if (payables.length > 0) {
      const payAmount = payables.reduce(
        (sum, pay) => sum + parseFloat(pay.amount),
        0
      );
      const payCell = worksheet.getCell(currentRow, 1);
      payCell.value = "Payables and accruals";
      payCell.style = { ...labelStyle, font: { bold: false } };

      const payNotes = worksheet.getCell(currentRow, 2);
      payNotes.value = "";
      payNotes.style = borderStyle;

      const payAmountCell = worksheet.getCell(currentRow, 3);
      payAmountCell.value = payAmount;
      payAmountCell.style = numberStyle;

      const payPrev = worksheet.getCell(currentRow, 4);
      payPrev.value = "";
      payPrev.style = numberStyle;
      currentRow++;
    }

    // Directors' current account
    const directors = balanceSheetData.liabilities.current.filter((l) =>
      l.account_name.toLowerCase().includes("director")
    );
    if (directors.length > 0) {
      const dirAmount = directors.reduce(
        (sum, dir) => sum + parseFloat(dir.amount),
        0
      );
      const dirCell = worksheet.getCell(currentRow, 1);
      dirCell.value = "Directors' current account";
      dirCell.style = { ...labelStyle, font: { bold: false } };

      const dirNotes = worksheet.getCell(currentRow, 2);
      dirNotes.value = "";
      dirNotes.style = borderStyle;

      const dirAmountCell = worksheet.getCell(currentRow, 3);
      dirAmountCell.value = dirAmount;
      dirAmountCell.style = numberStyle;

      const dirPrev = worksheet.getCell(currentRow, 4);
      dirPrev.value = "";
      dirPrev.style = numberStyle;
      currentRow++;
    }

    // Taxation
    const taxation = balanceSheetData.liabilities.current.filter((l) =>
      l.account_name.toLowerCase().includes("tax")
    );
    if (taxation.length > 0) {
      const taxAmount = taxation.reduce(
        (sum, tax) => sum + parseFloat(tax.amount),
        0
      );
      const taxCell = worksheet.getCell(currentRow, 1);
      taxCell.value = "Taxation";
      taxCell.style = { ...labelStyle, font: { bold: false } };

      const taxNotes = worksheet.getCell(currentRow, 2);
      taxNotes.value = "";
      taxNotes.style = borderStyle;

      const taxAmountCell = worksheet.getCell(currentRow, 3);
      taxAmountCell.value = taxAmount;
      taxAmountCell.style = numberStyle;

      const taxPrev = worksheet.getCell(currentRow, 4);
      taxPrev.value = "";
      taxPrev.style = numberStyle;
      currentRow++;
    }

    // Total current liabilities
    const totalCurrentLiabilities = worksheet.getCell(currentRow, 1);
    totalCurrentLiabilities.value = "Total current liabilities";
    totalCurrentLiabilities.style = labelStyle;

    const totalCurrentLiabNotes = worksheet.getCell(currentRow, 2);
    totalCurrentLiabNotes.value = "";
    totalCurrentLiabNotes.style = borderStyle;

    const totalCurrentLiabAmount = worksheet.getCell(currentRow, 3);
    totalCurrentLiabAmount.value = parseFloat(
      balanceSheetData.liabilities.currentTotal
    );
    totalCurrentLiabAmount.style = boldNumberStyle;

    const totalCurrentLiabPrev = worksheet.getCell(currentRow, 4);
    totalCurrentLiabPrev.value = "";
    totalCurrentLiabPrev.style = boldNumberStyle;
    currentRow++;

    // Non-current liabilities
    const nonCurrentLiabilitiesLabel = worksheet.getCell(currentRow, 1);
    nonCurrentLiabilitiesLabel.value = "Non-current liabilities";
    nonCurrentLiabilitiesLabel.style = labelStyle;
    currentRow++;

    // Deferred taxation
    const deferredTax = balanceSheetData.liabilities.nonCurrent.filter((l) =>
      l.account_name.toLowerCase().includes("deferred")
    );
    if (deferredTax.length > 0) {
      const defTaxAmount = deferredTax.reduce(
        (sum, dt) => sum + parseFloat(dt.amount),
        0
      );
      const defTaxCell = worksheet.getCell(currentRow, 1);
      defTaxCell.value = "Deferred taxation";
      defTaxCell.style = { ...labelStyle, font: { bold: false } };

      const defTaxNotes = worksheet.getCell(currentRow, 2);
      defTaxNotes.value = "";
      defTaxNotes.style = borderStyle;

      const defTaxAmountCell = worksheet.getCell(currentRow, 3);
      defTaxAmountCell.value = defTaxAmount;
      defTaxAmountCell.style = numberStyle;

      const defTaxPrev = worksheet.getCell(currentRow, 4);
      defTaxPrev.value = "";
      defTaxPrev.style = numberStyle;
      currentRow++;
    }

    // Total non-current liabilities
    const totalNonCurrentLiabilities = worksheet.getCell(currentRow, 1);
    totalNonCurrentLiabilities.value = "Total non-current liabilities";
    totalNonCurrentLiabilities.style = labelStyle;

    const totalNonCurrentLiabNotes = worksheet.getCell(currentRow, 2);
    totalNonCurrentLiabNotes.value = "";
    totalNonCurrentLiabNotes.style = borderStyle;

    const totalNonCurrentLiabAmount = worksheet.getCell(currentRow, 3);
    totalNonCurrentLiabAmount.value = parseFloat(
      balanceSheetData.liabilities.total
    );
    totalNonCurrentLiabAmount.style = boldNumberStyle;

    const totalNonCurrentLiabPrev = worksheet.getCell(currentRow, 4);
    totalNonCurrentLiabPrev.value = "";
    totalNonCurrentLiabPrev.style = boldNumberStyle;
    currentRow++;

    // Equity
    const equityLabel = worksheet.getCell(currentRow, 1);
    equityLabel.value = "Equity";
    equityLabel.style = labelStyle;
    currentRow++;

    // Share capital
    const shareCapital = balanceSheetData.equity.items.find((e) =>
      e.account_name.toLowerCase().includes("share capital")
    );
    if (shareCapital) {
      const scCell = worksheet.getCell(currentRow, 1);
      scCell.value = "Share capital";
      scCell.style = { ...labelStyle, font: { bold: false } };

      const scNotes = worksheet.getCell(currentRow, 2);
      scNotes.value = "";
      scNotes.style = borderStyle;

      const scAmount = worksheet.getCell(currentRow, 3);
      scAmount.value = parseFloat(shareCapital.amount);
      scAmount.style = numberStyle;

      const scPrev = worksheet.getCell(currentRow, 4);
      scPrev.value = "";
      scPrev.style = numberStyle;
      currentRow++;
    }

    // Share premium
    const sharePremium = balanceSheetData.equity.items.find((e) =>
      e.account_name.toLowerCase().includes("share premium")
    );
    if (sharePremium) {
      const spCell = worksheet.getCell(currentRow, 1);
      spCell.value = "Share premium";
      spCell.style = { ...labelStyle, font: { bold: false } };

      const spNotes = worksheet.getCell(currentRow, 2);
      spNotes.value = "";
      spNotes.style = borderStyle;

      const spAmount = worksheet.getCell(currentRow, 3);
      spAmount.value = parseFloat(sharePremium.amount);
      spAmount.style = numberStyle;

      const spPrev = worksheet.getCell(currentRow, 4);
      spPrev.value = "";
      spPrev.style = numberStyle;
      currentRow++;
    }

    // Retained earnings
    const retainedEarnings = balanceSheetData.equity.items.find((e) =>
      e.account_name.toLowerCase().includes("retained")
    );
    if (retainedEarnings) {
      const reCell = worksheet.getCell(currentRow, 1);
      reCell.value = "Retained earnings";
      reCell.style = { ...labelStyle, font: { bold: false } };

      const reNotes = worksheet.getCell(currentRow, 2);
      reNotes.value = "";
      reNotes.style = borderStyle;

      const reAmount = worksheet.getCell(currentRow, 3);
      reAmount.value = parseFloat(retainedEarnings.amount);
      reAmount.style = numberStyle;

      const rePrev = worksheet.getCell(currentRow, 4);
      rePrev.value = "";
      rePrev.style = numberStyle;
      currentRow++;
    }

    // Revaluation reserve
    const revaluationReserve = balanceSheetData.equity.items.find((e) =>
      e.account_name.toLowerCase().includes("revaluation")
    );
    if (revaluationReserve) {
      const rrCell = worksheet.getCell(currentRow, 1);
      rrCell.value = "Revaluation reserve";
      rrCell.style = { ...labelStyle, font: { bold: false } };

      const rrNotes = worksheet.getCell(currentRow, 2);
      rrNotes.value = "";
      rrNotes.style = borderStyle;

      const rrAmount = worksheet.getCell(currentRow, 3);
      rrAmount.value = parseFloat(revaluationReserve.amount);
      rrAmount.style = numberStyle;

      const rrPrev = worksheet.getCell(currentRow, 4);
      rrPrev.value = "";
      rrPrev.style = numberStyle;
      currentRow++;
    }

    // Total equity
    const totalEquity = worksheet.getCell(currentRow, 1);
    totalEquity.value = "Total equity";
    totalEquity.style = labelStyle;

    const totalEquityNotes = worksheet.getCell(currentRow, 2);
    totalEquityNotes.value = "";
    totalEquityNotes.style = borderStyle;

    const totalEquityAmount = worksheet.getCell(currentRow, 3);
    totalEquityAmount.value = parseFloat(balanceSheetData.equity.total);
    totalEquityAmount.style = boldNumberStyle;

    const totalEquityPrev = worksheet.getCell(currentRow, 4);
    totalEquityPrev.value = "";
    totalEquityPrev.style = boldNumberStyle;
    currentRow++;

    // Total liabilities + equity (balance sheet equation)
    const totalLiabilitiesAndEquity = worksheet.getCell(currentRow, 1);
    totalLiabilitiesAndEquity.value = "Total liabilities + equity";
    totalLiabilitiesAndEquity.style = {
      ...labelStyle,
      font: { bold: true, size: 12 },
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };

    const totalLiabEquityNotes = worksheet.getCell(currentRow, 2);
    totalLiabEquityNotes.value = "";
    totalLiabEquityNotes.style = {
      ...borderStyle,
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };

    const totalLiabEquityAmount = worksheet.getCell(currentRow, 3);
    totalLiabEquityAmount.value = parseFloat(
      balanceSheetData.totals.totalLiabilitiesAndEquity
    );
    totalLiabEquityAmount.style = {
      ...boldNumberStyle,
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };

    const totalLiabEquityPrev = worksheet.getCell(currentRow, 4);
    totalLiabEquityPrev.value = "";
    totalLiabEquityPrev.style = {
      ...boldNumberStyle,
      fill: {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE5E7EB" },
      },
    };

    // Generate filename
    const filename = `Statement_of_Financial_Position_${formatDate(
      asOfDate
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

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0px; box-shadow: none; }
          @page {
            margin: 0mm;
            size: A4 portrait;
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
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-1">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-gray-100 rounded-lg no-print">
            <div className="flex items-center gap-3 flex-wrap py-2">
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
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
              {!loading && !error && balanceSheetData && (
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
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Balance Sheet Content */}
          {!loading && !error && balanceSheetData && (
            <div ref={printRef} className="print-content space-y-4">
              <div className="mb-4">
                <BusinessDocumentHeader
                  business={activeBusiness}
                  title="STATEMENT OF FINANCIAL POSITION"
                  numberLabel={`AS AT ${formatDate(asOfDate).toUpperCase()}`}
                  date={new Date()}
                  dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                  className="mb-0"
                />
              </div>

              <div className="bg-white border-2 border-gray-300 overflow-hidden">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-600 border-b-2 border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                        Description
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase border-r border-gray-500">
                        Notes
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase border-r border-gray-500">
                        2025 (N)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">
                        2024 (N)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ASSETS */}
                    <tr className="bg-gray-50 border-t-2 border-gray-500">
                      <td colSpan="4" className="px-2 py-1 text-sm font-bold">
                        ASSETS
                      </td>
                    </tr>

                    {/* Non-current assets */}
                    <tr className="bg-gray-100">
                      <td
                        colSpan="4"
                        className="px-2 py-1 text-sm font-semibold"
                      >
                        Non-current assets
                      </td>
                    </tr>

                    {balanceSheetData.assets.nonCurrent.map((asset, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                          {asset.account_name}
                        </td>
                        <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200">
                          {/* Notes placeholder */}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                          {formatCurrency(asset.amount)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900">
                          {/* Previous year placeholder */}
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">
                        Property, plant and equipment
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-300"></td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-300">
                        {formatCurrency(
                          balanceSheetData.assets.nonCurrentTotal
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                    </tr>

                    {/* Current assets */}
                    <tr className="bg-gray-100">
                      <td
                        colSpan="4"
                        className="px-2 py-1 text-sm font-semibold"
                      >
                        Current assets
                      </td>
                    </tr>

                    {/* Inventories */}
                    {(() => {
                      const inventories =
                        balanceSheetData.assets.current.filter((a) =>
                          a.account_name.toLowerCase().includes("inventor")
                        );
                      const invAmount = inventories.reduce(
                        (sum, inv) => sum + parseFloat(inv.amount),
                        0
                      );
                      return invAmount > 0 ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Inventories
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(invAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    {/* Trade and other receivables */}
                    {(() => {
                      const receivables =
                        balanceSheetData.assets.current.filter(
                          (a) =>
                            a.account_name
                              .toLowerCase()
                              .includes("receivable") ||
                            a.account_name.toLowerCase().includes("trade")
                        );
                      const recAmount = receivables.reduce(
                        (sum, rec) => sum + parseFloat(rec.amount),
                        0
                      );
                      return recAmount > 0 ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Trade and other receivables
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(recAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    {/* Cash and cash equivalents */}
                    {(() => {
                      const cash = balanceSheetData.assets.current.filter((a) =>
                        a.account_name.toLowerCase().includes("cash")
                      );
                      const cashAmount = cash.reduce(
                        (sum, c) => sum + parseFloat(c.amount),
                        0
                      );
                      return cashAmount > 0 ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Cash and cash equivalents
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(cashAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">
                        Total current assets
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-300"></td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-300">
                        {formatCurrency(balanceSheetData.assets.currentTotal)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                    </tr>

                    <tr className="bg-gray-200 font-bold border-t-2 border-b-2 border-gray-600">
                      <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">
                        Total assets
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-300"></td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-300">
                        {formatCurrency(balanceSheetData.totals.totalAssets)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                    </tr>

                    {/* LIABILITIES */}
                    <tr className="bg-gray-50 border-t-2 border-gray-500">
                      <td colSpan="4" className="px-2 py-1 text-sm font-bold">
                        LIABILITIES
                      </td>
                    </tr>

                    {/* Current liabilities */}
                    <tr className="bg-gray-100">
                      <td
                        colSpan="4"
                        className="px-2 py-1 text-sm font-semibold"
                      >
                        Current liabilities
                      </td>
                    </tr>

                    {/* Payables and accruals */}
                    {(() => {
                      const payables =
                        balanceSheetData.liabilities.current.filter(
                          (l) =>
                            l.account_name.toLowerCase().includes("payable") ||
                            l.account_name.toLowerCase().includes("accrual")
                        );
                      const payAmount = payables.reduce(
                        (sum, pay) => sum + parseFloat(pay.amount),
                        0
                      );
                      return payAmount > 0 ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Payables and accruals
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(payAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    {/* Directors' current account */}
                    {(() => {
                      const directors =
                        balanceSheetData.liabilities.current.filter((l) =>
                          l.account_name.toLowerCase().includes("director")
                        );
                      const dirAmount = directors.reduce(
                        (sum, dir) => sum + parseFloat(dir.amount),
                        0
                      );
                      return dirAmount > 0 ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Directors' current account
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(dirAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    {/* Taxation */}
                    {(() => {
                      const taxation =
                        balanceSheetData.liabilities.current.filter((l) =>
                          l.account_name.toLowerCase().includes("tax")
                        );
                      const taxAmount = taxation.reduce(
                        (sum, tax) => sum + parseFloat(tax.amount),
                        0
                      );
                      return taxAmount > 0 ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Taxation
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(taxAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">
                        Total current liabilities
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-300"></td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-300">
                        {formatCurrency(
                          balanceSheetData.liabilities.currentTotal
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                    </tr>

                    {/* Non-current liabilities */}
                    <tr className="bg-gray-100">
                      <td
                        colSpan="4"
                        className="px-2 py-1 text-sm font-semibold"
                      >
                        Non-current liabilities
                      </td>
                    </tr>

                    {/* Deferred taxation */}
                    {(() => {
                      const deferredTax =
                        balanceSheetData.liabilities.nonCurrent.filter((l) =>
                          l.account_name.toLowerCase().includes("deferred")
                        );
                      const defTaxAmount = deferredTax.reduce(
                        (sum, dt) => sum + parseFloat(dt.amount),
                        0
                      );
                      return defTaxAmount > 0 ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Deferred taxation
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(defTaxAmount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">
                        Total non-current liabilities
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-300"></td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-300">
                        {formatCurrency(balanceSheetData.liabilities.total)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                    </tr>

                    {/* EQUITY */}
                    <tr className="bg-gray-50 border-t border-gray-400">
                      <td
                        colSpan="4"
                        className="px-2 py-1 text-sm font-bold"
                      >
                        EQUITY
                      </td>
                    </tr>

                    {/* Share capital */}
                    {(() => {
                      const shareCapital = balanceSheetData.equity.items.find(
                        (e) =>
                          e.account_name.toLowerCase().includes("share capital")
                      );
                      return shareCapital ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Share capital
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(shareCapital.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    {/* Share premium */}
                    {(() => {
                      const sharePremium = balanceSheetData.equity.items.find(
                        (e) =>
                          e.account_name.toLowerCase().includes("share premium")
                      );
                      return sharePremium ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Share premium
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(sharePremium.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    {/* Retained earnings */}
                    {(() => {
                      const retainedEarnings =
                        balanceSheetData.equity.items.find((e) =>
                          e.account_name.toLowerCase().includes("retained")
                        );
                      return retainedEarnings ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Retained earnings
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(retainedEarnings.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    {/* Revaluation reserve */}
                    {(() => {
                      const revaluationReserve =
                        balanceSheetData.equity.items.find((e) =>
                          e.account_name.toLowerCase().includes("revaluation")
                        );
                      return revaluationReserve ? (
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-200">
                            Revaluation reserve
                          </td>
                          <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-200"></td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-200">
                            {formatCurrency(revaluationReserve.amount)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                        </tr>
                      ) : null;
                    })()}

                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">
                        Total equity
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-300"></td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-300">
                        {formatCurrency(balanceSheetData.equity.total)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                    </tr>

                    <tr className="bg-gray-200 font-bold border-t-2 border-b-2 border-gray-600">
                      <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">
                        Total liabilities + equity
                      </td>
                      <td className="px-4 py-2 text-sm text-center text-gray-600 border-r border-gray-300"></td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900 border-r border-gray-300">
                        {formatCurrency(
                          balanceSheetData.totals.totalLiabilitiesAndEquity
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-900"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer Note */}
              <div className="mt-4 text-xs text-gray-600 text-center no-print">
                <p>
                  The notes on pages 13 to 26 form part of these financial
                  statements and other disclosures on pages 28 and 29 are an
                  integral part of these financial statements.
                </p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !balanceSheetData && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-600">
                Please select a date and run the report to view the Statement of
                Financial Position.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InventriaStatementOfFinancialPosition;
