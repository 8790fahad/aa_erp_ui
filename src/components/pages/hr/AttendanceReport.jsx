import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  MoreVertical,
  Calendar,
  Clock,
  User,
  Building,
  Download,
  RefreshCw,
  Eye,
  Edit,
} from "lucide-react";
import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { toast } from "sonner";

const AttendanceReport = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
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
  const brandButtonStyle = {
    backgroundColor: primaryColor,
    borderColor: primaryColor,
    color: "#fff",
  };

  const [attendanceData, setAttendanceData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [appliedDate, setAppliedDate] = useState(today);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    if (facilityId) {
      fetchAttendanceReport();
    } else {
      console.warn("facilityId not available, cannot fetch attendance report");
      toast.error("Facility ID not available. Please check your login status.");
    }

    const handleAttendanceUpdate = () => {
      fetchAttendanceReport();
    };

    window.addEventListener("attendanceUpdated", handleAttendanceUpdate);

    return () => {
      window.removeEventListener("attendanceUpdated", handleAttendanceUpdate);
    };
  }, [facilityId, currentPage, selectedStatus, selectedDepartment, appliedDate]);

  useEffect(() => {
    filterData();
  }, [attendanceData, searchTerm, selectedStatus, selectedDepartment]);

  const fetchAttendanceReport = async (dateOverride) => {
    try {
      setLoading(true);
      const dateToUse = dateOverride ?? appliedDate;

      const params = new URLSearchParams({
        facilityId: facilityId,
        page: currentPage.toString(),
        limit: "10",
      });

      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedDepartment) params.append("departmentId", selectedDepartment);
      if (dateToUse) {
        params.append("startDate", dateToUse);
        params.append("endDate", dateToUse);
      }

      const response = await fetch(`/api/hr/attendance/report?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAttendanceData(data.data.attendance || []);
        setSummary(data.data.summary || {});
        setTotalPages(data.data.pagination?.pages || 1);
      } else {
        console.error("Error fetching attendance report:", data.message);
        toast.error(data.message || "Error fetching attendance report");
        setAttendanceData([]);
        setSummary({});
      }
    } catch (error) {
      console.error("Error fetching attendance report:", error);
      toast.error(`Error fetching attendance report: ${error.message}`);
      setAttendanceData([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...attendanceData];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.employee?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employee?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employee?.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (selectedStatus) {
      filtered = filtered.filter((item) => item.status === selectedStatus);
    }

    // Department filter
    if (selectedDepartment) {
      filtered = filtered.filter((item) => 
        item.employee?.department?.id === selectedDepartment
      );
    }

    setFilteredData(filtered);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleStatusFilter = (e) => {
    setSelectedStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleDepartmentFilter = (e) => {
    setSelectedDepartment(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("");
    setSelectedDepartment("");
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setCurrentPage(1);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      Present: "bg-green-100 text-green-800",
      Absent: "bg-red-100 text-red-800",
      Late: "bg-yellow-100 text-yellow-800",
      "Half Day": "bg-orange-100 text-orange-800",
      "On Leave": "bg-[color:var(--app-primary)]/15 text-[color:var(--app-primary)]",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          statusStyles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  };

  const formatTime = (time) => {
    if (!time) return "-";
    return time;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatHours = (hours) => {
    if (!hours || hours === 0) return "0.00";
    return parseFloat(hours).toFixed(2);
  };

  const handleExport = () => {
    toast.info("Export functionality will be implemented soon");
  };

  const handleRefresh = () => {
    fetchAttendanceReport(appliedDate);
  };

  const handleApplyDate = () => {
    if (!selectedDate) return;
    setCurrentPage(1);
    if (selectedDate === appliedDate) {
      fetchAttendanceReport(selectedDate);
    } else {
      setAppliedDate(selectedDate);
    }
  };

  const handleViewAttendance = (item) => {
    toast.info(`Viewing attendance for ${item.employee?.firstName} ${item.employee?.lastName}`);
  };

  const handleEditAttendance = (item) => {
    toast.info(`Editing attendance for ${item.employee?.firstName} ${item.employee?.lastName}`);
  };

  // Define columns for CustomTable1
  const columns = [
    {
      value: "employee",
      title: "Employee",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            {item.employee?.photoUrl ? (
              <img
                className="h-10 w-10 rounded-full"
                src={item.employee.photoUrl}
                alt={item.employee.firstName}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-600" />
              </div>
            )}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {item.employee?.firstName} {item.employee?.lastName}
            </div>
            <div className="text-sm text-gray-500">
              {item.employee?.employeeId}
            </div>
            {item.employee?.department?.departmentName && (
              <div className="text-xs text-gray-400">
                {item.employee.department.departmentName}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      value: "date",
      title: "Date",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">
            {formatDate(item.date)}
          </span>
        </div>
      ),
    },
    {
      value: "clockInTime",
      title: "Clock In",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="flex items-center">
          <Clock className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">
            {formatTime(item.clockInTime)}
          </span>
        </div>
      ),
    },
    {
      value: "clockOutTime",
      title: "Clock Out",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="flex items-center">
          <Clock className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">
            {formatTime(item.clockOutTime)}
          </span>
        </div>
      ),
    },
    {
      value: "totalHours",
      title: "Total Hours",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm text-gray-900">
          {formatHours(item.totalHours)} hrs
        </div>
      ),
    },
    {
      value: "overtimeHours",
      title: "Overtime",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm text-gray-900">
          {formatHours(item.overtimeHours)} hrs
        </div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          {getStatusBadge(item.status)}
        </div>
      ),
    },
    {
      value: "remarks",
      title: "Remarks",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm text-gray-900 max-w-xs truncate">
          {item.remarks || "-"}
        </div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => handleViewAttendance(item)}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditAttendance(item)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={appColorStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--app-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={appColorStyle}>
      <div className="max-w-7xl mx-auto">
        <div className="p-6 px-1">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Attendance Report
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Total Records:{" "}
                <span className="font-semibold text-gray-900">
                  {summary.totalRecords || 0}
                </span>
              </span>
              <span className="text-sm text-gray-600">
                Present:{" "}
                <span className="font-semibold text-green-600">
                  {summary.presentCount || 0}
                </span>
              </span>
              <span className="text-sm text-gray-600">
                Absent:{" "}
                <span className="font-semibold text-red-600">
                  {summary.absentCount || 0}
                </span>
              </span>
              <span className="text-sm text-gray-600">
                Rate:{" "}
                <span className="font-semibold" style={{ color: primaryColor }}>
                  {summary.attendanceRate || 0}%
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row align-items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search attendance by employee name, ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": primaryColor }}
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                className="text-sm font-medium whitespace-nowrap"
                htmlFor="attendance-date"
                style={{ color: primaryColor }}
              >
                As of:
              </label>
              <input
                id="attendance-date"
                type="date"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": primaryColor }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <Button
                type="button"
                onClick={handleApplyDate}
                disabled={loading || !selectedDate}
                className="px-4 h-10 text-white hover:opacity-90"
                style={brandButtonStyle}
              >
                Apply
              </Button>
            </div>
            <CustomButton onClick={handleExport} mb="0">
              <Download className="w-5 h-5" />
              Export Report
            </CustomButton>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <CustomTable1
              data={filteredData}
              fields={columns}
              loading={loading}
              message="No attendance records found"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReport;