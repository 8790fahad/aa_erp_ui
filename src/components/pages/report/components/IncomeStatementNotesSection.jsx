import { formatNumber1, formatNaira } from "@/components/router/utilities";

const formatCurrency = formatNaira;

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/**
 * Notes block for income statement (used on dedicated notes page).
 */
export default function IncomeStatementNotesSection({
  notes = [],
  fromDate,
  toDate,
  currentYearLabel,
  exportRef,
  highlightNoteRef,
}) {
  if (!notes.length) return null;

  return (
    <div
      id="income-statement-notes"
      ref={exportRef}
      className="bg-white border border-gray-300 rounded-sm overflow-hidden shadow-sm"
    >
      <div className="bg-gray-700 px-4 py-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">
          Notes to the Income Statement
        </h2>
        <p className="text-gray-200 text-xs mt-0.5">
          Period: {formatDate(fromDate)} – {formatDate(toDate)}
        </p>
      </div>
      <div className="divide-y divide-gray-200">
        {notes.map((note) => {
          const isHighlighted =
            highlightNoteRef != null &&
            highlightNoteRef !== "" &&
            String(note.noteRef) === String(highlightNoteRef);
          return (
            <div
              id={`income-statement-note-${note.noteRef}`}
              key={`note-${note.noteRef}-${note.title}`}
              className={`scroll-mt-4 px-4 py-3 ${
                isHighlighted ? "bg-blue-50/80 ring-1 ring-inset ring-blue-200" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Note {note.noteRef}
                  {note.title || note.description
                    ? ` — ${note.title || note.description}`
                    : ""}
                </h3>
                <span className="text-sm font-semibold tabular-nums text-gray-800">
                  {formatCurrency(note.total || 0)}
                </span>
              </div>
              {(note.items || []).length > 0 ? (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600 w-24">
                        Code
                      </th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-600">
                        Account
                      </th>
                      <th className="px-2 py-1.5 text-right font-semibold text-gray-600 min-w-[7rem]">
                        {currentYearLabel} (₦)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(note.items || []).map((item, idx) => (
                      <tr
                        key={`${note.noteRef}-${item.accountCode || idx}`}
                        className="border-b border-gray-100"
                      >
                        <td className="px-2 py-1 text-gray-700">
                          {item.accountCode || "—"}
                        </td>
                        <td className="px-2 py-1 text-gray-900">{item.name || "—"}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatCurrency(item.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-gray-500 italic">No line-item detail.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const INCOME_STATEMENT_NOTES_PATH =
  "/app/reports/accounting-reports/inventria-income-statement-notes";

export function buildIncomeStatementNotesUrl(fromDate, toDate, noteRef) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);
  if (noteRef != null && noteRef !== "") params.set("note", String(noteRef));
  const q = params.toString();
  return q ? `${INCOME_STATEMENT_NOTES_PATH}?${q}` : INCOME_STATEMENT_NOTES_PATH;
}
