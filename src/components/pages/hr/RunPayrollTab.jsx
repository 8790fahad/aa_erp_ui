import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import { useSelector } from "react-redux";
import {
  Users, Calendar, Download, AlertCircle, Play, Filter,
  RefreshCw, TrendingUp, CreditCard, DollarSign, ArrowRight
} from "lucide-react";
import CustomButton from "@/common/Custom/CustomButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { apiURL } from "@/redux/actions/api";
import { Alert } from "@/components/ui/alert";
import PayrollBatchDetails from "./PayrollBatchDetails";

const months = [
  { value: 1, label: "January" },  { value: 2, label: "February" },
  { value: 3, label: "March" },    { value: 4, label: "April" },
  { value: 5, label: "May" },      { value: 6, label: "June" },
  { value: 7, label: "July" },     { value: 8, label: "August" },
  { value: 9, label: "September" },{ value: 10, label: "October" },
  { value: 11, label: "November" },{ value: 12, label: "December" },
];

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount || 0);

const PayrollRun = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const secondaryColor =
    activeBusiness?.secondary_color &&
    String(activeBusiness.secondary_color).toLowerCase() !== "#ffffff"
      ? activeBusiness.secondary_color
      : primaryColor;

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());
  const [payrollData, setPayrollData]     = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  // 'setup' shows setup controls; 'ledger' shows PayrollBatchDetails
  const [viewMode, setViewMode]           = useState("setup");

  const runPayroll = async () => {
    if (!selectedMonth) { toast.error("Please select a month"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiURL}/api/hr/payroll/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: localStorage.getItem("@@__token") || "" },
        body: JSON.stringify({
          month: parseInt(selectedMonth),
          year: selectedYear,
          facilityId,
          userId: user?.id,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setPayrollData(data.data);
        setViewMode("ledger");
        toast.success("Payroll initialized as Draft!");
      } else {
        setError(data.message || "Error running payroll");
        toast.error(data.message || "Error running payroll");
      }
    } catch {
      setError("Error running payroll");
      toast.error("Error running payroll");
    } finally {
      setLoading(false);
    }
  };

  const refreshPayrollData = async (month, year) => {
    try {
      const res  = await fetch(`${apiURL}/api/hr/payroll/${month}/${year}?facilityId=${facilityId}`);
      const data = await res.json();
      if (data.success) setPayrollData(data.data);
    } catch {}
  };

  // Summary stat cards (shown before ledger)
  const statCards = payrollData ? [
    {
      label: "Staff", value: payrollData.totalEmployees,
      icon: <Users className="size-5 text-slate-500" />, bg: "bg-slate-100",
    },
    {
      label: "Gross", value: formatCurrency(payrollData.totalGrossPay),
      icon: <TrendingUp className="size-5 text-slate-500" />, bg: "bg-slate-100",
    },
    {
      label: "Deductions", value: formatCurrency(payrollData.totalDeductions),
      icon: <CreditCard className="size-5 text-rose-500" />, bg: "bg-rose-50", valueClass: "text-rose-600",
    },
    {
      label: "Net Pay", value: formatCurrency(payrollData.totalNetPay),
      icon: <DollarSign className="size-5 text-white" />, bg: "bg-emerald-600", cardClass: "bg-emerald-600 text-white shadow-lg shadow-emerald-200", labelClass: "text-white/70", valueClass: "text-white",
    },
  ] : [];

  return (
    <div
      className="flex flex-col gap-8 pb-32"
      style={{
        ["--app-primary"]: primaryColor,
        ["--app-secondary"]: secondaryColor,
      }}
    >
      {/* Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tight text-foreground">Payroll Processing</h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest ml-0.5">
            {months.find(m => m.value === selectedMonth)?.label} {selectedYear} Cycle
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60">
          <div className="flex flex-col px-2">
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="h-8 w-[120px] border-none bg-transparent shadow-none px-0 font-bold focus:ring-0 text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator orientation="vertical" className="h-6 bg-slate-200" />
          <div className="flex flex-col px-2">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-8 w-[80px] border-none bg-transparent shadow-none px-0 font-bold focus:ring-0 text-xs">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="h-9 px-4 rounded-lg text-white text-xs font-bold transition-all shadow-sm group hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
            onClick={runPayroll}
            disabled={loading}
          >
            {loading ? <RefreshCw className="size-3.5 animate-spin mr-2" /> : <Play className="size-3.5 mr-2 fill-current" />}
            Run Payroll
          </Button>
        </div>
      </div>

      {/* Post-run summary cards + CTA */}
      {payrollData && viewMode === "setup" && (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((s, i) => (
              <div key={i} className={`${s.cardClass || "bg-white border border-slate-200 shadow-sm"} rounded-2xl px-3 py-4 flex items-center gap-4 hover:shadow-md transition-all group`}>
                <div className={`size-11 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${s.labelClass || "text-muted-foreground"}`}>{s.label}</p>
                  <p className={`text-base font-black font-mono leading-none truncate ${s.valueClass || "text-slate-900"}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 flex items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute right-6 top-0 bottom-0 flex items-center opacity-[0.04] pointer-events-none">
              <RefreshCw className="size-24 animate-[spin_40s_linear_infinite]" />
            </div>
            <div className="relative z-10">
              <h2 className="text-white font-black text-lg tracking-tight italic mb-1">Batch Ready for Verification</h2>
              <p className="text-slate-400 text-xs font-medium">Review the individual details in the itemized ledger.</p>
            </div>
            <Button
              className="h-11 px-8 rounded-xl bg-[color:var(--app-primary)] hover:bg-[color:var(--app-primary)] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-black/20 transition-all active:scale-95"
              onClick={() => setViewMode("ledger")}
            >
              View Itemized Ledger
            </Button>
          </div>
        </div>
      )}

      {/* Full Ledger View (reusable component) */}
      {payrollData && viewMode === "ledger" && (
        <PayrollBatchDetails
          payrollData={payrollData}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onBack={() => setViewMode("setup")}
          onRefresh={refreshPayrollData}
        />
      )}

      {error && (
        <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-800 rounded-3xl p-6 mt-4">
          <div className="flex gap-4">
            <AlertCircle className="size-5 text-rose-600" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold">Calculation Integrity Failure</h3>
              <p className="text-rose-700 text-xs font-medium opacity-80">{error}</p>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
};

export default PayrollRun;
