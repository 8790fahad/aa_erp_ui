import { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiURL, _fetchApi } from "@/redux/actions/api";
import { useReportPermissions } from "@/components/pages/report/hooks/useReportPermissions";
import {
  DateField,
  DemoDataBadge,
  ReportControlsBar,
  ReportDataSection,
  ReportHeaderBand,
  ReportPrintStyles,
  SelectField,
  formatCell,
  formatMoneyCell,
  formatReportDate,
} from "./productionReportUi";
import moment from "moment";

function sumField(rows, field) {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
}

function formatPct(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return "—";
  return `${v.toFixed(2)}%`;
}

function buildLocationOptions(locations = []) {
  return [
    { value: "", label: "Select location" },
    ...locations.map((loc) => ({
      value: String(loc.branch_id ?? loc.id ?? ""),
      label: loc.branch_name || loc.storeName || `Warehouse #${loc.branch_id ?? loc.id}`,
    })),
  ];
}

function exportCsv(data, { byLocation }) {
  if (!data?.rows?.length) return;
  const { rows } = data;
  const headers = [
    "SKU",
    "Product",
    ...(byLocation ? ["Warehouse/Location"] : []),
    "Quantity Sold",
    "Unit Price",
    "Gross Sales",
    "Discount",
    "Tax",
    "Net Sales",
    "Unit Cost",
    "Cost of Goods Sold",
    "Gross Profit",
    "Gross Margin %",
  ];
  const lines = rows.map((r) =>
    [
      r.productCode,
      `"${r.productName}"`,
      ...(byLocation ? [`"${r.warehouseLocation || ""}"`] : []),
      r.quantitySold,
      r.unitPrice,
      r.grossSales,
      r.discount,
      r.tax,
      r.netSales,
      r.unitCost,
      r.costOfGoodsSold,
      r.grossProfit,
      r.grossMargin,
    ].join(","),
  );
  const totals = [
    "TOTAL",
    "",
    ...(byLocation ? [""] : []),
    sumField(rows, "quantitySold"),
    "",
    sumField(rows, "grossSales"),
    sumField(rows, "discount"),
    sumField(rows, "tax"),
    sumField(rows, "netSales"),
    "",
    sumField(rows, "costOfGoodsSold"),
    sumField(rows, "grossProfit"),
    data.summary?.grossMargin ?? "",
  ];
  const blob = new Blob([[headers.join(","), ...lines, totals.join(",")].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-per-product-${data.reportPeriod?.fromDate}-${data.reportPeriod?.toDate}.csv`;
  a.click();
}

export default function SalesPerProductReport() {
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
  const [byLocation, setByLocation] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (!byLocation || !facilityId) {
      setLocationOptions([]);
      return;
    }
    let cancelled = false;
    _fetchApi(
      `/account/get/branches?facilityId=${encodeURIComponent(facilityId)}`,
      (json) => {
        if (cancelled) return;
        const rows = Array.isArray(json?.results) ? json.results : [];
        setLocationOptions(
          rows
            .map((b) => ({
              branch_id: b.id,
              branch_name: (b.storeName || b.branch_name || "").trim(),
            }))
            .filter((b) => b.branch_id != null && b.branch_name)
            .sort((a, b) => a.branch_name.localeCompare(b.branch_name)),
        );
      },
      () => {
        if (!cancelled) setLocationOptions([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [byLocation, facilityId]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!facilityId) {
        setError("Select a business to run this report.");
        setReportData(null);
        return;
      }
      if (byLocation && !locationFilter) {
        setError("Select a location to run the by-location report.");
        setReportData(null);
        return;
      }

      const body = {
        facilityId,
        fromDate,
        toDate,
        byLocation: Boolean(byLocation),
      };
      if (byLocation) body.branchId = Number(locationFilter);

      const response = await fetch(`${apiURL}/api/reports/sales/per-product`, {
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
  }, [byLocation, facilityId, fromDate, locationFilter, toDate]);

  if (
    !canViewReportItem("Sale Report per Product") &&
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
            onBack={() => navigate("/app/production/production-reports")}
            loading={loading}
            onGenerate={loadReport}
            onExportCsv={
              reportData ? () => exportCsv(reportData, { byLocation }) : undefined
            }
            exportDisabled={!reportData}
          >
            <DateField label="From" value={fromDate} onChange={setFromDate} />
            <DateField label="To" value={toDate} onChange={setToDate} />
            <label className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded border border-gray-300 bg-white px-3 text-sm">
              <input
                type="checkbox"
                checked={byLocation}
                onChange={(e) => {
                  setByLocation(e.target.checked);
                  setLocationFilter("");
                  setReportData(null);
                }}
                className="h-4 w-4"
              />
              <span className="font-medium text-gray-700">By location</span>
            </label>
            {byLocation ? (
              <SelectField
                label="Warehouse"
                value={locationFilter}
                onChange={setLocationFilter}
                options={buildLocationOptions(locationOptions)}
              />
            ) : null}
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
                reportTitle="SALE REPORT PER PRODUCT"
                periodLabel={periodLabel}
              />
              {(() => {
                const { rows, summary } = reportData;
                const showLocation = byLocation || reportData.view === "location";

                const tableRows = rows.map((row) => [
                  row.productCode || "—",
                  row.productName,
                  ...(showLocation ? [row.warehouseLocation || "—"] : []),
                  formatCell(row.quantitySold),
                  formatMoneyCell(row.unitPrice),
                  formatMoneyCell(row.grossSales),
                  formatMoneyCell(row.discount),
                  formatMoneyCell(row.tax),
                  formatMoneyCell(row.netSales),
                  formatMoneyCell(row.unitCost),
                  formatMoneyCell(row.costOfGoodsSold),
                  formatMoneyCell(row.grossProfit),
                  formatPct(row.grossMargin),
                ]);

                const summaryRow = rows.length
                  ? [
                      "TOTAL",
                      "",
                      ...(showLocation ? [""] : []),
                      formatCell(summary?.totalQuantity ?? sumField(rows, "quantitySold")),
                      "",
                      formatMoneyCell(
                        summary?.totalGrossSales ?? sumField(rows, "grossSales"),
                      ),
                      formatMoneyCell(
                        summary?.totalDiscount ?? sumField(rows, "discount"),
                      ),
                      formatMoneyCell(summary?.totalTax ?? sumField(rows, "tax")),
                      formatMoneyCell(
                        summary?.totalNetSales ?? sumField(rows, "netSales"),
                      ),
                      "",
                      formatMoneyCell(summary?.totalCogs ?? sumField(rows, "costOfGoodsSold")),
                      formatMoneyCell(
                        summary?.totalGrossProfit ?? sumField(rows, "grossProfit"),
                      ),
                      formatPct(summary?.grossMargin),
                    ]
                  : null;

                const headers = [
                  "SKU",
                  "Product",
                  ...(showLocation ? ["Warehouse/Location"] : []),
                  "Quantity Sold",
                  "Unit Price",
                  "Gross Sales",
                  "Discount",
                  "Tax",
                  "Net Sales",
                  "Unit Cost",
                  "Cost of Goods Sold",
                  "Gross Profit",
                  "Gross Margin",
                ];

                const columnAlign = headers.map((h, i) =>
                  i < (showLocation ? 3 : 2) ? "left" : "right",
                );

                return (
                  <ReportDataSection
                    sectionTitle={`Sales by Product — ${rows.length} products`}
                    headers={headers}
                    rows={tableRows}
                    summaryRow={summaryRow}
                    columnAlign={columnAlign}
                    emptyMessage="No sales data for this period."
                  />
                );
              })()}
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
