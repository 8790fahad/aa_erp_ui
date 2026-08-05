import { useState } from "react";
import { FileText, Search, Bell } from "lucide-react";
import CreateInvoiceModal from "./CreateInvoiceModal";
import LookupInvoiceStatusModal from "./LookupInvoiceStatusModal";
import PaymentNotifyModal from "./PaymentNotifyModal";

export default function FIRSInvoicePage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [lookupModalOpen, setLookupModalOpen] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);

  const cards = [
    {
      title: "Create Invoice",
      description:
        "Send invoices to FIRS via AA ERP. Complies with the FIRS e-Invoicing mandate. Response includes FIRS Verifiable QR Code for payers to verify invoices.",
      icon: FileText,
      color: "from-blue-600 to-indigo-600",
      onClick: () => setCreateModalOpen(true),
    },
    {
      title: "Lookup Invoice Status",
      description:
        "Retrieve invoice status from AA ERP: issue date, due date, payment status, and FIRS transmission details.",
      icon: Search,
      color: "from-emerald-600 to-teal-600",
      onClick: () => setLookupModalOpen(true),
    },
    {
      title: "Payment Notification",
      description:
        "Notify AA ERP about payment status (PENDING, PAID, REJECTED) for an invoice processed through the gateway.",
      icon: Bell,
      color: "from-amber-600 to-orange-600",
      onClick: () => setNotifyModalOpen(true),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AA ERP Invoice APIs</h1>
        <p className="text-gray-600 mt-1">
          AA ERP Connect Gateway – Federal Inland Revenue Service (FIRS) e-Invoicing compliance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              onClick={card.onClick}
              className="text-left p-6 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all bg-white"
            >
              <div
                className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${card.color} mb-4`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {card.title}
              </h2>
              <p className="text-sm text-gray-600">{card.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p>
          <strong>Base URL:</strong>{" "}
          <code className="bg-gray-200 px-1 rounded">
            https://api-demo.systemspecsng.com/services/connect-gateway
          </code>
        </p>
        <p className="mt-2">
          API documentation is available in Swagger at{" "}
          <code className="bg-gray-200 px-1 rounded">/api-docs</code> under the{" "}
          <strong>AA ERP Invoice</strong> tag.
        </p>
      </div>

      <CreateInvoiceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
      <LookupInvoiceStatusModal
        isOpen={lookupModalOpen}
        onClose={() => setLookupModalOpen(false)}
      />
      <PaymentNotifyModal
        isOpen={notifyModalOpen}
        onClose={() => setNotifyModalOpen(false)}
      />
    </div>
  );
}
