import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import CreditSaleInvoicePDF from './CreditSaleInvoicePDF';

const DualPDFViewer = ({ invoiceData, business, customer, date, isCustomerCopy, customPricing, customPrices, customerCopyEnabled, customerCopyPrices, onBack, onPrint, onComplete }) => {
  const [originalPdfUrl, setOriginalPdfUrl] = useState(null);
  const [customerCopyPdfUrl, setCustomerCopyPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const generatePDFs = async () => {
      try {
        setLoading(true);
        
        // Generate original PDF
        const originalPdf = await pdf(
          CreditSaleInvoicePDF({ 
            invoiceData: { ...invoiceData, isCustomerCopy: false, customPricing, customPrices }, 
            business, 
            customer, 
            date 
          })
        );
        const originalBlob = await originalPdf.toBlob();
        const originalUrl = URL.createObjectURL(originalBlob);
        setOriginalPdfUrl(originalUrl);

        // Generate customer copy PDF only if customer copy is enabled
        let customerCopyPdf = null;
        if (customerCopyEnabled) {
          customerCopyPdf = await pdf(
            CreditSaleInvoicePDF({ 
              invoiceData: { ...invoiceData, isCustomerCopy: true, customPricing, customPrices, customerCopyPrices }, 
              business, 
              customer, 
              date 
            })
          );
        }
        if (customerCopyPdf) {
          const customerCopyBlob = await customerCopyPdf.toBlob();
          const customerCopyUrl = URL.createObjectURL(customerCopyBlob);
          setCustomerCopyPdfUrl(customerCopyUrl);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error generating PDFs:', error);
        setLoading(false);
      }
    };

    generatePDFs();

    // Cleanup URLs on unmount
    return () => {
      if (originalPdfUrl) URL.revokeObjectURL(originalPdfUrl);
      if (customerCopyPdfUrl) URL.revokeObjectURL(customerCopyPdfUrl);
    };
  }, [invoiceData, business, customer, date, customPricing, customPrices, customerCopyEnabled, customerCopyPrices]);

  const handlePrint = () => {
    if (originalPdfUrl) {
      const printWindow = window.open(originalPdfUrl);
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Generating PDFs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Invoice Preview</h2>
            <p className="text-gray-600">
              {isCustomerCopy ? 'Customer Copy (White Copy) - Different Unit Prices' : 'Original Invoice'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to Preview
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Print PDF
            </button>
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Complete Sale
            </button>
          </div>
        </div>
      </div>

      {/* PDF Container */}
      <div className={`grid grid-cols-1 ${customerCopyEnabled ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-4`}>
        {/* Original Invoice */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="bg-blue-600 text-white p-3">
            <h3 className="text-lg font-semibold">Original Invoice</h3>
            <p className="text-blue-100 text-sm">Full pricing details</p>
          </div>
          <div className="p-4">
            {originalPdfUrl ? (
              <iframe
                src={originalPdfUrl}
                className="w-full h-96 border-0"
                title="Original Invoice"
              />
            ) : (
              <div className="h-96 flex items-center justify-center text-gray-500">
                PDF not available
              </div>
            )}
          </div>
        </div>

        {/* Customer Copy - Only show if enabled */}
        {customerCopyEnabled && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="bg-green-600 text-white p-3">
              <h3 className="text-lg font-semibold">Customer Copy (White Copy)</h3>
              <p className="text-green-100 text-sm">Different unit prices</p>
            </div>
            <div className="p-4">
              {customerCopyPdfUrl ? (
                <iframe
                  src={customerCopyPdfUrl}
                  className="w-full h-96 border-0"
                  title="Customer Copy Invoice"
                />
              ) : (
                <div className="h-96 flex items-center justify-center text-gray-500">
                  PDF not available
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Instructions */}
      <div className="lg:hidden mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-yellow-600 mr-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-yellow-800 font-medium">Mobile View</p>
            <p className="text-xs text-yellow-700">Scroll down to see both invoices. On larger screens, they will be displayed side by side.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DualPDFViewer;