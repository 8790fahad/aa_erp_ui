const fmt = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtSigned = (n) => {
  const v = Number(n || 0);
  return v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v);
};

const SectionRows = ({ title, lines = [], showAccountCodes = false }) => {
  if (!lines?.length) return null;
  return (
    <>
      <tr className="bg-gray-50">
        <td colSpan={3} className="px-3 py-1.5 text-xs font-bold text-gray-800 uppercase tracking-wide">
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={`${title}-${l.account_code}`} className="border-b border-gray-100 hover:bg-gray-50/80">
          <td className="px-3 py-1.5 text-sm text-gray-800">
            {showAccountCodes && (
              <span className="text-[10px] font-mono text-gray-400 mr-2">
                {l.account_code}
              </span>
            )}
            {l.account_name}
          </td>
          <td className="px-3 py-1.5 text-sm text-right tabular-nums">
            {fmtSigned(l.cumulative)}
          </td>
          <td className="px-3 py-1.5 text-sm text-right tabular-nums">
            {fmtSigned(l.current_month)}
          </td>
        </tr>
      ))}
    </>
  );
};

const TotalRow = ({ label, cum, cur, accent = false, bold = false }) => (
  <tr
    className={
      accent
        ? "bg-blue-900/10 font-bold border-t-2 border-gray-400"
        : bold
          ? "bg-gray-100 font-semibold border-t border-gray-300"
          : "bg-gray-50 font-medium"
    }
  >
    <td className="px-3 py-2 text-sm text-gray-900">{label}</td>
    <td className="px-3 py-2 text-sm text-right tabular-nums">{fmtSigned(cum)}</td>
    <td className="px-3 py-2 text-sm text-right tabular-nums">{fmtSigned(cur)}</td>
  </tr>
);

/**
 * Profit & Loss Summary table (Cumulative + Current Month).
 * Matches the operating P&L summary layout from uploaded templates.
 */
export default function ProfitLossSummaryTable({
  report,
  showAccountCodes = false,
  showExtendedSections = true,
}) {
  if (!report) return null;

  const cmStart = report.period?.current_month?.start;
  const cmEnd = report.period?.current_month?.end;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse border border-gray-300">
        <thead className="bg-gray-600 border-b-2 border-gray-700">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase border-r border-gray-500">
              Description
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase border-r border-gray-500 min-w-[9rem]">
              Cumulative (N)
              <div className="text-[9px] font-normal text-gray-300 normal-case mt-0.5">
                {report.period?.date_from} → {report.period?.date_to}
              </div>
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase bg-gray-700 min-w-[9rem]">
              Current month (N)
              <div className="text-[9px] font-normal text-gray-300 normal-case mt-0.5">
                {cmStart} → {cmEnd}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <SectionRows
            title="Sales"
            lines={report.sales_and_stock?.sales?.lines}
            showAccountCodes={showAccountCodes}
          />
          <TotalRow
            label="Sales"
            cum={report.sales_and_stock?.sales?.cumulative}
            cur={report.sales_and_stock?.sales?.current_month}
            bold
          />
          <tr className="border-b border-gray-100">
            <td className="px-3 py-1.5 pl-6 text-sm text-gray-800">Less: Opening Stock</td>
            <td className="px-3 py-1.5 text-right text-sm tabular-nums">
              {fmtSigned(report.sales_and_stock?.opening_stock?.cumulative)}
            </td>
            <td className="px-3 py-1.5 text-right text-sm tabular-nums">
              {fmtSigned(report.sales_and_stock?.opening_stock?.current_month)}
            </td>
          </tr>
          <TotalRow
            label="Sales (Net of Opening Stock)"
            cum={report.sales_and_stock?.sales_net?.cumulative}
            cur={report.sales_and_stock?.sales_net?.current_month}
          />
          <tr className="border-b border-gray-100">
            <td className="px-3 py-1.5 pl-6 text-sm text-gray-800">Add: Closing Stock</td>
            <td className="px-3 py-1.5 text-right text-sm tabular-nums">
              {fmtSigned(report.sales_and_stock?.closing_stock?.cumulative)}
            </td>
            <td className="px-3 py-1.5 text-right text-sm tabular-nums">
              {fmtSigned(report.sales_and_stock?.closing_stock?.current_month)}
            </td>
          </tr>
          <TotalRow
            label="Adjusted Output"
            cum={report.sales_and_stock?.adjusted_output?.cumulative}
            cur={report.sales_and_stock?.adjusted_output?.current_month}
            accent
          />

          <SectionRows
            title="Consumption of"
            lines={report.material_consumption?.lines}
            showAccountCodes={showAccountCodes}
          />
          <TotalRow
            label="Total Material Consumption"
            cum={report.material_consumption?.totals?.cumulative}
            cur={report.material_consumption?.totals?.current_month}
            bold
          />
          <TotalRow
            label="Available Conversion Margin"
            cum={report.conversion_margin?.cumulative}
            cur={report.conversion_margin?.current_month}
            accent
          />

          {showExtendedSections && (
            <>
              <SectionRows
                title="Manufacturing Expenses"
                lines={report.manufacturing_expenses?.lines}
                showAccountCodes={showAccountCodes}
              />
              <TotalRow
                label="Total Manufacturing Expenses"
                cum={report.manufacturing_expenses?.totals?.cumulative}
                cur={report.manufacturing_expenses?.totals?.current_month}
                bold
              />

              <SectionRows
                title="Office & Admin Expenses"
                lines={report.admin_expenses?.lines}
                showAccountCodes={showAccountCodes}
              />
              <TotalRow
                label="Total Admin Expenses"
                cum={report.admin_expenses?.totals?.cumulative}
                cur={report.admin_expenses?.totals?.current_month}
                bold
              />

              <SectionRows
                title="Selling & Distribution Expenses"
                lines={report.selling_expenses?.lines}
                showAccountCodes={showAccountCodes}
              />
              <TotalRow
                label="Total Selling Expenses"
                cum={report.selling_expenses?.totals?.cumulative}
                cur={report.selling_expenses?.totals?.current_month}
                bold
              />

              <SectionRows
                title="Financial Expenses"
                lines={report.financial_expenses?.lines}
                showAccountCodes={showAccountCodes}
              />
              <TotalRow
                label="Total Financial Expenses"
                cum={report.financial_expenses?.totals?.cumulative}
                cur={report.financial_expenses?.totals?.current_month}
                bold
              />

              <TotalRow
                label="Total Expenses"
                cum={report.total_expenses?.cumulative}
                cur={report.total_expenses?.current_month}
                accent
              />

              <TotalRow
                label="Operating Net Margin"
                cum={report.operating_net_margin?.cumulative}
                cur={report.operating_net_margin?.current_month}
                accent
              />

              <SectionRows
                title="Other Income"
                lines={report.other_income?.lines}
                showAccountCodes={showAccountCodes}
              />
              <TotalRow
                label="Total Other Income"
                cum={report.other_income?.totals?.cumulative}
                cur={report.other_income?.totals?.current_month}
                bold
              />

              <tr className="bg-blue-900 text-white font-bold">
                <td className="px-3 py-3 text-sm">Total Net Margin</td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {fmtSigned(report.net_margin?.cumulative)}
                </td>
                <td className="px-3 py-3 text-right text-sm tabular-nums">
                  {fmtSigned(report.net_margin?.current_month)}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-gray-600 italic px-1">
        Available conversion margin = Adjusted output less total material consumption.
        {showExtendedSections &&
          " Extended sections show manufacturing, admin, selling, financial costs, and net margin."}
      </p>
    </div>
  );
}
