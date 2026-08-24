import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  Building2,
  X,
  Eye,
  Loader,
  UserPlus,
  Power,
  PowerOff,
  MoreVerticalIcon,
  Copy,
} from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomButton from "@/common/Custom/CustomButton";
import { _fetchApi, _postApi, _deleteApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Alert } from "reactstrap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const ManageDepartments = ({ embedded = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    head: "",
    status: "active",
  });
  const [memberFormData, setMemberFormData] = useState({
    userId: "",
  });

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.departmentName,
      code: department.departmentCode,
      description: department.description,
      head: department.headOfDepartment,
      status: department.status || "active",
      id: department.id,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter department name");
      return;
    }

    setLoading2(true);
    const endpoint = editingDepartment
      ? "/api/update/department/by-id"
      : "/api/add/department";

    _postApi(
      endpoint,
      {
        departmentName: formData.name,
        departmentCode: formData.code,
        description: formData.description,
        headOfDepartment: formData.head,
        status: formData.status,
        id: formData.id,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          toast.success(
            res.message ||
              `Department ${
                editingDepartment ? "updated" : "created"
              } successfully`
          );
          handleCancel();
          getDepartments();
        } else {
          toast.error(res.message || "Failed to submit");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleDelete = (department) => {
    setLoading2(true);
    _deleteApi(
      "/api/delete/department",
      {
        departmentId: department.id,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Department deleted successfully");
          handleCancel();
          getDepartments();
        } else {
          toast.error(res.message || "Failed to delete");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while deleting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleStatusUpdate = (status) => {
    setLoading2(true);
    _postApi(
      "/api/update/department/status",
      {
        departmentId: selectedDepartment.id,
        status,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Status updated successfully");
          setShowStatusModal(false);
          getDepartments();
        } else {
          toast.error(res.message || "Failed to update status");
        }
        setLoading2(false);
      },
      (err) => {
        console.error(err);
        setLoading2(false);
        toast.error("Server error occurred.");
      }
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setShowDeleteModal(false);
    setShowMembersModal(false);
    setEditingDepartment(null);
    setSelectedDepartment(null);
    setLoading2(false);
    setFormData({
      name: "",
      code: "",
      description: "",
      head: "",
      status: "active",
    });
    setMemberFormData({
      userId: "",
    });
  };

  const handleView = (department) => {
    setSelectedDepartment(department);
    setShowDepartmentModal(true);
  };

  const handleViewMembers = (department) => {
    setSelectedDepartment(department);
    getDepartmentMembers(department.id);
    setShowMembersModal(true);
  };

  const handleShowDelete = (department) => {
    setSelectedDepartment(department);
    setShowDeleteModal(true);
  };

  const handleShowStatus = (department) => {
    setSelectedDepartment(department);
    setShowStatusModal(true);
  };

  const addMember = () => {
    if (!memberFormData.userId) {
      toast.error("Please select a staff member");
      return;
    }

    setLoading2(true);
    _postApi(
      "/api/add/department/members/by-id",
      {
        userId: memberFormData.userId,
        departmentId: selectedDepartment.id,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Member added successfully");
          setMemberFormData({ userId: "" });
          getDepartmentMembers(selectedDepartment.id);
          getUsers();
        } else {
          toast.error(res.message || "Failed to add member");
        }
        setLoading2(false);
      },
      (err) => {
        console.error(err);
        setLoading2(false);
        toast.error("Server error occurred.");
      }
    );
  };

  const getDepartments = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/get/department?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setDepartments(data.results);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  }, [activeBusiness.id]);

  const getDepartmentMembers = (departmentId) => {
    _fetchApi(
      `/api/get/department/members/${activeBusiness.id}/${departmentId}`,
      (data) => {
        if (data.success) {
          setDepartmentStaff(data.results);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const getUsers = useCallback(() => {
    _fetchApi(
      `/api/v1/get-users-by-facility/${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setStaffMembers(data.results);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getDepartments();
    getUsers();
  }, [getDepartments, getUsers]);

  const getStatusBadge = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-red-100 text-red-800",
      verified: "bg-green-100 text-green-800",
      suspended: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
    };
    return `px-3 py-1 rounded-full text-xs font-medium ${
      colors[status] || colors.pending
    }`;
  };

  const copyDepartmentId = async (id) => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(String(id));
      toast.success("Department ID copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const fields = [
    {
      title: "Department",
      custom: true,
      component: (item) => (
        <div className="">
          <div className="font-medium text-gray-900">{item.departmentName}</div>
          {item.departmentCode && (
            <div className="text-sm text-gray-500 mt-1">
              Code: {item.departmentCode}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Department ID",
      custom: true,
      component: (item) => (
        <button
          type="button"
          onClick={() => copyDepartmentId(item.id)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-left hover:bg-slate-100 hover:border-slate-300 transition-colors"
          title={item.id ? `Copy: ${item.id}` : undefined}
        >
          <span className="text-xs font-mono text-slate-600">
            {item.id ?? "—"}
          </span>
          {item.id ? <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
        </button>
      ),
    },
    {
      title: "Description",
      custom: true,
      component: (item) => (
        <div className="text-gray-600">
          {item.description || "No description"}
        </div>
      ),
    },
    {
      title: "Head of Department",
      custom: true,
      component: (item) => (
        <div className="text-gray-900">
          {item.headFirstname && item.headLastname
            ? `${item.headFirstname} ${item.headLastname}`
            : "Not assigned"}
        </div>
      ),
    },
    {
      title: "Staff Count",
      custom: true,
      classNames: "text-center",
      component: (item) => (
        <div className="flex items-center space-x-2 ">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-gray-900">{item.staffCount || 0}</span>
        </div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <span className={`${getStatusBadge(item.status)}`}>
            {item.status || "active"}
          </span>
        </div>
      ),
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center flex gap-1 justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => handleEdit(item)}>
                Edit Dept
              </DropdownMenuItem>
              {/* <DropdownMenuItem onClick={() => handleView(item)}>
                View Dept
              </DropdownMenuItem> */}
              <DropdownMenuItem onClick={() => handleViewMembers(item)}>
                Manage Dept
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShowStatus(item)}>
                {item.status === "active" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              {/* <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleShowDelete(item)}>
                Delete Dept
              </DropdownMenuItem> */}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* <button
            onClick={() => handleEdit(item)}
            className="p-2 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
            title="Edit department"
          >
            <Edit2 className="h-4 w-4" />
          </button> */}
          {/* <button
            onClick={() => handleView(item)}
            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
            title="View department"
          >
            <Eye className="h-4 w-4" />
          </button> */}
          {/* <button
            onClick={() => handleViewMembers(item)}
            className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
            title="Manage members"
          >
            <Users className="h-4 w-4" />
          </button> */}
          {/* <button
            onClick={() => handleShowStatus(item)}
            className={`p-2 rounded-lg transition-colors ${
              item.status === "active"
                ? "text-red-400 hover:text-red-600 hover:bg-red-50"
                : "text-green-400 hover:text-green-600 hover:bg-green-50"
            }`}
            title={item.status === "active" ? "Deactivate" : "Activate"}
          >
            {item.status === "active" ? (
              <PowerOff className="w-4 h-4" />
            ) : (
              <Power className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => handleShowDelete(item)}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            title="Delete department"
          >
            <Trash2 className="h-4 w-4" />
          </button> */}
        </div>
      ),
    },
  ];

  const filteredDepartments = departments.filter(
    (dept) =>
      dept.departmentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.departmentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(dept.id || "").includes(searchTerm.trim())
  );

  return (
    <>
      <div className={embedded ? "pb-2" : "min-h-screen"}>
        <div className="max-w-7xl mx-auto">
          <div className="">
            <div className="p-">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Manage Departments
                </h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Total:{" "}
                    <span className="font-semibold text-gray-900">
                      {departments.length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Active:{" "}
                    <span className="font-semibold text-green-600">
                      {departments.filter((d) => d.status === "active").length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Inactive:{" "}
                    <span className="font-semibold text-red-600">
                      {
                        departments.filter((d) => d.status === "inactive")
                          .length
                      }
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search departments by name, code, or ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <CustomButton onClick={() => setIsModalOpen(true)}>
                <Plus className="w-5 h-5" />
                Add Department
              </CustomButton>
            </div>

            <div className="overflow-x-auto">
              {loading && (
                <div className="flex mx-auto">
                  <Loader className="animate-spin w-7 h-7 mx-auto" />
                </div>
              )}
              {!loading ? (
                <CustomTable1
                  data={filteredDepartments}
                  fields={fields}
                  message="No data to view"
                />
              ) : (
                <Alert className="mt-3 text-center" color="info">
                  Loading
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Department Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingDepartment ? "Edit Department" : "Add New Department"}
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter department name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department Code
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="e.g., HR, IT, MKT"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent resize-none"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of the department's role"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Head of Department
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      value={formData.head}
                      onChange={(e) =>
                        setFormData({ ...formData, head: e.target.value })
                      }
                    >
                      <option value="">Select department head</option>
                      {staffMembers.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.firstname} {staff.lastname} ({staff.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <CustomButton
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading2}
                    className="flex-1 bg-[var(--aa-accent)] hover:bg-[var(--aa-accent-hover)] text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading2 ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mx-auto" />
                      </>
                    ) : editingDepartment ? (
                      "Update Department"
                    ) : (
                      "Create Department"
                    )}
                  </CustomButton>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Department Modal */}
      {/* {showDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Department Details
                </h2>
                <button
                  onClick={() => setShowDepartmentModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {selectedDepartment?.departmentName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedDepartment?.departmentName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedDepartment?.departmentCode || "No code"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Status:{" "}
                      <span
                        className={`font-medium ${
                          selectedDepartment?.status === "active"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedDepartment?.status || "active"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Description:{" "}
                    <span className="font-normal">
                      {selectedDepartment?.description ||
                        "No description available"}
                    </span>
                  </p>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Head:{" "}
                    <span className="font-normal">
                      {selectedDepartment?.headFirstname &&
                      selectedDepartment?.headLastname
                        ? `${selectedDepartment.headFirstname} ${selectedDepartment.headLastname}`
                        : "Not assigned"}
                    </span>
                  </p>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Staff Count:{" "}
                    <span className="font-normal">
                      {selectedDepartment?.staffCount || 0}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDepartmentModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* Members Management Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Manage Department Members
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Department Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Department
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedDepartment?.departmentName}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Head</h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedDepartment?.headFirstname &&
                      selectedDepartment?.headLastname
                        ? `${selectedDepartment.headFirstname} ${selectedDepartment.headLastname}`
                        : "Not assigned"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Total Staff
                    </h3>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {departmentStaff.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Member Section */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Staff Member
                    </label>
                    <select
                      value={memberFormData.userId}
                      onChange={(e) =>
                        setMemberFormData({ userId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-blue-500 outline-none"
                    >
                      <option value="">Select staff member</option>
                      {staffMembers
                        .filter(
                          (staff) =>
                            !departmentStaff.some(
                              (deptStaff) => deptStaff.id === staff.id
                            )
                        )
                        .map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.firstname} {staff.lastname} ({staff.email})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="pb-[6px]">
                    {" "}
                    {/* align with the bottom of the select box */}
                    <CustomButton
                      loading={loading2}
                      onClick={addMember}
                      disabled={!memberFormData.userId}
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Member
                    </CustomButton>
                  </div>
                </div>
              </div>

              {/* Staff List */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Email
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">
                          Status
                        </th>
                        <th className="text-center py-3 px-4 font-medium text-gray-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {departmentStaff.map((staff) => (
                        <tr
                          key={staff.id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {staff.firstname} {staff.lastname}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-gray-600">{staff.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`${getStatusBadge(staff.status)}`}>
                              {staff.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Remove from department"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {departmentStaff.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No staff members found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Add your first staff member to get started
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Update Department Status
                </h2>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {selectedDepartment?.departmentName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedDepartment?.departmentName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedDepartment?.departmentCode || "No code"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Current Status:{" "}
                      <span
                        className={`font-medium ${
                          selectedDepartment?.status === "active"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedDepartment?.status || "active"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Select new status for this department:
                  </p>

                  <button
                    onClick={() => handleStatusUpdate("active")}
                    className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                      selectedDepartment?.status === "active"
                        ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                        : "border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 cursor-pointer"
                    }`}
                    disabled={
                      selectedDepartment?.status === "active" || loading2
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Power className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-green-700">
                          Activate Department
                        </div>
                        <div className="text-sm text-green-600">
                          The department will be active in the system.
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleStatusUpdate("inactive")}
                    className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                      selectedDepartment?.status === "inactive"
                        ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                        : "border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 cursor-pointer"
                    }`}
                    disabled={
                      selectedDepartment?.status === "inactive" || loading2
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <PowerOff className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium text-red-700">
                          Deactivate Department
                        </div>
                        <div className="text-sm text-red-600">
                          The department will be inactive in the system.
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {/* {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Confirm Delete
                </h2>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete the following department?
                </p>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p>
                    <strong>Department:</strong>{" "}
                    {selectedDepartment?.departmentName}
                  </p>
                  <p>
                    <strong>Code:</strong>{" "}
                    {selectedDepartment?.departmentCode || "N/A"}
                  </p>
                  <p>
                    <strong>Head:</strong>{" "}
                    {selectedDepartment?.headFirstname &&
                    selectedDepartment?.headLastname
                      ? `${selectedDepartment.headFirstname} ${selectedDepartment.headLastname}`
                      : "Not assigned"}
                  </p>
                  <p>
                    <strong>Staff Count:</strong>{" "}
                    {selectedDepartment?.staffCount || 0}
                  </p>
                </div>
                <p className="text-red-600 text-sm mt-3">
                  <strong>Warning:</strong> This action cannot be undone. All
                  department data and associations will be permanently deleted.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleDelete(selectedDepartment);
                    setShowDeleteModal(false);
                  }}
                  disabled={loading2}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading2 ? (
                    <>
                      <Loader className="animate-spin w-4 h-4 mx-auto" />
                    </>
                  ) : (
                    "Delete Department"
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </>
  );
};

export default ManageDepartments;
