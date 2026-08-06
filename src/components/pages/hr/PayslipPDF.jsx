import React, { forwardRef } from "react";
import { useSelector } from "react-redux";
import { formatCurrency } from "../../../utils/numberUtils";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";

const PayslipPDF = forwardRef(
  (
    {
      data,
      employee,
      businessName,
      primaryColor: primaryColorProp,
      business: businessProp,
      showPaye = true,
    },
    ref
  ) => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const business = businessProp || activeBusiness;
  const primaryColor =
    primaryColorProp || business?.primary_color || "#4267B2";
  const payeEnabled =
    showPaye &&
    business?.paye_auto_calculation !== false &&
    business?.paye_auto_calculation !== 0 &&
    business?.paye_auto_calculation !== "0";
  const secondaryColor = business?.secondary_color;
  const gradientEnd =
    secondaryColor &&
    String(secondaryColor).toLowerCase() !== "#ffffff" &&
    String(secondaryColor).toLowerCase() !== "#fff"
      ? secondaryColor
      : primaryColor;
  const headerGradient = `linear-gradient(to right, ${primaryColor}, ${gradientEnd})`;

  if (!data || !employee) return null;

  const safeParse = (val) => {
    if (!val) return {};
    try {
      let parsed = typeof val === "string" ? JSON.parse(val) : val;
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed || {};
    } catch (e) {
      console.error("Failed to parse field:", val, e);
      return {};
    }
  };

  const cleanDetails = (raw) => {
    const parsed = safeParse(raw);
    const cleaned = {};
    Object.entries(parsed || {}).forEach(([name, amount]) => {
      if (!name || /^\d+$/.test(String(name))) return;
      const n = parseFloat(amount);
      if (!Number.isFinite(n) || n === 0) return;
      cleaned[name] = n;
    });
    return cleaned;
  };

  const allowanceDetails = cleanDetails(data.allowance_details);
  const deductionDetails = cleanDetails(data.deduction_details);
  const bonusDetails = cleanDetails(data.bonus_details);

  const sumMap = (map) =>
    Object.values(map).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const basicSalary = parseFloat(data.basicSalary) || 0;
  const overtime = parseFloat(data.overtime) || 0;
  const paye = payeEnabled ? parseFloat(data.paye) || 0 : 0;
  const pension = payeEnabled ? parseFloat(data.pension) || 0 : 0;
  const loanRepayment = parseFloat(data.loanRepayment) || 0;

  const allowancesTotal = sumMap(allowanceDetails);
  const bonusesTotal = sumMap(bonusDetails);
  const otherDeductionsTotal = sumMap(deductionDetails);

  // Prefer live totals from line items so summary matches the breakdown
  // (stored grossPay/netPay/deductions can be stale or zero after partial updates)
  const grossPay =
    basicSalary +
    (allowancesTotal || parseFloat(data.allowances) || 0) +
    (bonusesTotal || parseFloat(data.bonuses) || 0) +
    overtime;

  const totalDeductions = paye + pension + otherDeductionsTotal + loanRepayment;

  const netPay = Math.max(0, grossPay - totalDeductions);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName =
    typeof data.month === "number" ? monthNames[data.month - 1] : data.month;

  const companyForHeader = {
    ...business,
    business_name:
      businessName || business?.business_name || business?.name || "Company",
  };

  return (
    <div
      ref={ref}
      className="bg-white p-4 sm:p-6 text-slate-900 font-sans printable-area"
    >
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          .printable-area {
            padding: 10mm !important;
            width: 210mm;
            min-height: 297mm;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <BusinessDocumentHeader
        business={companyForHeader}
        title="EMPLOYEE PAYSLIP"
        numberLabel={employee.employeeId || "N/A"}
        extraLine={`${monthName} ${data.year}`}
        date={data.processedAt || data.paidAt || new Date()}
      />

      {/* Employee Info Grid */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-2 mb-8 mt-4 text-xs">
        <div className="flex border-b border-slate-200 py-1">
          <span className="w-32 font-bold uppercase text-[10px] text-slate-500">
            Employee Name:
          </span>
          <span className="font-black uppercase">
            {employee.firstName} {employee.lastName}
          </span>
        </div>
        <div className="flex border-b border-slate-200 py-1">
          <span className="w-32 font-bold uppercase text-[10px] text-slate-500">
            Personnel ID:
          </span>
          <span className="font-black uppercase">
            {employee.employeeId || "N/A"}
          </span>
        </div>
        <div className="flex border-b border-slate-200 py-1">
          <span className="w-32 font-bold uppercase text-[10px] text-slate-500">
            Department:
          </span>
          <span className="font-black uppercase">
            {employee.department?.departmentName || "N/A"}
          </span>
        </div>
        <div className="flex border-b border-slate-200 py-1">
          <span className="w-32 font-bold uppercase text-[10px] text-slate-500">
            Designation:
          </span>
          <span className="font-black uppercase">
            {employee.designation || "N/A"}
          </span>
        </div>
      </div>

      {/* Bank Info */}
      <div className="mb-8">
        <h3
          className="text-[10px] font-black uppercase tracking-widest mb-3 border-b pb-1"
          style={{ borderColor: primaryColor, color: primaryColor }}
        >
          Bank Account Details
        </h3>
        <div className="space-y-1 text-xs max-w-md">
          <div className="flex justify-between gap-4">
            <span className="font-bold text-slate-500 uppercase text-[9px]">
              Bank:
            </span>
            <span className="font-black">{employee.bankName || "N/A"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="font-bold text-slate-500 uppercase text-[9px]">
              Account Number:
            </span>
            <span className="font-black font-mono">
              {employee.bankAccount || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Tables */}
      <div className="grid grid-cols-2 gap-12 mb-8">
        {/* Earnings */}
        <div className="flex flex-col">
          <h3
            className="text-[10px] font-black uppercase tracking-widest mb-3 text-white px-3 py-1.5 text-center rounded-md"
            style={{ background: headerGradient }}
          >
            Earnings Breakdown
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                <th className="text-left py-1 uppercase tracking-tighter">
                  Description
                </th>
                <th className="text-right py-1 uppercase tracking-tighter">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="font-bold">
                <td className="py-2">Basic Salary</td>
                <td className="text-right">
                  {formatCurrency(basicSalary)}
                </td>
              </tr>
              {Object.entries(allowanceDetails).map(([name, amount]) => (
                <tr key={name}>
                  <td className="py-1 text-slate-600">{name}</td>
                  <td className="text-right">{formatCurrency(amount)}</td>
                </tr>
              ))}
              {Object.entries(bonusDetails).map(([name, amount]) => (
                <tr key={name}>
                  <td className="py-1 font-semibold" style={{ color: primaryColor }}>
                    {name} (Bonus)
                  </td>
                  <td
                    className="text-right font-semibold"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className="border-t-2 font-black"
                style={{
                  borderColor: primaryColor,
                  backgroundColor: `${primaryColor}10`,
                }}
              >
                <td className="py-2 uppercase tracking-tighter">
                  Total Earnings
                </td>
                <td className="text-right">{formatCurrency(grossPay)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Deductions */}
        <div className="flex flex-col">
          <h3
            className="text-[10px] font-black uppercase tracking-widest mb-3 text-white px-3 py-1.5 text-center rounded-md"
            style={{ background: headerGradient }}
          >
            Deductions Breakdown
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                <th className="text-left py-1 uppercase tracking-tighter">
                  Description
                </th>
                <th className="text-right py-1 uppercase tracking-tighter">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paye > 0 && (
                <tr className="font-bold" style={{ color: primaryColor }}>
                  <td className="py-2">PAYE TAX</td>
                  <td className="text-right">{formatCurrency(paye)}</td>
                </tr>
              )}
              {pension > 0 && (
                <tr className="font-bold text-slate-800">
                  <td className="py-2">PENSION</td>
                  <td className="text-right">
                    {formatCurrency(pension)}
                  </td>
                </tr>
              )}
              {Object.entries(deductionDetails).map(([name, amount]) => (
                <tr key={name}>
                  <td className="py-1 text-slate-600">{name}</td>
                  <td className="text-right">{formatCurrency(amount)}</td>
                </tr>
              ))}
              {loanRepayment > 0 && (
                <tr>
                  <td className="py-1 uppercase font-bold text-slate-800">
                    Loan Repayment
                  </td>
                  <td className="text-right font-bold">
                    {formatCurrency(loanRepayment)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr
                className="border-t-2 font-black"
                style={{
                  borderColor: primaryColor,
                  backgroundColor: `${primaryColor}10`,
                }}
              >
                <td className="py-2 uppercase tracking-tighter">
                  Total Deductions
                </td>
                <td className="text-right">
                  {formatCurrency(totalDeductions)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary of Payments */}
      <div
        className="mb-12 border-2 p-4 rounded-xl relative overflow-hidden"
        style={{
          borderColor: `${primaryColor}50`,
          backgroundColor: `${primaryColor}08`,
        }}
      >
        <div
          className="absolute top-0 right-0 p-8 opacity-[0.06] pointer-events-none rotate-12"
          style={{ color: primaryColor }}
        >
          <h1 className="text-6xl font-black uppercase">CONFIRMED</h1>
        </div>
        <h3
          className="text-xs font-black uppercase tracking-[0.2em] mb-4 border-b pb-2"
          style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
        >
          Final Remittance Summary
        </h3>
        <div className="flex justify-between items-end">
          <div className="space-y-1 text-[10px] font-bold text-slate-500 uppercase">
            <div className="flex gap-4">
              <span className="w-32">Gross Monthly:</span>
              <span className="text-slate-900 font-black">
                {formatCurrency(grossPay)}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="w-32">Total Deductions:</span>
              <span className="font-black" style={{ color: primaryColor }}>
                -{formatCurrency(totalDeductions)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">
              Net Liquidity Injected
            </p>
            <p
              className="text-3xl font-black italic tracking-tighter"
              style={{ color: primaryColor }}
            >
              {formatCurrency(netPay)}
            </p>
          </div>
        </div>
      </div>

      {/* Standard footer */}
      <div className="mt-6 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
          This solution is powered by Nexifour Limited
        </p>
        <div className="flex items-center gap-2">
          <div className="size-7 rounded bg-slate-900 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-black text-white tracking-tight">
              AY
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-800">
            Alh. Ashiru Yanmusa
          </span>
        </div>
      </div>
    </div>
  );
  }
);

PayslipPDF.displayName = "PayslipPDF";

export default PayslipPDF;
