import { formatNaira } from "@/components/router/utilities";

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

const emptyCell = "—";

const headRowClass = "bg-gray-600 border-b border-gray-700";
const headCellClass = "px-2 py-2 font-bold text-white uppercase tracking-wide";

function AccountCodeLink({ code, name, onAccountClick }) {
  const value = String(code || "").trim();
  if (!value) return emptyCell;
  if (!onAccountClick) return value;
  return (
    <button
      type="button"
      onClick={() => onAccountClick(value, name || value)}
      className="font-mono text-blue-700 underline font-medium hover:text-blue-900"
      title="Open account ledger"
    >
      {value}
    </button>
  );
}

function NoteAccountSummaryTable({ items = [], currentYearLabel, onAccountClick }) {
  if (!items.length) return null;

  const totalDebit = items.reduce((s, i) => s + (i.debit || 0), 0);
  const totalCredit = items.reduce((s, i) => s + (i.credit || 0), 0);
  const totalNet = items.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <table className="w-full text-xs border-collapse mb-3">
      <thead>
        <tr className={headRowClass}>
          <th className={`${headCellClass} text-left w-24`}>Code</th>
          <th className={`${headCellClass} text-left`}>Account</th>
          <th className={`${headCellClass} text-right min-w-[5.5rem]`}>Dr (₦)</th>
          <th className={`${headCellClass} text-right min-w-[5.5rem]`}>Cr (₦)</th>
          <th className={`${headCellClass} text-right min-w-[5.5rem]`}>
            Net ({currentYearLabel})
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => (
          <tr key={`${item.accountCode || idx}`} className="border-b border-gray-100">
            <td className="px-2 py-1 text-gray-700">
              <AccountCodeLink
                code={item.accountCode}
                name={item.name}
                onAccountClick={onAccountClick}
              />
            </td>
            <td className="px-2 py-1 text-gray-900">{item.name || emptyCell}</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {item.debit ? formatCurrency(item.debit) : emptyCell}
            </td>
            <td className="px-2 py-1 text-right tabular-nums">
              {item.credit ? formatCurrency(item.credit) : emptyCell}
            </td>
            <td className="px-2 py-1 text-right tabular-nums font-medium">
              {formatCurrency(item.amount || 0)}
            </td>
          </tr>
        ))}
        <tr className="bg-gray-50 font-semibold border-t border-gray-200">
          <td className="px-2 py-1.5" colSpan={2}>
            Account totals
          </td>
          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(totalDebit)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(totalCredit)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(totalNet)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function NoteJournalEntriesTable({ entries = [], onAccountClick }) {
  if (!entries.length) return null;

  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
        Journal entries
      </p>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className={headRowClass}>
            <th className={`${headCellClass} text-left w-[4.5rem]`}>Date</th>
            <th className={`${headCellClass} text-left w-20`}>Ref</th>
            <th className={`${headCellClass} text-left w-16`}>Code</th>
            <th className={`${headCellClass} text-left`}>Description</th>
            <th className={`${headCellClass} text-right min-w-[5rem]`}>Dr (₦)</th>
            <th className={`${headCellClass} text-right min-w-[5rem]`}>Cr (₦)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr
              key={`${entry.ref}-${entry.accountCode}-${entry.date}-${idx}`}
              className="border-b border-gray-100"
            >
              <td className="px-2 py-1 text-gray-700 whitespace-nowrap">
                {formatDate(entry.date)}
              </td>
              <td className="px-2 py-1 text-gray-700">{entry.ref || emptyCell}</td>
              <td className="px-2 py-1 text-gray-700">
                <AccountCodeLink
                  code={entry.accountCode}
                  name={entry.accountName}
                  onAccountClick={onAccountClick}
                />
              </td>
              <td className="px-2 py-1 text-gray-900">
                {entry.description || entry.accountName || emptyCell}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {entry.debit ? formatCurrency(entry.debit) : emptyCell}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {entry.credit ? formatCurrency(entry.credit) : emptyCell}
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold border-t border-gray-200">
            <td className="px-2 py-1.5" colSpan={4}>
              Total
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(totalDebit)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

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
  onAccountClick,
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
          const hasDetail =
            (note.items || []).length > 0 || (note.entries || []).length > 0;

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
              {hasDetail ? (
                <>
                  <NoteAccountSummaryTable
                    items={note.items}
                    currentYearLabel={currentYearLabel || "Period"}
                    onAccountClick={onAccountClick}
                  />
                  <NoteJournalEntriesTable
                    entries={note.entries}
                    onAccountClick={onAccountClick}
                  />
                </>
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
  "/app/reports/accounting-reports/aa_erp-income-statement-notes";

export function buildIncomeStatementNotesUrl(fromDate, toDate, noteRef) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);
  if (noteRef != null && noteRef !== "") params.set("note", String(noteRef));
  const q = params.toString();
  return q ? `${INCOME_STATEMENT_NOTES_PATH}?${q}` : INCOME_STATEMENT_NOTES_PATH;
}
