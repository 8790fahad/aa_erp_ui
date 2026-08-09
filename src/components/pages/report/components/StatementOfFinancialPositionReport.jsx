import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Fragment,
} from "react";
import {
  Loader2,
  X,
  FileSpreadsheet,
  FileDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import moment from "moment";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
function collectNoteCodes(rows) {
  if (!Array.isArray(rows)) return [];
  const set = new Set();
  const add = (note) => {
    if (note != null && String(note).trim() !== "") {
      set.add(String(note).trim());
    }
  };
  function walk(row) {
    if (!row) return;
    if (row.type === "group") {
      add(row.note);
      for (const ch of row.children || []) walk(ch);
    } else if (row.type === "line" || row.type === "subtotal") {
      add(row.note);
    }
  }
  for (const row of rows) walk(row);
  return Array.from(set).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

/** UK-style footer when notes are narrative codes */
function notesFooterSentence(noteCodes) {
  if (noteCodes.length >= 2) {
    const first = noteCodes[0];
    const last = noteCodes[noteCodes.length - 1];
    return `The accounting policies and the notes identified by codes ${first} to ${last} form part of these financial statements.`;
  }
  if (noteCodes.length === 1) {
    return `The accounting policies and the note identified by code ${noteCodes[0]} form part of these financial statements.`;
  }
  return "The accounting policies and the accompanying notes form part of these financial statements.";
}

/** Same pattern as InventriaGeneralLedger — DD/MM/YYYY for header period lines */
function formatReportDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  const v = Number(value);
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.005) return "—";
  return formatNaira(v);
}

function shouldHideTopLevelNatureGroup(row) {
  const code = row?.parentCode != null ? String(row.parentCode).trim() : "";
  // Hide system "nature headers" like:
  // 100001 - Assets, 200001 - Liabilities, 300001 - Equity
  if (code === "100001" || code === "200001" || code === "300001") return true;
  const label = String(row?.label || "").toLowerCase();
  return (
    label === "100001 - assets" ||
    label === "200001 - liabilities" ||
    label === "300001 - equity"
  );
}

/** Excel export: nested segment groups (same structure as API rows) */
function writeSofpSegmentRow(ws, row, r, depth, borderThin) {
  const indent = "  ".repeat(depth);
  if (row.type === "line") {
    ws.getCell(r, 1).value = `${indent}${row.label || ""}`;
    ws.getCell(r, 2).value = row.note || "";
    ws.getCell(r, 3).value =
      row.current === null || row.current === undefined ? "" : Number(row.current);
    ws.getCell(r, 4).value =
      row.prior === null || row.prior === undefined ? "" : Number(row.prior);
    [1, 2, 3, 4].forEach((col) => {
      ws.getCell(r, col).border = borderThin;
    });
    ws.getCell(r, 3).numFmt = "#,##0.00";
    ws.getCell(r, 4).numFmt = "#,##0.00";
    ws.getCell(r, 3).alignment = { horizontal: "right" };
    ws.getCell(r, 4).alignment = { horizontal: "right" };
    return r + 1;
  }
  if (row.type === "group") {
    if (shouldHideTopLevelNatureGroup(row)) {
      let next = r;
      for (const ch of row.children || []) {
        next = writeSofpSegmentRow(ws, ch, next, depth, borderThin);
      }
      return next;
    }
    ws.getCell(r, 1).value = `${indent}${row.label || ""}`;
    ws.getCell(r, 2).value = row.note || "";
    ws.getCell(r, 3).value =
      row.current === null || row.current === undefined ? "" : Number(row.current);
    ws.getCell(r, 4).value =
      row.prior === null || row.prior === undefined ? "" : Number(row.prior);
    ws.getRow(r).font = { bold: true };
    [1, 2, 3, 4].forEach((col) => {
      ws.getCell(r, col).border = borderThin;
    });
    ws.getCell(r, 3).numFmt = "#,##0.00";
    ws.getCell(r, 4).numFmt = "#,##0.00";
    ws.getCell(r, 3).alignment = { horizontal: "right" };
    ws.getCell(r, 4).alignment = { horizontal: "right" };
    let next = r + 1;
    for (const ch of row.children || []) {
      next = writeSofpSegmentRow(ws, ch, next, depth + 1, borderThin);
    }
    return next;
  }
  return r;
}

/**
 * Comparative Statement of Financial Position (balance sheet layout).
 * Data from POST /accounting/statement-of-financial-position
 */
