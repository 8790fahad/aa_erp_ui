import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, FileDown, FileSpreadsheet, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import useFinancialYear from "@/hooks/useFinancialYear";
import { collectSofpNoteRows, stampSofpNotes } from "./StatementOfFinancialPositionReport";

const inchesToMm = (inches) => inches * 25.4;

const formatCurrency = (amount) => formatNumber1(amount);

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const STATEMENT_PATH =
  "/app/reports/accounting-reports/aa_erp-statement-of-financial-position";

export default function StatementOfFinancialPositionNotes() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { defaultAsOfDate } = useFinancialYear();

  const [asOfDate, setAsOfDate] = useState("");
  const [asOfDatePrior, setAsOfDatePrior] = useState("");
  const [noteRows, setNoteRows] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);
  const [error, setError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [noteData, setNoteData] = useState(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const noteExportRef = useRef(null);

  const noteParam = searchParams.get("note") || "";
  const accountParam = searchParams.get("account") || "";

  useEffect(() => {
    const asOf =
      searchParams.get("asOf") ||
      location.state?.asOfDate ||
      defaultAsOfDate;
    const prior = searchParams.get("prior") || location.state?.asOfDatePrior || "";
    setAsOfDate(asOf || "");
    setAsOfDatePrior(prior || "");
  }, [searchParams, location.state, defaultAsOfDate]);

  useEffect(() => {
    if (!facilityId || !asOfDate) return;
    setLoadingList(true);
    setError("");
    _postApi(
      "/accounting/statement-of-financial-position",
      {
        facilityId,
        asOfDate,
        ...(asOfDatePrior ? { asOfDatePrior } : {}),
      },
      (response) => {
        setLoadingList(false);
        if (response.success && response.data) {
          setNoteRows(collectSofpNoteRows(stampSofpNotes(response.data.rows || [])));
        } else {
          setError(response.message || "Could not load statement notes");
        }
      },
      () => {
        setLoadingList(false);
        setError("An error occurred while loading notes");
      },
    );
  }, [facilityId, asOfDate, asOfDatePrior]);

  const selectedRow = useMemo(() => {
    if (!noteRows.length) return null;
    if (noteParam) {
      const byNote = noteRows.find((row) => String(row._note) === String(noteParam));
      if (byNote) return byNote;
    }
    if (accountParam) {
      return (
        noteRows.find((row) => String(row.accountCode) === String(accountParam)) ||
        null
      );
    }
    return noteRows[0];
  }, [noteRows, noteParam, accountParam]);

  useEffect(() => {
    const code = String(selectedRow?.accountCode || accountParam || "").trim();
    if (!facilityId || !asOfDate || !code) return;
    setNoteLoading(true);
    setNoteError("");
    setNoteData(null);
    _postApi(
      "/accounting/trial-balance-note",
      { facilityId, asOfDate, accountCode: code },
      (response) => {
        setNoteLoading(false);
        if (response.success && response.data) {
          setNoteData(response.data);
        } else {
          setNoteError(response.message || "Could not load this note");
        }
      },
      () => {
        setNoteLoading(false);
        setNoteError("Could not load this note");
      },
    );
  }, [facilityId, asOfDate, selectedRow, accountParam]);

  const handleNoteFilterChange = (value) => {
    const row = noteRows.find((item) => String(item._note) === String(value));
    const next = new URLSearchParams(searchParams);
    if (asOfDate) next.set("asOf", asOfDate);
    if (asOfDatePrior) next.set("prior", asOfDatePrior);
    if (value) next.set("note", value);
    else next.delete("note");
    if (row?.accountCode) next.set("account", row.accountCode);
    setSearchParams(next, { replace: true });
  };

  const backToStatement = () => {
    navigate(STATEMENT_PATH, {
      state: { asOfDate, asOfDatePrior },
    });
  };

  const openFullLedger = () => {
    const code = String(noteData?.accountCode || selectedRow?.accountCode || "").trim();
    if (!code) return;
    const from = noteData?.period?.from || asOfDate;
    const to = noteData?.period?.to || asOfDate;
    const name = encodeURIComponent(
      noteData?.accountName || selectedRow?.accountName || code,
    );
    navigate(
      `/app/reports/account-ledger-report?accounts=${encodeURIComponent(
        code,
      )}&from=${from}&to=${to}&name=${name}`,
    );
  };

  const noteTitle = selectedRow?._note
    ? `Note ${selectedRow._note}${
        selectedRow.accountName ? ` — ${selectedRow.accountName}` : ""
      }`
    : "Note";

  const loading = loadingList || noteLoading;
  const canDownload = Boolean(selectedRow?._note) && !loading && !noteError;

  const entryDescription = (entry) =>
    entry?.type === "opening_balance"
      ? `Opening balance${
          entry.description && entry.description !== "—"
            ? ` — ${entry.description}`
            : ""
        }`
      : entry?.description || entry?.accountName || "—";

  const handleExportExcel = useCallback(async () => {
    if (!selectedRow?._note) {
      toast.error("No note to download");
      return;
    }
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Statement Note");
      ws.columns = [
        { width: 14 },
        { width: 16 },
        { width: 14 },
        { width: 56 },
        { width: 16 },
        { width: 16 },
      ];
      const businessName =
        activeBusiness?.business_name || activeBusiness?.name || "Business";
      let r = 1;
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value = businessName;
      ws.getCell(r, 1).font = { bold: true, size: 14 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value = noteTitle.toUpperCase();
      ws.getCell(r, 1).font = { bold: true, size: 12 };
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r++;
      ws.mergeCells(r, 1, r, 6);
      ws.getCell(r, 1).value = `As of: ${formatDate(asOfDate)}`;
      ws.getCell(r, 1).alignment = { horizontal: "center" };
      r += 2;

      ["Date", "Ref", "Code", "Description", "Dr (₦)", "Cr (₦)"].forEach(
        (heading, i) => {
          const cell = ws.getCell(r, i + 1);
          cell.value = heading;
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF374151" },
          };
        },
      );
      r++;

      (noteData?.entries || []).forEach((entry) => {
        const debit = parseFloat(entry.debit || 0);
        const credit = parseFloat(entry.credit || 0);
        ws.getCell(r, 1).value = entry.date ? formatDate(entry.date) : "";
        ws.getCell(r, 2).value = entry.ref || "";
        ws.getCell(r, 3).value = entry.accountCode || "";
        ws.getCell(r, 4).value = entryDescription(entry);
        ws.getCell(r, 5).value = debit > 0 ? debit : "";
        ws.getCell(r, 6).value = credit > 0 ? credit : "";
        ws.getCell(r, 5).numFmt = "#,##0.00";
        ws.getCell(r, 6).numFmt = "#,##0.00";
        r++;
      });

      ws.getCell(r, 1).value = "Total";
      ws.mergeCells(r, 1, r, 4);
      ws.getCell(r, 5).value = parseFloat(noteData?.totals?.totalDebit || 0);
      ws.getCell(r, 6).value = parseFloat(noteData?.totals?.totalCredit || 0);
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 5).font = { bold: true };
      ws.getCell(r, 6).font = { bold: true };
      ws.getCell(r, 5).numFmt = "#,##0.00";
      ws.getCell(r, 6).numFmt = "#,##0.00";

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `statement-note-${selectedRow._note}-${asOfDate}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Note downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not download the note");
    }
  }, [activeBusiness, asOfDate, noteData, noteTitle, selectedRow]);

  const handleExportPdf = useCallback(async () => {
    const el = noteExportRef.current;
    if (!el || !selectedRow?._note) {
      toast.error("Note is not ready to download");
      return;
    }
    setPdfExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: el.scrollWidth,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = inchesToMm(0.4);
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let y = 0;
      while (y < imgHeight) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, margin - y, contentWidth, imgHeight);
        y += contentHeight;
      }
      pdf.save(`statement-note-${selectedRow._note}-${asOfDate}.pdf`);
      toast.success("Note downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not download the note");
    } finally {
      setPdfExporting(false);
    }
  }, [asOfDate, selectedRow]);

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-100 px-2 py-2 mb-2 rounded-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">
                Notes to the Statement of Financial Position
              </span>
              {asOfDate ? (
                <span className="text-gray-600"> (as of {formatDate(asOfDate)})</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {noteRows.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
                  <span className="font-medium">Note</span>
                  <select
                    value={selectedRow?._note ? String(selectedRow._note) : noteParam}
                    onChange={(e) => handleNoteFilterChange(e.target.value)}
                    className="h-10 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[16rem]"
                  >
                    {noteRows.map((row) => (
                      <option key={`sofp-note-${row._note}`} value={String(row._note)}>
                        Note {row._note}
                        {row.accountName ? ` — ${row.accountName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-10 border-gray-300"
                    disabled={!canDownload || pdfExporting}
                  >
                    Download
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={!canDownload}
                    onClick={() => handleExportExcel()}
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    disabled={!canDownload || pdfExporting}
                    onClick={() => handleExportPdf()}
                  >
                    {pdfExporting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4 shrink-0" />
                    )}
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 border-gray-300"
                onClick={backToStatement}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Statement
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-10"
                onClick={() => navigate("/app/reports/accounting-reports")}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-8 space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {!loading && !error && !selectedRow && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-600">
            No note for this statement.{" "}
            <button
              type="button"
              onClick={backToStatement}
              className="text-blue-700 underline font-medium"
            >
              Return to the statement
            </button>
          </div>
        )}

        {!loading && selectedRow && (
          <div className="mb-1" ref={noteExportRef}>
            <BusinessDocumentHeader
              business={activeBusiness}
              title="NOTES TO THE STATEMENT OF FINANCIAL POSITION"
              numberLabel={`Note ${selectedRow._note} · As of: ${formatDate(asOfDate)}`}
              date={new Date()}
              dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
              className="mb-2"
            />
            <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm">
              <div className="bg-gray-700 px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-white">
                  {noteTitle}
                </h2>
                <span className="text-sm font-semibold tabular-nums text-white">
                  {noteData?.totals
                    ? `Dr ${formatCurrency(noteData.totals.totalDebit)} · Cr ${formatCurrency(noteData.totals.totalCredit)}`
                    : formatCurrency(selectedRow.current || 0)}
                </span>
              </div>
              <div className="px-4 py-3">
                {noteError && <p className="text-sm text-red-700">{noteError}</p>}
                {!noteError && (noteData?.entries || []).length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    No ledger lines for this account as of the report date.
                  </p>
                )}
                {!noteError && (noteData?.entries || []).length > 0 && (
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                          Ref
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                          Code
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                          Description
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                          Dr (₦)
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                          Cr (₦)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(noteData?.entries || []).map((entry, idx) => (
                        <tr
                          key={`${entry.ref}-${entry.accountCode}-${idx}`}
                          className="border-b border-gray-100"
                        >
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {entry.date ? formatDate(entry.date) : "—"}
                          </td>
                          <td className="px-3 py-1.5">{entry.ref || "—"}</td>
                          <td className="px-3 py-1.5">{entry.accountCode || "—"}</td>
                          <td className="px-3 py-1.5">
                            {entry.type === "opening_balance"
                              ? `Opening balance${
                                  entry.description && entry.description !== "—"
                                    ? ` — ${entry.description}`
                                    : ""
                                }`
                              : entry.description || entry.accountName || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {parseFloat(entry.debit || 0) > 0
                              ? formatCurrency(entry.debit)
                              : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {parseFloat(entry.credit || 0) > 0
                              ? formatCurrency(entry.credit)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2" colSpan={4}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(noteData?.totals?.totalDebit || 0)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(noteData?.totals?.totalCredit || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
                {selectedRow?.accountCode && (
                  <div className="flex justify-end mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openFullLedger}
                    >
                      Open account ledger
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
