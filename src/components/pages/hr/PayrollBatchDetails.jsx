import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import moment from "moment";
import { useReactToPrint } from "react-to-print";
import { useSelector } from "react-redux";
import {
  DollarSign, Users, Download, CheckCircle, AlertCircle,
  Eye, MoreVertical, Search, RefreshCw, Building,
  ArrowLeft, TrendingUp, CreditCard, Filter, Printer,
  CalendarCheck, Clock4, ChevronDown
} from "lucide-react";
import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { _fetchApi, _postApi, apiURL } from "@/redux/actions/api";
import PayslipPDF from "./PayslipPDF";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";

const months = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" }, { value: 4, label: "April" },
  { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" },
  { value: 9, label: "September" }, { value: 10, label: "October" },
  { value: 11, label: "November" }, { value: 12, label: "December" },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount || 0);

const getStatusColor = (status) => {
  switch (status) {
    case "Paid": return "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-100";
    case "Processed": return "bg-[color:var(--app-primary)] text-white border-[color:var(--app-primary)] shadow-sm shadow-[color:var(--app-primary)]/20";
    case "Draft": return "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-100";
    case "Stopped": return "bg-rose-500 text-white border-rose-600 shadow-sm shadow-rose-100";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

/**
 * PayrollBatchDetails
 *
 * Props:
 *   payrollData   - { payrolls[], totalNetPay, totalGrossPay, totalDeductions, totalEmployees }
 *   selectedMonth - numeric month (1-12)
 *   selectedYear  - numeric year
 *   onBack        - () => void  called when back arrow is clicked
 *   onRefresh     - (month, year) => void  called after status changes so parent can re-fetch
 *   allowPayment  - when true, shows Release Payments / Download Schedule (Payroll Payment tab)
 */
const PayrollBatchDetails = ({
  payrollData,
  selectedMonth,
  selectedYear,
  onBack,
  onRefresh,
  allowPayment = false,
}) => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const secondaryColor = activeBusiness?.secondary_color;
  const gradientEnd =
    secondaryColor && String(secondaryColor).toLowerCase() !== "#ffffff"
      ? secondaryColor
      : primaryColor;
  const headerGradient = `linear-gradient(to right, ${primaryColor}, ${gradientEnd})`;
  const brandButtonStyle = {
    backgroundColor: primaryColor,
    borderColor: primaryColor,
    color: "#fff",
  };
  const payeEnabled =
    activeBusiness?.paye_auto_calculation !== false &&
    activeBusiness?.paye_auto_calculation !== 0 &&
    activeBusiness?.paye_auto_calculation !== "0";
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [selectedLedgerIds, setSelectedLedgerIds] = useState([]);

  // Bank selection / release modal
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState("");

  // Post-release download modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [lastReleasedTemplate, setLastReleasedTemplate] = useState(null);
  const [lastReleasedBankId, setLastReleasedBankId] = useState(null);

  const cashAccountTypeaheadRef = useRef(null);
  const bankAccountTypeaheadRef = useRef(null);

  // Advanced Payment States (inspired by PayBills.jsx)
  const [modeOfPayment, setModeOfPayment] = useState("bank"); // default to bank
  const [paymentDate, setPaymentDate] = useState(moment().format("YYYY-MM-DD"));
  const [chequeNumber, setChequeNumber] = useState("");
  const [narration, setNarration] = useState("");
  const [bankAccount, setBankAccount] = useState(null);
  const [accountHead, setAccountHead] = useState(null);
  const [accountList, setAccountList] = useState([]);
  const [headList, setHeadList] = useState([]);
  const [showAccountingTreatment, setShowAccountingTreatment] = useState(false);

  // Attendance modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedAttendanceEmployee, setSelectedAttendanceEmployee] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [paymentBasisFilter, setPaymentBasisFilter] = useState("All");

  // Payslip modal
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const payslipRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: payslipRef,
    documentTitle: `Payslip_${selectedPayslip?.employee?.firstName}_${selectedPayslip?.employee?.lastName}`,
  });

  // Derived state
  const payrolls = payrollData?.payrolls || [];
  const allProcessed = payrolls.length > 0 && payrolls.every(p => p.status !== "Draft");
  const hasDrafts = payrolls.some(p => p.status === "Draft");
  const hasProcessed = payrolls.some(p => p.status === "Processed");
  const isPaid = payrolls.length > 0 && payrolls.every(p => p.status === "Paid");

  const monthLabel = months.find(m => m.value === parseInt(selectedMonth))?.label || selectedMonth;

  const batchNetPay =
    parseFloat(payrollData?.summary?.totalNetPay) ||
    parseFloat(payrollData?.totalNetPay) ||
    payrolls.reduce((s, p) => s + parseFloat(p.netPay || 0), 0);

  const formatBankLabel = (option) => {
    if (!option) return "";
    const name = option.account_name || option.bank_name || "Bank Account";
    const number = option.account_number || "";
    const head = option.head || option.account_code || "";
    if (head && number) return `${head} - ${number} (${name})`;
    if (number) return `${number} (${name})`;
    return name;
  };

  const parseDetailMap = (raw) => {
    if (!raw) return {};
    let data = raw;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
        if (typeof data === "string") data = JSON.parse(data);
      } catch {
        return {};
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const cleaned = {};
    Object.entries(data).forEach(([k, v]) => {
      if (!k || /^\d+$/.test(String(k))) return;
      const n = parseFloat(v);
      if (Number.isFinite(n) && n !== 0) cleaned[k] = n;
    });
    return cleaned;
  };

  /** Preview of GL lines that will post when payroll is released */
  const releaseAccountingPreview = (() => {
    const processed = payrolls.filter((p) => p.status === "Processed");
    const source =
      modeOfPayment === "cash"
        ? accountHead
        : bankAccount;
    const sourceCode =
      modeOfPayment === "cash"
        ? source?.head || source?.code || "—"
        : source?.head || source?.account_code || "—";
    const sourceName =
      modeOfPayment === "cash"
        ? source?.description || source?.name || "Cash"
        : source?.account_name || source?.bank_name || "Bank";

    let basic = 0;
    let allowances = 0;
    let bonuses = 0;
    let overtime = 0;
    let net = 0;
    let paye = 0;
    let pension = 0;
    let loan = 0;
    const otherDeductionMap = {};

    processed.forEach((p) => {
      basic += parseFloat(p.basicSalary || 0);
      allowances += parseFloat(p.allowances || 0);
      bonuses += parseFloat(p.bonuses || 0);
      overtime += parseFloat(p.overtime || 0);
      net += parseFloat(p.netPay || 0);
      if (payeEnabled) {
        paye += parseFloat(p.paye || 0);
        pension += parseFloat(p.pension || 0);
      }
      loan += parseFloat(p.loanRepayment || 0);
      Object.entries(parseDetailMap(p.deduction_details)).forEach(([name, amt]) => {
        const key = name.toLowerCase();
        if (
          ["paye", "tax", "income tax", "pension", "loan", "loan repayment", "staff loan"].some(
            (s) => key.includes(s)
          )
        ) {
          return;
        }
        otherDeductionMap[name] = (otherDeductionMap[name] || 0) + amt;
      });
    });

    const rows = [];
    if (basic > 0) rows.push({ side: "Dr", account: "Salary Expense", code: "—", amount: basic });
    if (allowances > 0) rows.push({ side: "Dr", account: "Allowances Expense", code: "—", amount: allowances });
    if (bonuses > 0) rows.push({ side: "Dr", account: "Bonus Expense", code: "—", amount: bonuses });
    if (overtime > 0) rows.push({ side: "Dr", account: "Overtime Expense", code: "—", amount: overtime });
    if (net > 0) {
      const bankLabel =
        sourceCode && sourceCode !== "—"
          ? `Bank - ${sourceName} (${sourceCode})`
          : `Bank - ${sourceName}`;
      rows.push({
        side: "Cr",
        account: bankLabel,
        code: "—",
        amount: net,
      });
    }
    if (paye > 0) rows.push({ side: "Cr", account: "PAYE Tax Payable", code: "—", amount: paye });
    if (pension > 0) rows.push({ side: "Cr", account: "Pension Payable", code: "—", amount: pension });
    if (loan > 0) rows.push({ side: "Cr", account: "Loan Receivable / Deduction", code: "—", amount: loan });
    Object.entries(otherDeductionMap).forEach(([name, amount]) => {
      rows.push({ side: "Cr", account: `${name} Payable`, code: "—", amount });
    });

    return rows.filter((r) => r.amount > 0);
  })();

  // Fetch bank accounts or cash heads when mode changes
  useEffect(() => {
    if (!showReleaseModal) return;

    if (modeOfPayment === "cash") {
      setAccountList([]);
      setBankAccount(null);
      _postApi(
        `/inventory/product-list?query_type=cash`,
        { facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) setHeadList(resp?.results || []);
        },
        (err) => console.error("Error fetching cash heads:", err)
      );
    } else if (modeOfPayment === "bank" || modeOfPayment === "cheque") {
      setHeadList([]);
      setAccountHead(null);
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${facilityId}`,
        (data) => {
          if (data.success) setAccountList(data.results || []);
        },
        (err) => console.error("Error fetching bank accounts:", err)
      );
    }
  }, [modeOfPayment, showReleaseModal, facilityId]);
  // Removed the redundant bankAccounts fetch as we now have a mode-aware fetch above

  // Filter
  useEffect(() => {
    let filtered = [...payrolls];
    
    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.employee?.firstName?.toLowerCase().includes(q) ||
        item.employee?.lastName?.toLowerCase().includes(q) ||
        item.employee?.employeeId?.toLowerCase().includes(q)
      );
    }

    // Payment Basis Filter
    if (paymentBasisFilter !== "All") {
      filtered = filtered.filter(item => {
        const type = item.employee?.salaryStructure?.paymentType || "Monthly";
        if (paymentBasisFilter === "Monthly") return type === "Monthly";
        return type !== "Monthly";
      });
    }

    setFilteredData(filtered);
  }, [payrollData, searchTerm, paymentBasisFilter]);

  const fetchAttendance = async (employee, empId = null) => {
    const idToUse = empId || employee?.id;
    if (!idToUse || !facilityId) return;
    setAttendanceLoading(true);
    setSelectedAttendanceEmployee(employee);
    setAttendanceRecords([]);
    setShowAttendanceModal(true);

    const startDate = moment(`${selectedYear}-${selectedMonth}-01`, "YYYY-M-DD").startOf('month').format("YYYY-MM-DD");
    const endDate = moment(`${selectedYear}-${selectedMonth}-01`, "YYYY-M-DD").endOf('month').format("YYYY-MM-DD");

    _fetchApi(
      `/api/hr/attendance/report?facilityId=${facilityId}&employeeId=${idToUse}&startDate=${startDate}&endDate=${endDate}&limit=100`,
      (data) => {
        if (data.success) {
          setAttendanceRecords(data.data.attendance || []);
        }
        setAttendanceLoading(false);
      },
      (err) => {
        console.error("Attendance fetch failed", err);
        setAttendanceLoading(false);
      }
    );
  };

  // ── API Helpers ────────────────────────────────────────────────────────────
  const updateIndividualStatus = async (item, newStatus) => {
    try {
      const res = await window.fetch(`${apiURL}/api/hr/payroll/status/${item.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: localStorage.getItem("@@__token") || "" },
        body: JSON.stringify({ status: newStatus, facilityId, userId: user?.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Employee payroll ${newStatus.toLowerCase()} successfully`);
        onRefresh?.(selectedMonth, selectedYear);
      } else toast.error(data.message);
    } catch { toast.error("Status update failed"); }
  };

  const approveBatch = async () => {
    const draftIds = selectedLedgerIds.length > 0
      ? selectedLedgerIds
      : payrolls.filter(p => p.status === "Draft").map(p => p.id);
    if (draftIds.length === 0) { toast.info("No drafts selected to approve"); return; }

    setLoading(true);
    try {
      const res = await window.fetch(`${apiURL}/api/hr/payroll/batch-status`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: localStorage.getItem("@@__token") || "" },
        body: JSON.stringify({ ids: draftIds, status: "Processed", facilityId, userId: user?.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Batch processed! ${data.data.updatedCount} records confirmed.`);
        setSelectedLedgerIds([]);
        onRefresh?.(selectedMonth, selectedYear);
      } else toast.error(data.message || "Batch approval failed");
    } catch { toast.error("Batch approval failed"); }
    finally { setLoading(false); }
  };

  const markAsPaid = async () => {
    if (loading) return;

    // Validation
    if (!modeOfPayment) return toast.error("Please select a mode of payment");
    if (!paymentDate) return toast.error("Please select a payment date");
    
    if (["bank", "cheque"].includes(modeOfPayment) && !bankAccount) {
      return toast.error("Please select a bank account");
    }
    if (modeOfPayment === "cash" && !accountHead) {
      return toast.error("Please select a cash account head");
    }
    if (modeOfPayment === "cheque" && !chequeNumber) {
      return toast.error("Please enter a cheque number");
    }

    setLoading(true);
    try {
      const payload = {
        month: parseInt(selectedMonth),
        year: selectedYear,
        facilityId,
        userId: user?.id,
        mode_of_payment: modeOfPayment,
        payment_date: paymentDate,
        cheque_number: chequeNumber,
        remark: narration,
      };

      if (["bank", "cheque"].includes(modeOfPayment)) {
        payload.bankAccountId = bankAccount.id;
      } else {
        payload.accountHead = accountHead;
      }

      const res = await window.fetch(`${apiURL}/api/hr/payroll/mark-paid`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: localStorage.getItem("@@__token") || "" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(`Success: ${data.data.totalRecords} payments released!`);
        setShowReleaseModal(false);
        
        // Store template + bank id for the download modal
        setLastReleasedBankId(payload.bankAccountId || null);
        setLastReleasedTemplate(data.data.payrollTemplate || null);
        
        setShowScheduleModal(true); // auto-open download schedule modal
        if (onRefresh) onRefresh(selectedMonth, selectedYear);
      } else {
        toast.error(data.message || "Error releasing payments");
      }
    } catch (err) {
      console.error("Release failed:", err);
      toast.error("Error releasing payments");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!payrolls.length) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Payroll");

      const headers = [
        "Employee ID",
        "Name",
        "Designation",
        "Basic Salary",
        "Allowances",
        "Bonus",
        ...(payeEnabled ? ["PAYE Tax"] : []),
        "Deductions",
        "Gross Pay",
        "Net Pay",
        "Status",
      ];
      const colCount = headers.length;

      worksheet.columns = headers.map((h) => ({
        width:
          h === "Name" || h === "Designation"
            ? 28
            : h === "Employee ID" || h === "Status"
              ? 14
              : 16,
      }));

      const border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };

      let rowIdx = 1;

      // 1. Business Header
      const title = worksheet.getCell(rowIdx, 1);
      title.value =
        activeBusiness?.business_name ||
        activeBusiness?.name ||
        "Inventria Business";
      title.style = {
        font: { bold: true, size: 16 },
        alignment: { horizontal: "center" },
      };
      worksheet.mergeCells(rowIdx, 1, rowIdx, colCount);
      rowIdx++;

      // 2. RC Number
      if (activeBusiness?.rc || activeBusiness?.registration_number) {
        const rc = worksheet.getCell(rowIdx, 1);
        rc.value = `RC. ${activeBusiness?.rc || activeBusiness?.registration_number}`;
        rc.style = {
          font: { size: 11 },
          alignment: { horizontal: "center" },
        };
        worksheet.mergeCells(rowIdx, 1, rowIdx, colCount);
        rowIdx++;
      }

      // 3. Report Name / Period
      const sub = worksheet.getCell(rowIdx, 1);
      sub.value = `PAYROLL LEDGER: ${monthLabel.toUpperCase()} ${selectedYear}`;
      sub.style = {
        font: { bold: true, size: 12, color: { argb: "FF1E40AF" } },
        alignment: { horizontal: "center" },
      };
      worksheet.mergeCells(rowIdx, 1, rowIdx, colCount);
      rowIdx++;

      // 4. Generation Date
      const genDate = worksheet.getCell(rowIdx, 1);
      genDate.value = `Generated on: ${moment().format("dddd, Do MMMM YYYY, h:mm A")}`;
      genDate.style = {
        font: { size: 9, italic: true, color: { argb: "FF64748B" } },
        alignment: { horizontal: "center" },
      };
      worksheet.mergeCells(rowIdx, 1, rowIdx, colCount);
      rowIdx += 2;

      // 5. Table Header
      const hdrRow = worksheet.getRow(rowIdx);
      headers.forEach((h, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = h;
        cell.style = {
          font: { bold: true, color: { argb: "FFFFFFFF" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF334155" },
          },
          alignment: {
            horizontal:
              ["Basic Salary", "Allowances", "Bonus", "PAYE Tax", "Deductions", "Gross Pay", "Net Pay"].includes(h)
                ? "right"
                : "left",
          },
          border,
        };
      });
      rowIdx++;

      const moneyCols = new Set(
        headers
          .map((h, i) =>
            ["Basic Salary", "Allowances", "Bonus", "PAYE Tax", "Deductions", "Gross Pay", "Net Pay"].includes(h)
              ? i + 1
              : null
          )
          .filter(Boolean)
      );

      let totalBasic = 0;
      let totalAllowances = 0;
      let totalBonus = 0;
      let totalPaye = 0;
      let totalDeductions = 0;
      let totalGross = 0;
      let totalNet = 0;

      // 6. Data Rows
      payrolls.forEach((p) => {
        const basic = parseFloat(p.basicSalary || 0);
        const allowances = parseFloat(p.allowances || 0);
        const bonus = parseFloat(p.bonuses || 0);
        const paye = parseFloat(p.paye || 0);
        const deductions = parseFloat(p.deductions || 0);
        const gross = parseFloat(p.grossPay || 0);
        const net = parseFloat(p.netPay || 0);

        totalBasic += basic;
        totalAllowances += allowances;
        totalBonus += bonus;
        totalPaye += paye;
        totalDeductions += deductions;
        totalGross += gross;
        totalNet += net;

        const values = [
          p.employee?.employeeId || "",
          `${p.employee?.firstName || ""} ${p.employee?.lastName || ""}`.trim(),
          p.employee?.designation || "",
          basic,
          allowances,
          bonus,
          ...(payeEnabled ? [paye] : []),
          deductions,
          gross,
          net,
          p.status || "",
        ];

        const row = worksheet.getRow(rowIdx);
        values.forEach((val, i) => {
          const col = i + 1;
          const cell = row.getCell(col);
          cell.value = val;
          cell.style = {
            border,
            alignment: { horizontal: moneyCols.has(col) ? "right" : "left" },
            font: moneyCols.has(col) ? { bold: true } : {},
          };
          if (moneyCols.has(col)) cell.numFmt = "#,##0.00";
        });
        rowIdx++;
      });

      // 7. Totals
      const totalRow = worksheet.getRow(rowIdx);
      const totalsByHeader = {
        Name: "TOTAL:",
        "Basic Salary": totalBasic,
        Allowances: totalAllowances,
        Bonus: totalBonus,
        "PAYE Tax": totalPaye,
        Deductions: totalDeductions,
        "Gross Pay": totalGross,
        "Net Pay": totalNet,
      };
      headers.forEach((h, i) => {
        const col = i + 1;
        const cell = totalRow.getCell(col);
        if (h in totalsByHeader) {
          cell.value = totalsByHeader[h];
        }
        cell.style = {
          font: { bold: true, color: { argb: "FF1E40AF" } },
          alignment: { horizontal: moneyCols.has(col) ? "right" : "left" },
          border,
        };
        if (moneyCols.has(col)) cell.numFmt = "#,##0.00";
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Payroll_${monthLabel}_${selectedYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel export successful!");
    } catch (err) {
      console.error("Excel export failed", err);
      toast.error("Export failed");
    }
  };

  const parseDetails = (raw) => {
    if (!raw) return {};
    let data = raw;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
        if (typeof data === "string") data = JSON.parse(data);
      } catch {
        return {};
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const cleaned = {};
    Object.entries(data).forEach(([k, v]) => {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n !== 0) cleaned[k] = n;
    });
    return cleaned;
  };

  const detailsHint = (raw) => {
    const map = parseDetails(raw);
    const parts = Object.entries(map).map(
      ([k, v]) => `${k}: ${formatCurrency(v)}`
    );
    return parts.length ? parts.join(" · ") : "";
  };

  // Professional bank schedule (no template) — using ExcelJS for styling
  const downloadDefaultSchedule = async () => {
    if (!payrolls.length) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Payment Schedule");

      // Define columns
      worksheet.columns = [
        { width: 15 }, // ID
        { width: 40 }, // Name
        { width: 30 }, // Bank
        { width: 15 }, // Code
        { width: 25 }, // Account
        { width: 20 }, // Amount
      ];

      const border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };

      let rowIdx = 1;

      // 1. Business Header
      const title = worksheet.getCell(rowIdx, 1);
      title.value = activeBusiness?.business_name || activeBusiness?.name || "Inventria Business";
      title.style = {
        font: { bold: true, size: 16 },
        alignment: { horizontal: "center" },
      };
      worksheet.mergeCells(rowIdx, 1, rowIdx, 6);
      rowIdx++;

      // 2. RC Number
      if (activeBusiness?.rc || activeBusiness?.registration_number) {
        const rc = worksheet.getCell(rowIdx, 1);
        rc.value = `RC. ${activeBusiness?.rc || activeBusiness?.registration_number}`;
        rc.style = {
          font: { size: 11 },
          alignment: { horizontal: "center" },
        };
        worksheet.mergeCells(rowIdx, 1, rowIdx, 6);
        rowIdx++;
      }

      // 3. Report Name / Period
      const sub = worksheet.getCell(rowIdx, 1);
      sub.value = `PAYROLL PAYMENT SCHEDULE: ${monthLabel.toUpperCase()} ${selectedYear}`;
      sub.style = {
        font: { bold: true, size: 12, color: { argb: "FF1E40AF" } },
        alignment: { horizontal: "center" },
      };
      worksheet.mergeCells(rowIdx, 1, rowIdx, 6);
      rowIdx++;

      // 4. Generation Date
      const genDate = worksheet.getCell(rowIdx, 1);
      genDate.value = `Generated on: ${moment().format("dddd, Do MMMM YYYY, h:mm A")}`;
      genDate.style = {
        font: { size: 9, italic: true, color: { argb: "FF64748B" } },
        alignment: { horizontal: "center" },
      };
      worksheet.mergeCells(rowIdx, 1, rowIdx, 6);
      rowIdx += 2;

      // 5. Table Header
      const hdrRow = worksheet.getRow(rowIdx);
      const headers = ["Employee ID", "Employee Name", "Bank Name", "Bank Code", "Account Number", "Net Pay (NGN)"];
      headers.forEach((h, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = h;
        cell.style = {
          font: { bold: true, color: { argb: "FFFFFFFF" } },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF334155" }, // Slate 700
          },
          alignment: { horizontal: i >= 5 ? "right" : "left" },
          border,
        };
      });
      rowIdx++;

      // 6. Data Rows
      payrolls.forEach((p) => {
        const row = worksheet.getRow(rowIdx);
        row.getCell(1).value = p.employee?.employeeId || "";
        row.getCell(2).value = `${p.employee?.firstName || ""} ${p.employee?.lastName || ""}`.trim();
        row.getCell(3).value = p.employee?.bankName || "";
        row.getCell(4).value = p.employee?.bankCode || "";
        row.getCell(5).value = p.employee?.bankAccount || "";
        row.getCell(6).value = parseFloat(p.netPay || 0);

        // Styling data cells
        [1, 2, 3, 4, 5, 6].forEach((col) => {
          row.getCell(col).style = {
            border,
            alignment: { horizontal: col === 6 ? "right" : "left" },
            font: col === 6 ? { bold: true } : {},
          };
          if (col === 6) row.getCell(col).numFmt = "#,##0.00";
        });
        rowIdx++;
      });

      // 7. Footer Total
      const totalRow = worksheet.getRow(rowIdx);
      totalRow.getCell(5).value = "TOTAL REMITTANCE:";
      totalRow.getCell(5).style = { font: { bold: true }, alignment: { horizontal: "right" }, border };
      totalRow.getCell(6).value = payrolls.reduce((sum, p) => sum + parseFloat(p.netPay || 0), 0);
      totalRow.getCell(6).style = {
        font: { bold: true, color: { argb: "FF1E40AF" } },
        alignment: { horizontal: "right" },
        numFmt: "#,##0.00",
        border
      };

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Payment_Schedule_${monthLabel}_${selectedYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel schedule downloaded.");
    } catch (err) {
      console.error("ExcelJS export failed", err);
      toast.error("Export failed. Please try again.");
    }
  };

  // Populate bank template and download
  const downloadTemplateSchedule = (b64Template) => {
    try {
      const rows = payrolls.map(p => ([
        p.employee?.employeeId || "",
        `${p.employee?.firstName || ""} ${p.employee?.lastName || ""}`.trim(),
        p.employee?.bankName || "",
        p.employee?.bankCode || "",
        p.employee?.bankAccount || "",
        p.netPay || 0,
      ]));
      let b64 = b64Template;
      if (b64.includes(",")) b64 = b64.split(",")[1];
      const wb  = XLSX.read(b64, { type: "base64" });
      const wsN = wb.SheetNames[0];
      const ws  = wb.Sheets[wsN];
      XLSX.utils.sheet_add_aoa(ws, rows, { origin: -1 });
      XLSX.writeFile(wb, `Bank_Schedule_${monthLabel}_${selectedYear}.xlsx`);
      toast.success("Bank schedule downloaded.");
    } catch (err) {
      console.error("Template injection failed", err);
      toast.error("Failed to populate template.");
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns = [
    {
      value: "selection",
      title: (
        <input
          type="checkbox" className="size-4 accent-slate-900"
          checked={
            selectedLedgerIds.length === filteredData.filter(p => p.status === "Draft").length &&
            filteredData.filter(p => p.status === "Draft").length > 0
          }
          onChange={(e) => {
            if (e.target.checked) setSelectedLedgerIds(filteredData.filter(p => p.status === "Draft").map(p => p.id));
            else setSelectedLedgerIds([]);
          }}
        />
      ),
      custom: true, className: "w-[40px] text-center",
      component: (item) => item.status === "Draft"
        ? (
          <input
            type="checkbox" className="size-4 accent-slate-900"
            checked={selectedLedgerIds.includes(item.id)}
            onChange={() => setSelectedLedgerIds(prev =>
              prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
            )}
          />
        ) : <CheckCircle className="size-4 text-emerald-500 mx-auto" />,
    },
    {
      value: "employee", title: "Employee", custom: true, className: "w-[280px]",
      component: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border border-muted">
            <AvatarImage src={item.employee?.photoUrl} alt={item.employee?.firstName} />
            <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
              {item.employee?.firstName?.[0]}{item.employee?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">
              {item.employee?.firstName} {item.employee?.lastName}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {item.employee?.employeeId} • {item.employee?.designation}
            </span>
          </div>
        </div>
      ),
    },
    {
      value: "basicSalary", title: "Base Pay", custom: true,
      className: "text-left font-mono tabular-nums",
      component: (item) => <span className="text-sm font-medium">{formatCurrency(item.basicSalary)}</span>,
    },
    {
      value: "allowances", title: "Allowances", custom: true,
      className: "text-center font-mono tabular-nums",
      component: (item) => {
        const hint = detailsHint(item.allowance_details);
        return (
          <div className="flex flex-col items-center" title={hint || undefined}>
            <span className="text-sm font-medium text-emerald-600">
              +{formatCurrency(item.allowances)}
            </span>
            {hint ? (
              <span className="text-[9px] text-slate-400 max-w-[120px] truncate">
                {hint}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      value: "bonuses", title: "Bonus", custom: true,
      className: "text-center font-mono tabular-nums",
      component: (item) => {
        const hint = detailsHint(item.bonus_details);
        return (
          <div className="flex flex-col items-center" title={hint || undefined}>
            <span className="text-sm font-medium text-emerald-600">
              +{formatCurrency(item.bonuses || 0)}
            </span>
            {hint ? (
              <span className="text-[9px] text-slate-400 max-w-[120px] truncate">
                {hint}
              </span>
            ) : null}
          </div>
        );
      },
    },
    ...(payeEnabled
      ? [
          {
            value: "paye",
            title: "PAYE Tax",
            custom: true,
            className: "text-center font-mono tabular-nums",
            component: (item) => (
              <span className="text-sm font-medium text-amber-700">
                -{formatCurrency(item.paye || 0)}
              </span>
            ),
          },
        ]
      : []),
    {
      value: "deductions", title: "Deductions", custom: true,
      className: "text-center font-mono tabular-nums",
      component: (item) => <span className="text-sm font-medium text-destructive">-{formatCurrency(item.deductions)}</span>,
    },
    {
      value: "netPay", title: "Net Payment", custom: true,
      className: "text-center font-mono tabular-nums",
      component: (item) => <span className="text-sm font-black text-foreground">{formatCurrency(item.netPay)}</span>,
    },
    {
      value: "status", title: "Status", custom: true, className: "text-center",
      component: (item) => (
        <Badge variant="outline" className={`${getStatusColor(item.status)} font-bold text-[10px] uppercase tracking-widest px-2 py-0.5`}>
          {item.status}
        </Badge>
      ),
    },
    {
      value: "action", title: "", custom: true, className: "text-right",
      component: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVertical className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="text-slate-900 font-bold cursor-pointer"
              onClick={() => { setSelectedPayslip(item); setShowPayslipModal(true); }}
            >
              <Eye className="size-4 mr-2" /> View Payslip
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-slate-900 font-bold cursor-pointer"
              onClick={() => fetchAttendance(item.employee, item.employeeId)}
            >
              <CalendarCheck className="size-4 mr-2" /> View Attendance
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {item.status !== "Paid" && (
              <>
                {item.status === "Draft" && (
                  <DropdownMenuItem
                    className="font-bold cursor-pointer"
                    style={{ color: primaryColor }}
                    onClick={() => updateIndividualStatus(item, "Processed")}
                  >
                    <CheckCircle className="size-4 mr-2" /> Confirm & Process
                  </DropdownMenuItem>
                )}
                {item.status !== "Cancelled" && item.status !== "Stopped" ? (
                  <DropdownMenuItem
                    className="text-rose-600 font-bold cursor-pointer"
                    onClick={() => updateIndividualStatus(item, "Cancelled")}
                  >
                    <AlertCircle className="size-4 mr-2" /> Stop Payment
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-emerald-600 font-bold cursor-pointer"
                    onClick={() => updateIndividualStatus(item, "Draft")}
                  >
                    <RefreshCw className="size-4 mr-2" /> Reinstate (Draft)
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col gap-0 bg-white rounded border border-muted shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{
        ["--app-primary"]: primaryColor,
        ["--app-secondary"]: gradientEnd,
      }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-8 py-3 bg-slate-50/50 border-b border-muted">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" className="size-10 rounded-xl hover:bg-white hover:shadow-sm transition-all" onClick={onBack}>
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl font-black tracking-tight text-foreground italic uppercase">Itemized Ledger</h2>
            <p className="text-xs text-muted-foreground font-medium">Verified remittance details for {monthLabel} {selectedYear} cycle.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 px-4 text-xs font-bold gap-2 border-muted bg-white rounded-xl" onClick={handleExportExcel}>
            <Download className="size-3.5" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Action Control Panel */}
      <div
        className="px-8 py-6 border-b flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
        style={{ background: headerGradient }}
      >
        <div className="absolute right-6 top-0 bottom-0 flex items-center opacity-[0.08] pointer-events-none">
          <RefreshCw className="size-24 animate-[spin_40s_linear_infinite] text-white" />
        </div>
        <div className="flex flex-col gap-1.5 relative z-10">
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-white/30 text-[8px] font-black uppercase tracking-widest px-2 py-0.5">
              {payrolls.filter(p => p.status === "Processed").length} Processed
            </Badge>
            <Badge className="bg-white/15 text-white/90 border-white/25 text-[8px] font-black uppercase tracking-widest px-2 py-0.5">
              {payrolls.filter(p => p.status === "Draft").length} Drafts
            </Badge>
            {isPaid && (
              <Badge className="bg-white/25 text-white border-white/40 text-[8px] font-black uppercase tracking-widest px-2 py-0.5">
                ✓ Funds Released
              </Badge>
            )}
          </div>
          <h3 className="text-white font-black text-sm tracking-tight italic">Batch Workflow Control</h3>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {hasDrafts && !isPaid && (
            <Button
              className="bg-white hover:bg-white/90 h-11 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2"
              style={{ color: primaryColor }}
              onClick={approveBatch} disabled={loading}
            >
              <CheckCircle className="size-4" />
              Confirm & Process {selectedLedgerIds.length > 0 ? `Selected (${selectedLedgerIds.length})` : "All Drafts"}
            </Button>
          )}
          {allowPayment && hasProcessed && !isPaid && (
            <Button
              className="bg-white hover:bg-white/90 h-11 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              style={{ color: primaryColor }}
              onClick={() => setShowReleaseModal(true)}
              disabled={!allProcessed || loading}
            >
              <CreditCard className="w-4 h-4 mr-2" /> Release Payments
            </Button>
          )}
          {allowPayment && isPaid && (
            <Button
              className="bg-white hover:bg-white/90 h-11 px-8 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-sm"
              style={{ color: primaryColor }}
              onClick={() => setShowScheduleModal(true)}
            >
              <Download className="w-4 h-4 mr-2" /> Download Schedule
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stat Strip */}
      <div
        className={`grid grid-cols-2 md:grid-cols-3 border-b border-muted bg-slate-50/20 ${
          payeEnabled ? "lg:grid-cols-6" : "lg:grid-cols-5"
        }`}
      >
        <div className="p-6 border-r border-muted flex flex-col gap-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Net Pay</span>
          <span className="text-lg font-black font-mono">{formatCurrency(payrollData?.summary?.totalNetPay || payrollData.totalNetPay)}</span>
        </div>
        <div className="p-6 border-r border-muted flex flex-col gap-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Total Gross</span>
          <span className="text-lg font-black font-mono">{formatCurrency(payrollData?.summary?.totalGrossPay || payrollData.totalGrossPay)}</span>
        </div>
        <div className="p-6 border-r border-muted flex flex-col gap-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Allowances</span>
          <span className="text-lg font-black font-mono text-emerald-600">
            {formatCurrency(
              payrolls.reduce((sum, p) => sum + parseFloat(p.allowances || 0), 0)
            )}
          </span>
        </div>
        <div className="p-6 border-r border-muted flex flex-col gap-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Bonus</span>
          <span className="text-lg font-black font-mono text-emerald-600">
            {formatCurrency(
              payrolls.reduce((sum, p) => sum + parseFloat(p.bonuses || 0), 0)
            )}
          </span>
        </div>
        {payeEnabled ? (
          <div className="p-6 border-r border-muted flex flex-col gap-1">
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Total PAYE</span>
            <span className="text-lg font-black font-mono text-amber-700">
              {formatCurrency(
                payrolls.reduce((sum, p) => sum + parseFloat(p.paye || 0), 0)
              )}
            </span>
          </div>
        ) : null}
        <div className="p-6 flex flex-col gap-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Batch Status</span>
          <div className="flex items-center gap-2">
            <Badge className={`${getStatusColor(payrolls?.[0]?.status)} w-fit text-[9px] font-black tracking-widest`}>
              {payrolls?.[0]?.status?.toUpperCase() || "DRAFT"}
            </Badge>
            <span className="text-xs font-bold text-slate-500">
              {payrollData?.summary?.totalEmployees || payrolls.length || 0} staff
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-8 py-4 bg-white border-b border-muted flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Payment Basis:</span>
          <Select value={paymentBasisFilter} onValueChange={setPaymentBasisFilter}>
            <SelectTrigger className="h-10 w-[180px] border-muted bg-slate-50 text-xs font-bold rounded-xl focus:ring-slate-900">
              <SelectValue placeholder="Basis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All" className="text-xs font-bold">All Staff</SelectItem>
              <SelectItem value="Monthly" className="text-xs font-bold">Monthly</SelectItem>
              <SelectItem value="Non-Monthly" className="text-xs font-bold">Daily/Hourly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Find staff..."
            className="h-10 pl-9 border-muted bg-slate-50 text-xs font-medium focus-visible:ring-slate-900 rounded-xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="p-4">
        <CustomTable1
          data={filteredData}
          fields={columns}
          loading={loading}
          className="rounded-3xl border-none"
          message="No batch records found for this period."
        />
      </div>

      {/* ── Release Modal ── */}
      <Dialog open={showReleaseModal} onOpenChange={setShowReleaseModal}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-0 overflow-hidden border-none shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader
            className="p-6 text-white border-b"
            style={{ background: headerGradient }}
          >
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Release Payments
            </DialogTitle>
            <p className="text-white/80 text-xs mt-1 font-medium">
              Pay staff and post payroll to the general ledger
            </p>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Payment Mode
                </label>
                <Select value={modeOfPayment} onValueChange={setModeOfPayment}>
                  <SelectTrigger
                    className="bg-white border-slate-200 focus:ring-2"
                    style={{ "--tw-ring-color": primaryColor }}
                  >
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent className="z-[300]">
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Payment Date
                </label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-white border-slate-200 focus-visible:ring-2"
                  style={{ "--tw-ring-color": primaryColor }}
                />
              </div>
            </div>

            {["bank", "cheque"].includes(modeOfPayment) && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Source Bank Account
                </label>
                <Typeahead
                  ref={bankAccountTypeaheadRef}
                  id="bank-account-typeahead"
                  labelKey={formatBankLabel}
                  options={accountList}
                  placeholder="Select source bank..."
                  onChange={(selectedItems) => {
                    setBankAccount(
                      selectedItems && selectedItems.length > 0
                        ? selectedItems[0]
                        : null
                    );
                  }}
                  selected={bankAccount ? [bankAccount] : []}
                  clearButton
                  allowNew={false}
                  renderMenuItemChildren={(option) => (
                    <div className="py-1">
                      <div className="font-semibold text-slate-800">
                        {formatBankLabel(option)}
                      </div>
                      {option.head ? (
                        <small className="text-slate-500 text-xs font-mono">
                          GL Head: {option.head}
                        </small>
                      ) : null}
                    </div>
                  )}
                  inputProps={{
                    style: {
                      width: "100%",
                      height: "2.5rem",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      border: `1px solid ${primaryColor}40`,
                      borderRadius: "0.5rem",
                      backgroundColor: "#fff",
                      outlineColor: primaryColor,
                    },
                  }}
                  positionFixed={true}
                />
              </div>
            )}

            {modeOfPayment === "cash" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cash Account Head
                </label>
                <Typeahead
                  ref={cashAccountTypeaheadRef}
                  id="cash-account-typeahead"
                  labelKey={(option) =>
                    `${option.head || ""} - ${option.description || option.name || "Cash"}`
                  }
                  options={headList}
                  placeholder="Select cash on hand item..."
                  onChange={(selectedItems) => {
                    setAccountHead(
                      selectedItems && selectedItems.length > 0
                        ? selectedItems[0]
                        : null
                    );
                  }}
                  selected={accountHead ? [accountHead] : []}
                  clearButton
                  allowNew={false}
                  renderMenuItemChildren={(option) => (
                    <div className="py-1">
                      <div className="font-semibold text-slate-800">
                        {option.head} {option.description}
                      </div>
                    </div>
                  )}
                  inputProps={{
                    style: {
                      width: "100%",
                      height: "2.5rem",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      border: `1px solid ${primaryColor}40`,
                      borderRadius: "0.5rem",
                      backgroundColor: "#fff",
                      outlineColor: primaryColor,
                    },
                  }}
                  positionFixed={true}
                />
              </div>
            )}

            {modeOfPayment === "cheque" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Cheque Number
                </label>
                <Input
                  placeholder="Enter cheque number"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="bg-white border-slate-200 focus-visible:ring-2"
                  style={{ "--tw-ring-color": primaryColor }}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Narration / Remark
              </label>
              <textarea
                className="w-full min-h-[80px] p-3 text-sm rounded-lg border border-slate-200 outline-none resize-none focus:ring-2"
                style={{ "--tw-ring-color": primaryColor }}
                placeholder="Enter payment narration..."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
            </div>

            {/* Accounting Treatment preview */}
            <div
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: `${primaryColor}30`,
                backgroundColor: `${primaryColor}08`,
              }}
            >
              <button
                type="button"
                onClick={() => setShowAccountingTreatment((v) => !v)}
                className="w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-white/40 transition-colors"
              >
                <div className="min-w-0">
                  <p
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: primaryColor }}
                  >
                    Accounting Treatment
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Ledger entries that will post on release
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    showAccountingTreatment ? "rotate-180" : ""
                  }`}
                  style={{ color: primaryColor }}
                />
              </button>

              {showAccountingTreatment && (
                <div className="px-3.5 pb-3.5">
                  {releaseAccountingPreview.length === 0 ? (
                    <p className="text-xs text-slate-500 bg-white rounded-lg border border-slate-100 px-3 py-3">
                      No processed payroll amounts to post yet.
                    </p>
                  ) : (
                    <div className="bg-white rounded-lg border border-slate-100 overflow-hidden text-sm">
                      <div
                        className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${primaryColor}12`,
                          color: primaryColor,
                        }}
                      >
                        <span>Account</span>
                        <span className="w-24 text-right">Debit</span>
                        <span className="w-24 text-right">Credit</span>
                      </div>
                      {releaseAccountingPreview.map((row, idx) => (
                        <div
                          key={`${row.account}-${idx}`}
                          className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2.5 border-b border-slate-50 items-center last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-xs truncate">
                              {row.side} · {row.account}
                            </p>
                            {row.code && row.code !== "—" ? (
                              <p className="text-[10px] text-slate-500 font-mono truncate">
                                {row.code}
                              </p>
                            ) : null}
                          </div>
                          <span className="w-24 text-right font-bold text-slate-900 text-xs">
                            {row.side === "Dr" ? formatCurrency(row.amount) : "—"}
                          </span>
                          <span className="w-24 text-right font-bold text-slate-900 text-xs">
                            {row.side === "Cr" ? formatCurrency(row.amount) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 py-6 rounded-xl border-slate-200 hover:bg-slate-50"
                onClick={() => setShowReleaseModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 py-6 rounded-xl text-white hover:opacity-90 shadow-lg"
                style={brandButtonStyle}
                onClick={markAsPaid}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Release {formatCurrency(batchNetPay)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Download Schedule Modal ── */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-xl">
          <DialogHeader
            className="p-6 text-white border-b"
            style={{ background: headerGradient }}
          >
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Download className="w-5 h-5" />
              Download Payment Schedule
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-500">
              Payment schedule for <span className="font-bold text-slate-800">{monthLabel} {selectedYear}</span> — {payrolls.length} employees.
            </p>

            {lastReleasedTemplate ? (
              // Bank has configured template
              <div
                className="rounded-xl border p-4 flex flex-col gap-3"
                style={{
                  borderColor: `${primaryColor}30`,
                  backgroundColor: `${primaryColor}10`,
                }}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 shrink-0 mt-0.5" style={{ color: primaryColor }} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Bank template detected</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Your bank&apos;s payment template will be populated with payroll data and downloaded as an Excel file ready to send.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => downloadTemplateSchedule(lastReleasedTemplate)}
                  className="w-full text-white rounded-xl h-11 font-bold hover:opacity-90"
                  style={brandButtonStyle}
                >
                  <Download className="size-4 mr-2" /> Download Populated Template
                </Button>
              </div>
            ) : (
              // No template configured for this bank
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">No bank template configured</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      The selected bank does not have a custom payment template. You can add one in Bank Setup, or download the standard schedule below.
                    </p>
                    <a
                      href="/admin/bank-setup"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-bold hover:underline"
                      style={{ color: primaryColor }}
                    >
                      → Go to Bank Setup to add a template
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Always available: default simple schedule */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
              <div>
                <p className="text-xs font-bold text-slate-700">Standard Payment Schedule</p>
                <p className="text-xs text-slate-500 mt-0.5">Includes: Employee Name · Account Number · Bank · Bank Code · Net Pay</p>
              </div>
              <Button
                variant="outline"
                onClick={downloadDefaultSchedule}
                className="w-full rounded-xl h-10 font-bold text-xs gap-2 hover:opacity-90"
                style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
              >
                <Download className="size-3.5" /> Download Default Schedule
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" className="rounded-xl h-10 px-6 font-bold text-sm" onClick={() => setShowScheduleModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Payslip Modal ── */}
      <Dialog open={showPayslipModal} onOpenChange={setShowPayslipModal}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-none shadow-2xl rounded-[2.5rem] h-[90vh]">
          <DialogHeader
            className="p-8 text-white flex flex-row items-center justify-between space-y-0 relative"
            style={{ background: headerGradient }}
          >
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              <Building className="size-32" />
            </div>
            <div className="relative z-10">
              <DialogTitle className="text-xl font-black tracking-tight italic uppercase">
                Staff Remittance Slip
              </DialogTitle>
            </div>
            <div className="text-right relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1">
                Corporate Identifier
              </p>
              <p className="text-lg font-black italic tabular-nums">
                {selectedPayslip?.employee?.employeeId}
              </p>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-slate-100 p-8 h-[calc(90vh-180px)] overflow-y-auto">
            {selectedPayslip && (
              <div className="mx-auto max-w-[210mm] shadow-2xl bg-white ring-1 ring-slate-200">
                <PayslipPDF
                  ref={payslipRef}
                  data={selectedPayslip}
                  employee={selectedPayslip.employee}
                  business={activeBusiness}
                  businessName={
                    activeBusiness?.business_name || activeBusiness?.name
                  }
                  primaryColor={primaryColor}
                  showPaye={payeEnabled}
                />
              </div>
            )}
          </div>
          <div className="p-6 bg-white border-t flex justify-between items-center gap-6 rounded-b-[2.5rem]">
            <Button
              variant="outline"
              onClick={() => setShowPayslipModal(false)}
              className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] border-slate-200 hover:bg-slate-50"
            >
              <ArrowLeft className="size-4 mr-3" /> Back
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-[10px] border-slate-200 bg-white"
                style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
                onClick={handlePrint}
              >
                <Printer className="size-4 mr-3" /> Print
              </Button>
              <Button
                className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 shadow-xl"
                style={brandButtonStyle}
              >
                <Download className="size-4 mr-3" /> Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Attendance Modal ── */}
      <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-6 bg-slate-50 border-b flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-4">
              <div
                className="size-12 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}25` }}
              >
                <CalendarCheck className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight">Attendance Log</DialogTitle>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedAttendanceEmployee?.firstName} {selectedAttendanceEmployee?.lastName} • {monthLabel} {selectedYear}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white border-slate-200 text-[10px] font-black uppercase tracking-widest px-3 py-1">
              Audit Record
            </Badge>
          </DialogHeader>
          
          <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {attendanceLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 border border-slate-100 rounded-xl animate-pulse">
                    <div className="size-10 rounded-lg bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 rounded w-1/3" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Date</span>
                  <span>Status</span>
                  <span>Clock In</span>
                  <span className="text-right">Clock Out</span>
                </div>
                {(() => {
                  const daysInMonth = moment(`${selectedYear}-${selectedMonth}`, "YYYY-M").daysInMonth();
                  const recordsMap = attendanceRecords.reduce((acc, rec) => {
                    const dateKey = moment(rec.date).format("YYYY-MM-DD");
                    acc[dateKey] = rec;
                    return acc;
                  }, {});

                  return Array.from({ length: daysInMonth }, (_, i) => {
                    const date = moment(`${selectedYear}-${selectedMonth}-${i + 1}`, "YYYY-M-D");
                    const dateKey = date.format("YYYY-MM-DD");
                    const record = recordsMap[dateKey];
                    const isWeekend = date.day() === 0 || date.day() === 6;
                    const status = record?.status || (isWeekend ? "Weekend" : "Absent");

                    return (
                      <div key={dateKey} className={cn(
                        "grid grid-cols-4 items-center px-4 py-4 border border-slate-100 rounded-2xl transition-colors group",
                        record ? "bg-slate-50/30 hover:bg-slate-50" : "bg-white opacity-60"
                      )}>
                        <span className="text-sm font-bold text-slate-700">
                          {date.format("MMM DD, ddd")}
                        </span>
                        <div>
                          <Badge className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2",
                            status === "Present" ? "bg-emerald-500/10 text-emerald-600 border-none" :
                            status === "Absent" ? "bg-rose-500/10 text-rose-600 border-none" :
                            status === "Late" ? "bg-amber-500/10 text-amber-600 border-none" :
                            status === "Weekend" ? "bg-slate-100 text-slate-400 border-none" :
                            "bg-slate-100 text-slate-500 border-none"
                          )}>
                            {status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {record && <Clock4 className="size-3 text-slate-400" />}
                          <span className="text-xs font-mono font-bold text-slate-600">
                            {record?.clockInTime || "--:--"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-600">
                            {record?.clockOutTime || "--:--"}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
          
          <div className="p-6 bg-slate-50 border-t flex justify-end">
            <Button 
              className="h-11 px-8 rounded-xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform"
              onClick={() => setShowAttendanceModal(false)}
            >
              Close Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollBatchDetails;
