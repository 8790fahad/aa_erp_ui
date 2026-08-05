import React, { useState, useEffect } from "react";
import { Save, X, DollarSign, Plus, Trash2, Info } from "lucide-react";
import { useSelector } from "react-redux";

const SalaryStructureForm = ({
  salaryStructure,
  onSave,
  onCancel,
}) => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const [formData, setFormData] = useState({
    structureName: "",
    basicSalary: "",
    allowances: {},
    deductions: {},
    overtimeRate: 1.5,
    payeRate: 0,
    pensionRate: 0,
    description: "",
    status: "Active",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [allowanceItems, setAllowanceItems] = useState([]);
  const [deductionItems, setDeductionItems] = useState([]);

  useEffect(() => {
    if (salaryStructure) {
      setFormData({
        structureName: salaryStructure.structureName || "",
        basicSalary: salaryStructure.basicSalary || "",
        allowances: salaryStructure.allowances || {},
        deductions: salaryStructure.deductions || {},
        overtimeRate: salaryStructure.overtimeRate || 1.5,
        payeRate: salaryStructure.payeRate || 0,
        pensionRate: salaryStructure.pensionRate || 0,
        description: salaryStructure.description || "",
        status: salaryStructure.status || "Active",
      });

      // Convert allowances and deductions objects to arrays for editing
      setAllowanceItems(
        Object.entries(salaryStructure.allowances || {}).map(([name, amount]) => ({
          name,
          amount: parseFloat(amount),
        }))
      );

      setDeductionItems(
        Object.entries(salaryStructure.deductions || {}).map(([name, amount]) => ({
          name,
          amount: parseFloat(amount),
        }))
      );
    }
  }, [salaryStructure]);

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

  const handleAllowanceChange = (index, field, value) => {
    const newItems = [...allowanceItems];
    newItems[index][field] = field === "amount" ? parseFloat(value) || 0 : value;
    setAllowanceItems(newItems);
  };

  const handleDeductionChange = (index, field, value) => {
    const newItems = [...deductionItems];
    newItems[index][field] = field === "amount" ? parseFloat(value) || 0 : value;
    setDeductionItems(newItems);
  };

  const addAllowanceItem = () => {
    setAllowanceItems([...allowanceItems, { name: "", amount: 0 }]);
  };

  const addDeductionItem = () => {
    setDeductionItems([...deductionItems, { name: "", amount: 0 }]);
  };

  const removeAllowanceItem = (index) => {
    setAllowanceItems(allowanceItems.filter((_, i) => i !== index));
  };

  const removeDeductionItem = (index) => {
    setDeductionItems(deductionItems.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.structureName.trim()) {
      newErrors.structureName = "Structure name is required";
    }
    if (!formData.basicSalary || parseFloat(formData.basicSalary) <= 0) {
      newErrors.basicSalary = "Basic salary must be greater than 0";
    }
    if (formData.overtimeRate < 0) {
      newErrors.overtimeRate = "Overtime rate cannot be negative";
    }
    if (formData.payeRate < 0 || formData.payeRate > 100) {
      newErrors.payeRate = "PAYE rate must be between 0 and 100";
    }
    if (formData.pensionRate < 0 || formData.pensionRate > 100) {
      newErrors.pensionRate = "Pension rate must be between 0 and 100";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Convert allowance and deduction arrays back to objects
      const allowances = {};
      allowanceItems.forEach((item) => {
        if (item.name.trim()) {
          allowances[item.name.trim()] = item.amount;
        }
      });

      const deductions = {};
      deductionItems.forEach((item) => {
        if (item.name.trim()) {
          deductions[item.name.trim()] = item.amount;
        }
      });

      const requestData = {
        ...formData,
        basicSalary: parseFloat(formData.basicSalary),
        allowances,
        deductions,
        overtimeRate: parseFloat(formData.overtimeRate),
        payeRate: parseFloat(formData.payeRate),
        pensionRate: parseFloat(formData.pensionRate),
        facilityId: activeBusiness?.id || user?.facilityId,
        ...(salaryStructure 
          ? { updatedBy: user?.id } 
          : { createdBy: user?.id }
        ),
      };

      await onSave(requestData);
    } catch (error) {
      console.error("Error saving salary structure:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const calculateTotalAllowances = () => {
    return allowanceItems.reduce((total, item) => total + (item.amount || 0), 0);
  };

  const calculateTotalDeductions = () => {
    return deductionItems.reduce((total, item) => total + (item.amount || 0), 0);
  };

  const calculateNetSalary = () => {
    const basicSalary = parseFloat(formData.basicSalary) || 0;
    const allowances = calculateTotalAllowances();
    const deductions = calculateTotalDeductions();
    const payeAmount = (basicSalary + allowances) * (parseFloat(formData.payeRate) || 0) / 100;
    const pensionAmount = (basicSalary + allowances) * (parseFloat(formData.pensionRate) || 0) / 100;
    
    return basicSalary + allowances - deductions - payeAmount - pensionAmount;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <DollarSign className="h-6 w-6 mr-2" />
          {salaryStructure ? "Edit Salary Structure" : "Add New Salary Structure"}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Structure Name *
              </label>
              <input
                type="text"
                name="structureName"
                value={formData.structureName}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.structureName ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="e.g., Manager Level 1"
              />
              {errors.structureName && (
                <p className="text-red-500 text-sm mt-1">{errors.structureName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Basic Salary *
              </label>
              <input
                type="number"
                name="basicSalary"
                value={formData.basicSalary}
                onChange={handleChange}
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.basicSalary ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="0.00"
              />
              {errors.basicSalary && (
                <p className="text-red-500 text-sm mt-1">{errors.basicSalary}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Overtime Rate (Multiplier)
              </label>
              <input
                type="number"
                name="overtimeRate"
                value={formData.overtimeRate}
                onChange={handleChange}
                min="0"
                step="0.1"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.overtimeRate ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="1.5"
              />
              {errors.overtimeRate && (
                <p className="text-red-500 text-sm mt-1">{errors.overtimeRate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe this salary structure..."
            />
          </div>
        </div>

        {/* Allowances */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Allowances</h3>
            <button
              type="button"
              onClick={addAllowanceItem}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Allowance
            </button>
          </div>

          {allowanceItems.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No allowances added yet. Click "Add Allowance" to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {allowanceItems.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleAllowanceChange(index, "name", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Allowance name (e.g., Housing, Transport)"
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => handleAllowanceChange(index, "amount", e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => removeAllowanceItem(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deductions */}
        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Deductions</h3>
            <button
              type="button"
              onClick={addDeductionItem}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Deduction
            </button>
          </div>

          {deductionItems.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No deductions added yet. Click "Add Deduction" to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {deductionItems.map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleDeductionChange(index, "name", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Deduction name (e.g., Loan, Advance)"
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => handleDeductionChange(index, "amount", e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => removeDeductionItem(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tax Rates */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Rates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PAYE Rate (%)
              </label>
              <input
                type="number"
                name="payeRate"
                value={formData.payeRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.payeRate ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="0.00"
              />
              {errors.payeRate && (
                <p className="text-red-500 text-sm mt-1">{errors.payeRate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pension Rate (%)
              </label>
              <input
                type="number"
                name="pensionRate"
                value={formData.pensionRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.pensionRate ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="0.00"
              />
              {errors.pensionRate && (
                <p className="text-red-500 text-sm mt-1">{errors.pensionRate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Salary Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Info className="h-5 w-5 mr-2" />
            Salary Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex justify-between py-1">
                <span>Basic Salary:</span>
                <span className="font-medium">{formatCurrency(parseFloat(formData.basicSalary) || 0)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Total Allowances:</span>
                <span className="font-medium">{formatCurrency(calculateTotalAllowances())}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Gross Salary:</span>
                <span className="font-medium">{formatCurrency((parseFloat(formData.basicSalary) || 0) + calculateTotalAllowances())}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between py-1">
                <span>Total Deductions:</span>
                <span className="font-medium text-red-600">-{formatCurrency(calculateTotalDeductions())}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>PAYE Tax:</span>
                <span className="font-medium text-red-600">-{formatCurrency(((parseFloat(formData.basicSalary) || 0) + calculateTotalAllowances()) * (parseFloat(formData.payeRate) || 0) / 100)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Pension:</span>
                <span className="font-medium text-red-600">-{formatCurrency(((parseFloat(formData.basicSalary) || 0) + calculateTotalAllowances()) * (parseFloat(formData.pensionRate) || 0) / 100)}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-300 mt-3 pt-3">
            <div className="flex justify-between text-lg font-bold">
              <span>Net Salary:</span>
              <span className="text-green-600">{formatCurrency(calculateNetSalary())}</span>
            </div>
          </div>
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
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {salaryStructure ? "Update Structure" : "Create Structure"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SalaryStructureForm;