import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
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
import { toast } from "sonner";
import moment from "moment";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PropTypes from "prop-types";

const PAGE_SIZE = 100;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const statusBadgeClass = (status) => {
  if (status === "Paid") return "bg-green-100 text-green-800";
  if (status === "Partial") return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
};

export default function SalesInvoicesReport() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();
  const location = useLocation();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = useRef(null);

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const defaultFrom = new Date(today.getFullYear(), 0, 1)
      .toISOString()
      .split("T")[0];
    setFromDate(location.state?.fromDate || defaultFrom);
    setToDate(location.state?.toDate || todayStr);
  }, [location.state]);

  const runFetch = useCallback(async () => {
    if (!facilityId || !fromDate || !toDate) return;
    setLoading(true);
    setError("");
    try {
      const allSales = await fetchAllSalesInvoices(facilityId);
      const outstanding = await fetchOutstandingInvoices(
        facilityId,
        user?.id || user?.user_id || "",
      );
      const outstandingByRef = new Map(
        outstanding
          .filter((x) => x?.invoice_ref)
          .map((x) => [
            String(x.invoice_ref),
            toNum(x.amount_due ?? x.balance_due),
          ]),
      );

      const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
      const toTs = new Date(`${toDate}T23:59:59`).getTime();

      const mapped = allSales
        .filter((inv) => {
          const dt = inv.transaction_date || inv.invoice_date || inv.created_at;
          if (!dt) return false;
          const ts = new Date(dt).getTime();
          return Number.isFinite(ts) && ts >= fromTs && ts <= toTs;
        })
        .map((inv) => {
          const customerName = String(inv.customerName || "").trim();
          if (!customerName) return null;
          const amount = toNum(inv.amount || inv.total);
          const due = Math.max(
            0,
            outstandingByRef.get(String(inv.invoice_ref)) || 0,
          );
          const paid = Math.max(0, Math.min(amount, amount - due));
          const status = due <= 0.01 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
          return {
            invoiceNo: inv.invoice_ref || "-",
            customer: customerName,
            customerNo: inv.ref_number || "-",
            date: inv.transaction_date || inv.invoice_date || "",
            dueDate: inv.due_date || "",
            amount,
            paid,
            balance: due,
            status,
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setRows(mapped);
    } catch (e) {
      console.error(e);
      setError("Unable to load sales invoice report");
      toast.error("Unable to load sales invoice report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [facilityId, fromDate, toDate, user?.id, user?.user_id]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          amount: acc.amount + r.amount,
          paid: acc.paid + r.paid,
          balance: acc.balance + r.balance,
        }),
        { amount: 0, paid: 0, balance: 0 },
      ),
    [rows],
  );

  const collectionProgress = useMemo(() => {
    const bucket = rows.reduce(
      (acc, r) => {
        if (r.status === "Paid") acc.paid += r.amount;
        else if (r.status === "Partial") acc.partial += r.amount;
        else acc.unpaid += r.amount;
        return acc;
      },
      { paid: 0, partial: 0, unpaid: 0 },
    );
    const total = bucket.paid + bucket.partial + bucket.unpaid;
    const pct = (val) => (total > 0 ? Math.round((val / total) * 100) : 0);
    return {
      ...bucket,
      total,
      paidPct: pct(bucket.paid),
      partialPct: pct(bucket.partial),
      unpaidPct: pct(bucket.unpaid),
    };
  }, [rows]);

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
      const ws = workbook.addWorksheet("Sales Invoice Report");
      ws.columns = [
        { width: 18 },
        { width: 30 },
        { width: 14 },
        { width: 14 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 12 },
      ];
      let r = 1;
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value = "Sales Invoice Report";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 8);
      ws.getCell(r, 1).value = `Period: ${periodLabel} · All amounts in ₦`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = [
        "Invoice #",
        "Customer",
        "Date",
        "Due date",
        "Amount (₦)",
        "Paid (₦)",
        "Balance (₦)",
        "Status",
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

      rows.forEach((row) => {
        ws.getCell(r, 1).value = row.invoiceNo;
        ws.getCell(r, 2).value = `${row.customer} (${row.customerNo})`;
        ws.getCell(r, 3).value = row.date
          ? moment(row.date).format("DD/MM/YYYY")
          : "";
        ws.getCell(r, 4).value = row.dueDate
          ? moment(row.dueDate).format("DD/MM/YYYY")
          : "";
        ws.getCell(r, 5).value = row.amount;
        ws.getCell(r, 5).numFmt = "#,##0.00";
        ws.getCell(r, 6).value = row.paid;
        ws.getCell(r, 6).numFmt = "#,##0.00";
        ws.getCell(r, 7).value = row.balance;
        ws.getCell(r, 7).numFmt = "#,##0.00";
        ws.getCell(r, 8).value = row.status;
        r++;
      });

      ws.getCell(r, 1).value = "Total";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 5).value = totals.amount;
      ws.getCell(r, 5).numFmt = "#,##0.00";
      ws.getCell(r, 5).font = { bold: true };
      ws.getCell(r, 6).value = totals.paid;
      ws.getCell(r, 6).numFmt = "#,##0.00";
      ws.getCell(r, 6).font = { bold: true };
      ws.getCell(r, 7).value = totals.balance;
      ws.getCell(r, 7).numFmt = "#,##0.00";
      ws.getCell(r, 7).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-invoice-report-${fromDate}-to-${toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [rows, totals, activeBusiness, periodLabel, fromDate, toDate]);

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
      pdf.save(`sales-invoice-report-${fromDate}-to-${toDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [fromDate, toDate]);

  return (
    <div className="space-y-3">
      <div className="bg-gray-100 rounded-lg px-2 py-2 no-print">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-2 flex-wrap">
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
            <Button onClick={runFetch} disabled={loading || !facilityId}>
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
            onClick={() => navigate("/app/reports/accounting-reports")}
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
            title="Sales Invoice Report"
            numberLabel={`Period: ${periodLabel}`}
            extraLine="All amounts in ₦"
            date={new Date()}
            dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
            className="mb-0"
          />
          <div className="px-6 py-4 flex justify-between text-sm text-gray-700">
            <p className="font-semibold">Invoice details</p>
            <p>{rows.length} invoices</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-600 text-white">
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Invoice #
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Customer
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide border-b border-slate-500 whitespace-nowrap min-w-[90px]">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide border-b border-slate-500 whitespace-nowrap min-w-[110px]">
                    Due Date
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Amount (₦)
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Paid (₦)
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Balance (₦)
                  </th>
                  <th className="text-center py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.invoiceNo}-${idx}`} className="border-b">
                    <td className="py-3 px-6 font-semibold">{r.invoiceNo}</td>
                    <td className="py-3 px-3">
                      <span className="block">{r.customer}</span>
                      <span className="text-xs text-gray-500">
                        {r.customerNo}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.date ? moment(r.date).format("MMM D") : "-"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.dueDate ? moment(r.dueDate).format("MMM D") : "-"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatNumber1(r.amount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {formatNumber1(r.paid)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {formatNumber1(r.balance)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                          r.status,
                        )}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="bg-white font-semibold border-t">
                    <td className="py-4 px-6" colSpan={4}>
                      Total
                    </td>
                    <td className="py-4 px-3 text-right">
                      {formatNumber1(totals.amount)}
                    </td>
                    <td className="py-4 px-3 text-right">
                      {formatNumber1(totals.paid)}
                    </td>
                    <td className="py-4 px-3 text-right">
                      {formatNumber1(totals.balance)}
                    </td>
                    <td className="py-4 px-3" />
                  </tr>
                )}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-sm text-gray-500"
                    >
                      No sales invoices found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mx-6 mt-3 mb-3 rounded-xl border bg-white overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-xl font-bold text-gray-900">
                Collection progress
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <ProgressRow
                label="Paid"
                amount={collectionProgress.paid}
                percent={collectionProgress.paidPct}
                barClass="bg-green-600"
              />
              <ProgressRow
                label="Partial"
                amount={collectionProgress.partial}
                percent={collectionProgress.partialPct}
                barClass="bg-amber-500"
              />
              <ProgressRow
                label="Unpaid"
                amount={collectionProgress.unpaid}
                percent={collectionProgress.unpaidPct}
                barClass="bg-red-500"
              />
            </div>
          </div>
          <div className="px-6 pb-4 flex flex-wrap gap-4 text-sm text-gray-700">
            <LegendPill
              label="Paid"
              desc="Fully settled"
              className="bg-green-100 text-green-800"
            />
            <LegendPill
              label="Partial"
              desc="Part payment received"
              className="bg-amber-100 text-amber-800"
            />
            <LegendPill
              label="Unpaid"
              desc="No payment yet"
              className="bg-red-100 text-red-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchAllSalesInvoices(facilityId) {
  let page = 1;
  let all = [];
  let totalCount = Infinity;
  while (all.length < totalCount) {
    const batch = await fetchSalesPage(facilityId, page, PAGE_SIZE);
    all = all.concat(batch.rows);
    totalCount = Number.isFinite(batch.totalCount)
      ? batch.totalCount
      : all.length;
    if (!batch.rows.length) break;
    page += 1;
  }
  return all;
}

