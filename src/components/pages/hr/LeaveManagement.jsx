import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Calendar, Clock, FileText, Save, X, Users, Plus, Edit, Trash2, Eye, MoreVertical, Search, Undo2 } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import CustomButton from "@/common/Custom/CustomButton";
import CustomTable1 from "@/common/Custom/CustomTable1";
import SearchEmployeeInput from "./SearchEmployeeInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getAaBrandColors } from "@/lib/aaBrand";

// Custom Switch component with app colors
const CustomSwitch = ({ checked, onCheckedChange, id, disabled = false }) => {
  const { primaryColor } = getAaBrandColors();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`
        peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent 
        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 
        focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed 
        disabled:opacity-50 ${checked ? 'opacity-100' : 'opacity-50'}
      `}
      style={{
        backgroundColor: checked ? primaryColor : "#e5e7eb",
      }}
    >
      <span
        className={`
          pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 
          transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
};

const LeaveManagement = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";

  // State for applied leaves
  const [appliedLeaves, setAppliedLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredLeaves, setFilteredLeaves] = useState([]);

  // State for modals
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { type, leave }
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [earlyReturnForm, setEarlyReturnForm] = useState({
    returnDate: "",
    reason: "",
  });

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
  // State for apply leave form
  const [applyLeaveForm, setApplyLeaveForm] = useState({
    employeeId: "",
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const getSelectedLeaveMaxDays = (leaveTypeCode) => {
    const type = leaveTypes.find((t) => t.code === leaveTypeCode);
    const max = parseInt(type?.maxDays, 10);
    return Number.isFinite(max) && max > 0 ? max : 1;
  };

  /** Inclusive end date: start + (maxDays - 1). e.g. 21 days from Jul 18 → Aug 7 */
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
  // Load applied leaves
  const loadAppliedLeaves = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/hr/leaves?facilityId=${facilityId}`,
      (response) => {
        if (response.success) {
          setAppliedLeaves(response.data?.leaves || []);
        }
      },
      (error) => {
        console.error("Error loading applied leaves:", error);
        setAppliedLeaves([]);
      }
    );
  }, [facilityId]);


  // Load leave types
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

  useEffect(() => {
    loadAppliedLeaves();
    loadLeaveTypes();
  }, [loadAppliedLeaves, loadLeaveTypes]);

  // Filter leaves based on search
  useEffect(() => {
    let filtered = Array.isArray(appliedLeaves) ? appliedLeaves : [];

    if (searchTerm) {
      filtered = filtered.filter(
        (leave) =>
          leave.employee?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          leave.employee?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          leave.leaveType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          leave.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          leave.status?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLeaves(filtered);
  }, [appliedLeaves, searchTerm]);



  // Handle apply leave form submission
  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...applyLeaveForm,
        facilityId, // Explicitly add facilityId to the payload
      };

      _postApi(
        "/api/hr/leaves",
        payload,
        (response) => {
          if (response.success) {
            toast.success("Leave request submitted successfully!");
            setShowApplyLeaveModal(false);
            setApplyLeaveForm({
              employeeId: "",
              leaveType: "",
              startDate: "",
              endDate: "",
              reason: "",
            });
            setSelectedEmployee(null);
            loadAppliedLeaves(); // Refresh the applied leaves list
          } else {
            toast.error(response.message || "Failed to submit leave request");
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error submitting leave request:", error);
          toast.error("Error submitting leave request");
          setLoading(false);
        }
      );
    } catch (error) {
      console.error("Error submitting leave request:", error);
      toast.error("Error submitting leave request");
      setLoading(false);
    }
  };

  // Handle employee selection for apply leave
  const handleEmployeeSelect = (employee) => {
    if (employee) {
      setSelectedEmployee(employee);
      setApplyLeaveForm((prev) => ({
        ...prev,
        employeeId: employee.id,
      }));
    } else {
      // Handle clearing selection
      setSelectedEmployee(null);
      setApplyLeaveForm((prev) => ({
        ...prev,
        employeeId: "",
      }));
    }
  };

  // Handle leave actions
  const closeConfirmModal = () => {
    if (actionLoading) return;
    setConfirmModal(null);
    setRejectionReason("");
    setEarlyReturnForm({ returnDate: "", reason: "" });
  };

  const toInputDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const openConfirmModal = (type, leave) => {
    setRejectionReason("");
    if (type === "early-return") {
      const start = toInputDate(leave.startDate);
      setEarlyReturnForm({
        returnDate: start,
        reason: "",
      });
    } else {
      setEarlyReturnForm({ returnDate: "", reason: "" });
    }
    setConfirmModal({ type, leave });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal?.leave) return;
    const { type, leave } = confirmModal;

    if (type === "reject" && !rejectionReason.trim()) {
      return toast.error("Please provide a reason for rejection");
    }

    if (type === "early-return") {
      if (!earlyReturnForm.returnDate) {
        return toast.error("Select the actual return date");
      }
      if (!earlyReturnForm.reason.trim()) {
        return toast.error("Please provide a reason for early return");
      }
    }

    setActionLoading(true);
    try {
      let url = "";
      let body = { facilityId };

      if (type === "approve") {
        url = `/api/hr/leaves/${leave.id}/approve`;
        body.comments = "Approved";
      } else if (type === "reject") {
        url = `/api/hr/leaves/${leave.id}/reject`;
        body.rejectionReason = rejectionReason.trim();
      } else if (type === "cancel") {
        url = `/api/hr/leaves/${leave.id}/cancel`;
      } else if (type === "early-return") {
        url = `/api/hr/leaves/${leave.id}/early-return`;
        body.returnDate = earlyReturnForm.returnDate;
        body.reason = earlyReturnForm.reason.trim();
      }

      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: localStorage.getItem("@@__token") || "" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (data.success) {
        loadAppliedLeaves();
        const messages = {
          approve: "Leave request approved successfully",
          reject: "Leave request rejected",
          cancel: "Leave request cancelled successfully",
          "early-return":
            data.message || "Early return recorded successfully",
        };
        toast.success(messages[type] || "Done");
        setConfirmModal(null);
        setRejectionReason("");
        setEarlyReturnForm({ returnDate: "", reason: "" });
      } else {
        toast.error(data.message || "Action failed");
      }
    } catch (error) {
      console.error(`Error ${type} leave:`, error);
      toast.error("Error processing leave action");
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewLeave = (leave) => {
    // TODO: Implement view leave modal
    console.log("View leave:", leave);
  };

  const handleApproveLeave = (leave) => openConfirmModal("approve", leave);
  const handleRejectLeave = (leave) => openConfirmModal("reject", leave);
  const handleCancelLeave = (leave) => openConfirmModal("cancel", leave);
  const handleEarlyReturn = (leave) => openConfirmModal("early-return", leave);
  // Open apply leave modal
  const handleApplyLeave = () => {
    setApplyLeaveForm({
      employeeId: "",
      leaveType: "",
      startDate: "",
      endDate: "",
      reason: "",
    });
    setSelectedEmployee(null);
    setShowApplyLeaveModal(true);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      case "Cancelled":
        return "bg-gray-100 text-gray-800";
      case "Returned Early":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Define columns for CustomTable1
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
          <div className="text-sm text-gray-500">{item.employee?.designation}</div>
        </div>
      ),
    },
    {
      value: "leaveType",
      title: "Leave Type",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-[color:var(--app-primary)]/15 text-[color:var(--app-primary)]">
            {item.leaveType}
          </span>
        </div>
      ),
    },
    {
      value: "dates",
      title: "Date Range",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div>
          <div className="text-sm text-gray-900">
            {new Date(item.startDate).toLocaleDateString()} -{" "}
            {new Date(item.endDate).toLocaleDateString()}
          </div>
          <div className="text-sm text-gray-500">{item.totalDays} days</div>
          {item.originalEndDate && item.status === "Returned Early" ? (
            <div className="text-[11px] text-orange-600 mt-0.5">
              Was until {new Date(item.originalEndDate).toLocaleDateString()}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      value: "reason",
      title: "Reason",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm text-gray-900 max-w-xs truncate">
          {item.reason}
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
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
              item.status
            )}`}
          >
            {item.status}
          </span>
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handleViewLeave(item)}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              {item.status === "Pending" && (
                <>
                  <DropdownMenuItem onClick={() => handleApproveLeave(item)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRejectLeave(item)}>
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCancelLeave(item)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                </>
              )}
              {item.status === "Approved" && (
                <DropdownMenuItem onClick={() => handleEarlyReturn(item)}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Early Return
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6" style={appColorStyle}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--app-primary)]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={appColorStyle}>
      <div className="max-w-7xl mx-auto">
        <div className="p-6 px-1">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Total :{" "}
                <span className="font-semibold text-gray-900">
                  {Array.isArray(appliedLeaves) ? appliedLeaves.length : 0}
                </span>
              </span>
              <span className="text-sm text-gray-600">
                Pending:{" "}
                <span className="font-semibold text-yellow-600">
                  {Array.isArray(appliedLeaves)
                    ? appliedLeaves.filter((item) => item.status === "Pending").length
                    : 0}
                </span>
              </span>
              <span className="text-sm text-gray-600">
                Approved:{" "}
                <span className="font-semibold text-green-600">
                  {Array.isArray(appliedLeaves)
                    ? appliedLeaves.filter((item) => item.status === "Approved").length
                    : 0}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row align-items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search leaves by employee, type, reason..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <CustomButton onClick={handleApplyLeave} mb="0">
              <FileText className="w-5 h-5" />
              Apply for Leave
            </CustomButton>
          </div>

          <div className="overflow-x-auto">
            <CustomTable1
              data={filteredLeaves}
              fields={columns}
              loading={loading}
              message="No leave requests found"
            />
          </div>
        </div>
      </div>


      {/* Apply for Leave Modal */}
      {showApplyLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Calendar className="h-6 w-6 mr-2" />
                  Apply for Leave
                </h2>
                <button
                  onClick={() => setShowApplyLeaveModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleApplyLeaveSubmit} className="space-y-6">
                {/* Employee Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee *
                  </label>
                  <SearchEmployeeInput
                    value={selectedEmployee}
                    onChange={handleEmployeeSelect}
                    placeholder="Search employees by name or ID..."
                    edge={true}
                  />
                </div>

                {/* Leave Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type *
                  </label>
                  <select
                    value={applyLeaveForm.leaveType}
                    onChange={(e) => {
                      const leaveType = e.target.value;
                      setApplyLeaveForm((prev) => ({
                        ...prev,
                        leaveType,
                        endDate: prev.startDate
                          ? computeDefaultEndDate(prev.startDate, leaveType)
                          : prev.endDate,
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent bg-white"
                  >
                    <option value="">Select Leave Type</option>
                    {leaveTypes.map((type) => (
                      <option key={type.code} value={type.code}>
                        {type.name} ({type.isPaid ? "Paid" : "Unpaid"}) - Max {type.maxDays} days
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range — End Date defaults to Start + max days */}
                <div
                  className={`grid grid-cols-1 gap-4 ${
                    applyLeaveForm.startDate ? "md:grid-cols-2" : ""
                  }`}
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={applyLeaveForm.startDate}
                      onChange={(e) => {
                        const startDate = e.target.value;
                        setApplyLeaveForm((prev) => ({
                          ...prev,
                          startDate,
                          endDate: startDate
                            ? computeDefaultEndDate(startDate, prev.leaveType)
                            : "",
                        }));
                      }}
                      min={new Date().toISOString().split("T")[0]}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent"
                    />
                  </div>
                  {applyLeaveForm.startDate ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date *
                      </label>
                      <input
                        type="date"
                        value={applyLeaveForm.endDate}
                        onChange={(e) =>
                          setApplyLeaveForm({
                            ...applyLeaveForm,
                            endDate: e.target.value,
                          })
                        }
                        min={applyLeaveForm.startDate}
                        max={computeDefaultEndDate(
                          applyLeaveForm.startDate,
                          applyLeaveForm.leaveType
                        )}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent"
                      />
                      {applyLeaveForm.leaveType ? (
                        <p className="text-xs text-gray-500 mt-1">
                          Max{" "}
                          {getSelectedLeaveMaxDays(applyLeaveForm.leaveType)}{" "}
                          days from start (default end date)
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason *
                  </label>
                  <textarea
                    value={applyLeaveForm.reason}
                    onChange={(e) =>
                      setApplyLeaveForm({ ...applyLeaveForm, reason: e.target.value })
                    }
                    rows={4}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent"
                    placeholder="Please provide a reason for your leave request..."
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowApplyLeaveModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <CustomButton
                    type="submit"
                    loading={loading}
                    disabled={loading}
                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                    mb="0"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Submit Leave Request
                  </CustomButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Approve / Reject / Cancel / Early Return confirmation modal */}
      {confirmModal?.leave && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
            <div
              className="p-5 text-white"
              style={{
                background:
                  confirmModal.type === "approve"
                    ? headerGradient
                    : confirmModal.type === "early-return"
                      ? "linear-gradient(to right, #ea580c, #c2410c)"
                      : confirmModal.type === "reject"
                        ? "linear-gradient(to right, #dc2626, #b91c1c)"
                        : "linear-gradient(to right, #64748b, #475569)",
              }}
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="text-xl font-bold">
                    {confirmModal.type === "approve"
                      ? "Approve Leave"
                      : confirmModal.type === "reject"
                        ? "Reject Leave"
                        : confirmModal.type === "early-return"
                          ? "Early Return"
                          : "Cancel Leave"}
                  </h3>
                  <p className="text-white/80 text-xs mt-1 font-medium">
                    {confirmModal.type === "approve"
                      ? "Confirm approval of this leave request"
                      : confirmModal.type === "reject"
                        ? "This will reject the leave request"
                        : confirmModal.type === "early-return"
                          ? "Employee is returning before the leave ends"
                          : "This will cancel the leave request"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeConfirmModal}
                  className="p-1 hover:bg-white/20 rounded-full transition-all shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">
                {confirmModal.type === "approve"
                  ? "Approve leave request for"
                  : confirmModal.type === "reject"
                    ? "Reject leave request for"
                    : confirmModal.type === "early-return"
                      ? "Record early return for"
                      : "Cancel leave request for"}{" "}
                <span className="font-bold text-slate-900">
                  {confirmModal.leave.employee?.firstName}{" "}
                  {confirmModal.leave.employee?.lastName}
                </span>
                ?
              </p>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Leave Type</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {confirmModal.leave.leaveType}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Original Dates</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {confirmModal.leave.startDate
                      ? new Date(
                          confirmModal.leave.startDate
                        ).toLocaleDateString()
                      : "—"}{" "}
                    –{" "}
                    {confirmModal.leave.endDate
                      ? new Date(
                          confirmModal.leave.endDate
                        ).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Days</span>
                  <span className="font-semibold text-slate-900">
                    {confirmModal.leave.totalDays ?? "—"}
                  </span>
                </div>
              </div>

              {confirmModal.type === "reject" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="Please provide a reason for rejection..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 resize-none"
                    style={{ "--tw-ring-color": primaryColor }}
                  />
                </div>
              )}

              {confirmModal.type === "early-return" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">
                      Actual Return Date *
                    </label>
                    <input
                      type="date"
                      value={earlyReturnForm.returnDate}
                      min={toInputDate(confirmModal.leave.startDate)}
                      max={(() => {
                        const end = new Date(confirmModal.leave.endDate);
                        end.setDate(end.getDate() - 1);
                        return toInputDate(end);
                      })()}
                      onChange={(e) =>
                        setEarlyReturnForm((prev) => ({
                          ...prev,
                          returnDate: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2"
                      style={{ "--tw-ring-color": primaryColor }}
                    />
                    <p className="text-[11px] text-slate-500">
                      Must be on or after start date, and before original end
                      date. Unused days are restored to leave balance.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">
                      Reason for Early Return *
                    </label>
                    <textarea
                      value={earlyReturnForm.reason}
                      onChange={(e) =>
                        setEarlyReturnForm((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Why is the employee returning early?"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 resize-none"
                      style={{ "--tw-ring-color": primaryColor }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={actionLoading}
                onClick={closeConfirmModal}
                className="rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAction}
                className="rounded-xl font-bold text-white px-6 hover:opacity-90"
                style={
                  confirmModal.type === "approve"
                    ? brandButtonStyle
                    : confirmModal.type === "early-return"
                      ? {
                          backgroundColor: "#ea580c",
                          borderColor: "#ea580c",
                          color: "#fff",
                        }
                      : confirmModal.type === "reject"
                        ? {
                            backgroundColor: "#dc2626",
                            borderColor: "#dc2626",
                            color: "#fff",
                          }
                        : {
                            backgroundColor: "#475569",
                            borderColor: "#475569",
                            color: "#fff",
                          }
                }
              >
                {actionLoading
                  ? "Please wait..."
                  : confirmModal.type === "approve"
                    ? "Approve"
                    : confirmModal.type === "reject"
                      ? "Reject"
                      : confirmModal.type === "early-return"
                        ? "Confirm Early Return"
                        : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;