export default function StatementOfFinancialPositionReport() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const location = useLocation();
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();

  const [compareMode, setCompareMode] = useState("year"); // "year" | "month"
  const [asOfDate, setAsOfDate] = useState("");
  const [asOfDatePrior, setAsOfDatePrior] = useState("");
  const [asOfYear, setAsOfYear] = useState("");
  const [asOfYearPrior, setAsOfYearPrior] = useState("");
  const [asOfMonth, setAsOfMonth] = useState(""); // YYYY-MM
  const [asOfMonthPrior, setAsOfMonthPrior] = useState(""); // YYYY-MM
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = useRef(null);
  /** Collapsed when false; undefined / true = expanded (matches GL default: show detail) */
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = useCallback((parentCode) => {
    setExpandedGroups((prev) => {
      const curOpen = prev[parentCode] !== false;
      return { ...prev, [parentCode]: !curOpen };
    });
  }, []);

  const collectGroupCodes = useCallback((rows) => {
    const codes = [];
    const walk = (node) => {
      if (!node) return;
      if (node.type === "group" && node.parentCode) {
        codes.push(String(node.parentCode));
      }
      (node.children || []).forEach(walk);
    };
    (rows || []).forEach(walk);
    return codes;
  }, []);

  useEffect(() => {
    if (!data?.rows?.length) {
      setExpandedGroups({});
      return;
    }
    const firstTopLevelGroup = data.rows.find((r) => r?.type === "group")?.parentCode;
    const allGroupCodes = collectGroupCodes(data.rows);
    const nextState = {};
    allGroupCodes.forEach((code) => {
      nextState[code] = false;
    });
    if (firstTopLevelGroup) {
      nextState[String(firstTopLevelGroup)] = true;
    }
    setExpandedGroups(nextState);
  }, [data?.rows, collectGroupCodes]);

  useEffect(() => {
    const currentYear = moment().format("YYYY");
    const priorYear = moment().subtract(1, "year").format("YYYY");
    if (location.state?.asOfDate) {
      const dCur = moment(location.state.asOfDate);
      const dPri = location.state.asOfDatePrior
        ? moment(location.state.asOfDatePrior)
        : moment(location.state.asOfDate).subtract(1, "year");

      // If a non-year-end date is provided, default to month compare mode.
      const looksLikeYearEnd =
        dCur.isValid() && dCur.month() === 11 && dCur.date() === 31;
      setCompareMode(looksLikeYearEnd ? "year" : "month");

      setAsOfYear(dCur.isValid() ? dCur.format("YYYY") : currentYear);
      setAsOfYearPrior(dPri.isValid() ? dPri.format("YYYY") : priorYear);

      setAsOfMonth(dCur.isValid() ? dCur.format("YYYY-MM") : moment().format("YYYY-MM"));
      setAsOfMonthPrior(
        dPri.isValid() ? dPri.format("YYYY-MM") : moment().subtract(1, "year").format("YYYY-MM")
      );
    } else {
      setCompareMode("year");
      setAsOfYear(currentYear);
      setAsOfYearPrior(priorYear);
      setAsOfMonth(moment().format("YYYY-MM"));
      setAsOfMonthPrior(moment().subtract(1, "year").format("YYYY-MM"));
    }
  }, [location.state]);

  useEffect(() => {
    if (compareMode !== "year") return;
    if (asOfYear) setAsOfDate(`${asOfYear}-12-31`);
  }, [asOfYear, compareMode]);

  useEffect(() => {
    if (compareMode !== "year") return;
    if (asOfYearPrior) setAsOfDatePrior(`${asOfYearPrior}-12-31`);
  }, [asOfYearPrior, compareMode]);

  useEffect(() => {
    if (compareMode !== "month") return;
    if (!asOfMonth) return;
    const end = moment(`${asOfMonth}-01`).endOf("month").format("YYYY-MM-DD");
    setAsOfDate(end);
  }, [asOfMonth, compareMode]);

  useEffect(() => {
    if (compareMode !== "month") return;
    if (!asOfMonthPrior) return;
    const end = moment(`${asOfMonthPrior}-01`).endOf("month").format("YYYY-MM-DD");
    setAsOfDatePrior(end);
  }, [asOfMonthPrior, compareMode]);

  const selectableYears = useMemo(() => {
    const now = moment().year();
    const years = [];
    for (let y = now + 1; y >= now - 15; y -= 1) years.push(String(y));
    return years;
  }, []);

  const fetchReport = useCallback(async () => {
    if (!facilityId || !asOfDate) {
      setError("Select facility and current period end date.");
      return;
    }
    setLoading(true);
    setError("");
    _postApi(
      "/accounting/statement-of-financial-position",
      {
        facilityId,
        asOfDate,
        ...(asOfDatePrior ? { asOfDatePrior } : {}),
      },
      (response) => {
        setLoading(false);
        if (response.success && response.data) {
          setData(response.data);
        } else {
          setError(response.message || "Failed to load report");
        }
      },
      () => {
        setLoading(false);
        setError("Could not load statement of financial position.");
      }
    );
  }, [facilityId, asOfDate, asOfDatePrior]);

  useEffect(() => {
    if (asOfDate && facilityId) {
      fetchReport();
    }
  }, [asOfDate, facilityId, fetchReport]);

  const businessName =
    activeBusiness?.business_name || activeBusiness?.name || "Company";

  const yearCurrent =
    compareMode === "month"
      ? moment(asOfDate).format("MMM YYYY")
      : data?.yearLabels?.current || moment(asOfDate).format("YYYY");
  const yearPrior =
    compareMode === "month"
      ? moment(asOfDatePrior).format("MMM YYYY")
      : data?.yearLabels?.prior || moment(asOfDatePrior).format("YYYY");

  const business = activeBusiness || {};

  const noteCodes = useMemo(() => collectNoteCodes(data?.rows), [data]);

  const handleExportExcel = useCallback(async () => {
    if (!data?.rows?.length) {
      toast.error("No report data to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Statement of FP", {
        views: [{ showGridLines: true }],
      });
      const borderThin = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      let r = 1;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = businessName;
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = "STATEMENT OF FINANCIAL POSITION";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = `As of ${moment(data.asOfDate).format("DD MMMM YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const yc = data?.yearLabels?.current || moment(asOfDate).format("YYYY");
      const yp = data?.yearLabels?.prior || moment(asOfDatePrior).format("YYYY");
      const curLabel = `${yc} (${data.currencyLabel || "₦"})`;
      const priLabel = `${yp} (${data.currencyLabel || "₦"})`;

      const head = ["Account", "Acct. #", curLabel, priLabel];
      head.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" },
        };
        c.border = borderThin;
        c.alignment =
          i === 0
            ? { horizontal: "left" }
            : i === 1
              ? { horizontal: "center" }
              : { horizontal: "right" };
      });
      r++;

      for (const row of data.rows) {
        if (row.type === "spacer") {
          r++;
          continue;
        }
        if (row.type === "section") {
          ws.mergeCells(r, 1, r, 4);
          const c = ws.getCell(r, 1);
          c.value = row.label;
          c.font = { bold: true };
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
          r++;
          continue;
        }
        if (row.type === "group") {
          r = writeSofpSegmentRow(ws, row, r, 0, borderThin);
          continue;
        }
        if (row.type === "line" || row.type === "subtotal") {
          ws.getCell(r, 1).value = row.label;
          ws.getCell(r, 2).value = row.note || "";
          ws.getCell(r, 3).value =
            row.current === null || row.current === undefined
              ? ""
              : Number(row.current);
          ws.getCell(r, 4).value =
            row.prior === null || row.prior === undefined
              ? ""
              : Number(row.prior);
          if (row.type === "subtotal" || row.emphasize) {
            ws.getRow(r).font = { bold: true };
          }
          [1, 2, 3, 4].forEach((col) => {
            ws.getCell(r, col).border = borderThin;
          });
          ws.getCell(r, 3).numFmt = "#,##0.00";
          ws.getCell(r, 4).numFmt = "#,##0.00";
          ws.getCell(r, 3).alignment = { horizontal: "right" };
          ws.getCell(r, 4).alignment = { horizontal: "right" };
          r++;
        }
      }

      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = notesFooterSentence(noteCodes);
      ws.getCell(r, 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEDD5" },
      };

      ws.columns = [{ width: 48 }, { width: 14 }, { width: 18 }, { width: 18 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Statement-of-financial-position-${asOfDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel file downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [data, businessName, asOfDate, asOfDatePrior, noteCodes]);

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
      pdf.save(`Statement-of-financial-position-${asOfDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [asOfDate]);

  const meta = data?.meta;

  function renderSegmentNode(row, keyPrefix, depth = 0, ancestorCollapsed = false) {
    const rowHidden = ancestorCollapsed ? "hidden print:table-row" : "";
    if (row.type === "line") {
      return (
        <tr
          key={keyPrefix}
          className={`border-b border-gray-200 bg-white hover:bg-gray-50/80 ${rowHidden}`}
        >
          <td
            className="py-1.5 pr-2 border-r border-gray-200 text-gray-800"
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            {row.label}
          </td>
          <td className="px-2 py-1.5 text-center text-gray-600 border-r border-gray-200 text-xs">
            {row.note || ""}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums border-r border-gray-200">
            {formatCell(row.current)}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums bg-gray-50/50">
            {formatCell(row.prior)}
          </td>
        </tr>
      );
    }
    if (row.type === "group") {
      if (shouldHideTopLevelNatureGroup(row)) {
        return (
          <Fragment key={keyPrefix}>
            {row.children?.map((ch, ci) => (
              <Fragment key={`${keyPrefix}-h-${ci}`}>
                {renderSegmentNode(
                  ch,
                  `${keyPrefix}-h-${ci}`,
                  depth,
                  ancestorCollapsed
                )}
              </Fragment>
            ))}
          </Fragment>
        );
      }
      const open = expandedGroups[row.parentCode] !== false;
      const hideSubtree = ancestorCollapsed || !open;
      return (
        <Fragment key={keyPrefix}>
          <tr
            className={`bg-gray-50 border-t border-gray-300 cursor-pointer hover:bg-gray-100/90 ${rowHidden}`}
            onClick={() => toggleGroup(row.parentCode)}
            role="button"
            tabIndex={0}
            aria-expanded={open}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleGroup(row.parentCode);
              }
            }}
          >
            <td
              className="py-2 pr-2 border-r border-gray-200 align-top"
              style={{ paddingLeft: 4 + depth * 12 }}
            >
              <div className="flex items-start gap-1 min-w-0">
                <span
                  className="inline-flex h-5 w-4 shrink-0 items-center justify-center text-gray-600 mt-0.5 -ml-0.5"
                  aria-hidden
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <span className="font-semibold text-gray-900">{row.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {row.accountCount} account
                    {row.accountCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </td>
            <td className="px-2 py-2 text-center text-xs text-gray-600 border-r border-gray-200 align-top">
              {row.note || ""}
            </td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums border-r border-gray-200 align-top">
              {formatCell(row.current)}
            </td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums bg-gray-50/50 align-top">
              {formatCell(row.prior)}
            </td>
          </tr>
          {row.children?.map((ch, ci) => (
            <Fragment key={`${keyPrefix}-n-${ci}`}>
              {renderSegmentNode(
                ch,
                `${keyPrefix}-n-${ci}`,
                depth + 1,
                hideSubtree
              )}
            </Fragment>
          ))}
        </Fragment>
      );
    }
    return null;
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-content { padding: 0; box-shadow: none; }
          @page { margin: 8mm; size: A4 portrait; }
          html, body {
            background: #fff !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-1 print:bg-white print:p-0">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gray-100 rounded-lg no-print px-2 py-2 mb-2">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:flex-wrap">
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
                <div className="flex min-w-[10rem] flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-700">
                    Comparative mode
                  </label>
                  <select
                    value={compareMode}
                    onChange={(e) => setCompareMode(e.target.value)}
                    className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                  >
                    <option value="year">Year-end</option>
                    <option value="month">Month-end</option>
                  </select>
                </div>
                {compareMode === "year" ? (
                  <>
                    <div className="flex min-w-[10rem] flex-col gap-1">
                      <label
                        htmlFor="sof-current-end"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Current period end
                      </label>
                      <select
                        id="sof-current-end"
                        value={asOfYear}
                        onChange={(e) => setAsOfYear(e.target.value)}
                        className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                      >
                        {selectableYears.map((y) => (
                          <option key={`current-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex min-w-[10rem] flex-col gap-1">
                      <label
                        htmlFor="sof-prior-end"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Comparative period end
                      </label>
                      <select
                        id="sof-prior-end"
                        value={asOfYearPrior}
                        onChange={(e) => setAsOfYearPrior(e.target.value)}
                        className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                      >
                        {selectableYears.map((y) => (
                          <option key={`prior-${y}`} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-[12rem] flex-col gap-1">
                      <label
                        htmlFor="sof-current-month"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Current month end
                      </label>
                      <input
                        id="sof-current-month"
                        type="month"
                        value={asOfMonth}
                        onChange={(e) => setAsOfMonth(e.target.value)}
                        className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                      />
                    </div>
                    <div className="flex min-w-[12rem] flex-col gap-1">
                      <label
                        htmlFor="sof-prior-month"
                        className="text-sm font-semibold text-gray-700"
                      >
                        Comparative month end
                      </label>
                      <input
                        id="sof-prior-month"
                        type="month"
                        value={asOfMonthPrior}
                        onChange={(e) => setAsOfMonthPrior(e.target.value)}
                        className="h-10 rounded border border-gray-300 bg-white px-3 text-sm"
                      />
                    </div>
                  </>
                )}
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
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading
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
                      disabled={!data || loading}
                    >
                      Export
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={!data || loading}
                      onClick={() => handleExportExcel()}
                    >
                      <FileSpreadsheet className="h-4 w-4 shrink-0" />
                      Export Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={!data || loading || pdfExporting}
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


        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4 text-red-800 no-print">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        )}

        {data && (
          <div
            ref={reportExportRef}
            className="print-content"
          >
            {/* Match InventriaGeneralLedger: blue band + company block + title box */}
            <div className="mb-0">
              <BusinessDocumentHeader
                business={business}
                title={
                  meta?.reportTitleUpper || "STATEMENT OF FINANCIAL POSITION"
                }
                numberLabel={
                  meta?.periodLine || `As of ${formatReportDate(data.asOfDate)}`
                }
                extraLine={
                  meta?.comparativeLine ||
                  `Comparative: ${formatReportDate(data.asOfDatePrior)}`
                }
                date={new Date()}
                dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
                className="mb-0"
              />
            </div>

            <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm">
              {data.validation && (
                <div
                  className={`border-b border-gray-200 px-3 py-2 text-center text-xs ${
                    data.validation.balancedCurrent
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {data.validation.balancedCurrent
                    ? "Total assets = Total liabilities + Total equity (current period)"
                    : `Out of balance by ${formatNumber1(
                        data.validation.differenceCurrent || 0
                      )} — verify opening balances and GL postings.`}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-600 border-b-2 border-gray-700">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
                        Account
                      </th>
                      <th className="px-2 py-2.5 text-center text-xs font-bold text-white uppercase border-r border-gray-500 w-24">
                        Acct. #
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase border-r border-gray-500 min-w-[8rem]">
                        {yearCurrent} ({data.currencyLabel || "₦"})
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase bg-gray-700 min-w-[8rem]">
                        {yearPrior} ({data.currencyLabel || "₦"})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, idx) => {
                      if (row.type === "spacer") {
                        return (
                          <tr key={`${idx}-sp`}>
                            <td colSpan={4} className="h-2 bg-white" />
                          </tr>
                        );
                      }
                      if (row.type === "section") {
                        const lv = row.sectionLevel === 1 ? 1 : 2;
                        return (
                          <tr
                            key={`${idx}-sec`}
                            className={
                              lv === 1
                                ? "bg-gray-50 border-t-2 border-gray-500"
                                : "bg-gray-50/80 border-t border-gray-300"
                            }
                          >
                            <td
                              colSpan={4}
                              className={
                                lv === 1
                                  ? "px-3 py-2 text-sm font-bold text-gray-900 uppercase tracking-wide"
                                  : "px-3 py-1.5 text-xs font-semibold text-gray-800 uppercase tracking-wide"
                              }
                            >
                              {row.label}
                            </td>
                          </tr>
                        );
                      }
                      if (row.type === "group") {
                        return (
                          <Fragment key={`${idx}-grp-${row.parentCode}`}>
                            {renderSegmentNode(
                              row,
                              `seg-${idx}-${row.parentCode}`,
                              0,
                              false
                            )}
                          </Fragment>
                        );
                      }
                      if (row.type === "line" || row.type === "subtotal") {
                        const isSub = row.type === "subtotal";
                        const isTotalAssets =
                          isSub && row.label === "TOTAL ASSETS";
                        const borderClass = row.doubleUnderline
                          ? "border-b-4 border-double border-gray-900"
                          : row.underline || isSub
                            ? "border-b border-gray-800"
                            : "border-b border-gray-200";
                        return (
                          <tr
                            key={`${idx}-line`}
                            className={`bg-white hover:bg-gray-50/80 ${borderClass} ${
                              isTotalAssets
                                ? "border-t-2 border-t-gray-900"
                                : ""
                            }`}
                          >
                            <td
                              className={`px-3 py-1.5 pr-2 border-r border-gray-200 text-gray-900 ${
                                isSub || row.emphasize
                                  ? "font-semibold break-words leading-snug"
                                  : "pl-8"
                              }`}
                            >
                              {row.label}
                            </td>
                            <td className="px-2 py-1.5 text-center text-gray-600 border-r border-gray-200 text-xs">
                              {row.note || ""}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums border-r border-gray-200">
                              {formatCell(row.current)}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums bg-gray-50/50">
                              {formatCell(row.prior)}
                            </td>
                          </tr>
                        );
                      }
                      return null;
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              className="mt-3 w-full border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-700 md:px-5"
              role="note"
            >
              {notesFooterSentence(noteCodes)}
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
