/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import { _deleteApi, _postApi } from "@/redux/actions/api";

import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "reactstrap";
import { useSelector } from "react-redux";
import { Edit2, Eye, Loader, Plus, Search, Trash2, X } from "lucide-react";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { toast } from "sonner";
import { Typeahead } from "react-bootstrap-typeahead";

export default function DiscountTable({ embedded = false }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showDeleteDiscount, setShowDeleteDiscount] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [formData, setFormData] = useState({
    discountName: "",
    discountType: "",
    customerType: "",
    value: "",
    minOrderAmount: 0,
    status: "active",
    discountAccountHead: "",
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [discounts, setDiscounts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountHead, setSelectedAccountHead] = useState([]);
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);

  const handleEdit = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      discountName: discount.discount_name,
      discountId: discount.discount_id,
      discountType: discount.discount_type,
      value: discount.value,
      status: discount.status,
      discountAccountHead: discount.discount_account_head || "",
      minOrderAmount: discount.min_order_amount ?? 0,
      customerType: discount.customer_type || "",
    });

    // Set selected account for Typeahead
    if (discount.discount_account_head) {
      const matchingAccount = accounts.find(
        (acc) => acc.head === discount.discount_account_head
      );
      if (matchingAccount) {
        setSelectedAccountHead([matchingAccount]);
      }
    }

    setIsModalOpen(true);
  };

  const validateForm = () => {
    if (!formData.discountName.trim()) {
      toast.error("Discount name is required");
      return false;
    }
    if (!formData.value.trim()) {
      toast.error("Value is required");
      return false;
    }
    if (!formData.discountType) {
      toast.error("Discount type is required");
      return false;
    }
    if (!formData.discountAccountHead) {
      toast.error("Discount account head is required");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    setLoading2(true);

    _postApi(
      `/v1/materials/insertDiscountSetup`,
      {
        discountName: formData.discountName,
        discountType: formData.discountType,
        value: formData.value,
        status: formData.status,
        discountAccountHead: formData.discountAccountHead,
        minOrderAmount: formData.minOrderAmount || 0,
        customerType: formData.customerType || "",
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Discount setup submitted successfully");
          handleCancel();
          getDiscounts();
        } else {
          toast.error(res.message || "Failed to submit");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleSubmitEdit = () => {
    if (!validateForm()) return;
    setLoading2(true);
    _postApi(
      `/v1/materials/editDiscountSetup`,
      {
        discountId: formData.discountId,
        discountName: formData.discountName,
        discountType: formData.discountType,
        value: formData.value,
        status: formData.status,
        discountAccountHead: formData.discountAccountHead,
        minOrderAmount: formData.minOrderAmount || 0,
        customerType: formData.customerType || "",
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Discount setup submitted successfully");
          handleCancel();
          getDiscounts();
        } else {
          toast.error(res.message || "Failed to submit");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while submitting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleDelete = (discount) => {
    setLoading2(true);
    _deleteApi(
      "/v1/materials/delete-discount",
      {
        discountId: discount.discount_id,
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Discount setup deleted successfully");
          handleCancel();
          getDiscounts();
        } else {
          toast.error(res.message || "Failed to delete");
          setLoading2(false);
        }
      },
      (err) => {
        toast.error("An error occurred while deleting");
        console.error(err);
        setLoading2(false);
      }
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingDiscount();
    setLoading2(false);
    setSelectedAccountHead([]);
    setFormData({
      discountName: "",
      discountType: "",
      customerType: "",
      value: "",
      minOrderAmount: 0,
      status: "active",
      discountAccountHead: "",
    });
  };

  const handleView = (user) => {
    setSelectedUser(user);
    setShowDiscountModal(true);
  };

  const handleShowDelete = (user) => {
    setSelectedUser(user);
    setShowDeleteDiscount(true);
  };

  const loadAccounts = useCallback(() => {
    if (!activeBusiness?.business_name) return;
    _postApi(
      `/account/chart-of-account?query_type=select`,
      { store: activeBusiness.business_name },
      (resp) => {
        if (resp.success) {
          // Filter out accounts with head = 0
          setAccounts(
            resp.results.filter((account) => account.head != 0) || []
          );
        } else {
          console.error("Failed to load accounts:", resp.message);
          setAccounts([]);
        }
      },
      (err) => {
        console.error("API Error:", err);
        setAccounts([]);
      }
    );
  }, [activeBusiness?.business_name]);

  const getDiscounts = useCallback(() => {
    _postApi(
      `/v1/materials/getDiscountSetup`,
      {
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success && res.results) {
          setDiscounts(res.results);
        }
        setLoading(false);
      },
      (err) => {
        toast.error("Error Occurred");
        console.error(err);
        setLoading(false);
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    getDiscounts();
    loadAccounts();
  }, [getDiscounts, loadAccounts]);

  const getStatusBadge = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      disabled: "bg-red-100 text-red-800",
    };
    return `px-3 py-1 rounded-full text-xs font-medium ${
      colors[status.toLowerCase()]
    }`;
  };

  const fields = [
    {
      title: "Discount Name",
      custom: true,
      className: "text-",
      component: (item) => <div className="text-">{item.discount_name}</div>,
    },
    {
      title: "Value",
      custom: true,
      className: "text-",
      component: (item) => (
        <div>
          {item.value} {item.discount_type === "Percentage" ? "%" : null}
        </div>
      ),
    },
    {
      title: "Account Head",
      custom: true,
      className: "text-",
      component: (item) => (
        <div className="text-">{item.discount_account_head || "N/A"}</div>
      ),
    },
    {
      title: "Min Order",
      custom: true,
      className: "text-",
      component: (item) => (
        <div className="text-">
          {parseFloat(item.min_order_amount || 0) > 0
            ? item.min_order_amount
            : "—"}
        </div>
      ),
    },
    {
      title: "Customer Type",
      custom: true,
      className: "text-",
      component: (item) => (
        <div className="text-">{item.customer_type || "All"}</div>
      ),
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <span className={`${getStatusBadge(item.status)}`}>
            {item.status}
          </span>
        </div>
      ),
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <button
            onClick={() => handleEdit(item)}
            className="p-2 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
            title="Edit discount"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleView(item)}
            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
            title="View discount"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleShowDelete(item)}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            title="Delete discount"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredDiscounts = discounts.filter((discount) => {
    return searchTerm
      ? discount.discount_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          discount.value.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });

  return (
    <>
      <div className={embedded ? "pb-2" : "min-h-screen "}>
        <div className="max-w-7xl mx-auto">
          <div className=" ">
            <div className="p-">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  Discount Setup
                </h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Total :{" "}
                    <span className="font-semibold text-gray-900">
                      {discounts.length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Active:{" "}
                    <span className="font-semibold text-green-600">
                      {discounts.filter((u) => u.status === "active").length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Disabled:{" "}
                    <span className="font-semibold text-yellow-800">
                      {discounts.filter((u) => u.status === "disabled").length}
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
                  placeholder="Search discount by name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <CustomButton onClick={() => setIsModalOpen(true)}>
                <Plus className="w-5 h-5" />
                Setup discount
              </CustomButton>
            </div>

            <div className="overflow-x-auto">
              {loading && <Loader />}
              {!loading ? (
                <CustomTable1 data={filteredDiscounts} fields={fields} />
              ) : (
                <Alert className="mt-3" color="info">
                  No data to view
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingDiscount ? "Edit Discount" : "Add New Discount"}
                </h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.discountName}
                    onChange={(e) =>
                      setFormData({ ...formData, discountName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Order Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.minOrderAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, minOrderAmount: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Discount Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.discountType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountType: e.target.value,
                        })
                      }
                    >
                      <option value="">Select discount type</option>
                      <option value="Percentage">Percentage</option>
                      <option value="Fixed">Fixed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.value}
                      onChange={(e) =>
                        setFormData({ ...formData, value: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Type
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.customerType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customerType: e.target.value,
                      })
                    }
                  >
                    <option value="">All customer types</option>
                    <option value="partners">Partners</option>
                    <option value="directors">Directors</option>
                    <option value="customers">Customers</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Account Head{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Typeahead
                    id="discount-account-typeahead"
                    options={accounts}
                    className="z-100"
                    placeholder="Select discount account head"
                    required
                    selected={selectedAccountHead}
                    onChange={(selected) => {
                      setSelectedAccountHead(selected);
                      setFormData({
                        ...formData,
                        discountAccountHead: selected[0]?.head || "",
                      });
                    }}
                    labelKey={(option) =>
                      `${option.description} - (${option.head})`
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <CustomButton
                    type="button"
                    onClick={() =>
                      editingDiscount ? handleSubmitEdit() : handleSubmit()
                    }
                    disabled={loading2}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading2 ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mx-auto" />
                      </>
                    ) : editingDiscount ? (
                      "Update discount"
                    ) : (
                      "Create discount"
                    )}
                  </CustomButton>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDiscountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  View discount details
                </h2>
                <button
                  onClick={() => setShowDiscountModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {selectedUser?.discount_name?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedUser?.discount_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedUser?.value}
                    </p>
                    <p className="text-xs text-gray-500">
                      Current Status:{" "}
                      <span
                        className={`font-medium ${
                          selectedUser?.status === "active"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedUser?.status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-md font-medium text-gray-700 mb-3">
                    Discount ID:{" "}
                    <span className="fw-bold">{selectedUser?.discount_id}</span>
                  </p>
                  <p className="text-md font-medium text-gray-700 mb-3">
                    Discount type:{" "}
                    <span className="fw-bold">
                      {selectedUser?.discount_type}
                    </span>
                  </p>
                  <p className="text-md font-medium text-gray-700 mb-3">
                    Discount Account Head:{" "}
                    <span className="fw-bold">
                      {selectedUser?.discount_account_head || "N/A"}
                    </span>
                  </p>
                  <p className="text-md font-medium text-gray-700 mb-3">
                    Customer type:{" "}
                    <span className="fw-bold">
                      {selectedUser?.customer_type}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscountModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteDiscount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Confirm Delete
                </h2>
                <button
                  onClick={() => setShowDeleteDiscount(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete the following discount?
                </p>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p>
                    <strong>Discount Name:</strong>{" "}
                    {selectedUser?.discount_name}
                  </p>
                  <p>
                    <strong>Value:</strong> {selectedUser?.value}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedUser?.status}
                  </p>
                  <p>
                    <strong>Discount ID:</strong> {selectedUser?.discount_id}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleDelete(selectedUser);
                    setShowDeleteDiscount(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteDiscount(false)}
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
}
