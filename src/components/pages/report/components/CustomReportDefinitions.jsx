import { LayoutTemplate, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Saved custom report definitions (accounting_custom_reports) for the hub page
 * (no query params). Hidden while an account ledger is open on the same route.
 *
 * @param {object} props
 * @param {Array<Record<string, unknown>>} props.rows
 * @param {boolean} props.loading
 * @param {(row: Record<string, unknown>) => void} props.onOpenRow
 */
export default function CustomReportDefinitions({
  rows = [],
  loading = false,
  onOpenRow,
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-2">
            <LayoutTemplate className="h-7 w-7 text-blue-800" />
          </div>
          <CardTitle className="text-xl">Saved report shortcuts</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No saved shortcuts yet. Save from Chart of Accounts (Configure
            Report).
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-md border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 p-3 hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{row.title}</div>
                  {row.description && (
                    <div className="mt-0.5 text-sm text-slate-600">
                      {row.description}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onOpenRow?.(row)}
                >
                  Open
                  <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
