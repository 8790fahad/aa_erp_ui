import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Filter,
  MoreVertical,
  User,
  Building,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  ShieldCheck,
  CheckCircle,
  Upload,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatCurrency, calculateTotalEarnings, calculateTotalDeductions } from "../../../utils/numberUtils";
import BulkUploadModal from "./BulkUploadModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { _fetchApi } from "@/redux/actions/api";
import { useNavigate } from "react-router-dom";

const EmployeeList = ({
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  refreshTrigger,
}) => {
  const navigate = useNavigate();
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const primarySoft = `${primaryColor}18`;
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedForStatus, setSelectedForStatus] = useState(null);
  const [statusReason, setStatusReason] = useState("");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);


  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, [currentPage, searchTerm, selectedDepartment, selectedStatus, refreshTrigger]);

  const fetchEmployees = () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: currentPage,
      limit: 50, // Increase limit for local filtering
      facilityId: activeBusiness?.id || user?.facilityId,
    });

    _fetchApi(
      `/api/hr/employees?${params}`,
      (data) => {
        if (data.success) {
          setEmployees(data.data.employees);
          setTotalPages(data.data.pagination?.pages || 1);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching employees:", error);
        setLoading(false);
      }
    );
  };

  const fetchDepartments = () => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/get/department?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setDepartments(data.results);
        }
      },
      (err) => {
        console.error("Error fetching departments:", err);
      }
    );
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDepartment("");
    setSelectedStatus("");
    setCurrentPage(1);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      Active: "bg-emerald-50 text-emerald-600 border-emerald-200 ring-emerald-500/20",
      Inactive: "bg-gray-50 text-gray-600 border-gray-200 ring-gray-500/20",
      Terminated: "bg-rose-50 text-rose-600 border-rose-200 ring-rose-500/20",
      "On Leave": "bg-amber-50 text-amber-600 border-amber-200 ring-amber-500/20",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ring-1 ring-inset ${
          statusStyles[status] || "bg-gray-50 text-gray-600 border-gray-200"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === 'Active' ? 'bg-emerald-500' :
          status === 'On Leave' ? 'bg-amber-500' :
          status === 'Terminated' ? 'bg-rose-500' : 'bg-gray-400'
        }`}></span>
        {status}
      </span>
    );
  };

  useEffect(() => {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedDepartment) {
      filtered = filtered.filter(emp => emp.department?.id === selectedDepartment);
    }

    if (selectedStatus) {
      filtered = filtered.filter(emp => emp.status === selectedStatus);
    }

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, selectedDepartment, selectedStatus]);

  const handleRowClick = (id) => {
    navigate(`/app/admin/hr/employees/${id}`);
  };

  return (
    <div
      className="min-h-screen bg-gray-50/50 pb-12"
      style={{ ["--app-primary"]: primaryColor }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Employees Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your employee directory and their details</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center -space-x-2 mr-4">
               {/* Quick stats mini avatars */}
               <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-emerald-100 text-emerald-700 text-xs font-bold z-30" title="Active">
                 {employees.filter(e => e.status === "Active").length}
               </div>
               <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-amber-100 text-amber-700 text-xs font-bold z-20" title="On Leave">
                 {employees.filter(e => e.status === "On Leave").length}
               </div>
               <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-gray-100 text-gray-600 text-xs font-medium z-10 pl-2 pr-2" title="Total">
                 All
               </div>
            </div>
            <Button 
              onClick={onAddEmployee}
              className="text-white shadow-sm transition-all hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkUploadOpen(true)}
              className="shadow-sm transition-all hover:opacity-90"
              style={{
                borderColor: primaryColor,
                color: primaryColor,
                backgroundColor: primarySoft,
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-20">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent transition-all bg-gray-50 focus:bg-white"
              placeholder="Search by name, ID, or role..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] focus:bg-white transition-all cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.departmentName}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <Filter className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--app-primary)] focus:bg-white transition-all cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>
            
            {(searchTerm || selectedDepartment || selectedStatus) && (
              <button 
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Premium Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative z-10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Contact
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Department & Role
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Hired
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--app-primary)]"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-gray-500">
                      <User className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-lg font-medium text-gray-900">No employees found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or search term.</p>
                      <Button onClick={clearFilters} variant="outline" className="mt-4">
                        Clear all filters
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((person) => (
                    <tr 
                      key={person.id} 
                      className="hover:bg-[color:var(--app-primary)]/5 transition-colors cursor-pointer group"
                      onClick={() => handleRowClick(person.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {person.photoUrl ? (
                              <img className="h-10 w-10 rounded-full object-cover border border-gray-200" src={person.photoUrl} alt="" />
                            ) : (
                              <div
                                className="h-10 w-10 rounded-full border flex items-center justify-center"
                                style={{
                                  backgroundColor: primarySoft,
                                  borderColor: `${primaryColor}55`,
                                  color: primaryColor,
                                }}
                              >
                                <span className="font-semibold text-sm">
                                  {person.firstName?.charAt(0)}{person.lastName?.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900 group-hover:opacity-80 transition-colors">
                              {person.firstName} {person.lastName}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">#{person.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="flex flex-col space-y-1">
                          {person.user?.email && (
                            <div className="flex items-center text-xs text-gray-600">
                              <Mail className="h-3 w-3 mr-1.5 text-gray-400" />
                              {person.user.email}
                            </div>
                          )}
                          <div className="flex items-center text-xs text-gray-500">
                            <Phone className="h-3 w-3 mr-1.5 text-gray-400" />
                            {person.contactInfo || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{person.designation}</span>
                          <span className="text-xs text-gray-500 mt-0.5 flex items-center">
                            <Building className="h-3 w-3 mr-1" />
                            {person.department?.departmentName || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell text-sm text-gray-600">
                        {new Date(person.hireDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-end">
                          {getStatusBadge(person.status)}
                          {person.salaryStatus === 'Stopped' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              Salary Stopped
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-2 pr-2">
                                    <div className="flex flex-col items-center mr-2">
                                      <span className="text-[9px] font-bold text-slate-400 mb-1 uppercase">Salary</span>
                                      <Switch
                                        checked={person.salaryStatus !== 'Stopped'}
                                        onCheckedChange={() => {
                                          setSelectedForStatus(person);
                                          setStatusReason("");
                                          setShowStatusModal(true);
                                        }}
                                        className="data-[state=checked]:bg-emerald-500 scale-75"
                                      />
                                    </div>
                     
                                   <button 
                                     onClick={() => handleRowClick(person.id)}
                                     className="p-2 text-slate-400 hover:opacity-90 rounded-xl transition-all"
                                     title="View Details"
                                   >
                                    <Eye size={18} />
                                  </button>
                                  <button 
                                     onClick={() =>onEditEmployee(person)}
                                     className="p-2 text-slate-400 hover:opacity-90 rounded-xl transition-all"
                                     title="Edit Member"
                                   >
                                    <Edit size={18} />
                                  </button>
                                  {/* Delete button removed as per request for switch */}
                                </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer */}
          {!loading && filteredEmployees.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center justify-between">
              <div className="hidden sm:block">
                <p className="text-sm text-gray-500">
                  Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredEmployees.length}</span> of <span className="font-medium">{employees.length}</span> results
                </p>
              </div>
              <div className="flex-1 flex justify-between sm:justify-end gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={() => { fetchEmployees(); setBulkUploadOpen(false); }}
        title="Bulk Upload Employees"
        apiEndpoint="/api/hr/employees/bulk"
        payloadKey="employees"
        facilityId={activeBusiness?.id || user?.facilityId}
        createdBy={user?.id || user?.userId}
        primaryColor={activeBusiness?.primary_color || "#1a2d5e"}
        templateCols={[
          { key: "employeeId", label: "Employee ID", example: "EMP-0001" },
          { key: "firstName", label: "First Name", example: "John" },
          { key: "lastName", label: "Last Name", example: "Doe" },
          { key: "gender", label: "Gender", example: "Male" },
          { key: "contactInfo", label: "Contact Info", example: "08012345678" },
          { key: "dateOfBirth", label: "Date of Birth", example: "1990-01-15" },
          { key: "nationalId", label: "National ID", example: "NIN12345678" },
          { key: "address", label: "Address", example: "12 Main Street, Lagos" },
          { key: "departmentName", label: "Department", example: "Operations" },
          { key: "roleName", label: "Role", example: "Accountant" },
          { key: "hireDate", label: "Hire Date", example: "2024-01-01" },
          { key: "contractType", label: "Contract Type", example: "Permanent" },
          { key: "basicSalary", label: "Basic Salary", example: "150000" },
          { key: "appliesRent", label: "Rent Relief (Yes/No)", example: "Yes" },
          { key: "appliesNHF", label: "NHF (Yes/No)", example: "Yes" },
          { key: "appliesNHIS", label: "NHIS (Yes/No)", example: "Yes" },
          { key: "appliesPension", label: "Pension (Yes/No)", example: "Yes" },
          { key: "emergencyContact", label: "Emergency Contact", example: "Jane Doe" },
          { key: "emergencyPhone", label: "Emergency Phone", example: "08098765432" },
          { key: "nextOfKin", label: "Next of Kin", example: "Mary Doe" },
          { key: "nextOfKinPhone", label: "Next of Kin Phone", example: "08011112222" },
          { key: "bankCode", label: "Bank Code", example: "000121049" },
          { key: "bankAccount", label: "Account Number", example: "0123456789" },
          { key: "accountName", label: "Account Name", example: "John Doe" },
          { key: "accountType", label: "Account Type", example: "savings" },
        ]}
        mapRow={(r) => ({
          employeeId: r["Employee ID"] || r.employeeId || "",
          firstName: r["First Name"] || r.firstName || "",
          lastName: r["Last Name"] || r.lastName || "",
          gender: r["Gender"] || r.gender || "Male",
          contactInfo: r["Contact Info"] || r.contactInfo || r["Phone"] || "",
          dateOfBirth: r["Date of Birth"] || r.dateOfBirth || "",
          nationalId: r["National ID"] || r.nationalId || "",
          address: r["Address"] || r.address || "",
          departmentId: r["Department ID"] || r.departmentId || "",
          departmentName:
            r["Department"] ||
            r["Department Name"] ||
            r.departmentName ||
            r.department ||
            "",
          roleId: r["Role ID"] || r.roleId || "",
          roleName:
            r["Role"] ||
            r["Role Name"] ||
            r["Role / Designation"] ||
            r.roleName ||
            r.role ||
            r.designation ||
            "",
          designation: r["Role / Designation"] || r.designation || "",
          hireDate: r["Hire Date"] || r.hireDate || "",
          contractType: r["Contract Type"] || r.contractType || "Permanent",
          basicSalary: r["Basic Salary"] || r.basicSalary || "",
          appliesRent: r["Rent Relief (Yes/No)"] || r.appliesRent || "Yes",
          appliesNHF: r["NHF (Yes/No)"] || r.appliesNHF || "Yes",
          appliesNHIS: r["NHIS (Yes/No)"] || r.appliesNHIS || "Yes",
          appliesPension: r["Pension (Yes/No)"] || r.appliesPension || "Yes",
          emergencyContact: r["Emergency Contact"] || r.emergencyContact || "",
          emergencyPhone: r["Emergency Phone"] || r.emergencyPhone || "",
          nextOfKin: r["Next of Kin"] || r.nextOfKin || "",
          nextOfKinPhone: r["Next of Kin Phone"] || r.nextOfKinPhone || "",
          bankCode: r["Bank Code"] || r.bankCode || "",
          bankAccount:
            r["Account Number"] || r.bankAccount || "",
          accountName: r["Account Name"] || r.accountName || "",
          accountType: r["Account Type"] || r.accountType || "",
        })}
      />

      {/* STATUS CHANGE MODAL */}
      {showStatusModal && selectedForStatus && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]"
          style={{ ["--app-primary"]: primaryColor }}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div
              className="p-6 text-white"
              style={{
                background:
                  selectedForStatus.salaryStatus !== "Stopped"
                    ? "#dc2626"
                    : `linear-gradient(to right, ${primaryColor}, ${primaryColor}dd)`,
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black italic uppercase tracking-tight">
                  {selectedForStatus.salaryStatus !== 'Stopped' ? 'Stop Salary' : 'Restore Salary'}
                </h3>
                <button onClick={() => setShowStatusModal(false)} className="p-1 hover:bg-white/20 rounded-full transition-all">
                   <X size={20} />
                </button>
              </div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest leading-none">
                {selectedForStatus.firstName} {selectedForStatus.lastName} — {selectedForStatus.employeeId}
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Current Monthly Compensation</p>
                 {selectedForStatus.salaryStructure ? (
                   <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                         <span className="text-xs font-bold text-slate-600">Basic Monthly Pay</span>
                         <span className="text-sm font-black text-slate-900">{formatCurrency(selectedForStatus.salaryStructure.basicSalary)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                         <span className="text-xs font-bold text-slate-600">Total Allowances</span>
                         <span className="text-sm font-black text-emerald-600">+{formatCurrency(calculateTotalEarnings(selectedForStatus.salaryStructure.allowances, 0))}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                         <span className="text-xs font-bold text-slate-600">Total Deductions</span>
                         <span className="text-sm font-black text-red-600">-{formatCurrency(calculateTotalDeductions(selectedForStatus.salaryStructure.deductions, selectedForStatus.salaryStructure.basicSalary, selectedForStatus.salaryStructure.payeRate, selectedForStatus.salaryStructure.pensionRate))}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                         <span className="text-xs font-black text-slate-900 uppercase">Estimated Net Pay</span>
                         <span className="text-lg font-black">
                           {formatCurrency(
                             calculateTotalEarnings(selectedForStatus.salaryStructure.allowances, selectedForStatus.salaryStructure.basicSalary) - 
                             calculateTotalDeductions(selectedForStatus.salaryStructure.deductions, selectedForStatus.salaryStructure.basicSalary, selectedForStatus.salaryStructure.payeRate, selectedForStatus.salaryStructure.pensionRate)
                           )}
                         </span>
                      </div>
                   </div>
                 ) : (
                   <div className="py-4 text-center">
                      <p className="text-xs font-bold text-slate-400 italic">No salary set yet</p>
                   </div>
                 )}
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-white relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <ShieldCheck size={40} />
                   </div>
                   <h4
                     className="text-xs font-black italic uppercase tracking-widest mb-1 leading-none"
                     style={{ color: primaryColor }}
                   >
                     Security Confirmation
                   </h4>
                   <p className="text-[10px] font-medium text-slate-400">
                     Are you certain you want to {selectedForStatus.salaryStatus !== 'Stopped' ? 'STOP' : 'START'} salary processing for this employee? This action takes effect from the next payroll cycle.
                   </p>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1">Reason for {selectedForStatus.salaryStatus !== 'Stopped' ? 'Stopping' : 'Restoring'} Salary <span className="text-red-500">*</span></label>
                   <textarea
                     value={statusReason}
                     onChange={(e) => setStatusReason(e.target.value)}
                     className="w-full text-sm border-slate-200 rounded-xl focus:ring-[color:var(--app-primary)] focus:border-[color:var(--app-primary)] p-3"
                     rows="3"
                     placeholder="Please provide a detailed reason..."
                     required
                   ></textarea>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-xl text-xs font-bold border-slate-200"
                onClick={() => setShowStatusModal(false)}
              >
                Go Back
              </Button>
              <Button 
                className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg text-white ${selectedForStatus.salaryStatus !== 'Stopped' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'hover:brightness-95'}`}
                style={
                  selectedForStatus.salaryStatus === "Stopped"
                    ? { backgroundColor: primaryColor, borderColor: primaryColor }
                    : undefined
                }
                disabled={!statusReason.trim()}
                onClick={async () => {
                  try {
                    const newStatus = selectedForStatus.salaryStatus !== 'Stopped' ? 'Stopped' : 'Active';
                    const response = await fetch(`/api/hr/employees/${selectedForStatus.id}/salary-status`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json", Authorization: localStorage.getItem("@@__token") || "" },
                      body: JSON.stringify({
                        facilityId: activeBusiness?.id || user?.facilityId,
                        salaryStatus: newStatus,
                        reason: statusReason,
                        performedBy: user?.id || user?.userId
                      }),
                    });
                    const data = await response.json();
                    if (data.success) {
                      toast.success(`Salary ${newStatus === 'Stopped' ? 'stopped' : 'restored'} successfully`);
                      fetchEmployees();
                      setShowStatusModal(false);
                      setStatusReason("");
                    } else {
                      toast.error(data.message || "Failed to update salary status");
                    }
                  } catch (e) {
                    toast.error("An error occurred");
                  }
                }}
              >
                {selectedForStatus.salaryStatus !== 'Stopped' ? 'Stop Salary' : 'Restore Salary'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;