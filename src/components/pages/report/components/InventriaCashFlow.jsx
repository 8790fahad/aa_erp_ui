import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, X, FileSpreadsheet, FileDown, ChevronDown } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import moment from "moment";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const InventriaCashFlow = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportDataPrior, setReportDataPrior] = useState(null);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = useRef(null);

  // Initialize dates
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();
    const firstDayOfYear = `${currentYear}-01-01`;

    // Check if dates are passed from navigation
    if (location.state?.fromDate && location.state?.toDate) {
      setFromDate(location.state.fromDate);
      setToDate(location.state.toDate);
    } else {
      setFromDate(firstDayOfYear);
      setToDate(today);
    }
  }, [location.state]);

  const callCashFlowApi = useCallback(
    (payload) =>
      new Promise((resolve, reject) => {
        _postApi(
          `/accounting/cash-flow-statement`,
          payload,
          (response) => {
            if (response.success && response.data) resolve(response.data);
            else reject(new Error(response.message || "Failed to fetch cash flow data"));
          },
          (err) => reject(err)
        );
      }),
    []
  );

  const fetchCashFlowData = useCallback(async () => {
    if (!facilityId || !fromDate || !toDate) {
      setError("Please provide facility ID and date range");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const priorFrom = moment(fromDate).subtract(1, "year").format("YYYY-MM-DD");
      const priorTo = moment(toDate).subtract(1, "year").format("YYYY-MM-DD");
      const [current, prior] = await Promise.all([
        callCashFlowApi({ facilityId, fromDate, toDate }),
        callCashFlowApi({ facilityId, fromDate: priorFrom, toDate: priorTo }),
      ]);
      setReportData(current);
      setReportDataPrior(prior);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.error("Cash Flow Error:", err);
      setError("An error occurred while fetching cash flow data");
    }
  }, [facilityId, fromDate, toDate, callCashFlowApi]);

  // Fetch data when dates change
  useEffect(() => {
    if (fromDate && toDate && facilityId) {
      fetchCashFlowData();
    }
  }, [fromDate, toDate, facilityId, fetchCashFlowData]);

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
    fetchCashFlowData();
  };

  const hasData =
    !!reportData &&
    (Number(reportData.operatingActivities?.netCashFlow || 0) !== 0 ||
      Number(reportData.investingActivities?.netCashFlow || 0) !== 0 ||
      Number(reportData.financingActivities?.netCashFlow || 0) !== 0 ||
      Number(reportData.summary?.netIncreaseInCash || 0) !== 0 ||
      Number(reportData.summary?.representedBy?.closingCashBalance || 0) !== 0);
  const currentYearLabel = moment(toDate).format("YYYY");
  const priorYearLabel = moment(toDate).subtract(1, "year").format("YYYY");

  const pairByCode = (currentItems = [], priorItems = []) => {
    const map = new Map();
    priorItems.forEach((r) => {
      map.set(String(r.account_code || r.account_name), {
        name: r.account_name,
        code: r.account_code,
        current: 0,
        prior: parseFloat(r.net_amount || 0),
      });
    });
    currentItems.forEach((r) => {
      const k = String(r.account_code || r.account_name);
      const ex = map.get(k) || {
        name: r.account_name,
        code: r.account_code,
        current: 0,
        prior: 0,
      };
      ex.name = r.account_name || ex.name;
      ex.code = r.account_code || ex.code;
      ex.current = parseFloat(r.net_amount || 0);
      map.set(k, ex);
    });
    return Array.from(map.values());
  };

  const handleExportExcel = useCallback(async () => {
    if (!reportData) {
      toast.error("No report data to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Cash Flow");
      ws.columns = [{ width: 52 }, { width: 14 }, { width: 18 }, { width: 18 }];

      let r = 1;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name || activeBusiness?.name || "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = "CASH FLOW STATEMENT";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = `Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const head = ["Particulars", "Note", `${currentYearLabel} (N)`, `${priorYearLabel} (N)`];
      head.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B5563" } };
      });
      r++;

      const writeSection = (title, currentTotal, priorTotal) => {
        ws.getCell(r, 1).value = title;
        ws.getCell(r, 1).font = { bold: true };
        r++;
        ws.getCell(r, 1).value = `Net ${title.toLowerCase()}`;
        ws.getCell(r, 1).font = { bold: true };
        ws.getCell(r, 3).value = Number(currentTotal || 0);
        ws.getCell(r, 4).value = Number(priorTotal || 0);
        ws.getCell(r, 3).font = { bold: true };
        ws.getCell(r, 4).font = { bold: true };
        ws.getCell(r, 3).numFmt = "#,##0.00";
        ws.getCell(r, 4).numFmt = "#,##0.00";
        r += 2;
      };

      ws.getCell(r, 1).value = "Cash flows from operating activities";
      ws.getCell(r, 1).font = { bold: true };
      r++;
      ws.getCell(r, 1).value = "Net profit for the year";
      ws.getCell(r, 3).value = Number(reportData.operatingActivities?.netProfitForPeriod || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.operatingActivities?.netProfitForPeriod || 0);
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Add items not involving movement of cash:";
      ws.getCell(r, 1).font = { bold: true };
      r++;
      ws.getCell(r, 1).value = "Non-cash adjustments";
      ws.getCell(r, 3).value = Number(reportData.operatingActivities?.nonCashAdjustments?.total || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.operatingActivities?.nonCashAdjustments?.total || 0);
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Cash flow before changes in working capital";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).value = Number(reportData.operatingActivities?.cashBeforeWorkingCapital || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.operatingActivities?.cashBeforeWorkingCapital || 0);
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 4).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Changes in working capital";
      ws.getCell(r, 1).font = { bold: true };
      r++;
      ws.getCell(r, 1).value = "Net changes in working capital";
      ws.getCell(r, 3).value = Number(reportData.operatingActivities?.workingCapitalChanges?.total || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.operatingActivities?.workingCapitalChanges?.total || 0);
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Tax paid during the year";
      ws.getCell(r, 3).value = Number(reportData.operatingActivities?.taxPaid?.total || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.operatingActivities?.taxPaid?.total || 0);
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "PROFIT OR LOSS ACCOUNT";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).value = Number(reportData.operatingActivities?.netCashFlow || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.operatingActivities?.netCashFlow || 0);
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 4).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r += 2;

      writeSection(
        "Cash flows from investing activities",
        reportData.investingActivities?.netCashFlow,
        reportDataPrior?.investingActivities?.netCashFlow
      );
      writeSection(
        "Cash flows from financing activities",
        reportData.financingActivities?.netCashFlow,
        reportDataPrior?.financingActivities?.netCashFlow
      );

      ws.getCell(r, 1).value = "Net increase/(decrease) in cash and cash equivalents";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).value = Number(reportData.summary?.netIncreaseInCash || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.summary?.netIncreaseInCash || 0);
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 4).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Cash and cash equivalents as at 1 January";
      ws.getCell(r, 3).value = Number(reportData.summary?.openingCashBalance || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.summary?.openingCashBalance || 0);
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Cash and cash equivalents as at 31 December";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).value = Number(reportData.summary?.representedBy?.closingCashBalance || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.summary?.representedBy?.closingCashBalance || 0);
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 4).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r += 2;
      ws.getCell(r, 1).value = "Represented by:";
      ws.getCell(r, 1).font = { bold: true };
      r++;
      ws.getCell(r, 1).value = "Bank and cash balances";
      ws.getCell(r, 3).value = Number(reportData.summary?.representedBy?.bankAndCashBalances?.total || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.summary?.representedBy?.bankAndCashBalances?.total || 0);
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "Bank overdraft";
      ws.getCell(r, 3).value = Number(reportData.summary?.representedBy?.bankOverdraft?.total || 0);
      ws.getCell(r, 4).value = Number(reportDataPrior?.summary?.representedBy?.bankOverdraft?.total || 0);
      ws.getCell(r, 3).numFmt = "#,##0.00";
      ws.getCell(r, 4).numFmt = "#,##0.00";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cash-flow-statement-${toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [reportData, reportDataPrior, activeBusiness, fromDate, toDate, currentYearLabel, priorYearLabel]);

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
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let y = 0;
      while (y < imgHeight) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -y, pageWidth, imgHeight);
        y += pageHeight;
      }
      pdf.save(`cash-flow-statement-${toDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [toDate]);

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-100 pl-2 mb-2 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Report period
              </label>
              <div className="flex items-center gap-3">
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
              </div>
            </div>
            <div className="flex items-end justify-end gap-3">
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
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <Skeleton className="h-8 w-64 mb-4" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Cash Flow Statement Report */}
        {!loading && !error && hasData && (
          <div className="space-y-4" ref={reportExportRef}>
            {/* Business Header */}
            <div className="mb-1">
              <BusinessDocumentHeader
                business={activeBusiness}
                title="CASH FLOW STATEMENT"
                numberLabel={`Period: ${formatDate(fromDate)} - ${formatDate(toDate)}`}
                date={new Date()}
                dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                className="mb-0"
              />
            </div>

            <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-600 border-b-2 border-gray-700">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                        Particulars
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-bold text-white uppercase border-r border-gray-500 w-24">
                        Note
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase border-r border-gray-500 min-w-[9rem]">
                        {currentYearLabel} (N)
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase bg-gray-700 min-w-[9rem]">
                        {priorYearLabel} (N)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-50 border-t-2 border-gray-500">
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Cash flows from operating activities
                      </td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900">Net profit for the year</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportData.operatingActivities?.netProfitForPeriod || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportDataPrior?.operatingActivities?.netProfitForPeriod || 0))}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-300">
                      <td className="px-3 py-1.5 text-gray-900 font-semibold">Add items not involving movement of cash:</td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900">Non-cash adjustments</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportData.operatingActivities?.nonCashAdjustments?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportDataPrior?.operatingActivities?.nonCashAdjustments?.total || 0))}
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Cash flow before changes in working capital</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportData.operatingActivities?.cashBeforeWorkingCapital || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportDataPrior?.operatingActivities?.cashBeforeWorkingCapital || 0))}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-300">
                      <td className="px-3 py-1.5 text-gray-900 font-semibold">Changes in working capital</td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900">Net changes in working capital</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportData.operatingActivities?.workingCapitalChanges?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportDataPrior?.operatingActivities?.workingCapitalChanges?.total || 0))}
                      </td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900">Tax paid during the year</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportData.operatingActivities?.taxPaid?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportDataPrior?.operatingActivities?.taxPaid?.total || 0))}
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Net cash from operating activities</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportData.operatingActivities?.netCashFlow || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportDataPrior?.operatingActivities?.netCashFlow || 0))}
                      </td>
                    </tr>

                    <tr><td colSpan={4} className="h-2 bg-white" /></tr>

                    <tr className="bg-gray-50 border-t-2 border-gray-500">
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Cash flows from investing activities
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Net cash from investing activities</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportData.investingActivities?.netCashFlow || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportDataPrior?.investingActivities?.netCashFlow || 0))}
                      </td>
                    </tr>

                    <tr><td colSpan={4} className="h-2 bg-white" /></tr>

                    <tr className="bg-gray-50 border-t-2 border-gray-500">
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900 uppercase tracking-wide">
                        Cash flows from financing activities
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Net cash from financing activities</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportData.financingActivities?.netCashFlow || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportDataPrior?.financingActivities?.netCashFlow || 0))}
                      </td>
                    </tr>

                    <tr className="bg-gray-200 font-bold border-t-2 border-b-2 border-gray-600">
                      <td className="px-3 py-2 text-gray-900">Net increase/(decrease) in cash and cash equivalents</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className={`px-3 py-2 text-right tabular-nums border-l border-gray-300 ${parseFloat(reportData.summary?.netIncreaseInCash || 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {formatCurrency(parseFloat(reportData.summary?.netIncreaseInCash || 0))}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums border-l border-gray-300 ${parseFloat(reportDataPrior?.summary?.netIncreaseInCash || 0) >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {formatCurrency(parseFloat(reportDataPrior?.summary?.netIncreaseInCash || 0))}
                      </td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200">
                      <td className="px-3 py-1.5 text-gray-900">Cash and cash equivalents as at 1 January</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportData.summary?.openingCashBalance || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportDataPrior?.summary?.openingCashBalance || 0))}
                      </td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Cash and cash equivalents as at 31 December</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportData.summary?.representedBy?.closingCashBalance || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(reportDataPrior?.summary?.representedBy?.closingCashBalance || 0))}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 border-t-2 border-gray-500">
                      <td colSpan={4} className="px-3 py-2 text-sm font-bold text-gray-900">Represented by:</td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200">
                      <td className="px-3 py-1.5 text-gray-900">Bank and cash balances</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportData.summary?.representedBy?.bankAndCashBalances?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportDataPrior?.summary?.representedBy?.bankAndCashBalances?.total || 0))}
                      </td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200">
                      <td className="px-3 py-1.5 text-gray-900">Bank overdraft</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportData.summary?.representedBy?.bankOverdraft?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(reportDataPrior?.summary?.representedBy?.bankOverdraft?.total || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 w-full border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-700">
                The accounting policies and accompanying notes form part of these financial statements.
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !hasData && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">
              No cash flow data found for the selected period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventriaCashFlow;
