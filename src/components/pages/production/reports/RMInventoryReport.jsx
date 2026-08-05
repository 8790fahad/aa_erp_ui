import { useCallback, useState } from "react";
import InventoryReportShell from "./InventoryReportShell";
import {
  ReportDataSection,
  SelectField,
  formatCell,
  formatMoneyCell,
  formatReportDate,
} from "./productionReportUi";

function sumField(items, field) {
  return items.reduce((acc, item) => acc + Number(item[field] || 0), 0);
}

function exportCsv(data, reportMode) {
  if (!data?.items?.length) return;
  const { items } = data;
  const isMovement = reportMode === "movement" || data.mode === "movement";

  let headers;
  let lines;
  let totals;

  if (!isMovement) {
    headers = ["SKU", "Raw Material", "Qty on Hand", "Unit Cost", "Inventory Value"];
    lines = items.map((r) =>
      [
        r.sku,
        `"${r.name}"`,
        r.quantity_on_hand ?? r.stock_qty ?? 0,
        r.cost_per_unit ?? 0,
        r.inventory_value ?? 0,
      ].join(","),
    );
    totals = [
      "TOTAL",
      "",
      sumField(items, "quantity_on_hand") || sumField(items, "stock_qty"),
      "",
      sumField(items, "inventory_value"),
    ];
  } else {
    headers = [
      "SKU",
      "Raw Material",
      "Opening",
      "Purchased",
      "Production Issue",
      "Adjustments",
      "Closing",
    ];
    lines = items.map((r) =>
      [
        r.sku,
        `"${r.name}"`,
        r.opening_quantity ?? 0,
        r.purchased_quantity ?? 0,
        r.production_issue_quantity ?? r.consumed_quantity ?? 0,
        r.adjustments_quantity ?? 0,
        r.closing_quantity ?? r.stock_qty ?? 0,
      ].join(","),
    );
    totals = [
      "TOTAL",
      "",
      sumField(items, "opening_quantity"),
      sumField(items, "purchased_quantity"),
      sumField(items, "production_issue_quantity") ||
        sumField(items, "consumed_quantity"),
      sumField(items, "adjustments_quantity"),
      sumField(items, "closing_quantity") || sumField(items, "stock_qty"),
    ];
  }

  const blob = new Blob([[headers.join(","), ...lines, totals.join(",")].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rm-inventory-${isMovement ? "movement" : "snapshot"}-${
    data.reportInfo?.asOfDate || data.reportInfo?.toDate
  }.csv`;
  a.click();
}

export default function RMInventoryReport() {
  const [reportMode, setReportMode] = useState("snapshot");

  const requestExtras = useCallback(
    () => ({ mode: reportMode }),
    [reportMode],
  );

  return (
    <InventoryReportShell
      key={reportMode}
      title="RM Inventory Report"
      reportHeaderTitle="RM INVENTORY REPORT"
      endpoint="/api/reports/inventory/rm"
      permission="RM Inventory Report"
      dateMode={reportMode === "movement" ? "range" : "asOf"}
      requestExtras={requestExtras}
      onExportCsv={(data) => exportCsv(data, reportMode)}
      toolbarExtras={
        <SelectField
          label="Report type"
          value={reportMode}
          onChange={setReportMode}
          options={[
            { value: "snapshot", label: "As of Date (Snapshot)" },
            { value: "movement", label: "Date Range (Movement)" },
          ]}
        />
      }
    >
      {(data) => {
        if (!data) return null;
        const { items, reportInfo } = data;
        const isMovement = reportMode === "movement" || data.mode === "movement";

        if (!isMovement) {
          const tableRows = items.map((row) => [
            row.sku || "—",
            row.name,
            formatCell(row.quantity_on_hand ?? row.stock_qty),
            formatMoneyCell(row.cost_per_unit),
            formatMoneyCell(row.inventory_value),
          ]);
          const summaryRow = items.length
            ? [
                "TOTAL",
                "",
                formatCell(
                  sumField(items, "quantity_on_hand") || sumField(items, "stock_qty"),
                ),
                "",
                formatMoneyCell(sumField(items, "inventory_value")),
              ]
            : null;

          return (
            <ReportDataSection
              sectionTitle={`Raw Materials Inventory — ${items.length} items`}
              sectionSubtitle={`Stock snapshot as of ${formatReportDate(
                reportInfo?.asOfDate,
              )}`}
              headers={[
                "SKU",
                "Raw Material",
                "Qty on Hand",
                "Unit Cost",
                "Inventory Value",
              ]}
              rows={tableRows}
              summaryRow={summaryRow}
              columnAlign={["left", "left", "right", "right", "right"]}
              emptyMessage="No raw materials inventory found."
            />
          );
        }

        const tableRows = items.map((row) => [
          row.sku || "—",
          row.name,
          formatCell(row.opening_quantity ?? 0),
          formatCell(row.purchased_quantity ?? 0),
          formatCell(row.production_issue_quantity ?? row.consumed_quantity ?? 0),
          formatCell(row.adjustments_quantity ?? 0),
          formatCell(row.closing_quantity ?? row.stock_qty),
        ]);

        const summaryRow = items.length
          ? [
              "TOTAL",
              "",
              formatCell(sumField(items, "opening_quantity")),
              formatCell(sumField(items, "purchased_quantity")),
              formatCell(
                sumField(items, "production_issue_quantity") ||
                  sumField(items, "consumed_quantity"),
              ),
              formatCell(sumField(items, "adjustments_quantity")),
              formatCell(
                sumField(items, "closing_quantity") || sumField(items, "stock_qty"),
              ),
            ]
          : null;

        return (
          <ReportDataSection
            sectionTitle={`Raw Materials Movement — ${items.length} items`}
            sectionSubtitle={`Movements ${formatReportDate(
              reportInfo?.fromDate,
            )} – ${formatReportDate(reportInfo?.toDate)} · Closing as of ${formatReportDate(
              reportInfo?.toDate,
            )}`}
            headers={[
              "SKU",
              "Raw Material",
              "Opening",
              "Purchased",
              "Production Issue",
              "Adjustments",
              "Closing",
            ]}
            rows={tableRows}
            summaryRow={summaryRow}
            columnAlign={["left", "left", "right", "right", "right", "right", "right"]}
            emptyMessage="No raw materials movements found for the selected period."
          />
        );
      }}
    </InventoryReportShell>
  );
}
