import React, { useState } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import HRDashboard from "./HRDashboard";
import EmployeeList from "./EmployeeList";
import EmployeeForm from "./EmployeeForm";
import EmployeeDetail from "./EmployeeDetail";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveManagement from "./LeaveManagement";
import PayrollPage from "./PayrollPage";
import AttendanceManagement from "./AttendanceManagement";
import AttendanceReport from "./AttendanceReport";
import Bonus from "./Bonus";
import LoanManagement from "./LoanManagement";
import { _postApi, _putApi } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  Home,
  Users,
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
  Gift,
  Banknote,
} from "lucide-react";

const HRModule = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get current tab from URL path
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes("/employees")) return "employees";
    if (path.endsWith("/bonus")) return "bonus";
    if (path.endsWith("/loans")) return "loans";
    if (path.endsWith("/leaves")) return "leaves";
    if (path.endsWith("/payroll")) return "payroll";
    if (path.includes("/attendance")) return "attendance";
    if (path.endsWith("/performance")) return "performance";
    return "dashboard";
  };

  const activeTab = getCurrentTab();
  const [departments, setDepartments] = useState([]);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "employees", label: "Employees", icon: Users },
    { id: "bonus", label: "Bonus", icon: Gift },
    { id: "loans", label: "Loans", icon: Banknote },
    { id: "leaves", label: "Leave Management", icon: Calendar },
    { id: "payroll", label: "Payroll", icon: DollarSign },
    { id: "attendance", label: "Attendance", icon: Clock },
    { id: "performance", label: "Performance", icon: TrendingUp },
  ];

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    // TODO: Implement view employee modal
    console.log("View employee:", employee);
  };

  const handleDeleteEmployee = async (employee) => {
    if (
      window.confirm(
        `Are you sure you want to deactivate ${employee.firstName} ${employee.lastName}?`
      )
    ) {
      try {
        const facilityId = activeBusiness?.id || user?.facilityId;
        const response = await fetch(`/api/hr/employees/${employee.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            facilityId: facilityId,
            updatedBy: user?.id,
          }),
        });

        if (response.ok) {
          // Trigger refresh of employee list
          setRefreshTrigger((prev) => prev + 1);
        } else {
          toast.error("Error deactivating employee");
        }
      } catch (error) {
        console.error("Error deactivating employee:", error);
        toast.error("Error deactivating employee");
      }
    }
  };

  const handleSaveEmployee = (formData) => {
    const url = selectedEmployee
      ? `/api/hr/employees/${selectedEmployee.id}`
      : "/api/hr/employees";

    const apiFunction = selectedEmployee ? _putApi : _postApi;

    // Add facilityId and user information to the form data
    const requestData = {
      ...formData,
      facilityId: activeBusiness?.id || user?.facilityId,
      ...(selectedEmployee ? { updatedBy: user?.id } : { createdBy: user?.id }),
    };

    apiFunction(
      url,
      requestData,
      (data) => {
        if (data.success) {
          setShowEmployeeForm(false);
          setSelectedEmployee(null);
          // Trigger refresh of employee list
          setRefreshTrigger((prev) => prev + 1);
        } else {
          toast.error(data.message || "Error saving employee");
        }
      },
      (error) => {
        console.error("Error saving employee:", error);
        toast.error("Error saving employee");
      }
    );
  };

  const handleApplyLeave = () => {
    setShowLeaveForm(true);
  };

  const handleTabClick = (tabId) => {
    if (tabId === "dashboard") {
      navigate("/app/admin/hr");
    } else {
      navigate(`/app/admin/hr/${tabId}`);
    }
  };

  const handleSaveLeave = async (formData) => {
    try {
      const facilityId = activeBusiness?.id || user?.facilityId;
      const response = await fetch("/api/hr/leaves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          facilityId: facilityId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowLeaveForm(false);
        toast.success("Leave request submitted successfully");
      } else {
        toast.error(data.message || "Error submitting leave request");
      }
    } catch (error) {
      console.error("Error submitting leave request:", error);
      toast.error("Error submitting leave request");
    }
  };

  const renderContent = () => {
    return (
      <Routes>
        <Route index element={<HRDashboard />} />
        <Route path="performance" element={<HRDashboard />} />
        <Route
          path="employees"
          element={
            <EmployeeList
              onAddEmployee={handleAddEmployee}
              onEditEmployee={handleEditEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              refreshTrigger={refreshTrigger}
            />
          }
        />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        {/* Legacy setup URLs → Employees (salary/allowances live on the employee) */}
        <Route
          path="salary-structure"
          element={<Navigate to="/app/admin/hr/employees" replace />}
        />
        <Route
          path="salary-structures"
          element={<Navigate to="/app/admin/hr/employees" replace />}
        />
        <Route
          path="allowances"
          element={<Navigate to="/app/admin/hr/employees" replace />}
        />
        <Route
          path="loan-setup"
          element={<Navigate to="/app/admin/hr/loans" replace />}
        />
        <Route
          path="leave-setup"
          element={<Navigate to="/app/admin/hr/leaves" replace />}
        />
        <Route path="bonus" element={<Bonus />} />
        <Route path="loans" element={<LoanManagement />} />
        <Route path="leaves" element={<LeaveManagement />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="attendance" element={<AttendanceManagement />} />
        <Route path="attendance-report" element={<AttendanceReport />} />
        <Route path="performance1" element={<HRDashboard />} />
      </Routes>
    );
  };

  return (
    <div className="flex h-screen ">
      {/* Sidebar */}

      {/* Main Content */}
      <div className="flex-1">{renderContent()}</div>

      {/* Employee Form Modal */}
      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <EmployeeForm
              employee={selectedEmployee}
              departments={departments}
              onSave={handleSaveEmployee}
              onCancel={() => {
                setShowEmployeeForm(false);
                setSelectedEmployee(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Leave Form Modal */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <LeaveRequestForm
              employee={selectedEmployee}
              onSave={handleSaveLeave}
              onCancel={() => setShowLeaveForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default HRModule;
