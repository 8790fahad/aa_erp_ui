import ProductionReportShell, { fmtNum, fmtMoney } from "./ProductionReportShell";
import { getProductionVsSalesReport } from "./productionReportingDemoData";

function exportComparisonCsv(data) {
  if (!data?.rows?.length) return;
  const headers = [
    "Section",
    "Item",
    "Open Cyls",
    "Open Kg",
    "Prod Cyls",
    "Prod Kg",
    "Sales Cyls",
    "Sales Kg",
    "Sales Amt",
    "Price/Cyl",
    "Price/Ton",
    "Close Cyls",
    "Close Kg",
  ];
  const lines = data.rows.map((r) =>
    [
      r.section,
      r.item,
      r.openingCyls,
      r.openingKg,
      r.productionCyls,
      r.productionKg,
      r.salesCyls,
      r.salesKg,
      r.salesAmount,
      r.pricePerCyl,
      r.pricePerTon,
      r.closingCyls,
      r.closingKg,
    ].join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `production-vs-sales-${data.reportPeriod?.fromDate}.csv`;
  a.click();
}

export default function ProductionVsSalesComparisonReport() {
  return (
    <ProductionReportShell
      title="Production vs Sales Comparison Report"
      description="Compare production output against sales — stock movement, variances, and closing balance."
      endpoint="/api/reports/production/production-vs-sales"
      permission="Production vs Sales Comparison Report"
      localFetcher={getProductionVsSalesReport}
      onExportCsv={exportComparisonCsv}
    >
      {(data, { companyName }) => {
        if (!data) return null;
        const { rows, summary, miscellaneous, meta } = data;
        let lastSection = "";

        return (
          <>
            <div className="mb-3 text-center">
              <h5 className="mb-0 fw-bold">{companyName}</h5>
              <p className="mb-0 text-muted small">
                {meta?.reportHeading || "PRODUCTION AND SALES"}
              </p>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                {
                  label: "Production (cyls)",
                  value: fmtNum(summary?.productionCyls),
                },
                { label: "Sales (cyls)", value: fmtNum(summary?.salesCyls) },
                {
                  label: "Variance (cyls)",
                  value: fmtNum(summary?.productionVsSalesVarianceCyls),
                },
                {
                  label: "Sales amount",
                  value: fmtMoney(summary?.salesAmount),
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="text-xs text-gray-500">{card.label}</div>
                  <div className="text-sm font-semibold">{card.value}</div>
                </div>
              ))}
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0" style={{ fontSize: "0.8rem" }}>
                <thead>
                  <tr className="table-secondary text-center align-middle">
                    <th rowSpan={2} className="text-start">
                      Items
                    </th>
                    <th colSpan={2}>Opening stock</th>
                    <th colSpan={2}>Production</th>
                    <th colSpan={3}>Sales</th>
                    <th colSpan={2}>Price realisation ₦</th>
                    <th colSpan={2}>Closing stock</th>
                  </tr>
                  <tr className="table-light text-center">
                    <th>Cyls</th>
                    <th>kg</th>
                    <th>Cyls</th>
                    <th>kg</th>
                    <th>Cyls</th>
                    <th>kg</th>
                    <th>Amt. ₦</th>
                    <th>Per cyl</th>
                    <th>Per ton</th>
                    <th>Cyls</th>
                    <th>kg</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const showSection = row.section !== lastSection;
                    lastSection = row.section;
                    const rowClass = row.isSubtotal
                      ? "table-warning fw-semibold"
                      : "";
                    return (
                      <tr key={`${row.section}-${row.item}-${idx}`} className={rowClass}>
                        <td>
                          {showSection && !row.isSubtotal && (
                            <div className="fw-bold text-primary small mb-1">
                              {row.section}
                            </div>
                          )}
                          {row.item}
                          {row.note && (
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                              *{row.note}
                            </div>
                          )}
                        </td>
                        <td className="text-end">{fmtNum(row.openingCyls)}</td>
                        <td className="text-end">{fmtNum(row.openingKg)}</td>
                        <td className="text-end">{fmtNum(row.productionCyls)}</td>
                        <td className="text-end">{fmtNum(row.productionKg)}</td>
                        <td className="text-end">{fmtNum(row.salesCyls)}</td>
                        <td className="text-end">{fmtNum(row.salesKg)}</td>
                        <td className="text-end">
                          {row.salesAmount ? fmtMoney(row.salesAmount).replace("₦", "") : "—"}
                        </td>
                        <td className="text-end">{fmtNum(row.pricePerCyl)}</td>
                        <td className="text-end">{fmtNum(row.pricePerTon)}</td>
                        <td className="text-end">{fmtNum(row.closingCyls)}</td>
                        <td className="text-end">{fmtNum(row.closingKg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {miscellaneous?.length > 0 && (
              <div className="mt-4">
                <h6 className="fw-semibold">Miscellaneous charges</h6>
                <table className="table table-sm table-bordered w-auto">
                  <tbody>
                    {miscellaneous.map((item) => (
                      <tr key={item.item}>
                        <td>{item.item}</td>
                        <td className="text-end">{fmtMoney(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="table-warning fw-bold">
                      <td>Grand total (sales + misc.)</td>
                      <td className="text-end">{fmtMoney(summary?.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }}
    </ProductionReportShell>
  );
}
