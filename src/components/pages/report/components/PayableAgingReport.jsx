import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronDown, FileDown, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import moment from "moment";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { aggregateSupplierAgingFromInvoices } from "../utils/payableAgingFromInvoices";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import PayableAgingSummaryTable from "./PayableAgingSummaryTable";

export default function PayableAgingReport() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [asAtDate, setAsAtDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const lastAutoFetchFacility = useRef(null);
  const reportExportRef = useRef(null);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setAsAtDate(today);
  }, []);

  const formatCurrency = (amount) => formatNumber1(amount);

  const fetchAllOutstandingPayables = useCallback(() => {
    if (!facilityId) {
      toast.error("No active business");
      return;
    }
    setLoading(true);
    setError("");
    _fetchApi(
      `/api/v1/get-outstanding-payable-invoices?facilityId=${encodeURIComponent(
        facilityId,
      )}`,
      (response) => {
        setLoading(false);
        if (response?.success && Array.isArray(response.results)) {
          setInvoices(response.results);
        } else {
          setInvoices([]);
          toast.error(
            response?.message || "Unable to load outstanding payable invoices",
          );
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        setInvoices([]);
        setError("Unable to load outstanding payable invoices");
        toast.error("Unable to load outstanding payable invoices");
      },
    );
  }, [facilityId]);

  useEffect(() => {
    if (!facilityId) return;
    if (lastAutoFetchFacility.current === facilityId) return;
    lastAutoFetchFacility.current = facilityId;
    fetchAllOutstandingPayables();
  }, [facilityId, fetchAllOutstandingPayables]);

  const { rows, totals } = useMemo(
    () => aggregateSupplierAgingFromInvoices(invoices, asAtDate),
    [invoices, asAtDate],
  );

  const handleRunReport = () => {
    fetchAllOutstandingPayables();
  };

  const handleExportExcel = useCallback(async () => {
    if (!rows.length) {
      toast.error("No rows to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("AP Aging");
      ws.columns = [
        { width: 36 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
      ];
      let r = 1;
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name || activeBusiness?.name || "Business";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value = "Accounts Payable Aging Report";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value = `As at: ${moment(asAtDate).format("DD/MM/YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = [
        "Supplier",
        "Current",
        "1-30 days",
        "31-60 days",
        "61+ days",
        "Total",
      ];
      headers.forEach((h, i) => {
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

      const numStyle = { numFmt: "#,##0.00" };
      for (const row of rows) {
        ws.getCell(r, 1).value = `${row.supplierName} (${row.supplierNo})`;
        ws.getCell(r, 2).value = row.current;
        ws.getCell(r, 2).numFmt = numStyle.numFmt;
        ws.getCell(r, 3).value = row.d1_30;
        ws.getCell(r, 3).numFmt = numStyle.numFmt;
        ws.getCell(r, 4).value = row.d31_60;
        ws.getCell(r, 4).numFmt = numStyle.numFmt;
        ws.getCell(r, 5).value = row.d61_plus;
        ws.getCell(r, 5).numFmt = numStyle.numFmt;
        ws.getCell(r, 6).value = row.total;
        ws.getCell(r, 6).numFmt = numStyle.numFmt;
        ws.getCell(r, 6).font = { bold: true };
        r++;
      }
      ws.getCell(r, 1).value = "Totals";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 2).value = totals.current;
      ws.getCell(r, 2).numFmt = numStyle.numFmt;
      ws.getCell(r, 2).font = { bold: true };
      ws.getCell(r, 3).value = totals.d1_30;
      ws.getCell(r, 3).numFmt = numStyle.numFmt;
      ws.getCell(r, 3).font = { bold: true };
      ws.getCell(r, 4).value = totals.d31_60;
      ws.getCell(r, 4).numFmt = numStyle.numFmt;
      ws.getCell(r, 4).font = { bold: true };
      ws.getCell(r, 5).value = totals.d61_plus;
      ws.getCell(r, 5).numFmt = numStyle.numFmt;
      ws.getCell(r, 5).font = { bold: true };
      ws.getCell(r, 6).value = totals.total;
      ws.getCell(r, 6).numFmt = numStyle.numFmt;
      ws.getCell(r, 6).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ap-aging-${asAtDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [rows, totals, activeBusiness, asAtDate]);

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
      pdf.save(`ap-aging-${asAtDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [asAtDate]);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0px; box-shadow: none; }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-1">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="bg-gray-100 rounded-lg px-2 py-2 no-print">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div>
                <label className="text-xs text-gray-600 block mb-1">
                  As at (aging date)
                </label>
                <input
                  type="date"
                  className="border rounded px-2 py-2 text-sm bg-white"
                  value={asAtDate}
                  onChange={(e) => setAsAtDate(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleRunReport}
                  disabled={loading || !facilityId}
                >
                  {loading ? (
                    <>
                      <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Run report"
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-gray-300"
                      disabled={!rows.length || loading}
                    >
                      Export
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={!rows.length || loading}
                      onClick={() => handleExportExcel()}
                    >
                      <FileSpreadsheet className="h-4 w-4 shrink-0" />
                      Export Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={!rows.length || loading || pdfExporting}
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
          </div>

          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div
              ref={reportExportRef}
              className="print-content bg-white border rounded-md overflow-hidden"
            >
              <BusinessDocumentHeader
                business={activeBusiness}
                title="Accounts Payable Aging Report"
                numberLabel={`As at: ${moment(asAtDate).format("DD/MM/YYYY")}`}
                date={new Date()}
                dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                className="mb-0"
              />

              {rows.length === 0 ? (
                <div className="px-3 py-12 text-center text-sm text-gray-500">
                  No outstanding payables for this facility, or all bills are
                  fully paid.
                </div>
              ) : (
                <PayableAgingSummaryTable
                  rows={rows}
                  totals={totals}
                  formatCurrency={formatCurrency}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
