import ProductionReportShell, { fmtNum } from "./ProductionReportShell";
import {
  ReportDataSection,
  ReportSummaryCards,
  formatCell,
} from "./productionReportUi";

function exportCsv(data) {
  if (!data?.rows?.length) return;
  const headers = ["Product Code", "Product", "Batches", "Good Qty", "Waste Qty"];
  const lines = data.rows.map((r) =>
    [
      r.productCode,
      `"${r.productName}"`,
      r.batches ?? r.cycleCount,
      r.totalGoodQty ?? r.totalKg,
      r.totalWasteQty ?? 0,
    ].join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `production-report-${data.reportPeriod?.fromDate}.csv`;
  a.click();
}

export default function ProductionReport() {
  return (
    <ProductionReportShell
      title="Production Report"
      reportHeaderTitle="PRODUCTION REPORT"
      endpoint="/api/reports/production/production-report"
      permission="Production Report"
      onExportCsv={exportCsv}
    >
      {(data) => {
        if (!data) return null;
        const { rows, summary } = data;

        const tableRows = rows.map((row) => [
          row.productCode,
          row.productName,
          formatCell(row.batches ?? row.cycleCount),
          formatCell(row.totalGoodQty ?? row.totalKg ?? row.totalCyls),
          formatCell(row.totalWasteQty ?? 0),
        ]);

        return (
          <>
            <ReportSummaryCards
              cards={[
                { label: "Products", value: summary?.productCount },
                { label: "Batches", value: summary?.totalBatches ?? summary?.totalCycles },
                {
                  label: "Good quantity",
                  value: fmtNum(summary?.totalGoodQty ?? summary?.totalKg),
                  highlight: true,
                },
                { label: "Waste quantity", value: fmtNum(summary?.totalWasteQty ?? 0) },
              ]}
            />
            <ReportDataSection
              sectionTitle={`Production by Product — ${summary?.productCount ?? rows.length} products`}
              headers={["Product Code", "Product", "Batches", "Good Qty", "Waste Qty"]}
              rows={tableRows}
              columnAlign={["left", "left", "right", "right", "right"]}
              emptyMessage="No production data for this period."
            />
          </>
        );
      }}
    </ProductionReportShell>
  );
}
