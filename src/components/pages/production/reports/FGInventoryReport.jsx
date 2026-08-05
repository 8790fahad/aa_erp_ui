import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { _fetchApi } from "@/redux/actions/api";
import { useReportPermissions } from "@/components/pages/report/hooks/useReportPermissions";
import InventoryReportShell from "./InventoryReportShell";
import {
  ReportDataSection,
  SelectField,
  formatCell,
  formatMoneyCell,
  formatReportDate,
} from "./productionReportUi";

const SUMMARY_PATH = "/app/production/production-reports/fg-inventory";
const BY_LOCATION_PATH =
  "/app/production/production-reports/fg-inventory-by-location";

function sumField(items, field) {
  return items.reduce((acc, item) => acc + Number(item[field] || 0), 0);
}

function buildLocationOptions(locations = []) {
  return [
    { value: "", label: "Select location" },
    ...(locations || []).map((loc) => ({
      value: String(loc.branch_id ?? loc.id ?? ""),
      label: loc.branch_name || loc.storeName || loc.name || `Warehouse #${loc.branch_id ?? loc.id}`,
    })),
  ];
}

function exportCsv(data, { byLocation, reportMode }) {
  if (!data?.items?.length) return;
  const { items } = data;
  const isMovement = reportMode === "movement" || data.mode === "movement";

  let headers;
  let lines;
  let totals;

  if (!isMovement) {
    headers = byLocation
      ? ["SKU", "Product", "Warehouse/Location", "Qty on Hand", "Unit Cost", "Inventory Value"]
      : ["SKU", "Product", "Qty on Hand", "Unit Cost", "Inventory Value"];
    lines = items.map((r) =>
      [
        r.batch_no,
        `"${r.product_name}"`,
        ...(byLocation ? [`"${r.warehouse_location || ""}"`] : []),
        r.quantity_on_hand ?? r.quantity ?? 0,
        r.cost_per_unit ?? 0,
        r.inventory_value ?? 0,
      ].join(","),
    );
    totals = [
      "TOTAL",
      "",
      ...(byLocation ? [""] : []),
      sumField(items, "quantity_on_hand") || sumField(items, "quantity"),
      "",
      sumField(items, "inventory_value"),
    ];
  } else {
    headers = byLocation
      ? [
          "SKU",
          "Product",
          "Warehouse/Location",
          "Opening",
          "Received",
          "Sold",
          "Adjustments",
          "Closing",
        ]
      : [
          "SKU",
          "Product",
          "Opening",
          "Produced",
          "Issued",
          "Sold",
          "Adjustments",
          "Closing",
        ];
    lines = items.map((r) =>
      byLocation
        ? [
            r.batch_no,
            `"${r.product_name}"`,
            `"${r.warehouse_location || ""}"`,
            r.opening_quantity ?? 0,
            r.transfers_in_quantity ?? 0,
            r.sold_quantity ?? 0,
            r.adjustments_quantity ?? 0,
            r.closing_quantity ?? r.quantity ?? 0,
          ].join(",")
        : [
            r.batch_no,
            `"${r.product_name}"`,
            r.opening_quantity ?? 0,
            r.produced_quantity ?? 0,
            r.transfers_in_quantity ?? 0,
            r.sold_quantity ?? 0,
            r.adjustments_quantity ?? 0,
            r.closing_quantity ?? r.quantity ?? 0,
          ].join(","),
    );
    totals = byLocation
      ? [
          "TOTAL",
          "",
          "",
          sumField(items, "opening_quantity"),
          sumField(items, "transfers_in_quantity"),
          sumField(items, "sold_quantity"),
          sumField(items, "adjustments_quantity"),
          sumField(items, "closing_quantity") || sumField(items, "quantity"),
        ]
      : [
          "TOTAL",
          "",
          sumField(items, "opening_quantity"),
          sumField(items, "produced_quantity"),
          sumField(items, "transfers_in_quantity"),
          sumField(items, "sold_quantity"),
          sumField(items, "adjustments_quantity"),
          sumField(items, "closing_quantity") || sumField(items, "quantity"),
        ];
  }

  const blob = new Blob([[headers.join(","), ...lines, totals.join(",")].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fg-inventory-${isMovement ? "movement" : "snapshot"}${
    byLocation ? "-by-location" : ""
  }-${data.reportInfo?.asOfDate || data.reportInfo?.toDate}.csv`;
  a.click();
}

export default function FGInventoryReport() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const byLocation = pathname.includes("fg-inventory-by-location");
  const { activeBusiness } = useReportPermissions();
  const facilityId = activeBusiness?.id || "";

  const [reportMode, setReportMode] = useState("snapshot"); // snapshot | movement
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);

  const endpoint = byLocation
    ? "/api/reports/inventory/fg-by-location"
    : "/api/reports/inventory/fg";

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
        const normalized = rows
          .map((b) => ({
            branch_id: b.id,
            branch_name: (b.storeName || b.branch_name || "").trim(),
          }))
          .filter((b) => b.branch_id != null && b.branch_name)
          .sort((a, b) => a.branch_name.localeCompare(b.branch_name));
        setLocationOptions(normalized);
      },
      (err) => {
        console.error(err);
        if (!cancelled) setLocationOptions([]);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [byLocation, facilityId]);

  const requestExtras = useCallback(() => {
    const extras = { mode: reportMode };
    if (byLocation) {
      extras.branchId = Number(locationFilter);
    }
    return extras;
  }, [byLocation, locationFilter, reportMode]);

  const validateBeforeRun = useCallback(() => {
    if (byLocation && (locationFilter === "" || locationFilter == null)) {
      return "Select a location to run the by-location report.";
    }
    return null;
  }, [byLocation, locationFilter]);

  return (
    <InventoryReportShell
      key={`${byLocation ? "loc" : "sum"}-${reportMode}`}
      title="FG Inventory Report"
      reportHeaderTitle="FG INVENTORY REPORT"
      endpoint={endpoint}
      permission="FG Inventory Report"
      dateMode={reportMode === "movement" ? "range" : "asOf"}
      requestExtras={requestExtras}
      validateBeforeRun={validateBeforeRun}
      onExportCsv={(data) => exportCsv(data, { byLocation, reportMode })}
      toolbarExtras={
        <>
          <SelectField
            label="Report type"
            value={reportMode}
            onChange={setReportMode}
            options={[
              { value: "snapshot", label: "As of Date (Snapshot)" },
              { value: "movement", label: "Date Range (Movement)" },
            ]}
          />
          <label className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded border border-gray-300 bg-white px-3 text-sm">
            <input
              type="checkbox"
              checked={byLocation}
              onChange={(e) => {
                const next = e.target.checked;
                setLocationFilter("");
                if (!next) setLocationOptions([]);
                navigate(next ? BY_LOCATION_PATH : SUMMARY_PATH);
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
        </>
      }
    >
      {(data) => {
        if (!data) return null;
        const { items, reportInfo } = data;
        const isLocationView = byLocation || data.view === "location";
        const isMovement = reportMode === "movement" || data.mode === "movement";

        const periodSubtitle = isMovement
          ? `Movements ${formatReportDate(reportInfo?.fromDate)} – ${formatReportDate(
              reportInfo?.toDate,
            )} · Closing as of ${formatReportDate(reportInfo?.toDate)}`
          : `Stock snapshot as of ${formatReportDate(reportInfo?.asOfDate)}`;

        if (!isMovement) {
          const tableRows = items.map((row) => {
            const qty = row.quantity_on_hand ?? row.quantity;
            const base = [
              row.batch_no || "—",
              row.product_name,
              ...(isLocationView ? [row.warehouse_location || "—"] : []),
              formatCell(qty),
              formatMoneyCell(row.cost_per_unit),
              formatMoneyCell(row.inventory_value),
            ];
            return base;
          });
          const summaryRow = items.length
            ? [
                "TOTAL",
                "",
                ...(isLocationView ? [""] : []),
                formatCell(
                  sumField(items, "quantity_on_hand") || sumField(items, "quantity"),
                ),
                "",
                formatMoneyCell(sumField(items, "inventory_value")),
              ]
            : null;

          return (
            <ReportDataSection
              sectionTitle={`${
                isLocationView
                  ? "Finished Goods by Location"
                  : "Finished Goods Inventory"
              } — ${items.length} items`}
              sectionSubtitle={periodSubtitle}
              headers={
                isLocationView
                  ? [
                      "SKU",
                      "Product",
                      "Warehouse/Location",
                      "Qty on Hand",
                      "Unit Cost",
                      "Inventory Value",
                    ]
                  : ["SKU", "Product", "Qty on Hand", "Unit Cost", "Inventory Value"]
              }
              rows={tableRows}
              summaryRow={summaryRow}
              columnAlign={
                isLocationView
                  ? ["left", "left", "left", "right", "right", "right"]
                  : ["left", "left", "right", "right", "right"]
              }
              emptyMessage="No finished goods inventory found."
            />
          );
        }

        const tableRows = items.map((row) =>
          isLocationView
            ? [
                row.batch_no || "—",
                row.product_name,
                row.warehouse_location || "—",
                formatCell(row.opening_quantity ?? 0),
                formatCell(row.transfers_in_quantity ?? 0),
                formatCell(row.sold_quantity ?? 0),
                formatCell(row.adjustments_quantity ?? 0),
                formatCell(row.closing_quantity ?? row.quantity),
              ]
            : [
                row.batch_no || "—",
                row.product_name,
                formatCell(row.opening_quantity ?? 0),
                formatCell(row.produced_quantity ?? 0),
                formatCell(row.transfers_in_quantity ?? 0),
                formatCell(row.sold_quantity ?? 0),
                formatCell(row.adjustments_quantity ?? 0),
                formatCell(row.closing_quantity ?? row.quantity),
              ],
        );

        const summaryRow = items.length
          ? isLocationView
            ? [
                "TOTAL",
                "",
                "",
                formatCell(sumField(items, "opening_quantity")),
                formatCell(sumField(items, "transfers_in_quantity")),
                formatCell(sumField(items, "sold_quantity")),
                formatCell(sumField(items, "adjustments_quantity")),
                formatCell(
                  sumField(items, "closing_quantity") || sumField(items, "quantity"),
                ),
              ]
            : [
                "TOTAL",
                "",
                formatCell(sumField(items, "opening_quantity")),
                formatCell(sumField(items, "produced_quantity")),
                formatCell(sumField(items, "transfers_in_quantity")),
                formatCell(sumField(items, "sold_quantity")),
                formatCell(sumField(items, "adjustments_quantity")),
                formatCell(
                  sumField(items, "closing_quantity") || sumField(items, "quantity"),
                ),
              ]
          : null;

        return (
          <ReportDataSection
            sectionTitle={`${
              isLocationView
                ? "Finished Goods by Location"
                : "Finished Goods Movement"
            } — ${items.length} items`}
            sectionSubtitle={periodSubtitle}
            headers={
              isLocationView
                ? [
                    "SKU",
                    "Product",
                    "Warehouse/Location",
                    "Opening",
                    "Received",
                    "Sold",
                    "Adjustments",
                    "Closing",
                  ]
                : [
                    "SKU",
                    "Product",
                    "Opening",
                    "Produced",
                    "Issued",
                    "Sold",
                    "Adjustments",
                    "Closing",
                  ]
            }
            rows={tableRows}
            summaryRow={summaryRow}
            columnAlign={
              isLocationView
                ? [
                    "left",
                    "left",
                    "left",
                    "right",
                    "right",
                    "right",
                    "right",
                    "right",
                  ]
                : [
                    "left",
                    "left",
                    "right",
                    "right",
                    "right",
                    "right",
                    "right",
                    "right",
                  ]
            }
            emptyMessage="No finished goods movements found for the selected period."
          />
        );
      }}
    </InventoryReportShell>
  );
}
