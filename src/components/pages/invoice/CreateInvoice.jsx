import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  FileText,
  User,
  Package,
  Tag,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber1 } from "@/components/router/utilities";
import moment from "moment";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import Select from "react-select";

export default function CreateInvoice() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form state
  const [customer, setCustomer] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(moment().format("YYYY-MM-DD"));
  const [dueDate, setDueDate] = useState(
    moment().add(30, "days").format("YYYY-MM-DD")
  );
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("Thank you for your business.");

  // Line items
  const [lineItems, setLineItems] = useState([
    {
      id: Date.now(),
      product: null,
      description: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ]);

  // Tax and Discount
  const [selectedTax, setSelectedTax] = useState(null);
  const [selectedDiscount, setSelectedDiscount] = useState(null);

  // Data
  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);

  // Fetch products
  const fetchProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingProducts(true);
    _postApi(
      `/inventory/product-list-1?query_type=select`,
      {
        facilityId: activeBusiness.id,
      },
      (response) => {
        setLoadingProducts(false);
        if (response.success) {
          setProducts(response.results || []);
        } else {
          toast.error("Failed to load products");
        }
      },
      (error) => {
        setLoadingProducts(false);
        console.error("Error fetching products:", error);
        toast.error("Error fetching products");
      }
    );
  }, [activeBusiness?.id]);

  // Fetch taxes (Sales type)
  const fetchTaxes = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingTaxes(true);
    _fetchApi(
      `/api/get-taxes-by-category?facilityId=${activeBusiness.id}&tax_category=Sales`,
      (response) => {
        setLoadingTaxes(false);
        if (response.success) {
          setTaxes(response.results || []);
        } else {
          toast.error("Failed to load taxes");
        }
      },
      (error) => {
        setLoadingTaxes(false);
        console.error("Error fetching taxes:", error);
        toast.error("Error fetching taxes");
      }
    );
  }, [activeBusiness?.id]);

  // Fetch discounts
  const fetchDiscounts = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoadingDiscounts(true);
    _postApi(
      `/v1/materials/getDiscountSetup`,
      {
        facilityId: activeBusiness.id,
      },
      (response) => {
        setLoadingDiscounts(false);
        if (response.success) {
          setDiscounts(response.results || []);
        } else {
          toast.error("Failed to load discounts");
        }
      },
      (error) => {
        setLoadingDiscounts(false);
        console.error("Error fetching discounts:", error);
        toast.error("Error fetching discounts");
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchProducts();
    fetchTaxes();
    fetchDiscounts();
  }, [fetchProducts, fetchTaxes, fetchDiscounts]);

  // Generate invoice number
  useEffect(() => {
    if (!invoiceNumber && activeBusiness?.id) {
      _fetchApi(
        `/get-and-update/INVOICE/${activeBusiness.id}`,
        (response) => {
          if (response.success) {
            const num = `${response.results}`.padStart(5, "0");
            setInvoiceNumber(`INV-${num}`);
          }
        },
        (error) => {
          console.error("Error generating invoice number:", error);
        }
      );
    }
  }, [invoiceNumber, activeBusiness?.id]);

  // Calculate amounts
  const calculateLineItemAmount = (item) => {
    return (item.quantity || 0) * (item.rate || 0);
  };

  const subtotal = lineItems.reduce(
    (sum, item) => sum + calculateLineItemAmount(item),
    0
  );

  // Calculate discount
  let discountAmount = 0;
  if (selectedDiscount) {
    if (selectedDiscount.discount_type === "Percentage") {
      discountAmount = (subtotal * (selectedDiscount.value || 0)) / 100;
    } else {
      discountAmount = selectedDiscount.value || 0;
    }
  }

  const amountAfterDiscount = subtotal - discountAmount;

  // Calculate tax
  let taxAmount = 0;
  if (selectedTax && amountAfterDiscount > 0) {
    const taxRate = parseFloat(selectedTax.rate || 0);
    if (selectedTax.tax_type === "inclusive") {
      // Tax is included in the price
      taxAmount = (amountAfterDiscount * taxRate) / (100 + taxRate);
    } else {
      // Tax is exclusive (added on top)
      taxAmount = (amountAfterDiscount * taxRate) / 100;
    }
  }

  const total = amountAfterDiscount + taxAmount;

  // Handle line item changes
  const updateLineItem = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "product" && value) {
            updated.description = value.item_name || "";
            updated.rate = value.selling_price || 0;
          }
          if (field === "quantity" || field === "rate") {
            updated.amount = calculateLineItemAmount(updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        product: null,
        description: "",
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length <= 1) {
      toast.error("At least one line item is required");
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Handle submit
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!customer) {
      toast.error("Please select a customer");
      return;
    }

    if (lineItems.some((item) => !item.product || item.quantity <= 0)) {
      toast.error("Please fill in all line items correctly");
      return;
    }

    setLoading(true);

    // Prepare invoice data matching createSale endpoint structure
    const invoiceData = {
      customer_id: customer.customerNo || customer.id,
      saleDate: invoiceDate,
      facilityId: activeBusiness.id,
      created_by: user.id || user.email || user.fullname,
      txn_type: "Credit Sale",
      items: lineItems.map((item) => ({
        product_id: item.product?.sku || item.product?.item_code,
        item_name: item.product?.item_name || item.description,
        quantity: item.quantity,
        selling_price: item.rate,
        cost_price: item.product?.cost_price || 0,
        amount: item.amount,
        revenue_account: item.product?.revenue_account || "",
        inventory_account: item.product?.inventory_account || "",
        cogs_head: item.product?.cogs_head || "",
      })),
      taxes: selectedTax
        ? [
            {
              tax_id: selectedTax.id,
              rate: selectedTax.rate,
              tax_type: selectedTax.tax_type,
            },
          ]
        : [],
      discount_info: selectedDiscount
        ? {
            discount_id: selectedDiscount.discount_id,
            discount_name: selectedDiscount.discount_name,
            discount_type: selectedDiscount.discount_type,
            value: selectedDiscount.value,
          }
        : {},
      discount_amount: discountAmount,
      receivable_code:
        customer.receivable_code || activeBusiness?.receivable_code || "",
      sale_revenue_code: activeBusiness?.sale_revenue_code || "",
      finished_goods_code: activeBusiness?.finished_goods_code || "",
      inventory_account: activeBusiness?.inventory_account || "",
      cost_of_sale: activeBusiness?.cost_of_sale || "",
      notes: notes,
      terms: terms,
    };

    // Create invoice via API
    _postApi(
      "/api/v1/transactions/create-sale",
      invoiceData,
      (response) => {
        setLoading(false);
        if (response.success) {
          toast.success("Invoice created successfully");
          navigate("/app/invoice/list");
        } else {
          toast.error(response.message || "Failed to create invoice");
        }
      },
      (error) => {
        setLoading(false);
        console.error("Error creating invoice:", error);
        toast.error(
          error?.message || error?.error || "Error creating invoice",
        );
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/app/invoice/list")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                  Create Invoice
                </h1>
                <p className="text-gray-600 mt-1">Create a new sales invoice</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Customer & Invoice Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Customer Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer <span className="text-red-500">*</span>
                    </label>
                    <SearchCustomerInput
                      onSelect={(selectedCustomer) => {
                        setCustomer(selectedCustomer);
                      }}
                      selectedCustomer={customer}
                    />
                  </div>
                  {customer && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Bill To:</h3>
                      <p className="text-sm">
                        <strong>
                          {customer.customer_name || customer.fullname}
                        </strong>
                      </p>
                      {customer.address && (
                        <p className="text-sm text-gray-600">
                          {customer.address}
                        </p>
                      )}
                      {customer.phone && (
                        <p className="text-sm text-gray-600">
                          Phone: {customer.phone}
                        </p>
                      )}
                      {customer.email && (
                        <p className="text-sm text-gray-600">
                          Email: {customer.email}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Details */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Invoice Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Terms
                    </label>
                    <input
                      type="text"
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      placeholder="e.g., Net 30"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Product/Service Line Items */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Product or Service
                  </h2>
                  <Button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-2"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-5">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product/Service{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <TypeaheadCustom
                            options={products}
                            placeholder="Select product or service..."
                            labelKey="item_name"
                            onChange={(selectedItems) => {
                              const selectedProduct =
                                selectedItems.length > 0
                                  ? selectedItems[0]
                                  : null;
                              updateLineItem(
                                item.id,
                                "product",
                                selectedProduct
                              );
                            }}
                            selected={item.product ? [item.product] : []}
                          />
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Qty <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(
                                item.id,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selling Price <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) =>
                              updateLineItem(
                                item.id,
                                "rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount
                          </label>
                          <input
                            type="text"
                            value={`₦${formatNumber1(item.amount)}`}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-semibold"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-1 flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4">Notes</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Note to customer..."
                />
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                <h2 className="text-xl font-semibold mb-4">Summary</h2>

                {/* Tax Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Tax
                  </label>
                  <Select
                    options={taxes.map((tax) => ({
                      value: tax.id,
                      label: `${tax.description} (${tax.rate}%)`,
                      ...tax,
                    }))}
                    value={
                      selectedTax
                        ? {
                            value: selectedTax.id,
                            label: `${selectedTax.description} (${selectedTax.rate}%)`,
                          }
                        : null
                    }
                    onChange={(option) => {
                      setSelectedTax(
                        option ? taxes.find((t) => t.id === option.value) : null
                      );
                    }}
                    placeholder="Select tax..."
                    isClearable
                    isLoading={loadingTaxes}
                  />
                </div>

                {/* Discount Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Percent className="w-4 h-4 inline mr-1" />
                    Discount
                  </label>
                  <Select
                    options={discounts
                      .filter((d) => d.status === "active")
                      .map((discount) => ({
                        value: discount.discount_id,
                        label: `${discount.discount_name} (${
                          discount.discount_type === "Percentage"
                            ? `${discount.value}%`
                            : `₦${formatNumber1(discount.value)}`
                        })`,
                        ...discount,
                      }))}
                    value={
                      selectedDiscount
                        ? {
                            value: selectedDiscount.discount_id,
                            label: `${selectedDiscount.discount_name} (${
                              selectedDiscount.discount_type === "Percentage"
                                ? `${selectedDiscount.value}%`
                                : `₦${formatNumber1(selectedDiscount.value)}`
                            })`,
                          }
                        : null
                    }
                    onChange={(option) => {
                      setSelectedDiscount(
                        option
                          ? discounts.find(
                              (d) => d.discount_id === option.value
                            )
                          : null
                      );
                    }}
                    placeholder="Select discount..."
                    isClearable
                    isLoading={loadingDiscounts}
                  />
                </div>

                {/* Summary Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold">
                      ₦{formatNumber1(subtotal)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount:</span>
                      <span>-₦{formatNumber1(discountAmount)}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-semibold">
                        ₦{formatNumber1(taxAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                    <span>Total:</span>
                    <span className="text-blue-600">
                      ₦{formatNumber1(total)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 space-y-2">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                    style={{ backgroundColor: "#4267B2" }}
                  >
                    {loading ? (
                      "Saving..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Invoice
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/app/invoice/list")}
                    className="w-full"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
