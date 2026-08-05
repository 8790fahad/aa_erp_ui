import { useCallback, useEffect, useState } from "react";
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
import moment from "moment";

export default function ProductionReportShell({
  title,
  reportHeaderTitle,
  endpoint,
  localFetcher,
  children,
  onExportCsv,
  permission,
  defaultFrom = moment().startOf("month").format("YYYY-MM-DD"),
  defaultTo = moment().format("YYYY-MM-DD"),
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeBusiness, canViewReportItem } = useReportPermissions();
  const facilityId = activeBusiness?.id || "";

  const [fromDate, setFromDate] = useState(
    location.state?.fromDate || defaultFrom,
  );
  const [toDate, setToDate] = useState(location.state?.toDate || defaultTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);

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

      const response = await fetch(`${apiURL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, fromDate, toDate }),
      });
      const json = await response.json();
      if (json.success && json.data) {
        setReportData(json.data);
        if (!json.data.rows?.length && !json.data.items?.length) {
          setError("No sales found for the selected date range.");
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
  }, [endpoint, facilityId, fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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

  const periodLabel = `${formatReportDate(fromDate)} — ${formatReportDate(toDate)}`;

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
            <DateField label="From Date" value={fromDate} onChange={setFromDate} />
            <DateField label="To Date" value={toDate} onChange={setToDate} />
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

          {reportData && (
            <div className="print-content">
              <ReportHeaderBand
                business={activeBusiness}
                reportTitle={reportHeaderTitle || title.toUpperCase()}
                periodLabel={periodLabel}
              />
              {children(reportData, {
                fromDate,
                toDate,
                companyName: activeBusiness?.business_name || "",
              })}
              <div className="mt-2 text-xs text-gray-500 text-right">
                Generated: {moment().format("YYYY-MM-DD HH:mm:ss")}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const fmtNum = (value, decimals = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const fmtMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
