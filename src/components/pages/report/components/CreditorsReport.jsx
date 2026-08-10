import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import moment from "moment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatNaira = (value) => `₦${formatNumber1(Math.abs(toNumber(value)))}`;
/** Same dr/cr colouring as Debtors / receivable report: dr = rose, cr = emerald. */
const getBalanceType = (value) => (toNumber(value) >= 0 ? "dr" : "cr");
const getBalanceColorClass = (value) =>
  toNumber(value) >= 0 ? "text-rose-600" : "text-emerald-600";

export default function CreditorsReport() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [asAtDate, setAsAtDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = React.useRef(null);
  const autoFetchedFacilityIdRef = useRef(null);

  useEffect(() => {
    const today = new Date();
    setAsAtDate(today.toISOString().split("T")[0]);
  }, []);

  const fetchReport = useCallback(() => {
    if (!facilityId) {
      toast.error("Select business first");
      return;
    }
    if (!asAtDate) {
      toast.error("Select report date");
      return;
    }
    setLoading(true);
    _postApi(
      `/account/debtors-creditors-report`,
      { facilityId, asAtDate },
      (response) => {
        setLoading(false);
        if (response?.success) {
          const rows = response?.data?.creditors?.rows;
          setReportData(Array.isArray(rows) ? rows : []);
        } else {
          toast.error(response?.message || "Unable to load creditors report");
          setReportData([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Unable to load creditors report");
        setReportData([]);
      },
    );
  }, [facilityId, asAtDate]);

  useEffect(() => {
    if (!facilityId || !asAtDate) return;
    if (autoFetchedFacilityIdRef.current === facilityId) return;
    autoFetchedFacilityIdRef.current = facilityId;
    fetchReport();
  }, [facilityId, asAtDate, fetchReport]);

  const rows = useMemo(
    () =>
      (reportData || [])
        .map((item, index) => {
          const partyId =
            item.party_id ||
            item.supplier_number ||
            item.supplier_id ||
            item.customerNo ||
            "-";
          const partyName =
            item.party_name ||
            item.supplier_name ||
            item.supplier ||
            item.Name ||
            item.fullname ||
            "Unknown";
          return {
            id: index + 1,
            partyType: item.party_type || "supplier",
            partyId,
            partyName,
            supplierId: partyId,
            supplierName: partyName,
            balance: toNumber(item.balance ?? item.amount),
          };
        })
        .sort((a, b) =>
          String(a.partyName).localeCompare(String(b.partyName)),
        ),
    [reportData],
  );

  const totalBalance = useMemo(
    () => rows.reduce((sum, r) => sum + toNumber(r.balance), 0),
    [rows],
  );

  const handleExportExcel = useCallback(async () => {
    if (!rows.length) {
      toast.error("No creditor rows to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Creditors Report");
      ws.columns = [
        { width: 10 },
        { width: 20 },
        { width: 36 },
        { width: 14 },
        { width: 20 },
      ];
      let r = 1;
      ws.mergeCells(r, 1, r, 5);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 5);
      ws.getCell(r, 1).value = "CREDITORS REPORT";
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 5);
      ws.getCell(r, 1).value =
        `As at: ${moment(asAtDate).format("DD/MM/YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = ["ID", "PARTY ID", "PARTY NAME", "TYPE", "Balance"];
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
        ws.getCell(r, 1).value = row.id;
        ws.getCell(r, 2).value = row.partyId;
        ws.getCell(r, 3).value = row.partyName;
        ws.getCell(r, 4).value =
          row.partyType === "customer" ? "Customer" : "Supplier";
        ws.getCell(r, 5).value = formatNaira(row.balance);
        r++;
      });

      ws.getCell(r, 1).value = "Total";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 5).value = formatNaira(totalBalance);
      ws.getCell(r, 5).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `creditors-report-${asAtDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [rows, totalBalance, activeBusiness, asAtDate]);

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
      pdf.save(`creditors-report-${asAtDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [asAtDate]);

  return (
    <div className="space-y-3">
      <div className="bg-gray-100 rounded-lg px-2 py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-600 block mb-1">
              Date As At
            </label>
            <input
              type="date"
              className="w-full border rounded px-2 py-2 text-sm"
              value={asAtDate}
              onChange={(e) => setAsAtDate(e.target.value)}
            />
            <p className="text-[11px] text-gray-600 mt-1.5 leading-snug">
              Customers and suppliers with a net credit (CR) ledger balance.
              Debit balances appear on the Receivable report.
            </p>
          </div>
          <div className="md:col-span-1 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => navigate("/app/reports/accounting-reports")}
            >
              <X className="h-4 w-4" />
              Close
            </Button>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? "Loading..." : "Run Report"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
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

      <div
        className="bg-white border rounded-md overflow-hidden"
        ref={reportExportRef}
      >
        <BusinessDocumentHeader
          business={activeBusiness}
          title="PAYABLES REPORT"
          numberLabel={`As at: ${moment(asAtDate).format("DD/MM/YYYY")}`}
          date={new Date()}
          dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
          className="mb-0"
        />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-600 text-white">
                <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide w-16">
                  ID
                </th>
                <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                  Party ID
                </th>
                <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                  Party Name
                </th>
                <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.partyType}-${row.partyId}-${row.id}`}
                  className="border-b hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    if (!row.partyId || row.partyId === "-") return;
                    if (row.partyType === "customer") {
                      const params = new URLSearchParams({
                        customerNo: String(row.partyId),
                        customerName: String(row.partyName || ""),
                      });
                      if (asAtDate) params.set("asAt", asAtDate);
                      navigate(
                        `/app/reports/accounting-reports/receivable-ledger-aging?${params.toString()}`,
                      );
                      return;
                    }
                    const params = new URLSearchParams({
                      supplierId: String(row.partyId),
                      supplierName: String(row.partyName || ""),
                    });
                    if (asAtDate) params.set("asAt", asAtDate);
                    navigate(
                      `/app/reports/accounting-reports/payable-ledger-individual?${params.toString()}`,
                    );
                  }}
                  title="Open ledger"
                >
                  <td className="px-3 py-2 text-sm">{row.id}</td>
                  <td className="px-3 py-2 text-sm text-blue-600 hover:underline">
                    {row.partyId}
                  </td>
                  <td className="px-3 py-2 text-sm text-blue-600 hover:underline">
                    {row.partyName}
                  </td>
                  <td className="px-3 py-2 text-sm capitalize text-gray-600">
                    {row.partyType}
                  </td>
                  <td
                    className={`px-3 py-2 text-sm text-right font-semibold ${getBalanceColorClass(row.balance)}`}
                  >
                    {formatNaira(row.balance)}{" "}
                    <span className="text-xs font-medium">
                      {getBalanceType(row.balance)}
                    </span>
                  </td>
                </tr>
              ))}
              {!!rows.length && (
                <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                  <td className="px-3 py-2 text-sm" colSpan={4}>
                    Total
                  </td>
                  <td
                    className={`px-3 py-2 text-sm text-right ${getBalanceColorClass(totalBalance)}`}
                  >
                    {formatNaira(totalBalance)}{" "}
                    <span className="text-xs font-medium">
                      {getBalanceType(totalBalance)}
                    </span>
                  </td>
                </tr>
              )}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-sm text-gray-500"
                  >
                    No creditor rows found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
