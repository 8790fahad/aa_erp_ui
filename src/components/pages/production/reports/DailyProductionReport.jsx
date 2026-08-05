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
  Loader2, X, ChevronDown, ChevronRight, FileSpreadsheet, FileDown,
  AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportHeaderBand } from "./productionReportUi";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(v, dp = 2) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtMoney(v) {
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v) {
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${n.toFixed(1)}%`;
}

// ── Yield status badge ─────────────────────────────────────────────────────
const YIELD_CFG = {
  within_tolerance: { cls: "bg-green-100 text-green-800 border border-green-200", Icon: CheckCircle2, label: "Within tolerance" },
  variance_flagged: { cls: "bg-red-100 text-red-800 border border-red-200",       Icon: AlertTriangle, label: "Variance flagged" },
  pending_review:   { cls: "bg-amber-100 text-amber-800 border border-amber-200", Icon: Clock,         label: "Pending review" },
};
const BATCH_BADGE = {
  completed: "bg-green-100 text-green-800 border border-green-200",
  draft:     "bg-amber-100 text-amber-800 border border-amber-200",
  cancelled: "bg-gray-100 text-gray-600 border border-gray-200",
};

function YieldBadge({ status }) {
  const cfg = YIELD_CFG[status] || YIELD_CFG.pending_review;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${cfg.cls}`}>
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DailyProductionReport() {
  const navigate    = useNavigate();
  const { activeBusiness } = useSelector((s) => s.auth);
  const facilityId  = activeBusiness?.id;
  const business    = activeBusiness || {};
  const businessName = business.business_name || business.name || "Company";
  const reportRef   = useRef(null);

  const [fromDate,       setFromDate]       = useState(moment().subtract(30, "days").format("YYYY-MM-DD"));
  const [toDate,         setToDate]         = useState(moment().format("YYYY-MM-DD"));
  const [statusFilter,   setStatusFilter]   = useState("completed");
  const [yieldFilter,    setYieldFilter]    = useState("all");
  const [costingType,    setCostingType]    = useState("joint_shared");
  const [loading,      setLoading]      = useState(false);
  const [data,         setData]         = useState(null);
  const [error,        setError]        = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [page,         setPage]         = useState(1);
  const PAGE_SIZE = 20;

  const fetchReport = useCallback(() => {
    if (!facilityId) { setError("No active business selected."); return; }
    setLoading(true);
    setError("");
    _postApi(
      "/api/reports/production/daily-batch-log",
      { facilityId, fromDate, toDate, status: statusFilter, yieldStatus: yieldFilter, costingType: costingType === "all" ? undefined : costingType, page, pageSize: PAGE_SIZE },
      (resp) => {
        setLoading(false);
        if (resp.success && resp.data) setData(resp.data);
        else setError(resp.message || "Failed to load report");
      },
      () => { setLoading(false); setError("Could not reach the server."); }
    );
  }, [facilityId, fromDate, toDate, statusFilter, yieldFilter, costingType, page]);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (facilityId && !hasFetched.current) {
      hasFetched.current = true;
      fetchReport();
    }
  }, [facilityId, fetchReport]);

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExportExcel = useCallback(async () => {
    if (!data?.batches?.length) { toast.error("No data to export"); return; }
    try {
      const wb  = new ExcelJS.Workbook();
      const ws  = wb.addWorksheet("Daily Production Report");
      const fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      const border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      ws.columns = [
        { width: 18 }, { width: 20 }, { width: 32 }, { width: 18 },
        { width: 12 }, { width: 20 }, { width: 16 }, { width: 16 },
      ];
      let r = 1;
      ws.mergeCells(r, 1, r, 8); ws.getCell(r, 1).value = businessName;
      ws.getCell(r, 1).font = { bold: true, size: 14 }; ws.getCell(r, 1).alignment = { horizontal: "center" }; r++;
      ws.mergeCells(r, 1, r, 8); ws.getCell(r, 1).value = "DAILY PRODUCTION REPORT";
      ws.getCell(r, 1).font = { bold: true, size: 12 }; ws.getCell(r, 1).alignment = { horizontal: "center" }; r++;
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value = `Period: ${moment(fromDate).format("DD MMM YYYY")} – ${moment(toDate).format("DD MMM YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" }; r += 2;

      ["Date", "Batch No", "Raw Material", "Actual Qty", "Actual Yield %", "Expected Yield %", "Variance %"].forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = fill; c.border = border;
        c.alignment = i >= 3 ? { horizontal: "right" } : { horizontal: "left" };
      }); r++;

      for (const b of data.batches) {
        const variance = (parseFloat(b.expectedYieldPct) || 0) > 0
          ? (parseFloat(b.actualYieldPct) || 0) - (parseFloat(b.expectedYieldPct) || 0)
          : 0;
        ws.getCell(r, 1).value = moment(b.date).format("DD/MM/YYYY");
        ws.getCell(r, 2).value = b.batchNo;
        ws.getCell(r, 3).value = b.rawMaterial?.name || b.products.map((p) => p.name).join(", ") || "—";
        ws.getCell(r, 4).value = parseFloat(b.rawMaterial?.qty || b.actualQty) || 0; ws.getCell(r, 4).numFmt = "#,##0.0000";
        ws.getCell(r, 5).value = parseFloat(b.actualYieldPct) || 0; ws.getCell(r, 5).numFmt = '0.00"%"';
        ws.getCell(r, 6).value = parseFloat(b.expectedYieldPct) || 0; ws.getCell(r, 6).numFmt = '0.00"%"';
        ws.getCell(r, 7).value = variance; ws.getCell(r, 7).numFmt = '+0.00"%";-0.00"%"';
        [4, 5, 6, 7].forEach((c) => { ws.getCell(r, c).alignment = { horizontal: "right" }; });
        for (let c = 1; c <= 7; c++) ws.getCell(r, c).border = border;
        r++;
      }

      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url;
      a.download = `daily-production-${fromDate}-to-${toDate}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) { console.error(e); toast.error("Could not export Excel"); }
  }, [data, businessName, fromDate, toDate]);

  // ── PDF export ────────────────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    const el = reportRef.current;
    if (!el) { toast.error("Report not ready"); return; }
    setPdfExporting(true);
    try {
      const canvas  = await html2canvas(el, { scale: 2, useCORS: true, logging: false, windowWidth: el.scrollWidth });
      const imgData = canvas.toDataURL("image/png");
      const pdf     = new jsPDF("l", "mm", "a4");
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const imgH    = (canvas.height * pageW) / canvas.width;
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -y, pageW, imgH);
        y += pageH;
      }
      pdf.save(`daily-production-${fromDate}-to-${toDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) { console.error(e); toast.error("Could not generate PDF"); }
    finally { setPdfExporting(false); }
  }, [fromDate, toDate]);

  const batches    = data?.batches    || [];
  const pagination = data?.pagination || {};

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

      <div className="min-h-screen bg-gray-50 p-1 print:bg-white print:p-0">
        <div className="max-w-7xl mx-auto">

          {/* ── Controls bar ── */}
          <div className="bg-gray-100 rounded-lg no-print px-3 py-2 mb-2">
            <div className="flex flex-wrap items-end gap-3">
              {/* Date pickers */}
              {[{ label: "From", v: fromDate, set: setFromDate }, { label: "To", v: toDate, set: setToDate }].map(
                ({ label, v, set }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">{label}</label>
                    <input type="date" value={v} onChange={(e) => set(e.target.value)}
                      className="h-9 rounded border border-gray-300 bg-white px-2 text-sm" />
                  </div>
                )
              )}
              {/* Costing Type */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Costing Type</label>
                <select value={costingType} onChange={(e) => setCostingType(e.target.value)}
                  className="h-9 rounded border border-gray-300 bg-white px-2 text-sm">
                  <option value="all">All types</option>
                  <option value="job_specific">Job / Specific</option>
                  <option value="joint_shared">Joint / Shared</option>
                </select>
              </div>

              {/* Batch Status */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Batch Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded border border-gray-300 bg-white px-2 text-sm">
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Action buttons — push to right */}
              <div className="ml-auto flex shrink-0 flex-wrap items-end gap-2">
                <Button type="button" variant="destructive" size="sm" className="h-9"
                  onClick={() => navigate("/app/production/production-reports")}>
                  <X className="h-4 w-4 shrink-0" /> Close
                </Button>
                <button type="button" onClick={fetchReport} disabled={loading}
                  className="inline-flex h-9 items-center justify-center rounded border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading</> : "Run report"}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-9 border-gray-300"
                      disabled={!data || loading}>
                      Export <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="cursor-pointer" disabled={!data || loading} onClick={handleExportExcel}>
                      <FileSpreadsheet className="h-4 w-4 shrink-0" /> Export Excel
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
            <div ref={reportRef} className="print-content">

              {/* ── Blue header band ── */}
              <ReportHeaderBand
                business={business}
                reportTitle="Daily Production Report"
                periodLabel={`Period: ${moment(fromDate).format("DD/MM/YYYY")} – ${moment(toDate).format("DD/MM/YYYY")}`}
              />

              {/* ── Batch table ── */}
              <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm mb-4">
                <div className="bg-gray-600 px-3 py-2">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                    Production Batches — {pagination.total ?? batches.length} record{batches.length !== 1 ? "s" : ""}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        {[
                          { h: "Date / Batch", align: "left"   },
                          { h: "Raw Material", align: "left"   },
                          { h: "Qty",          align: "center" },
                          { h: "Actual (%)",   align: "center" },
                          { h: "Expected (%)", align: "center" },
                          { h: "Variance (%)", align: "center" },
                          { h: "",             align: "center" },
                        ].map(({ h, align }) => (
                          <th key={h}
                            className={`px-3 py-2 text-xs font-bold text-gray-700 uppercase border-r border-gray-200 text-${align}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {batches.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                            No production batches found for this period.
                          </td>
                        </tr>
                      ) : (
                        batches.map((b) => (
                          <tr key={b.id}
                            className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer ${b.yieldStatus === "variance_flagged" ? "bg-red-50/30" : ""}`}
                            onClick={() => navigate(`/app/production/production-reports/daily-batch-log/${b.id}`)}>
                            <td className="px-3 py-2.5 border-r border-gray-200">
                              <p className="font-mono text-xs font-semibold text-gray-800">{b.batchNo}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {moment(b.date).format("DD/MM/YYYY")}
                                {b.productionLine && ` · ${b.productionLine}`}
                              </p>
                            </td>
                            {/* Raw Material */}
                            <td className="px-3 py-2.5 border-r border-gray-200">
                              {b.rawMaterial ? (
                                <span className="text-sm font-medium text-gray-800">{b.rawMaterial.name}</span>
                              ) : b.products.length > 0 ? (
                                <span className="text-xs text-gray-500 italic">
                                  {b.products.map((p) => p.name).join(", ")}
                                </span>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                            {/* Qty */}
                            <td className="px-3 py-2.5 border-r border-gray-200 text-center whitespace-nowrap">
                              {b.rawMaterial?.qty > 0 ? (
                                <>
                                  <p className="tabular-nums font-semibold text-gray-900">{fmt(b.rawMaterial.qty, 4)}</p>
                                  {b.rawMaterial.unit && (
                                    <p className="text-[10px] text-gray-400">{b.rawMaterial.unit}</p>
                                  )}
                                </>
                              ) : b.actualQty > 0 ? (
                                <p className="tabular-nums font-semibold text-gray-900">{fmt(b.actualQty)}</p>
                              ) : "—"}
                            </td>
                            {(() => {
                              const actual   = parseFloat(b.actualYieldPct)   || 0;
                              const expected = parseFloat(b.expectedYieldPct) || 0;
                              const variance = expected > 0 ? actual - expected : 0;
                              const isGood   = actual >= expected;
                              const varSign  = variance > 0 ? "+" : "";
                              return (
                                <>
                                  {/* Actual */}
                                  <td className="px-3 py-2.5 border-r border-gray-200 text-center tabular-nums">
                                    <span className={`text-sm font-bold ${isGood ? "text-green-700" : actual > 0 ? "text-amber-600" : "text-gray-400"}`}>
                                      {actual > 0 ? fmtPct(actual) : "—"}
                                    </span>
                                  </td>
                                  {/* Expected */}
                                  <td className="px-3 py-2.5 border-r border-gray-200 text-center tabular-nums">
                                    <span className="text-sm text-gray-600 font-medium">
                                      {expected > 0 ? fmtPct(expected) : "—"}
                                    </span>
                                  </td>
                                  {/* Variance */}
                                  <td className="px-3 py-2.5 border-r border-gray-200 text-center tabular-nums">
                                    {expected > 0 ? (
                                      <span className={`text-sm font-semibold ${isGood ? "text-green-600" : "text-red-500"}`}>
                                        {varSign}{variance.toFixed(2)}%
                                      </span>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                </>
                              );
                            })()}
                            <td className="px-3 py-2.5 text-center">
                              <ChevronRight size={18} className="mx-auto text-gray-500" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="no-print flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-500">
                      Showing {((pagination.page - 1) * PAGE_SIZE) + 1}–{Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}
                        className="h-7 px-3 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                        ← Prev
                      </button>
                      <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages || loading}
                        className="h-7 px-3 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-right text-[10px] text-gray-400 pb-2 pr-1">
                Generated: {moment().format("DD MMM YYYY [at] HH:mm:ss")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
