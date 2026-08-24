import { useState } from "react";
import PropTypes from "prop-types";
import { BookOpen, ChevronRight, X } from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import { Button as UIButton } from "@/components/ui/button";

function JournalTable({ preview }) {
  const rows = preview?.rows || [];

  return (
    <div className="overflow-x-auto rounded-lg border border-purple-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <th className="w-10 px-3 py-2.5 text-center text-xs font-bold text-gray-700 uppercase">
              #
            </th>
            <th className="w-28 px-3 py-2.5 text-left text-xs font-bold text-gray-700 uppercase">
              Account
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-700 uppercase">
              Description
            </th>
            <th className="w-32 px-3 py-2.5 text-right text-xs font-bold text-gray-700 uppercase">
              Dr (₦)
            </th>
            <th className="w-32 px-3 py-2.5 text-right text-xs font-bold text-gray-700 uppercase">
              Cr (₦)
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((row, idx) => (
            <tr key={`${row.account}-${idx}`} className="hover:bg-purple-50/40">
              <td className="px-3 py-2 text-center tabular-nums text-gray-500">
                {idx + 1}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-900">
                {row.account}
              </td>
              <td className="px-3 py-2 text-gray-800">{row.description}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                {row.dr > 0 ? formatNumber1(row.dr) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                {row.cr > 0 ? formatNumber1(row.cr) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-purple-200 bg-indigo-100 font-bold">
            <td colSpan={3} className="px-3 py-2.5 text-right text-indigo-900">
              Totals
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-indigo-900">
              {formatNumber1(preview.totalDr)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-indigo-900">
              {formatNumber1(preview.totalCr)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

JournalTable.propTypes = {
  preview: PropTypes.shape({
    rows: PropTypes.array,
    totalDr: PropTypes.number,
    totalCr: PropTypes.number,
  }).isRequired,
};

/** Compact link — opens full journal in app-style modal */
export default function SharedCostingJournalPreview({ preview }) {
  const rows = preview?.rows || [];
  const [open, setOpen] = useState(false);

  if (!rows.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 w-full rounded-xl border border-purple-200 bg-white overflow-hidden shadow-sm text-left transition-all hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <div className="flex items-center justify-between gap-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-4 w-4 shrink-0 text-indigo-600" />
            <h3 className="text-sm font-bold text-indigo-800">
              Account Treatment — Shared Costing
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                preview.balanced
                  ? "bg-green-100 text-green-800 border border-green-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              {preview.balanced ? "Balanced" : "Out of balance"}
            </span>
            <ChevronRight className="h-4 w-4 text-indigo-400" />
          </div>
        </div>
        <div className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600">
          <span>
            <span className="font-semibold text-gray-800">{rows.length}</span>{" "}
            journal line{rows.length === 1 ? "" : "s"}
          </span>
          <span>
            Total Dr:{" "}
            <span className="font-semibold tabular-nums text-gray-900">
              ₦{formatNumber1(preview.totalDr)}
            </span>
          </span>
          <span>
            Total Cr:{" "}
            <span className="font-semibold tabular-nums text-gray-900">
              ₦{formatNumber1(preview.totalCr)}
            </span>
          </span>
          <span className="text-indigo-600 font-semibold">Click to view</span>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-[var(--aa-navy)] text-white p-5 flex-shrink-0">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 shrink-0" />
                    Account Treatment — Shared Costing
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Double-entry journal preview for this production batch
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      preview.balanced
                        ? "bg-green-500/20 text-green-100 border border-green-300/40"
                        : "bg-red-500/20 text-red-100 border border-red-300/40"
                    }`}
                  >
                    {preview.balanced ? "Balanced" : "Out of balance"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <JournalTable preview={preview} />
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <UIButton
                variant="outline"
                onClick={() => setOpen(false)}
                className="border-gray-300"
              >
                Close
              </UIButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

SharedCostingJournalPreview.propTypes = {
  preview: PropTypes.shape({
    rows: PropTypes.array,
    totalDr: PropTypes.number,
    totalCr: PropTypes.number,
    balanced: PropTypes.bool,
  }),
};
