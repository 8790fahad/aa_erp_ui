import { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiURL } from "@/redux/actions/api";
import { useReportPermissions } from "@/components/pages/report/hooks/useReportPermissions";
import {
  DateField,
  DemoDataBadge,
  ReportControlsBar,
  ReportHeaderBand,
  ReportPrintStyles,
  formatReportDate,
} from "./productionReportUi";

function startOfMonth(dateStr) {
  const d = new Date(dateStr || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function InventoryReportShell({
  title,
  reportHeaderTitle,
  endpoint,
  children,
  onExportCsv,
  permission,
  defaultAsOf,
  toolbarExtras,
  /** Optional extra fields merged into the POST body (e.g. branchId, mode). */
  requestExtras,
  onReportLoaded,
  /** Return an error message to block Run report, or falsy to continue. */
  validateBeforeRun,
  /** 'asOf' | 'range' — controlled by parent when provided */
  dateMode = "asOf",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeBusiness, canViewReportItem } = useReportPermissions();
  const facilityId = activeBusiness?.id || "";

  const today = new Date().toISOString().split("T")[0];
  const [asOfDate, setAsOfDate] = useState(
    location.state?.asOfDate || defaultAsOf || today,
  );
  const [fromDate, setFromDate] = useState(
    location.state?.fromDate || startOfMonth(today),
  );
  const [toDate, setToDate] = useState(location.state?.toDate || today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);
  const [appliedPeriod, setAppliedPeriod] = useState(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!facilityId) {
        setError("Select a business to run this report.");
        setReportData(null);
        return;
      }
      if (!endpoint) {
        setError("Report endpoint is not configured.");
        setReportData(null);
        return;
      }

      const validationError =
        typeof validateBeforeRun === "function" ? validateBeforeRun() : null;
      if (validationError) {
        setError(validationError);
        setReportData(null);
        return;
      }

      const extras =
        typeof requestExtras === "function" ? requestExtras() : requestExtras || {};

      const body =
        dateMode === "range"
          ? { facilityId, fromDate, toDate, mode: "movement", ...extras }
          : { facilityId, asOfDate, mode: "snapshot", ...extras };

      const response = await fetch(`${apiURL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (json.success && json.data) {
        setReportData(json.data);
        setAppliedPeriod(
          dateMode === "range"
            ? { mode: "movement", fromDate, toDate }
            : { mode: "snapshot", asOfDate },
        );
        if (typeof onReportLoaded === "function") {
          onReportLoaded(json.data);
        }
        if (!json.data.items?.length) {
          setError("No inventory found for the selected date.");
        }
        return;
      }

      setError(json.message || "Failed to load report.");
      setReportData(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load report. Check that the API server is running.");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [
    asOfDate,
    dateMode,
    endpoint,
    facilityId,
    fromDate,
    onReportLoaded,
    requestExtras,
    toDate,
    validateBeforeRun,
  ]);

  if (
    permission &&
    !canViewReportItem(permission) &&
    !canViewReportItem("Production Reports")
  ) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          You do not have permission to view this report.
        </p>
      </div>
    );
  }

  const periodLabel =
    appliedPeriod?.mode === "movement"
      ? `${formatReportDate(appliedPeriod.fromDate)} – ${formatReportDate(appliedPeriod.toDate)}`
      : `As of ${formatReportDate(appliedPeriod?.asOfDate || asOfDate)}`;

  return (
    <>
      <ReportPrintStyles />
      <div className="min-h-screen bg-gray-50 p-1 print:bg-white print:p-0">
        <div className="max-w-7xl mx-auto">
          <ReportControlsBar
            onBack={() => navigate("/app/production/production-reports")}
            loading={loading}
            onGenerate={loadReport}
            onExportCsv={onExportCsv ? () => onExportCsv(reportData) : undefined}
            exportDisabled={!reportData}
          >
            {dateMode === "range" ? (
              <>
                <DateField label="From" value={fromDate} onChange={setFromDate} />
                <DateField label="To" value={toDate} onChange={setToDate} />
              </>
            ) : (
              <DateField label="As of Date" value={asOfDate} onChange={setAsOfDate} />
            )}
            {typeof toolbarExtras === "function"
              ? toolbarExtras(reportData)
              : toolbarExtras}
            <DemoDataBadge show={reportData?.isDemoData} />
          </ReportControlsBar>

          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-2 text-amber-800 text-sm no-print">
              {error}
            </div>
          )}

          {loading && !reportData && (
            <div className="text-center py-12 text-gray-500">Loading…</div>
          )}

          {!loading && !reportData && !error && (
            <div className="text-center py-12 text-gray-500 text-sm">
              Select filters and click the play icon to load data.
            </div>
          )}

          {reportData && (
            <div className="print-content">
              <ReportHeaderBand
                business={activeBusiness}
                reportTitle={reportHeaderTitle || title.toUpperCase()}
                periodLabel={periodLabel}
              />
              {children(reportData, {
                asOfDate: appliedPeriod?.asOfDate || asOfDate,
                fromDate: appliedPeriod?.fromDate || fromDate,
                toDate: appliedPeriod?.toDate || toDate,
                mode: appliedPeriod?.mode || (dateMode === "range" ? "movement" : "snapshot"),
                activeBusiness,
              })}
              {reportData.reportInfo?.generatedAt && (
                <div className="mt-2 text-xs text-gray-500 text-right">
                  Generated: {reportData.reportInfo.generatedAt}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
