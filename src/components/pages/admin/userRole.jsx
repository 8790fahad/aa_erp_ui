/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card, Label, Input, FormGroup } from "reactstrap/lib";
import {
  Settings,
  Check,
  X,
  Save,
  Users,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Search,
  Filter,
  RefreshCcw,
  Loader2,
  Shield,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button as ShadcnButton } from "@/components/ui/button";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Label as ShadcnLabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { GiMetalHand } from "react-icons/gi";

const UserRole = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    permissions: {},
    status: "active",
  });

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  // Load roles from API
  const loadRoles = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/users/roles-list?facilityId=${activeBusiness.id}&status=${statusFilter}&search=${searchTerm}`,
      (response) => {
        if (response.success) {
          setRoles(response.results || []);
        } else {
          toast.error("Failed to load roles");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading roles:", error);
        toast.error("Error loading roles");
        setLoading(false);
      }
    );
  }, [activeBusiness?.id, statusFilter, searchTerm]);

  // Load roles on component mount and when filters change
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle create new role
  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setEditingRole(null);
    setForm({
      name: "",
      description: "",
      permissions: {},
      status: "active",
    });
    setIsModalOpen(true);
  };

  // Handle edit role
  const handleEdit = (role) => {
    setIsEditing(true);
    setIsCreating(false);
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions || {},
      status: role.status,
    });
    setIsModalOpen(true);
  };

  // Handle save role
  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setLoading(true);
    const payload = {
      facilityId: activeBusiness.id,
      ...form,
    };

    const url = isCreating ? "/users/roles" : `/users/roles/${editingRole.id}`;
    const method = isCreating ? "POST" : "PUT";

    _postApi(
      url,
      payload,
      (response) => {
        if (response.success) {
          toast.success(
            isCreating
              ? "Role created successfully"
              : "Role updated successfully"
          );
          loadRoles();
          handleCancel();
        } else {
          toast.error(response.message || "Failed to save role");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error saving role:", error);
        toast.error("Error saving role");
        setLoading(false);
      },
      method
    );
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setEditingRole(null);
    setIsModalOpen(false);
    setForm({
      name: "",
      description: "",
      permissions: {},
      status: "active",
    });
  };

  // Handle toggle status
  const handleToggleStatus = (role) => {
    setLoading(true);
    _postApi(
      `/users/roles/${role.id}/toggle-status`,
      {},
      (response) => {
        if (response.success) {
          toast.success(response.message);
          loadRoles();
        } else {
          toast.error(response.message || "Failed to update status");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error toggling status:", error);
        toast.error("Error updating status");
        setLoading(false);
      },
      "PUT"
    );
  };

  // Handle delete role
  const handleDelete = (role) => {
    if (
      window.confirm(`Are you sure you want to delete the role "${role.name}"?`)
    ) {
      setLoading(true);
      _postApi(
        `/users/roles/${role.id}`,
        {},
        (response) => {
          if (response.success) {
            toast.success("Role deleted successfully");
            loadRoles();
          } else {
            toast.error(response.message || "Failed to delete role");
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error deleting role:", error);
          toast.error("Error deleting role");
          setLoading(false);
        },
        "DELETE"
      );
    }
  };

  const copyRoleId = async (id) => {
    if (id === undefined || id === null || id === "") return;
    try {
      await navigator.clipboard.writeText(String(id));
      toast.success("Role ID copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <Card className="h-100 shadow-sm border-0">
      {/* Card Header */}
      <div
        className="card-header border-0 text-white position-relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${
            activeBusiness?.primary_color || "#007bff"
          } 0%, ${activeBusiness?.primary_color || "#007bff"}dd 100%)`,
          padding: "1rem",
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.5rem" }}>👥</span>
            <div>
              <h5 className="mb-0 fw-bold">User Roles Management</h5>
              <small className="opacity-75">
                Manage user roles and permissions
              </small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button
              color="primary"
              onClick={handleCreate}
              className=""
              size="sm"
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-body p-3 border-bottom">
        <div className="row g-3 align-items-center">
          <div className="col-md-6">
            <FormGroup>
              <div className="position-relative">
                <Input
                  type="text"
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ps-9"
                />
                <Search
                  size={16}
                  className="position-absolute top-50 translate-middle-y ms-3 text-muted"
                />
              </div>
            </FormGroup>
          </div>
          <div className="col-md-3">
            <FormGroup>
              <Input
                type="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Input>
            </FormGroup>
          </div>
          <div className="col-md-3 d-flex align-items-end mt-0">
            <Button
              color="secondary"
              outline
              onClick={loadRoles}
              className="d-flex align-items-center gap-2"
            >
              <RefreshCcw size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Roles List */}
      <div className="card-body p-0">
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-5">
            <Users size={30} className="text-muted mb-3" />
            <h5 className="text-muted">No roles found</h5>
            <p className="text-muted">
              {searchTerm || statusFilter !== "all"
                ? "No roles match your search criteria"
                : "Get started by creating your first role"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button color="primary" onClick={handleCreate}>
                Create First Role
              </Button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table
              className="table table-hover mb-0"
              style={{ height: "100%", overflow: "scroll" }}
            >
              <thead className="table-light">
                <tr>
                  <th>Role</th>
                  <th>Role ID</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td>
                      <div className="fw-semibold">{role.name}</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => copyRoleId(role.id)}
                        className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 font-monospace text-muted"
                        title={`Copy: ${role.id}`}
                      >
                        <span>{role.id}</span>
                        <Copy size={12} />
                      </button>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          role.status === "active"
                            ? "bg-success"
                            : "bg-secondary"
                        }`}
                      >
                        {role.status}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex gap-1 justify-content-center">
                        <Button
                          size="sm"
                          color="outline-primary"
                          onClick={() => handleEdit(role)}
                          disabled={loading}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          size="sm"
                          color={
                            role.status === "active"
                              ? "outline-warning"
                              : "outline-success"
                          }
                          onClick={() => handleToggleStatus(role)}
                          disabled={loading}
                          title={
                            role.status === "active" ? "Deactivate" : "Activate"
                          }
                        >
                          {role.status === "active" ? (
                            <PowerOff size={14} />
                          ) : (
                            <Power size={14} />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Role Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => !open && handleCancel()}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {isCreating ? "Create New Role" : "Edit Role"}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Create a new user role with specific permissions"
                : "Update the role details and permissions"}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <ShadcnLabel htmlFor="name">
                  Role Name <span className="text-red-500">*</span>
                </ShadcnLabel>
                <ShadcnInput
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter role name"
                  required
                />
              </div>
              <div className="space-y-2">
                <ShadcnLabel htmlFor="status">Status</ShadcnLabel>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <ShadcnLabel htmlFor="description">Description</ShadcnLabel>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Enter role description"
              />
            </div>

            <DialogFooter className="gap-2">
              <ShadcnButton
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </ShadcnButton>
              <ShadcnButton
                type="submit"
                disabled={loading || !form.name.trim()}
                className="bg-[#4267B2] hover:bg-[#4267B2]/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isCreating ? "Create Role" : "Update Role"}
                  </>
                )}
              </ShadcnButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default UserRole;
