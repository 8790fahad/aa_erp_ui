import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Calendar,
  Users,
  Settings,
  Check,
  AlertCircle,
} from "lucide-react";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { getAaBrandColors } from "@/lib/aaBrand";

const emptyLeaveType = (primaryColor) => ({
  name: "",
  code: "",
  maxDays: 0,
  isPaid: true,
  requiresApproval: true,
  description: "",
  color: primaryColor || "#1a2d5e",
});

const LeaveSetup = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
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
  const focusRingStyle = { "--tw-ring-color": primaryColor };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [newLeaveType, setNewLeaveType] = useState(() =>
    emptyLeaveType(primaryColor)
  );

  const [employees, setEmployees] = useState([]);
  const [employeeBalances, setEmployeeBalances] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState("");

  const [showLeaveTypeDialog, setShowLeaveTypeDialog] = useState(false);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState(null);

  const loadLeaveTypes = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/hr/leave-types?facilityId=${facilityId}`,
      (response) => {
        if (response.success) {
          setLeaveTypes(response.results || []);
        }
      },
      (err) => {
        console.error("Error loading leave types:", err);
        setLeaveTypes([]);
      }
    );
  }, [facilityId]);

  const loadEmployees = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/hr/employees?facilityId=${facilityId}`,
      (response) => {
        if (response.success) {
          setEmployees(response.results || []);
        }
      },
      (err) => {
        console.error("Error loading employees:", err);
        setEmployees([]);
      }
    );
  }, [facilityId]);

  const loadEmployeeBalances = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/hr/leave-balances?facilityId=${facilityId}`,
      (response) => {
        if (response.success) {
          const balanceMap = {};
          (response.results || []).forEach((balance) => {
            if (!balanceMap[balance.employeeId]) {
              balanceMap[balance.employeeId] = {};
            }
            balanceMap[balance.employeeId][balance.leaveType] = balance;
          });
          setEmployeeBalances(balanceMap);
        }
      },
      (err) => {
        console.error("Error loading leave balances:", err);
        setEmployeeBalances({});
      }
    );
  }, [facilityId]);

  useEffect(() => {
    loadLeaveTypes();
    loadEmployees();
    loadEmployeeBalances();
  }, [loadLeaveTypes, loadEmployees, loadEmployeeBalances]);

  const resetLeaveTypeForm = () => {
    setEditingLeaveType(null);
    setNewLeaveType(emptyLeaveType(primaryColor));
  };

  const closeLeaveTypeDialog = () => {
    setShowLeaveTypeDialog(false);
    resetLeaveTypeForm();
  };

  const handleLeaveTypeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        ...newLeaveType,
        facilityId,
        query_type: editingLeaveType ? "update" : "insert",
      };

      if (editingLeaveType) {
        payload.id = editingLeaveType.id;
      }

      _postApi(
        "/api/hr/leave-types",
        payload,
        (response) => {
          if (response.success) {
            const message = editingLeaveType
              ? "Leave type updated successfully!"
              : "Leave type created successfully!";
            setSuccess(message);
            toast.success(message);
            loadLeaveTypes();
            closeLeaveTypeDialog();
          } else {
            setError(response.message || "Failed to save leave type");
            toast.error(response.message || "Failed to save leave type");
          }
          setLoading(false);
        },
        () => {
          setError("Error saving leave type");
          toast.error("Error saving leave type");
          setLoading(false);
        }
      );
    } catch {
      setError("Error saving leave type");
      toast.error("Error saving leave type");
      setLoading(false);
    }
  };

  const handleBalanceUpdate = async (employeeId, leaveType, newBalance) => {
    setLoading(true);
    try {
      const payload = {
        employeeId,
        leaveType,
        totalDays: newBalance,
        remainingDays: newBalance,
        facilityId,
        query_type: "upsert",
      };

      _postApi(
        "/api/hr/leave-balances",
        payload,
        (response) => {
          if (response.success) {
            toast.success("Leave balance updated successfully!");
            loadEmployeeBalances();
          } else {
            toast.error(response.message || "Failed to update balance");
          }
          setLoading(false);
        },
        () => {
          toast.error("Error updating balance");
          setLoading(false);
        }
      );
    } catch {
      toast.error("Error updating balance");
      setLoading(false);
    }
  };

  const handleEditLeaveType = (leaveType) => {
    setEditingLeaveType(leaveType);
    setNewLeaveType({
      ...emptyLeaveType(primaryColor),
      ...leaveType,
    });
    setShowLeaveTypeDialog(true);
  };

  const handleDeleteLeaveType = async (leaveTypeId) => {
    if (!confirm("Are you sure you want to delete this leave type?")) return;

    setLoading(true);
    try {
      _postApi(
        "/api/hr/leave-types",
        {
          id: leaveTypeId,
          facilityId,
          query_type: "delete",
        },
        (response) => {
          if (response.success) {
            toast.success("Leave type deleted successfully!");
            loadLeaveTypes();
          } else {
            toast.error(response.message || "Failed to delete leave type");
          }
          setLoading(false);
        },
        () => {
          toast.error("Error deleting leave type");
          setLoading(false);
        }
      );
    } catch {
      toast.error("Error deleting leave type");
      setLoading(false);
    }
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown";
  };

  const BalanceCards = ({ employeeId }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {leaveTypes.map((leaveType) => {
        const balance = employeeBalances[employeeId]?.[leaveType.code];
        return (
          <div
            key={leaveType.id}
            className="rounded-xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: leaveType.color || primaryColor }}
                />
                <span className="font-semibold text-sm text-gray-900 truncate">
                  {leaveType.name}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {leaveType.maxDays} max
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-600">Balance:</label>
              <input
                type="number"
                min="0"
                max={leaveType.maxDays}
                value={balance?.remainingDays ?? 0}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10) || 0;
                  handleBalanceUpdate(employeeId, leaveType.code, next);
                }}
                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 bg-gray-50 focus:bg-white"
                style={focusRingStyle}
              />
              <span className="text-xs text-gray-500">days</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!facilityId) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden">
          <div className="p-6 text-white" style={{ background: headerGradient }}>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Facility Required
            </h2>
          </div>
          <div className="p-8 text-center">
            <p className="text-slate-600 mb-6">
              Please select a facility/business to configure leave settings.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="text-white hover:opacity-90"
              style={brandButtonStyle}
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Leave Setup
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure leave types and manage employee leave balances
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white text-xs font-bold"
              style={{
                backgroundColor: `${primaryColor}20`,
                color: primaryColor,
              }}
              title="Leave types"
            >
              {leaveTypes.length}
            </div>
            <Button
              onClick={() => {
                resetLeaveTypeForm();
                setShowLeaveTypeDialog(true);
              }}
              className="text-white shadow-sm hover:opacity-90"
              style={brandButtonStyle}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Leave Type
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBalanceDialog(true)}
              className="font-semibold rounded-xl"
              style={{ borderColor: `${primaryColor}40`, color: primaryColor }}
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Balances
            </Button>
          </div>
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Leave Types */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: primaryColor }} />
            <h2 className="text-base font-bold text-gray-900">Leave Types</h2>
          </div>
          {leaveTypes.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium text-gray-900">
                No leave types configured yet
              </p>
              <p className="text-sm mt-1">
                Click &quot;Add Leave Type&quot; to get started
              </p>
              <Button
                onClick={() => {
                  resetLeaveTypeForm();
                  setShowLeaveTypeDialog(true);
                }}
                className="mt-4 text-white hover:opacity-90"
                style={brandButtonStyle}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Leave Type
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Max Days
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {leaveTypes.map((leaveType) => (
                    <tr
                      key={leaveType.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: leaveType.color || primaryColor,
                            }}
                          />
                          <span className="text-sm font-semibold text-gray-900">
                            {leaveType.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold border"
                          style={{
                            backgroundColor: `${primaryColor}10`,
                            borderColor: `${primaryColor}30`,
                            color: primaryColor,
                          }}
                        >
                          {leaveType.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {leaveType.maxDays} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditLeaveType(leaveType)}
                            className="p-2 text-gray-400 hover:opacity-80 transition-colors"
                            title="Edit"
                            style={{ color: primaryColor }}
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLeaveType(leaveType.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Employee balances (inline) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: primaryColor }} />
            <h2 className="text-base font-bold text-gray-900">
              Employee Leave Balances
            </h2>
          </div>
          <div className="p-6">
            {employees.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-900">No employees found</p>
                <p className="text-sm mt-1">
                  Add employees first to manage leave balances
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <label className="text-xs font-bold text-gray-700">
                    Select Employee
                  </label>
                  <Select
                    value={selectedEmployee}
                    onValueChange={setSelectedEmployee}
                  >
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="Choose an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEmployee && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-900">
                      Leave Balances for {getEmployeeName(selectedEmployee)}
                    </h3>
                    <BalanceCards employeeId={selectedEmployee} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Leave Type Modal */}
      {showLeaveTypeDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-6 text-white shrink-0" style={{ background: headerGradient }}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    {editingLeaveType ? "Edit Leave Type" : "Add Leave Type"}
                  </h3>
                  <p className="text-white/80 text-xs mt-1 font-medium">
                    {editingLeaveType
                      ? "Update leave policy settings"
                      : "Create a leave policy for your team"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeLeaveTypeDialog}
                  className="p-1 hover:bg-white/20 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleLeaveTypeSubmit}
              className="p-6 space-y-4 overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    Leave Type Name *
                  </label>
                  <input
                    type="text"
                    value={newLeaveType.name}
                    onChange={(e) =>
                      setNewLeaveType({ ...newLeaveType, name: e.target.value })
                    }
                    placeholder="e.g., Annual Leave"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 bg-gray-50 focus:bg-white"
                    style={focusRingStyle}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={newLeaveType.code}
                    onChange={(e) =>
                      setNewLeaveType({ ...newLeaveType, code: e.target.value })
                    }
                    placeholder="e.g., ANNUAL"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 bg-gray-50 focus:bg-white"
                    style={focusRingStyle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    Maximum Days *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newLeaveType.maxDays}
                    onChange={(e) =>
                      setNewLeaveType({
                        ...newLeaveType,
                        maxDays: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 bg-gray-50 focus:bg-white"
                    style={focusRingStyle}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newLeaveType.color || primaryColor}
                      onChange={(e) =>
                        setNewLeaveType({
                          ...newLeaveType,
                          color: e.target.value,
                        })
                      }
                      className="h-10 w-14 border border-gray-200 rounded-lg cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={newLeaveType.color || primaryColor}
                      onChange={(e) =>
                        setNewLeaveType({
                          ...newLeaveType,
                          color: e.target.value,
                        })
                      }
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 bg-gray-50 focus:bg-white"
                      style={focusRingStyle}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">
                  Description
                </label>
                <textarea
                  value={newLeaveType.description || ""}
                  onChange={(e) =>
                    setNewLeaveType({
                      ...newLeaveType,
                      description: e.target.value,
                    })
                  }
                  placeholder="Optional description for this leave type"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 resize-none bg-gray-50 focus:bg-white"
                  style={focusRingStyle}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeLeaveTypeDialog}
                  className="rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl font-bold px-6 text-white hover:opacity-90"
                  style={brandButtonStyle}
                >
                  {loading
                    ? "Saving..."
                    : editingLeaveType
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Balances Modal */}
      {showBalanceDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-6 text-white shrink-0" style={{ background: headerGradient }}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Manage Leave Balances
                  </h3>
                  <p className="text-white/80 text-xs mt-1 font-medium">
                    Set remaining days per leave type for each employee
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBalanceDialog(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {employees.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-900">No employees found</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <label className="text-xs font-bold text-gray-700">
                      Select Employee
                    </label>
                    <Select
                      value={selectedEmployee}
                      onValueChange={setSelectedEmployee}
                    >
                      <SelectTrigger className="w-full sm:w-72">
                        <SelectValue placeholder="Choose an employee" />
                      </SelectTrigger>
                      <SelectContent className="z-[300]">
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedEmployee && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-gray-900">
                        Leave Balances for {getEmployeeName(selectedEmployee)}
                      </h3>
                      <BalanceCards employeeId={selectedEmployee} />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBalanceDialog(false)}
                className="rounded-xl font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveSetup;
