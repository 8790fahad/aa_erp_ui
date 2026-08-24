import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Users,
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
  UserCheck,
  AlertCircle,
  CheckCircle,
  Briefcase,
  PieChart as PieChartIcon,
  Banknote
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";

const HRDashboard = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId;
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const secondaryColor =
    activeBusiness?.secondary_color &&
    String(activeBusiness.secondary_color).toLowerCase() !== "#ffffff"
      ? activeBusiness.secondary_color
      : primaryColor;
  const appColorStyle = {
    ["--app-primary"]: primaryColor,
    ["--app-secondary"]: secondaryColor,
  };
  const COLORS = [primaryColor, '#10b981', '#f59e0b', '#ef4444', secondaryColor, '#ec4899'];

  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingLeaves: 0,
    monthlyPayroll: 0,
    attendanceRate: 0,
    activeLoans: 0,
  });

  const [departmentData, setDepartmentData] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (facilityId) fetchDashboardData();
  }, [facilityId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Parallel API calls
      const [employeesRes, leavesRes, loansRes] = await Promise.all([
        fetch(`/api/hr/employees?limit=1000&facilityId=${facilityId}`),
        fetch(`/api/hr/leaves?status=Pending&limit=10&facilityId=${facilityId}`),
        fetch(`/api/hr/loans?facilityId=${facilityId}`),
      ]);

      const employeesData = await employeesRes.json();
      const leavesData = await leavesRes.json();
      const loansData = await loansRes.json();

      const emps = employeesData.data?.employees || [];
      const loans = loansData.data || [];

      // Calculate stats
      const totalEmps = emps.length;
      const activeEmps = emps.filter((emp) => emp.status === "Active").length;
      const actLoans = loans.filter((l) => l.status === "Approved" || l.status === "Repaying").length;
      
      // Calculate department distribution
      const deptCounts = {};
      emps.forEach(emp => {
        const deptName = emp.department?.departmentName || "Unassigned";
        deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
      });
      
      const deptChartData = Object.keys(deptCounts).map((key) => ({
        name: key,
        value: deptCounts[key]
      })).sort((a,b) => b.value - a.value).slice(0, 5); // top 5 departments

      // Mock attendance trend for 7 days (usually fetched from a report API)
      const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          rate: Math.floor(Math.random() * (100 - 85) + 85) // Random rate between 85-100%
        };
      });

      setStats({
        totalEmployees: totalEmps,
        activeEmployees: activeEmps,
        pendingLeaves: leavesData.data?.pagination?.total || 0,
        monthlyPayroll: 1250000, // Hardcoded placeholder until payroll history API is connected to dashboard
        attendanceRate: 94,
        activeLoans: actLoans,
      });

      setDepartmentData(deptChartData.length ? deptChartData : [{ name: "No Data", value: 1 }]);
      setAttendanceTrend(last7Days);
      setLoading(false);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard metrics");
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Active Headcount",
      value: stats.activeEmployees,
      total: stats.totalEmployees,
      icon: Users,
      color: "from-[color:var(--app-primary)] to-[color:var(--app-secondary)]",
      lightBg: "bg-[color:var(--app-primary)]/10",
      iconColor: "text-[color:var(--app-primary)]",
      trend: "+2 this month"
    },
    {
      title: "Est. Monthly Payroll",
      value: `₦${stats.monthlyPayroll.toLocaleString()}`,
      icon: DollarSign,
      color: "from-emerald-500 to-emerald-600",
      lightBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      trend: "+5% vs last month"
    },
    {
      title: "Avg. Attendance Rate",
      value: `${stats.attendanceRate}%`,
      icon: Clock,
      color: "from-[color:var(--app-primary)] to-[color:var(--app-secondary)]",
      lightBg: "bg-[color:var(--app-primary)]/10",
      iconColor: "text-[color:var(--app-primary)]",
      trend: "Optimal"
    },
    {
      title: "Active Loans",
      value: stats.activeLoans,
      icon: Banknote,
      color: "from-amber-500 to-amber-600",
      lightBg: "bg-amber-50",
      iconColor: "text-amber-600",
      trend: "Total disbursements"
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]" style={appColorStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--app-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-gray-50/50 min-h-screen" style={appColorStyle}>
      
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">HR Analytics Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening with your workforce today.</p>
        </div>
        <div className="mt-4 md:mt-0">
          <CustomButton onClick={fetchDashboardData} mb="0">
            Refresh Data
          </CustomButton>
        </div>
      </div>

      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.lightBg}`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              {stat.total && (
                <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium">
                  {stat.total} Total
                </span>
              )}
            </div>
            <div>
              <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.title}</h3>
              <div className="text-2xl font-bold text-gray-900 tracking-tight">{stat.value}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-500 flex items-center font-medium">
                <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart Area */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-[color:var(--app-primary)]" />
              7-Day Attendance Trend
            </h3>
            <select className="bg-gray-50 border-gray-200 text-sm rounded-lg py-1.5 px-3">
              <option>Past 7 days</option>
              <option>Past 30 days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`${value}%`, 'Attendance Rate']}
                />
                <Area type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Mini Charts & Actions */}
        <div className="col-span-1 space-y-6">
          
          {/* Department Pie Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <PieChartIcon className="w-5 h-5 mr-2 text-[color:var(--app-primary)]" />
              Workforce Distribution
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Tasks */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Tasks</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-red-500 mr-3" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Leave Requests</p>
                    <p className="text-xs text-red-600">{stats.pendingLeaves} awaiting approval</p>
                  </div>
                </div>
                <button className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors">
                  Review
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-[color:var(--app-primary)]/10 rounded-xl border border-[color:var(--app-primary)]/20">
                <div className="flex items-center">
                  <Briefcase className="w-5 h-5 text-[color:var(--app-primary)] mr-3" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Contract Renewals</p>
                    <p className="text-xs text-[color:var(--app-primary)]">2 expiring this month</p>
                  </div>
                </div>
                <button className="text-xs font-semibold text-[color:var(--app-primary)] bg-[color:var(--app-primary)]/15 px-3 py-1.5 rounded-lg hover:opacity-90 transition-colors">
                  View
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HRDashboard;
