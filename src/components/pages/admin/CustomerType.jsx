/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from "reactstrap";
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
} from "lucide-react";
import { toast } from "sonner";

import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { _postApi, _fetchApi } from "@/redux/actions/api";
import { GiMetalHand } from "react-icons/gi";

const CustomerType = () => {
  const [customerTypes, setCustomerTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingCustomerType, setEditingCustomerType] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "active",
  });

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  // Load customer types from API
  const loadCustomerTypes = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/customer-types/list?facilityId=${activeBusiness.id}&status=${statusFilter}&search=${searchTerm}`,
      (response) => {
        if (response.success) {
          setCustomerTypes(response.results || []);
        } else {
          toast.error("Failed to load customer types");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading customer types:", error);
        toast.error("Error loading customer types");
        setLoading(false);
      }
    );
  }, [activeBusiness?.id, statusFilter, searchTerm]);

  // Load customer types on component mount and when filters change
  useEffect(() => {
    loadCustomerTypes();
  }, [loadCustomerTypes]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle create new customer type
  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setEditingCustomerType(null);
    setForm({
      name: "",
      description: "",
      status: "active",
    });
    setIsModalOpen(true);
  };

  // Handle edit customer type
  const handleEdit = (customerType) => {
    setIsEditing(true);
    setIsCreating(false);
    setEditingCustomerType(customerType);
    setForm({
      name: customerType.name,
      description: customerType.description || "",
      status: customerType.status,
    });
    setIsModalOpen(true);
  };

  // Handle save customer type
  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Customer type name is required");
      return;
    }

    setLoading(true);
    const payload = {
      facilityId: activeBusiness.id,
      ...form,
    };

    const url = isCreating ? "/customer-types" : `/customer-types/${editingCustomerType.id}`;
    const method = isCreating ? "POST" : "PUT";

    _postApi(
      url,
      payload,
      (response) => {
        if (response.success) {
          toast.success(
            isCreating
              ? "Customer type created successfully"
              : "Customer type updated successfully"
          );
          loadCustomerTypes();
          handleCancel();
        } else {
          toast.error(response.message || "Failed to save customer type");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error saving customer type:", error);
        toast.error("Error saving customer type");
        setLoading(false);
      },
      method
    );
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setEditingCustomerType(null);
    setIsModalOpen(false);
    setForm({
      name: "",
      description: "",
      status: "active",
    });
  };

  // Handle toggle status
  const handleToggleStatus = (customerType) => {
    setLoading(true);
    _postApi(
      `/customer-types/${customerType.id}/toggle-status`,
      {},
      (response) => {
        if (response.success) {
          toast.success(response.message);
          loadCustomerTypes();
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

  // Handle delete customer type
  const handleDelete = (customerType) => {
    if (
      window.confirm(`Are you sure you want to delete the customer type "${customerType.name}"?`)
    ) {
      setLoading(true);
      _postApi(
        `/customer-types/${customerType.id}`,
        {},
        (response) => {
          if (response.success) {
            toast.success("Customer type deleted successfully");
            loadCustomerTypes();
          } else {
            toast.error(response.message || "Failed to delete customer type");
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error deleting customer type:", error);
          toast.error("Error deleting customer type");
          setLoading(false);
        },
        "DELETE"
      );
    }
  };

  return (
    <Card className="h-100 shadow-sm border-0">
      {/* Card Header */}
      <div
        className="card-header border-0 text-white position-relative overflow-hidden"
        style={{
          background: "var(--aa-navy)",
          padding: "1rem",
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.5rem" }}>🏷️</span>
            <div>
              <h5 className="mb-0 fw-bold">Customer Types Management</h5>
              <small className="opacity-75">Manage customer types and categories</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button color="primary" onClick={handleCreate} className="" size="sm">
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
              onClick={loadCustomerTypes}
              className="d-flex align-items-center gap-2"
            >
              <RefreshCcw size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Types List */}
      <div className="card-body p-0">
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : customerTypes.length === 0 ? (
          <div className="text-center py-5">
            <Users size={30} className="text-muted mb-3" />
            <h5 className="text-muted">No customer types found</h5>
            <p className="text-muted">
              {searchTerm || statusFilter !== "all"
                ? "No customer types match your search criteria"
                : "Get started by creating your first customer type"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button color="primary" onClick={handleCreate}>
                Create First Customer Type
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
                  <th>Customer Type</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customerTypes.map((customerType) => (
                  <tr key={customerType.id}>
                    <td>
                      <div className="fw-semibold">{customerType.name}</div>
                      {customerType.description && (
                        <div className="text-muted small">{customerType.description}</div>
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          customerType.status === "active"
                            ? "bg-success"
                            : "bg-secondary"
                        }`}
                      >
                        {customerType.status}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex gap-1 justify-content-center">
                        <Button
                          size="sm"
                          color="outline-primary"
                          onClick={() => handleEdit(customerType)}
                          disabled={loading}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          size="sm"
                          color={
                            customerType.status === "active"
                              ? "outline-warning"
                              : "outline-success"
                          }
                          onClick={() => handleToggleStatus(customerType)}
                          disabled={loading}
                          title={
                            customerType.status === "active"
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          {customerType.status === "active" ? (
                            <PowerOff size={14} />
                          ) : (
                            <Power size={14} />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          color="outline-danger"
                          onClick={() => handleDelete(customerType)}
                          disabled={loading}
                          title="Delete"
                        >
                          <Trash2 size={14} />
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

      {/* Create/Edit Customer Type Modal */}
      <Modal isOpen={isModalOpen} toggle={handleCancel} size="lg">
        <ModalHeader toggle={handleCancel}>
          {isCreating ? "Create New Customer Type" : "Edit Customer Type"}
        </ModalHeader>
        <ModalBody>
          <div className="row g-3">
            <div className="col-md-6">
              <FormGroup>
                <Label>Customer Type Name *</Label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter customer type name"
                />
              </FormGroup>
            </div>
            <div className="col-md-6">
              <FormGroup>
                <Label>Status</Label>
                <Input
                  type="select"
                  value={form.status}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Input>
              </FormGroup>
            </div>
            <div className="col-12">
              <FormGroup>
                <Label>Description</Label>
                <Input
                  type="textarea"
                  rows="3"
                  value={form.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Enter customer type description"
                />
              </FormGroup>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            outline
            onClick={handleCancel}
            disabled={loading}
            className="d-flex align-items-center gap-2"
          >
            <X size={14} />
            Cancel
          </Button>
          <Button
            color="primary"
            onClick={handleSave}
            disabled={loading || !form.name.trim()}
            className="d-flex align-items-center gap-2"
          >
            {loading ? (
              <>
                <div
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                {isCreating ? "Create Customer Type" : "Update Customer Type"}
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </Card>
  );
};

export default CustomerType;
