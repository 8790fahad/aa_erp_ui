import { useState } from "react";
import { X, Loader, FileText } from "lucide-react";
import { _postApi } from "@/redux/actions/api";
import { toast } from "sonner";

export default function CreateInvoiceModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoiceRef: "",
    facilityId: "",
    currency: "NGN",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    status: "issued",
    orderReference: "",
    customer: {
      customerId: "",
      name: "",
      email: "",
      phone: "",
      identifiers: { tin: "" },
      address: {
        line: "",
        city: "",
        country: "NG",
        postalZone: "",
      },
    },
    lineItems: [
      {
        name: "",
        description: "",
        sellersItemIdentification: "",
        hsnCode: "",
        productCategory: "",
        unitPrice: 0,
        discountRate: 0,
        discountAmount: 0,
        feeRate: 0,
        feeAmount: 0,
        quantity: 1,
        totalAmount: 0,
        taxCode: "STANDARD_VAT",
        taxRate: 7.5,
        taxAmount: 0,
      },
    ],
    totals: {
      totalLineAmount: 0,
      totalTax: 0,
      grandTotal: 0,
    },
    type: "Both B2B/B2G and B2C",
  });

  const updateNested = (path, value) => {
    setFormData((prev) => {
      const next = { ...prev };
      const keys = path.split(".");
      let ptr = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        ptr[k] = { ...ptr[k] };
        ptr = ptr[k];
      }
      ptr[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          name: "",
          description: "",
          sellersItemIdentification: "",
          hsnCode: "",
          productCategory: "",
          unitPrice: 0,
          discountRate: 0,
          discountAmount: 0,
          feeRate: 0,
          feeAmount: 0,
          quantity: 1,
          totalAmount: 0,
          taxCode: "STANDARD_VAT",
          taxRate: 7.5,
          taxAmount: 0,
        },
      ],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    _postApi(
      "/api/v1/invoice/create",
      formData,
      (res) => {
        setLoading(false);
        if (res?.success) {
          toast.success("Invoice created and submitted to FIRS successfully");
          onClose();
        } else {
          toast.error(res?.message || "Failed to create invoice");
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to create invoice");
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Create Invoice (FIRS)</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Submit NRS-compliant invoice (FIRS e-Invoicing)
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g. INV-2024-001"
                  value={formData.invoiceRef}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, invoiceRef: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facility ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.facilityId}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, facilityId: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, issueDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, dueDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Reference
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="PO number"
                  value={formData.orderReference}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      orderReference: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, type: e.target.value }))
                  }
                >
                  <option value="B2B">B2B</option>
                  <option value="B2G">B2G</option>
                  <option value="B2C">B2C</option>
                  <option value="B2B/B2G">B2B/B2G</option>
                  <option value="Both B2B/B2G and B2C">Both B2B/B2G and B2C</option>
                </select>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Customer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.customerId}
                    onChange={(e) =>
                      updateNested("customer.customerId", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.name}
                    onChange={(e) =>
                      updateNested("customer.name", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.email}
                    onChange={(e) =>
                      updateNested("customer.email", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.phone}
                    onChange={(e) =>
                      updateNested("customer.phone", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TIN
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.identifiers.tin}
                    onChange={(e) =>
                      updateNested("customer.identifiers.tin", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.address.line}
                    onChange={(e) =>
                      updateNested("customer.address.line", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.address.city}
                    onChange={(e) =>
                      updateNested("customer.address.city", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.address.country}
                    onChange={(e) =>
                      updateNested("customer.address.country", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Zone
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.customer.address.postalZone}
                    onChange={(e) =>
                      updateNested("customer.address.postalZone", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-800">Line Items</h3>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Item
                </button>
              </div>
              {formData.lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 mb-2 bg-gray-50 rounded border"
                >
                  <input
                    placeholder="Name *"
                    required
                    className="col-span-2 px-2 py-1.5 border rounded text-sm"
                    value={item.name}
                    onChange={(e) => {
                      const next = [...formData.lineItems];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setFormData((p) => ({ ...p, lineItems: next }));
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Unit Price"
                    className="px-2 py-1.5 border rounded text-sm"
                    value={item.unitPrice || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      const next = [...formData.lineItems];
                      next[idx] = {
                        ...next[idx],
                        unitPrice: v,
                        totalAmount: v * (next[idx].quantity || 1),
                        taxAmount:
                          v *
                          (next[idx].quantity || 1) *
                          ((next[idx].taxRate || 0) / 100),
                      };
                      setFormData((p) => ({ ...p, lineItems: next }));
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    min="1"
                    className="px-2 py-1.5 border rounded text-sm"
                    value={item.quantity || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10) || 1;
                      const next = [...formData.lineItems];
                      next[idx] = {
                        ...next[idx],
                        quantity: v,
                        totalAmount: (next[idx].unitPrice || 0) * v,
                        taxAmount:
                          (next[idx].unitPrice || 0) *
                          v *
                          ((next[idx].taxRate || 0) / 100),
                      };
                      setFormData((p) => ({ ...p, lineItems: next }));
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Tax Rate %"
                    className="px-2 py-1.5 border rounded text-sm"
                    value={item.taxRate ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      const next = [...formData.lineItems];
                      next[idx] = {
                        ...next[idx],
                        taxRate: v,
                        taxAmount:
                          (next[idx].totalAmount || 0) * (v / 100),
                      };
                      setFormData((p) => ({ ...p, lineItems: next }));
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Total Amount"
                    className="col-span-2 px-2 py-1.5 border rounded text-sm"
                    value={item.totalAmount || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      const next = [...formData.lineItems];
                      next[idx] = { ...next[idx], totalAmount: v };
                      setFormData((p) => ({ ...p, lineItems: next }));
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Tax Amount"
                    className="col-span-2 px-2 py-1.5 border rounded text-sm"
                    value={item.taxAmount || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      const next = [...formData.lineItems];
                      next[idx] = { ...next[idx], taxAmount: v };
                      setFormData((p) => ({ ...p, lineItems: next }));
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Line Amount
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.totals.totalLineAmount}
                  onChange={(e) =>
                    updateNested(
                      "totals.totalLineAmount",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Tax
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.totals.totalTax}
                  onChange={(e) =>
                    updateNested(
                      "totals.totalTax",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grand Total
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formData.totals.grandTotal}
                  onChange={(e) =>
                    updateNested(
                      "totals.grandTotal",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
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
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Create Invoice"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
