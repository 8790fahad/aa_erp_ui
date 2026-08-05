import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Eye, Search, Filter, Minus } from "lucide-react";
import { toast } from "sonner";

const Deductions = () => {
  const [deductions, setDeductions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDeduction, setSelectedDeduction] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    calculationType: "fixed", // fixed or percentage
    description: "",
    isRoleBased: false,
    roleId: "",
    roleName: "",
  });

  useEffect(() => {
    fetchDeductions();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/users/roles");
      const data = await response.json();

      if (data.success) {
        setRoles(data.data);
      } else {
        console.error("Error fetching roles:", data.message);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const fetchDeductions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/hr/deductions");
      const data = await response.json();

      if (data.success) {
        setDeductions(data.data);
      } else {
        console.error("Error fetching deductions:", data.message);
      }
    } catch (error) {
      console.error("Error fetching deductions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDeduction = () => {
    setSelectedDeduction(null);
    setFormData({
      name: "",
      amount: "",
      calculationType: "fixed",
      description: "",
      isRoleBased: false,
      roleId: "",
      roleName: "",
    });
    setShowForm(true);
  };

  const handleEditDeduction = (deduction) => {
    setSelectedDeduction(deduction);
    setFormData({
      name: deduction.name || "",
      amount: deduction.amount || "",
      calculationType: deduction.calculationType || "fixed",
      description: deduction.description || "",
      isRoleBased: deduction.isRoleBased || false,
      roleId: deduction.roleId || "",
      roleName: deduction.roleName || "",
    });
    setShowForm(true);
  };

  const handleViewDeduction = (deduction) => {
    setSelectedDeduction(deduction);
    // TODO: Implement view modal
    console.log("View deduction:", deduction);
  };

  const handleDeleteDeduction = async (deduction) => {
    if (window.confirm(`Are you sure you want to delete ${deduction.name}?`)) {
      try {
        const response = await fetch(`/api/hr/deductions/${deduction.id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          fetchDeductions();
          toast.success("Deduction deleted successfully");
        } else {
          toast.error("Error deleting deduction");
        }
      } catch (error) {
        console.error("Error deleting deduction:", error);
        toast.error("Error deleting deduction");
      }
    }
  };

  const handleSaveDeduction = async (e) => {
    e.preventDefault();

    try {
      const url = selectedDeduction
        ? `/api/hr/deductions/${selectedDeduction.id}`
        : "/api/hr/deductions";

      const method = selectedDeduction ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setShowForm(false);
        setSelectedDeduction(null);
        fetchDeductions();
        toast.success(
          selectedDeduction
            ? "Deduction updated successfully"
            : "Deduction created successfully"
        );
      } else {
        toast.error(data.message || "Error saving deduction");
      }
    } catch (error) {
      console.error("Error saving deduction:", error);
      toast.error("Error saving deduction");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const filteredDeductions = deductions.filter(
    (deduction) =>
      deduction.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deduction.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Deductions</h1>
        <button
          onClick={handleAddDeduction}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Deduction
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search deductions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
        </div>
      </div>

      {/* Deductions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deduction Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount/Percentage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role-Based
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeductions.map((deduction) => (
                <tr key={deduction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {deduction.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {deduction.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      {deduction.calculationType === "percentage"
                        ? "Percentage"
                        : "Fixed Amount"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {deduction.calculationType === "percentage"
                      ? `${deduction.amount}%`
                      : `₦${parseFloat(
                          deduction.amount || 0
                        ).toLocaleString()}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {deduction.isRoleBased ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {deduction.roleName}
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        General
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewDeduction(deduction)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditDeduction(deduction)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDeduction(deduction)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredDeductions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">
              {searchTerm
                ? "No deductions found matching your search."
                : "No deductions found."}
            </div>
            <div className="text-gray-400 text-sm mt-2">
              {!searchTerm && "Click 'Add Deduction' to create your first one."}
            </div>
          </div>
        )}
      </div>

      {/* Deduction Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {selectedDeduction ? "Edit Deduction" : "Add Deduction"}
              </h2>

              <form onSubmit={handleSaveDeduction} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deduction Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Calculation Type *
                    </label>
                    <select
                      name="calculationType"
                      value={formData.calculationType}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage of Salary</option>
                    </select>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.calculationType === "percentage"
                      ? "Percentage (%)"
                      : "Amount (₦)"}{" "}
                    *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    max={
                      formData.calculationType === "percentage"
                        ? "100"
                        : undefined
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Role-Based Toggle */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="isRoleBased"
                      checked={formData.isRoleBased}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      This is a role-based deduction
                    </span>
                  </label>
                </div>

                {/* Role Selection */}
                {formData.isRoleBased && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role *
                    </label>
                    <select
                      name="roleId"
                      value={formData.roleId}
                      onChange={(e) => {
                        const selectedRole = roles.find(
                          (r) => r.id === e.target.value
                        );
                        setFormData((prev) => ({
                          ...prev,
                          roleId: e.target.value,
                          roleName: selectedRole?.roleName || "",
                        }));
                      }}
                      required={formData.isRoleBased}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value="">Select Role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.roleName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    {selectedDeduction
                      ? "Update Deduction"
                      : "Create Deduction"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deductions;
