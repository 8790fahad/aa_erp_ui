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

export default function RateTable({ embedded = false }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showDeleteRate, setShowDeleteRate] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [formData, setFormData] = useState({
    rate: "",
    rate_type: "",
    customer_type: "",
    amount: "",
    status: "active",
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [pr, setPr] = useState([]);
  const { user = {}, activeBusiness = {} } = useSelector((state) => state.auth);

  const handleEdit = (rate) => {
    setEditingRate(rate);
    setFormData({
      rate: rate.rate,
      rate_id: rate.rate_id,
      rate_type: rate.rate_type,
      customer_type: rate.customer_type,
      amount: rate.amount,
      status: rate.status,
    });
    setIsModalOpen(true);
  };

  const validateForm = () => {
  if (!formData.rate.trim()) {
    toast.error("Rate name is required");
    return false;
  }
  if (!formData.amount.trim()) {
    toast.error("Amount is required");
    return false;
  }
  if (!formData.rate_type) {
    toast.error("Rate type is required");
    return false;
  }
  if (!formData.customer_type) {
    toast.error("Customer type is required");
    return false;
  }
  return true;
};

  const handleSubmit = () => {
    if (!validateForm()) return;
    setLoading2(true);
    const data = [formData];
    _postApi(
      `/v1/materials/insertRateSetup`,
      {
        data,
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Rate setup submitted successfully");
          handleCancel();
          getPR();
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
      `/v1/materials/editRateSetup`,
      {
        rate_id: formData.rate_id,
        rate: formData.rate,
        rate_type: formData.rate_type,
        customer_type: formData.customer_type,
        amount: formData.amount,
        status: formData.status,
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Rate setup submitted successfully");
          handleCancel();
          getPR();
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

  const handleDelete = (rate) => {
    setLoading2(true);
    _deleteApi(
      "/v1/materials/delete-rate",
      {
        rate_id: rate.rate_id,
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Rate setup deleted successfully");
          handleCancel();
          getPR();
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
    setEditingRate();
    setLoading2(false);
    setFormData({
      rate: "",
      rate_type: "",
      customer_type: "",
      amount: "",
      status: "active",
    });
  };

  const handleView = (user) => {
    setSelectedUser(user);
    setShowRateModal(true);
  };

  const handleShowDelete = (user) => {
    setSelectedUser(user);
    setShowDeleteRate(true);
  };
  // const getStatusBadge = (status) => {
  //   const colors = {
  //     active: "bg-blue-100 text-green-800",
  //     disabled: "bg-red-100 text-red-800",
  //   };
  //   return `px-3 py-1 rounded-full text-xs font-medium ${colors[status]}`;
  // };

  const getPR = useCallback(() => {
    _postApi(
      `/v1/materials/getRateSetup`,
      {
        facilityId: activeBusiness?.id,
      },
      (res) => {
        if (res.success && res.results) {
          setPr(res.results);
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
    getPR();
  }, [getPR]);
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
      title: "Rate",
      custom: true,
      className: "text-",
      component: (item) => <div className="text-">{item.rate}</div>,
    },
    {
      title: "Amount",
      custom: true,
      className: "text-",
      component: (item) => <div>{item.amount}</div>,
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
            title="Edit rate"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleView(item)}
            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
            title="View rate"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleShowDelete(item)}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            title="View rate"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredPr = pr.filter((pr) => {
    return searchTerm
      ? pr.rate_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pr.amount.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
  });
  return (
    <>
      <div className={embedded ? "pb-2" : "min-h-screen "}>
        <div className="max-w-7xl mx-auto">
          <div className=" ">
            <div className="p-">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Rate Setup</h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    Total :{" "}
                    <span className="font-semibold text-gray-900">
                      {pr.length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Active:{" "}
                    <span className="font-semibold text-green-600">
                      {pr.filter((u) => u.status === "active").length}
                    </span>
                  </span>
                  <span className="text-sm text-gray-600">
                    Disabled:{" "}
                    <span className="font-semibold text-yellow-800">
                      {pr.filter((u) => u.status === "disabled").length}
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
                  placeholder="Search rate by name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <CustomButton onClick={() => setIsModalOpen(true)}>
                <Plus className="w-5 h-5" />
                Setup rate
              </CustomButton>
            </div>

            <div className="overflow-x-auto">
              {loading && <Loader />}
              {!loading ? (
                <CustomTable1 data={filteredPr} fields={fields} />
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
                  {editingRate ? "Edit Rate" : "Add New Rate"}
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
                    Rate Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.rate}
                    onChange={(e) =>
                      setFormData({ ...formData, rate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.status}
                      //  disabled={editingUser}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rate Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={formData.rate_type}
                      onChange={(e) =>
                        setFormData({ ...formData, rate_type: e.target.value })
                      }
                    >
                      <option value="">Select rate type</option>{" "}
                      {/* ✅ ADDED value="" */}
                      <option value="customer rate">Customer Rate</option>
                      <option value="operator rate">Operator Rate</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-transparent border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={formData.customer_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_type: e.target.value,
                      })
                    }
                  >
                    <option value="">Select customer type</option>{" "}
                    {/* ✅ ADDED value="" */}
                    <option value="partners">Partners</option>
                    <option value="directors">Directors</option>
                    <option value="customers">Customers</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <CustomButton
                    type="button"
                    onClick={() =>
                      editingRate ? handleSubmitEdit() : handleSubmit()
                    }
                    disabled={loading2}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading2 ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mx-auto" />
                      </>
                    ) : editingRate ? (
                      "Update rate"
                    ) : (
                      "Create rate"
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

      {showRateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  View rate details
                </h2>
                <button
                  onClick={() => setShowRateModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {selectedUser?.rate?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedUser?.rate}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedUser?.amount}
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
                    Rate ID:{" "}
                    <span className="fw-bold">{selectedUser?.rate_id}</span>
                  </p>
                  <p className="text-md font-medium text-gray-700 mb-3">
                    Rate type:{" "}
                    <span className="fw-bold">{selectedUser?.rate_type}</span>
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
                  onClick={() => setShowRateModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteRate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Confirm Delete
                </h2>
                <button
                  onClick={() => setShowDeleteRate(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to delete the following rate?
                </p>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p>
                    <strong>Rate:</strong> {selectedUser?.rate}
                  </p>
                  <p>
                    <strong>Amount:</strong> {selectedUser?.amount}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedUser?.status}
                  </p>
                  <p>
                    <strong>Rate ID:</strong> {selectedUser?.rate_id}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleDelete(selectedUser);
                    setShowDeleteRate(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors font-medium"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteRate(false)}
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
