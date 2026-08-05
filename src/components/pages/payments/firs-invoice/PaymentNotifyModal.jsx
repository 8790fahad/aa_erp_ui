import { useState } from "react";
import { X, Loader, Bell } from "lucide-react";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

const PAYMENT_STATUS_OPTIONS = [
  { value: "PENDING", label: "PENDING" },
  { value: "PAID", label: "PAID" },
  { value: "REJECTED", label: "REJECTED" },
];

export default function PaymentNotifyModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [facilityId, setFacilityId] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("PAID");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!facilityId?.trim() || !invoiceRef?.trim()) {
      toast.error("Facility ID and Invoice Reference are required");
      return;
    }
    setLoading(true);
    _postApi(
      "/api/v1/invoice/payment/notify",
      {
        facilityId: facilityId.trim(),
        invoiceRef: invoiceRef.trim(),
        paymentStatus,
      },
      (res) => {
        setLoading(false);
        if (res?.success) {
          toast.success("Payment notification sent successfully");
          onClose();
        } else {
          toast.error(res?.message || "Failed to send payment notification");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to send payment notification");
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Payment Notification</h2>
                <p className="text-amber-100 text-sm mt-1">
                  Notify AA ERP about invoice payment status (PENDING, PAID, REJECTED)
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Status <span className="text-red-500">*</span>
            </label>
            <select
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              PENDING: awaiting payment. PAID: payment received. REJECTED: payment rejected.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Notify Payment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
