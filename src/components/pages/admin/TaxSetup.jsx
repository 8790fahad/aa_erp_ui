import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Plus, Search, X, Loader, MoreVerticalIcon } from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import CustomButton from "@/common/Custom/CustomButton";
import { _fetchApi, _postApi, _deleteApi, _putApi } from "@/redux/actions/api";
import { Alert } from "reactstrap";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Typeahead } from "react-bootstrap-typeahead";
import { formatNumber } from "@/utilities";

const TaxSetup = ({ embedded = false }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [selectedTax, setSelectedTax] = useState(null);
  const [taxes, setTaxes] = useState([]);
  const [existingCodes, setExistingCodes] = useState([]);
  const [formData, setFormData] = useState({
    subhead: "",
    rate_type: "",
    rate: "",
    description: "",
    tax_category: "",
    inclusive_type: "",
  });

  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);

  const handleEdit = (tax) => {
    setEditingTax(tax);
    setFormData({
      subhead: tax.head || tax.account_sub_head || "",
      rate_type: tax.rate_type || "",
      rate: tax.rate || "",
      description: tax.description || "",
      id: tax.id,
      tax_category: tax.tax_category || tax.category || "",
      inclusive_type: tax.inclusive_type || tax.inclusive || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    // Validate all required fields
    if (!formData.subhead) {
      toast.error("Please select account subhead");
      return;
    }
    if (!formData.rate_type) {
      toast.error("Please select rate type");
      return;
    }
    if (!formData.rate) {
      toast.error("Please enter rate");
      return;
    }
    if (!formData.description) {
      toast.error("Please enter description");
      return;
    }
    if (!formData.tax_category) {
      toast.error("Please select tax category");
      return;
    }
    if (!formData.inclusive_type) {
      toast.error("Please select tax inclusive/exclusive type");
      return;
    }

    setLoading2(true);

    // Prepare data according to backend schema
    const taxData = {
      head: null, // Set head to null as requested
      account_sub_head: formData.subhead,
      description: formData.description,
      rate_type: formData.rate_type,
      rate: formData.rate,
      facilityId: activeBusiness.id,
      createdBy: currentUser.id,
      tax_category: formData.tax_category,
      inclusive_type: formData.inclusive_type,
    };

    if (editingTax) {
      // Update existing tax
      _putApi(
        `/api/taxes/${editingTax.id}`,
        taxData,
        (res) => {
          if (res.success) {
            toast.success(res.message || "Tax updated successfully");
            handleCancel();
            getTaxes();
          } else {
            toast.error(res.message || "Failed to update tax");
            setLoading2(false);
          }
        },
        (err) => {
          toast.error("An error occurred while updating tax");
          console.error(err);
          setLoading2(false);
        }
      );
    } else {
      // Create new tax
      _postApi(
        "/api/taxes",
        taxData,
        (res) => {
          if (res.success) {
            toast.success(res.message || "Tax created successfully");
            handleCancel();
            getTaxes();
          } else {
            toast.error(res.message || "Failed to create tax");
            setLoading2(false);
          }
        },
        (err) => {
          toast.error("An error occurred while creating tax");
          console.error(err);
          setLoading2(false);
        }
      );
    }
  };

  const handleDelete = (tax) => {
    setLoading2(true);
    _deleteApi(
      `/api/taxes/${tax.id}?facilityId=${activeBusiness.id}`,
      {},
      (res) => {
        if (res.success) {
          toast.success(res.message || "Tax deleted successfully");
          setShowDeleteModal(false);
          setSelectedTax(null);
          setLoading2(false);
          getTaxes();
        } else {
          toast.error(res.message || "Failed to delete tax");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while deleting tax");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setShowDeleteModal(false);
    setEditingTax(null);
    setSelectedTax(null);
    setLoading2(false);
    setFormData({
      subhead: "",
      rate_type: "",
      rate: "",
      description: "",
      tax_category: "",
      inclusive_type: "",
    });
  };

  const handleShowDelete = (tax) => {
    setSelectedTax(tax);
    setShowDeleteModal(true);
  };

  const getTaxes = useCallback(() => {
    setLoading(true);
    _fetchApi(
      `/api/taxes?facilityId=${activeBusiness.id}`,
      (data) => {
        if (data.success) {
          setTaxes(data.results);
        } else {
          toast.error(data.message || "Failed to fetch taxes");
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("An error occurred while fetching taxes");
        setLoading(false);
      }
    );
  }, [activeBusiness.id]);

  const getExistingCodes = useCallback(() => {
    if (!activeBusiness?.business_name) return;

    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          setExistingCodes(resp.results.filter((account) => account.head != 0));
        } else {
          toast.error("Failed to load account codes.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching account codes.");
      }
    );
  }, [activeBusiness?.business_name]);

  useEffect(() => {
    getTaxes();
    getExistingCodes();
  }, [getTaxes, getExistingCodes]);

  const fetchGeneratedCode = (parentCode) => {
    if (!parentCode || !parentCode[0]) return;

    _postApi(
      "/account/generate-chart-of-account",
      {
        parent_code: parentCode[0],
        parent_description: parentCode[1],
        business_name: activeBusiness?.business_name,
      },
      (resp) => {
        if (resp.success) {
          console.log("Generated code:", resp.code);
        } else {
          toast.error("Failed to generate account code.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while generating the code.");
      }
    );
  };

  const fields = [
    {
      title: "Description",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-gray-600">
          {item.description || "No description"}
        </div>
      ),
    },
    {
      title: "Rate",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-gray-900 font-medium">
          {item.rate_type === "percentage"
            ? `${item.rate}%`
            : `₦${formatNumber(item.rate)}`}
        </div>
      ),
    },
    {
      title: "Category",
      custom: true,
      component: (item) => (
        <div className="text-center text-sm font-medium text-gray-600">
          {item.tax_category || item.category || "Not specified"}
        </div>
      ),
    },
    {
      title: "Type",
      custom: true,
      component: (item) => {
        const inclusiveType = item.inclusive_type || item.inclusive || "";
        return (
          <div className="text-center">
            {inclusiveType === "inclusive" ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Inclusive
              </span>
            ) : inclusiveType === "exclusive" ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Exclusive
              </span>
            ) : (
              <span className="text-gray-400 text-xs">Not set</span>
            )}
          </div>
        );
      },
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center flex gap-1 justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => handleEdit(item)}>
                Edit Tax
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleShowDelete(item)}>
                Delete Tax
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const filteredTaxes = taxes.filter(
    (tax) =>
      tax.account_sub_head?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.rate_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.rate?.toString().includes(searchTerm) ||
      tax.inclusive_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.inclusive?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className={embedded ? "pb-2" : "min-h-screen"}>
        <div className="max-w-7xl mx-auto">
          <div className="">
            <div className="p-">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Manage Tax Setup
                </h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Total:{" "}
                    <span className="font-semibold text-gray-900">
                      {taxes.length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Percentage:{" "}
                    <span className="font-semibold text-blue-600">
                      {taxes.filter((t) => t.rate_type === "percentage").length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Fixed:{" "}
                    <span className="font-semibold text-green-600">
                      {taxes.filter((t) => t.rate_type === "fixed").length}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search taxes by subhead, description, rate type, or tax type..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <CustomButton onClick={() => setIsModalOpen(true)}>
                <Plus className="w-5 h-5" />
                Add Tax
              </CustomButton>
            </div>

            <div className="overflow-x-auto">
              {loading && (
                <div className="flex mx-auto">
                  <Loader className="animate-spin w-7 h-7 mx-auto" />
                </div>
              )}
              {!loading ? (
                <CustomTable1
                  data={filteredTaxes}
                  fields={fields}
                  message="No taxes found"
                />
              ) : (
                <Alert className="mt-3 text-center" color="info">
                  Loading
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Tax Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header with Blue Gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">
                    {editingTax ? "Edit Tax" : "Tax Registration"}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {editingTax
                      ? "Update tax information"
                      : "Add new tax to your list"}
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Applies To <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.tax_category}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, tax_category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tax category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="purchase">
                        Purchase/Expenses
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    rows={3}
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Enter tax description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate Type <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.rate_type}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        rate_type: value,
                      });
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                    <div>
                      Rate <span className="text-red-500">*</span>
                    </div>
                    <div>
                      {formData.rate_type === "percentage" ? (
                        <span className="text-blue-600 font-medium">
                          {formatNumber(formData.rate)}%
                        </span>
                      ) : formData.rate_type === "fixed" ? (
                        <span className="text-green-600 font-medium">
                          ₦{formatNumber(formData.rate)}
                        </span>
                      ) : null}
                    </div>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.rate}
                    onChange={(e) =>
                      setFormData({ ...formData, rate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Inclusive/Exclusive <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.inclusive_type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, inclusive_type: value }))
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select inclusive/exclusive" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">Inclusive</SelectItem>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Inclusive: Tax is included in the price. Exclusive: Tax is added on top of the price.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Head <span className="text-red-500">*</span>
                  </label>
                  <Typeahead
                    id="material-typeahead"
                    options={existingCodes}
                    className="z-100"
                    placeholder="Select account head"
                    required
                    onChange={(selected) => {
                      const selectedSubhead = [
                        selected[0]?.head,
                        selected[0]?.description,
                      ];
                      setFormData((prev) => ({
                        ...prev,
                        subhead: selectedSubhead[0],
                      }));
                      fetchGeneratedCode(selectedSubhead);
                    }}
                    labelKey={(option) =>
                      `${option.description} - (${option.head})`
                    }
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer with Action Buttons */}
            <div className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading2}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading2 ? (
                  <>
                    <Loader className="animate-spin w-4 h-4" />
                    <span>Processing...</span>
                  </>
                ) : editingTax ? (
                  "Update Tax"
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Confirm Delete
                </h2>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete the following tax?
                </p>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p>
                    <strong>Rate:</strong>{" "}
                    {selectedTax?.rate_type === "percentage"
                      ? `${selectedTax?.rate}%`
                      : `₦${selectedTax?.rate}`}
                  </p>
                  <p>
                    <strong>Rate Type:</strong> {selectedTax?.rate_type}
                  </p>
                  <p>
                    <strong>Account Subhead:</strong>{" "}
                    {selectedTax?.account_sub_head || "Not assigned"}
                  </p>
                  <p>
                    <strong>Description:</strong>{" "}
                    {selectedTax?.description || "No description"}
                  </p>
                  <p>
                    <strong>Type:</strong>{" "}
                    {selectedTax?.inclusive_type || selectedTax?.inclusive
                      ? selectedTax?.inclusive_type === "inclusive" ||
                        selectedTax?.inclusive === "inclusive"
                        ? "Inclusive"
                        : "Exclusive"
                      : "Not set"}
                  </p>
                </div>
                <p className="text-red-600 text-sm mt-3">
                  <strong>Warning:</strong> This action cannot be undone. All
                  tax data will be permanently deleted.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete(selectedTax)}
                  disabled={loading2}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading2 ? (
                    <>
                      <Loader className="animate-spin w-4 h-4 mx-auto" />
                    </>
                  ) : (
                    "Delete Tax"
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaxSetup;
