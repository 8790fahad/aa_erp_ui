import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import moment from "moment";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import { formatExpensePaymentMode } from "@/utils/expensePaymentMode";

const PAGE_SIZE = 100;

function num(v) {
  return parseFloat(v) || 0;
}

function formatMode(mode) {
  const labeled = formatExpensePaymentMode(mode);
  return labeled === "—" ? "Unspecified" : labeled;
}

function Th({ children, align = "left", className = "" }) {
  return (
    <th
      className={`py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left", className = "", ...rest }) {
  return (
    <td
      className={`py-3 px-3 ${align === "right" ? "text-right tabular-nums" : ""} ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}

function fetchInputVatPage({
  facilityId,
  userId,
  fromDate,
  toDate,
  search,
  page,
  pageSize,
}) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      userId: String(userId),
      fromDate,
      toDate,
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) params.set("search", search);

    _fetchApi(
      `/api/v1/transactions/input-vat-report?${params.toString()}`,
      (res) => {
        if (res?.success) {
          resolve({
            rows: Array.isArray(res.results) ? res.results : [],
            totalCount: parseInt(res.totalCount || 0, 10),
          });
        } else {
          reject(new Error(res?.message || "Failed to fetch Input VAT"));
        }
      },
      (err) => reject(err),
    );
  });
}

