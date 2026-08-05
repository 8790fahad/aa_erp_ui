import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { _fetchApi, apiURL } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  Calendar, Users, DollarSign, Download, Eye,
  RefreshCw, TrendingUp, CreditCard,
} from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PayrollBatchDetails from "./PayrollBatchDetails";

const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount || 0);

const getStatusColor = (status) => {
  switch (status) {
    case "Paid":      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Processed": return "bg-[color:var(--app-primary)]/10 text-[color:var(--app-primary)] border-[color:var(--app-primary)]/30";
    default:          return "bg-amber-50 text-amber-700 border-amber-200";
  }
};

/**
 * mode: "history"  — view ledger / process drafts (no payment release)
 * mode: "payment"  — release payments & download schedules
 */
const PayrollHistory = ({ mode = "history" }) => {
  const isPaymentMode = mode === "payment";
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId;
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const secondaryColor =
    activeBusiness?.secondary_color &&
    String(activeBusiness.secondary_color).toLowerCase() !== "#ffffff"
      ? activeBusiness.secondary_color
      : primaryColor;
  const appColorStyle = {
    ["--app-primary"]: primaryColor,
    ["--app-secondary"]: secondaryColor,
  };

  const [batches, setBatches]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null); // { month, year }
  const [batchData, setBatchData]       = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (facilityId) fetchBatches();
  }, [facilityId]);

  const fetchBatches = () => {
    setLoading(true);
    _fetchApi(
      `/api/hr/payroll/batches?facilityId=${facilityId}`,
      (data) => {
        if (data.success) setBatches(data.data);
        else toast.error("Error fetching payroll history");
        setLoading(false);
      },
      () => { toast.error("Failed to load payroll history"); setLoading(false); }
    );
  };

  const loadBatchDetails = (month, year) => {
    setDetailsLoading(true);
    _fetchApi(
      `/api/hr/payroll/${month}/${year}?facilityId=${facilityId}`,
      (data) => {
        if (data.success) {
          setSelectedBatch({ month, year });
          setBatchData(data.data);
        } else {
          toast.error("Failed to load batch details");
        }
        setDetailsLoading(false);
      },
      () => { toast.error("Failed to load batch details"); setDetailsLoading(false); }
    );
  };

  // Called by PayrollBatchDetails after status changes
  const handleRefresh = (month, year) => {
    loadBatchDetails(month, year);
    fetchBatches();
  };

  const batchColumns = [
    {
      value: "period", title: "Payroll Period", custom: true,
      component: (item) => (
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Calendar className="size-4 text-muted-foreground shrink-0" />
          {months[item.month - 1]} {item.year}
        </div>
      ),
    },
    {
      value: "employees", title: "Staff", custom: true,
      component: (item) => (
        <div className="flex items-center gap-1.5 text-sm font-bold font-mono">
          <Users className="size-3.5 text-muted-foreground" /> {item.totalEmployees}
        </div>
      ),
    },
    {
      value: "gross", title: "Gross Pay", custom: true,
      component: (item) => (
        <span className="text-sm font-bold font-mono">{formatCurrency(item.totalGrossPay)}</span>
      ),
    },
    {
      value: "net", title: "Net Pay", custom: true,
      component: (item) => (
        <span className="text-sm font-black font-mono text-emerald-600">{formatCurrency(item.totalNetPay)}</span>
      ),
    },
    {
      value: "status", title: "Status", custom: true, className: "text-center",
      component: (item) => (
        <Badge variant="outline" className={`${getStatusColor(item.status)} text-[9px] font-black uppercase tracking-widest`}>
          {item.status || "Processed"}
        </Badge>
      ),
    },
    {
      value: "action", title: "", custom: true, className: "text-right",
      component: (item) => (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-bold gap-1.5 rounded-lg border-slate-200 hover:bg-slate-50"
          onClick={() => loadBatchDetails(item.month, item.year)}
        >
          <Eye className="size-3.5" /> View Details
        </Button>
      ),
    },
  ];

  // ── Batch Details View (reusable component) ─────────────────────────────
  if (selectedBatch) {
    return (
      <div
        className="flex flex-col gap-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500"
        style={appColorStyle}
      >
        <PayrollBatchDetails
          payrollData={batchData}
          selectedMonth={selectedBatch.month}
          selectedYear={selectedBatch.year}
          onBack={() => { setSelectedBatch(null); setBatchData(null); }}
          onRefresh={handleRefresh}
          allowPayment={isPaymentMode}
        />
      </div>
    );
  }

  // ── Batches List View ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 pb-20" style={appColorStyle}>
      <div className="bg-white border border-muted rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-8 py-3 border-b border-muted bg-slate-50/40">
          <div>
            <h2 className="text-lg font-black tracking-tight text-foreground">
              {isPaymentMode ? "Payroll Payment" : "Payroll History"}
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              {isPaymentMode
                ? "Release staff payments and post payroll to the ledger."
                : "All processed payroll cycles for your organization."}
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            className="gap-2 text-xs font-bold h-9 rounded-xl border-slate-200"
            onClick={fetchBatches}
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
        <div className="p-4">
          <CustomTable1
            data={batches}
            fields={batchColumns}
            loading={loading}
            message="No payroll history found."
          />
        </div>
      </div>
    </div>
  );
};

export default PayrollHistory;
