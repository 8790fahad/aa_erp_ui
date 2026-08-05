import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  X,
  Printer,
  Download,
  Landmark,
  MoreVertical,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import { useReactToPrint } from "react-to-print";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const bankTxnNet = (txn) => {
  const credit = Number(txn.credit || 0);
  const debit = Number(txn.debit || 0);
  if (credit > 0 || debit > 0) return credit - debit;
  const amt = Math.abs(Number(txn.amount || 0));
  return String(txn.transaction_type || "").toLowerCase() === "credit" ? amt : -amt;
};

const glTxnNet = (txn) => Number(txn.cr || 0) - Number(txn.dr || 0);

const formatEntryAmount = (txn, { isGl = false } = {}) => {
  const net = isGl ? glTxnNet(txn) : bankTxnNet(txn);
  const amount = Math.abs(net);
  const side = net >= 0 ? "cr" : "dr";
  return { amount, side, net };
};

const sumEntryNet = (entries, { isGl = false } = {}) =>
  (entries || []).reduce((sum, t) => sum + (isGl ? glTxnNet(t) : bankTxnNet(t)), 0);

const BankReconciliationReport = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const bankId = searchParams.get("bankId");
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [selectedBankId, setSelectedBankId] = useState(bankId || "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [localFromDate, setLocalFromDate] = useState("");
  const [localToDate, setLocalToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState("");
  const printRef = useRef(null);

  // Set default date range to current month on mount
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const firstDayStr = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    setFromDate(firstDayStr);
    setToDate(todayStr);
    setLocalFromDate(firstDayStr);
    setLocalToDate(todayStr);
  }, []);

  // Fetch bank accounts list
  useEffect(() => {
    if (!facilityId) return;
    _fetchApi(`/api/get/bank-accounts?facilityId=${facilityId}`, (res) => {
      if (res.success) {
        const list = Array.isArray(res.results) ? res.results : [];
        setBanks(list);
        if (!list.length) return;
        const fromUrl = bankId ? String(bankId) : "";
        if (fromUrl && list.some((b) => String(b.id) === fromUrl)) {
          setSelectedBankId(fromUrl);
        } else {
          setSelectedBankId((prev) =>
            prev && list.some((b) => String(b.id) === prev)
              ? prev
              : String(list[0].id)
          );
        }
      }
    });
  }, [facilityId, bankId]);

  const fetchReportData = useCallback(async () => {
    if (!facilityId || !selectedBankId || !fromDate || !toDate) return;

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      facilityId,
      bankAccountId: selectedBankId,
      fromDate,
      toDate,
    });

    _fetchApi(
      `/api/get/reconciliation-report-data?${params.toString()}`,
      (response) => {
        setLoading(false);
        if (response.success) {
          setReportData(response.data);
        } else {
          setError(response.message || "Failed to fetch report data");
        }
      },
      (err) => {
        setLoading(false);
        console.error("Report Error:", err);
        setError("An error occurred while fetching report data");
      }
    );
  }, [facilityId, selectedBankId, fromDate, toDate]);

  const handleApplyFilters = () => {
    setFromDate(localFromDate);
    setToDate(localToDate);
  };

  useEffect(() => {
    if (selectedBankId && fromDate && toDate) {
      fetchReportData();
    }
  }, [selectedBankId, fromDate, toDate, fetchReportData]);

  const formatCurrency = (amount, { signed = false } = {}) => {
    const n = Number(amount || 0);
    if (signed && n < 0) return `-${formatNumber1(Math.abs(n))}`;
    return formatNumber1(Math.abs(n));
  };

  const reconciliationSummary = reportData
    ? (() => {
        const adj = reportData.adjustments || {};
        const bankOnly =
          Number(adj.itemsInBankNotInApp ?? 0) ||
          sumEntryNet(reportData.unrecordedEntries);
        const payments =
          Number(adj.paymentsInBooksNotInBank ?? adj.unclearedPayments ?? 0);
        const deposits = Number(adj.depositsInTransit ?? 0);
        const bookBalance = Number(reportData.balances.bookBalance || 0);
        const bankBalance = Number(reportData.balances.bankStatement || 0);
        const adjustedBook =
          reportData.balances.adjustedBookBalance != null
            ? Number(reportData.balances.adjustedBookBalance)
            : bookBalance +
              bankOnly +
              Number(adj.interestEarned || 0) -
              Number(adj.bankCharges || 0) -
              payments;
        const adjustedBank =
          reportData.balances.adjustedBankBalance != null
            ? Number(reportData.balances.adjustedBankBalance)
            : bankBalance - deposits;
        return {
          bookBalance,
          bankBalance,
          interest: Number(adj.interestEarned || 0),
          charges: Number(adj.bankCharges || 0),
          bankOnly,
          payments,
          deposits,
          adjustedBook,
          adjustedBank,
          difference: adjustedBook - adjustedBank,
          totalBankNotInBooks: sumEntryNet(reportData.unrecordedEntries),
          totalBooksNotInBank: sumEntryNet(reportData.unpresentedEntries, {
            isGl: true,
          }),
        };
      })()
    : null;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return moment(dateString).format("DD/MM/YYYY");
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Bank-Reconciliation-Report-${selectedBankId}-${moment().format("YYYY-MM-DD")}`,
  });

  const handleExportToExcel = async () => {
    if (!reportData) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reconciliation Report");

    worksheet.columns = [
      { width: 15 },
      { width: 20 },
      { width: 50 },
      { width: 22 },
      { width: 15 },
    ];

    const borderStyle = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
    const headerStyle = {
      font: { bold: true },
      alignment: { horizontal: "center" },
      border: borderStyle,
    };
    const titleStyle = {
      font: { bold: true, size: 14 },
      alignment: { horizontal: "center" },
    };

    let currentRow = 1;
    const bizName = worksheet.getCell(currentRow, 1);
    bizName.value = activeBusiness?.business_name || "Business Name";
    bizName.style = titleStyle;
    worksheet.mergeCells(currentRow, 1, currentRow, 6);
    currentRow++;

    const reportTitle = worksheet.getCell(currentRow, 1);
    reportTitle.value = "BANK RECONCILIATION REPORT";
    reportTitle.style = { ...titleStyle, font: { bold: true, size: 12 } };
    worksheet.mergeCells(currentRow, 1, currentRow, 6);
    currentRow++;

    worksheet.addRow([]);
    currentRow++;

    const summaryHeaderRow = worksheet.addRow([
      "Reconciliation Summary",
      "",
      "",
      "",
      "Amount (₦)",
    ]);
    summaryHeaderRow.font = { bold: true };
    currentRow++;

    const adj = reportData.adjustments || {};
    const summaryLines = [
      ["GL Closing Balance (Books / App)", reportData.balances.bookBalance],
      ["Add: Receipts in Bank Not Yet in Books", adj.itemsInBankNotInApp ?? 0],
      ["Add: Interest Earned", adj.interestEarned ?? 0],
      ["Less: Bank Charges", -(adj.bankCharges ?? 0)],
      [
        "Less: Payments in Books Not Yet in Bank",
        -(adj.paymentsInBooksNotInBank ?? adj.unclearedPayments ?? 0),
      ],
      [
        "Adjusted Book Balance",
        reportData.balances.adjustedBookBalance ??
          reportData.balances.adjustedAppBalance,
      ],
      ["Bank Statement Closing Balance", reportData.balances.bankStatement],
      [
        "Less: Deposits in Transit",
        -(adj.depositsInTransit ?? 0),
      ],
      [
        "Adjusted Bank Balance",
        reportData.balances.adjustedBankBalance ??
          reportData.balances.bankStatement,
      ],
      ["Difference", reportData.balances.difference ?? 0],
    ];
    summaryLines.forEach((line, i) => {
      const row = worksheet.addRow([line[0], "", "", "", line[1]]);
      if (i === 5 || i === 8 || i === 9) row.font = { bold: true };
    });
    currentRow += summaryLines.length;

    worksheet.addRow([]);
    currentRow++;

    const reconciledHeader = worksheet.addRow(["Reconciled Entries"]);
    reconciledHeader.font = { bold: true };
    currentRow++;

    const matchedHeader = worksheet.addRow([
      "Date",
      "Ref",
      "Description",
      "Amount",
      "Status",
    ]);
    matchedHeader.eachCell((cell) => { cell.style = headerStyle; });

    reportData.reconciledEntries.forEach((txn) => {
      const amountLabel = `${formatCurrency(txn.amount)} ${String(
        txn.transaction_type || "",
      ).toLowerCase() === "credit"
        ? "cr"
        : "dr"}`;
      worksheet.addRow([
        formatDate(txn.transaction_date),
        txn.reference || "",
        txn.description,
        amountLabel,
        "Reconciled",
      ]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bank_Reconciliation_Report_${reportData.bankAccount.account_name}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url); // Clean up object URL
  };

  const formatAmountWithSide = (amount, side) => (
    <span className={side === "cr" ? "text-emerald-700" : "text-amber-800"}>
      {formatCurrency(amount)}{" "}
      <span className="text-[10px] font-medium lowercase">{side}</span>
    </span>
  );

  const SummaryAmountCell = ({ value, sign, bold = false, showZero = false }) => {
    const n = Number(value || 0);
    if (Math.abs(n) < 0.005 && !bold && !showZero) {
      return <span className="text-slate-400">—</span>;
    }
    const display =
      sign === "less"
        ? `(₦${formatCurrency(n)})`
        : sign === "add"
          ? `+ ₦${formatCurrency(n)}`
          : `₦${formatCurrency(n)}`;
    return (
      <span
        className={`tabular-nums ${bold ? "font-bold text-slate-900" : ""} ${
          sign === "add" ? "text-emerald-700" : sign === "less" ? "text-red-700" : ""
        }`}
      >
        {display}
      </span>
    );
  };

  const EntryTable = ({
    entries,
    keyPrefix,
    isUnpresented = false,
    totalLabel,
  }) => {
    const totalNet = sumEntryNet(entries, { isGl: isUnpresented });
    const totalSide = totalNet >= 0 ? "cr" : "dr";
    return (
      <table className="w-full border-collapse border border-slate-200">
        <thead>
          <tr className="bg-slate-600 text-white">
            {["Date", "Ref no", "Description", "Amount (₦)"].map((h, i) => (
              <th
                key={h}
                className={`text-xs font-semibold px-3 py-2 border border-slate-500 uppercase tracking-wide ${
                  i >= 3 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-sm bg-white">
          {entries.length > 0 ? (
            <>
              {entries.map((txn, i) => {
                const { amount, side } = formatEntryAmount(txn, {
                  isGl: isUnpresented,
                });
                return (
                  <tr
                    key={`${keyPrefix}-${i}`}
                    className="border-b border-slate-100 hover:bg-slate-50/80"
                  >
                    <td className="py-2 px-3 text-slate-600 border-r border-slate-100">
                      {formatDate(txn.transaction_date)}
                    </td>
                    <td className="py-2 px-3 font-medium text-blue-700 border-r border-slate-100">
                      {isUnpresented
                        ? txn.reference_number || txn.transaction_ref || "—"
                        : txn.reference || "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-800 border-r border-slate-100">
                      {isUnpresented
                        ? txn.transaction_description
                        : txn.description}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold tabular-nums">
                      {formatAmountWithSide(amount, side)}
                    </td>
                  </tr>
                );
              })}
              {totalLabel && entries.length > 0 && (
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold">
                  <td colSpan={3} className="py-2.5 px-3 text-xs uppercase text-slate-800">
                    {totalLabel}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatAmountWithSide(Math.abs(totalNet), totalSide)}
                  </td>
                </tr>
              )}
            </>
          ) : (
            <tr>
              <td
                colSpan={4}
                className="py-6 text-center text-slate-400 text-sm italic"
              >
                No entries found for this period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white p-3 rounded shadow-sm border border-slate-200 no-print">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
              <SelectTrigger className="h-9 text-sm bg-slate-50">
                <Landmark className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)} className="text-sm">
                    {bank.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="date"
              value={localFromDate}
              onChange={(e) => setLocalFromDate(e.target.value)}
              className="h-9 rounded border border-slate-200 bg-slate-50 px-3 text-sm outline-none w-40"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={localToDate}
              onChange={(e) => setLocalToDate(e.target.value)}
              className="h-9 rounded border border-slate-200 bg-slate-50 px-3 text-sm outline-none w-40"
            />
            <Button
              onClick={handleApplyFilters}
              size="sm"
              className="h-9 bg-slate-800 hover:bg-slate-900 text-white ml-2"
            >
              Apply
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {!loading && !error && reportData && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 w-9 p-0 border-slate-200">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                    <Printer className="h-4 w-4 mr-2" /> Print
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportToExcel} className="cursor-pointer">
                    <Download className="h-4 w-4 mr-2" /> Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!bankId && (
              <Button
                variant="destructive"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => navigate("/app/reports/accounting-reports")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="border-none shadow-sm overflow-hidden rounded">
            <div className="bg-blue-900 h-24 p-6">
              <Skeleton className="h-8 w-64 bg-blue-800" />
            </div>
            <div className="p-6 space-y-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-12 text-center border rounded-lg bg-red-50 border-red-100 max-w-2xl mx-auto">
          <p className="text-sm font-bold text-red-700 uppercase mb-3">Report Generation Failed</p>
          <p className="text-sm text-red-600 mb-6 font-medium">{error}</p>
          <Button
            onClick={fetchReportData}
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-100"
          >
            Retry Fetch
          </Button>
        </div>
      )}

      {/* Main Report */}
      {!loading && !error && reportData && (
        <div
          ref={printRef}
          className="bg-white rounded shadow-md overflow-hidden border border-slate-200 print:shadow-none print:border-none"
        >
          {/* Letterhead */}
          <BusinessDocumentHeader
            business={activeBusiness}
            title="Bank Reconciliation Statement"
            numberLabel={`Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`}
            date={new Date()}
            dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
            className="mb-0 print:p-3"
          />

          {/* Account Info Band */}
          {/* <div className="bg-blue-50 border border-blue-200 p-1 mb-1">
            <h6 className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">
              Bank account
            </h6>
            <div className="text-xs text-gray-700 leading-relaxed">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div className="flex flex-wrap items-baseline min-w-0">
                  <span className="font-semibold text-gray-600">Name:</span>{" "}
                  <span className="text-gray-900">{reportData.bankAccount.account_name || "N/A"}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="font-semibold text-gray-600">Account no:</span>{" "}
                  <span className="text-gray-900 font-mono">
                    {reportData.bankAccount.account_number || "N/A"}
                  </span>
                  {reportData.bankAccount.head != null &&
                    String(reportData.bankAccount.head).trim() !== "" && (
                      <>
                        <span className="text-gray-400 mx-1">|</span>
                        <span className="font-semibold text-gray-600">Code:</span>{" "}
                        <span className="text-gray-900 font-mono">
                          {String(reportData.bankAccount.head).trim()}
                        </span>
                      </>
                    )}
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="font-semibold text-gray-600">Currency:</span>{" "}
                  <span className="text-gray-900">{reportData.bankAccount.currency || "NGN"}</span>
                  {(reportData.bankAccount.bank_name || reportData.bankAccount.bank_code) && (
                    <>
                      <span className="text-gray-400 mx-1">|</span>
                      <span className="font-semibold text-gray-600">Bank:</span>{" "}
                      <span className="text-gray-900">
                        {reportData.bankAccount.bank_name || reportData.bankAccount.bank_code}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center sm:ml-4 shrink-0">
                  <span className="font-semibold text-gray-600">Balance:</span>{" "}
                  <span
                    className={`font-bold ml-1 tabular-nums ${
                      Number(reportData.balances.bookBalance) < 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    ₦{formatNumber1(reportData.balances.bookBalance || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div> */}

          <div className="p-4 print:p-4 space-y-5 pt-3">
            {/* Statement details (sample layout) */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-700">
                  Bank Reconciliation Statement
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 p-3 text-xs bg-white">
                {[
                  ["Bank", reportData.bankAccount?.bank_name || reportData.bankAccount?.account_name || "—"],
                  [
                    "GL account",
                    reportData.bankAccount?.head != null
                      ? `GL – ${String(reportData.bankAccount.head).trim()}`
                      : "—",
                  ],
                  ["Date prepared", moment().format("DD MMMM YYYY")],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-2 min-w-0">
                    <span className="font-semibold text-slate-500 shrink-0">{label}:</span>
                    <span className="text-slate-900 break-words">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reconciliation summary table */}
            {reconciliationSummary && (
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-l-4 border-blue-600 pl-3">
                  Reconciliation Summary
                </h3>
                <table className="w-full border-collapse border border-slate-300 text-sm">
                  <thead>
                    <tr className="bg-slate-700 text-white">
                      <th className="text-left text-xs font-bold uppercase px-4 py-2.5 border border-slate-600 w-[70%]">
                        Reconciliation Summary
                      </th>
                      <th className="text-right text-xs font-bold uppercase px-4 py-2.5 border border-slate-600">
                        Amount (₦)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-2.5 text-slate-800">
                        GL Closing Balance (Books / App)
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        ₦{formatCurrency(reconciliationSummary.bookBalance)}
                      </td>
                    </tr>
                    {Math.abs(reconciliationSummary.bankOnly) > 0.005 && (
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-2 text-slate-700">
                          Add: Receipts in Bank Not Yet in Books
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <SummaryAmountCell value={reconciliationSummary.bankOnly} sign="add" />
                        </td>
                      </tr>
                    )}
                    {Math.abs(reconciliationSummary.interest) > 0.005 && (
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-2 text-slate-700">Add: Interest Earned</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <SummaryAmountCell value={reconciliationSummary.interest} sign="add" />
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-2 text-slate-700">Less: Bank Charges</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <SummaryAmountCell
                          value={reconciliationSummary.charges}
                          sign="less"
                          showZero
                        />
                      </td>
                    </tr>
                    {Math.abs(reconciliationSummary.payments) > 0.005 && (
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-2 text-slate-700">
                          Less: Payments in Books Not Yet in Bank (Outstanding Cheques)
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <SummaryAmountCell value={reconciliationSummary.payments} sign="less" />
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 border-y-2 border-slate-400">
                      <td className="px-4 py-2.5 font-bold uppercase text-xs text-slate-900">
                        Adjusted Book Balance
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                        ₦{formatCurrency(reconciliationSummary.adjustedBook)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-2.5 text-slate-800">
                        Bank Statement Closing Balance
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        ₦{formatCurrency(reconciliationSummary.bankBalance)}
                      </td>
                    </tr>
                    {Math.abs(reconciliationSummary.deposits) > 0.005 && (
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-2 text-slate-700">
                          Less: Deposits in Transit (Not Yet Cleared)
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <SummaryAmountCell value={reconciliationSummary.deposits} sign="less" />
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 border-y-2 border-slate-400">
                      <td className="px-4 py-2.5 font-bold uppercase text-xs text-slate-900">
                        Adjusted Bank Balance
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                        ₦{formatCurrency(reconciliationSummary.adjustedBank)}
                      </td>
                    </tr>
                    <tr
                      className={
                        Math.abs(reconciliationSummary.difference) < 0.01
                          ? "bg-emerald-50"
                          : "bg-red-50"
                      }
                    >
                      <td className="px-4 py-3 font-bold text-slate-900">
                        Difference (Should be ₦0.00)
                        {Math.abs(reconciliationSummary.difference) < 0.01 && (
                          <span className="ml-2 text-emerald-600">✓</span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold tabular-nums ${
                          Math.abs(reconciliationSummary.difference) < 0.01
                            ? "text-emerald-700"
                            : "text-red-700"
                        }`}
                      >
                        ₦{formatCurrency(reconciliationSummary.difference, { signed: true })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Detail sections */}
            <div className="space-y-5 pt-1">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-l-4 border-slate-800 pl-3 mb-2">
                  Section 1: Reconciled Entries (Matched)
                </h3>
                <EntryTable entries={reportData.reconciledEntries} keyPrefix="rec" />
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-l-4 border-red-500 pl-3 mb-2">
                  Section 2: Items in Bank Statement — Not in Books
                </h3>
                <EntryTable
                  entries={reportData.unrecordedEntries}
                  keyPrefix="unrec"
                  totalLabel="Total — In Bank Not in Books"
                />
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-l-4 border-orange-500 pl-3 mb-2">
                  Section 3: Items in Books — Not Yet in Bank Statement
                </h3>
                <EntryTable
                  entries={reportData.unpresentedEntries}
                  keyPrefix="unpres"
                  isUnpresented
                  totalLabel="Total — In Books Not in Bank"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">
              <span className="normal-case tracking-normal font-semibold text-slate-500">
                Powered by AA ERP
              </span>
              <div className="bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
                {moment().format("DD/MM/YYYY HH:mm")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !reportData && (
        <div className="p-24 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <Landmark className="h-12 w-12 text-slate-200 mx-auto mb-6" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Select Account Parameters to View Report
          </p>
        </div>
      )}
    </div>
  );
};

export default BankReconciliationReport;
