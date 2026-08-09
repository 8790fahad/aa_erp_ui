import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { _postApi } from "@/redux/actions/api";
import moment from "moment";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Loader2, X, ChevronDown, FileSpreadsheet, FileDown, RefreshCw,
  Users, Package, TrendingUp, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const APP_COLOR = "#1a2d5e"; // matches --aa-doc-header / --aa-navy

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtQty(v, dp = 2) {
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtPct(v) {
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toFixed(1)}%`;
}
function capitalize(s) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function yieldColor(pct) {
  if (pct >= 95) return "text-green-700";
  if (pct >= 80) return "text-amber-600";
  if (pct > 0) return "text-red-600";
  return "text-gray-400";
}
function yieldBg(pct) {
  if (pct >= 95) return "#16a34a";
  if (pct >= 80) return "#d97706";
  if (pct > 0) return "#dc2626";
  return "#9ca3af";
}

const STATUS_STYLE = {
  completed: "bg-green-100 text-green-800 border border-green-200",
  draft: "bg-amber-100 text-amber-800 border border-amber-200",
  cancelled: "bg-red-100 text-red-800 border border-red-200",
};

// ── Mini bar for yield ────────────────────────────────────────────────────
function YieldBar({ pct }) {
  const n = parseFloat(pct) || 0;
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(n, 100)}%`, backgroundColor: yieldBg(n) }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums w-12 text-right ${yieldColor(n)}`}>
        {fmtPct(n)}
      </span>
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="bg-white px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        {Icon && <Icon size={14} style={{ color: accent || APP_COLOR }} className="opacity-60" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div style={{ backgroundColor: APP_COLOR }} className="px-4 py-2 mt-4">
      <h2 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h2>
    </div>
  );
}

export default function OperatorProductionReport() {
  const navigate = useNavigate();
  const { activeBusiness } = useSelector((s) => s.auth);
  const facilityId = activeBusiness?.id;
  const business = activeBusiness || {};
  const businessName = business.business_name || business.name || "Company";

  const [fromDate, setFromDate] = useState(moment().subtract(30, "days").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(moment().format("YYYY-MM-DD"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportRef = useRef(null);

  const fetchReport = useCallback(() => {
    if (!facilityId) { setError("No active business selected."); return; }
    setLoading(true);
    setError("");
    _postApi(
      "/api/reports/production/operator-production",
      { facilityId, fromDate, toDate, status: statusFilter },
      (resp) => {
        setLoading(false);
        if (resp.success && resp.data) setData(resp.data);
        else setError(resp.message || "Failed to load report");
      },
      () => { setLoading(false); setError("Could not reach the server. Please try again."); }
    );
  }, [facilityId, fromDate, toDate, statusFilter]);

  useEffect(() => { fetchReport(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExportExcel = useCallback(async () => {
    if (!data?.rows?.length) { toast.error("No data to export"); return; }
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Production Report");
      const fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4267B2" } };
      const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

      ws.columns = [
        { width: 6 }, { width: 14 }, { width: 18 }, { width: 22 }, { width: 30 },
        { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 20 },
      ];

      let r = 1;
      ws.mergeCells(r, 1, r, 10);
      ws.getCell(r, 1).value = businessName;
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 10);
      ws.getCell(r, 1).value = "OPERATOR PRODUCTION REPORT";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 10);
      ws.getCell(r, 1).value = `Period: ${moment(fromDate).format("DD MMM YYYY")} – ${moment(toDate).format("DD MMM YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = ["#", "Date", "Batch No", "Production Line", "Products", "Good Qty", "Waste Qty", "Yield %", "Status", "Operator"];
      headers.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = fill;
        c.border = border;
        c.alignment = i >= 5 ? { horizontal: "right" } : { horizontal: "left" };
      });
      r++;

      data.rows.forEach((row, idx) => {
        ws.getCell(r, 1).value = idx + 1;
        ws.getCell(r, 2).value = row.date;
        ws.getCell(r, 3).value = row.batchNo;
        ws.getCell(r, 4).value = row.productionLine;
        ws.getCell(r, 5).value = row.products;
        ws.getCell(r, 6).value = row.goodQty || 0;
        ws.getCell(r, 7).value = row.wasteQty || 0;
        ws.getCell(r, 8).value = row.yieldPct || 0;
        ws.getCell(r, 9).value = capitalize(row.status);
        ws.getCell(r, 10).value = row.operator;
        [6, 7].forEach((c) => { ws.getCell(r, c).numFmt = "#,##0.00"; });
        [8].forEach((c) => { ws.getCell(r, c).numFmt = '0.0"%"'; });
        [6, 7, 8].forEach((c) => { ws.getCell(r, c).alignment = { horizontal: "right" }; });
        for (let c = 1; c <= 10; c++) ws.getCell(r, c).border = border;
        r++;
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `production-report-${fromDate}-to-${toDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) { console.error(e); toast.error("Could not export Excel"); }
  }, [data, businessName, fromDate, toDate]);

  // ── PDF export ──────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    const el = reportRef.current;
    if (!el) { toast.error("Report not ready"); return; }
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, windowWidth: el.scrollWidth });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -y, pageW, imgH);
        y += pageH;
      }
      pdf.save(`production-report-${fromDate}-to-${toDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) { console.error(e); toast.error("Could not generate PDF"); }
    finally { setPdfExporting(false); }
  }, [fromDate, toDate]);

  const rows = data?.rows || [];
  const summary = data?.summary || {};
  const byOperator = data?.byOperator || [];
  const byProduct = data?.byProduct || [];

  // Group rows by date for the main table
  const rowsByDate = rows.reduce((acc, row) => {
    const d = row.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(row);
    return acc;
  }, {});
  const sortedDates = Object.keys(rowsByDate).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0; box-shadow: none; }
          @page { margin: 8mm; size: A4 landscape; }
          html, body { background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 p-2 print:bg-white print:p-0">
        <div className="max-w-[1400px] mx-auto">

          {/* ── Controls ── */}
          <div className="no-print bg-white border border-gray-200 rounded-lg px-4 py-3 mb-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div className="flex flex-wrap items-end gap-3">
                {[
                  { label: "From", value: fromDate, set: setFromDate },
                  { label: "To", value: toDate, set: setToDate },
                ].map(({ label, value, set }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
                    <input
                      type="date" value={value}
                      onChange={(e) => set(e.target.value)}
                      className="h-9 rounded border border-gray-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2"
                      style={{ "--tw-ring-color": APP_COLOR }}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded border border-gray-300 bg-white px-2.5 text-sm"
                  >
                    <option value="all">All statuses</option>
                    <option value="completed">Completed</option>
                    <option value="draft">Draft</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <button
                  type="button" onClick={fetchReport} disabled={loading}
                  className="h-9 inline-flex items-center gap-2 rounded px-4 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: APP_COLOR }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate
                </button>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button type="button" variant="destructive" className="h-9"
                  onClick={() => navigate("/app/production/production-reports")}>
                  <X className="h-4 w-4" /> Back
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9" disabled={!data || loading}>
                      Export <ChevronDown className="h-4 w-4 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="cursor-pointer" onClick={handleExportExcel} disabled={!data || loading}>
                      <FileSpreadsheet className="h-4 w-4" /> Export Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={handleExportPdf} disabled={!data || loading || pdfExporting}>
                      {pdfExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      Export PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {error && (
            <div className="no-print bg-red-50 border border-red-200 rounded p-3 mb-3 text-red-800 text-sm">{error}</div>
          )}
          {loading && !data && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-500 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading production report…
            </div>
          )}

          {data && (
            <div ref={reportRef} className="print-content space-y-0">
              <BusinessDocumentHeader
                business={business}
                title="OPERATOR PRODUCTION REPORT"
                numberLabel={`${moment(fromDate).format("DD MMM YYYY")} – ${moment(toDate).format("DD MMM YYYY")}`}
                date={new Date()}
                dateFormat="ddd, DD MMM YYYY hh:mm A"
                className="mb-0"
              />

              {/* ── 6-card Summary ── */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-200 border border-gray-200 mb-0">
                <SummaryCard
                  label="Production Batches"
                  value={(summary.totalBatches ?? 0).toLocaleString()}
                  icon={Package}
                />
                <SummaryCard
                  label="Operators"
                  value={(summary.operatorCount ?? 0).toLocaleString()}
                  icon={Users}
                />
                <SummaryCard
                  label="Total Good Qty"
                  value={fmtQty(summary.totalGoodQty)}
                  sub="finished output"
                  icon={TrendingUp}
                  accent="#16a34a"
                />
                <SummaryCard
                  label="Total Waste Qty"
                  value={fmtQty(summary.totalWasteQty)}
                  sub="scrap / rejection"
                  icon={AlertTriangle}
                  accent={(summary.totalWasteQty || 0) > 0 ? "#d97706" : "#9ca3af"}
                />
                <SummaryCard
                  label="Total Output"
                  value={fmtQty(summary.totalOutput)}
                  sub="good + waste"
                />
                <SummaryCard
                  label="Avg Yield"
                  value={fmtPct(summary.avgYieldPct)}
                  sub="across all batches"
                  accent={yieldBg(summary.avgYieldPct)}
                />
              </div>

              {/* ── Operator Summary ── */}
              {byOperator.length > 0 && (
                <>
                  <SectionHeader title={`Operator Summary — ${byOperator.length} operator${byOperator.length !== 1 ? "s" : ""}`} />
                  <div className="bg-white border border-t-0 border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["#", "Operator", "Batches", "Good Qty", "Waste Qty", "Avg Yield"].map((h, i) => (
                            <th key={h}
                              className={`px-3 py-2 text-[11px] font-bold text-gray-600 uppercase tracking-wide border-r border-gray-100 ${i >= 2 ? "text-right" : "text-left"}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {byOperator.map((op, idx) => (
                          <tr key={op.operator} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400 text-xs border-r border-gray-100 w-8">{idx + 1}</td>
                            <td className="px-3 py-2 font-semibold text-gray-800 border-r border-gray-100">{op.operator}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700 border-r border-gray-100">{op.batches}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 border-r border-gray-100">{fmtQty(op.goodQty)}</td>
                            <td className={`px-3 py-2 text-right tabular-nums border-r border-gray-100 ${op.wasteQty > 0 ? "text-orange-600" : "text-gray-400"}`}>{fmtQty(op.wasteQty)}</td>
                            <td className="px-3 py-2 border-r border-gray-100">
                              <YieldBar pct={op.avgYieldPct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── Product Summary ── */}
              {byProduct.length > 0 && (
                <>
                  <SectionHeader title={`Product Summary — ${byProduct.length} product${byProduct.length !== 1 ? "s" : ""}`} />
                  <div className="bg-white border border-t-0 border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["#", "Product", "Batches", "Good Qty", "Waste Qty", "% of Output"].map((h, i) => (
                            <th key={h}
                              className={`px-3 py-2 text-[11px] font-bold text-gray-600 uppercase tracking-wide border-r border-gray-100 ${i >= 2 ? "text-right" : "text-left"}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {byProduct.map((prod, idx) => {
                          const sharePct = summary.totalGoodQty > 0
                            ? (prod.goodQty / summary.totalGoodQty) * 100
                            : 0;
                          return (
                            <tr key={prod.product} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400 text-xs border-r border-gray-100 w-8">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium text-gray-800 border-r border-gray-100">{prod.product}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-700 border-r border-gray-100">{prod.batches}</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 border-r border-gray-100">{fmtQty(prod.goodQty)}</td>
                              <td className={`px-3 py-2 text-right tabular-nums border-r border-gray-100 ${prod.wasteQty > 0 ? "text-orange-600" : "text-gray-400"}`}>{fmtQty(prod.wasteQty)}</td>
                              <td className="px-3 py-2 border-r border-gray-100">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(sharePct, 100)}%`, backgroundColor: APP_COLOR }} />
                                  </div>
                                  <span className="text-xs tabular-nums text-gray-600 w-10 text-right">{sharePct.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 font-bold text-gray-800 border-r border-gray-100">Total</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold border-r border-gray-100">{summary.totalBatches}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold border-r border-gray-100">{fmtQty(summary.totalGoodQty)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-bold text-orange-600 border-r border-gray-100">{fmtQty(summary.totalWasteQty)}</td>
                          <td className="px-3 py-2 border-r border-gray-100" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}

              {/* ── Detailed Production Records (date-grouped) ── */}
              <SectionHeader title={`Production Records — ${rows.length} batch${rows.length !== 1 ? "es" : ""}`} />
              <div className="bg-white border border-t-0 border-gray-200 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0">
                    <tr>
                      {[
                        { label: "#", right: false, w: "w-8" },
                        { label: "Date", right: false },
                        { label: "Batch No", right: false },
                        { label: "Production Line", right: false },
                        { label: "Products", right: false },
                        { label: "Good Qty", right: true },
                        { label: "Waste", right: true },
                        { label: "Yield %", right: true },
                        { label: "Status", right: false },
                        { label: "Operator", right: false },
                      ].map(({ label, right, w }) => (
                        <th key={label}
                          className={`px-3 py-2 text-[11px] font-bold text-gray-600 uppercase tracking-wide border-r border-gray-100 ${right ? "text-right" : "text-left"} ${w || ""}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">
                          No production records found for this period.
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        let globalIdx = 0;
                        return sortedDates.map((date) => {
                          const dayRows = rowsByDate[date];
                          const dayGood = dayRows.reduce((s, r) => s + r.goodQty, 0);
                          const dayWaste = dayRows.reduce((s, r) => s + r.wasteQty, 0);
                          return [
                            // Date group header
                            <tr key={`dg-${date}`} className="bg-gray-50 border-y border-gray-200">
                              <td colSpan={5} className="px-3 py-1.5">
                                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                                  {moment(date).format("dddd, DD MMMM YYYY")}
                                </span>
                                <span className="ml-2 text-[10px] text-gray-400">
                                  ({dayRows.length} batch{dayRows.length !== 1 ? "es" : ""})
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right text-[11px] font-bold text-gray-700 border-r border-gray-100 tabular-nums">{fmtQty(dayGood)}</td>
                              <td className={`px-3 py-1.5 text-right text-[11px] font-bold tabular-nums border-r border-gray-100 ${dayWaste > 0 ? "text-orange-600" : "text-gray-400"}`}>{fmtQty(dayWaste)}</td>
                              <td colSpan={3} className="px-3 py-1.5" />
                            </tr>,
                            // Rows for that date
                            ...dayRows.map((row) => {
                              globalIdx++;
                              const n = globalIdx;
                              return (
                                <tr
                                  key={row.id ?? `${date}-${n}`}
                                  className={`border-b border-gray-100 transition-colors ${row.status === "cancelled" ? "opacity-60" : "hover:bg-[#4267B2]/5"}`}
                                >
                                  <td className="px-3 py-2 text-gray-400 text-xs border-r border-gray-100">{n}</td>
                                  <td className="px-3 py-2 border-r border-gray-100 text-gray-700 whitespace-nowrap text-xs">
                                    {moment(row.date).format("DD/MM/YYYY")}
                                  </td>
                                  <td className="px-3 py-2 border-r border-gray-100 font-mono text-xs text-gray-700 whitespace-nowrap">
                                    {row.batchNo}
                                  </td>
                                  <td className="px-3 py-2 border-r border-gray-100 text-gray-600 text-xs">
                                    {row.productionLine && row.productionLine !== "—"
                                      ? row.productionLine
                                      : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-3 py-2 border-r border-gray-100 text-gray-800 max-w-[240px]">
                                    {row.products && row.products !== "—"
                                      ? <span title={row.products} className="block truncate">{row.products}</span>
                                      : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-3 py-2 border-r border-gray-100 text-right tabular-nums font-semibold text-gray-900">
                                    {fmtQty(row.goodQty)}
                                  </td>
                                  <td className={`px-3 py-2 border-r border-gray-100 text-right tabular-nums ${row.wasteQty > 0 ? "text-orange-600 font-medium" : "text-gray-300"}`}>
                                    {fmtQty(row.wasteQty)}
                                  </td>
                                  <td className="px-3 py-2 border-r border-gray-100">
                                    <YieldBar pct={row.yieldPct} />
                                  </td>
                                  <td className="px-3 py-2 border-r border-gray-100">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_STYLE[row.status] || "bg-gray-100 text-gray-700"}`}>
                                      {capitalize(row.status)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 text-xs">{row.operator}</td>
                                </tr>
                              );
                            }),
                          ];
                        });
                      })()
                    )}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 font-bold text-gray-900 text-right border-r border-gray-100">
                          Grand Total
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900 border-r border-gray-100">
                          {fmtQty(summary.totalGoodQty)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-orange-600 border-r border-gray-100">
                          {fmtQty(summary.totalWasteQty)}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-100">
                          <YieldBar pct={summary.avgYieldPct} />
                        </td>
                        <td colSpan={2} className="px-3 py-2 text-[11px] text-gray-400 italic">
                          Avg yield
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* ── Footer ── */}
              <p className="text-right text-[10px] text-gray-400 mt-2 pb-2 pr-1">
                Report generated on {moment().format("DD MMM YYYY [at] HH:mm:ss")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
