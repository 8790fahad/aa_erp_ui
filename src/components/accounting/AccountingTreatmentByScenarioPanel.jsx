/**
 * Shared collapsible: credit/debit note journal logic + optional “how this shows in reports”.
 * Used by Credit Note flow and financial reports (Statement of FP, General Ledger).
 */
export default function AccountingTreatmentByScenarioPanel({
  showReportContext = false,
  className = "",
}) {
  return (
    <details
      className={`rounded-lg border border-slate-200/90 bg-white/70 p-3 text-sm open:shadow-sm ${className}`}
    >
      <summary className="cursor-pointer font-semibold text-slate-800 outline-none">
        Accounting treatment (by scenario)
      </summary>
      <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-700">
        <div>
          <p className="font-semibold text-slate-900">1. Customer returns goods</p>
          <p className="mt-1">
            Goods returned → reduce revenue and restore inventory (if tracked).
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-600">
            Dr Sales Returns (or Sales Returns &amp; Allowances) · Cr A/R or Cash
            <br />
            Inventory: Dr Inventory · Cr COGS
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">2. Overcharged customer</p>
          <p className="mt-1 font-mono text-[11px] text-slate-600">
            Dr Sales Revenue (or Sales Adjustment) · Cr A/R or Cash
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">3. Pricing error</p>
          <p className="mt-1">Same pattern as overcharge (different reason).</p>
          <p className="mt-1 font-mono text-[11px] text-slate-600">
            Dr Sales Revenue Adjustment · Cr A/R or Cash
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">4. Damaged or defective goods</p>
          <p className="mt-1">
            If returned: Dr Sales Returns · Cr A/R. If not resellable: Dr Loss /
            Damaged Goods · Cr Inventory.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">5. Post-sale discount / rebate</p>
          <p className="mt-1 font-mono text-[11px] text-slate-600">
            Dr Discount Allowed (expense) · Cr A/R or Cash
          </p>
        </div>
        <p className="text-slate-500 border-t border-slate-200 pt-2">
          Supplier debit notes follow the same logic with Purchase Returns / A/P instead
          of Sales / A/R.
        </p>

        {showReportContext && (
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <p className="font-semibold text-slate-900">How this appears in reports</p>
            <p>
              <span className="font-medium text-slate-800">Statement of Financial Position:</span>{" "}
              The <strong>Note</strong> column is your GL account code. Balances roll up all
              postings—including credit/debit notes—through the period end you select.
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>
                <strong>Accounts receivable</strong> moves with customer credit notes
                (returns, overcharge/pricing fixes, discounts, refunds to A/R).
              </li>
              <li>
                <strong>Inventory</strong> (raw materials, WIP, finished goods) moves when
                returns restock stock or damaged goods are written off.
              </li>
              <li>
                <strong>Accounts payable</strong> moves with supplier-side debit/credit
                notes the same way, mirrored against purchase returns and A/P.
              </li>
            </ul>
            <p>
              <span className="font-medium text-slate-800">General Ledger:</span> Expand a
              head (e.g. cash, receivables), then an account, to see transactions. Lines
              posted from AA ERP may include scenario and method detail in the memo.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}
