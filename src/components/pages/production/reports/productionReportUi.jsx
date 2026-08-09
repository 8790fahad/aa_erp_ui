import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";
import { Loader2, ChevronDown, Download, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

export function formatReportDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  const v = Number(value);
  if (Number.isNaN(v)) return String(value);
  if (Math.abs(v) < 0.005) return "—";
  if (v < 0) return `(${formatNumber1(Math.abs(v))})`;
  return formatNumber1(v);
}

export function formatMoneyCell(value) {
  const formatted = formatCell(value);
  return formatted === "—" ? "—" : `₦${formatted}`;
}

export function ReportPrintStyles() {
  return (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        .print-content { padding: 0; box-shadow: none; }
        @page { margin: 8mm; size: A4 portrait; }
        html, body { background: #fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    `}</style>
  );
}

export function ReportControlsBar({
  onBack,
  loading,
  onGenerate,
  onExportCsv,
  exportDisabled,
  children,
}) {
  return (
    <div className="bg-gray-100 rounded-lg no-print px-2 py-2 mb-2">
      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto">
        <div className="flex min-w-0 flex-nowrap items-end gap-2">{children}</div>
        <div className="ml-auto flex shrink-0 flex-nowrap items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 border-gray-300"
            onClick={onGenerate}
            disabled={loading}
            title="Run report"
            aria-label="Run report"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-10 w-10"
            onClick={onBack}
            title="Close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
          {onExportCsv && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 border-gray-300"
                  disabled={exportDisabled || loading}
                  title="Export"
                  aria-label="Export"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={exportDisabled || loading}
                  onClick={onExportCsv}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

export function DateField({ label, value, onChange }) {
  return (
    <div className="flex w-[9.5rem] shrink-0 flex-col gap-1">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded border border-gray-300 bg-white px-2 text-sm"
      />
    </div>
  );
}

export function SelectField({ label, value, onChange, options = [] }) {
  return (
    <div className="flex w-[12rem] shrink-0 flex-col gap-1">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded border border-gray-300 bg-white px-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ReportHeaderBand({ business, reportTitle, periodLabel, extraLine }) {
  return (
    <BusinessDocumentHeader
      business={business}
      title={reportTitle}
      numberLabel={periodLabel}
      extraLine={extraLine}
      date={new Date()}
      dateFormat="dddd, DD MMMM YYYY hh:mm A [GMT]Z"
      className="mb-0"
    />
  );
}

export function ReportSummaryCards({ cards }) {
  if (!cards?.length) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-3">
      {cards.map(({ label, value, highlight, warn }) => (
        <div
          key={label}
          className={`rounded border px-4 py-3 ${
            highlight
              ? "bg-[var(--aa-navy,#0f2744)] text-white border-[var(--aa-navy,#0f2744)]"
              : warn
                ? "bg-red-50 border-red-200"
                : "bg-white border-gray-200"
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              highlight ? "text-white/80" : warn ? "text-red-600" : "text-gray-500"
            }`}
          >
            {label}
          </p>
          <p
            className={`text-xl font-bold mt-1 tabular-nums ${
              highlight ? "text-white" : warn ? "text-red-700" : "text-gray-900"
            }`}
          >
            {value ?? "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Styled data table matching Inventory Valuation report.
 * headers: string[]
 * rows: array of cell values (ReactNode or string/number)
 * columnAlign: optional per-column 'left' | 'right'
 */
export function ReportDataSection({
  sectionTitle,
  sectionSubtitle,
  headers,
  rows,
  columnAlign = [],
  footerLabel,
  footerValue,
  footerColSpan,
  summaryRow,
  emptyMessage = "No records found",
}) {
  const labelSpan = footerColSpan ?? headers.length - 1;
  const trailingCols = Math.max(0, headers.length - labelSpan - 1);

  return (
    <div className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm mb-4">
      {sectionTitle && (
        <div className="bg-gray-600 px-3 py-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">
            {sectionTitle}
          </h2>
          {sectionSubtitle && (
            <p className="text-xs text-gray-200 mt-0.5 normal-case">{sectionSubtitle}</p>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={h}
                  className={`px-3 py-2 text-xs font-bold text-gray-700 uppercase border-r border-gray-200 ${
                    columnAlign[i] === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-6 text-center text-gray-400 text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-gray-100 hover:bg-gray-50/80"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-3 py-1.5 border-r border-gray-100 ${
                        columnAlign[ci] === "right"
                          ? "text-right tabular-nums"
                          : "text-gray-900"
                      } ${ci === 0 ? "" : "text-gray-700"}`}
                    >
                      {cell ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {summaryRow && rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-400">
              <tr>
                {summaryRow.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 font-bold border-r border-gray-200 ${
                      columnAlign[ci] === "right"
                        ? "text-right tabular-nums text-gray-900"
                        : "text-gray-900"
                    }`}
                  >
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
          {!summaryRow && footerLabel && rows.length > 0 && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-400">
              <tr>
                <td
                  colSpan={labelSpan}
                  className="px-3 py-2 font-bold text-gray-900 text-right border-r border-gray-200"
                >
                  {footerLabel}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-900 border-r border-gray-200">
                  {footerValue}
                </td>
                {trailingCols > 0 &&
                  Array.from({ length: trailingCols }).map((_, i) => (
                    <td key={i} className="border-r border-gray-200" />
                  ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function DemoDataBadge({ show }) {
  if (!show) return null;
  return (
    <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 no-print">
      Demo data
    </span>
  );
}
