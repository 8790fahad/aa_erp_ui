import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import moment from "moment";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MultipleSelector from "@/components/ui/multiselect";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const PAGE_SIZE = 100;

const REPORT_VIEWS = [
  { key: "summary", label: "Sales Summary" },
  { key: "detail", label: "Sales Detail" },
  { key: "daily", label: "Daily Sales" },
  { key: "monthly", label: "Monthly/Annual Sales" },
  { key: "customer", label: "Sales by Customer" },
  { key: "product", label: "Sales by Product" },
  { key: "category", label: "Sales by Category" },
  { key: "salesperson", label: "Sales by Salesperson" },
  { key: "branch", label: "Sales by Branch" },
];

function num(v) {
  return parseFloat(v) || 0;
}

function lineVat(row) {
  return num(row.vat_amount ?? row.vat);
}

function aggregateBy(rows, keyFn, labelFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const prev = map.get(key) || {
      key,
      label: labelFn(row),
      lines: 0,
      invoices: new Set(),
      qty: 0,
      line_total: 0,
      vat_amount: 0,
    };
    prev.lines += 1;
    if (row.invoice_no) prev.invoices.add(row.invoice_no);
    prev.qty += num(row.qty);
    prev.line_total += num(row.line_total);
    prev.vat_amount += lineVat(row);
    if (!prev.label) prev.label = labelFn(row);
    map.set(key, prev);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      invoice_count: r.invoices.size,
      total_incl_vat: r.line_total + r.vat_amount,
    }))
    .sort((a, b) => b.line_total - a.line_total);
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

