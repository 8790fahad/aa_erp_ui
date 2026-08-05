import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { X } from "lucide-react";
import { Input, Label } from "reactstrap/lib";
import CustomButton from "@/common/Custom/CustomButton";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { formatNumber1 } from "@/components/router/utilities";

const CashFlowForm = ({ closeModal, showModal, getList, onSuccess }) => {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [chartOfAccount, setChartOfAccount] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    transfer_from: "",
    transfer_to: "",
    amount: "",
    remarks: "",
  });

  // Helper function to get initial form values
  const getInitialFormValues = () => ({
    transfer_from: "",
    transfer_to: "",
    amount: null,
    remarks: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [form, setForm] = useState(getInitialFormValues());

  const facilityId = useSelector((state) => state.auth.activeBusiness.id);

  const handleChange = ({ target: { name, value } }) => {
    // Validate amount to ensure it's a positive number
    if (name === "amount" && value !== "" && value !== null) {
      const numValue = parseFloat(value);
      if (numValue <= 0) {
        setErrors((prev) => ({
          ...prev,
          amount: "Amount must be greater than zero",
        }));
        return;
      } else {
        setErrors((prev) => ({
          ...prev,
          amount: "",
        }));
      }
    }

    setForm((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const getChartOfAccount = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/account/chart-of-accounts/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          const results = Array.isArray(resp.results) ? resp.results : [];
          const normalized = results.map((acc) => ({
            ...acc,
            head: acc.head || acc.account_code || acc.code || "",
          }));
          setChartOfAccount(normalized.filter((acc) => !!acc.head));
        }
      },
      (err) => {
        console.error("Error fetching chart of accounts:", err);
        setChartOfAccount([]);
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    getChartOfAccount();
  }, [getChartOfAccount]);

  const success_callback = () => {
    setLoading(false);
    // Reset form with initial state values
    setForm(getInitialFormValues());
    setErrors({});
    closeModal();
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Reset errors
    setErrors({});

    // Validate required fields
    const newErrors = {};
    if (!form.transfer_from) {
      newErrors.transfer_from = "Transfer from account is required";
    }
    if (!form.transfer_to) {
      newErrors.transfer_to = "Transfer to account is required";
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      newErrors.amount = "Amount must be greater than zero";
    }

    // If there are errors, set them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields correctly");
      return;
    }

    setLoading(true);

    let obj = {
      ...form,
      query_type: "transfer",
      facilityId,
      created_by: user.id,
    };

    _postApi(
      `/cash-transfer`,
      obj,
      (res) => {
        if (res.success) {
          getList();
          toast.success(
            `Cash transfer of ₦${formatNumber1(form.amount)} successful`
          );
          success_callback();
        } else {
          setLoading(false);
          toast.error(res.message);
          return;
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        toast.error("An error occurred during cash transfer!");
      }
    );
  };

  // Find selected accounts based on form values
  const selectedTransferFrom = chartOfAccount.find(
    (account) => account.head === form.transfer_from
  );
  const selectedTransferTo = chartOfAccount.find(
    (account) => account.head === form.transfer_to
  );

  return (
    <>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Move Cash</h3>
                  <p className="text-green-100 text-sm mt-1">
                    Transfer funds between accounts
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="p-6 flex-1 overflow-y-auto">
                {/* Date and Amount on same line */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label
                      htmlFor="date"
                      className="text-sm font-semibold text-gray-700 mb-1 block"
                    >
                      Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      name="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="amount"
                      className="text-sm font-semibold text-gray-700 mb-1 block"
                    >
                      Amount (₦{formatNumber1(form.amount)})<span className="text-red-500">*</span>
                    </Label>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      placeholder="Enter amount"
                      value={form.amount || ""}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        errors.amount ? "border-red-500" : "border-gray-300"
                      }`}
                    />
                    {errors.amount && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.amount}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Transfer From Account */}
                  <div className="mb-4">
                    <Label
                      htmlFor="transfer_from"
                      className="text-sm font-semibold text-gray-700 mb-2 block"
                    >
                      Transfer funds from{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <TypeaheadCustom
                      options={chartOfAccount}
                      placeholder={`Select source account`}
                      labelKey={(i) => `${i.description} - (${i.head})`}
                      onChange={(selectedItems) => {
                        if (selectedItems.length > 0) {
                          setForm((prev) => ({
                            ...prev,
                            transfer_from: selectedItems[0].head,
                          }));
                        } else {
                          setForm((prev) => ({
                            ...prev,
                            transfer_from: "",
                          }));
                        }
                      }}
                      fixed={true}
                      flip={true}
                      selected={
                        selectedTransferFrom ? [selectedTransferFrom] : []
                      }
                    />
                    {errors.transfer_from && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.transfer_from}
                      </p>
                    )}
                  </div>

                  {/* Transfer To Account */}
                  <div className="mb-4">
                    <Label
                      htmlFor="transfer_to"
                      className="text-sm font-semibold text-gray-700 mb-2 block"
                    >
                      Transfer funds to <span className="text-red-500">*</span>
                    </Label>
                    <TypeaheadCustom
                      options={chartOfAccount}
                      placeholder={`Select destination account`}
                      labelKey={(i) => `${i.description} - (${i.head})`}
                      onChange={(selectedItems) => {
                        if (selectedItems.length > 0) {
                          setForm((prev) => ({
                            ...prev,
                            transfer_to: selectedItems[0].head,
                          }));
                        } else {
                          setForm((prev) => ({
                            ...prev,
                            transfer_to: "",
                          }));
                        }
                      }}
                      fixed={true}
                      flip={true}
                      selected={selectedTransferTo ? [selectedTransferTo] : []}
                    />
                    {errors.transfer_to && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.transfer_to}
                      </p>
                    )}
                  </div>
                </div>

                {/* Remarks */}
                <div className="mb-4">
                  <Label
                    htmlFor="remarks"
                    className="text-sm font-semibold text-gray-700 mb-1 block"
                  >
                    Remarks
                  </Label>
                  <textarea
                    id="remarks"
                    name="remarks"
                    placeholder="Enter remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {errors.remarks && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.remarks}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                  disabled={loading}
                >
                  Close
                </button>
                <CustomButton
                  loading={loading}
                  size="2"
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  Move Cash
                </CustomButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CashFlowForm;
