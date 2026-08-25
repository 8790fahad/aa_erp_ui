import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi, _putApi } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Banknote,
  User,
  MoreVertical,
  Filter,
  X,
  CreditCard,
  HandCoins,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  formatNumberWithCommas,
  parseFormattedNumber
} from "@/utils/numberUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAaBrandColors } from "@/lib/aaBrand";

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";
const labelClass = "text-xs font-medium text-slate-600";
const hintClass = "text-[11px] text-slate-400";
const sheetContentClass =
  "!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-lg [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100";
const sheetHeaderClass =
  "shrink-0 space-y-1 border-b border-white/10 bg-[var(--aa-navy,#1a2d5e)] px-5 py-4 pr-12 text-left";
const sheetFooterClass =
  "shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 flex flex-wrap justify-end gap-2";

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toYearMonth(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatAppliesFrom(dateVal) {
  const ym = toYearMonth(dateVal);
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

const emptyLoanForm = () => ({
  amount: "",
  purpose: "",
  repaymentMethod: "Salary Deduction",
  durationMonths: "1",
  startMonth: currentYearMonth(),
});

const LoanManagement = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId;
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    headerGradient: brandHeaderGradient,
    brandButtonStyle: brandBtn,
    appColorStyle: brandAppStyle,
  } = getAaBrandColors();
  const headerGradient = brandHeaderGradient;
  const brandButtonStyle = brandBtn;
  const appColorStyle = brandAppStyle;

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [chartAccounts, setChartAccounts] = useState([]);
  const [selectedReceivable, setSelectedReceivable] = useState(null);

  const [bankAccounts, setBankAccounts] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);

  // States for Modals
  const [viewLoanId, setViewLoanId] = useState(null);
  const [viewLoanData, setViewLoanData] = useState(null);
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [repaymentLoading, setRepaymentLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState(null);
  
  const [showApproveModal, setShowApproveModal] = useState(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [showAccountingTreatment, setShowAccountingTreatment] = useState(false);
  const [loanReferencePreview, setLoanReferencePreview] = useState("");
  const [loanReferenceLoading, setLoanReferenceLoading] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState({
    repaymentMethod: "Salary Deduction",
    durationMonths: "1",
    startMonth: currentYearMonth(),
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Payment state (request form + approve/repay modals)
  const [paymentMode, setPaymentMode] = useState("bank");
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedCash, setSelectedCash] = useState(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");

  const [formData, setFormData] = useState(emptyLoanForm);

  const resetPaymentSelection = () => {
    setPaymentMode("bank");
    setSelectedBank(null);
    setSelectedCash(null);
    setPaymentRef("");
    setChequeNumber("");
  };

  const resolvePaymentHeads = () => {
    const bankHead =
      selectedBank?.account_code ||
      selectedBank?.head ||
      selectedBank?.code ||
      null;
    const cashHead =
      selectedCash?.head || selectedCash?.code || selectedCash?.account_code || null;
    return { bankHead, cashHead };
  };

  const applyLoanPaymentSelection = (loan) => {
    const mode = loan?.paymentMode || "bank";
    setPaymentMode(mode);
    setChequeNumber(loan?.chequeNumber || "");
    if (mode === "cash") {
      const cash =
        cashAccounts.find(
          (a) =>
            a.head === loan.cashHead ||
            a.code === loan.cashHead ||
            a.account_code === loan.cashHead
        ) || null;
      setSelectedCash(cash);
      setSelectedBank(null);
    } else {
      const bank =
        bankAccounts.find(
          (a) =>
            a.account_code === loan.bankHead ||
            a.head === loan.bankHead ||
            a.code === loan.bankHead
        ) || null;
      setSelectedBank(bank);
      setSelectedCash(null);
    }
  };

  useEffect(() => {
    if (facilityId) {
      fetchLoans();
      fetchEmployees();
      fetchChartAccounts();
      fetchBankAccounts();
      fetchCashAccounts();
    }
  }, [facilityId]);

  useEffect(() => {
    if (!showForm || !facilityId || editMode) {
      if (!showForm) setLoanReferencePreview("");
      return;
    }
    setLoanReferenceLoading(true);
    _fetchApi(
      `/api/hr/loans/next-reference?facilityId=${facilityId}`,
      (data) => {
        if (data.success) setLoanReferencePreview(data.data?.reference || "");
        setLoanReferenceLoading(false);
      },
      () => {
        setLoanReferencePreview("");
        setLoanReferenceLoading(false);
      },
    );
  }, [showForm, facilityId, editMode]);

  const fetchLoans = () => {
    setLoading(true);
    _fetchApi(
      `/api/hr/loans?facilityId=${facilityId}`,
      (data) => {
        if (data.success) setLoans(data.data);
        setLoading(false);
      },
      (error) => {
        toast.error("Error fetching loans");
        setLoading(false);
      }
    );
  };

  const fetchEmployees = () => {
    _fetchApi(
      `/api/hr/employees?facilityId=${facilityId}&limit=1000`,
      (data) => {
        if (data.success) setEmployees(data.data.employees || []);
      },
      (error) => console.error("Error fetching employees:", error)
    );
  };

  const fetchChartAccounts = () => {
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { facilityId },
      (data) => {
        if (data.success) setChartAccounts(data.results || []);
      },
      (error) => console.error("Error fetching chart of accounts:", error)
    );
  };

  const fetchBankAccounts = () => {
    _fetchApi(
      `/api/get/bank-accounts?facilityId=${facilityId}`,
      (data) => {
        if (data.success) setBankAccounts(data.results || []);
      },
      (error) => console.error("Error fetching bank accounts:", error)
    );
  };

  const fetchCashAccounts = () => {
    _postApi(
      `/inventory/product-list?query_type=cash`,
      { facilityId },
      (data) => {
        if (data.success) setCashAccounts(data.results || []);
      },
      (error) => console.error("Error fetching cash accounts:", error)
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount || 0);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveLoan = (e) => {
    e.preventDefault();
    if (!selectedEmployee) return toast.error("Please select an employee");
    const receivableHead =
      selectedReceivable?.head ||
      selectedReceivable?.code ||
      selectedReceivable?.account_code ||
      null;
    if (!receivableHead) {
      return toast.error("Select the loan receivable account");
    }

    const { bankHead, cashHead } = resolvePaymentHeads();
    if (paymentMode === "cash" && !cashHead) {
      return toast.error("Select the cash account to pay from");
    }
    if ((paymentMode === "bank" || paymentMode === "cheque") && !bankHead) {
      return toast.error("Select the bank account to pay from");
    }
    if (paymentMode === "cheque" && !String(chequeNumber || "").trim()) {
      return toast.error("Enter the cheque number");
    }
    if (!/^\d{4}-\d{2}$/.test(String(formData.startMonth || ""))) {
      return toast.error("Select the month when the loan starts applying");
    }

    setSubmitting(true);
    const requestData = {
      ...formData,
      purpose: formData.purpose || undefined,
      amount: parseFloat(formData.amount),
      durationMonths: parseInt(formData.durationMonths),
      startMonth: formData.startMonth,
      employeeId: selectedEmployee.id,
      receivableHead,
      paymentMode,
      bankHead: paymentMode === "cash" ? null : bankHead,
      cashHead: paymentMode === "cash" ? cashHead : null,
      chequeNumber: paymentMode === "cheque" ? String(chequeNumber).trim() : null,
      postDisbursement: !editMode,
      facilityId,
      userId: user?.id
    };

    if (editMode) {
      _putApi(
        `/api/hr/loans/${editingLoanId}`,
        requestData,
        (data) => {
          if (data.success) {
            toast.success("Loan request updated");
            handleCloseForm();
            fetchLoans();
          } else {
            toast.error(data.message || "Error updating loan");
          }
          setSubmitting(false);
        },
        (error) => {
          toast.error("Network error updating loan");
          setSubmitting(false);
        }
      );
    } else {
      _postApi(
        "/api/hr/loans",
        requestData,
        (data) => {
          if (data.success) {
            toast.success(data.message || "Loan disbursed and posted to ledger");
            handleCloseForm();
            fetchLoans();
          } else {
            toast.error(data.message || "Error recording loan");
          }
          setSubmitting(false);
        },
        (error) => {
          toast.error("Network error saving loan");
          setSubmitting(false);
        }
      );
    }
  };

  const handleEditLoan = (loan) => {
    setEditMode(true);
    setEditingLoanId(loan.id);
    setFormData({
      amount: loan.amount.toString(),
      purpose: loan.purpose,
      repaymentMethod: loan.repaymentMethod || "Salary Deduction",
      durationMonths: loan.durationMonths.toString(),
      startMonth: toYearMonth(loan.startDate) || currentYearMonth(),
    });
    const emp = employees.find(e => e.id === loan.employeeId);
    setSelectedEmployee(emp || null);
    const head = loan.receivableHead || loan.setup?.receivableHead;
    const account =
      chartAccounts.find(
        (a) => a.head === head || a.code === head || a.account_code === head,
      ) || (head ? { head, description: head } : null);
    setSelectedReceivable(account);
    applyLoanPaymentSelection(loan);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditMode(false);
    setEditingLoanId(null);
    setFormData(emptyLoanForm());
    setSelectedEmployee(null);
    setSelectedReceivable(null);
    resetPaymentSelection();
  };

  const openApproveModal = (loan) => {
    applyLoanPaymentSelection(loan);
    setPaymentRef("");
    setChequeNumber("");
    setShowApproveModal(loan);
  };

  const handleApproveLoan = (e) => {
    e.preventDefault();
    const { bankHead, cashHead } = resolvePaymentHeads();
    const paymentHead = paymentMode === "cash" ? cashHead : bankHead;
    if (!paymentHead) return toast.error(`Please select a ${paymentMode} account`);
    if (paymentMode === "cheque" && !String(chequeNumber || "").trim()) {
      return toast.error("Enter the cheque number");
    }

    setApprovalLoading(true);
    _putApi(
      `/api/hr/loans/${showApproveModal.id}/status`,
      { 
        status: "Approved", 
        paymentMode,
        bankHead: (paymentMode === 'bank' || paymentMode === 'cheque') ? paymentHead : null,
        cashHead: paymentMode === 'cash' ? paymentHead : null,
        reference: paymentRef,
        chequeNumber: paymentMode === 'cheque' ? chequeNumber : null,
        startMonth:
          toYearMonth(showApproveModal.startDate) || currentYearMonth(),
        facilityId, 
        userId: user?.id 
      },
      (data) => {
        if (data.success) {
          toast.success("Loan approved and disbursement recorded");
          setShowApproveModal(null);
          resetPaymentSelection();
          fetchLoans();
        } else {
          toast.error(data.message || "Error approving loan");
        }
        setApprovalLoading(false);
      },
      (error) => {
        toast.error("Error approving loan");
        setApprovalLoading(false);
      }
    );
  };

  const handleRecordRepayment = (e) => {
    e.preventDefault();
    const amount = parseFloat(repaymentAmount);
    if (!amount || amount <= 0) return toast.error("Enter valid amount");

    const outstanding = viewLoanData
      ? parseFloat(viewLoanData.amount) -
        parseFloat(viewLoanData.amountPaid || 0)
      : 0;
    if (amount > outstanding) {
      return toast.error(
        `Amount cannot exceed outstanding balance (${formatCurrency(outstanding)})`,
      );
    }

    const { bankHead, cashHead } = resolvePaymentHeads();
    const paymentHead = paymentMode === "cash" ? cashHead : bankHead;
    if (!paymentHead) return toast.error(`Select target ${paymentMode} account`);
    if (paymentMode === "cheque" && !String(chequeNumber || "").trim()) {
      return toast.error("Enter the cheque number");
    }

    setRepaymentLoading(true);
    _postApi(
      `/api/hr/loans/${viewLoanId}/repayments`,
      {
        amount,
        paymentMethod: "Manual",
        paymentMode,
        bankHead: (paymentMode === 'bank' || paymentMode === 'cheque') ? paymentHead : null,
        cashHead: paymentMode === 'cash' ? paymentHead : null,
        chequeNumber: paymentMode === 'cheque' ? String(chequeNumber).trim() : null,
        userId: user?.id,
        facilityId
      },
      (data) => {
        if (data.success) {
          toast.success("Repayment recorded and ledger updated");
          setShowRepaymentForm(false);
          setRepaymentAmount("");
          resetPaymentSelection();
          handleViewLoan({ id: viewLoanId });
          fetchLoans();
        } else {
          toast.error(data.message || "Failed to record repayment");
        }
        setRepaymentLoading(false);
      },
      (error) => {
        toast.error(error?.message || "Error recording repayment");
        setRepaymentLoading(false);
      }
    );
  };

  const handleUpdateStatus = (loan, newStatus) => {
    if (newStatus === "Approved") {
      openApproveModal(loan);
      return;
    }
    if (window.confirm(`Mark this loan as ${newStatus}?`)) {
      _putApi(
        `/api/hr/loans/${loan.id}/status`,
        { status: newStatus, facilityId, userId: user?.id },
        (data) => {
          if (data.success) {
            toast.success(`Status: ${newStatus}`);
            fetchLoans();
          }
        }
      );
    }
  };

  const handleViewLoan = (loan) => {
    setViewLoanId(loan.id);
    setViewLoanData(null);
    setShowRepaymentForm(false);
    setPaymentMode("bank");
    setSelectedBank(null);
    setSelectedCash(null);
    setChequeNumber("");
    setSavingSchedule(false);
    _fetchApi(`/api/hr/loans/${loan.id}?facilityId=${facilityId}`, (data) => {
      if (data.success) {
        setViewLoanData(data.data);
        setScheduleDraft({
          repaymentMethod: data.data.repaymentMethod || "Salary Deduction",
          durationMonths: String(data.data.durationMonths || 1),
          startMonth:
            toYearMonth(data.data.startDate) || currentYearMonth(),
        });
      }
    });
  };

  const scheduleDirty =
    Boolean(viewLoanData) &&
    (scheduleDraft.repaymentMethod !==
      (viewLoanData.repaymentMethod || "Salary Deduction") ||
      String(scheduleDraft.durationMonths) !==
        String(viewLoanData.durationMonths || 1) ||
      String(scheduleDraft.startMonth || "") !==
        String(toYearMonth(viewLoanData.startDate) || ""));

  const draftMonthlyDeduction = (() => {
    if (!viewLoanData) return 0;
    const outstanding =
      parseFloat(viewLoanData.amount) -
      parseFloat(viewLoanData.amountPaid || 0);
    const months = Math.max(1, parseInt(scheduleDraft.durationMonths, 10) || 1);
    return outstanding > 0 ? outstanding / months : 0;
  })();

  const handleSaveRepaymentSchedule = () => {
    if (!viewLoanData?.id) return;
    if (["Paid Off", "Rejected"].includes(viewLoanData.status)) {
      return toast.error("Cannot update schedule on a closed loan");
    }

    const months = parseInt(scheduleDraft.durationMonths, 10);
    if (!Number.isFinite(months) || months < 1) {
      return toast.error("Duration must be at least 1 month");
    }
    if (
      !["Self", "Salary Deduction"].includes(scheduleDraft.repaymentMethod)
    ) {
      return toast.error("Select a valid repayment method");
    }
    if (!/^\d{4}-\d{2}$/.test(String(scheduleDraft.startMonth || ""))) {
      return toast.error("Select the month when the loan starts applying");
    }
    if (!scheduleDirty) {
      return toast.message("No changes to save");
    }

    setSavingSchedule(true);
    _putApi(
      `/api/hr/loans/${viewLoanData.id}`,
      {
        repaymentMethod: scheduleDraft.repaymentMethod,
        durationMonths: months,
        startMonth: scheduleDraft.startMonth,
        facilityId,
        userId: user?.id,
      },
      (data) => {
        setSavingSchedule(false);
        if (data.success) {
          toast.success("Repayment schedule saved");
          const updated = data.data || {};
          setViewLoanData((prev) =>
            prev
              ? {
                  ...prev,
                  ...updated,
                  repaymentMethod:
                    updated.repaymentMethod || scheduleDraft.repaymentMethod,
                  durationMonths: updated.durationMonths ?? months,
                  monthlyDeductionAmount:
                    updated.monthlyDeductionAmount ?? draftMonthlyDeduction,
                  startDate: updated.startDate ?? prev.startDate,
                }
              : prev,
          );
          setScheduleDraft({
            repaymentMethod:
              updated.repaymentMethod || scheduleDraft.repaymentMethod,
            durationMonths: String(updated.durationMonths ?? months),
            startMonth:
              toYearMonth(updated.startDate) || scheduleDraft.startMonth,
          });
          fetchLoans();
        } else {
          toast.error(data.message || "Failed to save repayment schedule");
        }
      },
      () => {
        setSavingSchedule(false);
        toast.error("Network error saving repayment schedule");
      },
    );
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      Pending: "bg-amber-50 text-amber-600 border-amber-200",
      Approved: "bg-[color:var(--app-primary)]/10 text-[color:var(--app-primary)] border-[color:var(--app-primary)]/30",
      Repaying: "bg-[color:var(--app-primary)]/10 text-[color:var(--app-primary)] border-[color:var(--app-primary)]/30",
      "Paid Off": "bg-emerald-50 text-emerald-600 border-emerald-200",
      Rejected: "bg-rose-50 text-rose-600 border-rose-200",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status] || "bg-gray-50 text-gray-600"}`}>
        {status}
      </span>
    );
  };

  const filteredLoans = loans.filter(l => {
    const matchesSearch = (l.employee?.firstName + " " + l.employee?.lastName).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus ? l.status === selectedStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12" style={appColorStyle}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section - Old Style */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Loan Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage employee loan requests, disbursements, and collections</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2 mr-4">
               <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-amber-100 text-amber-700 text-xs font-bold z-30" title="Pending">
                 {loans.filter(l => l.status === 'Pending').length}
               </div>
               <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-[color:var(--app-primary)]/15 text-[color:var(--app-primary)] text-xs font-bold z-20" title="Active">
                 {loans.filter(l => l.status === 'Approved' || l.status === 'Repaying').length}
               </div>
               <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-gray-100 text-gray-600 text-xs font-medium z-10 pl-2 pr-2" title="Total">
                 All
               </div>
            </div>
            <Button 
              type="button"
              onClick={() => {
                setEditMode(false);
                setEditingLoanId(null);
                setFormData(emptyLoanForm());
                setSelectedEmployee(null);
                setSelectedReceivable(null);
                resetPaymentSelection();
                setShowForm(true);
              }}
              className="text-white shadow-sm transition-all hover:opacity-90"
              style={brandButtonStyle}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Loan Request
            </Button>
          </div>
        </div>

        {/* Filters and Search Bar - Old Style */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-20">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent transition-all bg-gray-50 focus:bg-white"
              placeholder="Search by employee name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] focus:bg-white transition-all cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Repaying">Repaying</option>
                <option value="Paid Off">Paid Off</option>
                <option value="Rejected">Rejected</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <Filter className="h-3.5 w-3.5" />
              </div>
            </div>
            
            {(searchTerm || selectedStatus) && (
              <button 
                onClick={() => { setSearchTerm(""); setSelectedStatus(""); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table - Old Style */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative z-10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Beneficiary
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Loan Details
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Financial Balance
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--app-primary)]"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-gray-500">
                      <Banknote className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-lg font-medium text-gray-900">No loan records found</p>
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((item) => (
                    <tr key={item.id} className="hover:bg-[color:var(--app-primary)]/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-[color:var(--app-primary)]/15 border border-[color:var(--app-primary)]/30 flex items-center justify-center">
                              <span className="text-[color:var(--app-primary)] font-semibold text-sm">
                                {item.employee?.firstName?.charAt(0)}{item.employee?.lastName?.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">
                              {item.employee?.firstName} {item.employee?.lastName}
                            </div>
                            <div className="text-xs text-gray-500">#{item.employee?.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-800">
                          {item.referenceNumber || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{item.setup?.name}</span>
                          <span className="text-xs text-gray-500 mt-0.5">{item.durationMonths} Months · From {formatAppliesFrom(item.startDate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(item.amount)}</span>
                          <span className="text-[10px] text-orange-600 font-bold uppercase tracking-tighter">Bal: {formatCurrency(parseFloat(item.amount) - parseFloat(item.amountPaid || 0))}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                           <button 
                             onClick={() => handleViewLoan(item)}
                             className="p-2 text-gray-400 hover:text-[color:var(--app-primary)] hover:bg-[color:var(--app-primary)]/10 rounded-lg transition-all"
                             title="View Ledger"
                           >
                             <Eye size={18} />
                           </button>
                           {item.status === 'Pending' && (
                             <button 
                               onClick={() => handleUpdateStatus(item, "Approved")}
                               className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                               title="Approve"
                             >
                               <CheckCircle size={18} />
                             </button>
                           )}
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                                 <MoreVertical size={18} />
                               </button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                               <DropdownMenuItem onClick={() => handleViewLoan(item)}>Detailed History</DropdownMenuItem>
                               {item.status === 'Pending' && (
                                 <>
                                   <DropdownMenuItem onClick={() => handleEditLoan(item)} className="text-[color:var(--app-primary)] font-bold focus:text-[color:var(--app-primary)]">
                                     <Edit className="w-4 h-4 mr-2" />
                                     Edit Request
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => openApproveModal(item)} className="text-emerald-600 font-bold focus:text-emerald-700">
                                     <CheckCircle className="w-4 h-4 mr-2" />
                                     Approve Loan
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onClick={() => handleUpdateStatus(item, "Rejected")} className="text-red-600">
                                     <XCircle className="w-4 h-4 mr-2" />
                                     Reject Request
                                   </DropdownMenuItem>
                                 </>
                               )}
                             </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Loan Sheet */}
      <Sheet
        open={showForm}
        onOpenChange={(open) => {
          if (!open) handleCloseForm();
        }}
      >
        <SheetContent side="right" className={sheetContentClass}>
          <SheetHeader className={sheetHeaderClass}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-white/10 p-2">
                <Banknote className="h-4 w-4 text-white/90" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-lg font-semibold leading-tight text-white">
                  {editMode ? "Edit Loan Request" : "New Loan Disbursement"}
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-xs text-white/70">
                  {editMode
                    ? "Update pending loan details"
                    : "Record loan and post accounting entries to the ledger"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form
            onSubmit={handleSaveLoan}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
              <div className="space-y-1.5">
                <label className={labelClass}>Reference Number</label>
                <input
                  type="text"
                  readOnly
                  value={
                    editMode
                      ? "Existing request"
                      : loanReferenceLoading
                        ? "Generating…"
                        : loanReferencePreview || "Auto on submit"
                  }
                  className={`${inputClass} bg-slate-50 font-mono text-slate-700`}
                />
                <p className={hintClass}>
                  From the LN number generator — same reference posted to the
                  general ledger
                </p>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Staff Selection</label>
                <TypeaheadCustom
                  options={employees}
                  labelKey={(i) => `${i.firstName} ${i.lastName} (${i.employeeId})`}
                  onChange={(items) => setSelectedEmployee(items[0] || null)}
                  placeholder="Search staff..."
                  selected={selectedEmployee ? [selectedEmployee] : []}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Loan Receivable Account</label>
                <TypeaheadCustom
                  options={chartAccounts}
                  labelKey={(i) =>
                    `${i.head || i.code || ""} ${i.description || i.account_name || ""}`.trim()
                  }
                  onChange={(items) => setSelectedReceivable(items[0] || null)}
                  placeholder="Select receivable account…"
                  selected={selectedReceivable ? [selectedReceivable] : []}
                />
                <p className={hintClass}>
                  Debit this account when the loan is disbursed
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={labelClass}>Principal Amount</label>
                  <input
                    type="text"
                    name="amount"
                    required
                    value={formatNumberWithCommas(formData.amount)}
                    onChange={(e) => {
                      const val = parseFormattedNumber(e.target.value);
                      setFormData((p) => ({ ...p, amount: val }));
                    }}
                    placeholder="0.00"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Duration (Months)</label>
                  <input
                    type="number"
                    name="durationMonths"
                    required
                    min="1"
                    value={formData.durationMonths}
                    onChange={handleInputChange}
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={labelClass}>Applies From</label>
                  <p className={hintClass}>First salary month to deduct</p>
                  <input
                    type="month"
                    name="startMonth"
                    required
                    value={formData.startMonth || ""}
                    onChange={handleInputChange}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Repayment Method</label>
                  <p className={hintClass}>How the staff will repay</p>
                  <select
                    className={inputClass}
                    value={formData.repaymentMethod || "Salary Deduction"}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        repaymentMethod: e.target.value,
                      }))
                    }
                  >
                    <option value="Salary Deduction">Salary Deduction</option>
                    <option value="Self">Self (Manual Payment)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--aa-navy)]/15 bg-[var(--aa-sidebar-active)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--aa-navy)]">
                  Monthly Breakdown
                </p>
                <p className="mt-1 text-base font-semibold tabular-nums text-[var(--aa-navy)]">
                  {formatCurrency(
                    parseFloat(formData.amount || 0) /
                      parseInt(formData.durationMonths || 1, 10),
                  )}
                  <span className="text-sm font-medium text-slate-500"> /Mo</span>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Purpose / Note</label>
                <textarea
                  name="purpose"
                  rows={2}
                  value={formData.purpose}
                  onChange={handleInputChange}
                  placeholder="Optional note about this loan..."
                  className="min-h-[72px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none resize-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                />
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div>
                  <label className={labelClass}>Mode of Payment</label>
                  <p className={hintClass}>How we disburse the loan (pay staff)</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["bank", "cheque", "cash"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPaymentMode(m);
                        if (m === "cash") setSelectedBank(null);
                        else setSelectedCash(null);
                      }}
                      className={`rounded-md border py-2 text-[10px] font-semibold uppercase tracking-wide transition-all ${
                        paymentMode === m
                          ? "border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>
                    {paymentMode === "cash"
                      ? "Pay From (Cash Account)"
                      : "Pay From (Bank Account)"}
                  </label>
                  {["bank", "cheque"].includes(paymentMode) ? (
                    <Select
                      value={
                        selectedBank?.id?.toString() ||
                        selectedBank?.account_code?.toString() ||
                        selectedBank?.head?.toString() ||
                        ""
                      }
                      onValueChange={(value) => {
                        const account = bankAccounts.find(
                          (acc) =>
                            acc.id?.toString() === value ||
                            acc.account_code === value ||
                            acc.head === value,
                        );
                        setSelectedBank(account || null);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-md border-slate-300 bg-white text-sm">
                        <SelectValue placeholder="Select bank account..." />
                      </SelectTrigger>
                      <SelectContent className="z-[300]">
                        {bankAccounts.map((account) => (
                          <SelectItem
                            key={account.id || account.account_code || account.head}
                            value={(
                              account.id ||
                              account.account_code ||
                              account.head
                            ).toString()}
                          >
                            {account.account_code || account.head}{" "}
                            {account.account_name || account.name || "Bank Account"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <TypeaheadCustom
                      options={cashAccounts}
                      labelKey={(i) =>
                        `${i.head || i.code} - ${i.description || i.name || "Cash"}`
                      }
                      onChange={(items) => setSelectedCash(items[0] || null)}
                      placeholder="Select cash account..."
                      selected={selectedCash ? [selectedCash] : []}
                    />
                  )}
                </div>

                {paymentMode === "cheque" && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Cheque Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      placeholder="e.g. 00452189"
                      className={inputClass}
                    />
                    <p className={hintClass}>
                      Required for cheque disbursements — included in the ledger
                      description
                    </p>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAccountingTreatment((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 bg-slate-50 p-3 text-left hover:bg-slate-100/80"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CreditCard className="h-4 w-4 shrink-0 text-[var(--aa-navy)]" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">
                        Accounting Treatment
                      </p>
                      <p className={hintClass}>
                        {editMode
                          ? "Ledger posts when the loan is approved/disbursed"
                          : "Will post to general ledger on submit"}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
                      showAccountingTreatment ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showAccountingTreatment && (
                  <div className="space-y-3 border-t border-slate-200 bg-white p-3">
                    <div className="overflow-hidden rounded-md border border-slate-200 text-sm">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <span>Account</span>
                        <span className="w-24 text-right">Debit</span>
                        <span className="w-24 text-right">Credit</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-slate-100 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            Dr · Loan Receivable
                          </p>
                          <p className="truncate font-mono text-[10px] text-slate-500">
                            {selectedReceivable?.head ||
                              selectedReceivable?.code ||
                              "Select receivable account…"}
                          </p>
                        </div>
                        <span className="w-24 text-right text-xs font-semibold tabular-nums text-slate-900">
                          {formData.amount
                            ? formatCurrency(parseFloat(formData.amount))
                            : "—"}
                        </span>
                        <span className="w-24 text-right text-xs text-slate-300">—</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            Cr · {paymentMode === "cash" ? "Cash" : "Bank"}
                          </p>
                          <p className="truncate font-mono text-[10px] text-slate-500">
                            {paymentMode === "cash"
                              ? selectedCash?.head ||
                                selectedCash?.code ||
                                "Select cash account…"
                              : selectedBank?.account_code ||
                                selectedBank?.head ||
                                "Select bank account…"}
                          </p>
                        </div>
                        <span className="w-24 text-right text-xs text-slate-300">—</span>
                        <span className="w-24 text-right text-xs font-semibold tabular-nums text-slate-900">
                          {formData.amount
                            ? formatCurrency(parseFloat(formData.amount))
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {!(
                      selectedReceivable?.head || selectedReceivable?.code
                    ) && (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                        Select a loan receivable account above before saving.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={sheetFooterClass}>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForm}
                disabled={submitting}
                className="rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy-hover)]"
              >
                {submitting
                  ? "Processing..."
                  : editMode
                    ? "Update Request"
                    : "Disburse & Post to Ledger"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Approval & Disbursement Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-emerald-600 text-white text-center">
              <CheckCircle size={48} className="mx-auto mb-2 text-emerald-100" />
              <h3 className="text-xl font-bold italic uppercase tracking-tighter">Authorize Funds</h3>
              <p className="text-emerald-50 text-[10px] font-bold uppercase tracking-widest">TREASURY DISBURSEMENT</p>
            </div>

            <form onSubmit={handleApproveLoan} className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase">Total to Disburse</p>
                <p className="text-2xl font-black text-gray-900">{formatCurrency(showApproveModal.amount)}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-700">Mode of Payment</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {['bank', 'cheque', 'cash'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setPaymentMode(m);
                          if (m === "cash") setSelectedBank(null);
                          else setSelectedCash(null);
                        }}
                        className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${paymentMode === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {(paymentMode === "bank" || paymentMode === "cheque" || paymentMode === "cash") && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      {["bank", "cheque"].includes(paymentMode) ? (
                        <>
                          <Label className="text-xs font-bold text-gray-700 block mb-1">
                            Pay From (Bank Account)
                          </Label>
                          <Select
                            value={selectedBank?.id?.toString() || selectedBank?.account_code?.toString() || selectedBank?.head?.toString() || ""}
                            onValueChange={(value) => {
                              const account = bankAccounts.find(
                                (acc) => acc.id?.toString() === value || acc.account_code === value || acc.head === value
                              );
                              setSelectedBank(account || null);
                            }}
                          >
                            <SelectTrigger className="w-full h-10 bg-white border border-gray-200 text-gray-900 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                              <SelectValue placeholder="Select account..." />
                            </SelectTrigger>
                            <SelectContent className="z-[300]">
                              {bankAccounts.map((account) => (
                                <SelectItem
                                  key={account.id || account.account_code || account.head}
                                  value={(account.id || account.account_code || account.head).toString()}
                                >
                                  {account.account_code || account.head}  {account.account_name || account.name || 'Bank Account'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <>
                          <Label className="text-xs font-bold text-gray-700 block mb-1">
                            Pay From (Cash Account)
                          </Label>
                          <TypeaheadCustom
                            options={cashAccounts}
                            labelKey={(i) => `${i.head || i.code} - ${i.description || i.name || "Cash"}`}
                            onChange={(items) => setSelectedCash(items[0] || null)}
                            placeholder="Select cash account..."
                            selected={selectedCash ? [selectedCash] : []}
                          />
                        </>
                      )}
                    </div>

                    {paymentMode === "cheque" && (
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-gray-700 block mb-1">Cheque Number</Label>
                        <input
                          type="text"
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                          placeholder="Enter cheque number..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-700">Ref / Tracking No.</Label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Reference..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-2 text-center">
                <Button type="submit" disabled={approvalLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl text-sm">
                  {approvalLoading ? "Authorizing..." : "Commit Disbursement"}
                </Button>
                <button type="button" onClick={() => setShowApproveModal(null)} className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel Action</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Sheet */}
      <Sheet
        open={Boolean(viewLoanId)}
        onOpenChange={(open) => {
          if (!open) {
            setViewLoanId(null);
            setShowRepaymentForm(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl [&>button]:text-white [&>button]:opacity-80 [&>button]:hover:bg-white/10 [&>button]:hover:opacity-100"
        >
          <SheetHeader className={sheetHeaderClass}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/15 text-sm font-semibold text-white">
                {viewLoanData?.employee?.firstName?.[0]}
                {viewLoanData?.employee?.lastName?.[0]}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-lg font-semibold leading-tight text-white">
                  Loan History & Ledger
                </SheetTitle>
                <SheetDescription className="mt-0.5 text-xs text-white/70">
                  {viewLoanData?.employee?.firstName}{" "}
                  {viewLoanData?.employee?.lastName}
                  {viewLoanData?.referenceNumber
                    ? ` · ${viewLoanData.referenceNumber}`
                    : ""}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-white px-5 py-5">
               {!viewLoanData ? (
                 <div className="py-16 text-center">
                   <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--aa-navy)] border-t-transparent"></div>
                   <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Loading…</p>
                 </div>
               ) : (
                 <>
                   <div className="grid grid-cols-3 gap-3">
                     <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                       <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Principal</p>
                       <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(viewLoanData.amount)}</p>
                     </div>
                     <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                       <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Paid</p>
                       <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-600">{formatCurrency(viewLoanData.amountPaid || 0)}</p>
                     </div>
                     <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Outstanding</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-orange-600">{formatCurrency(parseFloat(viewLoanData.amount) - parseFloat(viewLoanData.amountPaid || 0))}</p>
                     </div>
                   </div>

                   <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                     <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                       <div>
                         <p className="text-xs font-semibold text-slate-800">
                           Repayment Schedule
                         </p>
                         <p className={hintClass}>
                           Adjust method and remaining months, then save
                         </p>
                         {viewLoanData.referenceNumber ? (
                           <p className="mt-1 font-mono text-[11px] text-slate-500">
                             Ref: {viewLoanData.referenceNumber}
                           </p>
                         ) : null}
                       </div>
                       <div className="rounded-md border border-[var(--aa-navy)]/15 bg-[var(--aa-sidebar-active)] px-3 py-2 text-right">
                         <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--aa-navy)]">
                           Monthly Deduction
                         </p>
                         <p className="text-sm font-semibold tabular-nums text-[var(--aa-navy)]">
                           {formatCurrency(draftMonthlyDeduction)}/Mo
                         </p>
                       </div>
                     </div>

                     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                       <div className="space-y-1.5">
                         <label className={labelClass}>
                           Repayment Method
                         </label>
                         <select
                           className={`${inputClass} disabled:opacity-60`}
                           value={scheduleDraft.repaymentMethod}
                           disabled={
                             savingSchedule ||
                             ["Paid Off", "Rejected"].includes(
                               viewLoanData.status,
                             )
                           }
                           onChange={(e) =>
                             setScheduleDraft((prev) => ({
                               ...prev,
                               repaymentMethod: e.target.value,
                             }))
                           }
                         >
                           <option value="Salary Deduction">
                             Salary Deduction
                           </option>
                           <option value="Self">Self (Manual Payment)</option>
                         </select>
                       </div>
                       <div className="space-y-1.5">
                         <label className={labelClass}>
                           Duration (Months)
                         </label>
                         <p className={hintClass}>
                           Remaining repayment period
                         </p>
                         <input
                           type="number"
                           min="1"
                           className={`${inputClass} disabled:opacity-60`}
                           value={scheduleDraft.durationMonths}
                           disabled={
                             savingSchedule ||
                             ["Paid Off", "Rejected"].includes(
                               viewLoanData.status,
                             )
                           }
                           onChange={(e) =>
                             setScheduleDraft((prev) => ({
                               ...prev,
                               durationMonths: e.target.value,
                             }))
                           }
                         />
                       </div>
                       <div className="space-y-1.5 sm:col-span-2">
                         <label className={labelClass}>Applies From</label>
                         <p className={hintClass}>
                           First salary month deductions begin
                         </p>
                         <input
                           type="month"
                           className={`${inputClass} disabled:opacity-60 sm:max-w-xs`}
                           value={scheduleDraft.startMonth || ""}
                           disabled={
                             savingSchedule ||
                             ["Paid Off", "Rejected"].includes(
                               viewLoanData.status,
                             )
                           }
                           onChange={(e) =>
                             setScheduleDraft((prev) => ({
                               ...prev,
                               startMonth: e.target.value,
                             }))
                           }
                         />
                       </div>
                     </div>

                     <div className="flex justify-end gap-2 pt-1">
                       <Button
                         type="button"
                         variant="outline"
                         className="rounded-md"
                         disabled={
                           savingSchedule ||
                           !scheduleDirty ||
                           ["Paid Off", "Rejected"].includes(
                             viewLoanData.status,
                           )
                         }
                         onClick={() =>
                           setScheduleDraft({
                             repaymentMethod:
                               viewLoanData.repaymentMethod ||
                               "Salary Deduction",
                             durationMonths: String(
                               viewLoanData.durationMonths || 1,
                             ),
                             startMonth:
                               toYearMonth(viewLoanData.startDate) ||
                               currentYearMonth(),
                           })
                         }
                       >
                         Reset
                       </Button>
                       <Button
                         type="button"
                         className="rounded-md bg-[var(--aa-navy)] px-5 text-white hover:bg-[var(--aa-navy-hover)]"
                         disabled={
                           savingSchedule ||
                           !scheduleDirty ||
                           ["Paid Off", "Rejected"].includes(
                             viewLoanData.status,
                           )
                         }
                         onClick={handleSaveRepaymentSchedule}
                       >
                         {savingSchedule ? "Saving..." : "Save Schedule"}
                       </Button>
                     </div>
                   </div>

                   {['Approved', 'Repaying'].includes(viewLoanData.status) && (
                     <div className="flex flex-col gap-3 rounded-lg border border-[var(--aa-navy)]/15 bg-[var(--aa-sidebar-active)]/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                       <div className="flex items-center gap-3">
                         <div className="rounded-md bg-[var(--aa-navy)]/10 p-2 text-[var(--aa-navy)]">
                            <HandCoins size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-semibold text-slate-900">Manual Payment Recording</p>
                            <p className={hintClass}>Record a payment made directly to treasury</p>
                         </div>
                       </div>
                       <Button
                         type="button"
                         onClick={() => {
                           const next = !showRepaymentForm;
                           setShowRepaymentForm(next);
                           if (next) setShowAccountingTreatment(true);
                         }}
                         variant={showRepaymentForm ? "outline" : "default"}
                         className={
                           showRepaymentForm
                             ? "rounded-md"
                             : "rounded-md bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy-hover)]"
                         }
                       >
                          {showRepaymentForm ? "Close Form" : "Record Payment"}
                       </Button>
                     </div>
                   )}

                    {showRepaymentForm && (
                      <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                         <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                           <div className="space-y-1.5">
                              <label className={labelClass}>Amount to pay</label>
                              <input 
                                type="text" 
                                value={formatNumberWithCommas(repaymentAmount)} 
                                onChange={(e) => {
                                  let val = parseFormattedNumber(e.target.value);
                                  const outstanding = viewLoanData
                                    ? parseFloat(viewLoanData.amount) -
                                      parseFloat(viewLoanData.amountPaid || 0)
                                    : 0;
                                  const num = parseFloat(val);
                                  if (Number.isFinite(num) && num > outstanding) {
                                    val = String(outstanding);
                                    toast.error(
                                      `Max payable is ${formatCurrency(outstanding)}`,
                                    );
                                  }
                                  setRepaymentAmount(val);
                                }} 
                                className={`${inputClass} font-semibold ${
                                  repaymentAmount &&
                                  viewLoanData &&
                                  parseFloat(repaymentAmount) >
                                    parseFloat(viewLoanData.amount) -
                                      parseFloat(viewLoanData.amountPaid || 0)
                                    ? "border-red-400 ring-1 ring-red-300"
                                    : ""
                                }`}
                                placeholder="0.00" 
                              />
                              {viewLoanData && (
                                <p className={hintClass}>
                                  Outstanding:{" "}
                                  <span className="font-semibold text-orange-600">
                                    {formatCurrency(
                                      parseFloat(viewLoanData.amount) -
                                        parseFloat(viewLoanData.amountPaid || 0),
                                    )}
                                  </span>
                                </p>
                              )}
                           </div>
                           <div className="space-y-1.5">
                              <label className={labelClass}>Mode</label>
                              <div className="grid grid-cols-3 gap-1">
                                {['bank', 'cheque', 'cash'].map(m => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => setPaymentMode(m)}
                                    className={`rounded-md border py-2 text-[9px] font-semibold uppercase tracking-wide transition-all ${paymentMode === m ? 'border-[var(--aa-navy)] bg-[var(--aa-navy)] text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`}
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>
                           </div>
                           {(paymentMode === "bank" || paymentMode === "cheque" || paymentMode === "cash") && (
                             <div className="space-y-1.5">
                               {["bank", "cheque"].includes(paymentMode) ? (
                                 <>
                                   <label className={labelClass}>
                                     Bank Account
                                   </label>
                                   <Select
                                     value={
                                       selectedBank?.id?.toString() ||
                                       selectedBank?.account_code?.toString() ||
                                       selectedBank?.head?.toString() ||
                                       ""
                                     }
                                     onValueChange={(value) => {
                                       const account = bankAccounts.find(
                                         (acc) =>
                                           acc.id?.toString() === value ||
                                           acc.account_code === value ||
                                           acc.head === value
                                       );
                                       setSelectedBank(account || null);
                                     }}
                                   >
                                     <SelectTrigger className="h-10 w-full rounded-md border-slate-300 bg-white text-sm">
                                       <SelectValue placeholder="Select account..." />
                                     </SelectTrigger>
                                     <SelectContent className="z-[300]">
                                       {bankAccounts.map((account) => (
                                         <SelectItem
                                           key={account.id || account.account_code || account.head}
                                           value={(account.id || account.account_code || account.head).toString()}
                                         >
                                           {account.account_code || account.head}{" "}
                                           {account.account_name || account.name || "Bank Account"}
                                         </SelectItem>
                                       ))}
                                     </SelectContent>
                                   </Select>
                                 </>
                               ) : (
                                 <>
                                   <label className={labelClass}>
                                     Cash Account
                                   </label>
                                   <TypeaheadCustom
                                     options={cashAccounts}
                                     labelKey={(i) => `${i.head || i.code} - ${i.description || i.name || "Cash"}`}
                                     onChange={(items) => setSelectedCash(items[0] || null)}
                                     placeholder="Select cash account..."
                                     selected={selectedCash ? [selectedCash] : []}
                                   />
                                 </>
                               )}
                             </div>
                           )}

                           {paymentMode === "cheque" && (
                             <div className="space-y-1.5">
                               <label className={labelClass}>Cheque No.</label>
                               <input
                                 type="text"
                                 value={chequeNumber}
                                 onChange={(e) => setChequeNumber(e.target.value)}
                                 placeholder="Cheque #"
                                 className={inputClass}
                               />
                             </div>
                           )}

                           <div className="flex flex-col justify-end">
                             <Button
                               type="button"
                               onClick={handleRecordRepayment}
                               disabled={
                                 repaymentLoading ||
                                 !repaymentAmount ||
                                 parseFloat(repaymentAmount) <= 0 ||
                                 (viewLoanData &&
                                   parseFloat(repaymentAmount) >
                                     parseFloat(viewLoanData.amount) -
                                       parseFloat(viewLoanData.amountPaid || 0))
                               }
                               className="h-10 w-full rounded-md bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy-hover)] disabled:opacity-50"
                             >
                                {repaymentLoading ? "Wait..." : "Post Payment"}
                             </Button>
                           </div>
                         </div>

                         {/* Accounting Treatment — repayment */}
                         <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                           <button
                             type="button"
                             onClick={() => setShowAccountingTreatment((v) => !v)}
                             className="flex w-full items-center justify-between gap-3 bg-slate-50 p-3 text-left hover:bg-slate-100/80"
                           >
                             <div className="flex min-w-0 items-center gap-2">
                               <CreditCard className="h-4 w-4 shrink-0 text-[var(--aa-navy)]" />
                               <div className="min-w-0">
                                 <p className="text-xs font-semibold text-slate-800">
                                   Accounting Treatment
                                 </p>
                                 <p className={hintClass}>
                                   Will post to general ledger on payment
                                 </p>
                               </div>
                             </div>
                             <ChevronDown
                               className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
                                 showAccountingTreatment ? "rotate-180" : ""
                               }`}
                             />
                           </button>

                           {showAccountingTreatment && (
                             <div className="space-y-2 border-t border-slate-200 p-3">
                               <div className="overflow-hidden rounded-md border border-slate-200 text-sm">
                                 <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                   <span>Account</span>
                                   <span className="w-24 text-right">Debit</span>
                                   <span className="w-24 text-right">Credit</span>
                                 </div>
                                 <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-slate-100 px-3 py-2.5">
                                   <div className="min-w-0">
                                     <p className="truncate text-xs font-semibold text-slate-800">
                                       Dr · {paymentMode === "cash" ? "Cash" : "Bank"}
                                     </p>
                                     <p className="truncate font-mono text-[10px] text-slate-500">
                                       {paymentMode === "cash"
                                         ? selectedCash?.head ||
                                           selectedCash?.code ||
                                           "Select cash account…"
                                         : selectedBank?.account_code ||
                                           selectedBank?.head ||
                                           "Select bank account…"}
                                     </p>
                                   </div>
                                   <span className="w-24 text-right text-xs font-semibold tabular-nums text-slate-900">
                                     {repaymentAmount
                                       ? formatCurrency(parseFloat(repaymentAmount))
                                       : "—"}
                                   </span>
                                   <span className="w-24 text-right text-xs text-slate-300">—</span>
                                 </div>
                                 <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2.5">
                                   <div className="min-w-0">
                                     <p className="truncate text-xs font-semibold text-slate-800">
                                       Cr · Loan Receivable
                                     </p>
                                     <p className="truncate font-mono text-[10px] text-slate-500">
                                       {viewLoanData.receivableHead ||
                                         viewLoanData.setup?.receivableHead ||
                                         "—"}
                                     </p>
                                   </div>
                                   <span className="w-24 text-right text-xs text-slate-300">—</span>
                                   <span className="w-24 text-right text-xs font-semibold tabular-nums text-slate-900">
                                     {repaymentAmount
                                       ? formatCurrency(parseFloat(repaymentAmount))
                                       : "—"}
                                   </span>
                                 </div>
                               </div>
                               {!(viewLoanData.receivableHead ||
                                 viewLoanData.setup?.receivableHead) && (
                                 <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                                   Loan receivable account is missing on this loan.
                                 </p>
                               )}
                             </div>
                           )}
                         </div>
                         
                         {repaymentAmount > 0 && viewLoanData && (
                           <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-semibold uppercase text-slate-500">New Balance after payment</span>
                               <span
                                 className={`font-semibold tabular-nums ${
                                   parseFloat(repaymentAmount) >
                                   parseFloat(viewLoanData.amount) -
                                     parseFloat(viewLoanData.amountPaid || 0)
                                     ? "text-red-600"
                                     : "text-[var(--aa-navy)]"
                                 }`}
                               >
                                 {formatCurrency(
                                   Math.max(
                                     0,
                                     parseFloat(viewLoanData.amount) -
                                       parseFloat(viewLoanData.amountPaid || 0) -
                                       parseFloat(repaymentAmount || 0),
                                   ),
                                 )}
                               </span>
                             </div>
                           </div>
                         )}
                      </div>
                    )}

                   <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                     <table className="w-full text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                           <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              <th className="px-4 py-3 text-left">Date</th>
                              <th className="px-4 py-3 text-left">Amount</th>
                              <th className="px-4 py-3 text-left">Method</th>
                              <th className="px-4 py-3 text-right">Reference</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {viewLoanData.repayments?.map((rep) => (
                              <tr key={rep.id}>
                                 <td className="px-4 py-3 font-medium text-slate-700">{new Date(rep.createdAt).toLocaleDateString()}</td>
                                 <td className="px-4 py-3 font-semibold tabular-nums text-emerald-600">{formatCurrency(rep.amount)}</td>
                                 <td className="px-4 py-3">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{rep.paymentMethod}</span>
                                 </td>
                                 <td className="px-4 py-3 text-right">
                                   <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                                     {rep.reference ||
                                       viewLoanData.referenceNumber ||
                                       "—"}
                                   </span>
                                 </td>
                              </tr>
                           ))}
                           {(!viewLoanData.repayments || viewLoanData.repayments.length === 0) && (
                              <tr>
                                 <td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-400">No repayment records found</td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                   </div>
                 </>
               )}
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default LoanManagement;
