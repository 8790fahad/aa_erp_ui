import { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiURL } from "@/redux/actions/api";
import { useReportPermissions } from "@/components/pages/report/hooks/useReportPermissions";
import {
  DateField,
  DemoDataBadge,
  ReportControlsBar,
  ReportDataSection,
  ReportHeaderBand,
  ReportPrintStyles,
  formatCell,
  formatMoneyCell,
  formatReportDate,
} from "./productionReportUi";
import moment from "moment";
import SpecialInvoiceTreatment, {
  InvoiceTreatmentFilter,
} from "@/components/sales/SpecialInvoiceTreatment";

function sumField(rows, field) {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

function formatPct(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return "—";
  return `${v.toFixed(2)}%`;
}

function exportCsv(data) {
  if (!data?.rows?.length) return;
  const { rows } = data;
  const headers = [
    "Supplier No",
    "Supplier",
    "Products",
    "Quantity Sold",
    "Gross Sales",
    "Cost of Goods Sold",
    "Gross Profit",
    "Gross Margin %",
  ];
  const lines = rows.map((r) =>
    [
      r.supplierNo,
      `"${r.supplierName}"`,
      r.productCount,
      r.quantitySold,
      r.grossSales,
      r.costOfGoodsSold,
      r.grossProfit,
      r.grossMargin,
    ].join(","),
  );
  const totals = [
    "TOTAL",
    "",
    "",
    sumField(rows, "quantitySold"),
    sumField(rows, "grossSales"),
    sumField(rows, "costOfGoodsSold"),
    sumField(rows, "grossProfit"),
    data.summary?.grossMargin ?? "",
  ];
  const blob = new Blob(
    [[headers.join(","), ...lines, totals.join(",")].join("\n")],
    { type: "text/csv" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-by-supplier-${data.reportPeriod?.fromDate}-${data.reportPeriod?.toDate}.csv`;
  a.click();
}

export default function SalesBySupplierReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeBusiness, canViewReportItem } = useReportPermissions();
  const facilityId = activeBusiness?.id || "";

  const [fromDate, setFromDate] = useState(
    location.state?.fromDate || moment().startOf("month").format("YYYY-MM-DD"),
  );
  const [toDate, setToDate] = useState(
    location.state?.toDate || moment().format("YYYY-MM-DD"),
  );
  const [paymentType, setPaymentType] = useState("all");
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

      const body = { facilityId, fromDate, toDate };
      if (paymentType && paymentType !== "all") body.paymentType = paymentType;

      const response = await fetch(`${apiURL}/api/reports/sales/by-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (json.success && json.data) {
        setReportData(json.data);
        if (!json.data.rows?.length) {
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
  }, [facilityId, fromDate, paymentType, toDate]);

  if (
    !canViewReportItem("Sales report by supplier") &&
    !canViewReportItem("Sale Report per Product") &&
    !canViewReportItem("Sales invoices") &&
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
        <div className="max-w-[95rem] mx-auto">
          <ReportControlsBar
            onBack={() => navigate(-1)}
            loading={loading}
            onGenerate={loadReport}
            onExportCsv={reportData ? () => exportCsv(reportData) : undefined}
            exportDisabled={!reportData}
          >
            <DateField label="From" value={fromDate} onChange={setFromDate} />
            <DateField label="To" value={toDate} onChange={setToDate} />
            <SpecialInvoiceTreatment
              fromDate={fromDate}
              toDate={toDate}
              compact
              buttonSize="sm"
              className="h-10"
            />
            <InvoiceTreatmentFilter
              value={paymentType}
              onChange={(v) => {
                setPaymentType(v);
                setReportData(null);
              }}
            />
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
                reportTitle="SALES REPORT BY SUPPLIER"
                periodLabel={periodLabel}
              />
              {(() => {
                const { rows, summary } = reportData;
                const tableRows = rows.map((row) => [
                  row.supplierNo || "—",
                  row.supplierName,
                  formatCell(row.productCount),
                  formatCell(row.quantitySold),
                  formatMoneyCell(row.grossSales),
                  formatMoneyCell(row.costOfGoodsSold),
                  formatMoneyCell(row.grossProfit),
                  formatPct(row.grossMargin),
                ]);
                const summaryRow = rows.length
                  ? [
                      "TOTAL",
                      "",
                      "",
                      formatCell(summary?.totalQuantity),
                      formatMoneyCell(summary?.totalGrossSales),
                      formatMoneyCell(summary?.totalCogs),
                      formatMoneyCell(summary?.totalGrossProfit),
                      formatPct(summary?.grossMargin),
                    ]
                  : null;
                return (
                  <ReportDataSection
                    headers={[
                      "Supplier No",
                      "Supplier",
                      "Products",
                      "Qty Sold",
                      "Gross Sales",
                      "COGS",
                      "Gross Profit",
                      "Margin %",
                    ]}
                    rows={tableRows}
                    summaryRow={summaryRow}
                    columnAlign={[
                      "left",
                      "left",
                      "right",
                      "right",
                      "right",
                      "right",
                      "right",
                      "right",
                    ]}
                  />
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
