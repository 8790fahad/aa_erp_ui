import { useState } from "react";
import { X, Loader, Search } from "lucide-react";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

export default function LookupInvoiceStatusModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!facilityId?.trim() || !invoiceRef?.trim()) {
      toast.error("Facility ID and Invoice Reference are required");
      return;
    }
    setLoading(true);
    setResult(null);
    _postApi(
      "/api/v1/invoice/status",
      { facilityId: facilityId.trim(), invoiceRef: invoiceRef.trim() },
      (res) => {
        setLoading(false);
        if (res?.success) {
          setResult(res.data);
          toast.success("Invoice status retrieved");
        } else {
          toast.error(res?.message || "Failed to lookup invoice status");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to lookup invoice status");
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Search className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Lookup Invoice Status</h2>
                <p className="text-emerald-100 text-sm mt-1">
                  Retrieve invoice status from Alh. Ashiru Yanmusa (issue date, due date, payment status, FIRS transmission)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facility ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Unique identifier for the facility"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Invoice reference number"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
            />
          </div>

          {result && (
            <div className="p-4 bg-gray-50 rounded-lg border text-sm space-y-2">
              <h4 className="font-semibold text-gray-800">Invoice Status</h4>
              <div className="grid grid-cols-2 gap-1">
                {result.issue_date && (
                  <span className="text-gray-600">Issue Date:</span>
                )}
                {result.issue_date && <span>{result.issue_date}</span>}
                {result.due_date && (
                  <span className="text-gray-600">Due Date:</span>
                )}
                {result.due_date && <span>{result.due_date}</span>}
                {result.payment_status && (
                  <span className="text-gray-600">Payment Status:</span>
                )}
                {result.payment_status && (
                  <span className="font-medium">{result.payment_status}</span>
                )}
                {typeof result.transmitted !== "undefined" && (
                  <span className="text-gray-600">Transmitted:</span>
                )}
                {typeof result.transmitted !== "undefined" && (
                  <span>{result.transmitted ? "Yes" : "No"}</span>
                )}
                {typeof result.delivered !== "undefined" && (
                  <span className="text-gray-600">Delivered:</span>
                )}
                {typeof result.delivered !== "undefined" && (
                  <span>{result.delivered ? "Yes" : "No"}</span>
                )}
              </div>
              {Object.keys(result).length > 0 && (
                <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-32">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Looking up...
                </>
              ) : (
                "Lookup"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
