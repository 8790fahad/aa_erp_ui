/**
 * Customer-level AR aging buckets — table styling aligned with Debtors / receivable report.
 */
export default function ReceivableAgingSummaryTable({
  rows,
  totals,
  formatCurrency,
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-600 text-white">
            <th className="text-left text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
              customer
            </th>
            <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
              current (₦)
            </th>
            <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
              1-30 days (₦)
            </th>
            <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
              31-60 days (₦)
            </th>
            <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
              61+ days (₦)
            </th>
            <th className="text-right text-xs font-semibold px-3 py-2.5 border-b border-slate-500 uppercase tracking-wide">
              total (₦)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.customerNo} className="border-b border-gray-200">
              <td className="px-3 py-2 text-gray-900">
                <span className="font-medium block">{r.customerName}</span>
                <span className="text-gray-500 text-xs">{r.customerNo}</span>
              </td>
              <td className="px-3 py-2 text-right border-r border-gray-100">
                {formatCurrency(r.current)}
              </td>
              <td className="px-3 py-2 text-right border-r border-gray-100">
                {formatCurrency(r.d1_30)}
              </td>
              <td className="px-3 py-2 text-right border-r border-gray-100">
                {formatCurrency(r.d31_60)}
              </td>
              <td className="px-3 py-2 text-right border-r border-gray-100">
                {formatCurrency(r.d61_plus)}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {formatCurrency(r.total)}
              </td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="bg-gray-100 font-semibold border-t-2 border-b border-gray-400">
              <td className="px-3 py-2 text-sm">Totals</td>
              <td className="px-3 py-2 text-sm text-right">
                {formatCurrency(totals.current)}
              </td>
              <td className="px-3 py-2 text-sm text-right">
                {formatCurrency(totals.d1_30)}
              </td>
              <td className="px-3 py-2 text-sm text-right">
                {formatCurrency(totals.d31_60)}
              </td>
              <td className="px-3 py-2 text-sm text-right">
                {formatCurrency(totals.d61_plus)}
              </td>
              <td className="px-3 py-2 text-sm text-right">
                {formatCurrency(totals.total)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
