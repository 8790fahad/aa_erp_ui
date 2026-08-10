import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1, formatNaira } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import moment from "moment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, FileDown, FileSpreadsheet, Loader2, X } from "lucide-react";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Ledger-style balance: symbol + grouped decimals (e.g. ₦-71,071,953.34). */
const formatBalance = (value, currency = "NGN") => {
  const sym = currency === "NGN" ? "₦" : `${currency} `;
  return `${sym}${formatNumber1(toNumber(value))}`;
};

function resolveAccountCode(account) {
  const trim = (v) => (v != null ? String(v).trim() : "");
  const explicit = trim(account?.account_code);
  if (explicit) return explicit;

  const head = trim(
    account?.head ??
      account?.code ??
      account?.chart_code ??
      account?.mod_account_code ??
      account?.head_code,
  );
  const sub = trim(account?.subhead);
  if (head && sub && sub !== "0") return `${head}-${sub}`;
  if (head) return head;
  return "—";
}

export default function BankBalancesReport() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [asAtDate, setAsAtDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = useRef(null);
  const autoFetchedFacilityIdRef = useRef(null);

  useEffect(() => {
    setAsAtDate(new Date().toISOString().split("T")[0]);
  }, []);

  const fetchReport = useCallback(() => {
    if (!facilityId) {
      toast.error("Select business first");
      return;
    }
    setLoading(true);
    _fetchApi(
      `/api/get/bank-accounts?facilityId=${encodeURIComponent(facilityId)}`,
      (response) => {
        setLoading(false);
        if (response?.success && Array.isArray(response.results)) {
          setAccounts(response.results);
        } else {
          toast.error(response?.message || "Unable to load bank accounts");
          setAccounts([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Unable to load bank accounts");
        setAccounts([]);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    if (!facilityId) return;
    if (autoFetchedFacilityIdRef.current === facilityId) return;
    autoFetchedFacilityIdRef.current = facilityId;
    fetchReport();
  }, [facilityId, fetchReport]);

  const rows = useMemo(
    () =>
      (accounts || []).map((a, index) => ({
        sn: index + 1,
        bankId: a.id,
        accountCode: resolveAccountCode(a),
        ledgerCode: String(
          a?.head ?? a?.code ?? a?.account_code ?? "",
        ).trim(),
        accountName: a.account_name || "—",
        currency: a.currency || "NGN",
        balance: toNumber(a.balance),
      })),
    [accounts],
  );

  const openAccountLedger = useCallback(
    (row) => {
      const code =
        row.ledgerCode && row.ledgerCode !== "—"
          ? row.ledgerCode
          : row.accountCode !== "—"
            ? String(row.accountCode).split("-")[0]
            : "";
      if (!code) {
        toast.error("This bank account is not linked to a GL account");
        return;
      }
      const to = asAtDate || moment().format("YYYY-MM-DD");
      const from = moment(to).startOf("year").format("YYYY-MM-DD");
      const params = new URLSearchParams({
        accounts: code,
        name: row.accountName || code,
        from,
        to,
      });
      navigate(
        `/app/reports/accounting-reports/custom-reports?${params.toString()}`,
      );
    },
    [asAtDate, navigate],
  );

  const totalsByCurrency = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const ccy = r.currency || "NGN";
      m.set(ccy, (m.get(ccy) || 0) + r.balance);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const handleExportExcel = useCallback(async () => {
    if (!rows.length) {
      toast.error("No rows to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Bank Balances");
      ws.columns = [{ width: 6 }, { width: 16 }, { width: 40 }, { width: 18 }];
      let r = 1;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name || activeBusiness?.name || "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = "BANK BALANCES REPORT";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = `As at: ${moment(asAtDate).format("DD/MM/YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = ["S/N", "ACCOUNT CODE", "ACCOUNT NAME", "BALANCE"];
      headers.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B5563" } };
      });
      r++;

      const moneyFmt = '#,##0.00';
      for (const row of rows) {
        ws.getCell(r, 1).value = row.sn;
        ws.getCell(r, 2).value = row.accountCode === "—" ? "" : row.accountCode;
        ws.getCell(r, 3).value = row.accountName;
        ws.getCell(r, 4).value = row.balance;
        ws.getCell(r, 4).numFmt = moneyFmt;
        r++;
      }

      for (const [ccy, amt] of totalsByCurrency) {
        ws.getCell(r, 1).value = `Total (${ccy})`;
        ws.getCell(r, 1).font = { bold: true };
        ws.mergeCells(r, 1, r, 3);
        ws.getCell(r, 4).value = amt;
        ws.getCell(r, 4).numFmt = moneyFmt;
        ws.getCell(r, 4).font = { bold: true };
        r++;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bank-balances-${asAtDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [rows, totalsByCurrency, activeBusiness, asAtDate]);

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
      pdf.save(`bank-balances-${asAtDate}.pdf`);
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
      <div className="min-h-screen bg-gray-50 p-1 space-y-3">
        <div className="bg-gray-100 rounded-lg px-2 py-2 no-print">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600 block mb-1">As at (report date)</label>
              <input
                type="date"
                className="w-full border rounded px-2 py-2 text-sm bg-white"
                value={asAtDate}
                onChange={(e) => setAsAtDate(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Same live balances as the dashboard bank accounts list. Click an
                account code to open that account&apos;s ledger.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
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
              <Button type="button" onClick={fetchReport} disabled={loading || !facilityId}>
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
            </div>
          </div>
        </div>

        {loading && (
          <div className="space-y-2 no-print">
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!loading && (
          <div
            ref={reportExportRef}
            className="print-content bg-white border rounded-md overflow-hidden"
          >
            <BusinessDocumentHeader
              business={activeBusiness}
              title="BANK BALANCES REPORT"
              numberLabel={`As at: ${moment(asAtDate).format("DD/MM/YYYY")}`}
              extraLine="All amounts shown per account currency"
              date={new Date()}
              dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
              className="mb-0"
            />

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-600 text-white">
                    <th className="text-center text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide w-14">
                      S/N
                    </th>
                    <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide whitespace-nowrap min-w-[110px]">
                      Account code
                    </th>
                    <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                      Account name
                    </th>
                    <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide min-w-[140px]">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={String(row.bankId)}
                      className="border-b border-gray-200 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 text-center text-gray-800 tabular-nums">
                        {row.sn}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openAccountLedger(row)}
                          className="text-blue-600 hover:underline font-medium cursor-pointer bg-transparent border-0 p-0"
                          title="Open account ledger"
                        >
                          {row.accountCode}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-gray-900 font-medium">
                        {row.accountName}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                        {formatBalance(row.balance, row.currency)}
                      </td>
                    </tr>
                  ))}
                  {rows.length > 0 &&
                    totalsByCurrency.map(([ccy, amt], idx) => (
                      <tr
                        key={ccy}
                        className={`bg-gray-100 font-semibold ${
                          idx === 0 ? "border-t-2 border-gray-400" : "border-t border-gray-200"
                        }`}
                      >
                        <td className="px-3 py-2 text-center text-gray-600">—</td>
                        <td className="px-3 py-2" colSpan={2}>
                          Total ({ccy})
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatBalance(amt, ccy)}
                        </td>
                      </tr>
                    ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center text-gray-500 text-sm">
                        No bank accounts linked for this facility.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
