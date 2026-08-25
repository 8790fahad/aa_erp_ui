import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Eye,
  X,
  EyeOff,
  Power,
  PowerOff,
  MoreVerticalIcon,
  Loader,
  AlertCircle,
  Shield,
  Building2,
  Upload,
} from "lucide-react";
import BulkUploadModal from "@/components/pages/hr/BulkUploadModal";
import {
  resizeSignature,
  validateImageFile,
  getImageDimensions,
  validateImageDimensions,
} from "@/utils/imageUtils";
import { getSidebarByAppType } from "./sidebars/sidebarModules";
import { mergeReportPermissionsIntoSidebar } from "@/components/pages/report/utils/reportPermissions";
import { useSelector, useDispatch } from "react-redux";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Input } from "reactstrap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { FcInvite } from "react-icons/fc";
import { Label } from "reactstrap/lib";
import { Input as ShadcnInput } from "./ui/input";
import { Label as ShadcnLabel } from "./ui/label";
import { Loader2, ChevronDown, Check, Save } from "lucide-react";
import { UPDATE_USER } from "@/redux/actions/actionTypes";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const StaffManagementDashboard = () => {
  const [availableRoles, setAvailableRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleInputValue, setRoleInputValue] = useState("");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [filteredRoles, setFilteredRoles] = useState([]);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleAccess, setShowRoleAccess] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signature, setSignature] = useState("");
  const [processingSignature, setProcessingSignature] = useState(false);
  const [signatureInfo, setSignatureInfo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    businessType: "services",
    role: "admin",
    status: "verified",
    branchIds: [],
  });


  // Fetch roles from API
  const fetchRoles = useCallback(() => {
    if (!activeBusiness?.id) return;

    setRolesLoading(true);
    _fetchApi(
      `/users/roles-for-select?facilityId=${activeBusiness.id}`,
      (response) => {
        setRolesLoading(false);
        if (response.success) {
          setAvailableRoles(response.results || []);
        } else {
          console.error("Failed to fetch roles:", response.message);
          toast.error("Failed to load roles. Using default roles.");
          // Fallback to default roles if API fails
          setAvailableRoles([]);
        }
      },
      (error) => {
        setRolesLoading(false);
        console.error("Error fetching roles:", error);
        toast.error("Error loading roles. Using default roles.");
        // Fallback to default roles on error
        setAvailableRoles([]);
      }
    );
  }, [activeBusiness?.id]);

  const fetchBranches = useCallback(() => {
    if (!activeBusiness?.id) return;
    setBranchesLoading(true);
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        setBranchesLoading(false);
        if (res.success) {
          setBranches(res.results || []);
        }
      },
      (err) => {
        setBranchesLoading(false);
        console.error("Error fetching warehouses:", err);
      }
    );
  }, [activeBusiness?.id]);

  const toggleBranchId = (branchId) => {
    const id = Number(branchId);
    setFormData((prev) => {
      const current = (prev.branchIds || []).map(Number);
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...prev, branchIds: next };
    });
  };

  /** Make a clicked branch the primary (first item) without losing the others. */
  const promoteBranchToPrimary = (branchId) => {
    const id = Number(branchId);
    setFormData((prev) => {
      const current = (prev.branchIds || []).map(Number);
      if (!current.includes(id)) return prev;
      return {
        ...prev,
        branchIds: [id, ...current.filter((x) => x !== id)],
      };
    });
  };

  // Load roles when component mounts or business changes
  useEffect(() => {
    fetchRoles();
    fetchBranches();
  }, [fetchRoles, fetchBranches]);

  // Filter roles based on input
  useEffect(() => {
    const roleSearchText = String(roleInputValue || "");

    if (roleSearchText.trim() === "") {
      setFilteredRoles(availableRoles);
    } else {
      const filtered = availableRoles.filter((role) =>
        String(role.label || "")
          .toLowerCase()
          .includes(roleSearchText.toLowerCase())
      );
      setFilteredRoles(filtered);
    }
  }, [roleInputValue, availableRoles]);

  // Create role if it doesn't exist
  const createRoleIfNeeded = useCallback(
    (roleName) => {
      return new Promise((resolve) => {
        if (!roleName || !roleName.trim()) {
          resolve(roleName);
          return;
        }

        // Check if role already exists
        const existingRole = availableRoles.find(
          (r) => r.label.toLowerCase() === roleName.toLowerCase()
        );

        if (existingRole) {
          resolve(existingRole.value);
          return;
        }

        // Create new role
        setRolesLoading(true);
        _postApi(
          "/users/roles",
          {
            name: roleName.trim(),
            facilityId: activeBusiness.id,
            description: `Role created automatically for ${roleName}`,
            status: "active",
          },
          (data) => {
            setRolesLoading(false);
            if (data.success) {
              // Refresh roles list
              fetchRoles();
              toast.success(`Role "${roleName}" created successfully`);
              // Return the role name - it will be used as the role value
              resolve(roleName.trim());
            } else {
              toast.error(data.message || "Failed to create role");
              resolve(roleName);
            }
          },
          (error) => {
            setRolesLoading(false);
            console.error("Error creating role:", error);
            toast.error("Error creating role. Please try again.");
            resolve(roleName);
          }
        );
      });
    },
    [availableRoles, activeBusiness.id, fetchRoles]
  );

  const getRoleLabel = (roleValue) => {
    const role = availableRoles.find((r) => r.value === roleValue);
    return role ? role.label : roleValue || "";
  };

  const columns = [
    {
      value: "user_id",
      title: "User ID",
      custom: true,
      component: (item) => (
        <div className="text-xs font-mono text-gray-500">{item.id || item.user_id || "-"}</div>
      ),
    },
    {
      value: "fullname",
      title: "Name",
      custom: true,
      className: "text-",
      component: (item) => (
        <div className="text">{item.firstname + " " + item.lastname}</div>
      ),
    },
    {
      value: "email",
      title: "Email",
      custom: true,
      className: "text-",
      component: (item) => <div className="text-">{item.email}</div>,
    },
    {
      value: "phone",
      title: "Phone",
      custom: true,
      className: "text-",
      component: (item) => <div className="text-">{item.phone}</div>,
    },
    {
      value: "branches",
      title: "Warehouses",
      custom: true,
      component: (item) => {
        const branchList = Array.isArray(item.branches) ? item.branches : [];
        const primary =
          branchList.find((b) => b.is_primary) || branchList[0] || null;
        const others = branchList.filter((b) => b.id !== primary?.id);
        const tooltip =
          (item.branch_names && String(item.branch_names)) ||
          branchList.map((b) => b.branch_name).filter(Boolean).join(", ") ||
          item.branch_name ||
          "—";

        if (branchList.length === 0) {
          return (
            <div className="text-center">
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {item.branch_name || "N/A"}
              </span>
            </div>
          );
        }

        return (
          <div
            className="flex flex-wrap gap-1 justify-center max-w-[260px] mx-auto"
            title={tooltip}
          >
            {primary && (
              <span className="px-2 py-0.5 bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)] rounded text-xs font-medium inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {primary.branch_name}
                <span className="text-[10px] opacity-70">· primary</span>
              </span>
            )}
            {others.slice(0, 2).map((b) => (
              <span
                key={b.id}
                className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
              >
                {b.branch_name}
              </span>
            ))}
            {others.length > 2 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                +{others.length - 2}
              </span>
            )}
          </div>
        );
      },
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          <span className={`${getStatusBadge(item.status)}`}>
            {item.status}
          </span>
        </div>
      ),
    },
    {
      value: "role",
      title: "Role",
      custom: true,
      component: (item) => {
        const roleLabel = getRoleLabel(item.role);
        const isAdmin =
          roleLabel?.toLowerCase() === "admin" ||
          item.role?.toLowerCase() === "admin";
        return (
          <div className="text-center">
            <span className="px-2 py-1 bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)] rounded-md text-sm font-medium inline-flex items-center gap-1">
              {roleLabel}
              {isAdmin && <Shield className="w-4 h-4 text-[var(--aa-accent)]" />}
            </span>
          </div>
        );
      },
    },

    {
      value: "action",
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="flex items-center justify-center">
          {/* <div className="text-center">
            <button
              onClick={() => {
                setForm({
                  roles: item.accessTo.split(",") || [],
                  functionalities: item?.functionalities?.split(",") || [],
                });
                handleEditUser(item);
              }}
              className="p-2 text-[var(--aa-accent)] hover:bg-[var(--aa-sidebar-active)] rounded-lg transition-colors"
              title="Edit User"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleToggleUserStatus(item.id)}
              className={`p-2 rounded-lg transition-colors ${
                item.status === "verified"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-green-600 hover:bg-green-50"
              }`}
              title={
                item.status === "verified" ? "Deactivate User" : "Activate User"
              }
            >
              {item.status === "verified" ? (
                <PowerOff className="w-4 h-4" />
              ) : (
                <Power className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => handleViewUserAccess(item)}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              title="View Permissions"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div> */}

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
              <DropdownMenuItem
                onClick={() => {
                  setForm({
                    accessTo: item.accessTo ? item.accessTo.split(",") : [],
                    functionalities: item?.functionalities
                      ? item.functionalities.split(",")
                      : [],
                  });
                  handleEditUser(item);
                }}
              >
                Edit Staff
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleUserStatus(item)}>
                Staff Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleUserPassword(item)}>
                Password Mgm
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleToggleUserSignature(item)}>
                Signature
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewUserAccess(item)}>
                Permissions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return usersList;
    const term = searchTerm.toLowerCase();
    return usersList.filter((u) => {
      const fullname = `${u.firstname || ""} ${u.lastname || ""}`.toLowerCase();
      return (
        fullname.includes(term) ||
        (u.email || "").toLowerCase().includes(term) ||
        (u.phone || "").toLowerCase().includes(term) ||
        (u.role || "").toLowerCase().includes(term) ||
        String(u.id || u.user_id || "").toLowerCase().includes(term)
      );
    });
  }, [searchTerm, usersList]);

  //for getting users by id
  const getUsers = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/v1/get-users-by-facility/${activeBusiness.id}`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setUsersList(data.results);
          // alert(JSON.stringify(data.results));
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
      }
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const getStatusBadge = (status) => {
    const colors = {
      verified: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      suspended: "bg-red-100 text-red-800",
    };
    return `px-3 py-1 rounded-full text-xs font-medium ${colors[status]}`;
  };

  //for adding users
  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      firstname: "",
      lastname: "",
      email: "",
      phone: "",
      businessType: "services",
      role: "",
      status: "verified",
      branchIds: [],
    });
    setRoleInputValue("");
    setShowRoleDropdown(false);
    setIsModalOpen(true);
  };
  //for inviting users
  // const handleInvite = () =>{
  //   setShowInviteModal(true);
  // }
  const handleEditUser = (user) => {
    setEditingUser(user);
    const roleLabel = getRoleLabel(user.role);
    setFormData({
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phone: user.phone,
      businessType: user.businessType,
      role: user.role,
      status: user.status,
      branchIds: (() => {
        if (Array.isArray(user.branchIds) && user.branchIds.length > 0) {
          return user.branchIds.map(Number).filter(Boolean);
        }
        if (Array.isArray(user.branches) && user.branches.length > 0) {
          // Put the primary branch first so it stays primary on save.
          const sorted = [...user.branches].sort(
            (a, b) =>
              Number(b.is_primary || 0) - Number(a.is_primary || 0)
          );
          return sorted
            .map((b) => Number(b.id || b.branch_id))
            .filter(Boolean);
        }
        if (user.branchId) return [Number(user.branchId)];
        return [];
      })(),
    });
    setRoleInputValue(roleLabel);
    setShowRoleDropdown(false);
    setIsModalOpen(true);
  };

  const handleViewUserAccess = (user) => {
    setSelectedUser(user);
    setForm({
      ...user,
      checked: (user.accessTo || "").split(",").filter(Boolean),
      functionalities: (user.functionalities || "").split(",").filter(Boolean),
    });
    setShowRoleAccess(true);
  };

  const handleStatusUpdate = (user, status) => {
    const updatedForm = {
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phone: user.phone,
      businessType: user.businessType,
      status,
      // facilityId: activeBusiness.id,
      query_type: "update",
    };

    console.log(updatedForm);

    _postApi(
      "/api/auth/update-status",
      updatedForm,
      (resp) => {
        if (resp.success) {
          toast.success("Staff status updated");
          setShowStatusModal(false);
          setSelectedUser(null);
          getUsers();
        } else {
          toast.error(resp.msg || "Error updating user");
        }
      },
      (err) => {
        console.error(err);
        toast.error("Server error occurred.");
      }
    );
  };

  const handleToggleUserStatus = (user) => {
    setSelectedUser(user);
    setShowStatusModal(true);
  };

  const handleToggleUserSignature = (user) => {
    setSelectedUser(user);
    setSignature("");
    setSignatureInfo(null);
    setShowSignatureModal(true);
  };

  const handleSignatureFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const fileValidation = validateImageFile(file, {
      maxSizeInMB: 2,
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    });

    if (!fileValidation.isValid) {
      toast.error(fileValidation.errors[0]);
      return;
    }

    setProcessingSignature(true);

    try {
      // Get original dimensions
      const dimensions = await getImageDimensions(file);

      // Validate image dimensions
      const dimensionValidation = validateImageDimensions(dimensions, {
        maxWidth: 300,
        maxHeight: 150,
        minWidth: 10,
        minHeight: 10,
      });

      if (!dimensionValidation.isValid) {
        toast.error(dimensionValidation.errors[0]);
        return;
      }

      // Resize the signature
      const resizedSignature = await resizeSignature(file);

      setSignature(resizedSignature);
      setSignatureInfo({
        originalSize: (file.size / 1024).toFixed(1) + " KB",
        originalDimensions: `${dimensions.width}x${dimensions.height}`,
        fileName: file.name,
      });

      toast.success("Signature processed successfully!");
    } catch (error) {
      console.error("Error processing signature:", error);
      toast.error("Failed to process signature. Please try again.");
    } finally {
      setProcessingSignature(false);
    }
  };

  const handleToggleUserPassword = (user) => {
    setSelectedUser(user);
    setFormData({
      id: user.id,
      email: user.email,
    });
    setShowPasswordModal(true);
  };

  //adding new user
  const handleSubmit = async () => {
    //validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const roleText = String(roleInputValue || "").trim();

    if (
      !formData.firstname ||
      !formData.lastname ||
      !formData.email ||
      !formData.phone ||
      !roleText
    ) {
      toast.error("Please fill all required fields.");
      return;
    }

    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading2(true);

    const roleValue = await createRoleIfNeeded(roleText);

    const branchIdsToUse = (formData.branchIds || []).map(Number).filter(Boolean);

    if (branchIdsToUse.length === 0) {
      toast.error("Please assign the staff to at least one branch.");
      setLoading2(false);
      return;
    }


    const newUser = {
      firstname: formData.firstname,
      lastname: formData.lastname,
      email: formData.email,
      phone: formData.phone,
      businessType: formData.businessType,
      role: roleValue || roleText,
      status: formData.status,
      facilityId: activeBusiness.id,
      branchIds: branchIdsToUse,
      branchId: branchIdsToUse[0],
    };

    console.log("Submitting user:", newUser);

    _postApi(
      "/api/auth/add-new-staff",
      newUser,
      (resp) => {
        if (resp.success) {
          setIsModalOpen(false);
          toast.success(resp.msg || "User added successfully");
          getUsers();
          setFormData({
            firstname: "",
            lastname: "",
            email: "",
            phone: "",
            businessType: "services",
            role: "",
            status: "verified",
            branchIds: [],
          });
          setRoleInputValue("");
          setShowRoleDropdown(false);
          setLoading2(false);
        } else {
          toast.error(resp.message || "An error occured");
          setLoading2(false);
        }
      },
      (err) => {
        setLoading2(false);
        console.error("Error submitting form:", err);
      }
    );
  };

  const handleUpdate = async () => {
    if (!editingUser) return;
    const roleText = String(roleInputValue || "").trim();

    if (!roleText) {
      toast.error("Please enter a role.");
      return;
    }

    setLoading2(true);

    const roleValue = await createRoleIfNeeded(roleText);

    const branchIdsToUse = (formData.branchIds || []).map(Number).filter(Boolean);

    if (branchIdsToUse.length === 0) {
      toast.error("Please assign the staff to at least one branch.");
      setLoading2(false);
      return;
    }


    const updateUser = {
      id: formData.id,
      query_type: "update",
      firstname: formData.firstname,
      lastname: formData.lastname,
      email: formData.email,
      phone: formData.phone,
      businessType: formData.businessType,
      role: roleValue || roleText,
      status: formData.status,
      facilityId: activeBusiness.id,
      branchIds: branchIdsToUse,
      branchId: branchIdsToUse[0],
    };

    console.log("Submitting user:", updateUser);

    _postApi(
      "/api/auth/add-new-staff",
      updateUser,
      (res) => {
        if (res.success) {
          setIsModalOpen(false);
          //clear the form
          setFormData({
            id: "",
            query_type: "",
            firstname: "",
            lastname: "",
            email: "",
            phone: "",
            businessType: "services",
            role: "",
            status: "verified",
            branchIds: [],
          });
          setRoleInputValue("");
          setShowRoleDropdown(false);
          setLoading2(false);
          getUsers();
        } else {
          setLoading2(false);
          toast.error(res.message || "Failed to update user");
        }
      },
      (err) => {
        setLoading2(false);
        console.error("Error submitting form:", err);
        toast.error("Server error while submitting form");
      }
    );
  };

  const handleInvite = (e) => {
    e.preventDefault();
    setLoading2(true);
    if (!formData.email) {
      setErrors({ email: "Email is required" });
      setLoading2(false);
      return;
    }

    const payload = {
      email: formData.email,
      businessId: activeBusiness.id,
    };

    console.log("Inviting staff:", payload);

    _postApi(
      "/users/invite-staff", // <- match the backend route
      payload,
      (res) => {
        if (res.success) {
          toast.success(res.message);
          setShowInviteModal(false);
          setFormData({ email: "" });
          setErrors({});
        } else {
          toast.error(res.message || "Invite failed");
        }
        setLoading2(false);
      },
      (err) => {
        console.error("Invite error:", err);
        setErrors({ email: "Something went wrong. Try again later." });
        setLoading2(false);
      }
    );
  };

  const handlePermissions = () => {
    if (!selectedUser?.id) return;

    setLoading2(true);
    const payload = {
      id: selectedUser.id,
      email: selectedUser.email,
      query_type: "permission",
      accessTo: form.checked,
      functionalities: form.functionalities,
      businessId: activeBusiness.id,
    };

    // console.log(payload)

    _postApi(
      "/api/auth/add-new-staff",
      payload,
      (res) => {
        if (res.success) {
          toast.success("Permissions updated successfully!");
          const isCurrentUser =
            selectedUser.id === user?.id ||
            selectedUser.email === user?.email;
          if (isCurrentUser) {
            dispatch({
              type: UPDATE_USER,
              payload: {
                ...activeBusiness,
                access_to: (form.checked || []).join(","),
                functionalities: (form.functionalities || []).join(","),
              },
            });
          }
          setShowRoleAccess(false);
          setLoading2(false);
          getUsers();
        } else {
          setLoading2(false);
          toast.error(res.message || "Failed to update permissions");
        }
      },
      (err) => {
        console.error(err);
        setLoading2(false);
        toast.error("Server error while updating permissions");
      }
    );
  };

  const handleSignature = () => {
    if (!selectedUser?.email) return;

    setLoading2(true);

    const payload = {
      email: selectedUser.email,
      signature: signature,
      query_type: "signature",
    };

    _postApi(
      "/users/update-signature",
      payload,
      (res) => {
        if (res.success) {
          setSelectedUser({
            ...selectedUser,
            signature: signature,
          });
          toast.success("Signature saved successfully!");
          setShowSignatureModal(false);
          getUsers();
        } else {
          toast.error(res.message || "Failed to save signature");
        }
        setLoading2(false);
      },
      (err) => {
        console.error(err);
        toast.error("Server error while saving signature");
        setLoading2(false);
      }
    );
  };

  const handleRemoveSignature = () => {
    if (!selectedUser?.email) return;

    setLoading2(true);

    const payload = {
      email: selectedUser.email,
      signature: null, // Set signature to null to remove it
      query_type: "signature",
    };

    _postApi(
      "/users/update-signature",
      payload,
      (res) => {
        if (res.success) {
          setSelectedUser({
            ...selectedUser,
            signature: null,
          });
          setSignature(null);
          setSignatureInfo(null);
          toast.success("Signature removed successfully!");
          getUsers();
        } else {
          toast.error(res.message || "Failed to remove signature");
        }
        setLoading2(false);
      },
      (err) => {
        console.error(err);
        toast.error("Server error while removing signature");
        setLoading2(false);
      }
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setLoading2(false);
    setShowInviteModal(false);
    setRoleInputValue("");
    setShowRoleDropdown(false);
  };

  const handlePasswordChange = () => {
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error("Passwords does not match");
      return;
    }

    if (!selectedUser?.id) {
      toast.error("No user selected");
      return;
    }

    if (!formData.password) {
      toast.error("Enter a new password or cancel");
      return;
    }

    setLoading2(true);
    _postApi(
      `/admin/reset-user-pass`,
      { userId: selectedUser.id, newPassword: formData.password },
      (resp) => {
        if (resp.success) {
          toast.success(
            `${selectedUser.email}'s password has been changed successfully.`,
          );
          setLoading2(false);
          setShowPasswordModal(false);
          setShowPassword(false);
          setShowConfirmPassword(false);
        } else {
          toast.error(resp.message || "Something went wrong.");
          setLoading2(false);
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while updating the password.");
        setLoading2(false);
      }
    );
  };

  // Parse business_type and merge sidebar items from all business types
  const sidebarItems = useMemo(() => {
    const businessType = activeBusiness?.business_type || "";

    if (!businessType) {
      console.warn("⚠️ No business_type found in activeBusiness");
      return getSidebarByAppType("services"); // Default fallback
    }

    // Parse business_type - can be comma-separated string like "Retailers, Services"
    const businessTypes = (() => {
      // Handle if it's already an array
      if (Array.isArray(businessType)) {
        return businessType
          .map((type) => {
            const lower = String(type).trim().toLowerCase();
            const typeMap = {
              retailer: "retailers",
              retailers: "retailers",
              retail: "retailers",
              service: "services",
              services: "services",
              recycling: "recycling",
              manufacturing: "manufacturing",
              manufacturer: "manufacturing",
              manufacturers: "manufacturing",
              contractor: "contractors",
              contractors: "contractors",
            };
            return (
              typeMap[lower] ||
              (["retailers", "services", "recycling", "manufacturing", "contractors"].includes(
                lower
              )
                ? lower
                : null)
            );
          })
          .filter((type) => type !== null && type !== "");
      }

      // Handle string (comma-separated)
      if (typeof businessType !== "string") {
        return [];
      }

      return businessType
        .split(",")
        .map((type) => {
          const trimmed = type.trim();
          if (!trimmed) return null;

          const lower = trimmed.toLowerCase();
          const typeMap = {
            retailer: "retailers",
            retailers: "retailers",
            retail: "retailers",
            service: "services",
            services: "services",
            recycling: "recycling",
            manufacturing: "manufacturing",
            manufacturer: "manufacturing",
            manufacturers: "manufacturing",
            contractor: "contractors",
            contractors: "contractors",
          };

          const mapped = typeMap[lower];
          if (mapped) return mapped;

          if (
            ["retailers", "services", "recycling", "manufacturing", "contractors"].includes(
              lower
            )
          ) {
            return lower;
          }

          return null;
        })
        .filter((type) => type !== null && type !== "");
    })();

    // Filter to only valid business types
    const validBusinessTypes = businessTypes.filter((type) =>
      ["retailers", "services", "recycling", "manufacturing", "contractors"].includes(type)
    );

    if (validBusinessTypes.length === 0) {
      console.warn(
        "⚠️ No valid business types found, using default 'services'"
      );
      return getSidebarByAppType("services"); // Default fallback
    }

    // Get all unique module titles from all business types
    const allModulesMap = new Map();

    validBusinessTypes.forEach((type) => {
      const items = getSidebarByAppType(type);

      items.forEach((module) => {
        const existingModule = allModulesMap.get(module.title);

        if (!existingModule) {
          // First time seeing this module, add it with a deep copy
          const moduleCopy = {
            ...module,
            items: module.items ? [...module.items] : undefined,
          };
          allModulesMap.set(module.title, moduleCopy);
        } else {
          // Module already exists, merge items
          if (module.items && module.items.length > 0) {
            const existingItems = existingModule.items || [];
            const newItems = module.items || [];

            // Merge items, avoiding duplicates by URL
            const mergedItems = [...existingItems];
            newItems.forEach((newItem) => {
              const exists = existingItems.some(
                (item) => item.url === newItem.url
              );
              if (!exists) {
                mergedItems.push(newItem);
              }
            });

            existingModule.items = mergedItems;
          }
        }
      });
    });

    return mergeReportPermissionsIntoSidebar(Array.from(allModulesMap.values()));
  }, [activeBusiness?.business_type]);

  const [form, setForm] = useState({
    accessTo: selectedUser?.accessTo || [],
    functionalities: selectedUser?.functionalities || [],
  });
  const handleChildChechBoxChange = (subItem) => {
    setForm((prevForm) => {
      const isChecked = prevForm.functionalities.includes(subItem.title);
      const allSubTitles =
        subItem.subFunctionalities?.map((s) => s.title).filter(Boolean) || [];
      // Privileges that must be granted explicitly — not auto-enabled
      // when the parent module switch is turned on.
      const EXPLICIT_ONLY = new Set([
        "Switch Payment Mode",
        "Approve Payment Mode Switch",
        "Write-off (Scrap/Loss)",
      ]);
      const autoSubTitles = allSubTitles.filter((t) => !EXPLICIT_ONLY.has(t));

      let updatedFunctionalities = isChecked
        ? prevForm.functionalities.filter(
            (func) =>
              func !== subItem.title && !allSubTitles.includes(func),
          )
        : [
            ...prevForm.functionalities,
            subItem.title,
            ...autoSubTitles.filter(
              (t) => !prevForm.functionalities.includes(t),
            ),
          ];

      updatedFunctionalities = [...new Set(updatedFunctionalities)];

      return {
        ...prevForm,
        functionalities: updatedFunctionalities,
      };
    });
  };
  return (
    <div className="min-h-screen ">
      <div className="max-w-7xl mx-auto">
        <div className=" ">
          <div className="p-">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Manage Users
              </h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  Total :{" "}
                  <span className="font-semibold text-gray-900">
                    {usersList.length}
                  </span>
                </span>
                <span className="text-sm text-gray-600">
                  verified:{" "}
                  <span className="font-semibold text-green-600">
                    {usersList.filter((u) => u.status === "verified").length}
                  </span>
                </span>
                <span className="text-sm text-gray-600">
                  pending:{" "}
                  <span className="font-semibold text-yellow-800">
                    {usersList.filter((u) => u.status === "pending").length}
                  </span>
                </span>
                <span className="text-sm text-gray-600">
                  suspended:{" "}
                  <span className="font-semibold text-red-600">
                    {usersList.filter((u) => u.status === "suspended").length}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search users by name, email, phone, or role..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                type="button"
                className="aa-btn-primary h-10 px-5 text-white"
                onClick={handleAddUser}
              >
                <Plus className="w-5 h-5" />
                Add New Staff
              </Button>
              <Button
                type="button"
                className="aa-btn-primary h-10 px-5 text-white"
                onClick={() => setBulkUploadOpen(true)}
              >
                <Upload className="w-5 h-5" />
                Upload
              </Button>
              <Button
                type="button"
                className="aa-btn-primary h-10 px-5 text-white"
                onClick={() => setShowInviteModal(true)}
              >
                <FcInvite className="w-5 h-5" />
                Invite
              </Button>
            </div>
            {/* {JSON.stringify(usersList)} */}
            <div className="overflow-x-auto">
              <CustomTable1
                data={filteredUsers}
                fields={columns}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>
      <Sheet
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <SheetContent
          side="right"
          className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:bg-white/15 [&>button]:hover:opacity-100 [&>button]:ring-offset-[var(--aa-navy)] [&>button]:focus:ring-white/40"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-white/10 bg-[var(--aa-navy)] px-5 py-4 text-left">
            <SheetTitle className="pr-8 text-lg font-semibold text-white">
              {editingUser ? "Edit Staff" : "Add New Staff"}
            </SheetTitle>
            <SheetDescription className="text-sm text-white/70">
              {editingUser
                ? "Update staff member information"
                : "Fill in the details to add a new staff member"}
            </SheetDescription>
          </SheetHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingUser) {
                  handleUpdate();
                } else {
                  handleSubmit();
                }
              }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <ShadcnLabel
                      htmlFor="firstname"
                      className="text-sm font-semibold text-gray-700 mb-1 block"
                    >
                      First Name <span className="text-red-500">*</span>
                    </ShadcnLabel>
                    <ShadcnInput
                      id="firstname"
                      type="text"
                      required
                      value={formData.firstname}
                      onChange={(e) =>
                        setFormData({ ...formData, firstname: e.target.value })
                      }
                      placeholder="Enter first name"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <ShadcnLabel
                      htmlFor="lastname"
                      className="text-sm font-semibold text-gray-700 mb-1 block"
                    >
                      Last Name <span className="text-red-500">*</span>
                    </ShadcnLabel>
                    <ShadcnInput
                      id="lastname"
                      type="text"
                      required
                      value={formData.lastname}
                      onChange={(e) =>
                        setFormData({ ...formData, lastname: e.target.value })
                      }
                      placeholder="Enter last name"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <ShadcnLabel
                    htmlFor="email"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <ShadcnInput
                    id="email"
                    type="email"
                    disabled={editingUser}
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Enter email address"
                    className="w-full"
                  />
                </div>

                <div className="mb-4">
                  <ShadcnLabel
                    htmlFor="phone"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <ShadcnInput
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="Enter phone number"
                    className="w-full"
                  />
                </div>

                <div className="mb-4">
                  <ShadcnLabel
                    htmlFor="role"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    Role <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <div className="relative">
                    <ShadcnInput
                      id="role"
                      type="text"
                      required
                      value={roleInputValue}
                      onChange={(e) => {
                        setRoleInputValue(e.target.value);
                        setShowRoleDropdown(true);
                      }}
                      onFocus={() => setShowRoleDropdown(true)}
                      onBlur={() => {
                        // Delay to allow click on dropdown item
                        setTimeout(() => setShowRoleDropdown(false), 200);
                      }}
                      placeholder="Type or select a role"
                      disabled={rolesLoading}
                    />
                    {rolesLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {!rolesLoading && (
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    )}

                    {showRoleDropdown && filteredRoles.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredRoles.map((role) => (
                          <div
                            key={role.value}
                            className="px-3 py-2 hover:bg-[var(--aa-sidebar-active)] cursor-pointer flex items-center justify-between"
                            onClick={() => {
                              setRoleInputValue(role.label);
                              setFormData({
                              ...formData,
                              role: role.value,
                            });
                              setShowRoleDropdown(false);
                            }}
                          >
                            <span>{role.label}</span>
                            {formData.role === role.value && (
                              <Check className="h-4 w-4 text-[var(--aa-accent)]" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {showRoleDropdown &&
                      String(roleInputValue || "").trim() &&
                      !filteredRoles.some(
                        (r) =>
                          String(r.label || "").toLowerCase() ===
                          String(roleInputValue || "").toLowerCase()
                      ) && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                          <div
                            className="px-3 py-2 hover:bg-[var(--aa-sidebar-active)] cursor-pointer border-t border-gray-200 bg-[var(--aa-sidebar-active)]"
                            onClick={() => {
                              setShowRoleDropdown(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Plus className="h-4 w-4 text-[var(--aa-accent)]" />
                              <span className="text-[var(--aa-accent)] font-medium">
                                Create &quot;{roleInputValue}&quot;
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              This role will be created automatically
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                  {rolesLoading && (
                    <p className="text-xs text-gray-500 mt-1">
                      Loading roles from database...
                    </p>
                  )}
                </div>


                <div className="mb-4">
                  <ShadcnLabel
                    htmlFor="status"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    Status <span className="text-red-500">*</span>
                  </ShadcnLabel>
                  <select
                    id="status"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                    value={formData.status}
                    disabled={editingUser}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="verified">verified</option>
                    <option value="pending">pending</option>
                    <option value="suspended">suspended</option>
                  </select>
                </div>

                <div className="mb-4">
                  <ShadcnLabel className="text-sm font-semibold text-gray-700 mb-1 block">
                    Branches <span className="text-red-500">*</span>
                    <span className="text-gray-500 font-normal ml-1">
                      (click a selected branch to make it primary)
                    </span>
                  </ShadcnLabel>
                  {branchesLoading ? (
                    <p className="text-xs text-gray-500">Loading branches...</p>
                  ) : branches.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No branches yet — create one below.
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 max-h-44 overflow-y-auto space-y-2">
                      {branches.map((branch) => {
                        const branchId = Number(branch.id);
                        const ids = (formData.branchIds || []).map(Number);
                        const checked = ids.includes(branchId);
                        const isPrimary = checked && ids[0] === branchId;
                        return (
                          <div
                            key={branch.id}
                            className="flex items-center gap-2 text-sm text-gray-800"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-[var(--aa-accent)] focus:ring-[var(--aa-accent)] cursor-pointer"
                              checked={checked}
                              onChange={() => toggleBranchId(branchId)}
                              id={`branch-${branchId}`}
                            />
                            <button
                              type="button"
                              className={`flex-1 text-left flex items-center justify-between gap-2 px-2 py-0.5 rounded ${
                                checked
                                  ? "hover:bg-[var(--aa-sidebar-active)]"
                                  : "cursor-default"
                              }`}
                              onClick={() => {
                                if (checked) {
                                  promoteBranchToPrimary(branchId);
                                } else {
                                  toggleBranchId(branchId);
                                }
                              }}
                            >
                              <span>{branch.branch_name}</span>
                              {isPrimary && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--aa-navy)] text-white rounded">
                                  Primary
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(formData.branchIds || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(formData.branchIds || []).map((id, idx) => {
                        const branch = branches.find(
                          (b) => Number(b.id) === Number(id)
                        );
                        return (
                          <span
                            key={id}
                            className="px-2 py-0.5 bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)] rounded text-xs"
                          >
                            {branch?.branch_name || `Warehouse #${id}`}
                            {idx === 0 ? " · primary" : ""}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-100 transition-colors font-medium"
                  disabled={loading2}
                >
                  <X className="w-4 h-4 inline mr-2" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading2}
                  className="aa-btn-primary px-4 py-2 text-sm text-white rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading2 ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingUser ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingUser ? "Update Staff" : "Create Staff"}
                    </>
                  )}
                </button>
              </div>
            </form>
        </SheetContent>
      </Sheet>
      {/* invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Invite User</h2>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Form starts here — outside the header */}
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="Email">Email Address *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    className="aa-btn-primary flex-1 text-white"
                    disabled={loading2}
                  >
                    {loading2 ? "Sending..." : "Invite Staff"}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCancel}
                    variant="secondary"
                    className="rounded-md font-medium"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Update Staff Status
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
                  <div className="w-12 h-12 bg-[var(--aa-sidebar-active)] rounded-full flex items-center justify-center">
                    <span className="text-[var(--aa-navy)] font-medium">
                      {selectedUser?.firstname?.charAt(0)}
                      {selectedUser?.lastname?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedUser?.firstname} {selectedUser?.lastname}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedUser?.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Current Status:{" "}
                      <span
                        className={`font-medium ${
                          selectedUser?.status === "verified"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedUser?.status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Select new status for this staff:
                  </p>

                  <button
                    onClick={() => handleStatusUpdate(selectedUser, "verified")}
                    className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                      selectedUser?.status === "verified"
                        ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                        : "border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 cursor-pointer"
                    }`}
                    disabled={selectedUser?.status === "verified"}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Power className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-green-700">
                          Activate staff
                        </div>
                        <div className="text-sm text-green-600">
                          User will have full access to their assigned role
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      handleStatusUpdate(selectedUser, "suspended")
                    }
                    className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                      selectedUser?.status === "suspended"
                        ? "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
                        : "border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 cursor-pointer"
                    }`}
                    disabled={selectedUser?.status === "suspended"}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <PowerOff className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium text-red-700">
                          Deactivate User
                        </div>
                        <div className="text-sm text-red-600">
                          User will be unable to login or access the system
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

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Manage Staff Password - {selectedUser?.firstname}{" "}
                  {selectedUser?.lastname}
                </h2>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4 p-4 bg-[var(--aa-sidebar-active)] rounded-lg">
                <p className="text-[var(--aa-navy)] text-sm">
                  <strong>Role:</strong> {getRoleLabel(selectedUser?.role)} |
                  <strong> Status:</strong> {selectedUser?.status} |
                  <strong> Phone Number:</strong> {selectedUser?.phone}
                </p>
              </div>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                        value={formData.password || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowPassword(!showPassword);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                        value={formData.confirmPassword || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmPassword: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter a new password and save to update this user&apos;s login.
                </p>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      email: selectedUser.email,
                    }));
                    handlePasswordChange(new Event("submit"));
                  }}
                  disabled={loading2}
                  className="aa-btn-primary px-6 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading2 ? (
                    <Loader className="animate-spin w-4 h-4 mx-auto" />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRoleAccess && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[var(--aa-navy)] text-white p-5 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      User Permissions - {selectedUser?.firstname}{" "}
                      {selectedUser?.lastname}
                    </h3>
                    <p className="text-sm text-white/80 mt-1">
                      Manage access and functionalities for this user
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRoleAccess(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* User Info Banner */}
            <div className="px-6 pt-4 pb-2">
              <div className="bg-[var(--aa-sidebar-active)] border border-[var(--aa-accent)]/30 rounded-lg p-3">
                <p className="text-[var(--aa-navy)] text-sm">
                  <strong>Role:</strong> {getRoleLabel(selectedUser?.role)} |
                  <strong> Status:</strong> {selectedUser?.status} |
                  <strong> Phone Number:</strong> {selectedUser?.phone}
                </p>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sidebarItems.map((module, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="font-semibold text-gray-900 text-sm">
                        {module.title}
                      </span>
                      <div className="form-check form-switch">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={(form.checked || []).includes(module.title)}
                          onChange={({ target: { checked } }) => {
                            setForm((prev) => {
                              const updatedChecked = checked
                                ? [...(prev.checked || []), module.title]
                                : (prev.checked || []).filter(
                                    (title) => title !== module.title
                                  );

                              let updatedFunctionalities =
                                prev.functionalities || [];

                              if (checked) {
                                const firstSub = module.items?.[0]?.title;
                                if (firstSub) {
                                  updatedFunctionalities = [
                                    ...new Set([
                                      ...updatedFunctionalities,
                                      firstSub,
                                    ]),
                                  ];
                                }
                              } else {
                                const moduleFuncTitles = (
                                  module.items?.flatMap((item) => [
                                    item.title,
                                    ...(item.subFunctionalities?.map((s) => s.title) ||
                                      []),
                                  ]) || []
                                ).filter(Boolean);
                                updatedFunctionalities =
                                  updatedFunctionalities.filter(
                                    (func) => !moduleFuncTitles.includes(func),
                                  );
                              }

                              return {
                                ...prev,
                                checked: updatedChecked,
                                functionalities: updatedFunctionalities,
                              };
                            });
                          }}
                        />
                      </div>
                    </div>

                    {module.items && module.items.length > 0 && (
                      <div className="space-y-1 pl-4">
                        {module.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="space-y-1">
                            <div className="flex items-center justify-between py-2">
                              <span className="text-sm text-gray-700">
                                {item.title}
                              </span>
                              <div className="form-check form-switch">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={form.functionalities?.includes(
                                    item.title
                                  )}
                                  onChange={() => handleChildChechBoxChange(item)}
                                  id={`subSwitch-${index}-${itemIndex}`}
                                />
                              </div>
                            </div>
                            {item.subFunctionalities?.length > 0 && (
                              <div className="space-y-1 pl-4 border-l border-gray-200 ml-2">
                                {item.subFunctionalities.map((sub, subIdx) => (
                                  <div
                                    key={`${itemIndex}-sub-${subIdx}`}
                                    className="flex items-center justify-between py-1.5"
                                  >
                                    <span className="text-xs text-gray-600">
                                      {sub.title}
                                    </span>
                                    <div className="form-check form-switch">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={form.functionalities?.includes(
                                          sub.title
                                        )}
                                        onChange={() =>
                                          handleChildChechBoxChange(sub)
                                        }
                                        id={`subSwitch-${index}-${itemIndex}-${subIdx}`}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl border-t border-gray-200">
              <button
                onClick={() => setShowRoleAccess(false)}
                className="px-5 py-2.5 text-sm bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 rounded-lg transition-all font-semibold shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handlePermissions();
                }}
                disabled={loading2}
                className="px-6 py-2.5 text-sm bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading2 ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedUser?.signature ? "Update" : "Add"} Staff Signature
                </h2>
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                {/* Staff Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[var(--aa-sidebar-active)] rounded-full flex items-center justify-center">
                    <span className="text-[var(--aa-navy)] font-medium">
                      {selectedUser?.firstname?.charAt(0)}
                      {selectedUser?.lastname?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedUser?.firstname} {selectedUser?.lastname}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedUser?.email}
                    </p>
                  </div>
                </div>

                {/* Signature Upload */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    {selectedUser?.signature
                      ? "Update Signature"
                      : "Upload Signature"}
                  </label>

                  {/* Upload Guidelines */}
                  <div className="bg-[var(--aa-sidebar-active)] border border-[var(--aa-accent)]/30 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[var(--aa-accent)] mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-[var(--aa-navy)]">
                        <p className="font-medium mb-1">
                          Signature Guidelines:
                        </p>
                        <ul className="space-y-1">
                          <li>• Recommended size: 300x150 pixels or smaller</li>
                          <li>• Supported formats: PNG, JPG, JPEG, WebP</li>
                          <li>• Maximum file size: 2MB</li>
                          <li>• PNG recommended for transparent backgrounds</li>
                          <li>• Use a clear, high-contrast signature</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleSignatureFileChange}
                    disabled={processingSignature}
                    className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-[var(--aa-sidebar-active)] file:text-[var(--aa-navy)]
                    hover:file:bg-[var(--aa-sidebar-active)]
                    disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  {/* Processing Indicator */}
                  {processingSignature && (
                    <div className="flex items-center gap-2 text-sm text-[var(--aa-accent)]">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--aa-accent)]"></div>
                      Processing signature...
                    </div>
                  )}

                  {/* Image Info */}
                  {signatureInfo && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-2">
                      <div className="text-xs text-green-800">
                        <p>
                          <strong>File:</strong> {signatureInfo.fileName}
                        </p>
                        <p>
                          <strong>Original:</strong>{" "}
                          {signatureInfo.originalDimensions} (
                          {signatureInfo.originalSize})
                        </p>
                        <p>
                          <strong>Optimized:</strong> Max 300x150px, PNG format
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Preview Existing or Uploaded Signature */}
                  {(signature || selectedUser?.signature) && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">
                        Signature Preview:
                      </p>
                      <div className="flex items-center gap-3">
                        <img
                          src={signature || selectedUser?.signature}
                          alt="Signature"
                          className="h-16 object-contain border border-gray-300 rounded-md bg-gray-50 px-3"
                        />
                        <div className="flex-1">
                          <p className="text-xs text-gray-600 mb-2">
                            This is how the signature will appear on documents
                          </p>
                          <button
                            type="button"
                            onClick={handleRemoveSignature}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Remove Signature
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSignatureModal(false);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSignature()}
                  className="flex-1 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white py-2 px-4 rounded-md transition-colors font-medium"
                >
                  {selectedUser?.signature ? "Update" : "Add"} Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={() => {
          getUsers();
          setBulkUploadOpen(false);
        }}
        title="Bulk Upload Users"
        apiEndpoint="/api/auth/bulk-staff"
        payloadKey="users"
        facilityId={activeBusiness?.id}
        createdBy={user?.id}
        primaryColor="#1a2d5e"
        templateCols={[
          { key: "firstname", label: "First Name", example: "Amina" },
          { key: "lastname", label: "Last Name", example: "Bello" },
          {
            key: "email",
            label: "Email",
            example: "amina.bello@example.com",
          },
          { key: "phone", label: "Phone", example: "08012345678" },
          { key: "role", label: "Role", example: "Accountant", hint: "If the role name is not found it will be created automatically; if found, that role is used." },
          {
            key: "branch",
            label: "Branch",
            example: branches[0]?.branch_name || "YAMUSA STORE",
          },
          { key: "status", label: "Status", example: "verified" },
        ]}
        exampleRows={[
          {
            firstname: "Amina",
            lastname: "Bello",
            email: "amina.bello@example.com",
            phone: "08012345678",
            role: "Accountant",
            branch: branches[0]?.branch_name || "YAMUSA STORE",
            status: "verified",
          },
          {
            firstname: "Ibrahim",
            lastname: "Sani",
            email: "ibrahim.sani@example.com",
            phone: "08098765432",
            role: "Cashier",
            branch: branches[0]?.branch_name || "YAMUSA STORE",
            status: "verified",
          },
        ]}
        mapRow={(r) => ({
          firstname: r["First Name"] || r.firstname || r.firstName || "",
          lastname: r["Last Name"] || r.lastname || r.lastName || "",
          email: r["Email"] || r.email || "",
          phone: r["Phone"] || r.phone || "",
          role: r["Role"] || r.role || "",
          branch:
            r["Branch"] ||
            r["Warehouse"] ||
            r.branch ||
            r.branch_name ||
            r.warehouse ||
            "",
          status: r["Status"] || r.status || "verified",
        })}
      />
    </div>
  );
};

export default StaffManagementDashboard;
