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
  Package,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Search,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button as ShadcnButton } from "@/components/ui/button";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Label as ShadcnLabel } from "@/components/ui/label";

import { _postApi, _fetchApi } from "@/redux/actions/api";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { formatNumber } from "@/utilities";

const ProductMultiplier = () => {
  const [multipliers, setMultipliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMultiplier, setEditingMultiplier] = useState(null);
  const [form, setForm] = useState({
    multiplier_type: "",
    description: "",
    multiplier_value: "",
    product_id: "",
    product_name: "",
    sku: "",
    status: "active",
  });
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);

  // Load multipliers from API
  const loadMultipliers = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/api/product-multipliers?facilityId=${activeBusiness.id}&status=${statusFilter}&search=${searchTerm}`,
      (response) => {
        if (response.success) {
          setMultipliers(response.data || []);
        } else {
          toast.error("Failed to load multipliers");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading multipliers:", error);
        toast.error("Error loading multipliers");
        setLoading(false);
      }
    );
  }, [activeBusiness?.id, statusFilter, searchTerm]);

  // Load products
  const loadProducts = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/api/products?facilityId=${activeBusiness.id}`,
      (response) => {
        if (response.success) {
          setProducts(response.data || []);
        }
      },
      (error) => {
        console.error("Error loading products:", error);
        setProducts([]);
      }
    );
  }, [activeBusiness?.id]);

  // Load multipliers on component mount and when filters change
  useEffect(() => {
    loadMultipliers();
    loadProducts();
  }, [loadMultipliers, loadProducts]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle create new multiplier
  const handleCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setEditingMultiplier(null);
    setSelectedProduct(null);
    setForm({
      multiplier_type: "",
      description: "",
      multiplier_value: "",
      product_id: "",
      product_name: "",
      sku: "",
      status: "active",
    });
    setIsModalOpen(true);
  };

  // Handle edit multiplier
  const handleEdit = (multiplier) => {
    setIsEditing(true);
    setIsCreating(false);
    setEditingMultiplier(multiplier);
    setForm({
      multiplier_type: multiplier.multiplier_type || "",
      description: multiplier.description || "",
      multiplier_value: multiplier.multiplier_value || "",
      product_id: multiplier.product_id || "",
      product_name: multiplier.product_name || "",
      sku: multiplier.sku || "",
      status: multiplier.status,
    });
    setIsModalOpen(true);
  };

  // Handle save multiplier
  const handleSave = () => {
    if (!form.multiplier_type.trim()) {
      toast.error("Multiplier type is required");
      return;
    }

    if (!form.multiplier_value || form.multiplier_value <= 0) {
      toast.error("Multiplier value must be greater than 0");
      return;
    }

    setLoading(true);
    const payload = {
      facilityId: activeBusiness.id,
      createdBy:
        `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.id,
      ...form,
    };

    const url = isCreating
      ? "/api/product-multipliers"
      : `/api/product-multipliers/${editingMultiplier.id}`;
    const method = isCreating ? "POST" : "PUT";

    _postApi(
      url,
      payload,
      (response) => {
        if (response.success) {
          toast.success(
            isCreating
              ? "Multiplier created successfully"
              : "Multiplier updated successfully"
          );
          loadMultipliers();
          handleCancel();
        } else {
          toast.error(response.message || "Failed to save multiplier");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error saving multiplier:", error);
        toast.error("Error saving multiplier");
        setLoading(false);
      },
      method
    );
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    setEditingMultiplier(null);
    setSelectedProduct(null);
    setIsModalOpen(false);
    setForm({
      description: "",
      multiplier_value: "",
      multiplier_type: "",
      product_id: "",
      product_name: "",
      sku: "",
      status: "active",
    });
  };

  // Handle toggle status
  const handleToggleStatus = (multiplier) => {
    setLoading(true);
    _postApi(
      `/api/product-multipliers/${multiplier.id}/toggle-status`,
      { facilityId: activeBusiness.id },
      (response) => {
        if (response.success) {
          toast.success(response.message);
          loadMultipliers();
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

  // Handle delete multiplier
  const handleDelete = (multiplier) => {
    if (
      window.confirm(
        `Are you sure you want to delete the multiplier "${multiplier.name}"?`
      )
    ) {
      setLoading(true);
      _postApi(
        `/api/product-multipliers/${multiplier.id}?facilityId=${activeBusiness.id}`,
        {},
        (response) => {
          if (response.success) {
            toast.success("Multiplier deleted successfully");
            loadMultipliers();
          } else {
            toast.error(response.message || "Failed to delete multiplier");
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error deleting multiplier:", error);
          toast.error("Error deleting multiplier");
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
            <span style={{ fontSize: "1.5rem" }}>👥</span>
            <div>
              <h5 className="mb-0 fw-bold">Product Multipliers</h5>
              <small className="opacity-75">
                Manage product pricing multipliers and categories
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
      <div className="card-body">
        <div className="row g-3 align-items-center">
          <div className="col-md-6">
            <FormGroup>
              <div className="position-relative">
                <Input
                  type="text"
                  placeholder="Search by type or product..."
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
          <div className="col-md-3 d-flex mt-0 align-items-end">
            <Button
              color="secondary"
              outline
              onClick={loadMultipliers}
              className="d-flex align-items-center gap-2"
            >
              <RefreshCcw size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className="card-body p-0">
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : multipliers.length === 0 ? (
          <div className="text-center py-5">
            <h5 className="text-muted">No multipliers found</h5>
            <p className="text-muted mb-3">
              {searchTerm || statusFilter !== "all"
                ? "No multipliers match your search criteria"
                : "Get started by creating your first multiplier"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button color="primary" onClick={handleCreate}>
                Create First Multiplier
              </Button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            {/* {JSON.stringify(multipliers)} */}
            <table
              className="table table-hover mb-0"
              style={{ height: "100%", overflow: "scroll" }}
            >
              <thead className="table-light">
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {multipliers.map((multiplier) => (
                  <tr key={multiplier.id}>
                    <td>
                      <div className="fw-semibold">{multiplier.sku}</div>
                    </td>
                    <td>
                      <div className="fw-semibold">
                        {multiplier.product_name}({multiplier.multiplier_type})
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold text-primary">
                        {multiplier.multiplier_value}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          multiplier.status === "active"
                            ? "bg-success"
                            : "bg-secondary"
                        }`}
                      >
                        {multiplier.status}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex gap-1 justify-content-center">
                        <Button
                          size="sm"
                          color="outline-primary"
                          onClick={() => handleEdit(multiplier)}
                          disabled={loading}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          size="sm"
                          color={
                            multiplier.status === "active"
                              ? "outline-warning"
                              : "outline-success"
                          }
                          onClick={() => handleToggleStatus(multiplier)}
                          disabled={loading}
                          title={
                            multiplier.status === "active"
                              ? "Deactivate"
                              : "Activate"
                          }
                        >
                          {multiplier.status === "active" ? (
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

      {/* Create/Edit Multiplier Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {isCreating ? "Create New Multiplier" : "Edit Multiplier"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-6"
          >
            {/* Product Selection */}
            <div className="space-y-2">
              <ShadcnLabel htmlFor="product">
                Product <span className="text-red-500">*</span>
              </ShadcnLabel>
              <TypeaheadCustom
                options={
                  products.filter(
                    (product) => product.item_type === "Finished Good"
                  ) || []
                }
                placeholder="Search products by name or SKU..."
                labelKey={(product) => `${product.name} (${product.sku})`}
                onChange={(selectedItems) => {
                  const selectedProduct =
                    selectedItems.length > 0 ? selectedItems[0] : null;
                  setSelectedProduct(selectedProduct);
                  if (selectedProduct) {
                    handleInputChange("product_id", selectedProduct.id);
                    handleInputChange("product_name", selectedProduct.name);
                    handleInputChange("sku", selectedProduct.sku);
                  } else {
                    handleInputChange("product_id", "");
                    handleInputChange("product_name", "");
                    handleInputChange("sku", "");
                  }
                }}
                selected={selectedProduct ? [selectedProduct] : []}
              />
            </div>

            {/* Multiplier Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <ShadcnLabel htmlFor="multiplier_type">
                  Multiplier Size <span className="text-red-500">*</span>
                </ShadcnLabel>
                <ShadcnInput
                  id="multiplier_type"
                  type="text"
                  value={form.multiplier_type}
                  onChange={(e) =>
                    handleInputChange("multiplier_type", e.target.value)
                  }
                  placeholder="Enter multiplier name e.g A1"
                  required
                />
              </div>
              <div className="space-y-2">
                <ShadcnLabel
                  htmlFor="multiplier_value"
                  className="flex items-center justify-between"
                >
                  <span>
                    Multiplier Value <span className="text-red-500">*</span>
                  </span>
                  {form.multiplier_value && (
                    <span className="text-xs text-gray-500">
                      {formatNumber(form.multiplier_value)}
                    </span>
                  )}
                </ShadcnLabel>
                <ShadcnInput
                  id="multiplier_value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.multiplier_value}
                  onChange={(e) =>
                    handleInputChange("multiplier_value", e.target.value)
                  }
                  placeholder="Enter multiplier value"
                  required
                />
              </div>
            </div>

            {/* Status */}
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
                disabled={
                  loading ||
                  !form.multiplier_type.trim() ||
                  !form.multiplier_value ||
                  !form.product_id
                }
                className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy)]/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isCreating ? "Create Multiplier" : "Update Multiplier"}
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

export default ProductMultiplier;
