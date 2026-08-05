import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileDown, Loader2, X } from "lucide-react";
import moment from "moment";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import IncomeStatementNotesSection from "./IncomeStatementNotesSection";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

export default function InventriaIncomeStatementNotes() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const notesExportRef = useRef(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(location.state?.reportData ?? null);
  const [pdfExporting, setPdfExporting] = useState(false);

  const highlightNoteRef = searchParams.get("note") || "";

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();
    const firstDayOfYear = `${currentYear}-01-01`;

    const from =
      searchParams.get("from") ||
      location.state?.fromDate ||
      firstDayOfYear;
    const to =
      searchParams.get("to") ||
      location.state?.toDate ||
      today;
    setFromDate(from);
    setToDate(to);
  }, [searchParams, location.state]);

  const fetchNotesData = useCallback(() => {
    if (!facilityId || !fromDate || !toDate) return;
    setLoading(true);
    setError("");
    _postApi(
      "/accounting/income-statement",
      { facilityId, fromDate, toDate },
      (response) => {
        setLoading(false);
        if (response.success && response.data) {
          setReportData(response.data);
        } else {
          setError(response.message || "Failed to load notes");
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        setError("An error occurred while loading notes");
      }
    );
  }, [facilityId, fromDate, toDate]);

  useEffect(() => {
    if (!reportData && fromDate && toDate && facilityId) {
      fetchNotesData();
    }
  }, [reportData, fromDate, toDate, facilityId, fetchNotesData]);

  useEffect(() => {
    if (!highlightNoteRef || loading) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`income-statement-note-${highlightNoteRef}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [highlightNoteRef, loading, reportData]);

  const allNotes = Array.isArray(reportData?.notes) ? reportData.notes : [];
  const currentYearLabel = toDate ? moment(toDate).format("YYYY") : "";

  const backToStatement = () => {
    navigate("/app/reports/accounting-reports/inventria-income-statement", {
      state: { fromDate, toDate },
    });
  };

  const handleExportPdf = async () => {
    const el = notesExportRef.current;
    if (!el) {
      toast.error("Notes are not ready to export");
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
      pdf.save(`income-statement-notes-${toDate}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not generate PDF");
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-1">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-100 px-2 py-2 mb-2 rounded-lg overflow-x-auto">
          <div className="flex w-full min-w-max flex-nowrap items-center justify-between gap-3">
            <div className="flex shrink-0 flex-nowrap items-center gap-2 text-sm text-gray-700">
              <span className="font-semibold">Notes to the Income Statement</span>
              {fromDate && toDate && (
                <span className="text-gray-600">
                  ({moment(fromDate).format("DD/MM/YYYY")} – {moment(toDate).format("DD/MM/YYYY")})
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-nowrap items-center gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 shrink-0 border-gray-300 whitespace-nowrap"
                onClick={backToStatement}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Income Statement
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-10 shrink-0"
                onClick={() => navigate("/app/reports/accounting-reports")}
              >
                <X className="h-4 w-4" />
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 shrink-0 border-gray-300"
                disabled={!allNotes.length || loading || pdfExporting}
                onClick={handleExportPdf}
              >
                {pdfExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-1" />
                )}
                Export PDF
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

        {!loading && !error && allNotes.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-600">
            No notes for this period.{" "}
            <button
              type="button"
              onClick={backToStatement}
              className="text-blue-700 underline font-medium"
            >
              Return to Income Statement
            </button>
          </div>
        )}

        {!loading && allNotes.length > 0 && (
          <div className="mb-1">
            <BusinessDocumentHeader
              business={activeBusiness}
              title="Notes to the Income Statement"
              numberLabel={`Period: ${moment(fromDate).format("DD/MM/YYYY")} to ${moment(toDate).format("DD/MM/YYYY")}`}
              date={new Date()}
              dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
              className="mb-2"
            />
            <IncomeStatementNotesSection
              notes={allNotes}
              fromDate={fromDate}
              toDate={toDate}
              currentYearLabel={currentYearLabel}
              exportRef={notesExportRef}
              highlightNoteRef={highlightNoteRef}
            />
          </div>
        )}
      </div>
    </div>
  );
}
