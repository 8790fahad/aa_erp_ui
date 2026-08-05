import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import MultipleSelector from "@/components/ui/multiselect";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const PAGE_SIZE = 100;

export default function SalesLineReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const reportExportRef = useRef(null);

  const [fromDate, setFromDate] = useState(() =>
    searchParams.get("fromDate") ||
      moment().startOf("month").format("YYYY-MM-DD"),
  );
  const [toDate, setToDate] = useState(
    () => searchParams.get("toDate") || moment().format("YYYY-MM-DD"),
  );
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [branchFromUrl, setBranchFromUrl] = useState(
    () => searchParams.get("branchId") || "",
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [branches, setBranches] = useState([]);

  const userId = user?.id || user?.user_id || "";

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      () => {},
    );
  }, [activeBusiness?.id]);

  const branchOptions = branches.map((b) => ({
    value: String(b.id),
    label: b.branch_name,
  }));
  const selectedBranchIds = branchFromUrl
    ? branchFromUrl.split(",").filter(Boolean)
    : [];
  const selectedBranchOptions = branchOptions.filter((o) =>
    selectedBranchIds.includes(o.value),
  );

  const runFetch = useCallback(async () => {
    if (!activeBusiness?.id || !userId) {
      if (!userId) toast.error("User session required to load sales report");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const allRows = await fetchAllSalesLines({
        facilityId: activeBusiness.id,
        userId: String(userId),
        fromDate,
        toDate,
        search: search.trim(),
        branchId: branchFromUrl,
      });
      setRows(allRows);
      if (!allRows.length) {
        setError("");
      }
    } catch (e) {
      console.error(e);
      setError("Unable to load sales line report");
      toast.error("Unable to load sales line report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    activeBusiness?.id,
    userId,
    fromDate,
    toDate,
    search,
    branchFromUrl,
  ]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  const totalLineAmount = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.line_total) || 0), 0),
    [rows],
  );

  const periodLabel = useMemo(() => {
    if (!fromDate || !toDate) return "";
    const sameYear = moment(fromDate).year() === moment(toDate).year();
    if (sameYear) {
      return `${moment(fromDate).format("MMMM")} - ${moment(toDate).format(
        "MMMM YYYY",
      )}`;
    }
    return `${moment(fromDate).format("MMMM YYYY")} - ${moment(toDate).format(
      "MMMM YYYY",
    )}`;
  }, [fromDate, toDate]);

  const handleExportExcel = useCallback(async () => {
    if (!rows.length) {
      toast.error("No rows to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Sales Line Report");
      ws.columns = [
        { width: 16 },
        { width: 14 },
        { width: 28 },
        { width: 32 },
        { width: 10 },
        { width: 14 },
        { width: 16 },
      ];
      let r = 1;
      ws.mergeCells(r, 1, r, 7);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 7);
      ws.getCell(r, 1).value = "Sales Line Report";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 7);
      ws.getCell(r, 1).value = `Period: ${periodLabel} · All amounts in ₦`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = [
        "Invoice No.",
        "Date",
        "Customer",
        "Product",
        "Qty",
        "Unit Price (₦)",
        "Line Total (₦)",
      ];
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

      rows.forEach((row) => {
        ws.getCell(r, 1).value = row.invoice_no;
        ws.getCell(r, 2).value = row.invoice_date
          ? moment(row.invoice_date).format("DD-MMM-YYYY")
          : "";
        ws.getCell(r, 3).value = row.customer_name;
        ws.getCell(r, 4).value = row.product_name;
        ws.getCell(r, 5).value = row.qty;
        ws.getCell(r, 6).value = row.unit_price;
        ws.getCell(r, 6).numFmt = "#,##0.00";
        ws.getCell(r, 7).value = row.line_total;
        ws.getCell(r, 7).numFmt = "#,##0.00";
        r++;
      });

      ws.getCell(r, 1).value = "Total";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 7).value = totalLineAmount;
      ws.getCell(r, 7).numFmt = "#,##0.00";
      ws.getCell(r, 7).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-line-report-${fromDate}-to-${toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [rows, totalLineAmount, activeBusiness, periodLabel, fromDate, toDate]);

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
      pdf.save(`sales-line-report-${fromDate}-to-${toDate}.pdf`);
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
                placeholder="Invoice, customer, product…"
                className="border rounded px-2 py-2 text-sm bg-white w-full"
              />
            </div>
            {branches.length > 0 && (
              <div className="min-w-[180px]">
                <label className="text-xs text-gray-600 block mb-1">
                  Branch
                </label>
                <MultipleSelector
                  value={selectedBranchOptions}
                  onChange={(opts) => {
                    setBranchFromUrl((opts || []).map((o) => o.value).join(","));
                  }}
                  options={branchOptions}
                  placeholder="All Warehouses"
                  hidePlaceholderWhenSelected
                  className="bg-white"
                />
              </div>
            )}
            <Button
              onClick={runFetch}
              disabled={loading || !activeBusiness?.id}
              className="bg-[#4267B2] hover:bg-[#365899] text-white"
            >
              {loading ? "Loading..." : "Run Report"}
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
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => navigate("/app/sales/invoices")}
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
            title="Sales Line Report"
            numberLabel={`Period: ${periodLabel}`}
            extraLine="All amounts in ₦"
            date={new Date()}
            dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
            className="mb-0 border-b border-blue-950"
          />

          <div className="px-6 py-4 flex justify-between text-sm text-gray-700">
            <p className="font-semibold">Invoice line details</p>
            <p>{rows.length} line(s)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-600 text-white">
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Invoice No.
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide border-b border-slate-500 whitespace-nowrap min-w-[100px]">
                    Date
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Customer
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Product
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Qty
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Unit Price (₦)
                  </th>
                  <th className="text-right py-3 px-6 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Line Total (₦)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.invoice_no}-${idx}`} className="border-b">
                    <td className="py-3 px-6 font-semibold">
                      {r.invoice_no ? (
                        <Link
                          to={`/app/sales/invoice-preview?sale_code=${encodeURIComponent(r.invoice_no)}`}
                          className="text-blue-700 hover:underline"
                        >
                          {r.invoice_no}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.invoice_date
                        ? moment(r.invoice_date).format("DD-MMM-YYYY")
                        : "—"}
                    </td>
                    <td className="py-3 px-3">{r.customer_name || "—"}</td>
                    <td className="py-3 px-3">{r.product_name || "—"}</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatNumber1(r.qty || 0)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatNumber1(r.unit_price || 0)}
                    </td>
                    <td className="py-3 px-6 text-right tabular-nums font-semibold">
                      {formatNumber1(r.line_total || 0)}
                    </td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="bg-white font-semibold border-t">
                    <td className="py-4 px-6" colSpan={6}>
                      Total
                    </td>
                    <td className="py-4 px-6 text-right tabular-nums">
                      {formatNumber1(totalLineAmount)}
                    </td>
                  </tr>
                )}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-sm text-gray-500"
                    >
                      No sales lines found for this period.
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

async function fetchAllSalesLines({
  facilityId,
  userId,
  fromDate,
  toDate,
  search,
  branchId,
}) {
  let page = 1;
  let all = [];
  let totalCount = Infinity;
  while (all.length < totalCount) {
    const batch = await fetchSalesLinePage({
      facilityId,
      userId,
      fromDate,
      toDate,
      search,
      branchId,
      page,
      pageSize: PAGE_SIZE,
    });
    all = all.concat(batch.rows);
    totalCount = Number.isFinite(batch.totalCount)
      ? batch.totalCount
      : all.length;
    if (!batch.rows.length) break;
    page += 1;
  }
  return all;
}

function fetchSalesLinePage({
  facilityId,
  userId,
  fromDate,
  toDate,
  search,
  branchId,
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
    if (branchId) params.set("branchId", branchId);

    _fetchApi(
      `/api/v1/transactions/sales-line-report?${params.toString()}`,
      (res) => {
        if (res?.success) {
          resolve({
            rows: Array.isArray(res.results) ? res.results : [],
            totalCount: parseInt(res.totalCount || 0, 10),
          });
        } else {
          reject(new Error(res?.message || "Failed to fetch sales lines"));
        }
      },
      (err) => reject(err),
    );
  });
}
