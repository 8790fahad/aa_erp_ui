import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  X,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
  Printer,
  Settings,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import { jsPDF } from "jspdf";
import { useReactToPrint } from "react-to-print";

const DEFAULT_PRINT_MARGINS_IN = {
  top: 0.5,
  bottom: 0.5,
  left: 0.5,
  right: 0.75,
};

const inchesToMm = (inches) =>
  Math.max(0, parseFloat(inches) || 0) * 25.4;

const InventriaTrialBalance = () => {
  const BALANCE_TOLERANCE_NAIRA = 10;
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;
  const [asOfDate, setAsOfDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState([]);
  const [totals, setTotals] = useState(null);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [printMargins, setPrintMargins] = useState(DEFAULT_PRINT_MARGINS_IN);
  const reportExportRef = useRef(null);
  const printRef = useRef(null);

  const handlePrintMarginChange = (side, value) => {
    setPrintMargins((prev) => ({
      ...prev,
      [side]: Math.max(0, parseFloat(value) || 0),
    }));
  };

  const printPageStyle = `
    @page {
      size: A4 portrait;
      margin: ${printMargins.top}in ${printMargins.right}in ${printMargins.bottom}in ${printMargins.left}in;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .trial-balance-print-root {
      box-sizing: border-box;
      width: 100%;
      background: #fff !important;
    }
    .no-print { display: none !important; }
  `;

  // Initialize date
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    // Check if date is passed from navigation
    if (location.state?.asOfDate) {
      setAsOfDate(location.state.asOfDate);
    } else {
      setAsOfDate(today);
    }
  }, [location.state]);

  const fetchTrialBalanceData = useCallback(async () => {
    if (!facilityId || !asOfDate) {
      setError("Please provide facility ID and as of date");
      return;
    }

    setLoading(true);
    setError("");

    _postApi(
      `/accounting/trial-balance`,
      {
        facilityId,
        asOfDate,
      },
      (response) => {
        setLoading(false);
        if (response.success && response.data) {
          setTree(response.data.tree || []);
          setTotals(response.data.totals || null);
          setValidation(response.data.validation || null);
        } else {
          setError(response.message || "Failed to fetch trial balance data");
        }
      },
      (err) => {
        setLoading(false);
        console.error("Trial Balance Error:", err);
        setError("An error occurred while fetching trial balance data");
      },
    );
  }, [facilityId, asOfDate]);

  // Fetch data when date changes
  useEffect(() => {
    if (asOfDate && facilityId) {
      fetchTrialBalanceData();
    }
  }, [asOfDate, facilityId, fetchTrialBalanceData]);

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
    fetchTrialBalanceData();
  };

  const sortByCode = (a, b) =>
    String(a.account_code || "").localeCompare(
      String(b.account_code || ""),
      undefined,
      {
        numeric: true,
      },
    );

  const toNetTrialBalanceColumns = (debit, credit) => {
    const dr = parseFloat(debit) || 0;
    const cr = parseFloat(credit) || 0;
    const net = dr - cr;
    if (Math.abs(net) < 0.005) {
      return { total_debit: 0, total_credit: 0 };
    }
    if (net > 0) {
      return { total_debit: net, total_credit: 0 };
    }
    return { total_debit: 0, total_credit: Math.abs(net) };
  };

  const flattenTree = useCallback((nodes) => {
    const out = [];
    const walk = (list, depth) => {
      (list || []).forEach((n) => {
        const code = String(n.account_code || "").trim();
        const hierarchy =
          Number.isFinite(Number(n.hierarchy)) ? Number(n.hierarchy) : depth;
        const children = Array.isArray(n.children) ? n.children : [];
        const orderedChildren = [...children].sort(sortByCode);
        // Hide top-level nature headers (hierarchy: 0) but keep their children.
        const shouldRender = hierarchy !== 0;
        if (shouldRender) {
          const { total_debit, total_credit } = toNetTrialBalanceColumns(
            n.total_debit,
            n.total_credit
          );
          out.push({
            ...n,
            total_debit,
            total_credit,
            _code: code,
            _depth: hierarchy,
            _hasChildren: orderedChildren.length > 0,
            children: orderedChildren,
          });
        }
        if (orderedChildren.length > 0) {
          walk(orderedChildren, shouldRender ? hierarchy + 1 : 0);
        }
      });
    };
    walk([...((nodes || []).slice())].sort(sortByCode), 0);
    return out;
  }, []);

  const flatRows = flattenTree(tree);

  const openAccountLedger = useCallback(
    (account) => {
      const code = String(account?._code || account?.account_code || "").trim();
      if (!code || code === "-") {
        toast.error("No account code for this row");
        return;
      }
      const to = asOfDate || new Date().toISOString().split("T")[0];
      const fromDate = new Date(to);
      fromDate.setMonth(0, 1);
      const from = fromDate.toISOString().split("T")[0];
      const params = new URLSearchParams({
        accounts: code,
        name: account.account_name || code,
        from,
        to,
      });
      if (account._hasChildren || account.is_header) {
        params.set("onlyChildren", "1");
      }
      navigate(
        `/app/reports/accounting-reports/custom-reports?${params.toString()}`,
      );
    },
    [asOfDate, navigate],
  );

  const rawDifference = parseFloat(totals?.difference || 0);
  const effectiveDifference =
    Math.abs(rawDifference) <= BALANCE_TOLERANCE_NAIRA ? 0 : rawDifference;

  const hasData = tree.length > 0;

  const handleExportExcel = useCallback(async () => {
    if (!hasData) {
      toast.error("No report data to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Trial Balance");
      ws.columns = [{ width: 16 }, { width: 44 }, { width: 18 }, { width: 18 }];

      let r = 1;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = "TRIAL BALANCE REPORT";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = `As of: ${formatDate(asOfDate)}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const head = ["Account Code", "Account Name", "Debit (₦)", "Credit (₦)"];
      head.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4B5563" },
        };
      });
      r++;

      flatRows.forEach((account) => {
        ws.getCell(r, 1).value = account.account_code || "-";
        ws.getCell(r, 2).value =
          `${"  ".repeat(account._depth || 0)}${account.account_name || "-"}`;
        ws.getCell(r, 3).value = account.is_header
          ? ""
          : Number(account.total_debit || 0);
        ws.getCell(r, 4).value = account.is_header
          ? ""
          : Number(account.total_credit || 0);
        if (account.is_header) {
          ws.getCell(r, 2).font = { bold: true };
        }
        ws.getCell(r, 3).numFmt = "#,##0.00";
        ws.getCell(r, 4).numFmt = "#,##0.00";
        r++;
      });

      ws.getCell(r, 1).value = "Total Debits";
      ws.getCell(r, 3).value = Number(totals?.totalDebit || 0);
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Total Credits";
      ws.getCell(r, 4).value = Number(totals?.totalCredit || 0);
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 4).font = { bold: true };
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Difference";
      ws.getCell(r, 3).value = Number(effectiveDifference || 0);
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trial-balance-${asOfDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [
    hasData,
    activeBusiness,
    asOfDate,
    flatRows,
    validation,
    totals,
    effectiveDifference,
  ]);

  const handleExportPdf = useCallback(async () => {
    const el = reportExportRef.current;
    if (!el) {
      toast.error("Report is not ready to export");
      return;
    }
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: el.scrollWidth,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const mTop = inchesToMm(printMargins.top);
      const mBottom = inchesToMm(printMargins.bottom);
      const mLeft = inchesToMm(printMargins.left);
      const mRight = inchesToMm(printMargins.right);
      const contentWidth = pageWidth - mLeft - mRight;
      const contentHeightPerPage = pageHeight - mTop - mBottom;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let y = 0;
      while (y < imgHeight) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", mLeft, mTop - y, contentWidth, imgHeight);
        y += contentHeightPerPage;
      }
      pdf.save(`trial-balance-${asOfDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [asOfDate, printMargins]);

  const handleReactToPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Trial-Balance-${asOfDate}`,
    pageStyle: printPageStyle,
  });

  const handlePrint = () => {
    if (!printRef.current) {
      toast.error("Report is not ready to print yet.");
      return;
    }
    handleReactToPrint();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-100 pl-2 mb-2 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Report Date
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 md:col-span-1">
              <div className="flex flex-wrap items-end justify-end gap-3 w-full">
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-10"
                onClick={() => navigate("/app/reports/accounting-reports")}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
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
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 border-gray-300"
                disabled={!hasData || loading}
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-10 border-gray-300"
                    disabled={!hasData || loading}
                  >
                    Export
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={!hasData || loading}
                    onClick={() => handleExportExcel()}
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    Export Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={!hasData || loading || pdfExporting}
                    onClick={() => handleExportPdf()}
                  >
                    {pdfExporting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 shrink-0" />
                    )}
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 border-gray-300"
                    title="Print margins"
                    aria-label="Print margins"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Margins (inches)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["top", "bottom", "left", "right"]).map((side) => (
                      <label key={side} className="text-[11px] text-gray-600">
                        <span className="capitalize block mb-0.5">{side}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={printMargins[side]}
                          onChange={(e) =>
                            handlePrintMarginChange(side, e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <>
            <div className="space-y-4">
              {/* Skeleton for Header */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-4 w-48" />
              </div>

              {/* Skeleton for Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="grid grid-cols-6 gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24 ml-auto" />
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Footer Skeleton */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <Skeleton className="h-6 w-40 mb-4" />
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

        {/* Trial Balance Report */}
        {!loading && !error && tree.length > 0 && (
          <div
            className="space-y-4 trial-balance-print-root"
            ref={(node) => {
              reportExportRef.current = node;
              printRef.current = node;
            }}
            style={{ boxSizing: "border-box" }}
          >
            {/* Business Header */}
            <div className="mb-0.5">
              <BusinessDocumentHeader
                business={activeBusiness}
                title="TRIAL BALANCE REPORT"
                numberLabel={`As of: ${formatDate(asOfDate)}`}
                date={new Date()}
                dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                className="mb-0"
              />
            </div>

            <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm">
              {(totals || validation) &&
                Math.abs(rawDifference) > BALANCE_TOLERANCE_NAIRA && (
                  <div className="border-b border-gray-200 px-3 py-2 text-center text-xs bg-amber-50 text-amber-900">
                    Out of balance by{" "}
                    {formatCurrency(Math.abs(effectiveDifference))} — verify
                    opening balances and GL postings.
                  </div>
                )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-600 border-b-2 border-gray-700">
                    <tr>
                      <th className="px-1.5 py-2 text-left text-xs font-bold text-white uppercase">
                        Account
                      </th>
                      <th className="px-1.5 py-2 text-left text-xs font-bold text-white uppercase">
                        Acct #
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-white uppercase min-w-[11rem] whitespace-nowrap">
                        Debit (₦)
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-white uppercase bg-gray-700 min-w-[11rem] whitespace-nowrap">
                        Credit (₦)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatRows.map((account, idx) => {
                      const isHeader = Boolean(account.is_header);
                      const depth = Number(account._depth || 0);
                      const canOpen = Boolean(
                        String(account._code || account.account_code || "").trim(),
                      );
                      return (
                        <tr
                          key={`row-${account._code || idx}`}
                          className={`border-b border-gray-200 ${
                            isHeader ? "bg-[#f3f4f6]" : "bg-white"
                          } hover:bg-slate-50`}
                        >
                          <td
                            className={`text-sm text-gray-900 ${
                              isHeader ? "font-semibold" : "font-normal"
                            }`}
                            style={{ paddingLeft: `${8 + depth * 6}px` }}
                          >
                            {account.account_name || "-"}
                          </td>
                          <td className="px-1.5 py-1.5 text-xs text-gray-500">
                            {canOpen ? (
                              <button
                                type="button"
                                onClick={() => openAccountLedger(account)}
                                className="text-blue-600 hover:underline font-medium cursor-pointer bg-transparent border-0 p-0"
                                title="Open account ledger"
                              >
                                {account.account_code || "-"}
                              </button>
                            ) : (
                              account.account_code || "-"
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right text-sm tabular-nums text-gray-900 whitespace-nowrap">
                            {isHeader
                              ? ""
                              : parseFloat(account.total_debit || 0) > 0
                              ? formatCurrency(account.total_debit)
                              : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right text-sm tabular-nums text-gray-900 whitespace-nowrap">
                            {isHeader
                              ? ""
                              : parseFloat(account.total_credit || 0) > 0
                              ? formatCurrency(account.total_credit)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Footer */}
            {(totals || validation) && (
              <div className="bg-white border border-gray-300 rounded-sm shadow-sm p-6 mt-2">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Report Summary
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  As of: {formatDate(asOfDate)}
                </p>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Total Debits</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        parseFloat(totals?.totalDebit || 0),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Total Credits</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        parseFloat(totals?.totalCredit || 0),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Difference</p>
                    <p
                      className={`text-2xl font-bold ${
                        Math.abs(rawDifference) <= BALANCE_TOLERANCE_NAIRA
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(effectiveDifference)}
                    </p>
                    {Math.abs(rawDifference) <= BALANCE_TOLERANCE_NAIRA && (
                      <p className="text-xs text-green-600 mt-1">✓ Balanced</p>
                    )}
                    {Math.abs(rawDifference) > BALANCE_TOLERANCE_NAIRA && (
                      <p className="text-xs text-red-600 mt-1">
                        ⚠ Not Balanced (difference greater than ₦10)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tree.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">
              No trial balance data found for the selected date.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventriaTrialBalance;
