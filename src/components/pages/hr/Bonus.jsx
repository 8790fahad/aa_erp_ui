import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  Gift,
  Calendar,
  User,
  X,
  MoreVertical,
  Upload,
} from "lucide-react";
import CustomButton from "@/common/Custom/CustomButton";
import { safeParseFloat, formatNumber } from "../../../utils/numberUtils";
import { toast } from "sonner";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomTypeahead from "@/common/Custom/Customtypeahead";
import SearchEmployeeInput from "./SearchEmployeeInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Label } from "reactstrap";
import BulkUploadModal from "./BulkUploadModal";
import { getAaBrandColors } from "@/lib/aaBrand";

const Bonus = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    headerGradient: brandHeaderGradient,
    brandButtonStyle: brandBtn,
    appColorStyle: brandAppStyle,
  } = getAaBrandColors();
  const appColorStyle = brandAppStyle;

  const [bonuses, setBonuses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedBonus, setSelectedBonus] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [filteredBonuses, setFilteredBonuses] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSalaryStructure, setEmployeeSalaryStructure] = useState(null);
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    employeeName: "",
    bonusType: "performance", // Can be predefined or custom value
    amount: "",
    calculationType: "fixed", // fixed or percentage
    reason: "",
    bonusMonth: "",
    bonusYear: "",
    bonusDate: "", // Will be constructed from month and year
    status: "pending", // pending, approved, paid
    approvedBy: "",
    approvedAt: "",
    description: "",
    accountCode: "",
    isTaxable: true,
  });

  // Fetch chart of accounts
  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setChartOfAccount(resp.results);
        }
      },
      (err) => {
        console.error("API Error:", err);
      }
    );
  }, [activeBusiness?.business_name]);

  useEffect(() => {
    if (facilityId) {
      fetchBonuses();
      fetchRoles();
    }
    if (activeBusiness?.business_name) {
      getChartOfAccount();
    }
  }, [facilityId, activeBusiness?.business_name, getChartOfAccount]);

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

  const fetchEmployeeSalaryStructure = async (salaryStructureId) => {
    if (!salaryStructureId || !facilityId) {
      setEmployeeSalaryStructure(null);
      return;
    }

    try {
      const response = await fetch(
        `/api/hr/salary-structures/${salaryStructureId}?facilityId=${facilityId}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        setEmployeeSalaryStructure(data.data);
      } else {
        console.error("Error fetching salary structure:", data.message);
        setEmployeeSalaryStructure(null);
      }
    } catch (error) {
      console.error("Error fetching salary structure:", error);
      setEmployeeSalaryStructure(null);
    }
  };

  const fetchBonuses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/bonuses?facilityId=${facilityId}`);
      const data = await response.json();

      if (data.success) {
        setBonuses(data.data);
      } else {
        console.error("Error fetching bonuses:", data.message);
        setBonuses([]);
      }
    } catch (error) {
      console.error("Error fetching bonuses:", error);
      setBonuses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBonus = () => {
    setSelectedBonus(null);
    setSelectedEmployee(null);
    setSelectedAccount(null);
    const currentDate = new Date();
    setFormData({
      employeeId: "",
      employeeName: "",
      bonusType: "performance",
      amount: "",
      calculationType: "fixed",
      reason: "",
      bonusMonth: (currentDate.getMonth() + 1).toString().padStart(2, "0"),
      bonusYear: currentDate.getFullYear().toString(),
      bonusDate: "",
      status: "pending",
      approvedBy: "",
      approvedAt: "",
      description: "",
      accountCode: "",
      isTaxable: true,
    });
    setShowForm(true);
  };

  const handleEditBonus = (bonus) => {
    setSelectedBonus(bonus);
    const bonusDate = bonus.bonusDate ? new Date(bonus.bonusDate) : new Date();

    // No need to check for custom types anymore since we'll use combobox

    // Find the actual employee object from the employees list
    // We need to fetch employees first if not already loaded
    const findEmployeeForBonus = async () => {
      try {
        const response = await fetch(
          `/api/hr/employees?facilityId=${facilityId}`
        );
        const data = await response.json();

        if (data.success && Array.isArray(data.data?.employees)) {
          const employeeData = data.data.employees;
          const actualEmployee = employeeData.find(
            (emp) =>
              emp.id === bonus.employeeId || emp.employeeId === bonus.employeeId
          );

          if (actualEmployee) {
            setSelectedEmployee(actualEmployee);
          } else {
            // Fallback: create a mock employee if not found
            const mockEmployee = {
              id: bonus.employeeId || "",
              firstName: bonus.employeeName?.split(" ")[0] || "",
              lastName: bonus.employeeName?.split(" ").slice(1).join(" ") || "",
              employeeId: bonus.employeeId || "",
            };
            setSelectedEmployee(mockEmployee);
          }
        }
      } catch (error) {
        console.error("Error fetching employee for bonus edit:", error);
        // Fallback: create a mock employee
        const mockEmployee = {
          id: bonus.employeeId || "",
          firstName: bonus.employeeName?.split(" ")[0] || "",
          lastName: bonus.employeeName?.split(" ").slice(1).join(" ") || "",
          employeeId: bonus.employeeId || "",
        };
        setSelectedEmployee(mockEmployee);
      }
    };

    findEmployeeForBonus();

    // Find and set the selected account if accountCode exists
    if (bonus.accountCode) {
      const account = chartOfAccount.find(
        (acc) => acc.head === bonus.accountCode
      );
      setSelectedAccount(account || null);
    } else {
      setSelectedAccount(null);
    }

    setFormData({
      employeeId: bonus.employeeId || "",
      employeeName: bonus.employeeName || "",
      bonusType: bonus.bonusType || "performance",
      amount: bonus.amount || "",
      calculationType: bonus.calculationType || "fixed",
      reason: bonus.reason || "",
      bonusMonth: bonus.bonusDate
        ? (bonusDate.getMonth() + 1).toString().padStart(2, "0")
        : (new Date().getMonth() + 1).toString().padStart(2, "0"),
      bonusYear: bonus.bonusDate
        ? bonusDate.getFullYear().toString()
        : new Date().getFullYear().toString(),
      bonusDate: bonus.bonusDate || "",
      status: bonus.status || "pending",
      approvedBy: bonus.approvedBy || "",
      approvedAt: bonus.approvedAt || "",
      description: bonus.description || "",
      accountCode: bonus.accountCode || "",
      isTaxable: bonus.isTaxable !== false && bonus.isTaxable !== 0,
    });
    setShowForm(true);
  };

  const handleViewBonus = (bonus) => {
    setSelectedBonus(bonus);
    // TODO: Implement view modal
    console.log("View bonus:", bonus);
  };

  const handleDeleteBonus = async (bonus) => {
    if (
      window.confirm(
        `Are you sure you want to delete bonus for ${bonus.employeeName}?`
      )
    ) {
      try {
        const response = await fetch(`/api/hr/bonuses/${bonus.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            facilityId: facilityId,
            updatedBy: user?.id || user?.userId || "",
          }),
        });

        const data = await response.json();

        if (data.success) {
          fetchBonuses();
          toast.success("Bonus deleted successfully");
        } else {
          toast.error(data.message || "Error deleting bonus");
        }
      } catch (error) {
        console.error("Error deleting bonus:", error);
        toast.error("Error deleting bonus");
      }
    }
  };

  const handleApproveBonus = async (bonus) => {
    if (window.confirm(`Approve bonus for ${bonus.employeeName}?`)) {
      try {
        const response = await fetch(
          `/api/hr/bonuses/${bonus.id}/approve?facilityId=${facilityId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "approved",
              approvedBy: user?.id || user?.userId || "",
              approvedAt: new Date().toISOString(),
            }),
          }
        );

        const data = await response.json();

        if (data.success) {
          fetchBonuses();
          toast.success("Bonus approved successfully");
        } else {
          toast.error(data.message || "Error approving bonus");
        }
      } catch (error) {
        console.error("Error approving bonus:", error);
        toast.error("Error approving bonus");
      }
    }
  };

  const handleSaveBonus = async (e) => {
    e.preventDefault();

    if (!formData.accountCode?.trim()) {
      toast.error("Account Code is required");
      return;
    }

    if (!formData.bonusMonth || !formData.bonusYear) {
      toast.error("Bonus Month and Bonus Year are required");
      return;
    }

    const selectedPeriod = new Date(
      Number(formData.bonusYear),
      Number(formData.bonusMonth) - 1,
      1,
    );
    const currentPeriod = new Date();
    currentPeriod.setDate(1);
    currentPeriod.setHours(0, 0, 0, 0);

    // New bonuses must be current/future. Edited bonuses can keep an existing past period,
    // but cannot be changed to a past period.
    const isCreate = !selectedBonus;
    const originalDate = selectedBonus?.bonusDate
      ? new Date(selectedBonus.bonusDate)
      : null;
    const originalPeriod = originalDate
      ? new Date(originalDate.getFullYear(), originalDate.getMonth(), 1)
      : null;
    const periodChanged =
      !originalPeriod ||
      originalPeriod.getFullYear() !== selectedPeriod.getFullYear() ||
      originalPeriod.getMonth() !== selectedPeriod.getMonth();

    if ((isCreate || periodChanged) && selectedPeriod < currentPeriod) {
      toast.error("Bonus Month and Bonus Year must be current or future");
      return;
    }

    try {
      const url = selectedBonus
        ? `/api/hr/bonuses/${selectedBonus.id}`
        : "/api/hr/bonuses";

      const method = selectedBonus ? "PUT" : "POST";

      // Construct bonusDate from month and year
      const constructedBonusDate = `${formData.bonusYear}-${formData.bonusMonth}-01`;

      const requestData = {
        employeeId: formData.employeeId,
        employeeName: formData.employeeName,
        bonusType: formData.bonusType,
        amount: formData.amount,
        calculationType: formData.calculationType,
        reason: formData.reason,
        bonusDate: constructedBonusDate,
        description: formData.description,
        accountCode: formData.accountCode,
        isTaxable: formData.isTaxable !== false,
        facilityId: facilityId,
        createdBy: user?.id || user?.userId || "",
        updatedBy: user?.id || user?.userId || "",
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (data.success) {
        setShowForm(false);
        setSelectedBonus(null);
        fetchBonuses();
        toast.success(
          selectedBonus
            ? "Bonus updated successfully"
            : "Bonus created successfully"
        );
      } else {
        toast.error(data.message || "Error saving bonus");
      }
    } catch (error) {
      console.error("Error saving bonus:", error);
      toast.error("Error saving bonus");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      // Keep month/year combination current-or-future when either changes
      if (name === "bonusYear" || name === "bonusMonth") {
        const year = Number(name === "bonusYear" ? value : next.bonusYear);
        const month = Number(name === "bonusMonth" ? value : next.bonusMonth);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (year === currentYear && month && month < currentMonth) {
          next.bonusMonth = String(currentMonth).padStart(2, "0");
        }
        if (year && year < currentYear) {
          next.bonusYear = String(currentYear);
          next.bonusMonth = String(currentMonth).padStart(2, "0");
        }
      }

      return next;
    });
  };

  // Filter bonuses based on search
  useEffect(() => {
    let filtered = Array.isArray(bonuses) ? bonuses : [];

    if (searchTerm) {
      filtered = filtered.filter(
        (bonus) =>
          bonus.employeeName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          bonus.bonusType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bonus.reason?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBonuses(filtered);
  }, [bonuses, searchTerm]);

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "paid":
        return "bg-[color:var(--app-primary)]/15 text-[color:var(--app-primary)]";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getBonusTypeColor = (type) => {
    switch (type) {
      case "performance":
        return "bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)]";
      case "holiday":
        return "bg-red-100 text-red-800";
      case "project":
        return "bg-[color:var(--app-primary)]/15 text-[color:var(--app-primary)]";
      case "annual":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const templateDate = new Date();
  const templateMonth = String(templateDate.getMonth() + 1).padStart(2, "0");
  const templateYear = String(templateDate.getFullYear());

  // Define columns for CustomTable1
  const columns = [
    {
      value: "employeeName",
      title: "Employee",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {item.employeeName}
          </div>
          <div className="text-sm text-gray-500">{item.reason}</div>
        </div>
      ),
    },
    {
      value: "bonusType",
      title: "Bonus Type",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getBonusTypeColor(
              item.bonusType
            )}`}
          >
            {item.bonusType.charAt(0).toUpperCase() + item.bonusType.slice(1)}
          </span>
        </div>
      ),
    },
    {
      value: "isTaxable",
      title: "Taxable",
      custom: true,
      className: "text-center",
      component: (item) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            item.isTaxable !== false && item.isTaxable !== 0
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {item.isTaxable !== false && item.isTaxable !== 0 ? "Taxable" : "Non-taxable"}
        </span>
      ),
    },
    {
      value: "amount",
      title: "Amount",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm text-gray-900">
          {item.calculationType === "percentage"
            ? `${item.amount}%`
            : `₦${formatNumber(safeParseFloat(item.amount), 2, 2)}`}
        </div>
      ),
    },
    {
      value: "bonusDate",
      title: "Date",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">
            {new Date(item.bonusDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </span>
        </div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
              item.status
            )}`}
          >
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
        </div>
      ),
    },
    {
      value: "action",
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => handleViewBonus(item)}>
                <Eye className="h-4 w-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEditBonus(item)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {item.status === "pending" && (
                <DropdownMenuItem onClick={() => handleApproveBonus(item)}>
                  <Gift className="h-4 w-4 mr-2" />
                  Approve
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteBonus(item)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6" style={appColorStyle}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--app-primary)]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={appColorStyle}>
      <div className="max-w-7xl mx-auto">
        <div className="p-6 px-1">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Staff Bonuses</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Total :{" "}
                <span className="font-semibold text-gray-900">
                  {Array.isArray(bonuses) ? bonuses.length : 0}
                </span>
              </span>
              <span className="text-sm text-gray-600">
                Pending:{" "}
                <span className="font-semibold text-yellow-600">
                  {Array.isArray(bonuses)
                    ? bonuses.filter((item) => item.status === "pending").length
                    : 0}
                </span>
              </span>
              <span className="text-sm text-gray-600">
                Approved:{" "}
                <span className="font-semibold text-green-600">
                  {Array.isArray(bonuses)
                    ? bonuses.filter((item) => item.status === "approved")
                        .length
                    : 0}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row align-items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search bonuses by employee, type, reason..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <CustomButton onClick={() => setBulkUploadOpen(true)} mb="0" variant="outline">
              <Upload className="w-5 h-5" />
              Bulk Upload
            </CustomButton>
            <CustomButton onClick={handleAddBonus} mb="0">
              <Plus className="w-5 h-5" />
              Add New Bonus
            </CustomButton>
          </div>

          <div className="overflow-x-auto">
            <CustomTable1
              data={filteredBonuses}
              fields={columns}
              loading={loading}
              message="No bonuses found"
            />
          </div>
        </div>
      </div>

      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={() => {
          fetchBonuses();
          setBulkUploadOpen(false);
        }}
        title="Bulk Upload Bonuses"
        apiEndpoint="/api/hr/bonuses/bulk"
        payloadKey="bonuses"
        facilityId={facilityId}
        createdBy={user?.id || user?.userId}
        primaryColor={primaryColor}
        templateCols={[
          {
            key: "employeeId",
            label: "Employee ID",
            example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
          },
          { key: "bonusMonth", label: "Bonus Month", example: templateMonth },
          { key: "bonusYear", label: "Bonus Year", example: templateYear },
          { key: "bonusType", label: "Bonus Type", example: "performance" },
          { key: "calculationType", label: "Calculation Type", example: "fixed" },
          { key: "amount", label: "Value", example: "30000" },
          { key: "reason", label: "Reason", example: "Outstanding performance" },
          { key: "accountCode", label: "Accounting Ledger", example: "5100" },
          { key: "isTaxable", label: "Taxable (Yes/No)", example: "Yes" },
          { key: "description", label: "Description", example: "Q4 performance bonus" },
        ]}
        exampleRows={[
          {
            employeeId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            bonusMonth: templateMonth,
            bonusYear: templateYear,
            bonusType: "performance",
            calculationType: "fixed",
            amount: "30000",
            reason: "Outstanding performance",
            accountCode: "5100",
            isTaxable: "Yes",
            description: "Q4 performance bonus",
          },
          {
            employeeId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            bonusMonth: templateMonth,
            bonusYear: templateYear,
            bonusType: "holiday",
            calculationType: "percentage",
            amount: "10",
            reason: "Holiday bonus",
            accountCode: "5100",
            isTaxable: "Yes",
            description: "End of year holiday bonus",
          },
        ]}
        mapRow={(r) => ({
          employeeId: r["Employee ID"] || r.employeeId || "",
          bonusMonth: r["Bonus Month"] || r.bonusMonth || "",
          bonusYear: r["Bonus Year"] || r.bonusYear || "",
          bonusType: r["Bonus Type"] || r.bonusType || "",
          calculationType:
            r["Calculation Type"] || r.calculationType || "fixed",
          amount: r["Value"] || r["Amount"] || r.amount || "",
          reason: r["Reason"] || r.reason || "",
          accountCode:
            (() => {
              const raw =
                r["Accounting Ledger"] || r["Account Code"] || r.accountCode || "";
              const s = String(raw).trim();
              if (!s) return "";
              const paren = s.match(/\(([^)]+)\)\s*$/);
              return paren ? paren[1].trim() : s;
            })(),
          isTaxable: r["Taxable (Yes/No)"] || r["Taxable"] || r.isTaxable || "Yes",
          description: r["Description"] || r.description || "",
        })}
      />

      {/* Bonus Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[color:var(--app-primary)] to-[color:var(--app-secondary)] text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    {selectedBonus ? "Edit Bonus" : "Add Bonus"}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">
                    {selectedBonus
                      ? "Update bonus details"
                      : "Create a new bonus for an employee"}
                  </p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <form
              onSubmit={handleSaveBonus}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {/* Bonus Date - Month and Year Selection (First in form) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bonus Month *
                      </label>
                      <select
                        name="bonusMonth"
                        value={formData.bonusMonth}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent bg-white"
                      >
                        <option value="">Select Month</option>
                        {[
                          { value: "01", label: "January" },
                          { value: "02", label: "February" },
                          { value: "03", label: "March" },
                          { value: "04", label: "April" },
                          { value: "05", label: "May" },
                          { value: "06", label: "June" },
                          { value: "07", label: "July" },
                          { value: "08", label: "August" },
                          { value: "09", label: "September" },
                          { value: "10", label: "October" },
                          { value: "11", label: "November" },
                          { value: "12", label: "December" },
                        ].map((m) => {
                          const year = Number(formData.bonusYear) || new Date().getFullYear();
                          const currentYear = new Date().getFullYear();
                          const currentMonth = new Date().getMonth() + 1;
                          const monthNum = Number(m.value);
                          const disabled =
                            (year < currentYear ||
                              (year === currentYear && monthNum < currentMonth)) &&
                            m.value !== formData.bonusMonth;
                          return (
                            <option key={m.value} value={m.value} disabled={disabled}>
                              {m.label}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Only current or future months are allowed
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bonus Year *
                      </label>
                      <select
                        name="bonusYear"
                        value={formData.bonusYear}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent bg-white"
                      >
                        <option value="">Select Year</option>
                        {Array.from({ length: 6 }, (_, i) => {
                          const year = new Date().getFullYear() + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Employee Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee *
                    </label>
                    <SearchEmployeeInput
                      value={selectedEmployee}
                      onChange={(employee) => {
                        if (employee) {
                          setSelectedEmployee(employee);
                          setFormData((prev) => ({
                            ...prev,
                            employeeId: employee.id,
                            employeeName: `${employee.firstName} ${employee.lastName}`,
                          }));
                          // Fetch employee salary structure for percentage calculations
                          fetchEmployeeSalaryStructure(
                            employee.salaryStructureId
                          );
                        } else {
                          // Handle clearing employee selection
                          setSelectedEmployee(null);
                          setEmployeeSalaryStructure(null);
                          setFormData((prev) => ({
                            ...prev,
                            employeeId: "",
                            employeeName: "",
                          }));
                        }
                      }}
                      placeholder="Search employees by name or ID..."
                      edge={true}
                    />
                  </div>
                </div>

                {/* Bonus Type and Calculation Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bonus Type *
                    </label>
                    <CustomTypeahead
                      options={[
                        { value: "performance", label: "Performance Bonus" },
                        { value: "holiday", label: "Holiday Bonus" },
                        { value: "project", label: "Project Bonus" },
                        { value: "annual", label: "Annual Bonus" },
                        { value: "retention", label: "Retention Bonus" },
                        { value: "referral", label: "Referral Bonus" },
                        { value: "milestone", label: "Milestone Bonus" },
                        { value: "overtime", label: "Overtime Bonus" },
                        { value: "commission", label: "Commission Bonus" },
                        { value: "incentive", label: "Incentive Bonus" },
                      ]}
                      labelKey="label"
                      placeholder="Select or type bonus type..."
                      selected={
                        formData.bonusType
                          ? [
                              {
                                value: formData.bonusType,
                                label:
                                  formData.bonusType.charAt(0).toUpperCase() +
                                  formData.bonusType
                                    .slice(1)
                                    .replace(/([A-Z])/g, " $1")
                                    .trim(),
                              },
                            ]
                          : []
                      }
                      onChange={(selected) => {
                        if (selected && selected.length > 0) {
                          setFormData((prev) => ({
                            ...prev,
                            bonusType: selected[0].value,
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            bonusType: "",
                          }));
                        }
                      }}
                      edge={true}
                      allowNew={true}
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent bg-white"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage of Salary</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {formData.calculationType === "percentage"
                          ? "Percentage (%)"
                          : "Amount (₦)"}{" "}
                        *
                      </label>
                      {formData.calculationType === "percentage" &&
                        formData.amount &&
                        employeeSalaryStructure &&
                        parseFloat(formData.amount) > 0 && (
                          <div className="text-sm text-green-600 font-semibold">
                            ₦
                            {(() => {
                              // Safely parse basicSalary using utility function
                              const basicSalary = safeParseFloat(
                                employeeSalaryStructure.basicSalary
                              );

                              // Safely calculate allowances total
                              const allowancesTotal =
                                employeeSalaryStructure.allowances
                                  ? Object.values(
                                      employeeSalaryStructure.allowances
                                    ).reduce((sum, amount) => {
                                      return sum + safeParseFloat(amount);
                                    }, 0)
                                  : 0;

                              const totalSalary = basicSalary + allowancesTotal;
                              const bonusAmount =
                                (safeParseFloat(formData.amount) / 100) *
                                totalSalary;

                              return formatNumber(bonusAmount, 2, 2);
                            })()}
                          </div>
                        )}
                    </div>
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
                      placeholder={
                        formData.calculationType === "percentage"
                          ? "Enter percentage (e.g., 10)"
                          : "Enter amount"
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent"
                    />
                  </div>
                  {/* Account Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Code *
                    </label>
                    <TypeaheadCustom
                      options={chartOfAccount}
                      placeholder="Select account from chart of accounts"
                      labelKey={(i) => `${i.description} - (${i.head})`}
                      onChange={(selectedItems) => {
                        if (selectedItems.length > 0) {
                          setFormData((prev) => ({
                            ...prev,
                            accountCode: selectedItems[0].head,
                          }));
                          setSelectedAccount(selectedItems[0]);
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            accountCode: "",
                          }));
                          setSelectedAccount(null);
                        }
                      }}
                      fixed={true}
                      flip={true}
                      selected={selectedAccount ? [selectedAccount] : []}
                    />
                  </div>
                </div>

                {/* Taxable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Taxable
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Include this bonus in taxable gross pay for PAYE
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: true, label: "Yes — Taxable" },
                      { value: false, label: "No — Non-taxable" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({ ...p, isTaxable: opt.value }))
                        }
                        className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                          formData.isTaxable === opt.value
                            ? "text-white border-transparent"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                        style={
                          formData.isTaxable === opt.value
                            ? {
                                backgroundColor: primaryColor,
                              }
                            : undefined
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason *
                  </label>
                  <input
                    type="text"
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Outstanding performance, Project completion"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[color:var(--app-primary)] focus:border-transparent"
                  />
                </div>

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
                    placeholder="Additional details about the bonus..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <CustomButton type="submit" size="2" className="px-4 py-2">
                  {selectedBonus ? "Update" : "Submit"}
                </CustomButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bonus;
