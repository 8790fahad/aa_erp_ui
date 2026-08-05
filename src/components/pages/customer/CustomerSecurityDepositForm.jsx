import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
import SearchCustomerInput from "./components/SearchCustomerInput";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";

// Constants
const DOCUMENT_PREFIX = "CSD";
const FORM_VALIDATION_RULES = {
  customer: { required: true, message: "Please select a customer" },
  product: {
    required: true,
    message: "Please select a returnable item",
  },
  quantity: {
    required: true,
    message: "Please enter quantity",
  },
  mode_of_payment: {
    required: true,
    message: "Please select a payment method",
  },
  bank_account: {
    required: true,
    message: "Please select a bank account",
  },
  date: { required: true, message: "Date is required" },
};

const methods_of_payment = [
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "bank", label: "Bank Transfer" },
];

const CustomerSecurityDepositForm = () => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Redux state
  const { activeBusiness, user } = useSelector((state) => state.auth);

  // Get transaction type data from navigation state
  const transactionType = location.state?.transactionType || {};
  const lineOfBusiness = transactionType.line_of_business || false;

  // Local state
  const [selectedCustomer, setSelectedCustomer] = useState([]);
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    reference_number: `${DOCUMENT_PREFIX}-${String(Date.now()).slice(-6)}`,
    mode_of_payment: "",
    bank_account_id: "",
    cheque_number: "",
    product_id: "",
    product_name: "",
    quantity: 1,
    deposit_amount: 0,
    total_amount: 0,
    line_of_business: lineOfBusiness, // Add line of business field
  });

  const [returnableProducts, setReturnableProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Fetch returnable asset products
  const fetchReturnableProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/products/get-by-item-type/${activeBusiness.id}?item_type=Returnable Assets`,
      (response) => {
        if (response.success) {
          setReturnableProducts(response.data || []);
        } else {
          toast.error("Failed to load returnable products");
        }
      },
      (error) => {
        console.error("Error loading returnable products:", error);
        toast.error("Error loading returnable products");
      }
    );
  }, [activeBusiness?.id]);

  // Fetch account list based on payment mode
  const fetchAccountList = useCallback(async () => {
    if (!activeBusiness?.id || !form.mode_of_payment) return;

    try {
      const response = await new Promise((resolve, reject) => {
        _postApi(
          `/inventory/product-list?query_type=${form.mode_of_payment}`,
          { facilityId: activeBusiness.id },
          resolve,
          reject
        );
      });

      if (response.success) {
        setAccountList(response.results);
      } else {
        toast.error("Failed to load account list");
      }
    } catch (error) {
      console.error("Account list API Error:", error);
      toast.error("Error loading account list");
    }
  }, [activeBusiness?.id, form.mode_of_payment]);

  // Generate reference number
  const getReferenceNum = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/get-and-update/cus_sec_dep/${activeBusiness.id}`,
      (resp) => {
        console.log("Reference Number API Response:", resp);
        if (resp.success && resp.results) {
          // Ensure results is a number or string, not an object
          const resultValue =
            typeof resp.results === "object"
              ? resp.results.value ||
                resp.results.number ||
                String(Date.now()).slice(-6)
              : resp.results;

          const randomNum = String(resultValue).padStart(5, "0");
          const refNumber = `${DOCUMENT_PREFIX}-${randomNum}`;
          console.log("Generated Reference Number:", refNumber);
          setForm((prev) => ({ ...prev, reference_number: refNumber }));
        }
      },
      (err) => {
        console.error("Error generating reference number:", err);
        // Keep the default timestamp-based reference number on error
      }
    );
  }, [activeBusiness?.id]);

  // Initialize
  useEffect(() => {
    fetchReturnableProducts();
    getReferenceNum();
  }, [fetchReturnableProducts, getReferenceNum]);

  useEffect(() => {
    if (form.mode_of_payment) {
      fetchAccountList();
    }
  }, [form.mode_of_payment, fetchAccountList]);

  // Event handlers
  const handleCustomerChange = async (customer) => {
    setSelectedCustomer(customer);
    if (errors.customer) {
      setErrors((prev) => ({ ...prev, customer: "" }));
    }
  };

  const handleProductChange = (selected) => {
    setSelectedProduct(selected);

    if (selected && selected.length > 0) {
      const product = selected[0];
      // Use selling_price as the deposit amount since that's what the user pays
      const depositAmount = parseFloat(product.selling_price || 0);
      const totalAmount = form.quantity * depositAmount;

      setForm((prev) => ({
        ...prev,
        product_id: product.id,
        product_name: product.name,
        deposit_amount: depositAmount,
        total_amount: totalAmount,
      }));

      if (errors.product) {
        setErrors((prev) => ({ ...prev, product: "" }));
      }
    } else {
      // Clear product selection
      setForm((prev) => ({
        ...prev,
        product_id: "",
        product_name: "",
        deposit_amount: 0,
        total_amount: 0,
      }));
    }
  };

  const handleQuantityChange = (quantity) => {
    const qty = parseFloat(quantity) || 1;
    const totalAmount = qty * form.deposit_amount;

    setForm((prev) => ({
      ...prev,
      quantity: qty,
      total_amount: totalAmount,
    }));

    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: "" }));
    }
  };

  const handleFormChange = ({ target: { name, value } }) => {
    if (form.mode_of_payment === "cash") {
      const selected = accountList.find(
        (account) => Number(account.head) === Number(value)
      );
      setForm((prev) => ({
        ...prev,
        [name]: value,
        bank_account_id: selected?.id || "",
      }));
    } else if (
      form.mode_of_payment === "cheque" ||
      form.mode_of_payment === "bank"
    ) {
      const selected = accountList.find(
        (account) => Number(account.id) === Number(value)
      );
      if (selected) {
        setForm((prev) => ({
          ...prev,
          [name]: value,
          bank_account_id: value,
        }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = useCallback(() => {
    const newErrors = {};

    // Validate customer selection
    if (!selectedCustomer[0]) {
      newErrors.customer = FORM_VALIDATION_RULES.customer.message;
    }

    // Validate product selection
    if (!form.product_id) {
      newErrors.product = FORM_VALIDATION_RULES.product.message;
    }

    // Validate quantity
    if (!form.quantity || form.quantity <= 0) {
      newErrors.quantity = FORM_VALIDATION_RULES.quantity.message;
    }

    // Validate payment method
    if (!form.mode_of_payment) {
      newErrors.mode_of_payment = FORM_VALIDATION_RULES.mode_of_payment.message;
    }

    // Validate bank account for bank/cheque payments
    if (
      (form.mode_of_payment === "bank" || form.mode_of_payment === "cheque") &&
      !form.bank_account_id
    ) {
      newErrors.bank_account = FORM_VALIDATION_RULES.bank_account.message;
    }

    // Validate date
    if (!form.date) {
      newErrors.date = FORM_VALIDATION_RULES.date.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedCustomer, form]);

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fix the form errors before submitting");
      return;
    }

    setLoading(true);

    const depositData = {
      customerNo: selectedCustomer[0].customerNo,
      facilityId: activeBusiness.id,
      amount: form.total_amount,
      mode_of_payment: form.mode_of_payment,
      bank_account_id: form.bank_account_id,
      reference_number: form.reference_number,
      created_by: user.id,
      product_id: form.product_id,
      quantity: form.quantity,
      deposit_amount: form.deposit_amount,
      total_amount: form.total_amount,
      transaction_date: form.date,
      cheque_number: form.cheque_number || null,
      line_of_business: form.line_of_business, // Add line of business field
    };

    console.log("Security Deposit Data:", JSON.stringify(depositData, null, 2));
    console.log("Line of Business:", form.line_of_business);

    _postApi(
      `/api/customer-security-deposit`,
      depositData,
      (res) => {
        if (res.success) {
          toast.success("Security deposit created successfully");
          navigate(-1);
        } else {
          toast.error(res.message || "Failed to create security deposit");
        }
        setLoading(false);
      },
      (error) => {
        toast.error("Error creating security deposit");
        setLoading(false);
        console.error("Deposit error:", error);
      }
    );
  };

  // Render helpers
  const renderFormField = (label, children, errorKey) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {FORM_VALIDATION_RULES[errorKey]?.required && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </label>
      {children}
      {errors[errorKey] && (
        <div className="flex items-center gap-1 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          {errors[errorKey]}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-2">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={loading}
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Customer Security Deposit
            </h1>
            <p className="text-gray-600">
              Record security deposits for returnable assets
            </p>
          </div>
        </div>
      </div>

      {/* Line of Business Indicator */}
      {/* {transactionType && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${lineOfBusiness ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              Transaction Type: {transactionType.label}
            </span>
            <span className="text-sm text-gray-500">
              • Main Line of Business: {lineOfBusiness ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )} */}

      {/* Form */}
      <div className="p-2">
        <div className="space-y-6 mb-8">
          {/* First row - Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Reference Number */}
            {renderFormField(
              "Reference Number",
              <input
                type="text"
                value={String(form.reference_number || "")}
                className="w-full px-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                readOnly
              />,
              "reference_number"
            )}

            {/* Date */}
            {renderFormField(
              "Transaction Date",
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                required
                disabled={loading}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />,
              "date"
            )}

            {/* Customer Selection */}
            {renderFormField(
              "Select Customer",
              <SearchCustomerInput
                label="Select Customer"
                onChange={handleCustomerChange}
                disabled={loading}
              />,
              "customer"
            )}
          </div>

          {/* Returnable Item Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Product Selection */}
            {renderFormField(
              "Returnable Item",
              <Typeahead
                id="returnable-product-typeahead"
                labelKey={(option) =>
                  `${option.name} - ₦${formatNumber1(
                    option.selling_price || 0
                  )}`
                }
                options={returnableProducts}
                placeholder="Search returnable item..."
                selected={selectedProduct}
                onChange={handleProductChange}
                disabled={loading}
                inputProps={{
                  className: "form-control",
                }}
              />,
              "product"
            )}

            {/* Quantity */}
            {renderFormField(
              "Quantity",
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                min="1"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />,
              "quantity"
            )}

            {/* Total Deposit Amount */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Total Deposit Amount
              </label>
              <input
                type="text"
                value={`₦${formatNumber1(form.total_amount || 0)}`}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                readOnly
              />
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Mode of Payment */}
            {renderFormField(
              "Mode of Payment",
              <select
                name="mode_of_payment"
                value={form.mode_of_payment}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mode_of_payment: e.target.value,
                    bank_account_id: "",
                  }))
                }
                disabled={loading}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Mode of Payment</option>
                {methods_of_payment.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>,
              "mode_of_payment"
            )}

            {/* Bank Account Selection */}
            {(form.mode_of_payment === "bank" ||
              form.mode_of_payment === "cheque") && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Bank Account
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  name="bank_account_id"
                  value={form.bank_account_id}
                  onChange={handleFormChange}
                  disabled={loading}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select account...</option>
                  {accountList.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.description} ({account.account_number})
                    </option>
                  ))}
                </select>
                {errors.bank_account && (
                  <div className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {errors.bank_account}
                  </div>
                )}
              </div>
            )}

            {form.mode_of_payment === "cash" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Cash Account Head
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  name="bank_account_id"
                  value={form.bank_account_id}
                  onChange={handleFormChange}
                  disabled={loading}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select account...</option>
                  {accountList.map((account) => (
                    <option key={account.head} value={account.head}>
                      {account.description} ({account.head})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cheque Number */}
            {form.mode_of_payment === "cheque" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Cheque Number
                </label>
                <input
                  type="text"
                  name="cheque_number"
                  value={form.cheque_number}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      cheque_number: e.target.value,
                    }))
                  }
                  disabled={loading}
                  placeholder="Enter cheque number"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Summary Card */}
        {selectedCustomer[0] && form.product_id && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-3">
              Security Deposit Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Customer:</span>
                <span className="ml-2 font-medium">
                  {selectedCustomer[0].fullname}
                </span>
              </div>
              <div>
                <span className="text-blue-600">Item:</span>
                <span className="ml-2 font-medium">{form.product_name}</span>
              </div>
              <div>
                <span className="text-blue-600">Quantity:</span>
                <span className="ml-2 font-medium">{form.quantity}</span>
              </div>
              <div>
                <span className="text-blue-600">Total Deposit:</span>
                <span className="ml-2 font-medium text-lg">
                  ₦{formatNumber1(form.total_amount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={loading}
            className="px-6 py-2 shadow-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#5C7FC1] shadow-none hover:bg-[#4267B2] text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Security Deposit
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomerSecurityDepositForm;
