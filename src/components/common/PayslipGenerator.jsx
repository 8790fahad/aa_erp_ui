import React, { useState } from "react";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import PayslipPDF from "./PayslipPDF";
import { Button } from "../ui-elements/Button";
import { toast } from "sonner";

const PayslipGenerator = ({
  payslipData = {},
  companyInfo = {},
  month = "",
  year = "",
  showPreview = false,
  onClose = () => {},
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Default payslip data structure
  const defaultPayslipData = {
    employeeName: "John Doe",
    employeeNumber: "EMP001",
    department: "IT Department",
    position: "Software Developer",
    basicSalary: 50000,
    allowances: {
      additionalEarnings: 0,
      incrementArrears: 0,
      transportAllowance: 15000,
      travelAllowance: 5000,
      inconvenienceAllowance: 3000,
      leaveAllowance: 0,
      medicalAllowance: 3000,
      bonus: 0,
    },
    deductions: {
      loanDeduction: 5000,
      paye: 7500,
      securityDeposit: 0,
      pension: 4000,
      other: 0,
    },
    overtime: 0,
    grossPay: 0,
    netPay: 0,
    lateness: 0,
    daysAbsent: 0,
  };

  // Default company info
  const defaultCompanyInfo = {
    companyName: "[COMPANY NAME LTD.]",
    address:
      "Plot No. Sharada Industrial Estate, Phase III\nP.O. Box 2414\nKANO, Nigeria",
  };

  const mergedPayslipData = { ...defaultPayslipData, ...payslipData };
  const mergedCompanyInfo = { ...defaultCompanyInfo, ...companyInfo };

  const handleDownload = () => {
    setIsGenerating(true);
    toast.success("Payslip generated successfully!");
    setTimeout(() => setIsGenerating(false), 2000);
  };

  const handlePreview = () => {
    setShowPdfPreview(true);
  };

  const handleClosePreview = () => {
    setShowPdfPreview(false);
  };

  if (showPreview) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-semibold">Payslip Preview</h2>
            <Button
              variant="outline"
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800"
            >
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PDFViewer width="100%" height="100%">
              <PayslipPDF
                payslipData={mergedPayslipData}
                companyInfo={mergedCompanyInfo}
                month={month}
                year={year}
              />
            </PDFViewer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <PDFDownloadLink
          document={
            <PayslipPDF
              payslipData={mergedPayslipData}
              companyInfo={mergedCompanyInfo}
              month={month}
              year={year}
            />
          }
          fileName={`payslip-${mergedPayslipData.employeeNumber}-${month}-${year}.pdf`}
          onClick={handleDownload}
        >
          {({ blob, url, loading, error }) => (
            <Button
              disabled={loading || isGenerating}
              className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
            >
              {loading || isGenerating ? "Generating..." : "Download Payslip"}
            </Button>
          )}
        </PDFDownloadLink>

        <Button
          variant="outline"
          onClick={handlePreview}
          className="border-blue-600 text-blue-600 hover:bg-blue-50"
        >
          View Payslip
        </Button>
      </div>

      {isGenerating && (
        <div className="text-sm text-gray-600">
          Generating payslip for {mergedPayslipData.employeeName}...
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">
                Payslip - {mergedPayslipData.employeeName} ({month} {year})
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClosePreview}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Close
                </Button>
                <PDFDownloadLink
                  document={
                    <PayslipPDF
                      payslipData={mergedPayslipData}
                      companyInfo={mergedCompanyInfo}
                      month={month}
                      year={year}
                    />
                  }
                  fileName={`payslip-${mergedPayslipData.employeeNumber}-${month}-${year}.pdf`}
                  onClick={handleDownload}
                >
                  {({ blob, url, loading, error }) => (
                    <Button
                      disabled={loading || isGenerating}
                      className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
                    >
                      {loading || isGenerating ? "Generating..." : "Download"}
                    </Button>
                  )}
                </PDFDownloadLink>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <PDFViewer width="100%" height="100%">
                <PayslipPDF
                  payslipData={mergedPayslipData}
                  companyInfo={mergedCompanyInfo}
                  month={month}
                  year={year}
                />
              </PDFViewer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayslipGenerator;
