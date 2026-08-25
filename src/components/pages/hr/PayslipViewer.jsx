import React, { useState } from "react";
import PayslipGenerator from "../../common/PayslipGenerator";
import { Button } from "../../ui-elements/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../ui-elements/Card";

const PayslipViewer = () => {
  // Sample payslip data
  const samplePayslipData = {
    employeeName: "John Doe",
    employeeNumber: "EMP001",
    department: "IT Department",
    position: "Software Developer",
    basicSalary: 75000,
    allowances: {
      additionalEarnings: 0,
      incrementArrears: 5000,
      transportAllowance: 20000,
      travelAllowance: 8000,
      inconvenienceAllowance: 5000,
      leaveAllowance: 0,
      medicalAllowance: 5000,
      bonus: 10000,
    },
    deductions: {
      loanDeduction: 15000,
      paye: 12000,
      securityDeposit: 0,
      pension: 6000,
      other: 2000,
    },
    overtime: 15000,
    lateness: 2,
    daysAbsent: 0,
  };

  const companyInfo = {
    companyName: "AA_ERP SYSTEMS LTD.",
    address:
      "Plot No. Sharada Industrial Estate, Phase III\nP.O. Box 2414\nKANO, Nigeria",
  };

  return (
    <div className="container mx-auto p-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Payslip Viewer
        </h1>
        <p className="text-gray-600">
          Click "View Payslip" to see the PDF document
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Employee Payslip</CardTitle>
          <div className="text-sm text-gray-600">
            <strong>Employee:</strong> {samplePayslipData.employeeName} (
            {samplePayslipData.employeeNumber})
            <br />
            <strong>Department:</strong> {samplePayslipData.department}
            <br />
            <strong>Position:</strong> {samplePayslipData.position}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Basic Salary:</strong> ₦
                {samplePayslipData.basicSalary.toLocaleString()}
              </div>
              <div>
                <strong>Overtime:</strong> ₦
                {samplePayslipData.overtime.toLocaleString()}
              </div>
              <div>
                <strong>Transport Allowance:</strong> ₦
                {samplePayslipData.allowances.transportAllowance.toLocaleString()}
              </div>
              <div>
                <strong>Medical Allowance:</strong> ₦
                {samplePayslipData.allowances.medicalAllowance.toLocaleString()}
              </div>
            </div>

            <div className="border-t pt-4">
              <PayslipGenerator
                payslipData={samplePayslipData}
                companyInfo={companyInfo}
                month="December"
                year="2024"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayslipViewer;
