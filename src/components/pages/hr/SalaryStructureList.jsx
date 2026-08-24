import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  Users,
  TrendingUp,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SalaryStructureList = ({
  onAddNew,
  onEdit,
  onView,
  onDelete,
}) => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    totalStructures: 0,
    activeStructures: 0,
    inactiveStructures: 0,
    totalEmployees: 0,
  });

  useEffect(() => {
    fetchSalaryStructures();
    fetchSummary();
  }, [currentPage, searchTerm, selectedStatus]);

  const fetchSalaryStructures = () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: currentPage,
      limit: 10,
      facilityId: activeBusiness?.id || user?.facilityId,
      ...(searchTerm && { search: searchTerm }),
      ...(selectedStatus && { status: selectedStatus }),
    });

    _fetchApi(
      `/api/hr/salary-structures?${params}`,
      (data) => {
        if (data.success) {
          setSalaryStructures(data.data.salaryStructures);
          setTotalPages(data.data.pagination.pages);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching salary structures:", error);
        setLoading(false);
      }
    );
  };

  const fetchSummary = () => {
    const facilityId = activeBusiness?.id || user?.facilityId;
    _fetchApi(
      `/api/hr/salary-structures/summary?facilityId=${facilityId}`,
      (data) => {
        if (data.success) {
          setSummary(data.data);
        }
      },
      (error) => {
        console.error("Error fetching summary:", error);
      }
    );
  };

  const handleDelete = async (structure) => {
    if (
      window.confirm(
        `Are you sure you want to deactivate "${structure.structureName}"? This action cannot be undone.`
      )
    ) {
      try {
        const facilityId = activeBusiness?.id || user?.facilityId;
        const response = await fetch(`/api/hr/salary-structures/${structure.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            facilityId: facilityId,
            updatedBy: user?.id,
          }),
        });

        const data = await response.json();

        if (data.success) {
          fetchSalaryStructures();
          fetchSummary();
          toast.success("Salary structure deactivated successfully");
        } else {
          toast.error(data.message || "Error deactivating salary structure");
        }
      } catch (error) {
        console.error("Error deactivating salary structure:", error);
        toast.error("Error deactivating salary structure");
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    if (status === "Active") {
      return `${baseClasses} bg-green-100 text-green-800`;
    }
    return `${baseClasses} bg-gray-100 text-gray-800`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Structures</h1>
          <p className="text-gray-600">Manage employee salary structures and compensation</p>
        </div>
        <Button onClick={onAddNew} className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]">
          <Plus className="h-4 w-4 mr-2" />
          Add New Structure
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Structures</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalStructures}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{summary.activeStructures}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Filter className="h-5 w-5 text-gray-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-gray-900">{summary.inactiveStructures}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Assigned Employees</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalEmployees}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search salary structures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)]"
              />
            </div>
          </div>
          <div className="md:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--aa-accent)] bg-white"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--aa-accent)] mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading salary structures...</p>
          </div>
        ) : salaryStructures.length === 0 ? (
          <div className="p-8 text-center">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No salary structures found</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first salary structure.</p>
            <Button onClick={onAddNew} className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)]">
              <Plus className="h-4 w-4 mr-2" />
              Add Salary Structure
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Structure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Basic Salary
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allowances
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deductions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryStructures.map((structure) => (
                  <tr key={structure.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {structure.structureName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {structure.structureCode}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(structure.basicSalary)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {Object.keys(structure.allowances || {}).length} items
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {Object.keys(structure.deductions || {}).length} items
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {structure.employees?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(structure.status)}>
                        {structure.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => onView(structure)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onEdit(structure)}
                          className="text-green-600 hover:text-green-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(structure)}
                          className="text-red-600 hover:text-red-900"
                          title="Deactivate"
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
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryStructureList;