import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Edit,
  Eye,
  Layers,
  ShieldCheck,
  Upload,
  X,
  Copy,
} from "lucide-react";
import { safeParseFloat } from "../../../utils/numberUtils";
import CustomTable1 from "@/common/Custom/CustomTable1";
import BulkUploadModal from "./BulkUploadModal";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Label } from "@/components/ui/label";
import { _postApi, _fetchApi, _putApi } from "@/redux/actions/api";
import { Switch } from "@/components/ui/switch";

const SalaryStructure = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const primaryColor = activeBusiness?.primary_color || "#1a2d5e";
  const secondaryColor = activeBusiness?.secondary_color;
  const shadeColor = (hex, percent) => {
    const h = String(hex || "").replace("#", "").trim();
    if (![3, 6].includes(h.length)) return primaryColor;
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(full, 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };
  const gradientEnd =
    secondaryColor &&
    !["#fff", "#ffffff", "white"].includes(String(secondaryColor).toLowerCase())
      ? secondaryColor
      : shadeColor(primaryColor, -18);
  const headerGradient = `linear-gradient(to right, ${primaryColor}, ${gradientEnd})`;
  const focusField = {
    onFocus: (e) => {
      e.target.style.borderColor = primaryColor;
      e.target.style.boxShadow = `0 0 0 2px ${primaryColor}33`;
    },
    onBlur: (e) => {
      e.target.style.borderColor = "";
      e.target.style.boxShadow = "";
    },
  };
  const primaryButtonStyle = {
    backgroundColor: primaryColor,
    borderColor: primaryColor,
    color: "#fff",
  };

  const [salaryStructures, setSalaryStructures] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filteredStructures, setFilteredStructures] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    structureName: "",
    structureCode: "",
    basicSalary: "",
    paymentType: "Monthly",
    accountCode: "",
  });

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedForStatus, setSelectedForStatus] = useState(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const [chartOfAccount, setChartOfAccount] = useState([]);
  const selectedAccount = chartOfAccount.find(
    (account) => account.head === formData.accountCode,
  );

  const getAccountLabel = (code) => {
    if (!code) return "—";
    const acc = chartOfAccount.find((a) => a.head === code);
    return acc ? `${acc.description} (${acc.head})` : code;
  };

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
      },
    );
  }, [activeBusiness?.business_name]);

  useEffect(() => {
    if (facilityId) {
      fetchSalaryStructures();
    }
    if (activeBusiness?.business_name) {
      getChartOfAccount();
    }
  }, [facilityId, activeBusiness?.business_name, getChartOfAccount]);

  const fetchSalaryStructures = () => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/hr/salary-structures?facilityId=${facilityId}`,
      (data) => {
        if (data.success) {
          const structures = data.data?.salaryStructures || [];
          setSalaryStructures(Array.isArray(structures) ? structures : []);
        } else {
          toast.error(data.message || "Error fetching salary structures");
          setSalaryStructures([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching salary structures:", err);
        toast.error(err?.message || "Error fetching salary structures");
        setSalaryStructures([]);
        setLoading(false);
      },
      () => {
        setSalaryStructures([]);
        setLoading(false);
      },
    );
  };

  const handleAddStructure = () => {
    setSelectedStructure(null);
    setFormData({
      structureName: "",
      structureCode: "",
      basicSalary: "",
      paymentType: "Monthly",
      accountCode: "",
    });
    setSubmitting(false);
    setShowForm(true);
  };

  const handleEditStructure = (structure) => {
    setSelectedStructure(structure);
    setFormData({
      structureName: structure.structureName || "",
      structureCode: structure.structureCode || "",
      basicSalary: structure.basicSalary || "",
      paymentType: structure.paymentType || "Monthly",
      accountCode: structure.accountCode || "",
    });
    setSubmitting(false);
    setShowForm(true);
  };

  const handleViewStructure = (structure) => {
    setSelectedStructure(structure);
    setViewModalOpen(true);
  };

  const handleSaveStructure = (e) => {
    e.preventDefault();

    if (!facilityId) {
      toast.error("Facility ID is required");
      return;
    }

    setSubmitting(true);

    const requestBody = {
      structureName: formData.structureName,
      structureCode: formData.structureCode,
      basicSalary: parseFloat(formData.basicSalary) || 0,
      paymentType: formData.paymentType || "Monthly",
      accountCode: formData.accountCode || null,
      facilityId,
      createdBy: user?.id || user?.userId,
      ...(selectedStructure && { updatedBy: user?.id || user?.userId }),
    };

    if (!selectedStructure) {
      Object.assign(requestBody, {
        allowances: {},
        deductions: {},
        overtimeRate: 1.5,
        payeRate: 0,
        pensionRate: 0,
      });
    }

    const onSuccess = (data) => {
      setSubmitting(false);
      if (data.success) {
        setShowForm(false);
        setSelectedStructure(null);
        fetchSalaryStructures();
        toast.success(
          selectedStructure
            ? "Salary structure updated successfully"
            : "Salary structure created successfully",
        );
      } else {
        toast.error(data.message || "Error saving salary structure");
      }
    };

    const onError = (err) => {
      setSubmitting(false);
      console.error("Error saving salary structure:", err);
      toast.error(err?.message || "Error saving salary structure");
    };

    if (selectedStructure) {
      _putApi(
        `/api/hr/salary-structures/${selectedStructure.id}`,
        requestBody,
        onSuccess,
        onError,
      );
    } else {
      _postApi(
        "/api/hr/salary-structures",
        requestBody,
        onSuccess,
        onError,
      );
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Format number with thousand separators for display
  const formatNumberWithCommas = (value) => {
    if (!value) return "";
    // Remove any existing commas and non-numeric characters except decimal point
    const numericValue = value.toString().replace(/[^\d.]/g, "");
    // Split by decimal point
    const parts = numericValue.split(".");
    // Add commas to the integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  // Parse formatted number back to numeric value
  const parseFormattedNumber = (value) => {
    if (!value) return "";
    return value.toString().replace(/,/g, "");
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const copyStructureId = async (id, label = "Structure ID") => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(String(id));
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const columns = [
    {
      value: "structureName",
      title: "Structure Name",
      custom: true,
      className: "text-left py-4",
      component: (item) => (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${primaryColor}14`, color: primaryColor }}>
            <Layers size={18} />
          </div>
          <span className="text-sm font-bold text-slate-900">
            {item.structureName}
          </span>
        </div>
      ),
    },
    {
      value: "structureCode",
      title: "Identifier Code",
      custom: true,
      className: "text-left",
      component: (item) => (
        <span className="text-sm font-mono font-bold text-slate-600">
          {item.structureCode || "—"}
        </span>
      ),
    },
    {
      value: "id",
      title: "Structure ID",
      custom: true,
      className: "text-left",
      component: (item) => (
        <button
          type="button"
          onClick={() => copyStructureId(item.id)}
          className="inline-flex items-center gap-1.5 max-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-left hover:bg-slate-100 hover:border-slate-300 transition-colors"
          title={item.id ? `Copy: ${item.id}` : undefined}
        >
          <span className="text-xs font-mono text-slate-600 truncate">
            {item.id || "—"}
          </span>
          {item.id ? <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
        </button>
      ),
    },
    {
      value: "paymentType",
      title: "Frequency",
      custom: true,
      className: "text-left",
      component: (item) => (
        <span className="text-sm font-medium text-slate-700">
          {item.paymentType || "—"}
        </span>
      ),
    },
    {
      value: "basicSalary",
      title: "Base Component (₦)",
      custom: true,
      className: "text-left",
      component: (item) => (
        <span className="text-sm font-black text-slate-900">
          {formatCurrency(safeParseFloat(item.basicSalary))}
        </span>
      ),
    },
    {
      value: "accountCode",
      title: "Accounting Ledger",
      custom: true,
      className: "text-left",
      component: (item) => (
        <span className="text-sm text-slate-700">
          {getAccountLabel(item.accountCode)}
        </span>
      ),
    },
    {
      value: "action",
      title: "Actions",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex items-center justify-end gap-3">
          <div className="flex items-center gap-2 mr-2">
            <span
              className={`text-[9px] font-black uppercase tracking-widest ${
                item.status === "Active" ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {item.status}
            </span>
            <Switch
              checked={item.status === "Active"}
              onCheckedChange={() => {
                setSelectedForStatus(item);
                setShowStatusModal(true);
              }}
              className="scale-75 data-[state=checked]:bg-[var(--brand-primary)]"
              style={{ "--brand-primary": primaryColor }}
            />
          </div>
          <button
            onClick={() => handleViewStructure(item)}
            className="p-2 text-slate-400 rounded-xl transition-all"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = primaryColor;
              e.currentTarget.style.backgroundColor = `${primaryColor}14`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "";
              e.currentTarget.style.backgroundColor = "";
            }}
            title="View Details"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={() => handleEditStructure(item)}
            className="p-2 text-slate-400 rounded-xl transition-all"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = primaryColor;
              e.currentTarget.style.backgroundColor = `${primaryColor}14`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "";
              e.currentTarget.style.backgroundColor = "";
            }}
            title="Edit Structure"
          >
            <Edit size={18} />
          </button>
        </div>
      ),
    },
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount || 0);
  };

  useEffect(() => {
    // Filter structures based on search
    let filtered = Array.isArray(salaryStructures) ? salaryStructures : [];

    if (searchTerm) {
      filtered = filtered.filter(
        (structure) =>
          structure.structureName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          structure.structureCode
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          structure.id
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          structure.description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    }

    setFilteredStructures(filtered);
  }, [salaryStructures, searchTerm]);

  if (!facilityId) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="p-6 px-1">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <div className="text-red-600 text-lg font-medium mb-2">
                Facility ID Required
              </div>
              <div className="text-red-500">
                Please ensure you have selected a facility/business to manage
                salary structures.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderBottomColor: primaryColor }}
        />
      </div>
    );
  }

  const summaryStats = [
    {
      label: "Total Structures",
      count: salaryStructures.length,
      icon: Layers,
      color: "blue",
    },
    {
      label: "Active Structures",
      count: salaryStructures.filter((s) => s.status === "Active").length,
      icon: ShieldCheck,
      color: "emerald",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto space-y-6 px-2 py-1">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Salary Structure
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Define base salary structure for your workforce
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkUploadOpen(true)}
              className="h-11 px-5 rounded-xl border-slate-200 text-sm font-bold"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            <Button
              onClick={handleAddStructure}
              className="h-11 px-5 rounded-xl shadow-lg transition-all active:scale-95 text-sm font-bold hover:opacity-90"
              style={primaryButtonStyle}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Structure
            </Button>
          </div>
        </div>

        {/* Compact Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaryStats.map((stat, i) => (
            <div
              key={i}
              className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all"
            >
              <div
                className="p-3 rounded-xl"
                style={{
                  backgroundColor: `${primaryColor}14`,
                  color: primaryColor,
                }}
              >
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                  {stat.label}
                </p>
                <p className="text-xl font-black text-slate-900">
                  {stat.count}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-2 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search structures..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none transition-all placeholder:text-slate-400"
                value={searchTerm}
                onChange={handleSearch}
                {...focusField}
              />
            </div>
          </div>

          <div className="p-0">
            <CustomTable1
              data={filteredStructures}
              fields={columns}
              loading={loading}
              message="No salary structures defined."
              pageSize={10}
            />
          </div>
        </div>
      </div>

      {viewModalOpen && selectedStructure && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 z-[100]">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div
              className="text-white py-3 p-4 flex justify-between items-center sticky top-0 z-10"
              style={{ background: headerGradient }}
            >
              <div>
                <h3 className="text-xl font-bold">
                  {selectedStructure.structureName}
                </h3>
                <p className="text-white/80 text-xs mt-1 font-mono">
                  {selectedStructure.structureCode}
                </p>
              </div>
              <button
                onClick={() => setViewModalOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                    Structure Name
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedStructure.structureName}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                    Identifier Code
                  </p>
                  <p className="text-sm font-mono font-bold text-slate-700">
                    {selectedStructure.structureCode}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 md:col-span-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                        Structure ID
                      </p>
                      <p className="text-xs font-mono font-bold text-slate-600 break-all">
                        {selectedStructure.id}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Use this ID in bulk upload allowances when Basis of Allocation is salary structure
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-8 text-xs font-bold gap-1.5"
                      onClick={() => copyStructureId(selectedStructure.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                    Frequency
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {selectedStructure.paymentType}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                    Base Component (₦)
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    {formatCurrency(selectedStructure.basicSalary)}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 md:col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                    Accounting Ledger
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {getAccountLabel(selectedStructure.accountCode)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white border-t flex gap-3 sticky bottom-0">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-slate-600 font-bold text-xs"
                onClick={() => setViewModalOpen(false)}
              >
                Close
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-bold text-xs shadow-lg hover:opacity-90"
                style={primaryButtonStyle}
                onClick={() => {
                  setViewModalOpen(false);
                  handleEditStructure(selectedStructure);
                }}
              >
                Modify Structure
              </Button>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-200">
            <div
              className="text-white p-4 flex justify-between items-center"
              style={{ background: headerGradient }}
            >
              <div>
                <h3 className="text-xl font-bold">
                  {selectedStructure
                    ? "Edit Salary Structure"
                    : "New Salary Structure"}
                </h3>
                <p className="text-white/80 text-[10px] mt-1 font-bold uppercase tracking-widest">
                  Salary structure details
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 hover:bg-white/20 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSaveStructure}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Structure Name
                </Label>
                <input
                  type="text"
                  name="structureName"
                  value={formData.structureName}
                  onChange={handleInputChange}
                  placeholder="e.g. Senior Staff Template"
                  required
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none transition-all text-sm"
                  {...focusField}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Identifier Code
                  </Label>
                  <input
                    type="text"
                    name="structureCode"
                    value={formData.structureCode}
                    onChange={handleInputChange}
                    placeholder="AL-001"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                    {...focusField}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Frequency
                  </Label>
                  <select
                    name="paymentType"
                    value={formData.paymentType}
                    onChange={handleInputChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none appearance-none cursor-pointer text-sm font-medium"
                    {...focusField}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Daily">Daily</option>
                    <option value="Hourly">Hourly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Base Component (₦)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                    ₦
                  </span>
                  <input
                    type="text"
                    value={formatNumberWithCommas(formData.basicSalary)}
                    onChange={(e) => {
                      const rawValue = parseFormattedNumber(e.target.value);
                      setFormData((p) => ({ ...p, basicSalary: rawValue }));
                    }}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-black"
                    {...focusField}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                  Accounting Ledger
                </Label>
                <TypeaheadCustom
                  options={chartOfAccount}
                  placeholder="Account head..."
                  labelKey={(i) => `${i.description} (${i.head})`}
                  onChange={(selectedItems) => {
                    if (selectedItems.length > 0) {
                      setFormData((prev) => ({
                        ...prev,
                        accountCode: selectedItems[0].head,
                      }));
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        accountCode: "",
                      }));
                    }
                  }}
                  fixed={true}
                  selected={selectedAccount ? [selectedAccount] : []}
                />
              </div>
            </form>

            <div className="p-3 bg-white border-t flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <Button
                loading={submitting}
                onClick={handleSaveStructure}
                className="px-8 py-3 h-auto rounded-xl font-bold text-xs shadow-lg hover:opacity-90"
                style={primaryButtonStyle}
              >
                {selectedStructure ? "Save Changes" : "Create Structure"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={() => { fetchSalaryStructures(); setBulkUploadOpen(false); }}
        title="Bulk Upload Salary Structures"
        apiEndpoint="/api/hr/salary-structures/bulk"
        payloadKey="structures"
        facilityId={facilityId}
        createdBy={user?.id || user?.userId}
        primaryColor={primaryColor}
        templateCols={[
          { key: "structureName", label: "Structure Name", example: "Senior Staff Template" },
          { key: "structureCode", label: "Identifier Code", example: "AL-001" },
          { key: "paymentType", label: "Frequency", example: "Monthly" },
          { key: "basicSalary", label: "Base Component (₦)", example: "150000" },
          { key: "accountCode", label: "Accounting Ledger", example: "50101" },
        ]}
        mapRow={(r) => ({
          structureName: r["Structure Name"] || r.structureName || "",
          structureCode:
            r["Identifier Code"] ||
            r["Structure Code"] ||
            r.structureCode ||
            "",
          paymentType:
            r["Frequency"] ||
            r["Payment Type"] ||
            r.paymentType ||
            "Monthly",
          basicSalary:
            r["Base Component (₦)"] ||
            r["Basic Salary"] ||
            r.basicSalary ||
            0,
          accountCode:
            r["Accounting Ledger"] ||
            r.accountCode ||
            "",
        })}
      />

      {/* STATUS CHANGE MODAL */}
      {showStatusModal && selectedForStatus && (        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
            <div
              className="p-6 text-white"
              style={{
                background:
                  selectedForStatus.status === "Active"
                    ? "#dc2626"
                    : headerGradient,
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-black italic uppercase tracking-tight">
                  {selectedForStatus.status === 'Active' ? 'Suspend Structure' : 'Activate Structure'}
                </h3>
                <button onClick={() => setShowStatusModal(false)} className="p-1 hover:bg-white/20 rounded-full transition-all">
                   <X size={20} />
                </button>
              </div>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest leading-none">
                {selectedForStatus.structureName} — {selectedForStatus.structureCode}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">Frequency</span>
                  <span className="text-sm font-bold text-slate-900">{selectedForStatus.paymentType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">Base Component (₦)</span>
                  <span className="text-sm font-black text-slate-900">{formatCurrency(selectedForStatus.basicSalary)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-600">Accounting Ledger</span>
                  <span className="text-sm font-bold text-slate-700 text-right max-w-[60%]">
                    {getAccountLabel(selectedForStatus.accountCode)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className="p-4 rounded-2xl border text-white relative overflow-hidden"
                  style={{ background: headerGradient, borderColor: `${primaryColor}55` }}
                >
                   <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <ShieldCheck size={40} />
                   </div>
                   <h4 className="text-xs font-black italic uppercase tracking-widest mb-1 leading-none text-white/90">Security Confirmation</h4>
                   <p className="text-[10px] font-medium text-white/80">
                     Are you certain you want to {selectedForStatus.status === 'Active' ? 'deactivate' : 'activate'} this salary structure? Employees assigned to it may be affected.
                   </p>
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
                className={
                  selectedForStatus.status === "Active"
                    ? "flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg bg-red-600 hover:bg-red-700 shadow-red-200"
                    : "flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:opacity-90"
                }
                style={
                  selectedForStatus.status === "Active" ? undefined : primaryButtonStyle
                }
                onClick={() => {
                  const newStatus =
                    selectedForStatus.status === "Active" ? "Inactive" : "Active";
                  _putApi(
                    `/api/hr/salary-structures/${selectedForStatus.id}`,
                    {
                      facilityId,
                      status: newStatus,
                      updatedBy: user?.id || user?.userId,
                    },
                    (data) => {
                      if (data.success) {
                        toast.success(
                          `Package ${newStatus === "Active" ? "reinstated" : "suspended"} successfully`,
                        );
                        fetchSalaryStructures();
                        setShowStatusModal(false);
                      } else {
                        toast.error(data.message || "Failed to update status");
                      }
                    },
                    () => toast.error("An error occurred"),
                  );
                }}
              >
                {selectedForStatus.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryStructure;
