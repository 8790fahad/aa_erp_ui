import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, X, FileSpreadsheet, FileDown, ChevronDown } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
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

export default function InventriaEquityChanges() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = useRef(null);

  useEffect(() => {
    const today = moment().format("YYYY-MM-DD");
    const yStart = moment().startOf("year").format("YYYY-MM-DD");
    setFromDate(location.state?.fromDate || yStart);
    setToDate(location.state?.toDate || today);
  }, [location.state]);

  const fetchReport = useCallback(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError("");
    _postApi(
      "/accounting/statement-of-changes-in-equity",
      { fromDate, toDate },
      (res) => {
        setLoading(false);
        if (res.success) setData(res.data);
        else setError(res.message || "Failed to load statement");
      },
      () => {
        setLoading(false);
        setError("Could not load statement");
      }
    );
  }, [fromDate, toDate]);

  useEffect(() => {
    if (facilityId && fromDate && toDate) fetchReport();
  }, [facilityId, fromDate, toDate, fetchReport]);

  const hasNewShape = Array.isArray(data?.columns) && Array.isArray(data?.periods);
  const columns = hasNewShape ? data.columns : [];
  const latestPeriod = hasNewShape
    ? [...data.periods].sort((a, b) => Number(a.year || 0) - Number(b.year || 0)).slice(-1)[0]
    : null;
  const periodRows = latestPeriod?.rows || [];

  const equityAccounts = data?.equityAccounts || [];
  const hasRows = hasNewShape ? periodRows.length > 0 : equityAccounts.length > 0;

  const openingByAccount = hasNewShape
    ? columns.map((c) => parseFloat(periodRows.find((r) => r.isOpening)?.values?.[c.subcategory] || 0))
    : equityAccounts.map((row) => parseFloat(row.opening_balance || 0));
  const movementByAccount = hasNewShape
    ? columns.map((c) => parseFloat(periodRows.find((r) => r.rowKey === "profit_for_year")?.values?.[c.subcategory] || 0))
    : equityAccounts.map((row) => parseFloat(row.period_movement || 0));
  const closingByAccount = hasNewShape
    ? columns.map((c) => parseFloat((data?.closingPosition?.values || periodRows.find((r) => r.isClosing)?.values || {})[c.subcategory] || 0))
    : equityAccounts.map((row) => parseFloat(row.closing_balance || 0));

  const sum = (arr) => arr.reduce((acc, value) => acc + value, 0);

  const handleExportExcel = useCallback(async () => {
    if (!data) {
      toast.error("No report data to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Statement of Changes in Equity");
      const excelCols = hasNewShape ? columns : equityAccounts;
      ws.columns = [{ width: 34 }, ...excelCols.map(() => ({ width: 20 })), { width: 18 }];

      let r = 1;
      ws.mergeCells(r, 1, r, excelCols.length + 2);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name || activeBusiness?.name || "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, excelCols.length + 2);
      ws.getCell(r, 1).value = "STATEMENT OF CHANGES IN EQUITY";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, excelCols.length + 2);
      ws.getCell(r, 1).value = `Period: ${moment(fromDate).format("DD/MM/YYYY")} - ${moment(toDate).format("DD/MM/YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = [
        "Particulars",
        ...excelCols.map((row) =>
          hasNewShape
            ? row.label || row.subcategory
            : row.account_name || row.account_code
        ),
        "Total",
      ];
      headers.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B5563" } };
      });
      r++;

      const addRow = (label, values, totalValue, bold = false) => {
        ws.getCell(r, 1).value = label;
        if (bold) ws.getCell(r, 1).font = { bold: true };
        values.forEach((v, idx) => {
          const c = ws.getCell(r, idx + 2);
          c.value = Number(v || 0);
          c.numFmt = "#,##0.00";
          if (bold) c.font = { bold: true };
        });
        const tc = ws.getCell(r, excelCols.length + 2);
        tc.value = Number(totalValue || 0);
        tc.numFmt = "#,##0.00";
        if (bold) tc.font = { bold: true };
        r++;
      };

      addRow(`Balance as at ${moment(fromDate).format("D MMMM YYYY")}`, openingByAccount, sum(openingByAccount));
      addRow("Movement for the year", movementByAccount, sum(movementByAccount));
      addRow(`Balance as at ${moment(toDate).format("D MMMM YYYY")}`, closingByAccount, sum(closingByAccount), true);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-of-changes-in-equity-${toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [
    data,
    hasNewShape,
    columns,
    equityAccounts,
    activeBusiness,
    fromDate,
    toDate,
    openingByAccount,
    movementByAccount,
    closingByAccount,
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
      pdf.save(`statement-of-changes-in-equity-${toDate}.pdf`);
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
        <div className="bg-gray-100 rounded-lg px-2 py-2 mb-2">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded bg-white"
              />
              <span className="text-gray-600">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded bg-white"
              />
              <button
                className="px-4 py-2 border border-gray-300 rounded bg-white hover:bg-gray-50"
                onClick={fetchReport}
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
            </div>
            <Button variant="destructive" className="h-10" onClick={() => navigate("/app/reports/accounting-reports")}>
              <X className="h-4 w-4 mr-1" />
              Close
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-10 border-gray-300"
                  disabled={!hasRows || loading}
                >
                  Export
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={!hasRows || loading}
                  onClick={() => handleExportExcel()}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={!hasRows || loading || pdfExporting}
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

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>
        ) : null}

        {data ? (
          <div
            ref={reportExportRef}
            className="bg-white border border-gray-300 rounded-sm shadow-sm overflow-hidden"
          >
            <BusinessDocumentHeader
              business={activeBusiness}
              title="Statement of Changes in Equity"
              numberLabel={`Period: ${moment(fromDate).format("DD/MM/YYYY")} - ${moment(toDate).format("DD/MM/YYYY")}`}
              date={new Date()}
              dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
              className="mb-0"
            />

            {hasRows ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-3 py-2 text-left min-w-[260px]">Particulars</th>
                      {(hasNewShape ? columns : equityAccounts).map((row) => (
                        <th
                          key={hasNewShape ? row.subcategory : row.account_code}
                          className="px-3 py-2 text-right whitespace-nowrap"
                        >
                          {hasNewShape ? row.label : row.account_name}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="px-3 py-2 font-medium">
                        Balance as at {moment(fromDate).format("D MMMM YYYY")}
                      </td>
                      {openingByAccount.map((value, idx) => (
                        <td key={`open-${idx}`} className="px-3 py-2 text-right tabular-nums">
                          {formatNumber1(value)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatNumber1(sum(openingByAccount))}
                      </td>
                    </tr>

                    <tr className="border-b border-gray-200">
                      <td className="px-3 py-2 font-medium">Movement for the year</td>
                      {movementByAccount.map((value, idx) => (
                        <td key={`move-${idx}`} className="px-3 py-2 text-right tabular-nums">
                          {formatNumber1(value)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatNumber1(sum(movementByAccount))}
                      </td>
                    </tr>

                    <tr className="bg-gray-100 font-semibold">
                      <td className="px-3 py-2">
                        Balance as at {moment(toDate).format("D MMMM YYYY")}
                      </td>
                      {closingByAccount.map((value, idx) => (
                        <td key={`close-${idx}`} className="px-3 py-2 text-right tabular-nums">
                          {formatNumber1(value)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber1(sum(closingByAccount))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-sm text-gray-600">
                No equity balances found for this period.
              </div>
            )}

            <p className="px-4 py-3 text-xs text-gray-600 border-t border-gray-200">
              The accounting policies and accompanying notes form part of these financial statements.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

