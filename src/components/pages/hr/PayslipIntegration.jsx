import React, { useState, useEffect } from "react";
import PayslipGenerator from "../../common/PayslipGenerator";
import { Button } from "../../ui-elements/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../ui-elements/Card";
import { _fetchApi } from "../../utils/api";

const PayslipIntegration = ({ employeeId, month, year, facilityId }) => {
  const [payslipData, setPayslipData] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch payslip data from your existing payroll API
  const fetchPayslipData = async () => {
    if (!employeeId || !month || !year || !facilityId) return;

    setLoading(true);
    setError("");

    try {
      // Fetch payroll data for the specific employee and month
      const response = await _fetchApi(
        `/api/hr/payroll/payslip/${employeeId}?month=${month}&year=${year}&facilityId=${facilityId}`
      );

      if (response.success) {
        const payroll = response.data;

        // Transform your payroll data to match the payslip format
        const transformedData = {
          employeeName: payroll.employee?.name || "N/A",
          employeeNumber: payroll.employee?.employeeNumber || "N/A",
          department: payroll.employee?.department || "N/A",
          position: payroll.employee?.position || "N/A",
          basicSalary: payroll.basicSalary || 0,
          allowances: {
            additionalEarnings: payroll.additionalEarnings || 0,
            incrementArrears: payroll.incrementArrears || 0,
            transportAllowance: payroll.transportAllowance || 0,
            travelAllowance: payroll.travelAllowance || 0,
            inconvenienceAllowance: payroll.inconvenienceAllowance || 0,
            leaveAllowance: payroll.leaveAllowance || 0,
            medicalAllowance: payroll.medicalAllowance || 0,
            bonus: payroll.bonus || 0,
          },
          deductions: {
            loanDeduction: payroll.loanRepayment || 0,
            paye: payroll.paye || 0,
            securityDeposit: payroll.securityDeposit || 0,
            pension: payroll.pension || 0,
            other: payroll.otherDeductions || 0,
          },
          overtime: payroll.overtime || 0,
          grossPay: payroll.grossPay || 0,
          netPay: payroll.netPay || 0,
          lateness: payroll.lateness || 0,
          daysAbsent: payroll.daysAbsent || 0,
        };

        setPayslipData(transformedData);
      } else {
        setError(response.message || "Failed to fetch payslip data");
      }
    } catch (err) {
      console.error("Error fetching payslip data:", err);
      setError("Error fetching payslip data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch company information
  const fetchCompanyInfo = async () => {
    try {
      // You can fetch this from your settings/company API
      const response = await _fetchApi(`/api/settings/company/${facilityId}`);

      if (response.success) {
        setCompanyInfo({
          companyName: response.data.companyName || "COMPANY NAME LTD.",
          address: response.data.address || "Company Address",
        });
      } else {
        // Use default company info if API fails
        setCompanyInfo({
          companyName: "COMPANY NAME LTD.",
          address: "Company Address",
        });
      }
    } catch (err) {
      console.error("Error fetching company info:", err);
      // Use default company info
      setCompanyInfo({
        companyName: "COMPANY NAME LTD.",
        address: "Company Address",
      });
    }
  };

  useEffect(() => {
    fetchPayslipData();
    fetchCompanyInfo();
  }, [employeeId, month, year, facilityId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-600">Loading payslip data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Button onClick={fetchPayslipData} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!payslipData || !companyInfo) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-600">No payslip data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Payslip - {payslipData.employeeName}</CardTitle>
        <div className="text-sm text-gray-600">
          {month} {year} • Employee ID: {payslipData.employeeNumber}
        </div>
      </CardHeader>
      <CardContent>
        <PayslipGenerator
          payslipData={payslipData}
          companyInfo={companyInfo}
          month={month}
          year={year}
        />
      </CardContent>
    </Card>
  );
};

export default PayslipIntegration;
