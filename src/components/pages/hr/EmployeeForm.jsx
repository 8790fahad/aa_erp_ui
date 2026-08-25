import React, { useState, useEffect, useMemo } from "react";
import { Save, X, User, Building, DollarSign, Search, Plus } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input, Label } from "reactstrap/lib";
import { accountTypes } from "@/lib/utils";
import CustomButton from "@/common/Custom/CustomButton";
import BankTypeahead from "../../common/BankTypeahead";
import { formatNumberWithCommas } from "@/utils/numberUtils";
import { getAaBrandColors } from "@/lib/aaBrand";

const readPayeFlag = (employee, key) => {
  const fromProfile = employee?.payeProfile?.[key];
  if (fromProfile !== undefined && fromProfile !== null) {
    return fromProfile !== false && fromProfile !== 0 && fromProfile !== "0";
  }
  const direct = employee?.[key];
  if (direct !== undefined && direct !== null) {
    return direct !== false && direct !== 0 && direct !== "0";
  }
  return true;
};

const EmployeeForm = ({
  employee,
  onSave,
  onCancel,
  departments = [],
}) => {
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
  const shadePrimary = (hex, percent) => {
    const h = String(hex || "").replace("#", "").trim();
    if (![3, 6].includes(h.length)) return primaryColor;
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(full, 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };
  const headerGradient = `linear-gradient(to right, ${primaryColor}, ${shadePrimary(
    primaryColor,
    -14,
  )})`;

  const [formData, setFormData] = useState({
    userId: "",
    employeeId: "",
    firstName: "",
    lastName: "",
    gender: "Male",
    dateOfBirth: "",
    contactInfo: "",
    address: "",
    nationalId: "",
    bankAccount: "",
    bankName: "",
    bankCode: "",
    accountName: "",
    accountType: "",
    photoUrl: "",
    departmentId: "",
    designation: "",
    hireDate: "",
    contractType: "Permanent",
    basicSalary: "",
    allowances: [{ name: "", amount: "" }],
    deductions: [{ name: "", amount: "" }],
    appliesRent: true,
    appliesNHF: true,
    appliesNHIS: true,
    appliesPension: true,
    emergencyContact: "",
    emergencyPhone: "",
    nextOfKin: "",
    nextOfKinPhone: "",
    status: "Active",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [departmentList, setDepartmentList] = useState([]);
  const [deptQuery, setDeptQuery] = useState("");
  const [showDeptMenu, setShowDeptMenu] = useState(false);
  const [creatingDept, setCreatingDept] = useState(false);

  // Bank account management state
  const [bankList, setBankList] = useState([]);
  const [roleList, setRoleList] = useState([]);
  const [roleQuery, setRoleQuery] = useState("");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState({});

  // Load users and departments on component mount
  useEffect(() => {
    loadUsers();
    loadDepartments();
    loadRoles();
    getBankList();
  }, [activeBusiness?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showUserDropdown &&
        !event.target.closest(".user-dropdown-container")
      ) {
        setShowUserDropdown(false);
      }
      if (showDeptMenu && !event.target.closest(".dept-dropdown-container")) {
        setShowDeptMenu(false);
      }
      if (showRoleMenu && !event.target.closest(".role-dropdown-container")) {
        setShowRoleMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserDropdown, showDeptMenu, showRoleMenu]);

  useEffect(() => {
    if (employee) {
      const structure = employee.salaryStructure || {};
      const parseMap = (raw) => {
        let map = raw;
        if (typeof raw === "string") {
          try {
            map = JSON.parse(raw);
          } catch {
            map = {};
          }
        }
        if (!map || typeof map !== "object") return [{ name: "", amount: "" }];
        const rows = Object.entries(map).map(([name, amount]) => ({
          name,
          amount: String(amount ?? ""),
        }));
        return rows.length ? rows : [{ name: "", amount: "" }];
      };

      setFormData({
        userId: employee.userId || "",
        employeeId: employee.employeeId || "",
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        gender: employee.gender || "Male",
        dateOfBirth: employee.dateOfBirth
          ? employee.dateOfBirth.split("T")[0]
          : "",
        contactInfo: employee.contactInfo || "",
        address: employee.address || "",
        nationalId: employee.nationalId || "",
        bankAccount: employee.bankAccount || "",
        bankName: employee.bankName || "",
        bankCode: employee.bankCode || "",
        accountName: employee.accountName || "",
        accountType: employee.accountType || "",
        photoUrl: employee.photoUrl || "",
        departmentId: employee.departmentId || "",
        designation: employee.designation || "",
        hireDate: employee.hireDate ? employee.hireDate.split("T")[0] : "",
        contractType: employee.contractType || "Permanent",
        basicSalary: structure.basicSalary
          ? String(structure.basicSalary)
          : "",
        allowances: parseMap(structure.allowances),
        deductions: parseMap(structure.deductions),
        appliesRent: readPayeFlag(employee, "appliesRent"),
        appliesNHF: readPayeFlag(employee, "appliesNHF"),
        appliesNHIS: readPayeFlag(employee, "appliesNHIS"),
        appliesPension: readPayeFlag(employee, "appliesPension"),
        emergencyContact: employee.emergencyContact || "",
        emergencyPhone: employee.emergencyPhone || "",
        nextOfKin: employee.nextOfKin || "",
        nextOfKinPhone: employee.nextOfKinPhone || "",
        status: employee.status || "Active",
      });
      setRoleQuery(employee.designation || "");
      const deptName =
        employee.department?.departmentName ||
        employee.departmentName ||
        "";
      setDeptQuery(deptName);
    }
  }, [employee]);

  // Keep department input label in sync when list loads
  useEffect(() => {
    if (!formData.departmentId || deptQuery) return;
    const match = departmentList.find(
      (d) => String(d.id) === String(formData.departmentId),
    );
    if (match?.departmentName) setDeptQuery(match.departmentName);
  }, [departmentList, formData.departmentId, deptQuery]);

  // Load users from the same API as StaffManagement
  const loadUsers = () => {
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
  };

  // Load departments from the HR API
  const loadDepartments = () => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/get/department?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setDepartmentList(data.results);
        }
      },
      (err) => {
        console.error("Error fetching departments:", err);
      }
    );
  };

  // Load roles for selection
  const loadRoles = () => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/users/roles-list?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setRoleList(data.results || []);
        }
      },
      (err) => {
        console.error("Error fetching roles:", err);
      }
    );
  };

  const filteredDepartments = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    if (!q) return departmentList;
    return departmentList.filter((d) =>
      String(d.departmentName || "")
        .toLowerCase()
        .includes(q),
    );
  }, [departmentList, deptQuery]);

  const filteredRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return roleList;
    return roleList.filter((r) =>
      String(r.name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [roleList, roleQuery]);

  const exactDeptMatch = useMemo(() => {
    const q = deptQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      departmentList.find(
        (d) => String(d.departmentName || "").toLowerCase() === q,
      ) || null
    );
  }, [departmentList, deptQuery]);

  const exactRoleMatch = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      roleList.find((r) => String(r.name || "").toLowerCase() === q) || null
    );
  }, [roleList, roleQuery]);

  const ensureDepartment = () =>
    new Promise((resolve, reject) => {
      const name = deptQuery.trim();
      if (!name) {
        reject(new Error("Department is required"));
        return;
      }
      if (formData.departmentId) {
        const stillValid = departmentList.some(
          (d) => String(d.id) === String(formData.departmentId),
        );
        if (stillValid) {
          resolve(formData.departmentId);
          return;
        }
      }
      if (exactDeptMatch) {
        setFormData((prev) => ({ ...prev, departmentId: exactDeptMatch.id }));
        resolve(exactDeptMatch.id);
        return;
      }
      setCreatingDept(true);
      _postApi(
        "/api/add/department",
        {
          departmentName: name,
          facilityId: activeBusiness.id,
          description: `Department created from employee registration`,
          status: "active",
        },
        (data) => {
          setCreatingDept(false);
          if (!data?.success) {
            toast.error(data?.message || "Failed to create department");
            reject(new Error(data?.message || "Failed to create department"));
            return;
          }
          const created = data.data || data.results || {};
          const newId = created.id;
          toast.success(`Department "${name}" created`);
          loadDepartments();
          if (newId) {
            setFormData((prev) => ({ ...prev, departmentId: newId }));
            resolve(newId);
          } else {
            // Fallback: reload then find by name
            _fetchApi(
              `/api/get/department?facilityId=${activeBusiness.id}`,
              (res) => {
                const list = res?.results || [];
                setDepartmentList(list);
                const found = list.find(
                  (d) =>
                    String(d.departmentName || "").toLowerCase() ===
                    name.toLowerCase(),
                );
                if (found) {
                  setFormData((prev) => ({ ...prev, departmentId: found.id }));
                  resolve(found.id);
                } else {
                  reject(new Error("Department created but could not resolve ID"));
                }
              },
              () => reject(new Error("Failed to reload departments")),
            );
          }
        },
        (err) => {
          setCreatingDept(false);
          console.error(err);
          toast.error("Error creating department");
          reject(err);
        },
      );
    });

  const ensureRole = () =>
    new Promise((resolve, reject) => {
      const name = (roleQuery || formData.designation || "").trim();
      if (!name) {
        reject(new Error("Role is required"));
        return;
      }
      if (exactRoleMatch || roleList.some((r) => r.name === name)) {
        setFormData((prev) => ({ ...prev, designation: name }));
        resolve(name);
        return;
      }
      setCreatingRole(true);
      _postApi(
        "/users/roles",
        {
          name,
          facilityId: activeBusiness.id,
          description: `Role created from employee registration`,
          status: "active",
        },
        (data) => {
          setCreatingRole(false);
          if (!data?.success) {
            // If already exists, still use the name
            if (/already exists/i.test(data?.message || "")) {
              setFormData((prev) => ({ ...prev, designation: name }));
              loadRoles();
              resolve(name);
              return;
            }
            toast.error(data?.message || "Failed to create role");
            reject(new Error(data?.message || "Failed to create role"));
            return;
          }
          toast.success(`Role "${name}" created`);
          loadRoles();
          setFormData((prev) => ({ ...prev, designation: name }));
          resolve(name);
        },
        (err) => {
          setCreatingRole(false);
          console.error(err);
          toast.error("Error creating role");
          reject(err);
        },
      );
    });

  // Fetch bank list
  const getBankList = () => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/bank/list?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setBankList(data.results || []);
        }
      },
      (err) => {
        console.error(err);
      }
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setUserSearchTerm(`${user.firstname} ${user.lastname}`);
    setShowUserDropdown(false);

    // Auto-select department if user has one
    const userDepartmentId = user.departmentId || user.department?.id || "";
    const userDeptName =
      user.department?.departmentName ||
      user.departmentName ||
      "";

    // Track which fields are auto-filled from user data
    const autoFilled = {
      firstName: !!user.firstname,
      lastName: !!user.lastname,
      contactInfo: !!(user.phone || user.email),
      address: !!user.address,
      departmentId: !!userDepartmentId,
      photoUrl: !!user.image,
      designation: !!user.role,
    };
    setAutoFilledFields(autoFilled);

    // Pre-populate form with user data
    setFormData((prev) => ({
      ...prev,
      userId: user.id,
      firstName: user.firstname || prev.firstName,
      lastName: user.lastname || prev.lastName,
      contactInfo: user.phone || user.email || prev.contactInfo,
      address: user.address || prev.address,
      departmentId: userDepartmentId || prev.departmentId,
      photoUrl: user.image || prev.photoUrl,
      designation: user.role || prev.designation,
    }));
    if (userDeptName) setDeptQuery(userDeptName);
    if (user.role) setRoleQuery(user.role);
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

  const validateForm = () => {
    const newErrors = {};

    // if (!formData.userId && !employee)
    //   newErrors.userId = "Please select a user or fill in employee details";
    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.dateOfBirth)
      newErrors.dateOfBirth = "Date of birth is required";
    if (!formData.contactInfo.trim())
      newErrors.contactInfo = "Contact info is required";
    if (!formData.departmentId && !deptQuery.trim())
      newErrors.departmentId = "Department is required";
    if (!(formData.designation || roleQuery).trim())
      newErrors.designation = "Role / designation is required";
    if (!formData.hireDate) newErrors.hireDate = "Hire date is required";
    const basic = parseFloat(String(formData.basicSalary).replace(/,/g, ""));
    if (!basic || basic <= 0) {
      newErrors.basicSalary = "Basic salary is required for payroll";
    }
    if (
      formData.employeeId.trim() &&
      !/^[A-Za-z0-9._-]+$/.test(formData.employeeId.trim())
    ) {
      newErrors.employeeId =
        "Employee ID may only contain letters, numbers, dots, dashes, and underscores";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateComponentRow = (field, index, key, value) => {
    setFormData((prev) => {
      const rows = [...(prev[field] || [])];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, [field]: rows };
    });
  };

  const addComponentRow = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), { name: "", amount: "" }],
    }));
  };

  const removeComponentRow = (field, index) => {
    setFormData((prev) => {
      const rows = [...(prev[field] || [])];
      if (rows.length <= 1) {
        return { ...prev, [field]: [{ name: "", amount: "" }] };
      }
      rows.splice(index, 1);
      return { ...prev, [field]: rows };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const departmentId = await ensureDepartment();
      const designation = await ensureRole();

      const cleanRows = (rows) =>
        (rows || [])
          .filter((r) => String(r.name || "").trim())
          .map((r) => ({
            name: String(r.name).trim(),
            amount: parseFloat(String(r.amount).replace(/,/g, "")) || 0,
          }));

      await onSave({
        ...formData,
        departmentId,
        designation,
        employeeId: formData.employeeId.trim(),
        basicSalary: parseFloat(String(formData.basicSalary).replace(/,/g, "")) || 0,
        allowances: cleanRows(formData.allowances),
        deductions: cleanRows(formData.deductions),
      });
    } catch (error) {
      console.error("Error saving employee:", error);
      toast.error(error?.message || "Failed to save employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      style={{ ["--app-primary"]: primaryColor }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="text-white p-4" style={{ background: headerGradient }}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">
                {employee ? "Edit Employee" : "Employee Registration"}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {employee
                  ? "Update employee details"
                  : "Add new employee to your organization"}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-white/20 rounded transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
        {/* User Selection */}
        {!employee && (
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Select User from System
            </h3>
            <div className="relative user-dropdown-container">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search and Select User *
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
                    errors.userId ? "border-red-500" : "border-gray-300"
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
                      No users found
                    </div>
                  )}
                </div>
              )}

              {errors.userId && (
                <p className="text-red-500 text-sm mt-1">{errors.userId}</p>
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
                      setAutoFilledFields({});
                      // Reset auto-filled fields
                      setFormData((prev) => ({
                        ...prev,
                        userId: "",
                        firstName: "",
                        lastName: "",
                        contactInfo: "",
                        address: "",
                        departmentId: "",
                        photoUrl: "",
                        designation: "",
                      }));
                      setDeptQuery("");
                      setRoleQuery("");
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

        {/* Personal Information */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
                {autoFilledFields.firstName && (
                  <span className="text-xs text-gray-500 ml-2">(Auto-filled from user data)</span>
                )}
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                disabled={autoFilledFields.firstName}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.firstName ? "border-red-500" : "border-gray-300"
                } ${autoFilledFields.firstName ? "bg-gray-50 cursor-not-allowed" : ""}`}
                placeholder="Enter first name"
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
                {autoFilledFields.lastName && (
                  <span className="text-xs text-gray-500 ml-2">(Auto-filled from user data)</span>
                )}
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                disabled={autoFilledFields.lastName}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.lastName ? "border-red-500" : "border-gray-300"
                } ${autoFilledFields.lastName ? "bg-gray-50 cursor-not-allowed" : ""}`}
                placeholder="Enter last name"
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] bg-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Info *
                {autoFilledFields.contactInfo && (
                  <span className="text-xs text-gray-500 ml-2">(Auto-filled from user data)</span>
                )}
              </label>
              <input
                type="text"
                name="contactInfo"
                value={formData.contactInfo}
                onChange={handleChange}
                disabled={autoFilledFields.contactInfo}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.contactInfo ? "border-red-500" : "border-gray-300"
                } ${autoFilledFields.contactInfo ? "bg-gray-50 cursor-not-allowed" : ""}`}
                placeholder="Phone number or email"
              />
              {errors.contactInfo && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.contactInfo}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.dateOfBirth ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.dateOfBirth && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.dateOfBirth}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                National ID
              </label>
              <input
                type="text"
                name="nationalId"
                value={formData.nationalId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)]"
                placeholder="Enter national ID"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
              {autoFilledFields.address && (
                <span className="text-xs text-gray-500 ml-2">(Auto-filled from user data)</span>
              )}
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={autoFilledFields.address}
              rows={3}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                autoFilledFields.address ? "bg-gray-50 cursor-not-allowed" : ""
              }`}
              placeholder="Enter address"
            />
          </div>
        </div>

        {/* Employment Information */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2" />
            Employment Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.employeeId ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="e.g. EMP-0001 or badge number"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for attendance ID card scanning. Leave blank to auto-generate.
              </p>
              {errors.employeeId && (
                <p className="text-red-500 text-sm mt-1">{errors.employeeId}</p>
              )}
            </div>

            <div className="dept-dropdown-container relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department *
                {autoFilledFields.departmentId && (
                  <span className="text-xs text-gray-500 ml-2">(Auto-filled from user data)</span>
                )}
              </label>
              <input
                type="text"
                value={deptQuery}
                disabled={autoFilledFields.departmentId}
                onFocus={() => setShowDeptMenu(true)}
                onChange={(e) => {
                  const value = e.target.value;
                  setDeptQuery(value);
                  setShowDeptMenu(true);
                  setFormData((prev) => ({ ...prev, departmentId: "" }));
                  if (errors.departmentId) {
                    setErrors((prev) => ({ ...prev, departmentId: "" }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.departmentId ? "border-red-500" : "border-gray-300"
                } ${autoFilledFields.departmentId ? "bg-gray-50 cursor-not-allowed" : "bg-white"}`}
                style={{ ["--tw-ring-color"]: primaryColor }}
                placeholder="Type to search or create department…"
              />
              {showDeptMenu && !autoFilledFields.departmentId && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredDepartments.map((dept) => (
                    <button
                      type="button"
                      key={dept.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          departmentId: dept.id,
                        }));
                        setDeptQuery(dept.departmentName || "");
                        setShowDeptMenu(false);
                      }}
                    >
                      {dept.departmentName}
                      {dept.departmentCode ? ` (${dept.departmentCode})` : ""}
                    </button>
                  ))}
                  {deptQuery.trim() && !exactDeptMatch && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm font-medium border-t border-gray-100 flex items-center gap-2"
                      style={{ color: primaryColor }}
                      disabled={creatingDept}
                      onClick={async () => {
                        try {
                          await ensureDepartment();
                          setShowDeptMenu(false);
                        } catch {
                          /* toast already shown */
                        }
                      }}
                    >
                      <Plus size={14} />
                      {creatingDept
                        ? "Creating…"
                        : `Create department “${deptQuery.trim()}”`}
                    </button>
                  )}
                  {!filteredDepartments.length && !deptQuery.trim() && (
                    <div className="px-3 py-2 text-xs text-gray-500">
                      No departments yet — type a name to create one
                    </div>
                  )}
                </div>
              )}
              {errors.departmentId && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.departmentId}
                </p>
              )}
            </div>

            <div className="role-dropdown-container relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role / Designation *
                {autoFilledFields.designation && (
                  <span className="text-xs text-gray-500 ml-2">(Auto-filled from user data)</span>
                )}
              </label>
              <input
                type="text"
                value={roleQuery}
                disabled={autoFilledFields.designation}
                onFocus={() => setShowRoleMenu(true)}
                onChange={(e) => {
                  const value = e.target.value;
                  setRoleQuery(value);
                  setShowRoleMenu(true);
                  setFormData((prev) => ({ ...prev, designation: value }));
                  if (errors.designation) {
                    setErrors((prev) => ({ ...prev, designation: "" }));
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.designation ? "border-red-500" : "border-gray-300"
                } ${autoFilledFields.designation ? "bg-gray-50 cursor-not-allowed" : "bg-white"}`}
                style={{ ["--tw-ring-color"]: primaryColor }}
                placeholder="Type to search or create role…"
              />
              {showRoleMenu && !autoFilledFields.designation && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredRoles.map((role) => (
                    <button
                      type="button"
                      key={role.id || role.name}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          designation: role.name,
                        }));
                        setRoleQuery(role.name);
                        setShowRoleMenu(false);
                      }}
                    >
                      {role.name}
                    </button>
                  ))}
                  {roleQuery.trim() && !exactRoleMatch && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm font-medium border-t border-gray-100 flex items-center gap-2"
                      style={{ color: primaryColor }}
                      disabled={creatingRole}
                      onClick={async () => {
                        try {
                          await ensureRole();
                          setShowRoleMenu(false);
                        } catch {
                          /* toast already shown */
                        }
                      }}
                    >
                      <Plus size={14} />
                      {creatingRole
                        ? "Creating…"
                        : `Create role “${roleQuery.trim()}”`}
                    </button>
                  )}
                  {!filteredRoles.length && !roleQuery.trim() && (
                    <div className="px-3 py-2 text-xs text-gray-500">
                      No roles yet — type a name to create one
                    </div>
                  )}
                </div>
              )}
              {errors.designation && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.designation}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hire Date *
              </label>
              <input
                type="date"
                name="hireDate"
                value={formData.hireDate}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.hireDate ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.hireDate && (
                <p className="text-red-500 text-sm mt-1">{errors.hireDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contract Type
              </label>
              <select
                name="contractType"
                value={formData.contractType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] bg-white"
              >
                <option value="Permanent">Permanent</option>
                <option value="Full-time">Full-time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
                <option value="Part-time">Part-time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Basic Salary *
              </label>
              <input
                type="text"
                inputMode="decimal"
                name="basicSalary"
                value={
                  formData.basicSalary === ""
                    ? ""
                    : formatNumberWithCommas(formData.basicSalary)
                }
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                    setFormData((prev) => ({ ...prev, basicSalary: raw }));
                    if (errors.basicSalary) {
                      setErrors((prev) => ({ ...prev, basicSalary: undefined }));
                    }
                  }
                }}
                placeholder="0.00"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] ${
                  errors.basicSalary ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.basicSalary && (
                <p className="text-red-500 text-sm mt-1">{errors.basicSalary}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Allowances
                </label>
                <button
                  type="button"
                  onClick={() => addComponentRow("allowances")}
                  className="text-xs font-medium hover:opacity-80"
                  style={{ color: primaryColor }}
                >
                  + Add allowance
                </button>
              </div>
              {(formData.allowances || []).map((row, index) => (
                <div key={`allow-${index}`} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name (e.g. Housing)"
                    value={row.name}
                    onChange={(e) =>
                      updateComponentRow("allowances", index, "name", e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount"
                    value={
                      row.amount === ""
                        ? ""
                        : formatNumberWithCommas(row.amount)
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                        updateComponentRow("allowances", index, "amount", raw);
                      }
                    }}
                    className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeComponentRow("allowances", index)}
                    className="px-2 text-gray-400 hover:text-red-500"
                    aria-label="Remove allowance"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Deductions
                </label>
                <button
                  type="button"
                  onClick={() => addComponentRow("deductions")}
                  className="text-xs font-medium hover:opacity-80"
                  style={{ color: primaryColor }}
                >
                  + Add deduction
                </button>
              </div>
              {(formData.deductions || []).map((row, index) => (
                <div key={`deduct-${index}`} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name (e.g. Cooperative)"
                    value={row.name}
                    onChange={(e) =>
                      updateComponentRow("deductions", index, "name", e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount"
                    value={
                      row.amount === ""
                        ? ""
                        : formatNumberWithCommas(row.amount)
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
                        updateComponentRow("deductions", index, "amount", raw);
                      }
                    }}
                    className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeComponentRow("deductions", index)}
                    className="px-2 text-gray-400 hover:text-red-500"
                    aria-label="Remove deduction"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PAYE deductions &amp; relief
              </label>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: "appliesRent", label: "Rent relief" },
                  { key: "appliesNHF", label: "NHF" },
                  { key: "appliesNHIS", label: "NHIS" },
                  { key: "appliesPension", label: "Pension" },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData[key] !== false}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Controls which statutory deductions and rent relief apply for this
                employee&apos;s PAYE calculation.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Terminated">Terminated</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Emergency Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Contact Name
              </label>
              <input
                type="text"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)]"
                placeholder="Enter emergency contact name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Emergency Contact Phone
              </label>
              <input
                type="text"
                name="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)]"
                placeholder="Enter emergency contact phone"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next of Kin
              </label>
              <input
                type="text"
                name="nextOfKin"
                value={formData.nextOfKin}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)]"
                placeholder="Enter next of kin"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Next of Kin Phone
              </label>
              <input
                type="text"
                name="nextOfKinPhone"
                value={formData.nextOfKinPhone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)]"
                placeholder="Enter next of kin phone"
              />
            </div>
          </div>
        </div>

        {/* Bank Information */}
        <div className="pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Bank Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-2">
                Select Bank *
              </h3>
              <BankTypeahead
                id="employee-bank-typeahead"
                bankList={bankList}
                selectedBankCode={formData.bankCode}
                facilityId={activeBusiness?.id}
                onLoaded={getBankList}
                error={errors.bank}
                onChange={(bankInfo) => {
                  setFormData((prev) => ({
                    ...prev,
                    bankCode: bankInfo.bank_code,
                    bankName: bankInfo.bank_name,
                  }));
                  if (errors.bank) {
                    setErrors((prev) => ({ ...prev, bank: "" }));
                  }
                }}
              />
              {errors.bank && (
                <p className="text-sm text-red-500 mt-1">{errors.bank}</p>
              )}
            </div>

            {/* Account Number */}
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-2">
                Account Number *
                {/* <span className="text-red-500">*</span> */}
              </h3>
              <Input
                id="account_number"
                name="bankAccount"
                type="text"
                placeholder="0000000000"
                value={formData.bankAccount}
                onChange={handleChange}
                className={errors.bankAccount ? "border-red-500" : ""}
              />
              {errors.bankAccount && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.bankAccount}
                </p>
              )}
            </div>

            {/* Account Name */}
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-2">
                Account Name *
                {/* <span className="text-red-500">*</span> */}
              </h3>
              <Input
                id="account_name"
                name="accountName"
                type="text"
                placeholder="Account holder name"
                value={formData.accountName}
                onChange={handleChange}
                className={errors.accountName ? "border-red-500" : ""}
              />
              {errors.accountName && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.accountName}
                </p>
              )}
            </div>

            {/* Account Type */}
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-2">
                Account Type
              </h3>
              <Select
                value={formData.accountType}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    accountType: value,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

          </div>

          {/* Footer Actions */}
          <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <CustomButton
              loading={loading}
              size="2"
              type="submit"
              className="px-4 py-2 text-white"
              style={{
                backgroundColor: primaryColor,
                borderColor: primaryColor,
              }}
            >
              {employee ? "Update" : "Submit"}
            </CustomButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;
