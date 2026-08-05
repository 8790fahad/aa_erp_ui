import { useState, useEffect, useCallback, useRef } from "react";import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  X,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
} from "lucide-react";
import moment from "moment";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  const v = Number(value);
  if (Number.isNaN(v)) return "—";
  if (Math.abs(v) < 0.005) return "—";
  if (v < 0) return `(${formatNumber1(Math.abs(v))})`;
  return formatNumber1(v);
}

function formatReportDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function InventoryValuationReport() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;
  const business = activeBusiness || {};
  const businessName =
    business.business_name || business.name || "Company";

  // Map business inv_ev_m to API method string
  const businessMethod = (() => {
    const m = business.inv_ev_m || "";
    if (m === "Weighted Average Cost") return "AVCO";
    if (m === "LIFO") return "LIFO";
    return "FIFO"; // default
  })();

  const [asOfDate, setAsOfDate] = useState(moment().format("YYYY-MM-DD"));
  const [valuationMethod, setValuationMethod] = useState(businessMethod);
  const [itemTypeFilter, setItemTypeFilter] = useState("raw"); // "raw" | "finished"
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = useRef(null);

  const fetchReport = useCallback(() => {
    if (!facilityId || !asOfDate) {
      setError("Select a facility and date.");
      return;
    }
    setLoading(true);
    setError("");
    _postApi(
      "/api/reports/inventory-valuation",
      { facilityId, asOfDate, valuationMethod },
      (response) => {
        setLoading(false);
        if (response.success && response.data) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to load inventory report");
        }
      },
      () => {
        setLoading(false);
        setError("Could not load inventory valuation report.");
      }
    );
  }, [facilityId, asOfDate, valuationMethod]);

  // Only auto-fetch once on mount if we have the required data
  const hasFetchedOnMount = useRef(false);
  useEffect(() => {
    if (facilityId && asOfDate && !hasFetchedOnMount.current) {
      hasFetchedOnMount.current = true;
      fetchReport();
    }
  }, [facilityId, asOfDate, fetchReport]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExportExcel = useCallback(async () => {
    if (!data) { toast.error("No report data to export"); return; }
    try {
      const wb = new ExcelJS.Workbook();
      const borderThin = {
        top: { style: "thin" }, left: { style: "thin" },
        bottom: { style: "thin" }, right: { style: "thin" },
      };
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      const sectionFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };

      // ── Raw Materials sheet ──
      const wsRaw = wb.addWorksheet("Raw Materials");
      wsRaw.columns = [
        { width: 32 }, { width: 14 }, { width: 12 }, { width: 14 },
        { width: 14 }, { width: 16 }, { width: 18 }, { width: 20 },
      ];
      let r = 1;
      wsRaw.mergeCells(r, 1, r, 8);
      wsRaw.getCell(r, 1).value = businessName;
      wsRaw.getCell(r, 1).font = { bold: true, size: 14 };
      wsRaw.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      wsRaw.mergeCells(r, 1, r, 8);
      wsRaw.getCell(r, 1).value = "INVENTORY VALUATION REPORT — RAW MATERIALS";
      wsRaw.getCell(r, 1).font = { bold: true, size: 12 };
      wsRaw.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      wsRaw.mergeCells(r, 1, r, 8);
      wsRaw.getCell(r, 1).value = `As of ${moment(asOfDate).format("DD MMMM YYYY")}  |  Method: ${valuationMethod}`;
      wsRaw.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const rawHeaders = ["Item Name", "SKU", "Unit", "Qty on Hand", "Unit Cost (₦)", "Total Value (₦)", "Reorder Level", "Stock Status"];
      rawHeaders.forEach((h, i) => {
        const c = wsRaw.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = sectionFill;
        c.border = borderThin;
        c.alignment = i >= 3 ? { horizontal: "right" } : { horizontal: "left" };
      });
      r++;

      const rawItems = data.rawMaterials?.items || [];
      for (const item of rawItems) {
        wsRaw.getCell(r, 1).value = item.name || "";
        wsRaw.getCell(r, 2).value = item.sku || "";
        wsRaw.getCell(r, 3).value = item.unit || "";
        wsRaw.getCell(r, 4).value = Number(item.stock_qty) || 0;
        wsRaw.getCell(r, 5).value = Number(item.unit_cost) || 0;
        wsRaw.getCell(r, 6).value = Number(item.total_value) || 0;
        wsRaw.getCell(r, 7).value = Number(item.reorder_level) || 0;
        wsRaw.getCell(r, 8).value = item.stock_status || "";
        [5, 6].forEach((col) => { wsRaw.getCell(r, col).numFmt = "#,##0.00"; });
        [4, 5, 6, 7].forEach((col) => { wsRaw.getCell(r, col).alignment = { horizontal: "right" }; });
        for (let col = 1; col <= 8; col++) wsRaw.getCell(r, col).border = borderThin;
        r++;
      }
      r++;
      wsRaw.getCell(r, 5).value = "TOTAL";
      wsRaw.getCell(r, 5).font = { bold: true };
      wsRaw.getCell(r, 6).value = Number(data.rawMaterials?.totalValue) || 0;
      wsRaw.getCell(r, 6).font = { bold: true };
      wsRaw.getCell(r, 6).numFmt = "#,##0.00";
      wsRaw.getCell(r, 6).alignment = { horizontal: "right" };
      [5, 6].forEach((col) => { wsRaw.getCell(r, col).border = borderThin; wsRaw.getCell(r, col).fill = headerFill; });

      // ── Finished Goods sheet ──
      const wsFG = wb.addWorksheet("Finished Goods");
      wsFG.columns = [
        { width: 32 }, { width: 16 }, { width: 14 }, { width: 14 },
        { width: 16 }, { width: 20 }, { width: 14 },
      ];
      r = 1;
      wsFG.mergeCells(r, 1, r, 7);
      wsFG.getCell(r, 1).value = businessName;
      wsFG.getCell(r, 1).font = { bold: true, size: 14 };
      wsFG.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      wsFG.mergeCells(r, 1, r, 7);
      wsFG.getCell(r, 1).value = "INVENTORY VALUATION REPORT — FINISHED GOODS";
      wsFG.getCell(r, 1).font = { bold: true, size: 12 };
      wsFG.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      wsFG.mergeCells(r, 1, r, 7);
      wsFG.getCell(r, 1).value = `As of ${moment(asOfDate).format("DD MMMM YYYY")}  |  Method: ${valuationMethod}`;
      wsFG.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const fgHeaders = ["Product Name", "Batch No.", "Qty", "Cost/Unit (₦)", "Total Value (₦)", "Warehouse", "Status"];
      fgHeaders.forEach((h, i) => {
        const c = wsFG.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = sectionFill;
        c.border = borderThin;
        c.alignment = i >= 2 ? { horizontal: "right" } : { horizontal: "left" };
      });
      r++;

      const fgItems = data.finishedGoods?.items || [];
      for (const item of fgItems) {
        wsFG.getCell(r, 1).value = item.product_name || "";
        wsFG.getCell(r, 2).value = item.batch_no || "";
        wsFG.getCell(r, 3).value = Number(item.quantity) || 0;
        wsFG.getCell(r, 4).value = Number(item.cost_per_unit) || 0;
        wsFG.getCell(r, 5).value = Number(item.total_value) || 0;
        wsFG.getCell(r, 6).value = item.warehouse_location || "";
        wsFG.getCell(r, 7).value = item.status || "";
        [4, 5].forEach((col) => { wsFG.getCell(r, col).numFmt = "#,##0.00"; });
        [3, 4, 5].forEach((col) => { wsFG.getCell(r, col).alignment = { horizontal: "right" }; });
        for (let col = 1; col <= 7; col++) wsFG.getCell(r, col).border = borderThin;
        r++;
      }
      r++;
      wsFG.getCell(r, 4).value = "TOTAL";
      wsFG.getCell(r, 4).font = { bold: true };
      wsFG.getCell(r, 5).value = Number(data.finishedGoods?.totalValue) || 0;
      wsFG.getCell(r, 5).font = { bold: true };
      wsFG.getCell(r, 5).numFmt = "#,##0.00";
      wsFG.getCell(r, 5).alignment = { horizontal: "right" };
      [4, 5].forEach((col) => { wsFG.getCell(r, col).border = borderThin; wsFG.getCell(r, col).fill = headerFill; });

      // ── Summary sheet ──
      const wsSummary = wb.addWorksheet("Summary");
      wsSummary.columns = [{ width: 36 }, { width: 22 }];
      r = 1;
      wsSummary.mergeCells(r, 1, r, 2);
      wsSummary.getCell(r, 1).value = businessName;
      wsSummary.getCell(r, 1).font = { bold: true, size: 14 };
      wsSummary.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      wsSummary.mergeCells(r, 1, r, 2);
      wsSummary.getCell(r, 1).value = "INVENTORY VALUATION SUMMARY";
      wsSummary.getCell(r, 1).font = { bold: true, size: 12 };
      wsSummary.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      wsSummary.mergeCells(r, 1, r, 2);
      wsSummary.getCell(r, 1).value = `As of ${moment(asOfDate).format("DD MMMM YYYY")}  |  Method: ${valuationMethod}`;
      wsSummary.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const summaryRows = [
        ["Raw Materials", data.summary?.rawMaterialsTotal],
        ["Finished Goods", data.summary?.finishedGoodsTotal],
        ["TOTAL INVENTORY VALUE", data.summary?.totalInventoryValue],
        ["", ""],
        ["Raw Materials Items", data.rawMaterials?.itemCount],
        ["Finished Goods Items", data.finishedGoods?.itemCount],
        ["Low Stock Alerts", data.summary?.lowStockItems],
      ];
      summaryRows.forEach(([label, value]) => {
        if (!label) { r++; return; }
        const isTotal = label.startsWith("TOTAL");
        wsSummary.getCell(r, 1).value = label;
        wsSummary.getCell(r, 2).value = typeof value === "number" ? value : (Number(value) || 0);
        if (isTotal) {
          wsSummary.getRow(r).font = { bold: true };
          wsSummary.getCell(r, 2).numFmt = "#,##0.00";
          [1, 2].forEach((col) => { wsSummary.getCell(r, col).fill = headerFill; });
        } else if (typeof value === "number" || !Number.isNaN(Number(value))) {
          const isCount = ["Items", "Alerts"].some((k) => label.includes(k));
          if (!isCount) wsSummary.getCell(r, 2).numFmt = "#,##0.00";
        }
        wsSummary.getCell(r, 2).alignment = { horizontal: "right" };
        [1, 2].forEach((col) => wsSummary.getCell(r, col).border = borderThin);
        r++;
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Inventory-Valuation-${asOfDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel file downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [data, businessName, asOfDate, valuationMethod]);

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    const el = reportExportRef.current;
    if (!el) { toast.error("Report is not ready to export"); return; }
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, windowWidth: el.scrollWidth });
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
      pdf.save(`Inventory-Valuation-${asOfDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [asOfDate]);

  // ── Render ────────────────────────────────────────────────────────────────
  const summary = data?.summary || {};
  // Filter out zero-qty items before rendering
  const rawItems = (data?.rawMaterials?.items || []).filter(
    (item) => parseFloat(item.stock_qty) > 0
  );
  const fgItems = (data?.finishedGoods?.items || []).filter(
    (item) => parseFloat(item.quantity) > 0
  );
  // Both tables always visible; filter only hides one when a specific type is selected
  const showRaw = itemTypeFilter !== "finished";
  const showFinished = itemTypeFilter !== "raw";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0; box-shadow: none; }
          @page { margin: 8mm; size: A4 portrait; }
          html, body { background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-1 print:bg-white print:p-0">
        <div className="max-w-7xl mx-auto">

          {/* ── Controls bar ── */}
          <div className="bg-gray-100 rounded-lg no-print px-2 py-2 mb-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:flex-wrap">
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                <div className="flex min-w-[12rem] flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-700">As of Date</label>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                  />
                </div>
                <div className="flex min-w-[11rem] flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-700">
                    Valuation Method
                    {business.inv_ev_m && (
                      <span className="ml-1 text-xs text-gray-400 font-normal">(business default)</span>
                    )}
                  </label>
                  <select
                    value={valuationMethod}
                    onChange={(e) => setValuationMethod(e.target.value)}
                    className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                  >
                    <option value="FIFO">FIFO</option>
                    <option value="LIFO">LIFO</option>
                    <option value="AVCO">Weighted Average (AVCO)</option>
                  </select>
                </div>
                <div className="flex min-w-[11rem] flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-700">Show</label>
                  <select
                    value={itemTypeFilter}
                    onChange={(e) => setItemTypeFilter(e.target.value)}
                    className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                  >
                    <option value="raw">Raw Materials</option>
                    <option value="finished">Finished Goods</option>
                  </select>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="h-10"
                  onClick={() => navigate("/app/reports/accounting-reports")}
                >
                  <X className="h-4 w-4 shrink-0" />
                  Close
                </Button>
                <button
                  type="button"
                  onClick={fetchReport}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading</>
                  ) : "Run report"}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="lg" className="h-10 border-gray-300" disabled={!data || loading}>
                      Export
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="cursor-pointer" disabled={!data || loading} onClick={handleExportExcel}>
                      <FileSpreadsheet className="h-4 w-4 shrink-0" />
                      Export Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" disabled={!data || loading || pdfExporting} onClick={handleExportPdf}>
                      {pdfExporting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FileDown className="h-4 w-4 shrink-0" />}
                      Export PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-4 text-red-800 no-print">{error}</div>
          )}
          {loading && !data && (
            <div className="text-center py-12 text-gray-500">Loading…</div>
          )}

          {data && (
            <div ref={reportExportRef} className="print-content">

              {/* ── Blue header band ── */}
              <BusinessDocumentHeader
                business={business}
                title="INVENTORY VALUATION REPORT"
                numberLabel={`As of ${formatReportDate(asOfDate)}`}
                extraLine={`Method: ${valuationMethod}`}
                date={new Date()}
                dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                className="mb-0"
              />

              {/* ── Summary cards (commented out — data shown in tables below) ── */}
              {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-3">
                {[
                  { label: "Total Inventory Value", value: summary.totalInventoryValue, highlight: true },
                  { label: "Raw Materials", value: summary.rawMaterialsTotal },
                  { label: "Finished Goods", value: summary.finishedGoodsTotal },
                  { label: "Low Stock Alerts", value: summary.lowStockItems, isCount: true, warn: summary.lowStockItems > 0 },
                ].map(({ label, value, highlight, isCount, warn }) => (
                  <div key={label} className={`rounded border px-4 py-3 ${highlight ? "bg-blue-900 text-white border-blue-800" : warn ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${highlight ? "text-blue-200" : warn ? "text-red-600" : "text-gray-500"}`}>{label}</p>
                    <p className={`text-xl font-bold mt-1 tabular-nums ${highlight ? "text-white" : warn ? "text-red-700" : "text-gray-900"}`}>
                      {isCount ? (value ?? 0) : `₦${formatNumber1(value || 0)}`}
                    </p>
                  </div>
                ))}
              </div> */}

              {/* ── Raw Materials table ── */}
              {showRaw && (
              <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm mb-4">
                <div className="bg-gray-600 px-3 py-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                    Raw Materials — {data.rawMaterials?.itemCount ?? 0} items
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        {["Item Name", "SKU", "Unit", "Qty on Hand", "Unit Cost (₦)", "Total Value (₦)"].map((h, i) => (
                          <th key={h} className={`px-3 py-2 text-xs font-bold text-gray-700 uppercase border-r border-gray-200 ${i >= 3 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawItems.length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">No raw materials found</td></tr>
                      ) : rawItems.map((item, idx) => (
                        <tr key={item.id ?? idx} className="border-b border-gray-100 hover:bg-gray-50/80">
                          <td className="px-3 py-1.5 text-gray-900 border-r border-gray-100">{item.name}</td>
                          <td className="px-3 py-1.5 text-gray-600 border-r border-gray-100 text-xs">{item.sku || "—"}</td>
                          <td className="px-3 py-1.5 text-gray-600 border-r border-gray-100">{item.unit || "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums border-r border-gray-100">{formatCell(item.stock_qty)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums border-r border-gray-100">{formatCell(item.unit_cost)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold border-r border-gray-100">{formatCell(item.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-400">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 font-bold text-gray-900 text-right border-r border-gray-200">Total Raw Materials</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-900 border-r border-gray-200">
                          ₦{formatNumber1(data.rawMaterials?.totalValue || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              )}

              {/* ── Finished Goods table ── */}
              {showFinished && (
              <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm mb-4">
                <div className="bg-gray-600 px-3 py-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                    Finished Goods — {data.finishedGoods?.itemCount ?? 0} items
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        {["Product Name", "SKU / Batch", "Unit", "Qty", "Cost/Unit (₦)", "Total Value (₦)"].map((h, i) => (
                          <th key={h} className={`px-3 py-2 text-xs font-bold text-gray-700 uppercase border-r border-gray-200 ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fgItems.length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-sm">No finished goods found</td></tr>
                      ) : fgItems.map((item, idx) => (
                        <tr key={item.id ?? idx} className="border-b border-gray-100 hover:bg-gray-50/80">
                          <td className="px-3 py-1.5 text-gray-900 border-r border-gray-100">{item.product_name}</td>
                          <td className="px-3 py-1.5 text-gray-600 text-xs border-r border-gray-100">{item.batch_no || "—"}</td>
                          <td className="px-3 py-1.5 text-gray-600 border-r border-gray-100">{item.unit || "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums border-r border-gray-100">{formatCell(item.quantity)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums border-r border-gray-100">{formatCell(item.cost_per_unit)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold border-r border-gray-100">{formatCell(item.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-400">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 font-bold text-gray-900 text-right border-r border-gray-200">Total Finished Goods</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-900 border-r border-gray-200">
                          ₦{formatNumber1(data.finishedGoods?.totalValue || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              )}

              {/* ── Grand total footer ── */}
              {/* <div className="bg-blue-900 text-white rounded-sm px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wide">Total Inventory Value</span>
                <span className="text-xl font-bold tabular-nums">₦{formatNumber1(summary.totalInventoryValue || 0)}</span>
              </div> */}

              <div className="mt-2 text-xs text-gray-500 text-right">
                Generated: {data.reportInfo?.generatedAt} | Method: {data.reportInfo?.valuationMethod}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