export default function SalesLineReport({ variant = "sales" } = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const reportExportRef = useRef(null);
  const isVatReport = variant === "vat";

  const [reportView, setReportView] = useState(() =>
    isVatReport ? "detail" : searchParams.get("view") || "detail",
  );
  const [fromDate, setFromDate] = useState(
    () =>
      searchParams.get("fromDate") ||
      moment().startOf("month").format("YYYY-MM-DD"),
  );
  const [toDate, setToDate] = useState(
    () => searchParams.get("toDate") || moment().format("YYYY-MM-DD"),
  );
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [category, setCategory] = useState(
    () => searchParams.get("category") || "",
  );
  const [categories, setCategories] = useState([]);
  const [branchFromUrl, setBranchFromUrl] = useState(
    () => searchParams.get("branchId") || "",
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [branches, setBranches] = useState([]);
  const [vatLedger, setVatLedger] = useState(null);
  const [vatLedgerLoading, setVatLedgerLoading] = useState(false);
  const [vatLedgerModalOpen, setVatLedgerModalOpen] = useState(false);

  const userId = user?.id || user?.user_id || "";
  const vatAccountCode = String(
    activeBusiness?.vat_account_code || "",
  ).trim();

  const activeViewMeta = isVatReport
    ? { key: "detail", label: "VAT Report" }
    : REPORT_VIEWS.find((v) => v.key === reportView) || REPORT_VIEWS[1];

  useEffect(() => {
    if (isVatReport && reportView !== "detail") {
      setReportView("detail");
    }
  }, [isVatReport, reportView]);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      () => {},
    );
    _fetchApi(
      `/api/products/categories?facilityId=${activeBusiness.id}`,
      (res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setCategories(
          list
            .map((c) =>
              typeof c === "string"
                ? c
                : String(c.category || c.name || "").trim(),
            )
            .filter(Boolean),
        );
      },
      () => setCategories([]),
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
        category: category.trim(),
        branchId: branchFromUrl,
      });
      setRows(allRows);
    } catch (e) {
      console.error(e);
      setError("Unable to load sales report");
      toast.error("Unable to load sales report");
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
    category,
    branchFromUrl,
  ]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  useEffect(() => {
    if (!isVatReport || !activeBusiness?.id || !vatAccountCode) {
      setVatLedger(null);
      return;
    }
    setVatLedgerLoading(true);
    _postApi(
      "/account/account-ledger-report",
      {
        facilityId: activeBusiness.id,
        fromDate,
        toDate,
        accountCodes: [vatAccountCode],
      },
      (res) => {
        setVatLedgerLoading(false);
        if (res?.success && Array.isArray(res.results) && res.results.length) {
          setVatLedger(res.results[0]);
        } else {
          setVatLedger(null);
        }
      },
      () => {
        setVatLedgerLoading(false);
        setVatLedger(null);
      },
    );
  }, [isVatReport, activeBusiness?.id, vatAccountCode, fromDate, toDate]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (!isVatReport) next.set("view", reportView);
    else next.delete("view");
    if (fromDate) next.set("fromDate", fromDate);
    if (toDate) next.set("toDate", toDate);
    if (category) next.set("category", category);
    else next.delete("category");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportView, isVatReport]);

  const totalLineAmount = useMemo(
    () => rows.reduce((s, r) => s + num(r.line_total), 0),
    [rows],
  );
  const totalVatAmount = useMemo(
    () => rows.reduce((s, r) => s + lineVat(r), 0),
    [rows],
  );
  const totalInclVat = useMemo(
    () => totalLineAmount + totalVatAmount,
    [totalLineAmount, totalVatAmount],
  );
  const totalQty = useMemo(
    () => rows.reduce((s, r) => s + num(r.qty), 0),
    [rows],
  );
  const invoiceCount = useMemo(
    () => new Set(rows.map((r) => r.invoice_no).filter(Boolean)).size,
    [rows],
  );

  const periodLabel = useMemo(() => {
    if (!fromDate || !toDate) return "";
    const from = moment(fromDate);
    const to = moment(toDate);
    if (from.isSame(to, "day")) {
      return from.format("DD MMMM YYYY");
    }
    if (from.year() === to.year()) {
      return `${from.format("DD MMMM")} - ${to.format("DD MMMM YYYY")}`;
    }
    return `${from.format("DD MMMM YYYY")} - ${to.format("DD MMMM YYYY")}`;
  }, [fromDate, toDate]);

  const vatLedgerBreakdown = useMemo(() => {
    if (!vatLedger) return null;
    const txns = vatLedger.transactions || [];
    const nature = String(vatLedger.account_nature || "LIABILITY")
      .trim()
      .toUpperCase();
    const creditNormal = ["LIABILITY", "EQUITY", "REVENUE"].includes(nature);
    const isOutput = (t) =>
      /output\s*vat/i.test(
        String(t.transaction_description || t.account_description || ""),
      );
    const isInput = (t) =>
      /input\s*vat/i.test(
        String(t.transaction_description || t.account_description || ""),
      );
    const opening = Number(vatLedger.opening_balance || 0);
    // Standard signed movement: liability/equity/revenue = Cr − Dr; asset/expense = Dr − Cr
    const signedMove = (dr, cr) =>
      creditNormal ? Number(cr || 0) - Number(dr || 0) : Number(dr || 0) - Number(cr || 0);
    let running = opening;
    const rowsWithBalance = txns.map((t) => {
      running += signedMove(t.dr, t.cr);
      return { ...t, running_balance: Number(running.toFixed(4)) };
    });
    const closeBal =
      opening + signedMove(vatLedger.total_debit, vatLedger.total_credit);

    const formatSide = (signed) => {
      const abs = Math.abs(Number(signed) || 0);
      if (abs < 0.005) {
        return {
          text: formatNumber1(0),
          side: "",
          colorClass: "text-slate-700",
        };
      }
      // Positive = normal side for account nature
      const onNormalSide = Number(signed) > 0;
      const side = creditNormal
        ? onNormalSide
          ? "Cr"
          : "Dr"
        : onNormalSide
          ? "Dr"
          : "Cr";
      // Cr = amount owed / payable (emerald); Dr on liability = credit to business / recoverable (sky)
      const colorClass =
        side === "Cr" ? "text-emerald-700" : "text-sky-700";
      return { text: formatNumber1(abs), side, colorClass };
    };

    const closeSide = formatSide(Number(closeBal.toFixed(4)));
    // Liability: Cr = amount to pay; Dr = recoverable / credit for the business
    const closeLabel =
      closeSide.side === "Cr"
        ? "Amount to pay"
        : closeSide.side === "Dr"
          ? "Credit for business"
          : "Balance";

    return {
      txns: rowsWithBalance,
      isOutput,
      isInput,
      nature,
      creditNormal,
      formatSide,
      closeLabel,
      closeSide,
      closeBal: Number(closeBal.toFixed(4)),
      opening,
      totalDebit: Number(vatLedger.total_debit || 0),
      totalCredit: Number(vatLedger.total_credit || 0),
      description: vatLedger.description || "VAT Account",
    };
  }, [vatLedger]);

  const byCustomer = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) => r.customer_no || r.customer_name || "—",
        (r) => r.customer_name || r.customer_no || "—",
      ),
    [rows],
  );
  const byProduct = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) => r.product_sku || r.product_name || "—",
        (r) => r.product_name || r.product_sku || "—",
      ).map((r) => {
        const sample = rows.find(
          (x) => (x.product_sku || x.product_name || "—") === r.key,
        );
        return {
          ...r,
          sub: sample?.product_sku || "",
          category: sample?.product_category || sample?.category || "",
        };
      }),
    [rows],
  );
  const byCategory = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) => r.product_category || r.category || "Uncategorized",
        (r) => r.product_category || r.category || "Uncategorized",
      ),
    [rows],
  );
  const bySalesperson = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) => r.salesperson_id || r.salesperson_name || "—",
        (r) => r.salesperson_name || r.salesperson_id || "—",
      ),
    [rows],
  );
  const byBranch = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) => String(r.branch_id || r.branch_name || "—"),
        (r) => r.branch_name || `Branch ${r.branch_id}` || "—",
      ),
    [rows],
  );
  const byDaily = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) =>
          r.invoice_date
            ? moment(r.invoice_date).format("YYYY-MM-DD")
            : "—",
        (r) =>
          r.invoice_date
            ? moment(r.invoice_date).format("DD-MMM-YYYY")
            : "—",
      ).sort((a, b) => String(b.key).localeCompare(String(a.key))),
    [rows],
  );
  const byMonthly = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) =>
          r.invoice_date ? moment(r.invoice_date).format("YYYY-MM") : "—",
        (r) =>
          r.invoice_date ? moment(r.invoice_date).format("MMM YYYY") : "—",
      )
        .map((r) => ({
          ...r,
          year: r.key !== "—" ? r.key.slice(0, 4) : "—",
          month: r.key !== "—" ? moment(r.key, "YYYY-MM").format("MMMM") : "—",
        }))
        .sort((a, b) => String(b.key).localeCompare(String(a.key))),
    [rows],
  );
  const byAnnual = useMemo(
    () =>
      aggregateBy(
        rows,
        (r) =>
          r.invoice_date ? moment(r.invoice_date).format("YYYY") : "—",
        (r) =>
          r.invoice_date ? moment(r.invoice_date).format("YYYY") : "—",
      ).sort((a, b) => String(b.key).localeCompare(String(a.key))),
    [rows],
  );

  const exportRows = useMemo(() => {
    switch (reportView) {
      case "customer":
        return {
          headers: [
            "Customer",
            "Invoices",
            "Lines",
            "Qty",
            "Sales (₦)",
            "VAT (₦)",
            "Total incl. VAT (₦)",
          ],
          rows: byCustomer.map((r) => [
            r.label,
            r.invoice_count,
            r.lines,
            r.qty,
            r.line_total,
            r.vat_amount,
            r.total_incl_vat,
          ]),
        };
      case "product":
        return {
          headers: [
            "Product",
            "SKU",
            "Category",
            "Qty",
            "Sales (₦)",
            "VAT (₦)",
            "Total incl. VAT (₦)",
          ],
          rows: byProduct.map((r) => [
            r.label,
            r.sub,
            r.category,
            r.qty,
            r.line_total,
            r.vat_amount,
            r.total_incl_vat,
          ]),
        };
      case "category":
        return {
          headers: [
            "Category",
            "Invoices",
            "Lines",
            "Qty",
            "Sales (₦)",
            "VAT (₦)",
            "Total incl. VAT (₦)",
          ],
          rows: byCategory.map((r) => [
            r.label,
            r.invoice_count,
            r.lines,
            r.qty,
            r.line_total,
            r.vat_amount,
            r.total_incl_vat,
          ]),
        };
      case "salesperson":
        return {
          headers: [
            "Salesperson",
            "Invoices",
            "Lines",
            "Qty",
            "Sales (₦)",
            "VAT (₦)",
            "Total incl. VAT (₦)",
          ],
          rows: bySalesperson.map((r) => [
            r.label,
            r.invoice_count,
            r.lines,
            r.qty,
            r.line_total,
            r.vat_amount,
            r.total_incl_vat,
          ]),
        };
      case "branch":
        return {
          headers: [
            "Branch",
            "Invoices",
            "Lines",
            "Qty",
            "Sales (₦)",
            "VAT (₦)",
            "Total incl. VAT (₦)",
          ],
          rows: byBranch.map((r) => [
            r.label,
            r.invoice_count,
            r.lines,
            r.qty,
            r.line_total,
            r.vat_amount,
            r.total_incl_vat,
          ]),
        };
      case "daily":
        return {
          headers: [
            "Date",
            "Invoices",
            "Lines",
            "Qty",
            "Sales (₦)",
            "VAT (₦)",
            "Total incl. VAT (₦)",
          ],
          rows: byDaily.map((r) => [
            r.label,
            r.invoice_count,
            r.lines,
            r.qty,
            r.line_total,
            r.vat_amount,
            r.total_incl_vat,
          ]),
        };
      case "monthly":
        return {
          headers: [
            "Year",
            "Month",
            "Invoices",
            "Lines",
            "Qty",
            "Sales (₦)",
            "VAT (₦)",
            "Total incl. VAT (₦)",
          ],
          rows: [
            ...byMonthly.map((r) => [
              r.year,
              r.month,
              r.invoice_count,
              r.lines,
              r.qty,
              r.line_total,
              r.vat_amount,
              r.total_incl_vat,
            ]),
            [],
            ["Annual totals"],
            ...byAnnual.map((r) => [
              r.label,
              "Full year",
              r.invoice_count,
              r.lines,
              r.qty,
              r.line_total,
              r.vat_amount,
              r.total_incl_vat,
            ]),
          ],
        };
      case "summary":
        return {
          headers: ["Metric", "Value"],
          rows: [
            ["Invoices", invoiceCount],
            ["Lines", rows.length],
            ["Quantity", totalQty],
            ["Sales (ex-VAT)", totalLineAmount],
            ["VAT", totalVatAmount],
            ["Total incl. VAT", totalInclVat],
          ],
        };
      default:
        return {
          headers: [
            "Invoice No.",
            "Date",
            "Customer",
            "Product",
            "Category",
            "Salesperson",
            "Branch",
            "Qty",
            "Unit Price (₦)",
            "VAT (₦)",
            "Line Total (₦)",
          ],
          rows: rows.map((row) => [
            row.invoice_no,
            row.invoice_date
              ? moment(row.invoice_date).format("DD-MMM-YYYY")
              : "",
            row.customer_name,
            row.product_name,
            row.product_category || row.category || "",
            row.salesperson_name || "",
            row.branch_name || "",
            row.qty,
            row.unit_price,
            lineVat(row),
            row.line_total,
          ]),
        };
    }
  }, [
    reportView,
    rows,
    byCustomer,
    byProduct,
    byCategory,
    bySalesperson,
    byBranch,
    byDaily,
    byMonthly,
    byAnnual,
    invoiceCount,
    totalQty,
    totalLineAmount,
    totalVatAmount,
    totalInclVat,
  ]);

  const handleExportExcel = useCallback(async () => {
    if (!rows.length && reportView !== "summary") {
      toast.error("No rows to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(activeViewMeta.label.slice(0, 31));
      const colCount = Math.max(exportRows.headers.length, 2);
      ws.columns = Array.from({ length: colCount }, () => ({ width: 16 }));
      let r = 1;
      ws.mergeCells(r, 1, r, colCount);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, colCount);
      ws.getCell(r, 1).value = activeViewMeta.label;
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, colCount);
      ws.getCell(r, 1).value = `Period: ${periodLabel} · All amounts in ₦${
        category ? ` · Category: ${category}` : ""
      }`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      exportRows.headers.forEach((h, i) => {
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

      exportRows.rows.forEach((row) => {
        if (!row.length) {
          r++;
          return;
        }
        row.forEach((val, i) => {
          const c = ws.getCell(r, i + 1);
          c.value = val;
          if (typeof val === "number" && i > 0) c.numFmt = "#,##0.00";
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
      a.download = `${isVatReport ? "vat-report" : `sales-${reportView}`}-${fromDate}-to-${toDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [
    rows.length,
    reportView,
    isVatReport,
    activeViewMeta,
    exportRows,
    activeBusiness,
    periodLabel,
    category,
    fromDate,
    toDate,
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
      pdf.save(
        `${isVatReport ? "vat-report" : `sales-${reportView}`}-${fromDate}-to-${toDate}.pdf`,
      );
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [fromDate, toDate, reportView, isVatReport]);

  const renderAggTable = (items, firstHeader, options = {}) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-600 text-white">
            <Th className="px-6">{firstHeader}</Th>
            {options.showSub && <Th>{options.subHeader || "SKU"}</Th>}
            {options.showCategory && <Th>Category</Th>}
            <Th align="right">Invoices</Th>
            <Th align="right">Lines</Th>
            <Th align="right">Qty</Th>
            <Th align="right">Sales (₦)</Th>
            <Th align="right">VAT (₦)</Th>
            <Th align="right" className="px-6">
              Total incl. VAT (₦)
            </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.key} className="border-b">
              <Td className="px-6 font-medium">{r.label}</Td>
              {options.showSub && (
                <Td className="text-gray-500 text-sm">{r.sub || "—"}</Td>
              )}
              {options.showCategory && (
                <Td>{r.category || "—"}</Td>
              )}
              <Td align="right">{formatNumber1(r.invoice_count)}</Td>
              <Td align="right">{formatNumber1(r.lines)}</Td>
              <Td align="right">{formatNumber1(r.qty)}</Td>
              <Td align="right">{formatNumber1(r.line_total)}</Td>
              <Td align="right">{formatNumber1(r.vat_amount)}</Td>
              <Td align="right" className="px-6 font-semibold">
                {formatNumber1(r.total_incl_vat)}
              </Td>
            </tr>
          ))}
          {items.length > 0 && (
            <tr className="bg-white font-semibold border-t">
              <td
                className="py-4 px-6"
                colSpan={
                  1 +
                  (options.showSub ? 1 : 0) +
                  (options.showCategory ? 1 : 0) +
                  2
                }
              >
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
          {items.length === 0 && (
            <tr>
              <td
                colSpan={9}
                className="py-12 text-center text-sm text-gray-500"
              >
                No sales found for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderReportBody = () => {
    if (reportView === "summary") {
      return (
        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Invoices", value: invoiceCount, money: false },
              { label: "Lines", value: rows.length, money: false },
              { label: "Quantity", value: totalQty, money: false },
              { label: "Sales (ex-VAT)", value: totalLineAmount, money: true },
              { label: "VAT", value: totalVatAmount, money: true },
              { label: "Total incl. VAT", value: totalInclVat, money: true },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-gray-200 bg-slate-50 px-3 py-3"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {card.label}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">
                  {card.money
                    ? `₦${formatNumber1(card.value)}`
                    : formatNumber1(card.value)}
                </p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">
              Top categories
            </h4>
            {renderAggTable(byCategory.slice(0, 8), "Category")}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">
              Top products
            </h4>
            {renderAggTable(byProduct.slice(0, 8), "Product", {
              showSub: true,
              showCategory: true,
            })}
          </div>
        </div>
      );
    }

    if (reportView === "daily") {
      return renderAggTable(byDaily, "Date");
    }
    if (reportView === "monthly") {
      return (
        <div className="space-y-6">
          <div>
            <h4 className="px-6 pt-4 mb-2 text-sm font-semibold text-gray-800">
              Monthly sales
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-600 text-white">
                    <Th className="px-6">Year</Th>
                    <Th>Month</Th>
                    <Th align="right">Invoices</Th>
                    <Th align="right">Lines</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Sales (₦)</Th>
                    <Th align="right">VAT (₦)</Th>
                    <Th align="right" className="px-6">
                      Total incl. VAT (₦)
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {byMonthly.map((r) => (
                    <tr key={r.key} className="border-b">
                      <Td className="px-6">{r.year}</Td>
                      <Td className="font-medium">{r.month}</Td>
                      <Td align="right">{formatNumber1(r.invoice_count)}</Td>
                      <Td align="right">{formatNumber1(r.lines)}</Td>
                      <Td align="right">{formatNumber1(r.qty)}</Td>
                      <Td align="right">{formatNumber1(r.line_total)}</Td>
                      <Td align="right">{formatNumber1(r.vat_amount)}</Td>
                      <Td align="right" className="px-6 font-semibold">
                        {formatNumber1(r.total_incl_vat)}
                      </Td>
                    </tr>
                  ))}
                  {byMonthly.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-12 text-center text-sm text-gray-500"
                      >
                        No sales found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className="px-6 mb-2 text-sm font-semibold text-gray-800">
              Annual totals
            </h4>
            {renderAggTable(byAnnual, "Year")}
          </div>
        </div>
      );
    }
    if (reportView === "customer") return renderAggTable(byCustomer, "Customer");
    if (reportView === "product") {
      return renderAggTable(byProduct, "Product", {
        showSub: true,
        showCategory: true,
      });
    }
    if (reportView === "category") return renderAggTable(byCategory, "Category");
    if (reportView === "salesperson") {
      return renderAggTable(bySalesperson, "Salesperson");
    }
    if (reportView === "branch") return renderAggTable(byBranch, "Branch");

    // Sales Detail (default)
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-600 text-white">
              <Th className="px-6">Invoice No.</Th>
              <Th className="whitespace-nowrap min-w-[100px]">Date</Th>
              <Th>Customer</Th>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th>Salesperson</Th>
              <Th>Branch</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Unit Price (₦)</Th>
              <Th align="right">VAT (₦)</Th>
              <Th align="right" className="px-6">
                Line Total (₦)
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const vat = lineVat(r);
              return (
                <tr key={`${r.invoice_no}-${idx}`} className="border-b">
                  <Td className="px-6 font-semibold">
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
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.invoice_date
                      ? moment(r.invoice_date).format("DD-MMM-YYYY")
                      : "—"}
                  </Td>
                  <Td>{r.customer_name || "—"}</Td>
                  <Td>{r.product_name || "—"}</Td>
                  <Td className="text-gray-700">
                    {r.product_category || r.category || "—"}
                  </Td>
                  <Td>{r.salesperson_name || "—"}</Td>
                  <Td>{r.branch_name || "—"}</Td>
                  <Td align="right">{formatNumber1(r.qty || 0)}</Td>
                  <Td align="right">{formatNumber1(r.unit_price || 0)}</Td>
                  <Td align="right">{formatNumber1(vat)}</Td>
                  <Td align="right" className="px-6 font-semibold">
                    {formatNumber1(r.line_total || 0)}
                  </Td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="bg-white font-semibold border-t">
                <td className="py-4 px-6" colSpan={9}>
                  Total
                </td>
                <Td align="right">{formatNumber1(totalVatAmount)}</Td>
                <Td align="right" className="px-6">
                  {formatNumber1(totalLineAmount)}
                </Td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="py-12 text-center text-sm text-gray-500"
                >
                  No sales lines found for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-3 p-1">
      <div className="bg-gray-100 rounded-lg px-2 py-2 no-print">
        {!isVatReport ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REPORT_VIEWS.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => setReportView(view.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  reportView === view.key
                    ? "bg-[#4267B2] text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-2 px-1">
            <h2 className="text-sm font-semibold text-gray-800">VAT Report</h2>
            <p className="text-xs text-gray-500">
              Sales lines with VAT for the selected period (same detail as Sales
              Detail).
            </p>
          </div>
        )}

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
            <div className="min-w-[160px]">
              <label className="text-xs text-gray-600 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white w-full"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {branches.length > 0 && (
              <div className="min-w-[180px]">
                <label className="text-xs text-gray-600 block mb-1">
                  Branch
                </label>
                <MultipleSelector
                  value={selectedBranchOptions}
                  onChange={(opts) => {
                    setBranchFromUrl(
                      (opts || []).map((o) => o.value).join(","),
                    );
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
                  disabled={(!rows.length && reportView !== "summary") || loading}
                >
                  Export
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={(!rows.length && reportView !== "summary") || loading}
                  onClick={() => handleExportExcel()}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={
                    (!rows.length && reportView !== "summary") ||
                    loading ||
                    pdfExporting
                  }
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
          {isVatReport ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 border-slate-300"
              onClick={() => setVatLedgerModalOpen(true)}
              aria-label="VAT account ledger"
              title="VAT account ledger"
            >
              <Settings className="h-4 w-4" />
            </Button>
          ) : null}
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
            title={activeViewMeta.label}
            numberLabel={`Period: ${periodLabel}`}
            extraLine="All amounts in ₦"
            date={new Date()}
            dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
            className="mb-0 border-b border-blue-950"
          />

          <div className="px-6 py-4 flex flex-wrap justify-between gap-2 text-sm text-gray-700">
            <p className="font-semibold">{activeViewMeta.label}</p>
            <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
              <p>{rows.length} line(s)</p>
              <p>
                VAT:{" "}
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

          {isVatReport && !vatAccountCode ? (
            <div className="mx-6 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p>
                Set the default{" "}
                <Link
                  to="/app/admin/settings?tab=vat-policy"
                  className="font-semibold text-blue-700 underline"
                >
                  VAT Account
                </Link>{" "}
                in Settings → VAT Policy, then open the settings icon for the
                ledger breakdown.
              </p>
            </div>
          ) : null}

          {renderReportBody()}
        </div>
      )}

      {isVatReport ? (
        <Dialog open={vatLedgerModalOpen} onOpenChange={setVatLedgerModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="px-5 pt-5 pb-3 border-b bg-amber-50 text-left">
              <DialogTitle className="text-amber-950">
                VAT account ledger —{" "}
                {vatLedgerBreakdown?.description || "VAT Account"}
                {vatAccountCode ? ` (${vatAccountCode})` : ""}
              </DialogTitle>
              <DialogDescription className="text-amber-800 text-xs sm:text-sm">
                Ledger for the VAT account in this period. Cr = amount to pay ·
                Dr = credit for business.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 space-y-3">
              {!vatAccountCode ? (
                <p className="text-sm text-slate-600">
                  No VAT account configured.{" "}
                  <Link
                    to="/app/admin/settings?tab=vat-policy"
                    className="text-blue-700 underline font-medium"
                    onClick={() => setVatLedgerModalOpen(false)}
                  >
                    Open Settings → VAT Policy
                  </Link>
                </p>
              ) : vatLedgerLoading ? (
                <p className="text-sm text-slate-500">Loading VAT ledger…</p>
              ) : !vatLedgerBreakdown ? (
                <p className="text-sm text-slate-500">
                  No ledger data for this account in the selected period.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      Period: {periodLabel || `${fromDate} → ${toDate}`}
                      {" · "}
                      Running balance:{" "}
                      {vatLedgerBreakdown.creditNormal
                        ? "Liability standard (Cr − Dr)"
                        : "Asset standard (Dr − Cr)"}
                    </p>
                    <div className="text-right">
                      <p
                        className={`text-[10px] uppercase tracking-wide font-semibold ${
                          vatLedgerBreakdown.closeSide.side === "Cr"
                            ? "text-emerald-800"
                            : "text-sky-800"
                        }`}
                      >
                        {vatLedgerBreakdown.closeLabel}
                      </p>
                      <p
                        className={`text-base font-bold tabular-nums ${vatLedgerBreakdown.closeSide.colorClass}`}
                      >
                        ₦{vatLedgerBreakdown.closeSide.text}
                        {vatLedgerBreakdown.closeSide.side
                          ? ` ${vatLedgerBreakdown.closeSide.side}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                    {[
                      {
                        label: "Opening",
                        value: vatLedgerBreakdown.opening,
                        signed: true,
                      },
                      {
                        label: "Total Debit (period)",
                        value: vatLedgerBreakdown.totalDebit,
                        signed: false,
                      },
                      {
                        label: "Total Credit (period)",
                        value: vatLedgerBreakdown.totalCredit,
                        signed: false,
                      },
                    ].map((item) => {
                      const side = item.signed
                        ? vatLedgerBreakdown.formatSide(item.value)
                        : { text: formatNumber1(item.value), side: "" };
                      return (
                      <div
                        key={item.label}
                        className="bg-white px-3 py-2 text-center"
                      >
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                          {item.label}
                        </p>
                        <p
                          className={`text-sm font-semibold tabular-nums mt-0.5 ${
                            item.signed && side.colorClass
                              ? side.colorClass
                              : "text-slate-900"
                          }`}
                        >
                          ₦{side.text}
                          {side.side ? ` ${side.side}` : ""}
                        </p>
                      </div>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-600 text-white">
                          <Th className="px-4">Date</Th>
                          <Th>Reference</Th>
                          <Th>Type</Th>
                          <Th>Description</Th>
                          <Th align="right">Debit (₦)</Th>
                          <Th align="right">Credit (₦)</Th>
                          <Th align="right" className="px-4">
                            Balance (₦)
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b bg-slate-50">
                          <Td className="px-4 text-slate-500" colSpan={4}>
                            Opening balance
                          </Td>
                          <Td align="right">—</Td>
                          <Td align="right">—</Td>
                          <Td
                            align="right"
                            className={`px-4 font-semibold ${
                              vatLedgerBreakdown.formatSide(
                                vatLedgerBreakdown.opening,
                              ).colorClass
                            }`}
                          >
                            {(() => {
                              const b = vatLedgerBreakdown.formatSide(
                                vatLedgerBreakdown.opening,
                              );
                              return `${b.text}${b.side ? ` ${b.side}` : ""}`;
                            })()}
                          </Td>
                        </tr>
                        {vatLedgerBreakdown.txns.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-6 text-center text-slate-500"
                            >
                              No ledger movements on this VAT account for the
                              selected period.
                            </td>
                          </tr>
                        ) : (
                          vatLedgerBreakdown.txns.map((txn, idx) => {
                            const type = vatLedgerBreakdown.isOutput(txn)
                              ? "Output"
                              : vatLedgerBreakdown.isInput(txn)
                                ? "Input"
                                : "Other";
                            return (
                              <tr
                                key={`${txn.transaction_id || txn.reference_number || idx}-${idx}`}
                                className="border-b"
                              >
                                <Td className="px-4 whitespace-nowrap">
                                  {txn.transaction_date
                                    ? moment(txn.transaction_date).format(
                                        "DD-MMM-YYYY",
                                      )
                                    : "—"}
                                </Td>
                                <Td className="font-mono text-xs">
                                  {txn.reference_number ||
                                    txn.transaction_ref ||
                                    "—"}
                                </Td>
                                <Td>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      type === "Output"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : type === "Input"
                                          ? "bg-sky-100 text-sky-800"
                                          : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {type}
                                  </span>
                                </Td>
                                <Td>
                                  {txn.transaction_description ||
                                    txn.account_description ||
                                    txn.purpose_of_payment ||
                                    "—"}
                                </Td>
                                <Td align="right">
                                  {Number(txn.dr || 0) > 0
                                    ? formatNumber1(txn.dr)
                                    : "—"}
                                </Td>
                                <Td align="right">
                                  {Number(txn.cr || 0) > 0
                                    ? formatNumber1(txn.cr)
                                    : "—"}
                                </Td>
                                <Td
                                  align="right"
                                  className={`px-4 font-semibold tabular-nums ${
                                    vatLedgerBreakdown.formatSide(
                                      Number(txn.running_balance || 0),
                                    ).colorClass
                                  }`}
                                >
                                  {(() => {
                                    const b = vatLedgerBreakdown.formatSide(
                                      Number(txn.running_balance || 0),
                                    );
                                    return `${b.text}${b.side ? ` ${b.side}` : ""}`;
                                  })()}
                                </Td>
                              </tr>
                            );
                          })
                        )}
                        <tr className="border-t-2 border-slate-400 bg-amber-50/80">
                          <Td className="px-4 font-semibold" colSpan={4}>
                            {vatLedgerBreakdown.closeLabel}
                          </Td>
                          <Td align="right" className="font-semibold">
                            {formatNumber1(vatLedgerBreakdown.totalDebit)}
                          </Td>
                          <Td align="right" className="font-semibold">
                            {formatNumber1(vatLedgerBreakdown.totalCredit)}
                          </Td>
                          <Td
                            align="right"
                            className={`px-4 font-bold tabular-nums ${vatLedgerBreakdown.closeSide.colorClass}`}
                          >
                            {vatLedgerBreakdown.closeSide.text}
                            {vatLedgerBreakdown.closeSide.side
                              ? ` ${vatLedgerBreakdown.closeSide.side}`
                              : ""}
                          </Td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

async function fetchAllSalesLines({
  facilityId,
  userId,
  fromDate,
  toDate,
  search,
  category,
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
      category,
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
  category,
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
    if (category) params.set("category", category);
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
