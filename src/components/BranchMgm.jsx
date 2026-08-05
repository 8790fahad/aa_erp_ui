import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { Plus, Edit, Trash2, MapPin, Building2, Search, X, Loader2, Hash } from "lucide-react";
import { _fetchApi, _postApi, _deleteApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const isDefaultBranch = (branch) =>
  branch?.is_default === true || branch?.is_default === 1 || branch?.is_default === "1";

export default function BranchMgm() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [branchToDelete, setBranchToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    branch_name: "",
    state: "",
    address: "",
    crm: "",
    is_default: false,
  });

  const fetchBranches = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        setLoading(false);
        if (res.success) {
          setBranches(res.results || []);
        }
      },
      (err) => {
        setLoading(false);
        toast.error("Failed to load warehouses");
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = () => {
    setFormData({
      branch_name: "",
      state: "",
      address: "",
      crm: "",
      is_default: branches.length === 0,
    });
    setEditingBranch(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeBusiness?.id || submitting) return;

    const endpoint = editingBranch ? "/account/update/branch" : "/account/create/branch";
    const payload = {
      facilityId: activeBusiness.id,
      data: {
        ...formData,
        id: editingBranch?.id,
      }
    };

    setSubmitting(true);
    _postApi(
      endpoint,
      payload,
      (res) => {
        setSubmitting(false);
        if (res.success) {
          toast.success(editingBranch ? "Warehouse updated" : "Warehouse created");
          setShowModal(false);
          resetForm();
          fetchBranches();
        } else {
          toast.error(res.message || "Failed to save warehouse");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error("Error saving warehouse");
      }
    );
  };

  const handleEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({
      branch_name: branch.branch_name || "",
      state: branch.state || "",
      address: branch.address || "",
      crm: branch.crm || "",
      is_default: isDefaultBranch(branch),
    });
    setShowModal(true);
  };

  const confirmDelete = () => {
    if (!branchToDelete || deletingId) return;
    const id = branchToDelete.id;

    setDeletingId(id);
    _deleteApi(
      `/account/delete/branches/${id}/${activeBusiness.id}`,
      {},
      (res) => {
        setDeletingId(null);
        if (res.success) {
          toast.success("Warehouse deleted");
          setBranchToDelete(null);
          fetchBranches();
        } else {
          toast.error(res.message || "Failed to delete warehouse");
        }
      },
      (err) => {
        setDeletingId(null);
        toast.error(err?.message || "Error deleting warehouse");
      }
    );
  };

  const filteredBranches = branches.filter(b => 
    b.branch_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.branch_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.state?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const editingDefaultBranch = editingBranch && isDefaultBranch(editingBranch);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Warehouse Management</h1>
          <p className="text-gray-500">Manage your business warehouses</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
        >
          <Plus className="w-4 h-4" /> Add Warehouse
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search warehouses..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-lg" />
          ))
        ) : filteredBranches.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No warehouses found</h3>
            <p className="text-gray-500">Get started by creating your first warehouse</p>
          </div>
        ) : (
          filteredBranches.map((branch) => (
            <Card key={branch.id} className="hover:shadow-md transition-shadow border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  {branch.branch_name}
                  {isDefaultBranch(branch) && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                      Default
                    </span>
                  )}
                </CardTitle>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(branch)}
                    disabled={deletingId === branch.id}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (isDefaultBranch(branch)) {
                        toast.error("Set another warehouse as default before deleting this warehouse.");
                        return;
                      }
                      setBranchToDelete(branch);
                    }}
                    disabled={deletingId === branch.id || isDefaultBranch(branch)}
                    title={
                      isDefaultBranch(branch)
                        ? "Set another warehouse as default before deleting this warehouse"
                        : "Delete branch"
                    }
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === branch.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Hash className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>
                      Warehouse ID:{" "}
                      <span className="font-semibold text-gray-800 tabular-nums">
                        {branch.id}
                      </span>
                      {branch.branch_id &&
                        String(branch.branch_id) !== String(branch.id) && (
                          <span className="text-gray-500 font-normal">
                            {" "}
                            ({branch.branch_id})
                          </span>
                        )}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                    <span>{branch.address}, {branch.state}</span>
                  </div>
                  {branch.crm && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>CRM: {branch.crm}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showModal &&
        createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {editingBranch ? "Edit Warehouse" : "Add New Warehouse"}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {editingBranch
                      ? "Update warehouse information"
                      : "Create a new warehouse"}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Warehouse Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="branch_name"
                      required
                      value={formData.branch_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="Main Warehouse"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="state"
                      required
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CRM (Optional)
                    </label>
                    <input
                      name="crm"
                      value={formData.crm}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-start gap-3 p-3 rounded-md border border-gray-200 bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        name="is_default"
                        checked={formData.is_default}
                        onChange={handleInputChange}
                        disabled={!!editingDefaultBranch}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-700">
                          Set as default warehouse
                        </span>
                        <span className="block text-xs text-gray-500">
                          {editingDefaultBranch
                            ? "A business must always have one default warehouse. Set another warehouse as default to change it."
                            : "The default warehouse is preselected in sales and inventory. Only one warehouse can be default."}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting
                    ? editingBranch
                      ? "Updating..."
                      : "Creating..."
                    : editingBranch
                    ? "Update Warehouse"
                    : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* Delete Confirmation Modal */}
      {branchToDelete &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Trash2 className="h-5 w-5" />
                      Confirm Delete
                    </h3>
                    <p className="text-red-100 text-sm mt-1">
                      This action cannot be undone
                    </p>
                  </div>
                  <button
                    onClick={() => !deletingId && setBranchToDelete(null)}
                    className="p-1.5 hover:bg-white/20 rounded transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete the following warehouse?
                </p>
                <div className="p-3 bg-gray-100 rounded-lg space-y-1 text-sm">
                  <p>
                    <strong>Warehouse:</strong> {branchToDelete.branch_name || "—"}
                  </p>
                  <p>
                    <strong>Warehouse ID:</strong> {branchToDelete.id ?? "—"}
                    {branchToDelete.branch_id &&
                      String(branchToDelete.branch_id) !==
                        String(branchToDelete.id) && (
                        <span className="text-gray-500">
                          {" "}
                          ({branchToDelete.branch_id})
                        </span>
                      )}
                  </p>
                  <p>
                    <strong>Address:</strong> {branchToDelete.address || "—"}
                    {branchToDelete.state ? `, ${branchToDelete.state}` : ""}
                  </p>
                </div>
                <p className="text-red-600 text-sm mt-3">
                  <strong>Warning:</strong> This will permanently delete the
                  branch.
                </p>
              </div>

              {/* Footer */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBranchToDelete(null)}
                  disabled={!!deletingId}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={!!deletingId}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deletingId && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deletingId ? "Deleting..." : "Delete Warehouse"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
