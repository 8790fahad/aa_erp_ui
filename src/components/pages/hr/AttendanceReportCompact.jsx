import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RefreshCw, Users } from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AttendanceReportCompact = ({ onViewFullReport }) => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const secondaryColor = activeBusiness?.secondary_color;
  const gradientEnd =
    secondaryColor && String(secondaryColor).toLowerCase() !== "#ffffff"
      ? secondaryColor
      : primaryColor;
  const headerGradient = `linear-gradient(to right, ${primaryColor}, ${gradientEnd})`;

  const [attendanceData, setAttendanceData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (facilityId) {
      fetchAttendanceReport();
    } else {
      toast.error("Facility ID not available. Please check your login status.");
    }

    const handleAttendanceUpdate = () => {
      fetchAttendanceReport();
    };

    window.addEventListener("attendanceUpdated", handleAttendanceUpdate);

    return () => {
      window.removeEventListener("attendanceUpdated", handleAttendanceUpdate);
    };
  }, [facilityId]);

  const fetchAttendanceReport = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        facilityId: facilityId,
        page: "1",
        limit: "10",
        startDate: today,
        endDate: today,
      });

      const response = await fetch(`/api/hr/attendance/report?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAttendanceData(data.data.attendance || []);
        setSummary(data.data.summary || {});
      } else {
        toast.error(data.message || "Error fetching attendance report");
        setAttendanceData([]);
        setSummary({});
      }
    } catch (error) {
      toast.error(`Error fetching attendance report: ${error.message}`);
      setAttendanceData([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Present":
        return "bg-emerald-100 text-emerald-800";
      case "Absent":
        return "bg-red-100 text-red-800";
      case "Late":
        return "bg-amber-100 text-amber-800";
      case "Half Day":
        return "bg-orange-100 text-orange-800";
      case "On Leave":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTime = (time) => {
    if (!time) return "-";
    return time;
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const columns = [
    {
      value: "employee",
      title: "Employee",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {item.employee?.firstName} {item.employee?.lastName}
          </div>
          <div className="text-xs text-gray-500">
            {item.employee?.employeeId}
          </div>
        </div>
      ),
    },
    {
      value: "date",
      title: "Date",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm text-gray-900">{formatDate(item.date)}</div>
      ),
    },
    {
      value: "clockInTime",
      title: "In",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm text-gray-900 font-mono">
          {formatTime(item.clockInTime)}
        </div>
      ),
    },
    {
      value: "clockOutTime",
      title: "Out",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-sm text-gray-900 font-mono">
          {formatTime(item.clockOutTime)}
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
          <span
            className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${getStatusColor(
              item.status
            )}`}
          >
            {item.status}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-muted shadow-sm overflow-hidden h-full flex flex-col">
      <div
        className="px-6 py-5 text-white relative"
        style={{ background: headerGradient }}
      >
        <div className="absolute right-4 top-3 opacity-10 pointer-events-none">
          <Users className="size-16" />
        </div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h3 className="text-lg font-black tracking-tight italic uppercase">
              Today&apos;s Report
            </h3>
            <p className="text-xs text-white/75 mt-0.5">Live attendance summary</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchAttendanceReport}
            disabled={loading}
            className="text-white hover:bg-white/15 hover:text-white h-9"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Present
            </p>
            <p className="text-xl font-black text-emerald-600">
              {summary.presentCount || 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Absent
            </p>
            <p className="text-xl font-black text-red-600">
              {summary.absentCount || 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total
            </p>
            <p className="text-xl font-black text-slate-800">
              {summary.totalRecords || 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Rate
            </p>
            <p className="text-xl font-black" style={{ color: primaryColor }}>
              {summary.attendanceRate || 0}%
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div
              className="animate-spin rounded-full h-7 w-7 border-b-2"
              style={{ borderColor: primaryColor }}
            />
          </div>
        ) : attendanceData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No attendance records found for today.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100">
            <CustomTable1
              data={attendanceData}
              fields={columns}
              loading={loading}
              pageSize={10}
              message="No attendance records found"
            />
          </div>
        )}

        <div className="pt-1 text-center mt-auto">
          <button
            type="button"
            onClick={() => {
              if (onViewFullReport) onViewFullReport();
              else navigate("/app/admin/hr/attendance-report");
            }}
            className="text-xs font-bold hover:underline"
            style={{ color: primaryColor }}
          >
            View Full Report →
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceReportCompact;
