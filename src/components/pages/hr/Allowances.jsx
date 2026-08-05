import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  DollarSign,
  X,
  Upload,
  Layers,
  TrendingUp,
  TrendingDown,
  Users,
} from "lucide-react";
import { formatNumberWithCommas, parseFormattedNumber } from "../../../utils/numberUtils";
import { toast } from "sonner";
import CustomTable1 from "@/common/Custom/CustomTable1";
import BulkUploadModal from "./BulkUploadModal";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";

const Allowances = () => {
  const { user, activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id || user?.facilityId || "";
  const primaryColor = activeBusiness?.primary_color || "#4267B2";
  const secondaryColor =
    activeBusiness?.secondary_color &&
    String(activeBusiness.secondary_color).toLowerCase() !== "#ffffff"
      ? activeBusiness.secondary_color
      : primaryColor;
  const appColorStyle = {
    ["--app-primary"]: primaryColor,
    ["--app-secondary"]: secondaryColor,
  };
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
  const brandButtonStyle = {
    backgroundColor: primaryColor,
    borderColor: primaryColor,
  };
  const selectedToggleStyle = {
    backgroundColor: primaryColor,
    borderColor: primaryColor,
    color: "#fff",
  };

  const [allowances, setAllowances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedAllowance, setSelectedAllowance] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState("allowance");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [allowanceToDelete, setAllowanceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    calculationType: "fixed",
    description: "",
    basis: "salaryStructure",
    roleId: "",
    roleName: "",
    salaryStructureId: "",
    salaryStructureName: "",
    type: "allowance",
    accountCode: "",
    isTaxable: true,
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount || 0);

  const fetchRoles = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/users/roles-for-select?facilityId=${facilityId}`,
      (res) => { if (res.success) setAvailableRoles(res.results || []); },
      () => setAvailableRoles([])
    );
  }, [facilityId]);

  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.business_name) return;
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => { if (resp.success) setChartOfAccount(resp.results); },
      () => {}
    );
  }, [activeBusiness?.business_name]);

  useEffect(() => {
    if (facilityId) {
      fetchAllowances();
      fetchRoles();
      fetchSalaryStructures();
      getChartOfAccount();
    }
  }, [facilityId, fetchRoles, getChartOfAccount]);

  const fetchSalaryStructures = async () => {
    if (!facilityId) return;
    try {
      const res = await fetch(`/api/hr/salary-structures?facilityId=${facilityId}&status=Active&limit=100`);
      const data = await res.json();
      if (data.success) setSalaryStructures(data.data.salaryStructures);
    } catch {}
  };

  const fetchAllowances = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/hr/allowances?facilityId=${facilityId}`);
      const data = await res.json();
      setAllowances(data.success ? data.data : []);
    } catch {
      setAllowances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllowance = () => {
    setSelectedAllowance(null);
    setSelectedAccount(null);
    setFormData({ name: "", amount: "", calculationType: "fixed", description: "", basis: "salaryStructure", roleId: "", roleName: "", salaryStructureId: "", salaryStructureName: "", type: "allowance", accountCode: "", isTaxable: true });
    setSubmitting(false);
    setShowForm(true);
  };

  const handleEditAllowance = (allowance) => {
    setSelectedAllowance(allowance);
    setSelectedAccount(allowance.accountCode ? chartOfAccount.find(a => a.head === allowance.accountCode) || null : null);
    setFormData({
      name: allowance.name || "",
      amount: allowance.amount || "",
      calculationType: allowance.calculationType || "fixed",
      description: allowance.description || "",
      basis: allowance.isRoleBased ? "role" : "salaryStructure",
      roleId: (() => {
        const raw = allowance.roleId || "";
        if (!raw) return "";
        const byId = availableRoles.find((r) => String(r.id) === String(raw));
        if (byId) return String(byId.id);
        const byName = availableRoles.find(
          (r) => r.label === raw || r.value === raw,
        );
        return byName ? String(byName.id) : String(raw);
      })(),
      roleName: allowance.roleName || "",
      salaryStructureId: allowance.salaryStructureId || "",
      salaryStructureName: allowance.salaryStructureName || "",
      type: allowance.type || "allowance",
      accountCode: allowance.accountCode || "",
      isTaxable: allowance.isTaxable !== false && allowance.isTaxable !== 0,
    });
    setSubmitting(false);
    setShowForm(true);
  };

  const handleDeleteAllowance = (allowance) => {
    setAllowanceToDelete(allowance);
    setShowDeleteModal(true);
  };

  const confirmDeleteAllowance = async () => {
    if (!allowanceToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hr/allowances/${allowanceToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, updatedBy: user?.id || user?.userId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAllowances();
        toast.success("Component deleted");
        setShowDeleteModal(false);
        setAllowanceToDelete(null);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Error deleting component");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveAllowance = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = selectedAllowance ? `/api/hr/allowances/${selectedAllowance.id}` : "/api/hr/allowances";
      const res = await fetch(url, {
        method: selectedAllowance ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, isRoleBased: formData.basis === "role", facilityId, createdBy: user?.id || user?.userId, updatedBy: user?.id || user?.userId }),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        fetchAllowances();
        toast.success(selectedAllowance ? "Component updated" : "Component created");
      } else toast.error(data.message);
    } catch { toast.error("Error saving component"); }
    finally { setSubmitting(false); }
  };

  const filteredAllowances = (allowances || []).filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const summaryStats = [
    { label: "Total Components", count: allowances.length, icon: Layers, color: "blue" },
    { label: "Allowances", count: allowances.filter(a => a.type === "allowance").length, icon: TrendingUp, color: "emerald" },
    { label: "Deductions", count: allowances.filter(a => a.type === "deduction").length, icon: TrendingDown, color: "red" },
    { label: "Role Specific", count: allowances.filter(a => a.isRoleBased).length, icon: Users, color: "indigo" },
  ];

  const columns = [
    {
      value: "name",
      title: "Pay Component",
      custom: true,
      className: "text-left py-4",
      component: (item) => (
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${item.type === "allowance" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"} group-hover:opacity-80 transition-colors`}>
            <DollarSign size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-none mb-1">{item.name}</div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{item.type}</div>
          </div>
        </div>
      ),
    },
    {
      value: "basis",
      title: "Allocation Basis",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
            {item.isRoleBased ? "By Role" : "By Structure"}
          </div>
          <div className="text-xs font-bold text-slate-700">
            {item.isRoleBased ? item.roleName : item.salaryStructureName}
          </div>
        </div>
      ),
    },
    {
      value: "amount",
      title: "Rate / Value",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black ${item.type === "allowance" ? "text-emerald-600" : "text-red-600"}`}>
              {item.calculationType === "percentage" ? `${item.amount}%` : formatCurrency(item.amount)}
            </span>
            {item.calculationType === "percentage" && (
              <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded uppercase tracking-tighter">of basic</span>
            )}
          </div>
          {item.type === "allowance" && (
            <div className="mt-1">
              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                item.isTaxable !== false && item.isTaxable !== 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-500"
              }`}>
                {item.isTaxable !== false && item.isTaxable !== 0 ? "Taxable" : "Non-taxable"}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      value: "action",
      title: "Actions",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => handleEditAllowance(item)} className="p-2 text-slate-400 hover:text-[color:var(--app-primary)] hover:bg-[color:var(--app-primary)]/10 rounded-xl transition-all" title="Edit">
            <Edit size={18} />
          </button>
          <button onClick={() => handleDeleteAllowance(item)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" style={appColorStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--app-primary)]"></div>
      </div>
    );
  }

  const defaultStructureId = salaryStructures.find((s) => s?.id)?.id || "";
  const defaultRoleId =
    availableRoles.find((r) => r?.id != null && r.id !== "")?.id ?? "";

  const resolveRoleId = (raw) => {
    if (raw === undefined || raw === null || String(raw).trim() === "") return "";
    const token = String(raw).trim();
    const byId = availableRoles.find((r) => String(r.id) === token);
    if (byId) return String(byId.id);
    const byName = availableRoles.find(
      (r) => r.label === token || r.value === token,
    );
    return byName ? String(byName.id) : token;
  };

  const parseAccountCode = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "";
    const paren = s.match(/\(([^)]+)\)\s*$/);
    return paren ? paren[1].trim() : s;
  };

  return (
    <div className="min-h-screen bg-transparent" style={appColorStyle}>
      <div className="max-w-7xl mx-auto space-y-6 px-2 py-1">

        {/* Header — matches SalaryStructure */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-2">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pay Components</h1>
            <p className="text-slate-500 text-sm font-medium">Manage allowances and deductions for roles and salary structures</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBulkUploadType("allowance");
                setBulkUploadOpen(true);
              }}
              className="h-11 px-5 rounded-xl border-slate-200 text-sm font-bold"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload Allowances
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBulkUploadType("deduction");
                setBulkUploadOpen(true);
              }}
              className="h-11 px-5 rounded-xl border-slate-200 text-sm font-bold"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload Deductions
            </Button>
            <Button
              onClick={handleAddAllowance}
              className="h-11 px-5 rounded-xl shadow-lg transition-all active:scale-95 text-sm font-bold text-white hover:opacity-90"
              style={brandButtonStyle}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Component
            </Button>
          </div>
        </div>

        {/* Stats grid — matches SalaryStructure */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summaryStats.map((stat, i) => (
            <div key={i} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
              <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                <p className="text-xl font-black text-slate-900">{stat.count}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table — matches SalaryStructure */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-2 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search components..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[color:var(--app-primary)] outline-none transition-all placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="p-0">
            <CustomTable1
              data={filteredAllowances}
              fields={columns}
              loading={loading}
              message="No pay components defined."
              pageSize={10}
            />
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={() => { fetchAllowances(); setBulkUploadOpen(false); }}
        title={bulkUploadType === "allowance" ? "Bulk Upload Allowances" : "Bulk Upload Deductions"}
        apiEndpoint="/api/hr/allowances/bulk"
        payloadKey="allowances"
        facilityId={facilityId}
        createdBy={user?.id || user?.userId}
        primaryColor={activeBusiness?.primary_color || "#4267B2"}
        templateCols={[
          {
            key: "name",
            label: "Component Name",
            example: bulkUploadType === "allowance" ? "Housing Allowance" : "Tax Deduction",
          },
          { key: "calculationType", label: "Method", example: "fixed" },
          { key: "amount", label: "Value", example: "5000" },
          {
            key: "isTaxable",
            label: "Taxable",
            example: bulkUploadType === "allowance" ? "Yes" : "No",
          },
          {
            key: "isRoleBased",
            label: "Basis of Allocation",
            example: "salary structure",
          },
          {
            key: "id",
            label: "id",
            example: defaultStructureId || defaultRoleId,
          },
          {
            key: "accountCode",
            label: "Accounting Ledger",
            example: "5100",
          },
          {
            key: "description",
            label: "Description",
            example:
              bulkUploadType === "allowance"
                ? "Monthly housing support"
                : "Statutory tax deduction",
          },
        ]}
        exampleRows={
          bulkUploadType === "allowance"
            ? [
                {
                  name: "Housing Allowance",
                  calculationType: "fixed",
                  amount: "5000",
                  isTaxable: "Yes",
                  isRoleBased: "salary structure",
                  id: defaultStructureId,
                  accountCode: "5100",
                  description: "Monthly housing support",
                },
                {
                  name: "Transport Allowance",
                  calculationType: "percentage",
                  amount: "10",
                  isTaxable: "No",
                  isRoleBased: "role",
                  id: defaultRoleId,
                  accountCode: "5101",
                  description: "Transport allowance by role",
                },
              ]
            : [
                {
                  name: "Tax Deduction",
                  calculationType: "percentage",
                  amount: "5",
                  isTaxable: "No",
                  isRoleBased: "salary structure",
                  id: defaultStructureId,
                  accountCode: "2200",
                  description: "Statutory tax deduction",
                },
                {
                  name: "Loan Deduction",
                  calculationType: "fixed",
                  amount: "2000",
                  isTaxable: "No",
                  isRoleBased: "role",
                  id: defaultRoleId,
                  accountCode: "2201",
                  description: "Staff loan repayment",
                },
              ]
        }
        mapRow={(r) => {
          const basisRaw =
            r["Basis of Allocation"] ?? r.basis ?? r.isRoleBased ?? "";
          const basis = String(basisRaw).trim().toLowerCase();
          const isRoleBased =
            basis.includes("role") ||
            basis === "true" ||
            basisRaw === true ||
            String(r["Is Role Based"] || "").toLowerCase() === "true";

          const allocationId =
            r.id ||
            r["id"] ||
            r["Structure ID"] ||
            r["Salary Structure ID"] ||
            r.salaryStructureId ||
            r["Role ID"] ||
            r.roleId ||
            "";

          return {
            name: r["Component Name"] || r.name || "",
            type: bulkUploadType,
            calculationType:
              r["Method"] || r["Calculation Type"] || r.calculationType || "fixed",
            amount: r["Value"] || r["Amount"] || r.amount || 0,
            isTaxable: (() => {
              const raw = r["Taxable"] ?? r.taxable ?? r.isTaxable;
              if (raw === undefined || raw === null || String(raw).trim() === "") {
                return bulkUploadType === "allowance";
              }
              const v = String(raw).trim().toLowerCase();
              if (["yes", "y", "true", "1", "taxable"].includes(v)) return true;
              if (
                ["no", "n", "false", "0", "non-taxable", "not taxable", "non taxable"].includes(
                  v,
                )
              ) {
                return false;
              }
              return bulkUploadType === "allowance";
            })(),
            isRoleBased,
            salaryStructureName:
              r["Salary Structure Name"] || r.salaryStructureName || "",
            salaryStructureId: isRoleBased ? "" : allocationId,
            roleName: r["Role Name"] || r.roleName || "",
            roleId: isRoleBased ? resolveRoleId(allocationId) : "",
            accountCode: parseAccountCode(
              r["Accounting Ledger"] || r["Account Code"] || r.accountCode || "",
            ),
            description: r["Description"] || r.description || "",
          };
        }}
      />

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-200">

            {/* Modal header — app brand colors */}
            <div
              className="text-white p-4 flex justify-between items-center"
              style={{ background: headerGradient }}
            >
              <div>
                <h3 className="text-xl font-bold">{selectedAllowance ? "Modify Component" : "New Pay Component"}</h3>
                <p className="text-white/80 text-[10px] mt-1 font-bold uppercase tracking-widest">
                  {selectedAllowance ? "Update existing pay rule" : "Define allowance or deduction rule"}
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/20 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAllowance} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">

              {/* Basis toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Basis of Allocation</label>
                <div className="grid grid-cols-2 gap-2">
                  {["salaryStructure", "role"].map((opt) => (
                    <button key={opt} type="button"
                      onClick={() => setFormData(p => ({ ...p, basis: opt }))}
                      className={`py-3 rounded-xl font-bold text-xs capitalize transition-all border-2 ${formData.basis === opt ? "text-white" : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"}`}
                      style={formData.basis === opt ? selectedToggleStyle : undefined}
                    >
                      {opt === "salaryStructure" ? "Salary Structure" : "Role"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target selector */}
              {formData.basis === "salaryStructure" ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Structure</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[color:var(--app-primary)] outline-none text-sm"
                    value={formData.salaryStructureId}
                    onChange={(e) => {
                      const s = salaryStructures.find(s => s.id === e.target.value);
                      setFormData(p => ({ ...p, salaryStructureId: e.target.value, salaryStructureName: s?.structureName || "" }));
                    }}
                    required
                  >
                    <option value="">Select Structure</option>
                    {salaryStructures.map(s => <option key={s.id} value={s.id}>{s.structureName}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Role</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[color:var(--app-primary)] outline-none text-sm"
                    value={formData.roleId}
                    onChange={(e) => {
                      const r = availableRoles.find(
                        (role) => String(role.id) === e.target.value,
                      );
                      setFormData((p) => ({
                        ...p,
                        roleId: e.target.value,
                        roleName: r?.label || "",
                      }));
                    }}
                    required
                  >
                    <option value="">Select Role</option>
                    {availableRoles.map((r) => (
                      <option key={r.id} value={String(r.id)}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Type toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Component Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {["allowance", "deduction"].map((type) => (
                    <button key={type} type="button"
                      onClick={() => setFormData(p => ({
                        ...p,
                        type,
                        isTaxable: type === "allowance" ? (p.isTaxable ?? true) : false,
                      }))}
                      className={`py-3 rounded-xl font-bold text-xs uppercase transition-all border-2 ${formData.type === type ? "text-white" : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"}`}
                      style={formData.type === type ? selectedToggleStyle : undefined}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Component Name</label>
                <input
                  type="text"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[color:var(--app-primary)] outline-none transition-all text-sm"
                  placeholder="e.g. Housing Allowance, Union Dues..."
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              {/* Method + Value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Method</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[color:var(--app-primary)] outline-none appearance-none text-sm font-medium"
                    value={formData.calculationType}
                    onChange={(e) => setFormData(p => ({ ...p, calculationType: e.target.value }))}
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Value ({formData.calculationType === "fixed" ? "₦" : "%"})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      {formData.calculationType === "fixed" ? "₦" : "%"}
                    </span>
                    <input
                      type="text"
                      className="w-full pl-7 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[color:var(--app-primary)] outline-none text-sm font-black"
                      placeholder="0.00"
                      value={formatNumberWithCommas(formData.amount)}
                      onChange={(e) => setFormData(p => ({ ...p, amount: parseFormattedNumber(e.target.value) }))}
                      required
                    />
                  </div>
                </div>
              </div>

              {formData.type === "allowance" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Taxable</label>
                  <p className="text-[11px] text-slate-500 pl-1">Include this allowance in taxable gross pay for PAYE</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: true, label: "Yes" },
                      { value: false, label: "No" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, isTaxable: opt.value }))}
                        className={`py-3 rounded-xl font-bold text-xs transition-all border-2 ${
                          formData.isTaxable === opt.value
                            ? "text-white"
                            : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                        }`}
                        style={formData.isTaxable === opt.value ? selectedToggleStyle : undefined}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Accounting ledger */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Accounting Ledger</label>
                <TypeaheadCustom
                  options={chartOfAccount}
                  placeholder="Account head..."
                  labelKey={(i) => `${i.description} (${i.head})`}
                  onChange={(selected) => {
                    setFormData(p => ({ ...p, accountCode: selected.length > 0 ? selected[0].head : "" }));
                    setSelectedAccount(selected.length > 0 ? selected[0] : null);
                  }}
                  fixed={true}
                  selected={selectedAccount ? [selectedAccount] : []}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Description</label>
                <textarea
                  rows={2}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[color:var(--app-primary)] outline-none transition-all text-sm"
                  placeholder="Optional notes..."
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                />
              </div>
            </form>

            {/* Footer — matches SalaryStructure */}
            <div className="p-3 bg-white border-t flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <Button
                onClick={handleSaveAllowance}
                disabled={submitting}
                className="px-8 py-3 h-auto rounded-xl font-bold text-xs shadow-lg text-white hover:opacity-90"
                style={brandButtonStyle}
              >
                {submitting ? "Saving..." : selectedAllowance ? "Save Changes" : "Create Component"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && allowanceToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-200">
            <div
              className="text-white p-4 flex justify-between items-center"
              style={{ background: "linear-gradient(to right, #dc2626, #b91c1c)" }}
            >
              <div>
                <h3 className="text-xl font-bold">Delete Pay Component</h3>
                <p className="text-white/80 text-[10px] mt-1 font-bold uppercase tracking-widest">
                  This action cannot be undone
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (deleting) return;
                  setShowDeleteModal(false);
                  setAllowanceToDelete(null);
                }}
                className="p-1 hover:bg-white/20 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-bold text-slate-900">{allowanceToDelete.name}</span>?
              </p>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-bold capitalize">{allowanceToDelete.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Basis</span>
                  <span className="font-bold">
                    {allowanceToDelete.isRoleBased
                      ? allowanceToDelete.roleName || "Role"
                      : allowanceToDelete.salaryStructureName || "Salary Structure"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rate</span>
                  <span className="font-bold">
                    {allowanceToDelete.calculationType === "percentage"
                      ? `${allowanceToDelete.amount}%`
                      : `₦${formatNumberWithCommas(allowanceToDelete.amount)}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white border-t flex justify-between gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setAllowanceToDelete(null);
                }}
                className="px-6 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <Button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteAllowance}
                className="px-8 py-3 h-auto rounded-xl font-bold text-xs shadow-lg text-white bg-red-600 hover:bg-red-700 border-red-600"
              >
                {deleting ? "Deleting..." : "Delete Component"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Allowances;