function fetchSalesPage(facilityId, page, pageSize) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      type: "sales",
      page: String(page),
      pageSize: String(pageSize),
    });
    _fetchApi(
      `/api/v1/transactions/get-all-transactions-data?${params.toString()}`,
      (res) => {
        if (res?.success) {
          resolve({
            rows: Array.isArray(res.results) ? res.results : [],
            totalCount: toNum(res.totalCount),
          });
        } else {
          reject(new Error(res?.message || "Failed to fetch sales invoices"));
        }
      },
      (err) => reject(err),
    );
  });
}

function fetchOutstandingInvoices(facilityId, userId) {
  return new Promise((resolve, reject) => {
    _fetchApi(
      `/api/v1/get-outstanding-invoices?facilityId=${encodeURIComponent(
        facilityId,
      )}&userId=${encodeURIComponent(userId || "")}`,
      (res) => {
        if (res?.success)
          resolve(Array.isArray(res.results) ? res.results : []);
        else
          reject(
            new Error(res?.message || "Failed to fetch outstanding invoices"),
          );
      },
      (err) => reject(err),
    );
  });
}

function ProgressRow({ label, amount, percent, barClass }) {
  return (
    <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
      <p className="text-2xl font-semibold text-gray-800 leading-none">
        {label}
      </p>
      <div className="h-3 rounded-full bg-amber-50 overflow-hidden">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-2xl font-semibold text-gray-900 whitespace-nowrap leading-none">
        ₦{formatNumber1(amount)} · {percent}%
      </p>
    </div>
  );
}

function LegendPill({ label, desc, className }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${className}`}
      >
        {label}
      </span>
      <span>{desc}</span>
    </div>
  );
}

ProgressRow.propTypes = {
  label: PropTypes.string.isRequired,
  amount: PropTypes.number.isRequired,
  percent: PropTypes.number.isRequired,
  barClass: PropTypes.string.isRequired,
};

LegendPill.propTypes = {
  label: PropTypes.string.isRequired,
  desc: PropTypes.string.isRequired,
  className: PropTypes.string.isRequired,
};
