import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register fonts (you can add custom fonts here)
Font.register({
  family: "Arial",
  src: "https://fonts.gstatic.com/s/arial/v12/7aH9VhFvjvPpCvhFz5v7nA.ttf",
});

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#f8f9fa",
    padding: 20,
    fontFamily: "Arial",
    fontSize: 10,
    lineHeight: 1.2,
    color: "#333",
  },
  payslip: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 6,
    border: "1px solid #ddd",
    minHeight: "100%",
  },
  header: {
    textAlign: "center",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: "2px solid #2c5aa0",
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c5aa0",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  address: {
    fontSize: 11,
    color: "#666",
    lineHeight: 1.3,
  },
  paySlipTitle: {
    backgroundColor: "#2c5aa0",
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    padding: 8,
    margin: "12px 0",
    borderRadius: 4,
  },
  monthSection: {
    backgroundColor: "#f8f9fc",
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
    borderLeft: "3px solid #2c5aa0",
  },
  monthField: {
    fontSize: 13,
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2c5aa0",
    margin: "10px 0 6px 0",
    paddingBottom: 4,
    borderBottom: "1px solid #2c5aa0",
  },
  table: {
    width: "100%",
    marginBottom: 12,
    backgroundColor: "white",
    fontSize: 11,
  },
  infoTable: {
    border: "1px solid #ddd",
  },
  infoTableHeader: {
    backgroundColor: "#f1f3f4",
    color: "#333",
    fontWeight: 600,
    padding: 6,
    textAlign: "left",
    border: "1px solid #ddd",
    width: "30%",
  },
  infoTableCell: {
    padding: 6,
    border: "1px solid #ddd",
    minHeight: 12,
  },
  earningsTable: {
    border: "1px solid #2c5aa0",
    borderRadius: 4,
  },
  earningsHeader: {
    backgroundColor: "#2c5aa0",
    color: "white",
    fontWeight: 600,
    padding: 8,
    textAlign: "left",
  },
  deductionsTable: {
    border: "1px solid #2c5aa0",
    borderRadius: 4,
  },
  deductionsHeader: {
    backgroundColor: "#d32f2f",
    color: "white",
    fontWeight: 600,
    padding: 8,
    textAlign: "left",
  },
  tableCell: {
    padding: "5px 8px",
    borderBottom: "1px solid #eee",
  },
  amountCol: {
    textAlign: "right",
    fontWeight: 500,
    width: 100,
  },
  totalRow: {
    backgroundColor: "#e3f2fd",
    fontWeight: "bold",
    borderTop: "1px solid #2c5aa0",
  },
  grossPayRow: {
    backgroundColor: "#c8e6c9",
    fontWeight: "bold",
    fontSize: 12,
  },
  netPaySection: {
    backgroundColor: "#388e3c",
    color: "white",
    padding: 8,
    borderRadius: 4,
    margin: "10px 0",
    textAlign: "center",
  },
  netPayAmount: {
    fontSize: 16,
    fontWeight: "bold",
    margin: "4px 0",
  },
  authorizationContainer: {
    flexDirection: "row",
    gap: 15,
    marginTop: 15,
    justifyContent: "space-between",
  },
  authBox: {
    flex: 1,
    backgroundColor: "#f8f9ff",
    border: "2px solid #2c5aa0",
    borderRadius: 8,
    padding: 15,
    textAlign: "center",
  },
  authHeader: {
    fontSize: 11,
    color: "#666",
    fontWeight: 600,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  authName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2c5aa0",
    marginBottom: 4,
  },
  authRole: {
    fontSize: 12,
    color: "#666",
    marginBottom: 12,
  },
  authDivider: {
    height: 1,
    backgroundColor: "#ddd",
    margin: "8px 0",
  },
  authDate: {
    fontSize: 11,
    color: "#666",
    fontWeight: 500,
  },
  footer: {
    textAlign: "center",
    marginTop: 15,
    fontSize: 9,
    color: "#999",
    lineHeight: 1.4,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #eee",
  },
  col: {
    flex: 1,
    padding: 6,
  },
  colRight: {
    flex: 1,
    padding: 6,
    textAlign: "right",
  },
});

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Payslip PDF Component
const PayslipPDF = ({
  payslipData = {},
  companyInfo = {},
  month = "",
  year = "",
}) => {
  const {
    employeeName = "",
    employeeNumber = "",
    department = "",
    position = "",
    basicSalary = 0,
    allowances = {},
    deductions = {},
    overtime = 0,
    grossPay = 0,
    netPay = 0,
    lateness = 0,
    daysAbsent = 0,
  } = payslipData;

  const {
    companyName = "[COMPANY NAME LTD.]",
    address = "Plot No. Sharada Industrial Estate, Phase III\nP.O. Box 2414\nKANO, Nigeria",
  } = companyInfo;

  // Calculate totals
  const totalAllowances = Object.values(allowances).reduce(
    (sum, amount) => sum + (amount || 0),
    0
  );
  const totalDeductions = Object.values(deductions).reduce(
    (sum, amount) => sum + (amount || 0),
    0
  );
  const calculatedGrossPay = basicSalary + totalAllowances + overtime;
  const calculatedNetPay = calculatedGrossPay - totalDeductions;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.payslip}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.companyName}>{companyName}</Text>
            <Text style={styles.address}>{address}</Text>
          </View>

          {/* Month Section */}
          <View style={styles.monthSection}>
            <Text style={styles.monthField}>
              <Text style={{ fontWeight: "bold" }}>MONTH:</Text> {month} {year}
            </Text>
          </View>

          <Text style={styles.paySlipTitle}>EMPLOYEE PAY SLIP</Text>

          {/* Employee Information Table */}
          <Text style={styles.sectionTitle}>Employee Information</Text>
          <View style={[styles.table, styles.infoTable]}>
            <View style={styles.row}>
              <Text style={[styles.col, styles.infoTableHeader]}>
                Employee Name
              </Text>
              <Text style={[styles.col, styles.infoTableCell]}>
                {employeeName}
              </Text>
              <Text style={[styles.col, styles.infoTableHeader]}>
                Employee No.
              </Text>
              <Text style={[styles.col, styles.infoTableCell]}>
                {employeeNumber}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.infoTableHeader]}>
                Department
              </Text>
              <Text style={[styles.col, styles.infoTableCell]}>
                {department}
              </Text>
              <Text style={[styles.col, styles.infoTableHeader]}>Position</Text>
              <Text style={[styles.col, styles.infoTableCell]}>{position}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.infoTableHeader]}>
                No of Lateness
              </Text>
              <Text style={[styles.col, styles.infoTableCell]}>{lateness}</Text>
              <Text style={[styles.col, styles.infoTableHeader]}>
                No of Days Absent
              </Text>
              <Text style={[styles.col, styles.infoTableCell]}>
                {daysAbsent}
              </Text>
            </View>
          </View>

          {/* Earnings Table */}
          <Text style={styles.sectionTitle}>Earnings & Allowances</Text>
          <View style={[styles.table, styles.earningsTable]}>
            <View style={styles.row}>
              <Text style={[styles.col, styles.earningsHeader]}>
                Description
              </Text>
              <Text style={[styles.colRight, styles.earningsHeader]}>
                Amount (₦)
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>Basic Salary</Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(basicSalary)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Additional Earnings
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.additionalEarnings || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Increment/Arrears
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.incrementArrears || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Vehicle/House/Transport Allowance
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.transportAllowance || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Travel/Night Allowance
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.travelAllowance || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Inconvenience Allowance
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.inconvenienceAllowance || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>Overtime</Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(overtime)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Leave Allowance
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.leaveAllowance || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Medical Allowance
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.medicalAllowance || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>Bonus</Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(allowances.bonus || 0)}
              </Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={[styles.col, styles.tableCell]}>
                <Text style={{ fontWeight: "bold" }}>Total Allowances</Text>
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {formatCurrency(totalAllowances)}
                </Text>
              </Text>
            </View>
            <View style={[styles.row, styles.grossPayRow]}>
              <Text style={[styles.col, styles.tableCell]}>
                <Text style={{ fontWeight: "bold" }}>GROSS PAY</Text>
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {formatCurrency(calculatedGrossPay)}
                </Text>
              </Text>
            </View>
          </View>

          {/* Deductions Table */}
          <Text style={styles.sectionTitle}>Deductions</Text>
          <View style={[styles.table, styles.deductionsTable]}>
            <View style={styles.row}>
              <Text style={[styles.col, styles.deductionsHeader]}>
                Description
              </Text>
              <Text style={[styles.colRight, styles.deductionsHeader]}>
                Amount (₦)
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>Loan Deduction</Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(deductions.loanDeduction || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                P.A.Y.E. Deduction
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(deductions.paye || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Security Deposit Deduction
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(deductions.securityDeposit || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Pension Deduction
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(deductions.pension || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.col, styles.tableCell]}>
                Other Deductions
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                {formatCurrency(deductions.other || 0)}
              </Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={[styles.col, styles.tableCell]}>
                <Text style={{ fontWeight: "bold" }}>TOTAL DEDUCTIONS</Text>
              </Text>
              <Text
                style={[styles.colRight, styles.tableCell, styles.amountCol]}
              >
                <Text style={{ fontWeight: "bold" }}>
                  {formatCurrency(totalDeductions)}
                </Text>
              </Text>
            </View>
          </View>

          {/* Net Pay Section */}
          <View style={styles.netPaySection}>
            <Text style={{ fontSize: 14 }}>NET PAY</Text>
            <Text style={styles.netPayAmount}>
              {formatCurrency(calculatedNetPay)}
            </Text>
            <Text style={{ fontSize: 11, opacity: 0.9 }}>
              Amount after all deductions
            </Text>
          </View>

          {/* Authorization Section */}
          <View style={styles.authorizationContainer}>
            <View style={styles.authBox}>
              <Text style={styles.authHeader}>REVIEWED BY</Text>
              <Text style={styles.authName}>Admin User</Text>
              <Text style={styles.authRole}>HR Manager</Text>
              <View style={styles.authDivider} />
              <Text style={styles.authDate}>Date: _______________</Text>
            </View>

            <View style={styles.authBox}>
              <Text style={styles.authHeader}>APPROVED BY</Text>
              <Text style={styles.authName}>Finance Manager</Text>
              <Text style={styles.authRole}>Accounts Department</Text>
              <View style={styles.authDivider} />
              <Text style={styles.authDate}>Date: _______________</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={{ marginBottom: 3 }}>
              This is a computer-generated payslip • Generated:{" "}
              {formatDate(new Date())}
            </Text>
            <Text style={{ marginBottom: 3 }}>
              For questions, contact: hr@company.com
            </Text>
            <Text style={{ marginBottom: 3 }}>
              {companyName} • CONFIDENTIAL DOCUMENT • AUTHORIZED PERSONNEL ONLY
            </Text>
            <Text style={{ fontSize: 8, color: "#bbb" }}>
              POWERED BY PAYROLL SYSTEM — OPERATED UNDER {companyName}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default PayslipPDF;
