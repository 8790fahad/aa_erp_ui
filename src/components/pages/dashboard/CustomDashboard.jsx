import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  Receipt,
  FileText,
  CreditCard,
  Building2,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  MoreVertical,
  Plus,
  X,
  Loader,
  Eye,
  Check,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useSelector, useDispatch } from "react-redux";
import { UPDATE_BUSINESS_SETTINGS } from "@/redux/actions/actionTypes";
import { today } from "@/utilities";
import { format } from "date-fns";
import PropTypes from "prop-types";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Typeahead } from "react-bootstrap-typeahead";
import { accountTypes } from "@/lib/utils";
import { toast } from "sonner";
import {
  getBusinessLabels,
  isNgoBusiness,
  hasBusinessType,
} from "@/utils/businessTypeUtils";
import FinancialOverviewSection from "./FinancialOverviewSection";

export const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-xl">
        <p className="text-gray-600 text-sm font-medium">{`${label}`}</p>
        {payload.map((entry, index) => (
          <p
            key={index}
            className="text-gray-900 font-semibold text-sm mt-1"
            style={{ color: entry.color }}
          >
            {`${entry.dataKey}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
};

// Skeleton Loader Components

const SalesCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 animate-pulse h-full flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <div className="h-4 bg-gray-200 rounded w-16"></div>
      <div className="h-4 bg-gray-200 rounded w-32"></div>
    </div>
    <div className="mb-4">
      <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
      <div className="h-8 bg-gray-200 rounded w-40"></div>
    </div>
    <div className="h-32 bg-gray-100 rounded mb-4"></div>
    <div className="h-3 bg-gray-200 rounded w-24 mx-auto mb-4"></div>
    <div className="h-px bg-gray-200 mt-4"></div>
  </div>
);

const InvoicesCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-[300px] animate-pulse flex flex-col">
    <div className="flex justify-between mb-4">
      <div className="h-4 bg-gray-200 rounded w-24"></div>
      <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    <div className="grid grid-cols-2 gap-3 flex-1">
      <div className="rounded-lg bg-gray-100 p-4"></div>
      <div className="rounded-lg bg-gray-100 p-4"></div>
    </div>
  </div>
);

const BankAccountsCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 animate-pulse flex flex-col h-full">
    <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
    <div className="h-5 bg-gray-200 rounded w-48 mb-6"></div>
    <div className="space-y-4 flex-1 mb-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
        <div className="h-4 bg-gray-200 rounded flex-1 ml-3"></div>
      </div>
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
        <div className="h-4 bg-gray-200 rounded flex-1 ml-3"></div>
      </div>
    </div>
    <div className="h-10 bg-gray-200 rounded mt-auto"></div>
  </div>
);

const AccountsReceivableCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 animate-pulse h-full flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <div className="h-4 bg-gray-200 rounded w-40"></div>
      <div className="h-3 bg-gray-200 rounded w-20"></div>
    </div>
    <div className="mb-6">
      <div className="h-3 bg-gray-200 rounded w-12 mb-1"></div>
      <div className="h-8 bg-gray-200 rounded w-32"></div>
    </div>
    <div className="flex justify-center mb-6">
      <div className="w-48 h-48 bg-gray-100 rounded-full"></div>
    </div>
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
          <div className="h-3 bg-gray-200 rounded w-24"></div>
        </div>
      ))}
    </div>
  </div>
);

const AccountsPayableCardSkeleton = () => <AccountsReceivableCardSkeleton />;

const ExpensesCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
    <div className="flex justify-between items-center mb-2">
      <div className="h-4 bg-gray-200 rounded w-20"></div>
      <div className="h-6 bg-gray-200 rounded w-24"></div>
    </div>
    <div className="h-3 bg-gray-200 rounded w-32 mb-3"></div>
    <div className="flex items-center gap-2 mb-3">
      <div className="h-6 bg-gray-200 rounded w-28"></div>
      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
    </div>
    <div className="h-3 bg-gray-200 rounded w-36 mb-3"></div>
    <div className="flex items-start gap-4">
      <div className="w-24 h-24 bg-gray-100 rounded-full"></div>
      <div className="space-y-2 flex-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CashFlowCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
    <div className="flex justify-between items-center mb-2">
      <div>
        <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-32"></div>
      </div>
      <div className="h-6 bg-gray-200 rounded w-20"></div>
    </div>
    <div className="flex gap-3 mb-3">
      <div className="flex-1 bg-gray-50 rounded p-2">
        <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
        <div className="h-5 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="flex-1 bg-gray-50 rounded p-2">
        <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
        <div className="h-5 bg-gray-200 rounded w-20"></div>
      </div>
      <div className="flex-1 bg-gray-50 rounded p-2">
        <div className="h-3 bg-gray-200 rounded w-16 mb-1"></div>
        <div className="h-5 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
    <div className="h-20 bg-gray-100 rounded mb-2"></div>
    <div className="flex justify-center gap-4">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
    </div>
  </div>
);

const BankAccountsCardSkeletonNew = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
    <div className="flex justify-between items-center mb-3">
      <div className="h-4 bg-gray-200 rounded w-28"></div>
      <div className="flex items-center gap-2">
        <div className="h-6 bg-gray-200 rounded w-16"></div>
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between py-2 border-b border-gray-100"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-200 rounded-full"></div>
            <div>
              <div className="h-3 bg-gray-200 rounded w-24 mb-1"></div>
              <div className="h-2 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>
      ))}
    </div>
  </div>
);

function getLast30DaysRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from, to };
}

function formatDashboardPeriodLabel(fromStr, toStr) {
  if (!fromStr || !toStr) return "Last 30 days";
  const from = moment(fromStr, "YYYY-MM-DD");
  const to = moment(toStr, "YYYY-MM-DD");
  if (!from.isValid() || !to.isValid()) return "Last 30 days";
  if (from.year() === to.year()) {
    return `${from.format("MMM D")} – ${to.format("MMM D, YYYY")}`;
  }
  return `${from.format("MMM D, YYYY")} – ${to.format("MMM D, YYYY")}`;
}

function formatAsOfTodayLabel(asOfDateStr) {
  if (!asOfDateStr) return "As of today";
  const d = moment(asOfDateStr, "YYYY-MM-DD");
  return d.isValid() ? `As of ${d.format("MMM D, YYYY")}` : "As of today";
}

function buildMonthlyExpenseTrend(expenseRows) {
  const monthlyData = {};

  expenseRows.forEach((expense) => {
    const expenseDate =
      expense.transaction_date || expense.date || expense.createdAt;
    if (!expenseDate) return;

    const date = new Date(expenseDate);
    if (isNaN(date.getTime())) return;

    const amount =
      parseFloat(expense.debit || expense.amount || 0) -
      parseFloat(expense.credit || 0);
    if (amount <= 0) return;

    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = format(date, "MMM yyyy");

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthLabel,
        amount: 0,
        date,
      };
    }

    monthlyData[monthKey].amount += amount;
  });

  return Object.values(monthlyData).sort((a, b) => a.date - b.date);
}

function MonthlyAmountTrendChart({
  monthlyData,
  barColor = "#10b981",
  className = "h-24 sm:h-32",
}) {
  const totalAmount = monthlyData.reduce((sum, month) => sum + month.amount, 0);
  const hasData = monthlyData.length > 0 && totalAmount > 0;
  const maxAmount = hasData
    ? Math.max(...monthlyData.map((m) => m.amount), 1)
    : 1;
  const chartHeight = hasData ? 120 : 80;
  const chartWidth =
    monthlyData.length > 0 ? Math.max(300, monthlyData.length * 60) : 300;
  const barWidth =
    monthlyData.length > 0
      ? Math.max(20, (chartWidth - 40) / monthlyData.length - 10)
      : 20;

  return (
    <div className={`${hasData ? className : "h-20"} relative mb-2`}>
      <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500">
        {hasData ? (
          <>
            <span>
              {maxAmount >= 1000000
                ? `${(maxAmount / 1000000).toFixed(1)}M`
                : formatNumber1(maxAmount)}
            </span>
            <span>
              {maxAmount >= 1000000
                ? `${((maxAmount * 0.75) / 1000000).toFixed(1)}M`
                : formatNumber1(maxAmount * 0.75)}
            </span>
            <span>
              {maxAmount >= 1000000
                ? `${((maxAmount * 0.5) / 1000000).toFixed(1)}M`
                : formatNumber1(maxAmount * 0.5)}
            </span>
            <span>
              {maxAmount >= 1000000
                ? `${((maxAmount * 0.25) / 1000000).toFixed(1)}M`
                : formatNumber1(maxAmount * 0.25)}
            </span>
            <span>0</span>
          </>
        ) : (
          <>
            <span>1.00</span>
            <span>0.75</span>
            <span>0.50</span>
            <span>0.25</span>
            <span>0</span>
          </>
        )}
      </div>
      <div className="ml-12 h-full border-b border-l border-gray-200 relative overflow-x-auto">
        {hasData ? (
          <svg
            className="w-full h-full min-w-full"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
          >
            {monthlyData.map((month, index) => {
              const barHeight =
                maxAmount > 0
                  ? (month.amount / maxAmount) * (chartHeight - 20)
                  : 0;
              const x = 20 + index * (barWidth + 10);
              const y = chartHeight - barHeight - 10;

              return (
                <g key={index}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={barColor}
                    rx="2"
                  />
                  <circle
                    cx={x + barWidth / 2}
                    cy={y}
                    r="3"
                    fill={barColor}
                  />
                </g>
              );
            })}
          </svg>
        ) : (
          <svg
            className="w-full h-full"
            viewBox="0 0 300 80"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="70"
              x2="300"
              y2="70"
              stroke={barColor}
              strokeWidth="2"
            />
          </svg>
        )}
      </div>
      {hasData && (
        <div className="flex justify-between text-xs text-gray-500 mt-1 ml-12">
          {monthlyData.map((month, index) => (
            <span key={index} className="text-center flex-1 truncate">
              {month.month.split(" ")[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const isNgo = isNgoBusiness(activeBusiness?.business_type);
  const labels = getBusinessLabels(activeBusiness?.business_type);
  const hasProduction = hasBusinessType(
    activeBusiness?.business_type,
    "manufacturing",
  );
  const [range, setRange] = useState({
    from: today,
    to: today,
  });

  // Sales period state (default to last 3 months)
  const [salesPeriod, setSalesPeriod] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    return {
      from: from,
      to: to,
    };
  });

  // Monthly sales data for chart
  const [monthlySales, setMonthlySales] = useState([]);

  // Cash flow data for chart - initialize empty, will be populated from database
  const [cashFlowData, setCashFlowData] = useState({
    monthlyBalance: [],
    projectedBalance: [],
    threshold: 0,
    currentBalance: 0,
  });

  // Cash flow period and last updated
  const [cashFlowPeriod, setCashFlowPeriod] = useState("12months");
  const [cashFlowDropdownOpen, setCashFlowDropdownOpen] = useState(false);
  const [cashFlowLastUpdated, setCashFlowLastUpdated] = useState(null);

  const cashFlowPeriodOptions = [
    { value: "3months", label: "3 months" },
    { value: "6months", label: "6 months" },
    { value: "12months", label: "12 months" },
    { value: "thisYear", label: "This year" },
    { value: "lastYear", label: "Last year" },
  ];

  const getCashFlowPeriodLabel = () => {
    const option = cashFlowPeriodOptions.find(
      (o) => o.value === cashFlowPeriod,
    );
    return option ? option.label : "12 months";
  };

  const getLastUpdatedText = () => {
    if (!cashFlowLastUpdated) return "Not yet updated";
    const now = new Date();
    const diff = Math.floor((now - cashFlowLastUpdated) / 1000); // seconds
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // Calculate cash flow period dates
  const getCashFlowPeriodDates = useCallback(() => {
    const now = new Date();
    let from = new Date();
    const to = new Date();

    switch (cashFlowPeriod) {
      case "3months":
        from.setMonth(now.getMonth() - 3);
        break;
      case "6months":
        from.setMonth(now.getMonth() - 6);
        break;
      case "12months":
        from.setMonth(now.getMonth() - 12);
        break;
      case "thisYear":
        from = new Date(now.getFullYear(), 0, 1);
        break;
      case "lastYear":
        from = new Date(now.getFullYear() - 1, 0, 1);
        to.setFullYear(now.getFullYear() - 1, 11, 31);
        break;
      default:
        from.setMonth(now.getMonth() - 12);
    }
    return { from, to };
  }, [cashFlowPeriod]);

  // Expenses by category for pie chart
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState([]);
  const [priorPeriodExpenses, setPriorPeriodExpenses] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);

  // Expenses period dropdown state
  const [expensesPeriod, setExpensesPeriod] = useState("last30days");
  const [expensesDropdownOpen, setExpensesDropdownOpen] = useState(false);

  const expensesPeriodOptions = [
    { value: "last30days", label: "Last 30 days" },
    { value: "thisMonth", label: "This month" },
    { value: "thisMonthToDate", label: "This month to date" },
    { value: "thisFiscalQuarter", label: "This fiscal quarter" },
    { value: "thisFiscalQuarterToDate", label: "This fiscal quarter to date" },
    { value: "thisFinancialYear", label: "This financial year" },
    { value: "thisFinancialYearToDate", label: "This financial year to date" },
    { value: "lastMonth", label: "Last month" },
    { value: "lastFiscalQuarter", label: "Last fiscal quarter" },
    { value: "lastFinancialYear", label: "Last financial year" },
  ];

  const getExpensesPeriodLabel = () => {
    const option = expensesPeriodOptions.find(
      (o) => o.value === expensesPeriod,
    );
    return option ? option.label : "Last 30 days";
  };

  // Calculate date range based on selected expense period
  const getExpensesPeriodDates = useCallback(() => {
    const now = new Date();
    let from = new Date();
    let to = new Date();

    switch (expensesPeriod) {
      case "last30days":
        from.setDate(now.getDate() - 30);
        break;
      case "thisMonth":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "thisMonthToDate":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "thisFiscalQuarter": {
        const quarter = Math.floor(now.getMonth() / 3);
        from = new Date(now.getFullYear(), quarter * 3, 1);
        to = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      }
      case "thisFiscalQuarterToDate": {
        const quarter = Math.floor(now.getMonth() / 3);
        from = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      }
      case "thisFinancialYear":
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31);
        break;
      case "thisFinancialYearToDate":
        from = new Date(now.getFullYear(), 0, 1);
        break;
      case "lastMonth": {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        from = lastMonth;
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      }
      case "lastFiscalQuarter": {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const year =
          currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        from = new Date(year, lastQuarter * 3, 1);
        to = new Date(year, (lastQuarter + 1) * 3, 0);
        break;
      }
      case "lastFinancialYear":
        from = new Date(now.getFullYear() - 1, 0, 1);
        to = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        from.setDate(now.getDate() - 30);
    }
    return { from, to };
  }, [expensesPeriod]);

  // Calculate prior period dates (same duration, before current period)
  const getPriorPeriodDates = useCallback(() => {
    const { from, to } = getExpensesPeriodDates();
    const duration = to.getTime() - from.getTime();
    const priorTo = new Date(from.getTime() - 1); // Day before current period starts
    const priorFrom = new Date(priorTo.getTime() - duration);
    return { from: priorFrom, to: priorTo };
  }, [getExpensesPeriodDates]);

  const [dashboardData, setDashboardData] = useState({
    expenses: 0,
    sales: 0,
    accountsPayable: 0,
    accountsReceivable: 0,
    invoices: 0,
    bankAccounts: 0,
    // Enhanced breakdown data
    accountsReceivableBreakdown: {
      unpaid: 0,
      partiallyPaid: 0,
      overdue: 0,
    },
    accountsPayableBreakdown: {
      unpaid: 0,
      partiallyPaid: 0,
      overdue: 0,
    },
    invoicesBreakdown: {
      sales: 0,
      purchases: 0,
    },
  });

  // Invoices period (default last 30 days)
  const [invoicesPeriod, setInvoicesPeriod] = useState(() => {
    const { from, to } = getLast30DaysRange();
    return { from, to };
  });
  const [arApAsOfDate, setArApAsOfDate] = useState(() => new Date());

  // Invoices data state
  const [invoicesData, setInvoicesData] = useState({
    activityLast30Days: {
      invoiced: 0,
      received: 0,
    },
  });

  // Aging data for Accounts Receivable and Payable
  const [receivableAging, setReceivableAging] = useState({
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days91Plus: 0,
  });

  const [payableAging, setPayableAging] = useState({
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days91Plus: 0,
  });
  const [loading, setLoading] = useState(true);

  // Individual card loading states
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingCashFlow, setLoadingCashFlow] = useState(true);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(true);

  // Bank Accounts state
  const [bankAccountsList, setBankAccountsList] = useState([]);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankAccountsPage, setBankAccountsPage] = useState(0);
  const [existingCodes, setExistingCodes] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [formData, setFormData] = useState({
    subhead: "",
    bank_code: "",
    bank_name: "",
    account_number: "",
    account_name: "",
    code: "",
    account_bank_type: "",
    head: null,
  });

  const getDefaultVisibility = () => ({
    cashFlow: true,
    invoices: true,
    bankAccounts: true,
    referrals: true,
    sales: true,
    accountsReceivable: true,
    workRequests: true,
    accountsPayable: true,
    expenses: true,
  });

  const getStoredVisibility = () => {
    const defaultVisibility = getDefaultVisibility();

    // First, try to load from activeBusiness.dashboard_widgets (from database/Redux)
    if (activeBusiness?.dashboard_widgets) {
      try {
        let widgets = activeBusiness.dashboard_widgets;
        // Parse if it's a string
        if (typeof widgets === "string") {
          widgets = JSON.parse(widgets);
        }
        // Merge with defaults to ensure all keys exist
        return {
          ...defaultVisibility,
          ...widgets,
        };
      } catch (error) {
        console.error("Error parsing dashboard_widgets from business:", error);
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(
        `dashboard-visibility-${activeBusiness?.id}`,
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...defaultVisibility,
          ...parsed,
        };
      }
    } catch (error) {
      console.error(
        "Error loading visibility preferences from localStorage:",
        error,
      );
    }

    return defaultVisibility;
  };

  const [cardVisibility, setCardVisibility] = useState(() =>
    getDefaultVisibility(),
  );

  const saveVisibilityPreferences = async (visibility) => {
    // Save to localStorage as backup
    try {
      localStorage.setItem(
        `dashboard-visibility-${activeBusiness?.id}`,
        JSON.stringify(visibility),
      );
    } catch (error) {
      console.error(
        "Error saving visibility preferences to localStorage:",
        error,
      );
    }

    // Save to database and update Redux
    if (activeBusiness?.id) {
      try {
        _postApi(
          `/account/update-dashboard-widgets/${activeBusiness.id}`,
          {
            dashboard_widgets: visibility,
            user_id: currentUser?.id || currentUser?.user_id,
          },
          (response) => {
            if (response.success && response.business) {
              // Update Redux store with the updated business
              dispatch({
                type: UPDATE_BUSINESS_SETTINGS,
                payload: { business: response.business },
              });
              toast.success("Dashboard preferences saved");
            } else {
              toast.error(response.message || "Failed to save preferences");
            }
          },
          (error) => {
            console.error("Error saving dashboard widgets:", error);
            toast.error("Failed to save dashboard preferences");
          },
        );
      } catch (error) {
        console.error("Error saving dashboard widgets:", error);
        toast.error("Failed to save dashboard preferences");
      }
    }
  };

  useEffect(() => {
    if (activeBusiness?.id) {
      const visibility = getStoredVisibility();
      setCardVisibility(visibility);
    } else {
      setCardVisibility(getDefaultVisibility());
    }
  }, [activeBusiness?.id, activeBusiness?.dashboard_widgets]);

  const formatDateForAPI = (date) => {
    return moment(date).format("DD-MM-YYYY");
  };

  const getInvoicesPeriodLabel = () => {
    if (invoicesPeriod.from && invoicesPeriod.to) {
      return formatDashboardPeriodLabel(
        moment(invoicesPeriod.from).format("YYYY-MM-DD"),
        moment(invoicesPeriod.to).format("YYYY-MM-DD"),
      );
    }
    return "Last 30 days";
  };

  const getArApAsOfLabel = () =>
    formatAsOfTodayLabel(moment(arApAsOfDate).format("YYYY-MM-DD"));

  // Fetch expenses by category based on selected period
  const fetchExpensesByPeriod = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingExpenses(true);
    const { from, to } = getExpensesPeriodDates();
    const fromDate = formatDateForAPI(from);
    const toDate = formatDateForAPI(to);

    // Fetch current period expenses
    _fetchApi(
      `/api/expenses/by-category/${fromDate}/${toDate}/${activeBusiness.id}`,
      (response) => {
        if (response && response.success) {
          const categories = response.categories || [];
          const expenseRows = Array.isArray(response.results)
            ? response.results
            : categories.flatMap((cat) => cat.transactions || []);
          const total =
            parseFloat(response.total || 0) ||
            categories.reduce((sum, cat) => sum + (cat.amount || 0), 0);
          setExpensesByCategory(categories.length > 0 ? categories : []);
          setMonthlyExpenses(buildMonthlyExpenseTrend(expenseRows));
          setExpensesTotal(total);
          setLoadingExpenses(false);
        } else {
          // Fallback to old endpoint
          _fetchApi(
            `/account/expenses/${fromDate}/${toDate}/${activeBusiness.id}`,
            (fallbackResponse) => {
              if (fallbackResponse && fallbackResponse.results) {
                const expenses = Array.isArray(fallbackResponse.results)
                  ? fallbackResponse.results
                  : [];
                const categoryMap = {};
                const colors = [
                  "#EF4444",
                  "#3B82F6",
                  "#F59E0B",
                  "#EC4899",
                  "#6366F1",
                  "#10B981",
                  "#8B5CF6",
                ];
                let total = 0;
                expenses.forEach((expense) => {
                  const categoryName =
                    expense.account_description || expense.category || "Other";
                  const amount = parseFloat(
                    expense.amount || expense.debit || 0,
                  );
                  total += amount;
                  if (!categoryMap[categoryName]) {
                    categoryMap[categoryName] = {
                      name: categoryName,
                      amount: 0,
                      color:
                        colors[Object.keys(categoryMap).length % colors.length],
                    };
                  }
                  categoryMap[categoryName].amount += amount;
                });
                setExpensesByCategory(
                  Object.values(categoryMap)
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10),
                );
                setMonthlyExpenses(buildMonthlyExpenseTrend(expenses));
                setExpensesTotal(total);
              } else {
                setMonthlyExpenses([]);
              }
              setLoadingExpenses(false);
            },
            "GET",
          );
        }
      },
      "GET",
    );

    // Fetch prior period expenses for comparison
    const { from: priorFrom, to: priorTo } = getPriorPeriodDates();
    const priorFromDate = formatDateForAPI(priorFrom);
    const priorToDate = formatDateForAPI(priorTo);

    _fetchApi(
      `/api/expenses/by-category/${priorFromDate}/${priorToDate}/${activeBusiness.id}`,
      (response) => {
        if (response && response.success) {
          const categories = response.categories || [];
          const total = categories.reduce(
            (sum, cat) => sum + (cat.amount || 0),
            0,
          );
          setPriorPeriodExpenses(total);
        } else {
          _fetchApi(
            `/account/expenses/${priorFromDate}/${priorToDate}/${activeBusiness.id}`,
            (fallbackResponse) => {
              if (fallbackResponse && fallbackResponse.results) {
                const expenses = Array.isArray(fallbackResponse.results)
                  ? fallbackResponse.results
                  : [];
                const total = expenses.reduce(
                  (sum, exp) => sum + parseFloat(exp.amount || exp.debit || 0),
                  0,
                );
                setPriorPeriodExpenses(total);
              }
            },
            "GET",
          );
        }
      },
      "GET",
    );
  }, [activeBusiness?.id, getExpensesPeriodDates, getPriorPeriodDates]);

  // Refetch expenses when period changes
  useEffect(() => {
    fetchExpensesByPeriod();
  }, [expensesPeriod, fetchExpensesByPeriod]);

  // Fetch cash flow data based on selected period
  const fetchCashFlowByPeriod = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingCashFlow(true);
    const { from, to } = getCashFlowPeriodDates();
    const fromDate = formatDateForAPI(from);
    const toDate = formatDateForAPI(to);

    _fetchApi(
      `/api/cash-flow/dashboard/${activeBusiness.id}?from=${fromDate}&to=${toDate}`,
      (response) => {
        if (response && response.success && response.results) {
          const data = response.results;
          setCashFlowData({
            monthlyBalance: data.monthlyBalance || [],
            projectedBalance: data.projectedBalance || [],
            threshold: parseFloat(data.threshold || 0),
            currentBalance: parseFloat(data.currentBalance || 0),
            totalInflow: parseFloat(data.totalInflow || 0),
            totalOutflow: parseFloat(data.totalOutflow || 0),
          });
          setCashFlowLastUpdated(new Date());
        }
        setLoadingCashFlow(false);
      },
      "GET",
    );
  }, [activeBusiness?.id, getCashFlowPeriodDates]);

  // Refetch cash flow when period changes
  useEffect(() => {
    fetchCashFlowByPeriod();
  }, [cashFlowPeriod, fetchCashFlowByPeriod]);

  // Calculate aging buckets from transaction data (accounts receivable/payable)
  // Uses proper accounting date fields: due_date, invoice_date, transaction_date, etc.
  const calculateAging = (transactions, today = new Date()) => {
    const aging = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days91Plus: 0,
    };

    if (!Array.isArray(transactions)) return aging;

    transactions.forEach((item) => {
      // Skip paid invoices (only age unpaid and partially paid)
      const paymentStatus = item.payment_status || item.status;
      if (paymentStatus === "paid") return;

      // Try multiple date fields in order of accounting preference
      // due_date is most accurate for aging, then invoice_date, then transaction dates
      const transactionDate =
        item.due_date ||
        item.invoice_date ||
        item.date ||
        item.createdAt ||
        item.created_at ||
        item.transaction_date ||
        item.transactionDate;
      if (!transactionDate) return;

      const date = new Date(transactionDate);
      if (isNaN(date.getTime())) return; // Invalid date

      const daysDiff = Math.floor((today - date) / (1000 * 60 * 60 * 24));

      // For AR: use amount_due, balance_due, balance, debit, amount, or total (outstanding amount)
      // For AP: use amount_due, balance_due, balance, credit, amount, or total (outstanding amount)
      const amount = parseFloat(
        item.amount_due ||
          item.balance_due ||
          item.balance ||
          item.outstanding_balance ||
          item.amount ||
          item.debit ||
          item.credit ||
          item.total ||
          0,
      );

      // Use absolute value for credit (AP) or ensure positive for AR
      const outstandingAmount = Math.abs(amount);
      if (isNaN(outstandingAmount) || outstandingAmount <= 0) return;

      // Age the outstanding amount
      if (daysDiff <= 0) {
        aging.current += outstandingAmount;
      } else if (daysDiff <= 30) {
        aging.days1to30 += outstandingAmount;
      } else if (daysDiff <= 60) {
        aging.days31to60 += outstandingAmount;
      } else if (daysDiff <= 90) {
        aging.days61to90 += outstandingAmount;
      } else {
        aging.days91Plus += outstandingAmount;
      }
    });

    return aging;
  };

  // Enhanced pie chart segments calculation with better visualization
  const calculatePieSegments = (aging) => {
    const total =
      aging.current +
      aging.days1to30 +
      aging.days31to60 +
      aging.days61to90 +
      aging.days91Plus;

    if (total === 0) {
      return {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
        circumference: 502,
        total: 0,
        percentages: {
          current: 0,
          days1to30: 0,
          days31to60: 0,
          days61to90: 0,
          days91Plus: 0,
        },
      };
    }

    const circumference = 2 * Math.PI * 80; // radius = 80
    const currentPercent = (aging.current / total) * 100;
    const days1to30Percent = (aging.days1to30 / total) * 100;
    const days31to60Percent = (aging.days31to60 / total) * 100;
    const days61to90Percent = (aging.days61to90 / total) * 100;
    const days91PlusPercent = (aging.days91Plus / total) * 100;

    return {
      current: (currentPercent / 100) * circumference,
      days1to30: (days1to30Percent / 100) * circumference,
      days31to60: (days31to60Percent / 100) * circumference,
      days61to90: (days61to90Percent / 100) * circumference,
      days91Plus: (days91PlusPercent / 100) * circumference,
      circumference,
      total,
      percentages: {
        current: currentPercent,
        days1to30: days1to30Percent,
        days31to60: days31to60Percent,
        days61to90: days61to90Percent,
        days91Plus: days91PlusPercent,
      },
    };
  };

  const renderAgingDonut = (aging) => {
    const segments = calculatePieSegments(aging);
    const total = segments.total;
    const offsets = {
      current: 0,
      days1to30: segments.current,
      days31to60: segments.current + segments.days1to30,
      days61to90:
        segments.current + segments.days1to30 + segments.days31to60,
      days91Plus:
        segments.current +
        segments.days1to30 +
        segments.days31to60 +
        segments.days61to90,
    };

    if (total === 0) {
      return (
        <>
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="40"
            transform="rotate(-90 100 100)"
          />
          <circle cx="100" cy="100" r="50" fill="white" />
          <text
            x="100"
            y="100"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-medium fill-gray-400"
          >
            No Data
          </text>
        </>
      );
    }

    return (
      <>
        {segments.current > 0.1 && (
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#10b981"
            strokeWidth="40"
            strokeDasharray={`${segments.current} ${segments.circumference}`}
            strokeDashoffset={-offsets.current}
            transform="rotate(-90 100 100)"
          />
        )}
        {segments.days1to30 > 0.1 && (
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="40"
            strokeDasharray={`${segments.days1to30} ${segments.circumference}`}
            strokeDashoffset={-offsets.days1to30}
            transform="rotate(-90 100 100)"
          />
        )}
        {segments.days31to60 > 0.1 && (
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#a855f7"
            strokeWidth="40"
            strokeDasharray={`${segments.days31to60} ${segments.circumference}`}
            strokeDashoffset={-offsets.days31to60}
            transform="rotate(-90 100 100)"
          />
        )}
        {segments.days61to90 > 0.1 && (
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="40"
            strokeDasharray={`${segments.days61to90} ${segments.circumference}`}
            strokeDashoffset={-offsets.days61to90}
            transform="rotate(-90 100 100)"
          />
        )}
        {segments.days91Plus > 0.1 && (
          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="#0f766e"
            strokeWidth="40"
            strokeDasharray={`${segments.days91Plus} ${segments.circumference}`}
            strokeDashoffset={-offsets.days91Plus}
            transform="rotate(-90 100 100)"
          />
        )}
        <circle cx="100" cy="100" r="50" fill="white" />
      </>
    );
  };

  const renderAgingLegend = (aging) => (
    <div className="space-y-2 text-xs flex-1 flex flex-col justify-center">
      {[
        { key: "current", label: "Current", color: "bg-green-500" },
        { key: "days1to30", label: "1 - 30", color: "bg-teal-500" },
        { key: "days31to60", label: "31 - 60", color: "bg-purple-500" },
        { key: "days61to90", label: "61 - 90", color: "bg-blue-500" },
        { key: "days91Plus", label: "91 and over", color: "bg-teal-700" },
      ].map(({ key, label, color }) => (
        <div key={key} className="flex items-center gap-2">
          <div className={`w-3 h-3 ${color} rounded-full`}></div>
          <span className="text-gray-600">{label}:</span>
          <span className="text-gray-900 ml-auto">
            {loading ? "..." : `₦${formatNumber1(aging[key] || 0)}`}
          </span>
        </div>
      ))}
    </div>
  );

  const fetchAccountsReceivable = useCallback(() => {
    if (!activeBusiness?.id) return;
    const fromDate = formatDateForAPI(range.from);
    const toDate = formatDateForAPI(range.to);

    _fetchApi(
      `/account/report/receivables/${fromDate}/${toDate}/${activeBusiness.id}`,
      (response) => {
        if (response && (response.data || response.results)) {
          // API returns { success: true, data: [...], total: ... }
          const transactions = Array.isArray(response.data)
            ? response.data
            : Array.isArray(response.results)
              ? response.results
              : [];

          const totalReceivable =
            response.total ||
            transactions.reduce((sum, receivable) => {
              const amount = parseFloat(
                receivable.balance ||
                  receivable.amount ||
                  receivable.total ||
                  receivable.debit ||
                  0,
              );
              return sum + (isNaN(amount) ? 0 : amount);
            }, 0);

          // Calculate aging from transaction dates
          const aging = calculateAging(transactions);
          setReceivableAging(aging);

          setDashboardData((prev) => ({
            ...prev,
            accountsReceivable: totalReceivable,
          }));
        }
      },
      (error) => {
        _fetchApi(
          `/account/customer/debitors/${activeBusiness.id}`,
          (fallbackResponse) => {
            if (
              fallbackResponse &&
              (fallbackResponse.data || fallbackResponse.results)
            ) {
              const transactions = Array.isArray(fallbackResponse.data)
                ? fallbackResponse.data
                : Array.isArray(fallbackResponse.results)
                  ? fallbackResponse.results
                  : [];

              const totalReceivable =
                fallbackResponse.total ||
                transactions.reduce((sum, receivable) => {
                  const amount = parseFloat(
                    receivable.balance || receivable.amount || 0,
                  );
                  return sum + (isNaN(amount) ? 0 : amount);
                }, 0);

              // Calculate aging
              const aging = calculateAging(transactions);
              setReceivableAging(aging);

              setDashboardData((prev) => ({
                ...prev,
                accountsReceivable: totalReceivable,
              }));
            }
          },
          (fallbackError) => {
            console.error("Error fetching accounts receivable:", fallbackError);
          },
        );
      },
    );
  }, [activeBusiness?.id, range.from, range.to]);

  // Fetch Bank Accounts with full data
  const fetchBankAccounts = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingBankAccounts(true);
    _fetchApi(
      `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
      (response) => {
        if (response && response.success && response.results) {
          const banks = Array.isArray(response.results) ? response.results : [];
          setBankAccountsList(banks);
          setDashboardData((prev) => ({ ...prev, bankAccounts: banks.length }));
        }
        setLoadingBankAccounts(false);
      },
      (error) => {
        console.error("Error fetching bank accounts:", error);
        setLoadingBankAccounts(false);
      },
    );
  }, [activeBusiness?.id]);

  // Fetch existing account codes
  const getExistingCodes = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setExistingCodes(resp.results.filter((account) => account.head != 0));
        } else {
          toast.error("Failed to load account codes.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching account codes.");
      },
    );
  }, [activeBusiness?.business_name]);

  // Fetch bank list
  const getBankList = useCallback(() => {
    const facilityId = activeBusiness?.id || activeBusiness?._id;
    if (!facilityId) {
      console.warn("No facilityId available, skipping bank list fetch");
      return;
    }

    _fetchApi(
      `/bank/list?facilityId=${facilityId}`,
      (data) => {
        if (data && data.success) {
          const results =
            data.results || data.data || data.banks || data.bankList || [];
          setBankList(Array.isArray(results) ? results : []);
        } else {
          console.error("Failed to load bank list:", data);
          setBankList([]);
        }
      },
      (err) => {
        console.error("Error fetching bank list:", err);
        setBankList([]);
      },
    );
  }, [activeBusiness?.id, activeBusiness?._id]);

  // Handle bank account form submission
  const handleBankSubmit = () => {
    if (!formData.bank_code) {
      toast.error("Please select a bank");
      return;
    }
    if (!formData.account_number) {
      toast.error("Please enter account number");
      return;
    }
    if (!formData.account_name) {
      toast.error("Please enter account name");
      return;
    }
    if (!formData.code) {
      toast.error("Please select account type");
      return;
    }

    setLoadingBank(true);

    const apiData = {
      account_number: formData.account_number,
      account_name: formData.account_name,
      user_id: currentUser.id,
      bank_code: formData.bank_code,
      bank_name: formData.bank_name,
      account_bank_type: formData.account_bank_type,
      head: formData.head,
      subhead: formData.subhead,
      facilityId: activeBusiness.id,
    };

    _postApi(
      "/api/add/bank-account",
      apiData,
      (res) => {
        if (res.success) {
          toast.success(res.message || "Bank account created successfully");
          handleBankCancel();
          fetchBankAccounts();
        } else {
          toast.error(res.message || "Failed to submit");
          setLoadingBank(false);
        }
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoadingBank(false);
      },
    );
  };

  // Handle bank modal cancel
  const handleBankCancel = () => {
    setIsBankModalOpen(false);
    setLoadingBank(false);
    setFormData({
      subhead: "",
      bank_code: "",
      bank_name: "",
      account_number: "",
      account_name: "",
      code: "",
      account_bank_type: "",
      head: null,
    });
  };

  // Get bank name from bank code
  const getBankName = (bankCode) => {
    const bank = bankList.find((b) => b.bank_code === bankCode);
    return bank?.bank_name || "Bank";
  };

  // Get bank initials for avatar
  const getBankInitials = (bankName) => {
    if (!bankName) return "BK";
    const words = bankName.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return bankName.substring(0, 2).toUpperCase();
  };

  // Unified dashboard data fetch function - Enhanced with proper A/R and A/P logic
  // Backend should implement the following enhanced SQL query for invoice-payment matching:
  /*
  Enhanced Invoice Query (for /api/enhanced/accounts-receivable, /api/enhanced/accounts-payable):

  SELECT
    i.invoice_id, i.invoice_ref, i.ref_number, i.type AS invoice_type,
    i.transaction_date, i.due_date, i.amount AS invoice_amount,
    -- Cap payment to invoice amount
    LEAST(COALESCE(p.total_paid, 0), i.amount) AS total_paid,
    -- Prevent negative balances
    GREATEST(i.amount - LEAST(COALESCE(p.total_paid, 0), i.amount), 0) AS balance_due,
    CASE
        WHEN COALESCE(p.total_paid, 0) = 0 THEN 'Unpaid'
        WHEN COALESCE(p.total_paid, 0) < i.amount THEN 'Partially Paid'
        ELSE 'Paid'
    END AS payment_status,
    CASE
        WHEN COALESCE(p.total_paid, 0) >= i.amount THEN 'Settled'
        WHEN i.due_date < CURDATE() THEN 'Overdue'
        ELSE 'Not Due Yet'
    END AS due_status
  FROM invoices i
  LEFT JOIN (
    SELECT
        gl.transaction_ref,
        SUM(
            CASE
                WHEN inv.type = 'sales' THEN gl.dr     -- Customer pays → Dr Bank (A/R)
                WHEN inv.type = 'purchase' THEN gl.cr  -- We pay supplier → Cr Bank (A/P)
                ELSE 0
            END
        ) AS total_paid
    FROM general_ledger gl
    JOIN invoices inv ON inv.ref_number = gl.transaction_ref
    WHERE gl.type = 'bank'
    GROUP BY gl.transaction_ref
  ) p ON p.transaction_ref = i.ref_number
  WHERE i.facility_id = :facilityId
  */
  const fetchDashboardData = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    const fromDate = formatDateForAPI(range.from);
    const toDate = formatDateForAPI(range.to);
    const salesFromDate = formatDateForAPI(salesPeriod.from);
    const salesToDate = formatDateForAPI(salesPeriod.to);
    const invoiceFromDate = formatDateForAPI(invoicesPeriod.from);
    const invoiceToDate = formatDateForAPI(invoicesPeriod.to);
    const asOfDateParam = formatDateForAPI(arApAsOfDate);

    // Make all API calls in parallel
    Promise.allSettled([
      // Expenses by Category - Uses new API endpoint with account_category join
      new Promise((resolve) => {
        _fetchApi(
          `/api/expenses/by-category/${fromDate}/${toDate}/${activeBusiness.id}`,
          (response) => {
            if (response && response.success) {
              const totalExpenses = parseFloat(response.total || 0);
              const categories = response.categories || [];

              resolve({
                type: "expenses",
                value: totalExpenses,
                categories: categories.length > 0 ? categories : [],
              });
            } else {
              // Fallback to old endpoint if new one fails
              _fetchApi(
                `/account/expenses/${fromDate}/${toDate}/${activeBusiness.id}`,
                (fallbackResponse) => {
                  if (fallbackResponse && fallbackResponse.results) {
                    const expenses = Array.isArray(fallbackResponse.results)
                      ? fallbackResponse.results
                      : [];
                    const totalExpenses = expenses.reduce((sum, expense) => {
                      const amount = parseFloat(
                        expense.amount ||
                          expense.total_amount ||
                          expense.debit ||
                          0,
                      );
                      return sum + (isNaN(amount) ? 0 : amount);
                    }, 0);

                    const categoryMap = {};
                    const colors = [
                      "#3b82f6",
                      "#14b8a6",
                      "#ef4444",
                      "#f97316",
                      "#8b5cf6",
                      "#ec4899",
                      "#10b981",
                    ];
                    let colorIndex = 0;

                    expenses.forEach((expense) => {
                      const categoryName =
                        expense.description ||
                        expense.account_description ||
                        expense.category_name ||
                        "Other";
                      const amount = parseFloat(
                        expense.amount || expense.debit || 0,
                      );
                      const key = expense.account_code || categoryName;

                      if (!categoryMap[key]) {
                        categoryMap[key] = {
                          name: categoryName,
                          amount: 0,
                          color: colors[colorIndex % colors.length],
                        };
                        colorIndex++;
                      }
                      categoryMap[key].amount += isNaN(amount) ? 0 : amount;
                    });

                    const expensesByCategory = Object.values(categoryMap)
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 7);

                    resolve({
                      type: "expenses",
                      value: totalExpenses || 0,
                      categories: expensesByCategory,
                    });
                  } else {
                    resolve({ type: "expenses", value: 0, categories: [] });
                  }
                },
                () => resolve({ type: "expenses", value: 0, categories: [] }),
              );
            }
          },
          (error) => {
            console.error("Error fetching expenses:", error);
            resolve({
              type: "expenses",
              value: 0,
              categories: [],
            });
          },
        );
      }),

      // Sales from invoices table (uses salesPeriod dates to match the SALES card)
      new Promise((resolve, reject) => {
        _fetchApi(
          `/api/sales/invoices/${salesFromDate}/${salesToDate}/${activeBusiness.id}`,
          (response) => {
            if (response && response.success) {
              const totalSales = parseFloat(response.total || 0);
              resolve({ type: "sales", value: totalSales });
            } else {
              resolve({ type: "sales", value: 0 });
            }
          },
          (error) => {
            console.error("Error fetching sales:", error);
            resolve({ type: "sales", value: 0 });
          },
        );
      }),

      // Monthly Sales from invoices table
      new Promise((resolve, reject) => {
        _fetchApi(
          `/api/sales/invoices/${salesFromDate}/${salesToDate}/${activeBusiness.id}`,
          (response) => {
            if (response && response.success) {
              // Backend returns {success: true, results: [...], total: ...}
              const sales = Array.isArray(response.results)
                ? response.results
                : Array.isArray(response.data)
                  ? response.data
                  : [];

              const monthlyData = {};

              sales.forEach((sale) => {
                const saleDate = sale.date || sale.transaction_date;
                if (!saleDate) return;

                const date = new Date(saleDate);
                if (isNaN(date.getTime())) return; // Skip invalid dates

                const monthKey = `${date.getFullYear()}-${String(
                  date.getMonth() + 1,
                ).padStart(2, "0")}`;
                const monthLabel = format(date, "MMM yyyy");

                if (!monthlyData[monthKey]) {
                  monthlyData[monthKey] = {
                    month: monthLabel,
                    amount: 0,
                    date: date,
                  };
                }

                const amount = parseFloat(sale.amount || 0);
                monthlyData[monthKey].amount += isNaN(amount) ? 0 : amount;
              });

              const monthlyArray = Object.values(monthlyData).sort(
                (a, b) => a.date - b.date,
              );

              // Also update total sales from API response
              const totalSales =
                response.total ||
                monthlyArray.reduce((sum, month) => sum + month.amount, 0);

              resolve({
                type: "monthlySales",
                value: monthlyArray,
                total: totalSales,
              });
            } else {
              resolve({ type: "monthlySales", value: [], total: 0 });
            }
          },
          (error) => {
            console.error("Error fetching monthly sales:", error);
            resolve({ type: "monthlySales", value: [], total: 0 });
          },
        );
      }),

      // Enhanced Accounts Payable with proper invoice-payment matching
      new Promise((resolve, reject) => {
        // Use dedicated Accounts Payable API endpoint
        _fetchApi(
          `/api/accounts-payable/dashboard-summary?facilityId=${activeBusiness.id}&asOf=${asOfDateParam}`,
          (response) => {
            if (response && response.success && response.results) {
              const data = response.results;
              resolve({
                type: "accountsPayable",
                value: parseFloat(data.totalPayable || 0),
                asOfDate: data.asOfDate,
                aging: data.aging || {
                  current: 0,
                  days1to30: 0,
                  days31to60: 0,
                  days61to90: 0,
                  days91Plus: 0,
                },
                breakdown: data.breakdown || {
                  unpaid: 0,
                  partiallyPaid: 0,
                  overdue: 0,
                },
              });
            } else {
              // Fallback to existing endpoint with enhanced processing
              _fetchApi(
                `/account/supplier/creditors/${activeBusiness.id}`,
                (fallbackResponse) => {
                  if (
                    fallbackResponse &&
                    fallbackResponse.success &&
                    fallbackResponse.results
                  ) {
                    const transactions = Array.isArray(fallbackResponse.results)
                      ? fallbackResponse.results
                      : Array.isArray(fallbackResponse.data)
                        ? fallbackResponse.data
                        : [];

                    // Enhanced calculation: Only count actual outstanding balances
                    const totalPayable = transactions.reduce((sum, payable) => {
                      const amount = parseFloat(
                        payable.balance_due ||
                          payable.amount ||
                          payable.balance ||
                          payable.outstanding_balance ||
                          payable.credit ||
                          0,
                      );
                      // Ensure positive values for payables
                      return sum + Math.max(0, Math.abs(amount));
                    }, 0);

                    const aging = calculateAging(transactions);
                    resolve({
                      type: "accountsPayable",
                      value: totalPayable,
                      aging: aging,
                      breakdown: {
                        unpaid: aging.current + aging.days1to30,
                        partiallyPaid: aging.days31to60,
                        overdue: aging.days61to90 + aging.days91Plus,
                      },
                    });
                  } else {
                    resolve({
                      type: "accountsPayable",
                      value: 0,
                      aging: {
                        current: 0,
                        days1to30: 0,
                        days31to60: 0,
                        days61to90: 0,
                        days91Plus: 0,
                      },
                      breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                    });
                  }
                },
                (fallbackError) => {
                  console.error(
                    "Error fetching accounts payable:",
                    fallbackError,
                  );
                  resolve({
                    type: "accountsPayable",
                    value: 0,
                    aging: {
                      current: 0,
                      days1to30: 0,
                      days31to60: 0,
                      days61to90: 0,
                      days91Plus: 0,
                    },
                    breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                  });
                },
              );
            }
          },
          (error) => {
            console.error("Error fetching enhanced A/P:", error);
            // Fallback to original endpoint
            _fetchApi(
              `/account/supplier/creditors/${activeBusiness.id}`,
              (fallbackResponse) => {
                if (
                  fallbackResponse &&
                  fallbackResponse.success &&
                  fallbackResponse.results
                ) {
                  const transactions = Array.isArray(fallbackResponse.results)
                    ? fallbackResponse.results
                    : Array.isArray(fallbackResponse.data)
                      ? fallbackResponse.data
                      : [];

                  const totalPayable = transactions.reduce((sum, payable) => {
                    const amount = parseFloat(
                      payable.amount ||
                        payable.balance ||
                        payable.outstanding_balance ||
                        payable.credit ||
                        0,
                    );
                    return sum + Math.max(0, Math.abs(amount));
                  }, 0);

                  const aging = calculateAging(transactions);
                  resolve({
                    type: "accountsPayable",
                    value: totalPayable,
                    aging: aging,
                    breakdown: {
                      unpaid: aging.current + aging.days1to30,
                      partiallyPaid: aging.days31to60,
                      overdue: aging.days61to90 + aging.days91Plus,
                    },
                  });
                } else {
                  resolve({
                    type: "accountsPayable",
                    value: 0,
                    aging: {
                      current: 0,
                      days1to30: 0,
                      days31to60: 0,
                      days61to90: 0,
                      days91Plus: 0,
                    },
                    breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                  });
                }
              },
              (fallbackError) => {
                console.error("Error fetching A/P fallback:", fallbackError);
                resolve({
                  type: "accountsPayable",
                  value: 0,
                  aging: {
                    current: 0,
                    days1to30: 0,
                    days31to60: 0,
                    days61to90: 0,
                    days91Plus: 0,
                  },
                  breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                });
              },
            );
          },
        );
      }),

      // Enhanced Accounts Receivable with proper invoice-payment matching
      new Promise((resolve, reject) => {
        // Use dedicated Accounts Receivable API endpoint
        _fetchApi(
          `/api/accounts-receivable/dashboard-summary?facilityId=${activeBusiness.id}&asOf=${asOfDateParam}`,
          (response) => {
            if (response && response.success && response.results) {
              const data = response.results;
              resolve({
                type: "accountsReceivable",
                value: parseFloat(data.totalReceivable || 0),
                asOfDate: data.asOfDate,
                aging: data.aging || {
                  current: 0,
                  days1to30: 0,
                  days31to60: 0,
                  days61to90: 0,
                  days91Plus: 0,
                },
                breakdown: data.breakdown || {
                  unpaid: 0,
                  partiallyPaid: 0,
                  overdue: 0,
                },
              });
            } else {
              // Fallback to existing endpoint with enhanced processing
              _fetchApi(
                `/account/report/receivables/${fromDate}/${toDate}/${activeBusiness.id}`,
                (fallbackResponse) => {
                  if (
                    fallbackResponse &&
                    fallbackResponse.success &&
                    (fallbackResponse.data || fallbackResponse.results)
                  ) {
                    const transactions = Array.isArray(fallbackResponse.data)
                      ? fallbackResponse.data
                      : Array.isArray(fallbackResponse.results)
                        ? fallbackResponse.results
                        : [];

                    let totalReceivable = 0;
                    if (
                      fallbackResponse.total !== undefined &&
                      fallbackResponse.total !== null
                    ) {
                      totalReceivable = parseFloat(fallbackResponse.total) || 0;
                    } else {
                      // Enhanced calculation: Only count actual outstanding balances
                      totalReceivable = transactions.reduce(
                        (sum, receivable) => {
                          const amount = parseFloat(
                            receivable.balance_due ||
                              receivable.amount ||
                              receivable.balance ||
                              receivable.outstanding_balance ||
                              0,
                          );
                          return sum + Math.max(0, amount); // Prevent negative balances
                        },
                        0,
                      );
                    }

                    const aging = calculateAging(transactions);
                    resolve({
                      type: "accountsReceivable",
                      value: totalReceivable,
                      aging: aging,
                      breakdown: {
                        unpaid: aging.current + aging.days1to30,
                        partiallyPaid: aging.days31to60,
                        overdue: aging.days61to90 + aging.days91Plus,
                      },
                    });
                  } else {
                    resolve({
                      type: "accountsReceivable",
                      value: 0,
                      aging: {
                        current: 0,
                        days1to30: 0,
                        days31to60: 0,
                        days61to90: 0,
                        days91Plus: 0,
                      },
                      breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                    });
                  }
                },
                (fallbackError) => {
                  console.error(
                    "Error fetching accounts receivable:",
                    fallbackError,
                  );
                  resolve({
                    type: "accountsReceivable",
                    value: 0,
                    aging: {
                      current: 0,
                      days1to30: 0,
                      days31to60: 0,
                      days61to90: 0,
                      days91Plus: 0,
                    },
                    breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                  });
                },
              );
            }
          },
          (error) => {
            console.error("Error fetching enhanced A/R:", error);
            // Fallback to original endpoint
            _fetchApi(
              `/account/customer/debitors/${activeBusiness.id}`,
              (fallbackResponse) => {
                if (
                  fallbackResponse &&
                  fallbackResponse.success &&
                  (fallbackResponse.data || fallbackResponse.results)
                ) {
                  const transactions = Array.isArray(fallbackResponse.data)
                    ? fallbackResponse.data
                    : Array.isArray(fallbackResponse.results)
                      ? fallbackResponse.results
                      : [];

                  let totalReceivable = 0;
                  if (
                    fallbackResponse.total !== undefined &&
                    fallbackResponse.total !== null
                  ) {
                    totalReceivable = parseFloat(fallbackResponse.total) || 0;
                  } else {
                    totalReceivable = transactions.reduce((sum, receivable) => {
                      const amount = parseFloat(
                        receivable.amount ||
                          receivable.balance ||
                          receivable.outstanding_balance ||
                          0,
                      );
                      return sum + Math.max(0, amount);
                    }, 0);
                  }

                  const aging = calculateAging(transactions);
                  resolve({
                    type: "accountsReceivable",
                    value: totalReceivable,
                    aging: aging,
                    breakdown: {
                      unpaid: aging.current + aging.days1to30,
                      partiallyPaid: aging.days31to60,
                      overdue: aging.days61to90 + aging.days91Plus,
                    },
                  });
                } else {
                  resolve({
                    type: "accountsReceivable",
                    value: 0,
                    aging: {
                      current: 0,
                      days1to30: 0,
                      days31to60: 0,
                      days61to90: 0,
                      days91Plus: 0,
                    },
                    breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                  });
                }
              },
              (fallbackError) => {
                console.error("Error fetching A/R fallback:", fallbackError);
                resolve({
                  type: "accountsReceivable",
                  value: 0,
                  aging: {
                    current: 0,
                    days1to30: 0,
                    days31to60: 0,
                    days61to90: 0,
                    days91Plus: 0,
                  },
                  breakdown: { unpaid: 0, partiallyPaid: 0, overdue: 0 },
                });
              },
            );
          },
        );
      }),

      // Bank Accounts
      new Promise((resolve, reject) => {
        _fetchApi(
          `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
          (response) => {
            if (response && response.success && response.results) {
              const banks = Array.isArray(response.results)
                ? response.results
                : [];
              resolve({ type: "bankAccounts", value: banks, list: banks });
            } else {
              resolve({
                type: "bankAccounts",
                value: 0,
                list: [],
              });
            }
          },
          (error) => {
            console.error("Error fetching bank accounts:", error);
            resolve({
              type: "bankAccounts",
              value: 0,
              list: [],
            });
          },
        );
      }),

      // Cash Flow Data - Uses new API endpoint with general_ledger type='bank'
      new Promise((resolve) => {
        // Calculate date range for last 12 months
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);
        const cashFlowFromDate = formatDateForAPI(startDate);
        const cashFlowToDate = formatDateForAPI(endDate);

        _fetchApi(
          `/api/cash-flow/dashboard/${activeBusiness.id}?from=${cashFlowFromDate}&to=${cashFlowToDate}`,
          (response) => {
            if (response && response.success && response.results) {
              const data = response.results;
              resolve({
                type: "cashFlow",
                value: {
                  monthlyBalance: data.monthlyBalance || [],
                  projectedBalance: data.projectedBalance || [],
                  threshold: parseFloat(data.threshold || 0),
                  currentBalance: parseFloat(data.currentBalance || 0),
                  totalInflow: parseFloat(data.totalInflow || 0),
                  totalOutflow: parseFloat(data.totalOutflow || 0),
                },
              });
            } else {
              // Fallback to calculating from multiple endpoints if new API fails
              Promise.all([
                new Promise((res) => {
                  _fetchApi(
                    `/get/daily/sales/${cashFlowFromDate}/${cashFlowToDate}/${activeBusiness.id}`,
                    (salesResponse) => res(salesResponse?.results || []),
                    () => res([]),
                  );
                }),
                new Promise((res) => {
                  _fetchApi(
                    `/account/expenses/${cashFlowFromDate}/${cashFlowToDate}/${activeBusiness.id}`,
                    (expensesResponse) => res(expensesResponse?.results || []),
                    () => res([]),
                  );
                }),
              ])
                .then(([sales, expenses]) => {
                  const monthlyData = {};
                  const months = [];

                  for (let i = 11; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    const monthKey = `${date.getFullYear()}-${String(
                      date.getMonth() + 1,
                    ).padStart(2, "0")}`;
                    const monthLabel = format(date, "MMM");
                    monthlyData[monthKey] = {
                      month: monthLabel,
                      cashIn: 0,
                      cashOut: 0,
                      balance: 0,
                    };
                    months.push(monthKey);
                  }

                  (Array.isArray(sales) ? sales : []).forEach((sale) => {
                    const saleDate = sale.date || sale.transaction_date;
                    if (!saleDate) return;
                    const date = new Date(saleDate);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                    if (monthlyData[monthKey]) {
                      monthlyData[monthKey].cashIn +=
                        parseFloat(sale.total || sale.amount || 0) || 0;
                    }
                  });

                  (Array.isArray(expenses) ? expenses : []).forEach(
                    (expense) => {
                      const expenseDate =
                        expense.date || expense.transaction_date;
                      if (!expenseDate) return;
                      const date = new Date(expenseDate);
                      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
                      if (monthlyData[monthKey]) {
                        monthlyData[monthKey].cashOut +=
                          parseFloat(expense.amount || expense.debit || 0) || 0;
                      }
                    },
                  );

                  let runningBalance = 0;
                  const monthlyBalance = [];
                  const projectedBalance = [];

                  months.forEach((monthKey) => {
                    const data = monthlyData[monthKey];
                    const netCashFlow = data.cashIn - data.cashOut;
                    runningBalance += netCashFlow;
                    monthlyBalance.push({
                      month: data.month,
                      balance: Math.max(0, runningBalance),
                    });
                    projectedBalance.push({
                      month: data.month,
                      balance: Math.max(0, runningBalance * 1.05),
                    });
                  });

                  const currentBalance =
                    monthlyBalance[monthlyBalance.length - 1]?.balance || 0;
                  const avgMonthlyExpenses =
                    expenses.length > 0
                      ? expenses.reduce(
                          (sum, exp) =>
                            sum + parseFloat(exp.amount || exp.debit || 0),
                          0,
                        ) / 12
                      : 0;

                  resolve({
                    type: "cashFlow",
                    value: {
                      monthlyBalance,
                      projectedBalance,
                      threshold: Math.max(0, avgMonthlyExpenses * 1.5),
                      currentBalance: currentBalance > 0 ? currentBalance : 0,
                    },
                  });
                })
                .catch(() => {
                  resolve({
                    type: "cashFlow",
                    value: {
                      monthlyBalance: [],
                      projectedBalance: [],
                      threshold: 0,
                      currentBalance: 0,
                    },
                  });
                });
            }
          },
          (error) => {
            console.error("Error fetching cash flow:", error);
            resolve({
              type: "cashFlow",
              value: {
                monthlyBalance: [],
                projectedBalance: [],
                threshold: 0,
                currentBalance: 0,
              },
            });
          },
        );
      }),

      // Invoices Dashboard Summary
      new Promise((resolve, reject) => {
        _fetchApi(
          `/api/invoices/dashboard-summary?facilityId=${activeBusiness.id}&from=${invoiceFromDate}&to=${invoiceToDate}`,
          (response) => {
            if (response && response.success && response.results) {
              const data = response.results;
              resolve({
                type: "invoices",
                value: {
                  count: parseFloat(data.totalInvoices || 0),
                  data: {
                    activityLast30Days: {
                      invoiced: parseFloat(
                        data.activityLast30Days?.invoiced ??
                          data.breakdown?.sales ??
                          0,
                      ),
                      received: parseFloat(
                        data.activityLast30Days?.received ??
                          data.collectedLast30Days ??
                          data.paid?.total ??
                          0,
                      ),
                    },
                    period: data.period,
                    asOfDate: data.asOfDate,
                  },
                },
              });
            } else {
              resolve({
                type: "invoices",
                value: {
                  count: 0,
                  data: {
                    activityLast30Days: { invoiced: 0, received: 0 },
                  },
                },
              });
            }
          },
          (error) => {
            console.error("Error fetching invoices:", error);
            resolve({
              type: "invoices",
              value: {
                count: 0,
                data: {
                  activityLast30Days: { invoiced: 0, received: 0 },
                },
              },
            });
          },
        );
      }),
    ]).then((results) => {
      // Process all results
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          const { type, value, aging, list, categories } = result.value;

          switch (type) {
            case "expenses":
              setDashboardData((prev) => ({ ...prev, expenses: value }));
              if (categories) setExpensesByCategory(categories);
              break;
            case "sales":
              setDashboardData((prev) => ({ ...prev, sales: value }));
              break;
            case "monthlySales":
              setMonthlySales(value);
              // Also update total sales from monthly sales response
              if (result.value.total !== undefined) {
                setDashboardData((prev) => ({
                  ...prev,
                  sales: result.value.total,
                }));
              }
              break;
            case "accountsPayable":
              setDashboardData((prev) => ({ ...prev, accountsPayable: value }));
              if (aging) setPayableAging(aging);
              // Store breakdown data for enhanced reporting
              if (result.value.breakdown) {
                setDashboardData((prev) => ({
                  ...prev,
                  accountsPayableBreakdown: result.value.breakdown,
                }));
              }
              break;
            case "accountsReceivable":
              setDashboardData((prev) => ({
                ...prev,
                accountsReceivable: value,
              }));
              if (aging) setReceivableAging(aging);
              // Store breakdown data for enhanced reporting
              if (result.value.breakdown) {
                setDashboardData((prev) => ({
                  ...prev,
                  accountsReceivableBreakdown: result.value.breakdown,
                }));
              }
              break;
            case "invoices":
              setDashboardData((prev) => ({
                ...prev,
                invoices: value.count || value,
              }));
              if (value.data) {
                setInvoicesData({
                  activityLast30Days: {
                    invoiced: parseFloat(
                      value.data.activityLast30Days?.invoiced ?? 0,
                    ),
                    received: parseFloat(
                      value.data.activityLast30Days?.received ?? 0,
                    ),
                  },
                });
              }
              break;
            case "bankAccounts":
              setDashboardData((prev) => ({ ...prev, bankAccounts: value }));
              if (list) setBankAccountsList(list);
              break;
            case "cashFlow":
              setCashFlowData(value);
              setCashFlowLastUpdated(new Date());
              break;
          }
        }
      });

      setLoading(false);
    });
  }, [
    activeBusiness?.id,
    range.from,
    range.to,
    salesPeriod.from,
    salesPeriod.to,
    invoicesPeriod.from,
    invoicesPeriod.to,
    arApAsOfDate,
  ]);

  useEffect(() => {
    if (activeBusiness?.id) {
      fetchDashboardData();
      // fetchInvoices is now handled within fetchDashboardData
      getExistingCodes();
      getBankList();
    }
  }, [
    activeBusiness?.id,
    range.from,
    range.to,
    salesPeriod.from,
    salesPeriod.to,
    invoicesPeriod.from,
    invoicesPeriod.to,
    arApAsOfDate,
    fetchDashboardData,
    getExistingCodes,
    getBankList,
  ]);

  // Reset bank accounts pagination when list changes
  useEffect(() => {
    setBankAccountsPage(0);
  }, [bankAccountsList.length]);

  const dashboardCards = [
    {
      key: "invoices",
      label: labels.dashboardInvoices,
      value: dashboardData.invoices,
      icon: FileText,
      format: "number",
    },
    {
      key: "bankAccounts",
      label: labels.dashboardBankAccounts,
      value: dashboardData.bankAccounts,
      icon: Building2,
      format: "number",
    },
    // {
    //   key: "referrals",
    //   label: "Referrals",
    //   value: 0,
    //   icon: TrendingUp,
    //   format: "number",
    // },
    {
      key: "sales",
      label: labels.dashboardSales,
      value: dashboardData.sales,
      icon: TrendingUp,
      format: "currency",
    },
    {
      key: "accountsReceivable",
      label: labels.dashboardReceivable,
      value: dashboardData.accountsReceivable,
      icon: Receipt,
      format: "currency",
    },
    {
      key: "accountsPayable",
      label: labels.dashboardPayable,
      value: dashboardData.accountsPayable,
      icon: CreditCard,
      format: "currency",
    },
    {
      key: "expenses",
      label: labels.dashboardExpenses,
      value: dashboardData.expenses,
      icon: TrendingDown,
      format: "currency",
    },
    {
      key: "cashFlow",
      label: labels.dashboardCashFlow,
      value: 0, // Will be calculated from bank accounts
      icon: DollarSign,
      format: "currency",
    },
  ];

  const visibleCards = dashboardCards.filter(
    (card) => cardVisibility[card.key],
  );

  const onSelectRange = (selected) => {
    setRange({
      from: selected.from,
      to: selected.to,
    });
  };

  const bankAccountsCard = cardVisibility.bankAccounts && (
    !loadingBankAccounts ? (
      <BankAccountsCardSkeletonNew />
    ) : (
      <div
        className="relative overflow-hidden rounded-xl border bg-white p-4 sm:p-5"
        style={{
          background: "linear-gradient(135deg, #1a2d5e14 0%, #ffffff 55%)",
          borderColor: "#1a2d5e40",
        }}
      >
        <span className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-[#1a2d5e]" />
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1a2d5e]">
            {labels.dashboardBankAccounts}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                navigate("/app/reports/accounting-reports/bank-balances")
              }
              className="text-xs font-medium text-[#1a2d5e] hover:underline"
            >
              View
            </button>
            {bankAccountsList.length > 3 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setBankAccountsPage(Math.max(0, bankAccountsPage - 1))
                  }
                  disabled={bankAccountsPage === 0}
                  className="rounded border border-[#1a2d5e]/30 p-1 text-[#1a2d5e] hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-xs text-gray-500">
                  {bankAccountsPage * 3 + 1}-
                  {Math.min(
                    (bankAccountsPage + 1) * 3,
                    bankAccountsList.length,
                  )}{" "}
                  of {bankAccountsList.length}
                </span>
                <button
                  onClick={() =>
                    setBankAccountsPage(
                      Math.min(
                        Math.ceil(bankAccountsList.length / 3) - 1,
                        bankAccountsPage + 1,
                      ),
                    )
                  }
                  disabled={
                    bankAccountsPage >=
                    Math.ceil(bankAccountsList.length / 3) - 1
                  }
                  className="rounded border border-[#1a2d5e]/30 p-1 text-[#1a2d5e] hover:bg-white disabled:opacity-40"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={() => setIsBankModalOpen(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: "#1a2d5e" }}
            >
              <Plus className="h-3 w-3" /> Add bank
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-600">
          Total balance:{" "}
          <span className="text-base font-semibold tabular-nums text-[#1a2d5e]">
            ₦
            {formatNumber1(
              bankAccountsList.reduce(
                (sum, a) => sum + parseFloat(a.balance || 0),
                0,
              ),
            )}
          </span>
        </p>
        <div className="space-y-2">
          {bankAccountsList.length === 0 ? (
            <div className="py-3 text-center text-sm text-gray-500">
              No bank accounts linked
            </div>
          ) : (
            (() => {
              const itemsPerPage = 3;
              const startIndex = bankAccountsPage * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedAccounts = bankAccountsList.slice(
                startIndex,
                endIndex,
              );

              return (
                <>
                  {paginatedAccounts.map((account) => {
                    const bal = parseFloat(account.balance || 0);
                    return (
                      <div
                        key={account.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 bg-white/80 px-2 py-2 hover:bg-white"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1a2d5e]">
                            <span className="text-xs font-bold text-white">
                              {getBankInitials(account.bank_name)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {account.account_name || "Bank Account"}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {account.bank_name}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              bal < 0 ? "text-red-500" : "text-[#1a2d5e]"
                            }`}
                          >
                            ₦{formatNumber1(bal)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-[#1a2d5e]" />
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()
          )}
        </div>
      </div>
    )
  );

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <main className="pb-4 sm:pb-8">
          <FinancialOverviewSection
            facilityId={activeBusiness?.id}
            labels={labels}
            bankAccountsSlot={bankAccountsCard}
            hasProduction={hasProduction}
          />
        </main>
      </div>

      {/* Add Bank Account Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Add New Bank Account
                </h2>
                <button
                  onClick={handleBankCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Head
                  </label>
                  <Typeahead
                    id="material-typeahead"
                    options={existingCodes}
                    className="z-100"
                    placeholder="Select account head"
                    selected={existingCodes.filter(
                      (code) => code.head === formData.subhead,
                    )}
                    onChange={(selected) => {
                      const selectedSubhead = [
                        selected[0]?.head,
                        selected[0]?.description,
                      ];
                      setFormData((prev) => ({
                        ...prev,
                        subhead: selectedSubhead[0],
                        head: null,
                      }));
                    }}
                    labelKey={(option) =>
                      `${option.description} - (${option.head})`
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Bank <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={formData.bank_code}
                      onValueChange={(value) => {
                        const selectedBank = bankList.find(
                          (bank) => bank.bank_code === value,
                        );
                        if (selectedBank) {
                          setFormData({
                            ...formData,
                            bank_code: selectedBank.bank_code,
                            bank_name: selectedBank.bank_name,
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankList.map((item, index) => (
                          <SelectItem key={index} value={item.bank_code}>
                            {item.bank_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.account_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          account_number: e.target.value,
                        })
                      }
                      placeholder="0000000000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.account_name}
                    onChange={(e) =>
                      setFormData({ ...formData, account_name: e.target.value })
                    }
                    placeholder="Account holder name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.code}
                    onValueChange={(value) => {
                      const selectedType = accountTypes.find(
                        (type) => type.code === value,
                      );
                      if (selectedType) {
                        setFormData({
                          ...formData,
                          code: selectedType.code,
                          account_bank_type: selectedType.code,
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Bank Account Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map((item, index) => (
                        <SelectItem key={index} value={item.code}>
                          {item.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleBankSubmit}
                    disabled={loadingBank}
                    className="flex-[2] flex items-center justify-center gap-2 bg-[#4267B2] hover:bg-[#365899]"
                  >
                    {loadingBank ? (
                      <Loader className="animate-spin w-4 h-4 mx-auto" />
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={handleBankCancel}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