async function fetchAllInputVatLines(args) {
  let page = 1;
  let all = [];
  let totalCount = Infinity;
  while (all.length < totalCount) {
    const batch = await fetchInputVatPage({
      ...args,
      page,
      pageSize: PAGE_SIZE,
    });
    all = all.concat(batch.rows);
    totalCount = Number.isFinite(batch.totalCount)
      ? batch.totalCount
      : all.length;
    if (!batch.rows.length) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

export default function InputVatReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const reportExportRef = useRef(null);
  const userId = user?.id || user?.user_id || "";

  const [fromDate, setFromDate] = useState(
    () =>
      searchParams.get("fromDate") ||
      moment().startOf("month").format("YYYY-MM-DD"),
  );
  const [toDate, setToDate] = useState(
    () => searchParams.get("toDate") || moment().format("YYYY-MM-DD"),
  );
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [paymentModeFilter, setPaymentModeFilter] = useState(
    () => searchParams.get("mode") || "",
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);

  const periodLabel = `${moment(fromDate).format("DD MMM YYYY")} – ${moment(
    toDate,
  ).format("DD MMM YYYY")}`;

  const runFetch = useCallback(async () => {
    if (!activeBusiness?.id || !userId) {
      if (!userId) toast.error("User session required to load Input VAT");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const allRows = await fetchAllInputVatLines({
        facilityId: activeBusiness.id,
        userId: String(userId),
        fromDate,
        toDate,
        search: search.trim(),
      });
      setRows(allRows);
    } catch (e) {
      console.error(e);
      setError("Unable to load Input VAT report");
      toast.error("Unable to load Input VAT report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeBusiness?.id, userId, fromDate, toDate, search]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (fromDate) next.set("fromDate", fromDate);
    if (toDate) next.set("toDate", toDate);
    if (search.trim()) next.set("search", search.trim());
    else next.delete("search");
    if (paymentModeFilter) next.set("mode", paymentModeFilter);
    else next.delete("mode");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, paymentModeFilter]);

  const paymentModeOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(formatMode(r.mode_of_payment)));
    return [...set].sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!paymentModeFilter) return rows;
    return rows.filter(
      (r) => formatMode(r.mode_of_payment) === paymentModeFilter,
    );
  }, [rows, paymentModeFilter]);

  const invoiceCount = useMemo(() => {
    const set = new Set(filteredRows.map((r) => r.invoice_no).filter(Boolean));
    return set.size;
  }, [filteredRows]);

  const totalQty = useMemo(
    () => filteredRows.reduce((s, r) => s + num(r.qty), 0),
    [filteredRows],
  );
  const totalLineAmount = useMemo(
    () => filteredRows.reduce((s, r) => s + num(r.line_total), 0),
    [filteredRows],
  );
  const totalVatAmount = useMemo(
    () => filteredRows.reduce((s, r) => s + num(r.vat_amount ?? r.vat), 0),
    [filteredRows],
  );
  const totalInclVat = totalLineAmount + totalVatAmount;

  const handleExportExcel = useCallback(async () => {
    if (!filteredRows.length) {
      toast.error("No rows to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Input VAT");
      const headers = [
        "Bill",
        "Date",
        "Supplier",
        "Supplier ID",
        "Item",
        "Qty",
        "Amount (₦)",
        "Input VAT (₦)",
        "Total incl. VAT (₦)",
      ];
      ws.columns = headers.map(() => ({ width: 16 }));
      let r = 1;
      ws.mergeCells(r, 1, r, headers.length);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, headers.length);
      ws.getCell(r, 1).value = "Input VAT";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, headers.length);
      ws.getCell(r, 1).value = `Period: ${periodLabel} · All amounts in ₦`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      headers.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF475569" },
        };
      });
      r++;

      filteredRows.forEach((row) => {
        const vat = num(row.vat_amount ?? row.vat);
        const line = num(row.line_total);
        const values = [
          row.invoice_no || "",
          row.invoice_date
            ? moment(row.invoice_date).format("DD MMM YYYY")
            : "",
          row.supplier_name || row.customer_name || "",
          row.supplier_no || row.customer_no || "",
          row.product_name || "",
          num(row.qty),
          line,
          vat,
          line + vat,
        ];
        values.forEach((val, i) => {
          const c = ws.getCell(r, i + 1);
          c.value = val;
          if (typeof val === "number" && i >= 5) c.numFmt = "#,##0.00";
        });
        r++;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `input-vat-${fromDate}-to-${toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate Excel");
    }
  }, [filteredRows, activeBusiness, periodLabel, fromDate, toDate]);

  const handleExportPdf = useCallback(async () => {
    const el = reportExportRef.current;
    if (!el) return;
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let y = 0;
      while (y < imgHeight) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -y, pageWidth, imgHeight);
        y += pageHeight;
      }
      pdf.save(`input-vat-${fromDate}-to-${toDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [fromDate, toDate]);

  return (
    <div className="space-y-3 p-1">
      <div className="bg-gray-100 rounded-lg px-2 py-2 no-print">
        <div className="mb-2 px-1">
          <h2 className="text-sm font-semibold text-gray-800">Input VAT</h2>
          <p className="text-xs text-gray-500">
            Purchase and expense bill lines with Input VAT for the selected
            period.
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-2 flex-wrap flex-1">
            <div>
              <label className="text-xs text-gray-600 block mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white"
              />
            </div>
            <div className="min-w-[180px]">
              <label className="text-xs text-gray-600 block mb-1">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runFetch();
                  }
                }}
                placeholder="Bill, supplier, item…"
                className="border rounded px-2 py-2 text-sm bg-white w-full"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="text-xs text-gray-600 block mb-1">
                Mode of Payment
              </label>
              <select
                value={paymentModeFilter}
                onChange={(e) => setPaymentModeFilter(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white w-full"
              >
                <option value="">All modes</option>
                {paymentModeOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={runFetch}
              disabled={loading || !activeBusiness?.id}
              className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
            >
              {loading ? "Loading..." : "Run Report"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300"
                  disabled={!filteredRows.length || loading}
                >
                  Export
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={handleExportExcel}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={pdfExporting}
                  onClick={handleExportPdf}
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
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => navigate("/app/expenses/billing")}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div
          ref={reportExportRef}
          className="bg-white border border-gray-200 rounded-xl overflow-hidden"
        >
          <BusinessDocumentHeader
            business={activeBusiness}
            title="Input VAT"
            numberLabel={`Period: ${periodLabel}`}
            extraLine="All amounts in ₦"
            date={new Date()}
            dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
            className="mb-0 border-b border-blue-950"
          />

          <div className="px-6 py-4 flex flex-wrap justify-between gap-2 text-sm text-gray-700">
            <p className="font-semibold">Input VAT</p>
            <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
              <p>{invoiceCount} bill(s)</p>
              <p>{filteredRows.length} line(s)</p>
              <p>
                Input VAT:{" "}
                <span className="font-semibold tabular-nums">
                  ₦{formatNumber1(totalVatAmount)}
                </span>
              </p>
              <p>
                Total incl. VAT:{" "}
                <span className="font-semibold tabular-nums">
                  ₦{formatNumber1(totalInclVat)}
                </span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-600 text-white">
                  <Th className="px-6">Bill</Th>
                  <Th>Date</Th>
                  <Th>Supplier</Th>
                  <Th>Item</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Amount (₦)</Th>
                  <Th align="right">Input VAT (₦)</Th>
                  <Th align="right" className="px-6">
                    Total incl. VAT (₦)
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const vat = num(row.vat_amount ?? row.vat);
                  const line = num(row.line_total);
                  return (
                    <tr
                      key={`${row.invoice_no}:${row.entry_id || idx}`}
                      className="border-b"
                    >
                      <Td className="px-6 font-mono text-sm font-medium">
                        {row.invoice_no || "—"}
                      </Td>
                      <Td>
                        {row.invoice_date
                          ? moment(row.invoice_date).format("DD MMM YYYY")
                          : "—"}
                      </Td>
                      <Td>
                        <div className="font-medium">
                          {row.supplier_name || row.customer_name || "—"}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {row.supplier_no || row.customer_no || ""}
                        </div>
                      </Td>
                      <Td>
                        <div>{row.product_name || "—"}</div>
                        {row.product_sku ? (
                          <div className="font-mono text-[11px] text-slate-400">
                            {row.product_sku}
                          </div>
                        ) : null}
                      </Td>
                      <Td align="right">{formatNumber1(row.qty)}</Td>
                      <Td align="right">{formatNumber1(line)}</Td>
                      <Td align="right">{formatNumber1(vat)}</Td>
                      <Td align="right" className="px-6 font-semibold">
                        {formatNumber1(line + vat)}
                      </Td>
                    </tr>
                  );
                })}
                {filteredRows.length > 0 && (
                  <tr className="bg-white font-semibold border-t">
                    <td className="py-4 px-6" colSpan={4}>
                      Total
                    </td>
                    <Td align="right">{formatNumber1(totalQty)}</Td>
                    <Td align="right">{formatNumber1(totalLineAmount)}</Td>
                    <Td align="right">{formatNumber1(totalVatAmount)}</Td>
                    <Td align="right" className="px-6">
                      {formatNumber1(totalInclVat)}
                    </Td>
                  </tr>
                )}
                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-sm text-gray-500"
                    >
                      No Input VAT lines found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
