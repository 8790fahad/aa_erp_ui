import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { Loader2, X, FileSpreadsheet, FileDown, ChevronDown } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import moment from "moment";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import ProfitLossSummaryTable from "./ProfitLossSummaryTable";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import { buildIncomeStatementNotesUrl } from "./IncomeStatementNotesSection";

const AaErpIncomeStatement = () => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState("");
  const [configureOpen, setConfigureOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [reportName, setReportName] = useState("Income Statement");
  const [saveAfterRun, setSaveAfterRun] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [templateView, setTemplateView] = useState(false);
  const [plsReport, setPlsReport] = useState(null);
  const [plsLoading, setPlsLoading] = useState(false);
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

  const fetchIncomeStatementData = useCallback(
    async (params = {}) => {
      const from = params.fromDate || fromDate;
      const to = params.toDate || toDate;
      if (!facilityId || !from || !to) {
        setError("Please provide facility ID and date range");
        return;
      }

      setLoading(true);
      setError("");

      _postApi(
        `/accounting/income-statement`,
        {
          facilityId,
          fromDate: from,
          toDate: to,
        },
        (response) => {
          setLoading(false);
          if (response.success && response.data) {
            setReportData(response.data);
            if (params.saveAfterRun && params.reportName?.trim()) {
              _postApi(
                "/accounting/custom-reports",
                {
                  title: params.reportName.trim(),
                  description: `Income Statement ${from} to ${to}`,
                  report_type: "income_statement",
                  config_json: {
                    kind: "income_statement",
                    fromDate: from,
                    toDate: to,
                    route: `/app/reports/accounting-reports/aa_erp-income-statement`,
                    facilityId,
                  },
                  is_active: 1,
                },
                () => toast.success("Saved to Custom Reports"),
                () => toast.error("Could not save custom report")
              );
            }
          } else {
            setError(response.message || "Failed to fetch income statement data");
          }
        },
        (err) => {
          setLoading(false);
          console.error("Income Statement Error:", err);
          setError("An error occurred while fetching income statement data");
        }
      );
    },
    [facilityId, fromDate, toDate]
  );

  // Fetch data when dates change
  const fetchProfitLossSummary = useCallback(() => {
    if (!facilityId || !fromDate || !toDate) return;

    setPlsLoading(true);
    _postApi(
      "/accounting/profit-loss-summary",
      {
        facilityId,
        dateFrom: fromDate,
        dateTo: toDate,
      },
      (response) => {
        setPlsLoading(false);
        if (response.success && response.data) {
          setPlsReport(response.data);
        } else {
          setPlsReport(null);
          if (templateView) {
            toast.error(response.message || "Failed to load P&L Summary");
          }
        }
      },
      (err) => {
        setPlsLoading(false);
        setPlsReport(null);
        if (templateView) {
          toast.error("Error loading P&L Summary");
        }
        console.error("P&L Summary Error:", err);
      }
    );
  }, [facilityId, fromDate, toDate, templateView]);

  useEffect(() => {
    if (fromDate && toDate && facilityId) {
      fetchIncomeStatementData();
      if (templateView) {
        fetchProfitLossSummary();
      }
    }
  }, [
    fromDate,
    toDate,
    facilityId,
    templateView,
    fetchIncomeStatementData,
    fetchProfitLossSummary,
  ]);

  useEffect(() => {
    if (templateView && fromDate && toDate && facilityId && !plsReport && !plsLoading) {
      fetchProfitLossSummary();
    }
  }, [templateView, fromDate, toDate, facilityId, plsReport, plsLoading, fetchProfitLossSummary]);

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
    setConfigureOpen(true);
  };

  const handleGenerateFromModal = () => {
    fetchIncomeStatementData({
      fromDate,
      toDate,
      reportName,
      saveAfterRun,
    });
    if (templateView) {
      fetchProfitLossSummary();
    }
    setConfigureOpen(false);
  };

  const goToNotesPage = useCallback(
    (noteRef) => {
      if (!fromDate || !toDate) {
        toast.error("Set report period before opening notes.");
        return;
      }
      navigate(buildIncomeStatementNotesUrl(fromDate, toDate, noteRef), {
        state: { fromDate, toDate, reportData },
      });
    },
    [navigate, fromDate, toDate, reportData]
  );

  const renderNoteLinks = (notes) => {
    const list = (notes || []).filter(
      (n) => n.noteRef !== null && n.noteRef !== undefined && n.noteRef !== "",
    );
    if (!list.length) return null;
    return list.map((n, i) => (
      <Fragment key={`${n.noteRef}-${i}`}>
        {i > 0 && ", "}
        <button
          type="button"
          onClick={() => goToNotesPage(n.noteRef)}
          className="text-blue-700 underline font-medium hover:text-blue-900"
        >
          {n.noteRef}
        </button>
      </Fragment>
    ));
  };

  const hasData = !!reportData?.incomeStatement;
  const rawStatement = reportData?.incomeStatement || {};
  const totals = rawStatement?.totals || {};
  const allNotes = Array.isArray(reportData?.notes) ? reportData.notes : [];

  const notesBySection = allNotes.reduce((acc, note) => {
    const key = String(note?.isSection || "").toLowerCase();
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      description: note?.title || note?.description || "",
      noteRef: note?.noteRef ?? null,
      total: Number(note?.total || 0),
      items: note?.items || [],
    });
    return acc;
  }, {});
  const statement = {
    ...rawStatement,
    turnover: {
      total: Number(totals.turnover ?? rawStatement?.turnover?.total ?? 0),
      notes: notesBySection.turnover || rawStatement?.turnover?.notes || [],
    },
    otherIncome: {
      total: Number(totals.otherIncome ?? rawStatement?.otherIncome?.total ?? 0),
      notes: notesBySection.other_income || rawStatement?.otherIncome?.notes || [],
    },
    costOfSales: {
      total: Number(totals.costOfSales ?? rawStatement?.costOfSales?.total ?? 0),
      notes: notesBySection.cost_of_sales || rawStatement?.costOfSales?.notes || [],
    },
    administrativeCosts: {
      total: Number(
        totals.administrativeCosts ?? rawStatement?.administrativeCosts?.total ?? 0
      ),
      notes: notesBySection.admin_costs || rawStatement?.administrativeCosts?.notes || [],
    },
    interestPayable: {
      total: Number(totals.interestPayable ?? rawStatement?.interestPayable?.total ?? 0),
      notes: notesBySection.interest || rawStatement?.interestPayable?.notes || [],
    },
    taxation: {
      total: Number(totals.taxation ?? rawStatement?.taxation?.total ?? 0),
      notes: notesBySection.taxes || rawStatement?.taxation?.notes || [],
    },
    grossProfit: Number(totals.grossProfit ?? rawStatement?.grossProfit ?? 0),
    operatingProfit: Number(totals.operatingProfit ?? rawStatement?.operatingProfit ?? 0),
    profitBeforeTax: Number(totals.profitBeforeTax ?? rawStatement?.profitBeforeTax ?? 0),
    profitAfterTax: Number(totals.profitAfterTax ?? rawStatement?.profitAfterTax ?? 0),
  };
  const perShareData =
    rawStatement?.perShareData || reportData?.perShareData || {};
  const epsKoboRaw =
    perShareData?.earningsPerShare?.valueKobo ??
    perShareData?.earningsPerShareKobo;
  const epsKobo =
    epsKoboRaw != null && epsKoboRaw !== "" ? Number(epsKoboRaw) : null;
  const numberOfShares = Number(perShareData?.numberOfShares || 0);
  const title =
    reportData?.meta?.title || "STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME";
  const currentYearLabel = moment(toDate).format("YYYY");
  const priorYearLabel = moment(toDate).subtract(1, "year").format("YYYY");

  const handleExportExcel = useCallback(async () => {
    if (!reportData) {
      toast.error("No report data to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Income Statement");
      ws.columns = [{ width: 48 }, { width: 14 }, { width: 18 }, { width: 18 }];

      let r = 1;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name || activeBusiness?.name || "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = title;
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

      const refs = (notes) =>
        (notes || [])
          .map((n) => n.noteRef)
          .filter((n) => n !== null && n !== undefined && n !== "")
          .join(", ");

      const pushHeadRow = (label, amount, notes = [], bold = false) => {
        ws.getCell(r, 1).value = label;
        ws.getCell(r, 1).font = { bold };
        ws.getCell(r, 2).value = refs(notes);
        ws.getCell(r, 3).value = Number(amount || 0);
        ws.getCell(r, 3).font = { bold };
        ws.getCell(r, 3).numFmt = "#,##0.00";
        r++;
      };

      pushHeadRow("Turnover", statement.turnover?.total, statement.turnover?.notes);
      pushHeadRow("Cost of Sales", statement.costOfSales?.total, statement.costOfSales?.notes);
      pushHeadRow("Gross Profit", statement.grossProfit, [], true);
      pushHeadRow("Other Income", statement.otherIncome?.total, statement.otherIncome?.notes);
      pushHeadRow(
        "Administrative Costs",
        statement.administrativeCosts?.total,
        statement.administrativeCosts?.notes
      );
      pushHeadRow("Operating Profit", statement.operatingProfit, [], true);
      pushHeadRow(
        "Interest Payable and Similar Charges",
        statement.interestPayable?.total,
        statement.interestPayable?.notes
      );
      ws.getCell(r, 1).value = "Profit Before Tax";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).value = Number(statement.profitBeforeTax || 0);
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      r++;
      ws.getCell(r, 1).value = "PROFIT OR LOSS ACCOUNT";
      ws.getCell(r, 1).font = { bold: true };
      r++;
      ws.getCell(r, 1).value = "Taxation";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 2).value = refs(statement.taxation?.notes || []);
      ws.getCell(r, 3).value = Number(statement.taxation?.total || 0);
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      r++;

      ws.getCell(r, 1).value = "Profit/(Loss) on ordinary activities after taxation";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 3).value = Number(statement.profitAfterTax || 0);
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 3).numFmt = "#,##0.00";
      r += 2;
      ws.getCell(r, 1).value = "Per share data (Kobo):";
      ws.getCell(r, 1).font = { bold: true };
      r++;
      ws.getCell(r, 1).value = "Earnings per share";
      ws.getCell(r, 3).value =
        epsKobo != null ? Number(epsKobo) : "N/A (share capital not set up)";
      if (epsKobo != null) ws.getCell(r, 3).numFmt = "#,##0.000";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `income-statement-${toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [reportData, statement, title, activeBusiness, fromDate, toDate, currentYearLabel, priorYearLabel, epsKobo]);

  const handleExportPdf = useCallback(async () => {
    const mainEl = reportExportRef.current;
    if (!mainEl) {
      toast.error("Report is not ready to export");
      return;
    }
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(mainEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: mainEl.scrollWidth,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let y = 0;
      while (y < imgHeight) {
        if (y > 0) pdf.addPage("l", "mm", "a4");
        pdf.addImage(imgData, "PNG", 0, -y, pageWidth, imgHeight);
        y += pageHeight;
      }
      pdf.save(`income-statement-${toDate}.pdf`);
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
        <div className="bg-gray-100 px-2 py-2 mb-2 rounded-lg overflow-x-auto">
          <div className="flex w-full min-w-max flex-nowrap items-center justify-between gap-3">
            <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
              <label className="shrink-0 whitespace-nowrap text-sm font-semibold text-gray-700">
                Report period
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10 shrink-0 rounded border border-gray-300 bg-white px-2 text-sm"
              />
              <span className="shrink-0 text-gray-600">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-10 shrink-0 rounded border border-gray-300 bg-white px-2 text-sm"
              />
            </div>
            <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
            <div className="flex h-10 shrink-0 items-center gap-2 rounded border border-gray-300 bg-white px-3">
              <Label
                htmlFor="pls-summary-view"
                className="cursor-pointer whitespace-nowrap text-sm text-gray-700"
              >
                P&amp;L Summary
              </Label>
              <Switch
                id="pls-summary-view"
                checked={templateView}
                onCheckedChange={setTemplateView}
              />
            </div>
            {!templateView && hasData && allNotes.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 shrink-0 border-gray-300 whitespace-nowrap"
                onClick={() => goToNotesPage()}
              >
                Notes to Income Statement
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              size="lg"
              className="h-10 shrink-0"
              onClick={() => navigate("/app/reports/accounting-reports")}
            >
              <X className="h-4 w-4" />
              Close
            </Button>
            <button
              type="button"
              className="h-10 shrink-0 whitespace-nowrap rounded border border-gray-300 bg-white px-4 text-sm hover:bg-gray-50"
              onClick={handleRunReport}
              disabled={loading || plsLoading}
            >
              {loading || plsLoading ? (
                <>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
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
                  className="h-10 shrink-0 border-gray-300"
                  disabled={
                    (templateView ? !plsReport : !hasData) || loading || plsLoading
                  }
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
        {(loading || (templateView && plsLoading)) && (
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

        {/* P&L Summary (template from PDF) */}
        {!loading &&
          !plsLoading &&
          !error &&
          templateView &&
          plsReport && (
            <div className="space-y-4" ref={reportExportRef}>
              <div className="mb-1">
                <BusinessDocumentHeader
                  business={activeBusiness}
                  title="Profit and Loss Summary"
                  numberLabel={`As at ${formatDate(toDate)}`}
                  extraLine={`Cumulative: ${formatDate(fromDate)} – ${formatDate(toDate)}`}
                  date={new Date()}
                  dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                  className="mb-0"
                />
              </div>
              <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm p-3">
                <ProfitLossSummaryTable report={plsReport} showExtendedSections />
              </div>
            </div>
          )}

        {!loading &&
          !plsLoading &&
          !error &&
          templateView &&
          !plsReport && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-600">
                No P&amp;L Summary data for this period. Check chart of accounts
                subcategories (sales, direct_materials, inventory, etc.).
              </p>
            </div>
          )}

        {/* Income Statement Report (IFRS) */}
        {!loading && !error && hasData && !templateView && (
          <>
          <div className="space-y-4" ref={reportExportRef}>
            {/* Business Header */}
            <div className="mb-1">
              <BusinessDocumentHeader
                business={activeBusiness}
                title={title}
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
                      <th className="px-3 py-2.5 text-center text-xs font-bold text-white uppercase border-r border-gray-500 w-28">
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
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900">Turnover</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200">
                        {renderNoteLinks(statement.turnover?.notes) || ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(statement.turnover?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200 text-gray-500">
                        —
                      </td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900">Cost of Sales</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200">
                        {renderNoteLinks(statement.costOfSales?.notes) || ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(statement.costOfSales?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200 text-gray-500">—</td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Gross Profit</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(statement.grossProfit || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300 text-gray-500">—</td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900 font-semibold">Other Income</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200">
                        {renderNoteLinks(statement.otherIncome?.notes) || ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(statement.otherIncome?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200 text-gray-500">—</td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900 font-semibold">Administrative Costs</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200">
                        {renderNoteLinks(statement.administrativeCosts?.notes) || ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(statement.administrativeCosts?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200 text-gray-500">—</td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Operating Profit</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(statement.operatingProfit || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300 text-gray-500">—</td>
                    </tr>

                    <tr className="bg-white border-b border-gray-200 hover:bg-gray-50/70">
                      <td className="px-3 py-1.5 text-gray-900 font-semibold">Interest Payable and Similar Charges</td>
                      <td className="px-3 py-1.5 text-center text-xs text-gray-600 border-l border-gray-200">
                        {renderNoteLinks(statement.interestPayable?.notes) || ""}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200">
                        {formatCurrency(parseFloat(statement.interestPayable?.total || 0))}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums border-l border-gray-200 text-gray-500">—</td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Profit Before Tax</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(statement.profitBeforeTax || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300 text-gray-500">—</td>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-300">
                      <td className="px-3 py-1.5 text-gray-900 font-semibold uppercase tracking-wide">
                        Profit or Loss Account
                      </td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                      <td className="px-3 py-1.5 border-l border-gray-200"></td>
                    </tr>
                    <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                      <td className="px-3 py-2 text-gray-900">Taxation</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300">
                        {renderNoteLinks(statement.taxation?.notes) || ""}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {formatCurrency(parseFloat(statement.taxation?.total || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300 text-gray-500">—</td>
                    </tr>

                    <tr className="bg-gray-200 font-bold border-t-2 border-b-2 border-gray-600">
                      <td className="px-3 py-2 text-gray-900">
                        Profit/(Loss) on ordinary activities after taxation
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums border-l border-gray-300 ${
                          parseFloat(statement.profitAfterTax || 0) >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(parseFloat(statement.profitAfterTax || 0))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300 text-gray-500">
                        —
                      </td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200">
                      <td className="px-3 py-2 font-semibold text-gray-900">Per share data (Kobo):</td>
                      <td className="px-3 py-2 border-l border-gray-300"></td>
                      <td className="px-3 py-2 border-l border-gray-300"></td>
                      <td className="px-3 py-2 border-l border-gray-300"></td>
                    </tr>
                    <tr className="bg-white border-b border-gray-200">
                      <td className="px-3 py-2 text-gray-900">Earnings per share</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 border-l border-gray-300"></td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300">
                        {epsKobo != null ? (
                          formatCurrency(epsKobo)
                        ) : (
                          <span
                            className="text-gray-500 text-xs"
                            title={
                              numberOfShares <= 0
                                ? "Post share capital in equity (subcategory share_capital) or name accounts Share Capital"
                                : undefined
                            }
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums border-l border-gray-300 text-gray-500">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 w-full border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-700">
                The accounting policies and{" "}
                <button
                  type="button"
                  onClick={() => goToNotesPage()}
                  className="text-blue-700 underline font-medium hover:text-blue-900"
                >
                  accompanying notes
                </button>{" "}
                form part of these financial statements.
                {allNotes.length > 0 && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => goToNotesPage()}
                      className="text-blue-700 underline font-semibold hover:text-blue-900"
                    >
                      View Notes to the Income Statement →
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          </>
        )}

        {/* Empty State */}
        {!loading && !plsLoading && !error && !hasData && !templateView && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">
              No income statement data found for the selected period.
            </p>
          </div>
        )}
      </div>

      <Dialog open={configureOpen} onOpenChange={setConfigureOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Report</DialogTitle>
            <DialogDescription>
              Set report details before generating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="income-report-name">Report Name</Label>
              <Input
                id="income-report-name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="e.g. Monthly Income Statement"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="income-from">From Date</Label>
                <Input
                  id="income-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="income-to">To Date</Label>
                <Input
                  id="income-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="income-save-custom"
                checked={saveAfterRun}
                onCheckedChange={(v) => setSaveAfterRun(Boolean(v))}
              />
              <Label htmlFor="income-save-custom">Save to Custom Reports</Label>
            </div>
            <Button onClick={handleGenerateFromModal} disabled={loading} className="w-full">
              {loading ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedNote?.noteRef ? `Note ${selectedNote.noteRef}` : "Note Details"}
            </DialogTitle>
            <DialogDescription>
              {selectedNote?.title || selectedNote?.description || "Income statement note"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">Account Code</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Amount (₦)</th>
                </tr>
              </thead>
              <tbody>
                {(selectedNote?.items || []).map((item, idx) => (
                  <tr key={`${item.accountCode || idx}`} className="border-b">
                    <td className="px-3 py-1.5">{item.accountCode || "—"}</td>
                    <td className="px-3 py-1.5">{item.name || "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatCurrency(item.amount || 0)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(selectedNote?.total || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AaErpIncomeStatement;
