import React from "react";
import { X, DollarSign, Users, Calendar, Edit, Trash2 } from "lucide-react";
import { safeParseFloat } from "../../../utils/numberUtils";

const SalaryStructureView = ({
  salaryStructure,
  onEdit,
  onDelete,
  onClose,
}) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium";
    if (status === "Active") {
      return `${baseClasses} bg-green-100 text-green-800`;
    }
    return `${baseClasses} bg-gray-100 text-gray-800`;
  };

  const calculateTotalAllowances = () => {
    return Object.values(salaryStructure.allowances || {}).reduce(
      (total, amount) => total + parseFloat(amount),
      0
    );
  };

  const calculateTotalDeductions = () => {
    return Object.values(salaryStructure.deductions || {}).reduce(
      (total, amount) => total + parseFloat(amount),
      0
    );
  };

  const calculateNetSalary = () => {
    // Safely parse basicSalary using utility function
    const basicSalary = safeParseFloat(salaryStructure.basicSalary);
    const allowances = calculateTotalAllowances();
    const deductions = calculateTotalDeductions();
    const payeAmount = (basicSalary + allowances) * (safeParseFloat(salaryStructure.payeRate) / 100);
    const pensionAmount = (basicSalary + allowances) * (safeParseFloat(salaryStructure.pensionRate) / 100);
    
    return basicSalary + allowances - deductions - payeAmount - pensionAmount;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <DollarSign className="h-6 w-6 mr-2" />
          {salaryStructure.structureName}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(salaryStructure)}
            className="text-green-600 hover:text-green-800 p-2"
            title="Edit Structure"
          >
            <Edit className="h-5 w-5" />
          </button>
          <button
            onClick={() => onDelete(salaryStructure)}
            className="text-red-600 hover:text-red-800 p-2"
            title="Deactivate Structure"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Structure Code</label>
              <p className="text-lg font-medium text-gray-900">{salaryStructure.structureCode}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
              <span className={getStatusBadge(salaryStructure.status)}>
                {salaryStructure.status}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Basic Salary</label>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(salaryStructure.basicSalary)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Overtime Rate</label>
              <p className="text-lg font-medium text-gray-900">{salaryStructure.overtimeRate}x</p>
            </div>
          </div>
          {salaryStructure.description && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
              <p className="text-gray-900">{salaryStructure.description}</p>
            </div>
          )}
        </div>

        {/* Allowances */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Allowances</h3>
          {Object.keys(salaryStructure.allowances || {}).length === 0 ? (
            <p className="text-gray-500 italic">No allowances configured</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(salaryStructure.allowances).map(([name, amount]) => (
                <div key={name} className="flex justify-between items-center py-2 px-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-gray-900">{name}</span>
                  <span className="font-bold text-green-600">{formatCurrency(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 px-3 bg-green-100 rounded-lg border-t border-green-200">
                <span className="font-bold text-gray-900">Total Allowances</span>
                <span className="font-bold text-green-600">{formatCurrency(calculateTotalAllowances())}</span>
              </div>
            </div>
          )}
        </div>

        {/* Deductions */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Deductions</h3>
          {Object.keys(salaryStructure.deductions || {}).length === 0 ? (
            <p className="text-gray-500 italic">No deductions configured</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(salaryStructure.deductions).map(([name, amount]) => (
                <div key={name} className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg">
                  <span className="font-medium text-gray-900">{name}</span>
                  <span className="font-bold text-red-600">{formatCurrency(amount)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 px-3 bg-red-100 rounded-lg border-t border-red-200">
                <span className="font-bold text-gray-900">Total Deductions</span>
                <span className="font-bold text-red-600">{formatCurrency(calculateTotalDeductions())}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tax Rates */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Rates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-600 mb-1">PAYE Rate</label>
              <p className="text-2xl font-bold text-blue-600">{salaryStructure.payeRate}%</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-600 mb-1">Pension Rate</label>
              <p className="text-2xl font-bold text-purple-600">{salaryStructure.pensionRate}%</p>
            </div>
          </div>
        </div>

        {/* Salary Summary */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">Basic Salary</span>
              <span className="font-medium">{formatCurrency(salaryStructure.basicSalary)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">Total Allowances</span>
              <span className="font-medium text-green-600">+{formatCurrency(calculateTotalAllowances())}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t border-gray-300 pt-2">
              <span className="font-semibold text-gray-900">Gross Salary</span>
              <span className="font-bold text-gray-900">{formatCurrency(salaryStructure.basicSalary + calculateTotalAllowances())}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">Total Deductions</span>
              <span className="font-medium text-red-600">-{formatCurrency(calculateTotalDeductions())}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">PAYE Tax</span>
              <span className="font-medium text-red-600">-{formatCurrency((salaryStructure.basicSalary + calculateTotalAllowances()) * (salaryStructure.payeRate || 0) / 100)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-700">Pension</span>
              <span className="font-medium text-red-600">-{formatCurrency((salaryStructure.basicSalary + calculateTotalAllowances()) * (salaryStructure.pensionRate || 0) / 100)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-t-2 border-gray-400 pt-3">
              <span className="text-xl font-bold text-gray-900">Net Salary</span>
              <span className="text-2xl font-bold text-green-600">{formatCurrency(calculateNetSalary())}</span>
            </div>
          </div>
        </div>

        {/* Assigned Employees */}
        {salaryStructure.employees && salaryStructure.employees.length > 0 && (
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Assigned Employees ({salaryStructure.employees.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {salaryStructure.employees.map((employee) => (
                <div key={employee.id} className="bg-blue-50 p-3 rounded-lg">
                  <div className="font-medium text-gray-900">
                    {employee.firstName} {employee.lastName}
                  </div>
                  <div className="text-sm text-gray-600">
                    {employee.employeeId} • {employee.designation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              Created: {formatDate(salaryStructure.createdAt)}
            </div>
            {salaryStructure.updatedAt && (
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Updated: {formatDate(salaryStructure.updatedAt)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryStructureView;