/* eslint-disable no-unused-vars */
import CustomButton from "@/common/Custom/CustomButton";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { X, Trash2, Plus } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import { Label as ShadcnLabel } from "@/components/ui/label";
import { Input } from "reactstrap";
import { Input as ShadcnInput } from "@/components/ui/input";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Button } from "@/components/ui/button";
import Select from "react-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EstimateModal = ({
  closeModal,
  empty,
  showModal,
  getList,
  projectNumber,
  projectCustomer,
}) => {
  const { activeBusiness } = useSelector((state) => state.auth);
  const { user } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [selectedTaxes, setSelectedTaxes] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const [promptItemId, setPromptItemId] = useState(null); // Which row to show "add product or account" dialog
  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      itemType: "inventory",
      product: "",
      product_sku: "",
      account_code: "",
      account_name: "",
      description: "",
      quantity: "1",
      rate: "0",
      amount: "0",
      taxable: false,
    },
  ]);

  // Helper function to get initial form values
  const getInitialFormValues = useCallback(
    () => ({
      customer: "",
      email: "",
      cc_bcc: "",
      billing_address: "",
      estimate_date: new Date().toISOString().split("T")[0],
      message_on_estimate: "",
      tax_rate: "",
    }),
    [],
  );

  const [form, setForm] = useState(() => getInitialFormValues());

  const formatNumberWithCommas = (value) => {
    if (value === "" || value === null || value === undefined) return "";
    const str = String(value);
    const numericValue = str.replace(/[^0-9.]/g, "");
    const parts = numericValue.split(".");
    const integerPart = parts[0] || "";
    const decimalPart = parts[1] || "";
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimalPart
      ? `${formattedInteger}.${decimalPart}`
      : formattedInteger;
  };

  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    return String(value).replace(/,/g, "");
  };

  const handleNumericInput = (value) => {
    return value.replace(/[^0-9.,]/g, "");
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0.00";
    return Number(num).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";

  const filteredTaxes = useMemo(() => {
    if (!taxes || taxes.length === 0) return [];
    if (vatPolicy === "all") return taxes;
    if (vatPolicy === "vat_inclusive") {
      return taxes.filter(
        (tax) =>
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "inclusive"),
      );
    }
    return taxes.filter(
      (tax) =>
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "exclusive"),
    );
  }, [taxes, vatPolicy]);

  const calculateTaxAmount = (baseAmount, tax) => {
    if (!tax || !tax.rate) return 0;
    const rate = parseFloat(tax.rate);
    const isInclusive =
      vatPolicy === "all"
        ? tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
        : tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive");
    if (isInclusive) {
      if (tax.rate_type === "percentage") {
        return baseAmount - baseAmount / (1 + rate / 100);
      }
      return parseFloat(tax.rate || 0);
    }
    if (tax.rate_type === "percentage") {
      return (baseAmount * rate) / 100;
    }
    return parseFloat(tax.rate || 0);
  };

  const calculateTaxableSubtotal = () =>
    lineItems
      .filter((item) => !!item.taxable)
      .reduce(
        (sum, item) =>
          sum + (parseFloat(parseNumberFromFormatted(item.amount)) || 0),
        0,
      );

  const getAmountForTax = (tax) => {
    const taxableSubtotal = calculateTaxableSubtotal();
    let amount = 0;
    const isInclusive =
      tax.inclusive_type === "inclusive" ||
      (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive");
    if (isInclusive) {
      const inclusiveTaxes = selectedTaxes.filter(
        (t) =>
          t.inclusive_type === "inclusive" ||
          (t.inclusive_type === undefined && vatPolicy === "vat_inclusive"),
      );
      const totalRate = inclusiveTaxes.reduce(
        (sum, t) =>
          sum +
          (t.rate_type === "percentage" ? parseFloat(t.rate || 0) / 100 : 0),
        0,
      );
      if (totalRate > 0 && taxableSubtotal > 0) {
        const netAmount = taxableSubtotal / (1 + totalRate);
        const totalVAT = taxableSubtotal - netAmount;
        if (tax.rate_type === "percentage") {
          const taxRate = parseFloat(tax.rate || 0) / 100;
          amount = (totalVAT * taxRate) / totalRate;
        } else {
          amount = parseFloat(tax.rate || 0);
        }
      }
    } else {
      amount = calculateTaxAmount(taxableSubtotal, tax);
    }
    return amount;
  };

  const calculateTotalTax = () => {
    if (selectedTaxes.length === 0) return 0;
    const taxableSubtotal = calculateTaxableSubtotal();
    const inclusiveTaxes = selectedTaxes.filter((tax) => {
      if (vatPolicy === "all") {
        return (
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
        );
      }
      return (
        tax.inclusive_type === "inclusive" ||
        (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive")
      );
    });
    const exclusiveTaxes = selectedTaxes.filter((tax) => {
      if (vatPolicy === "all") {
        return (
          tax.inclusive_type === "exclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
        );
      }
      return (
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && vatPolicy === "vat_exclusive")
      );
    });
    let totalTax = 0;
    if (inclusiveTaxes.length > 0) {
      const totalInclusiveRate = inclusiveTaxes.reduce((sum, tax) => {
        if (tax.rate_type === "percentage") {
          return sum + parseFloat(tax.rate || 0) / 100;
        }
        return sum;
      }, 0);
      if (totalInclusiveRate > 0) {
        const netAmount = taxableSubtotal / (1 + totalInclusiveRate);
        totalTax += taxableSubtotal - netAmount;
      }
      inclusiveTaxes.forEach((tax) => {
        if (tax.rate_type === "fixed") {
          totalTax += parseFloat(tax.rate || 0);
        }
      });
    }
    exclusiveTaxes.forEach((tax) => {
      totalTax += calculateTaxAmount(taxableSubtotal, tax);
    });
    return totalTax;
  };

  const getTotalWithTax = () => {
    const totalTax = calculateTotalTax();
    if (vatPolicy === "all" && selectedTaxes.length > 0) {
      const exclusiveTaxes = selectedTaxes.filter(
        (tax) =>
          tax.inclusive_type === "exclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "exclusive"),
      );
      const taxableSubtotal = calculateTaxableSubtotal();
      let exclusiveVAT = 0;
      if (exclusiveTaxes.length > 0 && taxableSubtotal > 0) {
        exclusiveVAT = exclusiveTaxes.reduce((sum, tax) => {
          return sum + calculateTaxAmount(taxableSubtotal, tax);
        }, 0);
      }
      return subtotal + exclusiveVAT;
    }
    const allTaxesInclusive =
      selectedTaxes.length > 0 &&
      selectedTaxes.every(
        (tax) =>
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive"),
      );
    if (allTaxesInclusive) return subtotal;
    return subtotal + totalTax;
  };

  const getTaxes = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoadingTaxes(true);
    const taxCategory = encodeURIComponent("Sales");
    _fetchApi(
      `/api/get-taxes-by-category?facilityId=${activeBusiness.id}&tax_category=${taxCategory}`,
      (response) => {
        if (response?.success) {
          setTaxes(response.results || []);
        }
        setLoadingTaxes(false);
      },
      () => setLoadingTaxes(false),
    );
  }, [activeBusiness?.id]);

  // Initialize form and pre-fill customer from project
  useEffect(() => {
    if (showModal) {
      // Pre-fill customer from project
      if (projectCustomer && customers.length > 0) {
        const customer = customers.find(
          (c) => c.name === projectCustomer || c.customerNo === projectCustomer,
        );
        if (customer) {
          setSelectedCustomer(customer);
          setForm((prev) => ({
            ...prev,
            customer: customer.name,
            email: customer.email || "",
            billing_address: customer.address || "",
          }));
        }
      }
    } else {
      setForm(getInitialFormValues());
      setSelectedCustomer(null);
      setLineItems([
        {
          id: 1,
          itemType: "inventory",
          product: "",
          product_sku: "",
          account_code: "",
          account_name: "",
          description: "",
          quantity: "1",
          rate: "0",
          amount: "0",
          taxable: false,
        },
      ]);
      setErrors({});
    }
  }, [showModal, getInitialFormValues, projectCustomer, customers]);

  // Get customers list
  const getCustomers = useCallback(() => {
    _fetchApi(
      `/api/v1/get-customers-list/${facilityId}`,
      (response) => {
        if (response.success) {
          const customersList = response.results || response.data || [];
          setCustomers(
            customersList.map((customer) => ({
              id: customer.customerNo || customer.id,
              name: customer.fullname || customer.name,
              customerNo: customer.customerNo,
              email: customer.email || "",
              address: customer.address || "",
            })),
          );
        }
      },
      (err) => {
        console.error("Error loading customers:", err);
      },
    );
  }, [facilityId]);

  // Get products/services list from products table
  const getProducts = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/api/products/list-by-type/${facilityId}`,
      (response) => {
        if (response.success) {
          const productsList = response.data || response.results || [];
          setProducts(productsList);
        }
      },
      (err) => {
        console.error("Error loading products:", err);
      },
    );
  }, [facilityId]);

  // Fetch account list from account_category table
  const getAccountList = useCallback(() => {
    if (!facilityId) return;
    _fetchApi(
      `/account/account-categories?facilityId=${facilityId}`,
      (response) => {
        if (response.success && response.flat) {
          setAccountList(
            response.flat.map((item) => ({
              code: item.code,
              name:
                item.description ||
                [item.category, item.type, item.detail]
                  .filter(Boolean)
                  .join(" - ") ||
                item.code,
              account_type: item.accountNature || "",
            })),
          );
        }
      },
      (err) => {
        console.error("Error fetching account list:", err);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    getCustomers();
    getProducts();
    getAccountList();
    getTaxes();
  }, [getCustomers, getProducts, getAccountList, getTaxes]);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setForm((prev) => ({
      ...prev,
      customer: customer?.name || "",
      email: customer?.email || "",
      billing_address: customer?.address || "",
    }));
    if (errors.customer) {
      setErrors((prev) => ({
        ...prev,
        customer: "",
      }));
    }
  };

  // Line item handlers - with comma formatting for numeric fields (like JournalEntryForm)
  const updateLineItem = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };

        if (field === "quantity" || field === "rate" || field === "amount") {
          const withoutCommas = String(value || "").replace(/,/g, "");
          const sanitized = handleNumericInput(withoutCommas);
          const parts = sanitized.split(".");
          const numericStr =
            parts.length > 2
              ? parts[0] + "." + parts.slice(1).join("")
              : sanitized;
          const formatted = formatNumberWithCommas(numericStr);
          updated[field] = formatted;

          if (field === "quantity" || field === "rate") {
            const qty =
              parseFloat(parseNumberFromFormatted(updated.quantity)) || 0;
            const rate =
              parseFloat(parseNumberFromFormatted(updated.rate)) || 0;
            updated.amount = formatNumberWithCommas(String(qty * rate));
          } else if (field === "amount") {
            const amt =
              parseFloat(parseNumberFromFormatted(updated.amount)) || 0;
            const qty =
              parseFloat(parseNumberFromFormatted(updated.quantity)) || 1;
            updated.rate =
              qty > 0 ? formatNumberWithCommas(String(amt / qty)) : "0";
          }
        } else if (field === "taxable") {
          updated.taxable = Boolean(value);
        } else {
          updated[field] = value;
        }
        return updated;
      }),
    );
  };

  // Handle product selection for line item
  const handleProductSelect = (itemId, selected) => {
    if (selected.length > 0) {
      const product = selected[0];
      const rate = product.selling_price || product.cost_price || 0;
      const qty =
        parseFloat(
          parseNumberFromFormatted(
            lineItems.find((item) => item.id === itemId)?.quantity,
          ),
        ) || 1;
      const total = parseFloat(rate) * qty;

      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              itemType: item.itemType || "inventory",
              product: product.name || "",
              product_sku: product.sku || "",
              account_code: "",
              account_name: "",
              description: product.description || product.notes || "",
              rate: formatNumberWithCommas(String(rate)),
              amount: formatNumberWithCommas(String(total)),
              taxable: product.taxable === "Taxable",
            };
          }
          return item;
        }),
      );
    } else {
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              product: "",
              product_sku: "",
              description: "",
              rate: "0",
              amount: "0",
              taxable: false,
            };
          }
          return item;
        }),
      );
    }
  };

  // Handle account selection for line item (Cost Breakdown style)
  const handleAccountSelect = (itemId, selected) => {
    if (selected.length > 0) {
      const account = selected[0];
      const quantity =
        lineItems.find((item) => item.id === itemId)?.quantity || 1;

      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              itemType: "account",
              product: "",
              product_sku: "",
              account_code: account.code || "",
              account_name: account.name || "",
              description: account.name || "",
              rate: "0",
              amount: "0",
              taxable: false,
            };
          }
          return item;
        }),
      );
    } else {
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              account_code: "",
              account_name: "",
              description: "",
              rate: "0",
              amount: "0",
              taxable: false,
            };
          }
          return item;
        }),
      );
    }
  };

  // Handle type change (Inventory / Service / Account) - clear selection when switching
  const handleItemTypeChange = (itemId, newType) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            itemType: newType,
            product: "",
            product_sku: "",
            account_code: "",
            account_name: "",
            description: "",
            rate: "0",
            amount: "0",
            taxable: false,
          };
        }
        return item;
      }),
    );
  };

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map((item) => item.id), 0) + 1;
    setLineItems((prev) => [
      ...prev,
      {
        id: newId,
        itemType: "inventory",
        product: "",
        product_sku: "",
        account_code: "",
        account_name: "",
        description: "",
        quantity: "1",
        rate: "0",
        amount: "0",
        taxable: false,
      },
    ]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const clearAllLines = () => {
    setLineItems([
      {
        id: 1,
        itemType: "inventory",
        product: "",
        product_sku: "",
        account_code: "",
        account_name: "",
        description: "",
        quantity: "1",
        rate: "0",
        amount: "0",
        taxable: false,
      },
    ]);
  };

  // Calculate totals
  const subtotal = lineItems.reduce(
    (sum, item) =>
      sum + (parseFloat(parseNumberFromFormatted(item.amount)) || 0),
    0,
  );
  const taxAmount = calculateTotalTax();
  const total = getTotalWithTax();

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!selectedCustomer) {
      newErrors.customer = "Customer is required";
    }
    if (!form.estimate_date) {
      newErrors.estimate_date = "Estimate date is required";
    }
    if (
      lineItems.some(
        (item) =>
          !item.product &&
          !item.account_name &&
          !(item.description && item.description.trim()),
      )
    ) {
      newErrors.lineItems =
        "Please select a product/account or add a description for each line item";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const success_callback = () => {
    setLoading(false);
    getList();
    closeModal();
    empty();
    setForm(getInitialFormValues());
    setSelectedCustomer(null);
    setSelectedTaxes([]);
    setLineItems([
      {
        id: 1,
        itemType: "inventory",
        product: "",
        product_sku: "",
        account_code: "",
        account_name: "",
        description: "",
        quantity: "1",
        rate: "0",
        amount: "0",
      },
    ]);
    setErrors({});
  };

  const handleSubmit = (e) => {
    e?.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setLoading(true);

    try {
      const taxableSubtotalForPayload = calculateTaxableSubtotal();
      const taxesArray = selectedTaxes.map((tax) => {
        let taxAmountForTax = 0;
        const isInclusive =
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive");
        if (isInclusive) {
          const inclusiveTaxes = selectedTaxes.filter(
            (t) =>
              t.inclusive_type === "inclusive" ||
              (t.inclusive_type === undefined && vatPolicy === "vat_inclusive"),
          );
          const totalRate = inclusiveTaxes.reduce(
            (sum, t) =>
              sum +
              (t.rate_type === "percentage"
                ? parseFloat(t.rate || 0) / 100
                : 0),
            0,
          );
          if (totalRate > 0 && taxableSubtotalForPayload > 0) {
            const netAmount = taxableSubtotalForPayload / (1 + totalRate);
            const totalVAT = taxableSubtotalForPayload - netAmount;
            if (tax.rate_type === "percentage") {
              const taxRate = parseFloat(tax.rate || 0) / 100;
              taxAmountForTax = (totalVAT * taxRate) / totalRate;
            } else {
              taxAmountForTax = parseFloat(tax.rate || 0);
            }
          }
        } else {
          taxAmountForTax = calculateTaxAmount(taxableSubtotalForPayload, tax);
        }
        return {
          id: tax.id,
          name: tax.description || tax.name,
          description: tax.description,
          rate: parseFloat(tax.rate),
          head: tax.account_sub_head,
          amount: taxAmountForTax,
          tax_type:
            tax.inclusive_type ||
            (vatPolicy === "vat_inclusive" ? "inclusive" : "exclusive"),
          rate_type: tax.rate_type || "percentage",
          inclusive_type: tax.inclusive_type,
        };
      });

      const payload = {
        project_number: projectNumber,
        customer_id: selectedCustomer?.customerNo || selectedCustomer?.id,
        customer_name: selectedCustomer?.name,
        email: form.email,
        cc_bcc: form.cc_bcc,
        billing_address: form.billing_address,
        estimate_date: form.estimate_date,
        message_on_estimate: form.message_on_estimate,
        line_items: lineItems.map((item) => ({
          product_service: item.product || item.account_name,
          product_sku: item.product_sku,
          account_code: item.account_code,
          item_type: item.itemType || "inventory",
          description: item.description,
          quantity:
            parseFloat(parseNumberFromFormatted(item.quantity) || "0") || 0,
          rate: parseFloat(parseNumberFromFormatted(item.rate) || "0") || 0,
          amount: parseFloat(parseNumberFromFormatted(item.amount) || "0") || 0,
          taxable: !!item.taxable,
        })),
        subtotal,
        tax_amount: taxAmount,
        taxes: taxesArray,
        total,
        facilityId,
      };

      _postApi(
        `/api/estimates`,
        payload,
        (res) => {
          setLoading(false);
          if (!res.success) {
            toast.error(res.message || "An error occurred!");
            return;
          }
          toast.success("Estimate created successfully");
          success_callback();
        },
        (err) => {
          setLoading(false);
          console.error(err);
          toast.error("An error occurred while creating estimate!");
        },
      );
    } catch (err) {
      console.error(err);
      toast.error("An error occurred!");
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    closeModal();
    empty();
    setForm(getInitialFormValues());
    setSelectedCustomer(null);
    setLineItems([
      {
        id: 1,
        product: "",
        description: "",
        quantity: "1",
        rate: "0",
        amount: "0",
        tax: "0",
      },
    ]);
    setErrors({});
  };

  return (
    <>
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Create Estimate</h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Create a new estimate for this project
                  </p>
                </div>
                <button
                  onClick={handleModalClose}
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
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {/* Top Section - Compact grid to use space */}
                <div className="space-y-4">
                  {/* Row 1: Project Number | Estimate date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <ShadcnLabel
                        htmlFor="project_number"
                        className="text-sm font-semibold text-gray-700 mb-1 block"
                      >
                        Project Number
                      </ShadcnLabel>
                      <input
                        type="text"
                        id="project_number"
                        name="project_number"
                        value={projectNumber || ""}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <ShadcnLabel
                        htmlFor="estimate_date"
                        className="text-sm font-semibold text-gray-700 mb-1 block"
                      >
                        Estimate date <span className="text-red-500">*</span>
                      </ShadcnLabel>
                      <Input
                        type="date"
                        id="estimate_date"
                        name="estimate_date"
                        value={form.estimate_date}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {errors.estimate_date && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.estimate_date}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Customer | Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <ShadcnLabel
                        htmlFor="customer"
                        className="text-sm font-semibold text-gray-700 mb-1 block"
                      >
                        Customer <span className="text-red-500">*</span>
                      </ShadcnLabel>
                      <TypeaheadCustom
                        options={customers}
                        placeholder="Search customers..."
                        labelKey={(customer) =>
                          `${customer.name} (${customer.customerNo || customer.id})`
                        }
                        onChange={(selectedItems) => {
                          const selected =
                            selectedItems.length > 0 ? selectedItems[0] : null;
                          handleCustomerSelect(selected);
                        }}
                        selected={selectedCustomer ? [selectedCustomer] : []}
                      />
                      {errors.customer && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.customer}
                        </p>
                      )}
                    </div>
                    <div>
                      <ShadcnLabel
                        htmlFor="email"
                        className="text-sm font-semibold text-gray-700 mb-1 block"
                      >
                        Email
                      </ShadcnLabel>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="Email (Separate emails with a comma)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Row 3: Billing address - full width, compact */}
                  <div>
                    <ShadcnLabel
                      htmlFor="billing_address"
                      className="text-sm font-semibold text-gray-700 mb-1 block"
                    >
                      Billing address
                    </ShadcnLabel>
                    <textarea
                      id="billing_address"
                      name="billing_address"
                      value={form.billing_address}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* Line Items Table - Cost Breakdown style (same as Markup.jsx) */}
                <div className="border rounded-lg overflow-hidden bg-gray-50/30">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-blue-700 text-white">
                          <th className="px-1 py-2 text-left text-xs font-bold uppercase w-24">
                            Type
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase w-64">
                            Inventory / Service / Account
                          </th>
                          <th className="px-2 py-2 text-left text-xs font-bold uppercase">
                            Description
                          </th>
                          <th className="px-1 py-2 text-center text-xs font-bold uppercase w-20">
                            Qty
                          </th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase">
                            Rate
                          </th>
                          <th className="px-2 py-2 text-right text-xs font-bold uppercase">
                            Amount (₦)
                          </th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase w-16">
                            Taxable
                          </th>
                          <th className="px-2 py-2 text-center text-xs font-bold uppercase w-12">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {lineItems.map((item, index) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-1 py-2">
                              <select
                                value={item.itemType || "inventory"}
                                onChange={(e) =>
                                  handleItemTypeChange(item.id, e.target.value)
                                }
                                className={`text-xs border rounded px-1 py-0.5 font-medium w-24 ${
                                  item.itemType === "inventory"
                                    ? "bg-orange-100 text-orange-700 border-orange-200"
                                    : item.itemType === "service"
                                      ? "bg-blue-100 text-blue-700 border-blue-200"
                                      : "bg-gray-100 text-gray-700 border-gray-200"
                                }`}
                              >
                                <option value="inventory">Inventory</option>
                                <option value="service">Service</option>
                                <option value="account">Account</option>
                              </select>
                            </td>
                            <td className="px-2 py-2 w-64">
                              {(item.itemType || "inventory") ===
                              "inventory" ? (
                                <Select
                                  options={(products || [])
                                    .filter(
                                      (p) =>
                                        !p.item_type ||
                                        String(p.item_type).toLowerCase() !==
                                          "service",
                                    )
                                    .map((product) => ({
                                      value: product,
                                      label: `${product.name || "N/A"} (${
                                        product.sku || "N/A"
                                      })${product.item_type ? ` - ${product.item_type}` : ""}`,
                                    }))}
                                  placeholder="Search inventory..."
                                  isClearable
                                  menuPlacement="auto"
                                  value={
                                    item.product_sku && item.product
                                      ? (() => {
                                          const p = products.find(
                                            (pr) =>
                                              pr.sku === item.product_sku &&
                                              pr.name === item.product,
                                          );
                                          return p
                                            ? {
                                                value: p,
                                                label: `${p.name || "N/A"} (${p.sku || "N/A"})${p.item_type ? ` - ${p.item_type}` : ""}`,
                                              }
                                            : null;
                                        })()
                                      : null
                                  }
                                  onChange={(selected) =>
                                    handleProductSelect(
                                      item.id,
                                      selected ? [selected.value] : [],
                                    )
                                  }
                                  styles={{
                                    control: (provided, state) => ({
                                      ...provided,
                                      minHeight: "38px",
                                      borderColor: state.isFocused
                                        ? "#3b82f6"
                                        : "#d1d5db",
                                      borderWidth: "1px",
                                      borderRadius: "0.5rem",
                                      boxShadow: state.isFocused
                                        ? "0 0 0 3px rgb(59 130 246 / 0.1)"
                                        : "none",
                                      fontSize: "14px",
                                    }),
                                    menu: (provided) => ({
                                      ...provided,
                                      zIndex: 9999,
                                    }),
                                    menuPortal: (provided) => ({
                                      ...provided,
                                      zIndex: 9999,
                                    }),
                                  }}
                                  menuPortalTarget={document.body}
                                />
                              ) : (item.itemType || "inventory") ===
                                "service" ? (
                                <Select
                                  options={(products || [])
                                    .filter(
                                      (p) =>
                                        String(
                                          p.item_type || "",
                                        ).toLowerCase() === "service",
                                    )
                                    .map((product) => ({
                                      value: product,
                                      label: `${product.name || "N/A"} (${
                                        product.sku || "N/A"
                                      })${product.item_type ? ` - ${product.item_type}` : ""}`,
                                    }))}
                                  placeholder="Search service..."
                                  isClearable
                                  menuPlacement="auto"
                                  value={
                                    item.product_sku && item.product
                                      ? (() => {
                                          const p = (products || []).find(
                                            (pr) =>
                                              pr.sku === item.product_sku &&
                                              pr.name === item.product,
                                          );
                                          return p
                                            ? {
                                                value: p,
                                                label: `${p.name || "N/A"} (${p.sku || "N/A"})${p.item_type ? ` - ${p.item_type}` : ""}`,
                                              }
                                            : null;
                                        })()
                                      : null
                                  }
                                  onChange={(selected) =>
                                    handleProductSelect(
                                      item.id,
                                      selected ? [selected.value] : [],
                                    )
                                  }
                                  styles={{
                                    control: (provided, state) => ({
                                      ...provided,
                                      minHeight: "38px",
                                      borderColor: state.isFocused
                                        ? "#3b82f6"
                                        : "#d1d5db",
                                      borderWidth: "1px",
                                      borderRadius: "0.5rem",
                                      boxShadow: state.isFocused
                                        ? "0 0 0 3px rgb(59 130 246 / 0.1)"
                                        : "none",
                                      fontSize: "14px",
                                    }),
                                    menu: (provided) => ({
                                      ...provided,
                                      zIndex: 9999,
                                    }),
                                    menuPortal: (provided) => ({
                                      ...provided,
                                      zIndex: 9999,
                                    }),
                                  }}
                                  menuPortalTarget={document.body}
                                />
                              ) : (
                                <Select
                                  options={(accountList || []).map((acc) => ({
                                    value: acc,
                                    label: `${acc.code || "N/A"} ${acc.name || "N/A"}${acc.account_type ? ` - ${acc.account_type}` : ""}`,
                                  }))}
                                  placeholder="Select account..."
                                  isClearable
                                  menuPlacement="auto"
                                  value={
                                    item.account_code
                                      ? (() => {
                                          const a = (accountList || []).find(
                                            (acc) =>
                                              acc.code === item.account_code,
                                          );
                                          return a
                                            ? {
                                                value: a,
                                                label: `${a.code || "N/A"} ${a.name || "N/A"}${a.account_type ? ` - ${a.account_type}` : ""}`,
                                              }
                                            : null;
                                        })()
                                      : null
                                  }
                                  onChange={(selected) =>
                                    handleAccountSelect(
                                      item.id,
                                      selected ? [selected.value] : [],
                                    )
                                  }
                                  styles={{
                                    control: (provided, state) => ({
                                      ...provided,
                                      minHeight: "38px",
                                      borderColor: state.isFocused
                                        ? "#3b82f6"
                                        : "#d1d5db",
                                      borderWidth: "1px",
                                      borderRadius: "0.5rem",
                                      boxShadow: state.isFocused
                                        ? "0 0 0 3px rgb(59 130 246 / 0.1)"
                                        : "none",
                                      fontSize: "14px",
                                    }),
                                    menu: (provided) => ({
                                      ...provided,
                                      zIndex: 9999,
                                    }),
                                    menuPortal: (provided) => ({
                                      ...provided,
                                      zIndex: 9999,
                                    }),
                                  }}
                                  menuPortalTarget={document.body}
                                />
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "description",
                                    e.target.value,
                                  )
                                }
                                className="w-full border-0 focus:ring-0 p-0 text-sm"
                                placeholder="Description"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <ShadcnInput
                                type="text"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.00"
                                className="w-full min-w-[70px] text-right"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <ShadcnInput
                                type="text"
                                value={item.rate}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "rate",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.00"
                                className="w-full min-w-[80px] text-right"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <ShadcnInput
                                type="text"
                                value={item.amount}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "amount",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.00"
                                className="w-full min-w-[90px] text-right"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <Checkbox
                                checked={!!item.taxable}
                                onCheckedChange={(checked) =>
                                  updateLineItem(item.id, "taxable", checked)
                                }
                                className="h-4 w-4"
                              />
                            </td>
                            <td className="px-2 py-2 text-center bg-gray-50">
                              <button
                                type="button"
                                onClick={() => removeLineItem(item.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove line"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-gray-200">
                        <tr className="bg-white">
                          <td
                            colSpan={5}
                            className="px-2 py-2 text-right text-sm font-medium text-gray-700"
                          >
                            SUBTOTAL:
                          </td>
                          <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">
                            ₦{formatNumber(subtotal)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                        {selectedTaxes.map((tax) => {
                          const taxAmt = getAmountForTax(tax);
                          const isInc =
                            tax.inclusive_type === "inclusive" ||
                            (tax.inclusive_type === undefined &&
                              vatPolicy === "vat_inclusive");
                          const rateLabel =
                            tax.rate_type === "percentage"
                              ? `${tax.rate}%`
                              : "Fixed";
                          return (
                            <tr key={tax.id} className="bg-emerald-50/70">
                              <td
                                colSpan={5}
                                className="px-2 py-2 text-right text-sm font-medium text-gray-700"
                              >
                                {tax.description || tax.name} ({rateLabel}){" "}
                                {isInc ? (
                                  <span className="text-blue-600">Inc</span>
                                ) : (
                                  <span className="text-green-600">Exc</span>
                                )}
                                :
                              </td>
                              <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">
                                ₦{formatNumber(taxAmt)}
                              </td>
                              <td colSpan={2} />
                            </tr>
                          );
                        })}
                        <tr className="bg-orange-200 text-black">
                          <td
                            colSpan={5}
                            className="px-2 py-2 text-right text-sm font-bold"
                          >
                            TOTAL:
                          </td>
                          <td className="px-2 py-2 text-right text-sm font-bold">
                            ₦{formatNumber(total)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Table Actions + Tax Selection */}
                <div className="flex flex-nowrap items-center gap-3 mt-2 overflow-x-auto">
                  <Button type="button" variant="outline" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add lines
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearAllLines}
                  >
                    Clear all lines
                  </Button>
                  {/* Tax toggles beside Clear all lines */}
                  {filteredTaxes.length > 0 && (
                    <div className="flex flex-nowrap items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                      {filteredTaxes.map((tax) => {
                        const isSelected = selectedTaxes.some(
                          (t) => t.id === tax.id,
                        );
                        const isInclusive =
                          tax.inclusive_type === "inclusive" ||
                          (tax.inclusive_type === undefined &&
                            tax.tax_type === "inclusive");
                        const isExclusive =
                          tax.inclusive_type === "exclusive" ||
                          (tax.inclusive_type === undefined &&
                            tax.tax_type === "exclusive");
                        return (
                          <div
                            key={tax.id}
                            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors flex-shrink-0"
                          >
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTaxes((prev) => [...prev, tax]);
                                  } else {
                                    setSelectedTaxes((prev) =>
                                      prev.filter((t) => t.id !== tax.id),
                                    );
                                  }
                                }}
                                className="sr-only"
                              />
                              <div
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedTaxes((prev) =>
                                      prev.filter((t) => t.id !== tax.id),
                                    );
                                  } else {
                                    setSelectedTaxes((prev) => [...prev, tax]);
                                  }
                                }}
                                className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${
                                  isSelected ? "bg-green-600" : "bg-gray-300"
                                }`}
                              >
                                <div
                                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                    isSelected ? "transform translate-x-5" : ""
                                  }`}
                                />
                              </div>
                            </div>
                            <label className="text-xs font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                              {tax.description} ({tax.rate}%)
                              {(isInclusive || isExclusive) && (
                                <span
                                  className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                                    isInclusive
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {isInclusive ? "Inc" : "Exc"}
                                </span>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {loadingTaxes && (
                    <span className="text-xs text-gray-500">
                      Loading taxes...
                    </span>
                  )}
                </div>

                {/* Message Field */}
                <div>
                  <ShadcnLabel
                    htmlFor="message_on_estimate"
                    className="text-sm font-semibold"
                  >
                    Notes
                  </ShadcnLabel>
                  <Input
                    type="textarea"
                    id="message_on_estimate"
                    name="message_on_estimate"
                    value={form.message_on_estimate}
                    onChange={handleChange}
                    rows={3}
                    className="mt-1 w-full"
                  />
                </div>

                {/* Error for line items */}
                {errors.lineItems && (
                  <p className="text-sm text-red-500">{errors.lineItems}</p>
                )}
              </div>

              {/* Footer Actions */}
              <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                  disabled={loading}
                >
                  <X className="w-4 h-4 inline mr-2" />
                  Cancel
                </button>
                <CustomButton
                  loading={loading}
                  size="2"
                  onClick={handleSubmit}
                  className="px-4 py-2"
                >
                  Create Estimate
                </CustomButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

EstimateModal.propTypes = {
  closeModal: PropTypes.func.isRequired,
  empty: PropTypes.func.isRequired,
  showModal: PropTypes.bool.isRequired,
  getList: PropTypes.func.isRequired,
  projectNumber: PropTypes.string.isRequired,
  projectCustomer: PropTypes.string,
};

export default EstimateModal;
