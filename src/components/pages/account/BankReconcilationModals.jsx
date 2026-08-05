import { Separator } from "@/components/ui/separator";
import { ArrowDownToLine } from "lucide-react";

const BankCard = () => {
  return (
    <div className="max-w-lg mx-auto border rounded-md py-4 space-y-4">
      <h2 className="text-center font-semibold text-gray-700">
        Bank Reconciliation
      </h2>
      <Separator />
      <div className="border rounded-md p-2 mx-4">
        <div className="font-medium text-gray-800 border-b pb-2">
          GTBank - 0012345678
        </div>

        <div className="divide-y mt-2">
          <div className="py-2 text-gray-700">Current</div>
          <div className="py-2 text-gray-700">Savings</div>
        </div>
      </div>
      <Separator />
      <button className="w-full border border-0 rounded-md py-0.5 text-center text-sm text-gray-600 hover:bg-gray-100">
        + Add New Bank
      </button>
    </div>
  );
};

const StatementUploader = () => {
  return (
    <div className="max-w-sm mx-auto border rounded-md shadow-sm p-4 space-y-4">
      <h2 className="text-center font-semibold text-gray-700">
        Upload or Sync statement
      </h2>

      {/* Upload Buttons */}
      <div className="isolate rounded-md shadow-xs">
        <button
          type="button"
          className="relative inline-flex items-center rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:z-10"
        >
          Upload PDF/CSV
        </button>
        <button
          type="button"
          className="relative -ml-px inline-flex items-center rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:z-10"
        >
          Sync via API
        </button>
      </div>

      {/* Filter Button */}
      <button className="text-sm text-gray-600 hover:text-gray-800 border px-2.5 rounded-md">
        + Filter
      </button>

      {/* Drag-and-Drop Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center text-gray-500">
        <ArrowDownToLine className="text-5xl mx-auto" />
        <p>Drag and drop file</p>
        <p className="text-xs text-gray-400">.pdf, .csv</p>
      </div>

      {/* Import Button */}
      <button className="w-full border rounded-md py-2 text-sm text-gray-700 hover:bg-gray-100">
        Import Transactions
      </button>
    </div>
  );
};

const TransactionsCard = () => {
  return (
    <div className="max-w-sm mx-auto border rounded-md shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <input type="checkbox" />
        <h2 className="text-sm font-semibold text-gray-700">Transactions</h2>
      </div>

      {/* Controls */}
      <div className="flex justify-between">
        <button className="border rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
          Save R
        </button>
        <button className="border rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
          Filter C
        </button>
        <span className="text-sm text-gray-700 font-medium">
          Bank Transactions
        </span>
      </div>

      {/* Table */}
      <div className="space-y-4 text-sm text-gray-700">
        {/* First section */}
        <div>
          <div className="flex justify-between font-semibold border-b pb-1">
            <span>Date</span>
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>22 Jan</span>
            <span>Amount</span>
            <span>$1.30</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>31 Jan</span>
            <span>Unmatched</span>
            <span>Amu</span>
          </div>
        </div>

        {/* Second section */}
        <div>
          <div className="font-medium pb-1">Bank Transactions</div>
          <div className="flex justify-between pt-1">
            <span>21 Jan</span>
            <span>Amount</span>
            <span>$1.30</span>
          </div>
          <div className="flex justify-between pt-1">
            <span>31 Jan</span>
            <span>Unmatched</span>
            <span>$1.43</span>
          </div>
        </div>
      </div>

      {/* Pagination */}
      <button className="w-full border rounded-md py-1 text-sm text-gray-600 hover:bg-gray-100">
        Next
      </button>
    </div>
  );
};

const ReconciliationCard = () => {
  return (
    <div className="max-w-sm mx-auto border rounded-md py-4 space-y-4">
      {/* Header */}
      <h2 className="text-center font-semibold text-gray-700">
        Reconciliation complete
      </h2>
      <Separator />

      {/* Summary Buttons */}
      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 p-2 mx-4">
        <button className="border rounded-md p-4">Total Transactions</button>
        <button className="border rounded-md p-4">Auto-matched</button>
        <button className="border rounded-md p-4">Manually Matched</button>
        <button className="border rounded-md p-4">Unmatched</button>
      </div>

      <Separator />

      {/* Matched Transaction Row 1 */}
      <div className="border rounded-md divide-y mt-2 mx-4">
        <div className="flex items-center justify-between text-sm text-gray-700 py-2 px-3">
          <span>21 Jan</span>
          <span>$1.04</span>
          <span className="text-xl">—</span>
        </div>

        {/* Matched Transaction Row 2 */}
        <div className="flex items-center justify-between text-sm text-gray-700 py-2 px-3">
          <span>21 Jan</span>
          <span>$1.04</span>
          <span className="text-xl">→</span>
          <span>$1.04</span>
        </div>
      </div>

      {/* Confirm Match Button */}
      <div className="p-2 mx-4">
        <button className="w-full border rounded-md py-2 text-sm text-gray-700 hover:bg-gray-100">
          Confirm Match
        </button>
      </div>

      <Separator />

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        Start New Reconciliation
      </div>
    </div>
  );
};

const BankReconcilationModals = () => {
  return (
    <div className="grid grid-cols-2 gap-3 items-center justify-center min-h-screen bg-gray-50">
      <BankCard />
      <StatementUploader />
      <TransactionsCard />
      <ReconciliationCard />
    </div>
  );
};

export default BankReconcilationModals;
