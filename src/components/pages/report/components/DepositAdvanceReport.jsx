import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronDown, FileDown, FileSpreadsheet, Loader2, X } from "lucide-react";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const VARIANTS = {
  deposit: {
    endpoint: "/account/customer-deposits-report",
    partyType: "customer",
    reportTitle: "Deposit Report",
    documentTitle: "Customer Deposits Report",
    partyLabel: "Customer",
    balanceLabel: "Deposit Balance (₦)",
    helpText:
      "Customers with a prepaid / deposit balance not yet applied to an invoice.",
    exportName: "deposit-report",
  },
  advance: {
    endpoint: "/account/supplier-advances-report",
    partyType: "supplier",
    reportTitle: "Advance Report",
    documentTitle: "Supplier Advances Report",
    partyLabel: "Supplier",
    balanceLabel: "Advance Balance (₦)",
    helpText: "Suppliers we have paid in advance, not yet used on a purchase.",
    exportName: "advance-report",
  },
};

export default function DepositAdvanceReport({ variant = "deposit" } = {}) {
  const cfg = VARIANTS[variant] || VARIANTS.deposit;
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const facilityId = activeBusiness?.id;

  const [asAtDate, setAsAtDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const reportExportRef = useRef(null);
  const autoFetchedFacilityIdRef = useRef(null);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerParty, setLedgerParty] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);

  useEffect(() => {
    setAsAtDate(new Date().toISOString().split("T")[0]);
  }, []);

  const fetchReport = useCallback(() => {
    if (!facilityId || !asAtDate) {
      toast.error("Select report date");
      return;
    }
    setLoading(true);
    _postApi(
      cfg.endpoint,
      { facilityId, asAtDate },
      (response) => {
        setLoading(false);
        if (response?.success) {
          setReportData(response.data || {});
        } else {
          toast.error(response?.message || `Unable to load ${cfg.reportTitle}`);
        }
      },
      () => {
        setLoading(false);
        toast.error(`Unable to load ${cfg.reportTitle}`);
      },
    );
  }, [facilityId, asAtDate, cfg]);

  useEffect(() => {
    if (!facilityId || !asAtDate) return;
    if (autoFetchedFacilityIdRef.current === `${facilityId}-${variant}`) return;
    autoFetchedFacilityIdRef.current = `${facilityId}-${variant}`;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, asAtDate]);

  const rows = useMemo(() => {
    const rawRows = reportData?.rows || [];
    return rawRows
      .map((item) => ({
        partyId: item.party_id,
        partyName: item.party_name || item.party_id,
        balance: toNumber(item.balance),
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [reportData]);

  const totalBalance = useMemo(
    () => rows.reduce((sum, r) => sum + r.balance, 0),
    [rows],
  );

  const openLedger = useCallback(
    (row) => {
      if (!row?.partyId) return;
      setLedgerParty(row);
      setLedgerOpen(true);
      setLedgerLoading(true);
      setLedgerData(null);
      _postApi(
        "/account/deposit-advance-ledger",
        {
          facilityId,
          partyType: cfg.partyType,
          partyNo: row.partyId,
          fromDate: moment(asAtDate).startOf("year").format("YYYY-MM-DD"),
          toDate: asAtDate,
        },
        (response) => {
          setLedgerLoading(false);
          if (response?.success) {
            setLedgerData(response.data || null);
          } else {
            toast.error(response?.message || "Unable to load ledger");
          }
        },
        () => {
          setLedgerLoading(false);
          toast.error("Unable to load ledger");
        },
      );
    },
    [facilityId, cfg, asAtDate],
  );

  const handleExportExcel = useCallback(async () => {
    if (!rows.length) {
      toast.error("No rows to export");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet(cfg.reportTitle);
      ws.columns = [{ width: 8 }, { width: 20 }, { width: 34 }, { width: 20 }];
      let r = 1;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value =
        activeBusiness?.business_name || activeBusiness?.name || "Business Name";
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = cfg.documentTitle.toUpperCase();
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 1).value = `As at: ${moment(asAtDate).format("DD/MM/YYYY")}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      const headers = ["#", `${cfg.partyLabel} ID`, `${cfg.partyLabel} Name`, "Balance"];
      headers.forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4B5563" } };
      });
      r++;

      rows.forEach((row, idx) => {
        ws.getCell(r, 1).value = idx + 1;
        ws.getCell(r, 2).value = row.partyId;
        ws.getCell(r, 3).value = row.partyName;
        ws.getCell(r, 4).value = row.balance;
        ws.getCell(r, 4).numFmt = "#,##0.00";
        r++;
      });
      ws.getCell(r, 1).value = "Total";
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 4).value = totalBalance;
      ws.getCell(r, 4).numFmt = "#,##0.00";
      ws.getCell(r, 4).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cfg.exportName}-${asAtDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel");
    }
  }, [rows, totalBalance, activeBusiness, asAtDate, cfg]);

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
      pdf.save(`${cfg.exportName}-${asAtDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  }, [asAtDate, cfg]);

  return (
    <div className="space-y-3">
      <div className="bg-gray-100 rounded-lg px-2 py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="text-xs text-gray-600 block mb-1">Date As At</label>
            <input
              type="date"
              className="w-full border rounded px-2 py-2 text-sm"
              value={asAtDate}
              onChange={(e) => setAsAtDate(e.target.value)}
            />
            <p className="text-[11px] text-gray-600 mt-1.5 leading-snug">
              {cfg.helpText}
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
                <Button variant="outline" className="border-gray-300" disabled={!rows.length || loading}>
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

      <div className="bg-white border rounded-md overflow-hidden" ref={reportExportRef}>
        <BusinessDocumentHeader
          business={activeBusiness}
          title={cfg.documentTitle}
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
                  #
                </th>
                <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                  {cfg.partyLabel} ID
                </th>
                <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                  {cfg.partyLabel} Name
                </th>
                <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
                  {cfg.balanceLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.partyId}
                  className="border-b hover:bg-slate-50 cursor-pointer"
                  onClick={() => openLedger(row)}
                  title="View ledger"
                >
                  <td className="px-3 py-2 text-sm">{idx + 1}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:underline">
                      {row.partyId}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:underline">
                      {row.partyName}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-semibold tabular-nums">
                    ₦{formatNumber1(row.balance)}
                  </td>
                </tr>
              ))}
              {!!rows.length && (
                <tr className="bg-gray-100 font-semibold border-t border-b border-gray-400">
                  <td className="px-3 py-2 text-sm" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-sm text-right tabular-nums">
                    ₦{formatNumber1(totalBalance)}
                  </td>
                </tr>
              )}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-500">
                    {loading
                      ? "Loading…"
                      : `No ${cfg.partyLabel.toLowerCase()}s with an outstanding ${
                          variant === "deposit" ? "deposit" : "advance"
                        } balance for this date.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b bg-slate-50 text-left">
            <DialogTitle>
              {cfg.partyLabel} ledger — {ledgerParty?.partyName || ""}
              {ledgerParty?.partyId ? ` (${ledgerParty.partyId})` : ""}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {variant === "deposit"
                ? "Deposit transactions for this customer, year to date."
                : "Advance transactions for this supplier, year to date."}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 space-y-3">
            {ledgerLoading ? (
              <p className="text-sm text-slate-500">Loading ledger…</p>
            ) : !ledgerData ? (
              <p className="text-sm text-slate-500">No ledger data available.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-600">
                  <p>
                    Opening: <span className="font-semibold">₦{formatNumber1(ledgerData.opening)}</span>
                  </p>
                  <p>
                    Closing:{" "}
                    <span className="font-semibold text-slate-900">
                      ₦{formatNumber1(ledgerData.closing)}
                    </span>
                  </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-600 text-white">
                        <th className="text-left text-xs font-semibold px-3 py-2 uppercase tracking-wide">
                          Date
                        </th>
                        <th className="text-left text-xs font-semibold px-3 py-2 uppercase tracking-wide">
                          Reference
                        </th>
                        <th className="text-left text-xs font-semibold px-3 py-2 uppercase tracking-wide">
                          Description
                        </th>
                        <th className="text-right text-xs font-semibold px-3 py-2 uppercase tracking-wide">
                          Debit (₦)
                        </th>
                        <th className="text-right text-xs font-semibold px-3 py-2 uppercase tracking-wide">
                          Credit (₦)
                        </th>
                        <th className="text-right text-xs font-semibold px-3 py-2 uppercase tracking-wide">
                          Balance (₦)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ledgerData.transactions || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                            No movements in this period.
                          </td>
                        </tr>
                      ) : (
                        ledgerData.transactions.map((t, idx) => (
                          <tr key={`${t.reference_number || idx}-${idx}`} className="border-b">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {t.transaction_date
                                ? moment(t.transaction_date).format("DD-MMM-YYYY")
                                : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {t.reference_number || "—"}
                            </td>
                            <td className="px-3 py-2">{t.description || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {Number(t.dr || 0) > 0 ? formatNumber1(t.dr) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {Number(t.cr || 0) > 0 ? formatNumber1(t.cr) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatNumber1(t.running_balance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
