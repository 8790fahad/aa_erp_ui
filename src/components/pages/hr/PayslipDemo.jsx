import React, { useState } from "react";
import PayslipGenerator from "../../common/PayslipGenerator";
import { Button } from "../../ui-elements/Button";
import { Input } from "../../ui-elements/Input";
import { Label } from "../../ui-elements/Label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../ui-elements/Card";

const PayslipDemo = () => {
  const [showPreview, setShowPreview] = useState(false);
  const [payslipData, setPayslipData] = useState({
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
    lateness: 0,
    daysAbsent: 0,
  });

  const [companyInfo, setCompanyInfo] = useState({
    companyName: "AA_ERP SYSTEMS LTD.",
    address:
      "Plot No. Sharada Industrial Estate, Phase III\nP.O. Box 2414\nKANO, Nigeria",
  });

  const [month, setMonth] = useState("December");
  const [year, setYear] = useState("2024");

  const handleInputChange = (field, value) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setPayslipData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: parseFloat(value) || 0,
        },
      }));
    } else {
      setPayslipData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleCompanyChange = (field, value) => {
    setCompanyInfo((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Payslip Generator Demo
        </h1>
        <p className="text-gray-600">
          Generate professional payslips using React PDF
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Information */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeName">Employee Name</Label>
                <Input
                  id="employeeName"
                  value={payslipData.employeeName}
                  onChange={(e) =>
                    handleInputChange("employeeName", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="employeeNumber">Employee Number</Label>
                <Input
                  id="employeeNumber"
                  value={payslipData.employeeNumber}
                  onChange={(e) =>
                    handleInputChange("employeeNumber", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={payslipData.department}
                  onChange={(e) =>
                    handleInputChange("department", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={payslipData.position}
                  onChange={(e) =>
                    handleInputChange("position", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="basicSalary">Basic Salary (₦)</Label>
                <Input
                  id="basicSalary"
                  type="number"
                  value={payslipData.basicSalary}
                  onChange={(e) =>
                    handleInputChange("basicSalary", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="overtime">Overtime (₦)</Label>
                <Input
                  id="overtime"
                  type="number"
                  value={payslipData.overtime}
                  onChange={(e) =>
                    handleInputChange("overtime", e.target.value)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyInfo.companyName}
                onChange={(e) =>
                  handleCompanyChange("companyName", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                className="w-full p-2 border border-gray-300 rounded-md"
                rows={3}
                value={companyInfo.address}
                onChange={(e) => handleCompanyChange("address", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="month">Month</Label>
                <Input
                  id="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Allowances */}
        <Card>
          <CardHeader>
            <CardTitle>Allowances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="transportAllowance">
                  Transport Allowance (₦)
                </Label>
                <Input
                  id="transportAllowance"
                  type="number"
                  value={payslipData.allowances.transportAllowance}
                  onChange={(e) =>
                    handleInputChange(
                      "allowances.transportAllowance",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="travelAllowance">Travel Allowance (₦)</Label>
                <Input
                  id="travelAllowance"
                  type="number"
                  value={payslipData.allowances.travelAllowance}
                  onChange={(e) =>
                    handleInputChange(
                      "allowances.travelAllowance",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="medicalAllowance">Medical Allowance (₦)</Label>
                <Input
                  id="medicalAllowance"
                  type="number"
                  value={payslipData.allowances.medicalAllowance}
                  onChange={(e) =>
                    handleInputChange(
                      "allowances.medicalAllowance",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="inconvenienceAllowance">
                  Inconvenience Allowance (₦)
                </Label>
                <Input
                  id="inconvenienceAllowance"
                  type="number"
                  value={payslipData.allowances.inconvenienceAllowance}
                  onChange={(e) =>
                    handleInputChange(
                      "allowances.inconvenienceAllowance",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deductions */}
        <Card>
          <CardHeader>
            <CardTitle>Deductions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paye">PAYE (₦)</Label>
                <Input
                  id="paye"
                  type="number"
                  value={payslipData.deductions.paye}
                  onChange={(e) =>
                    handleInputChange("deductions.paye", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="pension">Pension (₦)</Label>
                <Input
                  id="pension"
                  type="number"
                  value={payslipData.deductions.pension}
                  onChange={(e) =>
                    handleInputChange("deductions.pension", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="loanDeduction">Loan Deduction (₦)</Label>
                <Input
                  id="loanDeduction"
                  type="number"
                  value={payslipData.deductions.loanDeduction}
                  onChange={(e) =>
                    handleInputChange(
                      "deductions.loanDeduction",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="otherDeductions">Other Deductions (₦)</Label>
                <Input
                  id="otherDeductions"
                  type="number"
                  value={payslipData.deductions.other}
                  onChange={(e) =>
                    handleInputChange("deductions.other", e.target.value)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslip Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Payslip</CardTitle>
        </CardHeader>
        <CardContent>
          <PayslipGenerator
            payslipData={payslipData}
            companyInfo={companyInfo}
            month={month}
            year={year}
            showPreview={showPreview}
            onClose={() => setShowPreview(false)}
          />
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="mr-2"
            >
              View Payslip
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {showPreview && (
        <PayslipGenerator
          payslipData={payslipData}
          companyInfo={companyInfo}
          month={month}
          year={year}
          showPreview={true}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default PayslipDemo;
