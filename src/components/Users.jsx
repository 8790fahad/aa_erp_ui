/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useState } from "react";
import { Button, Row, Col } from "reactstrap";
import { MdDelete, MdEdit, MdLock } from "react-icons/md";
import { useSelector } from "react-redux";
import { FaPlus, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import CustomModal from "@/common/Custom/CustomModal";
import CustomButton from "@/common/Custom/CustomButton";
import { _deleteApi, _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import useQuery from "@/common/Custom/Hook/useQuery";
import PropTypes from "prop-types";
import User from "./User";
import { Input, Select } from "antd";
import CustomTable1 from "@/common/Custom/CustomTable1";
import {
  CircleAlert,
  MoreVertical,
  Option,
  Phone,
  Shield,
  UserPlus,
} from "lucide-react";

export default function Users() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPrivilegeModal, setShowPrivilegeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const navigate = useNavigate();
  const query = useQuery();
  const userId = query.get("user");
  const [isModalOpen, setModalOpen] = useState(false);

  const toggleModal = () => setModalOpen(!isModalOpen);
  const confirmDelete = (id) => {
    handleDelete(id);
    toggleModal();
  };

  const getUsers = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/v1/get-users-by-facility/${activeBusiness.id}`,
      (data) => {
        setLoading(false);
        if (data.success) {
          setUsersList(data.results);
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

  const handleDelete = (userId) => {
    _deleteApi(
      `/users/delete/${userId}/${activeBusiness.id}`,
      {},
      () => {
        toast.success("Deleted successfully");
        getUsers();
      },
      (err) => console.error(err)
    );
  };

  const StaffRoleModal = () => {
    const [role, setRole] = useState("");
    const [error, setError] = useState("");

    const roles = [
      { value: "admin", label: "Admin" },
      { value: "manager", label: "Manager" },
      { value: "staff", label: "Staff" },
      { value: "viewer", label: "Viewer" },
      { value: "cashier", label: "Cashier" },
      { value: "inventory_manager", label: "Inventory Manager" },
      { value: "sales_rep", label: "Sales Representative" },
    ];

    const handleRoleChange = (value) => {
      setRole(value);
      if (error) setError("");
    };

    const handleSubmit = () => {
      if (!role) {
        setError("Please select a role");
        return;
      }

      console.log("Updating role for user:", selectedUser?.id, "to:", role);
      // Handle role update API call here

      setShowRoleModal(false);
      setRole("");
      setError("");
      setSelectedUser(null);
    };

    return (
      <CustomModal
        isOpen={showRoleModal}
        toggle={() => {
          setShowRoleModal(false);
          setRole("");
          setError("");
          setSelectedUser(null);
        }}
        header={
          <div className="flex items-center p-3">
            <UserPlus className="mr-2" size={20} />
            Staff Role -{" "}
            {selectedUser?.fullname ||
              `${selectedUser?.firstname} ${selectedUser?.lastname}`}
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end space-x-2">
            <Button
              onClick={() => {
                setShowRoleModal(false);
                setRole("");
                setError("");
                setSelectedUser(null);
              }}
              className="px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: "#4267B2" }}
              onClick={handleSubmit}
              className="px-4 py-2"
            >
              Update Role
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Role <span className="text-red-500">*</span>
            </label>
            <Select
              value={role}
              onChange={handleRoleChange}
              placeholder="Select a role"
              className={`w-full h-12 ${error ? "border-red-500" : ""}`}
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div className="border-t p-2">
                    <button
                      className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded flex items-center text-blue-600"
                      onClick={() => {
                        console.log("Add new role clicked");
                      }}
                    >
                      <FaPlus size={12} className="mr-2" />
                      Add New Role
                    </button>
                  </div>
                </div>
              )}
            >
              {roles.map((roleOption) => (
                <Option key={roleOption.value} value={roleOption.value}>
                  {roleOption.label}
                </Option>
              ))}
            </Select>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              Current Role:{" "}
              <span className="font-medium">
                {selectedUser?.role || "Not assigned"}
              </span>
            </p>
          </div>
        </div>
      </CustomModal>
    );
  };

  const StaffPrivilegeModal = () => {
    const [privileges, setPrivileges] = useState([]);

    const availablePrivileges = [
      { value: "create_users", label: "Create Users" },
      { value: "edit_users", label: "Edit Users" },
      { value: "delete_users", label: "Delete Users" },
      { value: "view_reports", label: "View Reports" },
      { value: "manage_inventory", label: "Manage Inventory" },
      { value: "manage_settings", label: "Manage Settings" },
      { value: "process_sales", label: "Process Sales" },
      { value: "manage_customers", label: "Manage Customers" },
      { value: "view_analytics", label: "View Analytics" },
      { value: "export_data", label: "Export Data" },
      { value: "backup_restore", label: "Backup & Restore" },
      { value: "system_admin", label: "System Administration" },
    ];

    const handlePrivilegeChange = (value) => {
      setPrivileges(value);
    };

    const handleSubmit = () => {
      console.log(
        "Updating privileges for user:",
        selectedUser?.id,
        "to:",
        privileges
      );
      // Handle privilege update API call here

      setShowPrivilegeModal(false);
      setPrivileges([]);
      setSelectedUser(null);
    };

    return (
      <CustomModal
        isOpen={showPrivilegeModal}
        toggle={() => {
          setShowPrivilegeModal(false);
          setPrivileges([]);
          setSelectedUser(null);
        }}
        header={
          <div className="flex items-center p-3">
            <MdLock className="mr-2" size={20} />
            Staff Privilege -{" "}
            {selectedUser?.fullname ||
              `${selectedUser?.firstname} ${selectedUser?.lastname}`}
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end space-x-2">
            <Button
              onClick={() => {
                setShowPrivilegeModal(false);
                setPrivileges([]);
                setSelectedUser(null);
              }}
              className="px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: "#4267B2" }}
              onClick={handleSubmit}
              className="px-4 py-2"
            >
              Update Privileges
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Privileges
            </label>
            <Select
              mode="multiple"
              value={privileges}
              onChange={handlePrivilegeChange}
              placeholder="Select privileges"
              className="w-full min-h-12"
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div className="border-t p-2">
                    <button
                      className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded flex items-center text-blue-600"
                      onClick={() => {
                        console.log("Add new privilege clicked");
                      }}
                    >
                      <FaPlus size={12} className="mr-2" />
                      Add New Privilege
                    </button>
                  </div>
                </div>
              )}
            >
              {availablePrivileges.map((privilege) => (
                <Option key={privilege.value} value={privilege.value}>
                  {privilege.label}
                </Option>
              ))}
            </Select>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              Current Role:{" "}
              <span className="font-medium">
                {selectedUser?.role || "Not assigned"}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Selected Privileges:{" "}
              <span className="font-medium">
                {privileges.length} privilege(s)
              </span>
            </p>
          </div>
        </div>
      </CustomModal>
    );
  };

  const filteredUsers = usersList.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (
      user?.firstname?.toLowerCase().includes(term) ||
      user?.lastname?.toLowerCase().includes(term) ||
      user?.username?.toLowerCase().includes(term) ||
      user?.phone?.toLowerCase().includes(term)
    );
  });

  if (userId) {
    if (!usersList.length) {
      return <div className="p-3">Loading user...</div>;
    }

    const selectedUser = usersList.find(
      (user) => String(user.id) === String(userId)
    );

    if (!selectedUser) {
      return <div className="text-danger p-3">User not found</div>;
    }

    return <User user={selectedUser} />;
  }

  const ActionDropdown = ({ item }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <MoreVertical size={16} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
            <div className="py-2">
              <button
                onClick={() => {
                  navigate(`/app/admin/manage-user?user=${item.id}`);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-gray-700"
              >
                <MdEdit size={16} className="mr-2" />
                Edit User
              </button>

              <button
                onClick={() => {
                  // Handle suspend action
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-orange-600"
              >
                <CircleAlert size={16} className="mr-2" />
                Suspend User
              </button>

              <button
                onClick={() => {
                  setDeleteModalOpen(true);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center text-red-600"
              >
                <MdDelete size={16} className="mr-2" />
                Delete User
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <CustomModal
          isOpen={deleteModalOpen}
          toggle={() => setDeleteModalOpen(false)}
          header="Confirm User Delete"
          footer={
            <>
              <Button
                style={{ backgroundColor: "#4267B2" }}
                onClick={() => setDeleteModalOpen(false)}
                className="mr-2"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                color="danger"
                onClick={() => {
                  handleDelete(item.id);
                  setDeleteModalOpen(false);
                }}
                size="sm"
              >
                Delete
              </Button>
            </>
          }
        >
          Are you sure you want to <b>delete</b>{" "}
          <b className="text-danger">
            {item.fullname || `${item.firstname} ${item.lastname}`} ({item.role}
            )
          </b>
          ?
        </CustomModal>
      </div>
    );
  };

  const CreateUserModal = () => {
    const [formData, setFormData] = useState({
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      phone: "",
      role: "",
      privileges: [],
    });

    const [errors, setErrors] = useState({});

    const handleInputChange = (field, value) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear error when user starts typing
      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: "",
        }));
      }
    };

    const validateForm = () => {
      const newErrors = {};

      if (!formData.firstName.trim())
        newErrors.firstName = "First name is required";
      if (!formData.lastName.trim())
        newErrors.lastName = "Last name is required";
      if (!formData.username.trim())
        newErrors.username = "Username is required";
      if (!formData.email.trim()) newErrors.email = "Email is required";
      if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
      if (!formData.role) newErrors.role = "Role is required";

      if (
        formData.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
      ) {
        newErrors.email = "Please enter a valid email address";
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
      if (validateForm()) {
        console.log("Form values:", formData);
        // Handle form submission here
        setShowCreateModal(false);
        setFormData({
          firstName: "",
          lastName: "",
          username: "",
          email: "",
          phone: "",
          role: "",
          privileges: [],
        });
        setErrors({});
      }
    };

    return (
      <CustomModal
        isOpen={showCreateModal}
        toggle={() => setShowCreateModal(false)}
        header={
          <div className="flex items-center p-2">
            <UserPlus className="mr-2" size={20} />
            Create New User
          </div>
        }
        size="lg"
        footer={
          <div className="flex justify-end space-x-2">
            <Button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              style={{ backgroundColor: "#4267B2" }}
              onClick={handleSubmit}
              className="px-4 py-2"
            >
              Create User
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <Input
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="Enter first name"
                className={`h-10 rounded-lg ${
                  errors.firstName ? "border-red-500" : ""
                }`}
              />
              {errors.firstName && (
                <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <Input
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                placeholder="Enter last name"
                className={`h-10 rounded-lg ${
                  errors.lastName ? "border-red-500" : ""
                }`}
              />
              {errors.lastName && (
                <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <Input
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                placeholder="Enter username"
                className={`h-10 rounded-lg ${
                  errors.username ? "border-red-500" : ""
                }`}
              />
              {errors.username && (
                <p className="text-red-500 text-sm mt-1">{errors.username}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <Input
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter email address"
                type="email"
                className={`h-10 rounded-lg ${
                  errors.email ? "border-red-500" : ""
                }`}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone No. *
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="Enter phone number"
                className={`h-10 rounded-lg ${
                  errors.phone ? "border-red-500" : ""
                }`}
                prefix={<Phone size={16} className="text-gray-400" />}
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
              )}
            </div>
          </div>
        </div>
      </CustomModal>
    );
  };

  const columns = [
    {
      value: "fullname",
      title: "Name",
      custom: true,
      component: (item) => (
        <div className="flex items-center pl-4">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
            <FaUser className="text-white text-sm" />
          </div>
          <div>
            <div className="font-medium">
              {item.fullname || `${item.firstname} ${item.lastname}`}
            </div>
            <div className="text-sm text-gray-500">{item.email}</div>
          </div>
        </div>
      ),
    },
    {
      value: "username",
      title: "Username",
      custom: true,
      component: (item) => <div className="font-medium">{item.username}</div>,
    },
    {
      value: "phone",
      title: "Phone",
      custom: true,
      component: (item) => <div className="text-center">{item.phone}</div>,
    },
    {
      value: "role",
      title: "Role",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              item.role === "Admin" || item.role === "Store Owner"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {item.role === "Admin" && <Shield className="mr-1" size={12} />}
            {item.role}
          </span>
        </div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Active
          </span>
        </div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="flex justify-center">
          <ActionDropdown item={item} />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-600 mt-1">
              Manage your team members and their access
            </p>
          </div>
          <div className="flex gap-3">
            <CustomButton
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
            >
              <FaPlus className="mr-2" size={14} />
              Create New User
            </CustomButton>
          </div>
        </div>

        <div className="mb-6">
          <Row>
            <Col md={6}>
              <Input.Search
                placeholder="Search users by name, username, or phone"
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10"
                size="large"
              />
            </Col>
          </Row>
        </div>

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <CustomTable1 data={filteredUsers} fields={columns} />
          </div>
        </div>
      </div>

      <CreateUserModal />
      <StaffRoleModal />
      <StaffPrivilegeModal />
    </div>
  );
}

const TableRow = ({ id, index, fullname, phone, role, handleDelete }) => {
  const navigate = useNavigate();
  const [isModalOpen, setModalOpen] = useState(false);

  const toggleModal = () => setModalOpen(!isModalOpen);
  const confirmDelete = () => {
    handleDelete(id);
    toggleModal();
  };

  return (
    <>
      <tr>
        <td>{index}</td>
        <td>{fullname}</td>
        <td>{phone}</td>
        <td>{role}</td>
        <td className="d-flex align-items-center justify-center">
          <div className="d-flex flex-column flex-md-row justify-center">
            <Button
              style={{ backgroundColor: "#4267B2" }}
              size="sm"
              onClick={() => navigate(`/app/admin/manage-user?user=${id}`)}
              className="mr-2 d-flex align-items-center mb-1 mb-md-0"
            >
              <MdEdit size={20} />
              Edit
            </Button>

            <Button
              color="danger"
              size="sm"
              onClick={toggleModal}
              className="d-flex align-items-center"
            >
              <MdDelete size={20} />
              Delete
            </Button>
          </div>
        </td>
      </tr>

      <CustomModal
        isOpen={isModalOpen}
        toggle={toggleModal}
        header="Confirm User Delete"
        footer={
          <>
            <Button
              style={{ backgroundColor: "#4267B2" }}
              onClick={toggleModal}
              className="mr-2"
              size="sm"
            >
              Cancel
            </Button>
            <Button color="danger" onClick={confirmDelete} size="sm">
              Delete
            </Button>
          </>
        }
      >
        Are you sure you want to <b>delete</b>{" "}
        <b className="text-danger">
          {fullname} ({role})
        </b>
        ?
      </CustomModal>
    </>
  );
};

TableRow.propTypes = {
  id: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  fullname: PropTypes.string.isRequired,
  phone: PropTypes.string.isRequired,
  role: PropTypes.string.isRequired,
  handleDelete: PropTypes.func.isRequired,
};
