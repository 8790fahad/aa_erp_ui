import ProductionReportShell, { fmtNum } from "./ProductionReportShell";
import { getProductProductionSummaryReport } from "./productionReportingDemoData";

function exportSummaryCsv(data) {
  if (!data?.rows?.length) return;
  const headers = [
    "Product Code",
    "Product",
    "Category",
    "Cycles",
    "Operators",
    "Total Cyls",
    "Total Kg",
    "Production Lines",
  ];
  const lines = data.rows.map((r) =>
    [
      r.productCode,
      r.productName,
      r.category,
      r.cycleCount,
      r.operatorCount,
      r.totalCyls,
      r.totalKg,
      `"${r.productionLines}"`,
    ].join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `product-production-summary-${data.reportPeriod?.fromDate}.csv`;
  a.click();
}

export default function ProductProductionSummaryReport() {
  return (
    <ProductionReportShell
      title="Product Production Summary Report"
      description="Total quantity produced by product, consolidated from operator production records."
      endpoint="/api/reports/production/product-summary"
      permission="Product Production Summary Report"
      localFetcher={getProductProductionSummaryReport}
      onExportCsv={exportSummaryCsv}
    >
      {(data) => {
        if (!data) return null;
        const { rows, summary } = data;
        return (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Products", value: summary?.productCount },
                { label: "Production cycles", value: summary?.totalCycles },
                { label: "Total cylinders", value: fmtNum(summary?.totalCyls) },
                { label: "Total kg", value: fmtNum(summary?.totalKg) },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="text-xs text-gray-500">{card.label}</div>
                  <div className="text-lg font-semibold">{card.value ?? "—"}</div>
                </div>
              ))}
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Product code</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="text-end">Cycles</th>
                    <th className="text-end">Operators</th>
                    <th className="text-end">Total cyls</th>
                    <th className="text-end">Total kg</th>
                    <th>Production lines</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        No production summary for this period.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.productCode}>
                        <td className="font-monospace small">{row.productCode}</td>
                        <td className="fw-medium">{row.productName}</td>
                        <td>{row.category}</td>
                        <td className="text-end">{row.cycleCount}</td>
                        <td className="text-end">{row.operatorCount}</td>
                        <td className="text-end">{fmtNum(row.totalCyls)}</td>
                        <td className="text-end">{fmtNum(row.totalKg)}</td>
                        <td className="small">{row.productionLines}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        );
      }}
    </ProductionReportShell>
  );
}
