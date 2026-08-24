import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import useScanDetection from "@/hooks/useScanDetection";
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  User,
  CheckCircle,
  CreditCard,
  AlertCircle,
  CalendarDays,
  UserCheck,
  UserX,
  ScanLine,
} from "lucide-react";

const normalizeScannedEmployeeId = (value) =>
  String(value ?? "")
    .replace(/[\r\n\t]/g, "")
    .trim();

const resolveFacilityId = (activeBusiness, user) => {
  const id =
    activeBusiness?.id ||
    user?.facilityId ||
    user?.facilityID ||
    user?.facility_id ||
    "";
  if (!id || id === "undefined" || id === "null") return "";
  return String(id).trim();
};

const AttendanceClock = ({ employee, isSecurityGate = false }) => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = resolveFacilityId(activeBusiness, user);
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
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeId, setEmployeeId] = useState("");
  const [scannedEmployee, setScannedEmployee] = useState(null);
  const [isPublicHoliday, setIsPublicHoliday] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [scannerReady, setScannerReady] = useState(true);
  const [lastScanPreview, setLastScanPreview] = useState("");
  const scanInputRef = useRef(null);
  const scanEmployeeIdRef = useRef(null);
  const loadingRef = useRef(false);
  const isSecurityGateRef = useRef(isSecurityGate);

  loadingRef.current = loading;
  isSecurityGateRef.current = isSecurityGate;

  const focusScanInput = useCallback(() => {
    if (!isSecurityGate) return;
    requestAnimationFrame(() => {
      scanInputRef.current?.focus();
    });
  }, [isSecurityGate]);

  useEffect(() => {
    focusScanInput();
  }, [focusScanInput]);

  useEffect(() => {
    if (!loading) {
      focusScanInput();
    }
  }, [loading, focusScanInput]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    if (facilityId) {
      checkPublicHolidayStatus();
      fetchLeaveTypes();
    }

    if (employee) {
      fetchTodayAttendance();
    }

    return () => clearInterval(timer);
  }, [employee, facilityId]);

  const checkPublicHolidayStatus = () => {
    checkPublicHoliday(new Date());
  };

  const checkPublicHoliday = async (date) => {
    if (!facilityId) return;
    try {
      const response = await fetch(
        `/api/hr/public-holidays/check?facilityId=${encodeURIComponent(facilityId)}&date=${
          date.toISOString().split("T")[0]
        }`
      );
      const data = await response.json();
      setIsPublicHoliday(data.isHoliday || false);
    } catch (error) {
      console.error("Error checking public holiday:", error);
      setIsPublicHoliday(false);
    }
  };

  const fetchLeaveTypes = async () => {
    if (!facilityId) return;
    try {
      const response = await fetch(
        `/api/hr/leave-types?facilityId=${encodeURIComponent(facilityId)}`
      );
      const data = await response.json();
      if (data.success) {
        setLeaveTypes(data.results || []);
      } else {
        console.error("Error fetching leave types:", data.message);
        setLeaveTypes([]);
      }
    } catch (error) {
      console.error("Error fetching leave types:", error);
      setLeaveTypes([]);
    }
  };

  const checkEmployeeLeaveStatus = async (employeeId, facilityId, date) => {
    try {
      const response = await fetch(
        `/api/hr/leaves?employeeId=${employeeId}&facilityId=${facilityId}&startDate=${date}&endDate=${date}&status=Approved`
      );
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        const leave = data.data[0];
        return {
          leaveType: leave.leaveType || "Unknown",
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
        };
      }
      return null;
    } catch (error) {
      console.error("Error checking employee leave status:", error);
      return null;
    }
  };

  const fetchTodayAttendance = async (empId = null) => {
    const targetEmployeeId = empId || employee?.id;
    if (!targetEmployeeId || !facilityId) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(
        `/api/hr/attendance/report?facilityId=${encodeURIComponent(facilityId)}&employeeId=${targetEmployeeId}&startDate=${today}&endDate=${today}`
      );
      const data = await response.json();

      if (data.success && data.data.attendance.length > 0) {
        setAttendance(data.data.attendance[0]);
      } else {
        setAttendance(null);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const scanEmployeeId = async (rawId = null) => {
    if (loading) return;

    const normalizedId = normalizeScannedEmployeeId(
      rawId !== null ? rawId : employeeId,
    );

    if (!normalizedId) {
      setMessage("Please scan or enter employee ID");
      return;
    }

    if (!facilityId) {
      setMessage("Business not selected. Please select a company and try again.");
      return;
    }

    setLoading(true);
    setMessage("");
    setScannerReady(false);

    try {
      const response = await fetch("/api/hr/employees/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: normalizedId,
          facilityId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setScannedEmployee(data.data);
        setEmployeeId("");
        await fetchTodayAttendance(data.data.id);

        // Check if employee is on leave today
        const today = new Date().toISOString().split("T")[0];
        const leaveCheck = await checkEmployeeLeaveStatus(
          data.data.id,
          facilityId,
          today
        );

        if (leaveCheck) {
          setMessage(
            `Employee found: ${data.data.firstName} ${data.data.lastName} - Currently on ${leaveCheck.leaveType} leave`
          );
        } else {
          setMessage(
            `Employee found: ${data.data.firstName} ${data.data.lastName}`
          );
        }

        // Automatically record attendance after finding employee
        setTimeout(async () => {
          await recordAttendanceForScannedEmployee(data.data);
        }, 1000);

        setTimeout(() => setMessage(""), 5000);
      } else {
        setMessage(data.message || "Employee not found");
        setScannedEmployee(null);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error scanning employee:", error);
      setMessage("Error scanning employee");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
      setScannerReady(true);
      focusScanInput();
    }
  };

  const handleScanInputChange = (e) => {
    setEmployeeId(e.target.value);
  };

  const handleScanInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      scanEmployeeId(e.currentTarget.value);
    }
  };

  const handleClearScannedEmployee = () => {
    setScannedEmployee(null);
    setAttendance(null);
    setEmployeeId("");
    focusScanInput();
  };

  scanEmployeeIdRef.current = scanEmployeeId;

  const handleBarcodeScan = useCallback((code) => {
    if (!isSecurityGateRef.current || loadingRef.current) return;

    const normalized = normalizeScannedEmployeeId(code);
    if (!normalized) return;

    setLastScanPreview(normalized);
    setEmployeeId(normalized);
    scanEmployeeIdRef.current?.(normalized);
  }, []);

  useScanDetection({
    onComplete: handleBarcodeScan,
    onError: () => {
      setMessage("Incomplete scan — please scan the ID card again");
      setTimeout(() => setMessage(""), 2500);
    },
    minLength: 2,
    averageWaitTime: 100,
    timeToEvaluate: 150,
    preventDefault: false,
    stopPropagation: false,
  });

  const recordAttendanceForScannedEmployee = async (employeeData) => {
    if (isPublicHoliday) {
      setMessage("Attendance not required on public holidays");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/hr/attendance/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: employeeData.id,
          facilityId: facilityId,
          createdBy: user?.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAttendance(data.data);
        if (data.leaveInfo) {
          setMessage(`Employee is on ${data.leaveInfo.leaveType} leave today`);
        } else {
          setMessage("Attendance recorded successfully!");
        }
        setTimeout(() => setMessage(""), 3000);
        
        // Trigger refresh of attendance report
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('attendanceUpdated'));
        }, 1000);
      } else {
        // Handle specific error cases
        if (data.message.includes("already recorded")) {
          setMessage("Attendance already recorded for today");
          if (data.data) {
            setAttendance(data.data);
          }
          // Still trigger refresh even if already recorded
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('attendanceUpdated'));
          }, 1000);
        } else if (data.message.includes("public holiday")) {
          setMessage("Attendance not required on public holidays");
        } else {
          setMessage(data.message || "Error recording attendance");
        }
      }
    } catch (error) {
      console.error("Error recording attendance:", error);
      setMessage("Error recording attendance");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveAttendance = async (leaveTypeId) => {
    if (!scannedEmployee && !employee) return;

    setLoading(true);
    setMessage("");

    try {
      const targetEmployee = scannedEmployee || employee;

      const response = await fetch("/api/hr/attendance/leave-attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: targetEmployee.id,
          facilityId: facilityId,
          leaveTypeId: leaveTypeId,
          date: new Date().toISOString().split("T")[0],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAttendance(data.data);
        setMessage("Leave attendance recorded successfully!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage(data.message || "Error recording leave attendance");
      }
    } catch (error) {
      console.error("Error recording leave attendance:", error);
      setMessage("Error recording leave attendance");
    } finally {
      setLoading(false);
    }
  };

  const recordAttendance = async () => {
    const targetEmployee = scannedEmployee || employee;
    if (!targetEmployee) return;

    if (isPublicHoliday) {
      setMessage("Attendance not required on public holidays");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/hr/attendance/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: targetEmployee.id,
          facilityId: facilityId,
          createdBy: user?.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAttendance(data.data);
        if (data.leaveInfo) {
          setMessage(`Employee is on ${data.leaveInfo.leaveType} leave today`);
        } else {
          setMessage("Attendance recorded successfully!");
        }
        setTimeout(() => setMessage(""), 3000);
        
        // Trigger refresh of attendance report
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('attendanceUpdated'));
        }, 1000);
      } else {
        // Handle specific error cases
        if (data.message.includes("already recorded")) {
          setMessage("Attendance already recorded for today");
          if (data.data) {
            setAttendance(data.data);
          }
          // Still trigger refresh even if already recorded
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('attendanceUpdated'));
          }, 1000);
        } else if (data.message.includes("public holiday")) {
          setMessage("Attendance not required on public holidays");
        } else {
          setMessage(data.message || "Error recording attendance");
        }
      }
    } catch (error) {
      console.error("Error recording attendance:", error);
      setMessage("Error recording attendance");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const targetEmployee = scannedEmployee || employee;
    if (!targetEmployee) return;

    if (isPublicHoliday) {
      setMessage("Sign out not required on public holidays");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/hr/attendance/clock-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: targetEmployee.id,
          facilityId: facilityId,
          createdBy: user?.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAttendance(data.data);
        setMessage("Signed out successfully!");
        setTimeout(() => setMessage(""), 3000);
        
        // Trigger refresh of attendance report
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('attendanceUpdated'));
        }, 1000);
      } else {
        // Handle specific error cases
        if (data.message.includes("No clock-in record")) {
          setMessage("Must sign in before signing out");
        } else if (data.message.includes("Already clocked out")) {
          setMessage("Already signed out today");
          if (data.data) {
            setAttendance(data.data);
          }
        } else if (data.message.includes("public holiday")) {
          setMessage("Sign out not required on public holidays");
        } else {
          setMessage(data.message || "Error signing out");
        }
      }
    } catch (error) {
      console.error("Error signing out:", error);
      setMessage("Error signing out");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return "--:--";
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = () => {
    if (!attendance) return "bg-gray-100 text-gray-800";
    if (attendance.status === "Present") return "bg-green-100 text-green-800";
    if (attendance.status === "Late") return "bg-yellow-100 text-yellow-800";
    if (attendance.status === "Absent") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const isLeaveAttendance = attendance && attendance.leaveTypeId;
  const currentEmployee = scannedEmployee || employee;

  return (
    <div className="bg-white rounded-2xl border border-muted shadow-sm overflow-hidden">
      <div
        className="px-6 py-5 text-white relative"
        style={{ background: headerGradient }}
      >
        <div className="absolute right-4 top-3 opacity-10 pointer-events-none">
          <ScanLine className="size-16" />
        </div>
        <h2 className="text-lg font-black tracking-tight italic uppercase relative z-10">
          {isSecurityGate ? "Security Gate Attendance" : "Attendance Recording"}
        </h2>
        <div className="flex items-center gap-4 mt-2 text-white/85 text-sm relative z-10">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {currentTime.toLocaleDateString()}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-base font-bold">
            <Clock className="h-3.5 w-3.5" />
            {currentTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="p-6">
        {isPublicHoliday && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-center text-amber-800">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">
                Public Holiday - Attendance not required
              </span>
            </div>
          </div>
        )}

      {/* ID Scanning Interface for Security Gate */}
      {isSecurityGate && (
        <div
          className="rounded-xl p-5 mb-6 border"
          style={{
            borderColor: `${primaryColor}30`,
            backgroundColor: `${primaryColor}0D`,
          }}
        >
          <div className="text-center mb-4">
            <div
              className="mx-auto mb-3 size-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}18` }}
            >
              <CreditCard className="h-7 w-7" style={{ color: primaryColor }} />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Scan Employee ID Card
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Point your USB barcode scanner at the ID card — no button click
              needed
            </p>
            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
                scannerReady && !loading
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <ScanLine className="h-3.5 w-3.5" />
              {scannerReady && !loading
                ? "Scanner ready — scan barcode now"
                : "Processing scan…"}
            </div>
            {lastScanPreview && (
              <p
                className="mt-2 text-xs font-mono font-semibold"
                style={{ color: primaryColor }}
              >
                Last scan: {lastScanPreview}
              </p>
            )}
          </div>

          <div className="flex space-x-2">
            <input
              ref={scanInputRef}
              type="text"
              value={employeeId}
              onChange={handleScanInputChange}
              onKeyDown={handleScanInputKeyDown}
              placeholder="Scan barcode or enter Employee ID"
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 font-mono bg-white text-sm"
              style={{ "--tw-ring-color": primaryColor }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
            />
            <button
              onClick={() => scanEmployeeId()}
              disabled={loading || !normalizeScannedEmployeeId(employeeId)}
              className="px-5 py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90 disabled:bg-slate-300 disabled:cursor-not-allowed transition-opacity"
              style={
                loading || !normalizeScannedEmployeeId(employeeId)
                  ? undefined
                  : brandButtonStyle
              }
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                "Scan"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Employee Information */}
      {currentEmployee && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <User className="h-5 w-5 text-gray-500 mr-3" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {currentEmployee.firstName} {currentEmployee.lastName}
              </p>
              <p className="text-sm text-gray-500">
                {currentEmployee.employeeId}
              </p>
              {currentEmployee.department && (
                <p className="text-xs text-gray-400">
                  {currentEmployee.department}
                </p>
              )}
            </div>
            {isSecurityGate && (
              <button
                onClick={handleClearScannedEmployee}
                className="text-gray-400 hover:text-gray-600"
              >
                <UserX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center ${
            message.includes("successfully")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {message}
        </div>
      )}

      {/* Attendance Status */}
      <div className="text-center mb-6">
        <div
          className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStatusColor()}`}
        >
          {attendance ? (
            isLeaveAttendance ? (
              <div className="flex items-center">
                <CalendarDays className="h-4 w-4 mr-2" />
                {attendance.leaveTypeName || "On Leave"}
              </div>
            ) : (
              attendance.status
            )
          ) : (
            "Not Recorded"
          )}
        </div>
        {isLeaveAttendance && (
          <p className="text-xs text-gray-500 mt-1">
            Leave Type: {attendance.leaveTypeName}
          </p>
        )}
      </div>

      {/* Attendance Time */}
      {attendance && (
        <div className="text-center mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Sign In</p>
              <p className="text-lg font-mono font-semibold">
                {attendance.clockInTime
                  ? formatTime(attendance.clockInTime)
                  : "Not recorded"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Sign Out</p>
              <p className="text-lg font-mono font-semibold">
                {attendance.clockOutTime
                  ? formatTime(attendance.clockOutTime)
                  : "Not signed out"}
              </p>
            </div>
          </div>
          {attendance.totalHours && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Total Hours</p>
              <p className="text-lg font-semibold" style={{ color: primaryColor }}>
                {attendance.totalHours} hours
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {currentEmployee && (
        <div className="space-y-4">
          {/* Simple Attendance Recording - Only show if not a public holiday */}
          {!isPublicHoliday && (
            <div className="space-y-3">
              {/* Sign In Button */}
              <div className="text-center">
                <button
                  onClick={recordAttendance}
                  disabled={loading}
                  className="w-full py-4 px-6 rounded-xl font-bold transition-opacity flex items-center justify-center text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={brandButtonStyle}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <LogIn className="h-5 w-5 mr-2" />
                  )}
                  {attendance ? "Update Attendance" : "Sign In"}
                </button>
                {attendance && (
                  <p className="text-sm text-gray-600 mt-2">
                    {attendance.status === "On Leave"
                      ? `Recorded as: ${attendance.status} (${attendance.remarks})`
                      : `Recorded as: ${attendance.status}`}
                  </p>
                )}
              </div>

              {/* Sign Out Button - Only show if employee has signed in and not signed out */}
              {attendance && attendance.clockInTime && !attendance.clockOutTime && !isLeaveAttendance && (
                <div className="text-center">
                  <button
                    onClick={signOut}
                    disabled={loading}
                    className={`w-full py-4 px-6 rounded-lg font-medium transition-colors flex items-center justify-center ${
                      !loading
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    ) : (
                      <LogOut className="h-5 w-5 mr-2" />
                    )}
                    Sign Out
                  </button>
                  <p className="text-sm text-gray-600 mt-2">
                    Sign out to complete your work day
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Leave Attendance Options - Show if not already on leave and not a public holiday */}
          {!isLeaveAttendance && !isPublicHoliday && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">
                Record Leave Attendance
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Array.isArray(leaveTypes) && leaveTypes.length > 0 ? (
                  leaveTypes.map((leaveType) => (
                    <button
                      key={leaveType.id}
                      onClick={() => handleLeaveAttendance(leaveType.id)}
                      disabled={loading}
                      className="py-2 px-3 text-sm rounded-xl font-semibold hover:opacity-90 disabled:bg-gray-100 disabled:text-gray-400 border"
                      style={{
                        backgroundColor: `${primaryColor}14`,
                        color: primaryColor,
                        borderColor: `${primaryColor}30`,
                      }}
                    >
                      {leaveType.name}
                    </button>
                  ))
                ) : (
                  <div className="col-span-2 text-center text-gray-500 text-sm py-2">
                    No leave types available
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Public Holiday Message */}
          {isPublicHoliday && (
            <div className="text-center py-4 text-gray-500">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">Public Holiday - No attendance required</p>
            </div>
          )}
        </div>
      )}

      {/* Today's Summary */}
      {attendance && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Today's Summary
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-2 font-medium">
                {isLeaveAttendance ? "On Leave" : attendance.status}
              </span>
            </div>
            {isLeaveAttendance ? (
              <div>
                <span className="text-gray-600">Leave Type:</span>
                <span className="ml-2 font-medium">
                  {attendance.leaveTypeName || "Unknown"}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-gray-600">Sign Out:</span>
                <span className="ml-2 font-medium">
                  {attendance.clockOutTime ? "Completed" : "Pending"}
                </span>
              </div>
            )}
          </div>
          {!isLeaveAttendance && (
            <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Hours:</span>
                <span className="ml-2 font-medium">
                  {attendance.totalHours || 0} hours
                </span>
              </div>
              <div>
                <span className="text-gray-600">Overtime:</span>
                <span className="ml-2 font-medium">
                  {attendance.overtimeHours || 0} hours
                </span>
              </div>
            </div>
          )}
          {isLeaveAttendance && attendance.leaveReason && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600">Reason:</span>
              <span className="ml-2 text-gray-800">
                {attendance.leaveReason}
              </span>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default AttendanceClock;
