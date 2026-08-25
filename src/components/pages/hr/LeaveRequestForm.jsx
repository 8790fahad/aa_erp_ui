import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Calendar, Clock, FileText, Save, X, Users, Search, User } from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { getAaBrandColors } from "@/lib/aaBrand";

const LeaveRequestForm = ({ employee, onSave, onCancel }) => {
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

  const [formData, setFormData] = useState({
    employeeId: "",
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
    attachmentUrl: "",
  });

  const [leaveBalance, setLeaveBalance] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const getSelectedLeaveMaxDays = (leaveTypeCode) => {
    const type = leaveTypes.find((t) => t.code === leaveTypeCode);
    const max = parseInt(type?.maxDays, 10);
    return Number.isFinite(max) && max > 0 ? max : 1;
  };

  const computeDefaultEndDate = (startDate, leaveTypeCode) => {
    if (!startDate) return "";
    const maxDays = getSelectedLeaveMaxDays(leaveTypeCode);
    const d = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + (maxDays - 1));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  // Load leave types from setup
  const loadLeaveTypes = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/hr/leave-types?facilityId=${facilityId}`,
      (response) => {
        if (response.success) {
          setLeaveTypes(response.results || []);
        }
      },
      (error) => {
        console.error("Error loading leave types:", error);
        setLeaveTypes([]);
      }
    );
  }, [facilityId]);

  // Load employees
  const loadEmployees = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/hr/employees?facilityId=${facilityId}`,
      (response) => {
        if (response.success) {
          setEmployees(response.results || []);
        }
      },
      (error) => {
        console.error("Error loading employees:", error);
        setEmployees([]);
      }
    );
  }, [facilityId]);

  // Load users from the same API as EmployeeForm
  const loadUsers = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/v1/get-users-by-facility/${activeBusiness.id}`,
      (response) => {
        if (response.success) {
          setUsers(response.results || []);
        }
      },
      (error) => {
        console.error("Error loading users:", error);
        setUsers([]);
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    loadLeaveTypes();
    loadEmployees();
    loadUsers();

    if (employee) {
      setFormData((prev) => ({
        ...prev,
        employeeId: employee.id,
      }));
      fetchLeaveBalance(employee.id);
    }
  }, [employee, loadLeaveTypes, loadEmployees, loadUsers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showUserDropdown &&
        !event.target.closest(".user-dropdown-container")
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserDropdown]);

  const fetchLeaveBalance = async (employeeId) => {
    try {
      const response = await fetch(
        `/api/hr/leaves/balance/${employeeId}?facilityId=${facilityId}`
      );
      const data = await response.json();

      if (data.success) {
        const balanceMap = {};
        data.data.forEach((balance) => {
          balanceMap[balance.leaveType] = balance.remainingDays;
        });
        setLeaveBalance(balanceMap);
      }
    } catch (error) {
      console.error("Error fetching leave balance:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "startDate") {
        next.endDate = value
          ? computeDefaultEndDate(value, prev.leaveType)
          : "";
      }
      if (name === "leaveType" && prev.startDate) {
        next.endDate = computeDefaultEndDate(prev.startDate, value);
      }
      return next;
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
        ...(name === "startDate" || name === "leaveType" ? { endDate: "" } : {}),
      }));
    }
  };

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setUserSearchTerm(`${user.firstname} ${user.lastname}`);
    setShowUserDropdown(false);

    // Update form data with selected user's employee ID
    setFormData((prev) => ({
      ...prev,
      employeeId: user.id,
    }));

    // Fetch leave balance for the selected user
    fetchLeaveBalance(user.id);
  };

  // Filter users based on search term
  const filteredUsers = users.filter(
    (user) =>
      `${user.firstname} ${user.lastname}`
        .toLowerCase()
        .includes(userSearchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.phone?.includes(userSearchTerm)
  );

  const calculateTotalDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  const validateForm = () => {
    const newErrors = {};
    const totalDays = calculateTotalDays();

    if (!formData.employeeId) newErrors.employeeId = "Employee is required";
    if (!formData.leaveType) newErrors.leaveType = "Leave type is required";
    if (!formData.startDate) newErrors.startDate = "Start date is required";
    if (!formData.endDate) newErrors.endDate = "End date is required";
    if (!formData.reason.trim()) newErrors.reason = "Reason is required";

    // Check if start date is not in the past
    if (formData.startDate && new Date(formData.startDate) < new Date()) {
      newErrors.startDate = "Start date cannot be in the past";
    }

    // Check if end date is after start date
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate) < new Date(formData.startDate)
    ) {
      newErrors.endDate = "End date must be after start date";
    }

    // Check leave balance
    if (formData.leaveType && leaveBalance[formData.leaveType] !== undefined) {
      if (totalDays > leaveBalance[formData.leaveType]) {
        newErrors.leaveType = `Insufficient leave balance. Available: ${
          leaveBalance[formData.leaveType]
        } days, Requested: ${totalDays} days`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving leave request:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalDays = calculateTotalDays();

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6"
      style={{
        ["--app-primary"]: primaryColor,
        ["--app-secondary"]: secondaryColor,
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Calendar className="h-6 w-6 mr-2" style={{ color: primaryColor }} />
          Apply for Leave
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Selection */}
        {!employee && (
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Select Employee
            </h3>
            <div className="relative user-dropdown-container">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search and Select Employee *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => {
                    setUserSearchTerm(e.target.value);
                    setShowUserDropdown(true);
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                    errors.employeeId ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Search by name, email, or phone..."
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>

              {showUserDropdown && userSearchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {user.firstname} {user.lastname}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email} • {user.phone}
                            </div>
                            <div className="text-xs text-gray-400">
                              Role: {user.role} • Status: {user.status}
                              {user.departmentId && (
                                <span> • Dept ID: {user.departmentId}</span>
                              )}
                            </div>
                          </div>
                          {user.image && (
                            <img
                              src={user.image}
                              alt="User"
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 text-center">
                      No employees found
                    </div>
                  )}
                </div>
              )}

              {errors.employeeId && (
                <p className="text-red-500 text-sm mt-1">{errors.employeeId}</p>
              )}
            </div>

            {selectedUser && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <User className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium text-green-800">
                        Selected: {selectedUser.firstname} {selectedUser.lastname}
                      </div>
                      <div className="text-sm text-green-600">
                        {selectedUser.email} • {selectedUser.phone}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setUserSearchTerm("");
                      setFormData((prev) => ({
                        ...prev,
                        employeeId: "",
                      }));
                    }}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leave Type and Balance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Type *
            </label>
            <select
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                errors.leaveType ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select Leave Type</option>
              {leaveTypes.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name} ({type.isPaid ? "Paid" : "Unpaid"}) - Max{" "}
                  {type.maxDays} days
                </option>
              ))}
            </select>
            {errors.leaveType && (
              <p className="text-red-500 text-sm mt-1">{errors.leaveType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Available Balance
            </label>
            <div className="px-3 py-2 bg-gray-100 rounded-lg">
              <span className="text-sm text-gray-600">
                {leaveBalance[formData.leaveType] !== undefined
                  ? `${leaveBalance[formData.leaveType]} days remaining`
                  : "Loading..."}
              </span>
            </div>
          </div>
        </div>

        {/* Date Range — End Date appears after Start Date is selected */}
        <div
          className={`grid grid-cols-1 gap-4 ${
            formData.startDate ? "md:grid-cols-2" : ""
          }`}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              min={new Date().toISOString().split("T")[0]}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                errors.startDate ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.startDate && (
              <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>
            )}
          </div>

          {formData.startDate ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                min={formData.startDate}
                max={computeDefaultEndDate(
                  formData.startDate,
                  formData.leaveType
                )}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.endDate ? "border-red-500" : "border-gray-300"
                }`}
              />
              {formData.leaveType ? (
                <p className="text-xs text-gray-500 mt-1">
                  Max {getSelectedLeaveMaxDays(formData.leaveType)} days from
                  start
                </p>
              ) : null}
              {errors.endDate && (
                <p className="text-red-500 text-sm mt-1">{errors.endDate}</p>
              )}
            </div>
          ) : null}
        </div>

        {/* Total Days */}
        {totalDays > 0 && (
          <div className="bg-[color:var(--app-primary)]/10 p-4 rounded-lg">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-[color:var(--app-primary)] mr-2" />
              <span className="text-sm font-medium text-[color:var(--app-primary)]">
                Total Days: {totalDays} {totalDays === 1 ? "day" : "days"}
              </span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason *
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows={4}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
              errors.reason ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Please provide a reason for your leave request..."
          />
          {errors.reason && (
            <p className="text-red-500 text-sm mt-1">{errors.reason}</p>
          )}
        </div>

        {/* Attachment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supporting Document (Optional)
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                // TODO: Handle file upload
                console.log("File selected:", e.target.files[0]);
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[color:var(--app-primary)]/10 file:text-[color:var(--app-primary)] hover:file:bg-[color:var(--app-primary)]/15"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 5MB)
          </p>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-[color:var(--app-primary)] text-white rounded-lg hover:bg-[color:var(--app-primary)] transition-colors disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Submit Leave Request
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeaveRequestForm;
